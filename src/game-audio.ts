import { MathUtils } from 'three'
import { randomize } from './graphics'
import { IDLE_RPM, REDLINE_RPM, makeV10Voice } from './engine-audio'

type Source = { distance: number; pan: number }
type DriveSound = {
  speed: number; throttle: number; slip: number; handbrake: boolean; drifting: boolean; pitch: number
  engine: 'standard' | 'v10' | 'electric' | 'motorcycle'; rpm?: number; load: number
}
type SoundFrame = {
  waterfront: number
  traffic: Source & { speed: number }
  streetcar: Source
  train: Source
  collisionSkid?: { strength: number; pan: number }
  drive: DriveSound | null
}

const loopNames = ['city', 'waterfront', 'passingCar', 'streetcarRoll', 'goTrainRoll', 'engineIdle', 'engineRev', 'tireRoll', 'tireSqueal'] as const
const effects = ['impactSoft', 'impactHard', 'streetcarBell', 'doorClose', 'fixtureBreak'] as const
type Loop = typeof loopNames[number]
type Channel = Loop | 'collisionSkid'
type Effect = typeof effects[number]

function makeGraph(context: AudioContext) {
  const master = context.createGain()
  master.gain.value = 0
  const compressor = context.createDynamicsCompressor()
  compressor.threshold.value = -15
  compressor.ratio.value = 3
  master.connect(compressor).connect(context.destination)

  const set = (param: AudioParam, value: number, smooth = .08) => {
    param.setTargetAtTime(value, context.currentTime, smooth)
  }
  const makeFilter = (type: BiquadFilterType, frequency: number, q = .67) => {
    const filter = context.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    return filter
  }
  const noise = context.createBuffer(1, context.sampleRate * 5, context.sampleRate)
  const random = randomize(152692)
  const signal = noise.getChannelData(0)
  for (let i = 0; i < signal.length; i++) signal[i] = random() * 2 - 1

  const channels = new Map<Channel, { fader: GainNode; fallback: GainNode; pan: StereoPannerNode }>()
  function channel(name: Channel) {
    const fader = context.createGain()
    const fallback = context.createGain()
    const pan = context.createStereoPanner()
    fader.gain.value = 0
    fallback.connect(fader).connect(pan).connect(master)
    channels.set(name, { fader, fallback, pan })
    return fallback
  }

  function noiseLoop(name: Channel, type: BiquadFilterType, frequency: number, q = .67) {
    const destination = channel(name)
    const source = context.createBufferSource()
    const filter = makeFilter(type, frequency, q)
    source.buffer = noise
    source.loop = true
    source.connect(filter).connect(destination)
    source.start(0, channels.size * .47 % noise.duration)
    return { filter, source, destination }
  }

  const city = noiseLoop('city', 'lowpass', 330)
  const lake = noiseLoop('waterfront', 'lowpass', 680)
  const automobiles = noiseLoop('passingCar', 'lowpass', 525)
  const tram = noiseLoop('streetcarRoll', 'bandpass', 487, .88)
  const rail = noiseLoop('goTrainRoll', 'lowpass', 415)
  const road = noiseLoop('tireRoll', 'bandpass', 490, .62)
  const skid = noiseLoop('tireSqueal', 'bandpass', 1310, 3.9)
  const otherSkid = noiseLoop('collisionSkid', 'bandpass', 1160, 5.9)
  const tireTone = context.createOscillator()
  const tireLevel = context.createGain()
  tireTone.type = 'triangle'
  tireLevel.gain.value = .044
  tireTone.connect(tireLevel).connect(otherSkid.destination)
  tireTone.start()
  const idle = channel('engineIdle')
  const rev = channel('engineRev')

  const motor = context.createOscillator()
  const overtones = context.createOscillator()
  const motorFilter = makeFilter('lowpass', 550, .8)
  const revFilter = makeFilter('lowpass', 890, .97)
  const wave = context.createPeriodicWave(
    new Float32Array(10),
    new Float32Array([0, .71, .31, .24, .16, .09, .085, .067, .046, .023]),
  )
  motor.setPeriodicWave(wave)
  overtones.setPeriodicWave(wave)
  motor.connect(motorFilter).connect(idle)
  overtones.connect(revFilter).connect(rev)
  motor.start()
  overtones.start()
  const v10 = makeV10Voice(context, master, noise)

  const impactSamples = new Map<Effect, AudioBuffer>()
  const loopSamples = new Map<Channel, AudioBufferSourceNode>()
  const packUrl = new URL(`${import.meta.env.BASE_URL}audio/`, location.origin)
  async function loadPack() {
    const response = await fetch(new URL('pack.json', packUrl))
    if (!response.ok) return
    const pack = await response.json() as Partial<Record<Loop | Effect, unknown>>
    await Promise.all([...loopNames, ...effects].map(async (name) => {
      const file = pack?.[name]
      if (typeof file !== 'string' || !/^[a-z\d][a-z\d._ -]*\.(?:wav|mp3|ogg|m4a)$/i.test(file)) return
      const result = await fetch(new URL(encodeURIComponent(file), packUrl))
      if (!result.ok) return
      const buffer = await context.decodeAudioData(await result.arrayBuffer())
      const listener = channels.get(name as Loop)
      if (!listener) {
        impactSamples.set(name as Effect, buffer)
        return
      }
      const channelsToReplace: Channel[] = name === 'tireSqueal' ? ['tireSqueal', 'collisionSkid'] : [name as Loop]
      for (const track of channelsToReplace) {
        const output = channels.get(track)!
        const source = context.createBufferSource()
        const level = context.createGain()
        level.gain.value = name.startsWith('engine') ? 1 : .66
        source.buffer = buffer
        source.loop = true
        source.connect(level).connect(output.fader)
        source.start(0, track === 'collisionSkid' ? Math.min(.17, buffer.duration * .5) : 0)
        loopSamples.set(track, source)
        set(output.fallback.gain, 0, .18)
      }
    }))
  }
  void loadPack().catch(() => {})

  function mix(name: Channel, level: number, pan = 0) {
    const channel = channels.get(name)!
    set(channel.fader.gain, level)
    set(channel.pan.pan, pan)
  }
  const near = (distance: number, range: number) => Math.max(0, 1 - distance / range) ** 2
  let wasByTram = false
  let lastBell = -12
  function frame(state: SoundFrame) {
    const t = context.currentTime
    const swell = .74 + Math.sin(t * 1.49) * .16 + Math.sin(t * .66) * .1
    const urban = .88 + .12 * Math.sin(t * .68)
    mix('city', MathUtils.lerp(.23, .10, state.waterfront) * urban)
    mix('waterfront', state.waterfront * .51 * swell)
    set(city.filter.frequency, 280 + urban * 90)
    set(lake.filter.frequency, 475 + swell * 265)
    mix('passingCar', near(state.traffic.distance, 43) * (.16 + state.traffic.speed * .029), state.traffic.pan)
    set(automobiles.filter.frequency, 320 + state.traffic.speed * 42)
    const byTram = state.streetcar.distance < 13
    mix('streetcarRoll', near(state.streetcar.distance, 48) * .53, state.streetcar.pan)
    set(tram.filter.frequency, 465 + 63 * Math.sin(t * 19))
    if (byTram && !wasByTram && t - lastBell > 11) {
      bell(state.streetcar.pan)
      lastBell = t
    }
    wasByTram = byTram
    mix('goTrainRoll', near(state.train.distance, 76) * (.69 + .13 * Math.sin(t * 29)), state.train.pan)
    set(rail.filter.frequency, 360 + 102 * Math.sin(t * 23))
    const strength = state.collisionSkid?.strength ?? 0
    mix('collisionSkid', strength * .64, state.collisionSkid?.pan)
    const tireFrequency = 935 + strength * 640 + 90 * Math.sin(t * 49)
    set(otherSkid.filter.frequency, tireFrequency, .034)
    set(tireTone.frequency, tireFrequency * .88 + 34 * Math.sin(t * 76), .027)
    const { drive } = state
    if (!drive) {
      for (const name of ['engineIdle', 'engineRev', 'tireRoll', 'tireSqueal'] as const) mix(name, 0)
      v10(IDLE_RPM, 0, false)
      return
    }

    const gas = Math.abs(drive.throttle)
    const speed = drive.speed
    const premium = drive.engine === 'v10'
    v10(drive.rpm ?? IDLE_RPM, drive.load, premium)
    if (premium) {
      mix('engineIdle', 0)
      mix('engineRev', 0)
    } else {
      const revs = drive.rpm === undefined ? Math.min(1, speed * .024 + gas * .38)
        : MathUtils.clamp((drive.rpm - IDLE_RPM) / (REDLINE_RPM - IDLE_RPM), 0, 1)
      const load = drive.rpm === undefined ? gas : drive.load
      const tone = (31 + revs * 86) * drive.pitch
      set(motor.frequency, Math.max(29, tone * .79), .067)
      set(overtones.frequency, tone, .065)
      set(revFilter.frequency, 640 + revs * 730 + load * 410)
      for (const name of ['engineIdle', 'engineRev'] as const) {
        const sample = loopSamples.get(name)
        if (sample) set(sample.playbackRate, .77 + revs * .68, .06)
      }
      mix('engineIdle', .093 - revs * .063)
      mix('engineRev', .015 + revs * .074 + load * .031)
    }
    mix('tireRoll', Math.min(.44, speed * .018))
    set(road.filter.frequency, 380 + speed * 28)
    const squeal = drive.drifting ? Math.min(.58, .17 + Math.abs(drive.slip) * .077) : drive.handbrake && speed > 3 ? Math.min(.22, speed * .012) : 0
    mix('tireSqueal', squeal)
    set(skid.filter.frequency, 805 + speed * 59 + 110 * Math.sin(t * 34), .035)
  }

  function play(name: Effect, gain: number, pan = 0) {
    const buffer = impactSamples.get(name)
    if (!buffer) return false
    const source = context.createBufferSource()
    const volume = context.createGain()
    const stereo = context.createStereoPanner()
    source.buffer = buffer
    volume.gain.value = gain
    stereo.pan.value = pan
    source.connect(volume).connect(stereo).connect(master)
    source.onended = () => { source.disconnect(); volume.disconnect(); stereo.disconnect() }
    source.start()
    return true
  }

  function burst(frequency: number, length: number, level: number, pitch: number) {
    const t = context.currentTime
    const source = context.createBufferSource()
    const filter = makeFilter('lowpass', frequency, 1.1)
    const gain = context.createGain()
    source.buffer = noise
    source.connect(filter).connect(gain).connect(master)
    gain.gain.setValueAtTime(level, t)
    gain.gain.exponentialRampToValueAtTime(.001, t + length)
    source.start(t, random() * 3, length)
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
    const thump = context.createOscillator()
    const body = context.createGain()
    thump.frequency.setValueAtTime(pitch, t)
    thump.frequency.exponentialRampToValueAtTime(pitch * .39, t + .14)
    body.gain.setValueAtTime(level * .28, t)
    body.gain.exponentialRampToValueAtTime(.001, t + .17)
    thump.connect(body).connect(master)
    thump.start(t)
    thump.stop(t + .18)
    thump.onended = () => { thump.disconnect(); body.disconnect() }
  }

  function bell(pan: number) {
    if (play('streetcarBell', .18, pan)) return
    const stereo = context.createStereoPanner()
    stereo.pan.value = pan
    stereo.connect(master)
    for (const [index, frequency] of [824, 1183].entries()) {
      const t = context.currentTime + index * .12
      const ring = context.createOscillator()
      const volume = context.createGain()
      ring.frequency.value = frequency
      volume.gain.setValueAtTime(.044 - .009 * index, t)
      volume.gain.exponentialRampToValueAtTime(.001, t + .32)
      ring.connect(volume).connect(stereo)
      ring.start(t)
      ring.stop(t + .34)
      ring.onended = () => {
        ring.disconnect()
        volume.disconnect()
        if (index === 1) stereo.disconnect()
      }
    }
  }

  return {
    context, frame,
    volume(value: number) { set(master.gain, value, .047) },
    impact(severity: number) {
      if (!play(severity >= .42 ? 'impactHard' : 'impactSoft', .19 + severity * .36)) {
        burst(560 + severity * 2370, .15 + severity * .33, .25 + severity * .44, 91 + severity * 30)
      }
    },
    door() { if (!play('doorClose', .25)) burst(790, .14, .25, 99) },
    fixture(force: number) {
      if (!play('fixtureBreak', .12 + force * .11)) burst(2320 + force * 1000, .19, .16 + force * .17, 171)
    },
  }
}

export function makeGameAudio() {
  let graph: ReturnType<typeof makeGraph> | null = null
  let muted = false
  let playing = false
  const volume = () => graph?.volume(playing && !muted && !document.hidden ? .76 : 0)
  const audible = () => playing && !muted && !document.hidden && graph?.context.state === 'running'

  return {
    setPlaying(value: boolean) {
      playing = value
      if (value && !graph && typeof AudioContext !== 'undefined') {
        try { graph = makeGraph(new AudioContext()) } catch { return }
      }
      if (value && graph?.context.state !== 'running') void graph?.context.resume().catch(() => {})
      volume()
    },
    refresh: volume,
    mute(value: boolean) { muted = value; volume() },
    isAudible: audible,
    frame(state: SoundFrame) { if (audible()) graph?.frame(state) },
    impact(severity: number) { if (audible()) graph?.impact(severity) },
    door() { if (audible()) graph?.door() },
    fixture(force: number) { if (audible()) graph?.fixture(force) },
  }
}
