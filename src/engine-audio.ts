import { MathUtils } from 'three'

export const IDLE_RPM = 920
export const REDLINE_RPM = 8600
const shiftStart = 8050
const shiftDuration = .22
// Road speed at redline in each gear, as a fraction of the car's top speed.
const gearSpeeds = [.305, .49, .68, .88, 1.12]

export function makeEngineTransmission() {
  let gear = 0
  let shift = 0
  let rpm = IDLE_RPM
  let load = 0
  return {
    get rpm() { return rpm },
    get load() { return load },
    reset() {
      gear = shift = load = 0
      rpm = IDLE_RPM
    },
    advance(dt: number, forwardSpeed: number, throttle: number, topSpeed: number) {
      const reverse = forwardSpeed < -.1
      const speed = Math.abs(forwardSpeed)
      const power = Math.max(0, reverse ? -throttle : throttle)
      const touringRpm = (index: number) => speed * REDLINE_RPM / (topSpeed * gearSpeeds[index])
      shift = Math.max(0, shift - dt)
      if (reverse) {
        gear = 0
        shift = 0
      } else if (shift === 0) {
        const current = touringRpm(gear)
        if (gear < gearSpeeds.length - 1 && current >= shiftStart) {
          gear++
          shift = shiftDuration
        } else if (gear > 0 && touringRpm(gear - 1) < (power > .5 ? 5250 : 4000)) {
          gear--
          shift = shiftDuration
        }
      }
      const clutchRpm = IDLE_RPM + (power * 1050) * Math.exp(-speed * .24)
      const drivenRpm = reverse ? IDLE_RPM + speed * 405 : touringRpm(gear)
      const target = Math.min(REDLINE_RPM, Math.max(clutchRpm, drivenRpm))
      rpm = MathUtils.damp(rpm, target, shift > 0 ? 23 : 17, dt)
      const torque = 1 - .84 * MathUtils.smoothstep(shift, .03, shiftDuration)
      load = MathUtils.damp(load, power * torque, shift > 0 ? 28 : 15, dt)
    },
  }
}

export function makeV10Voice(context: AudioContext, destination: AudioNode, noise: AudioBuffer) {
  // Harmonics are measured from the two-revolution cycle. Five pulses per
  // bank give the exhaust its lower growl, with ten pulses across both banks.
  function tone(partials: readonly (readonly [number, number, number])[]) {
    const real = new Float32Array(51)
    const imaginary = new Float32Array(51)
    for (const [order, amplitude, phase] of partials) {
      real[order] = amplitude * Math.cos(phase)
      imaginary[order] = amplitude * Math.sin(phase)
    }
    const oscillator = context.createOscillator()
    oscillator.setPeriodicWave(context.createPeriodicWave(real, imaginary))
    oscillator.frequency.value = IDLE_RPM / 120
    oscillator.start()
    return oscillator
  }
  const exhaust = tone([
    [2,.12,.6], [4,.08,1.1], [5,.33,.35], [8,.065,1.6], [10,.66,-.4], [15,.14,-.65],
    [20,.29,1.0], [25,.075,.8], [30,.17,2.2], [40,.09,2.9], [50,.056,-2.1],
  ])
  const intake = tone([
    [8,.10,.29], [10,.29,.14], [15,.19,.52], [20,.58,-.43], [25,.11,.82],
    [30,.54,.22], [40,.24,1.4], [50,.08,2.1],
  ])
  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.Q.value = .64
  const bass = context.createBiquadFilter()
  bass.type = 'peaking'
  bass.frequency.value = 165
  bass.gain.value = 3.5
  bass.Q.value = .72
  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 490
  highpass.Q.value = .57
  const air = context.createBufferSource()
  air.buffer = noise
  air.loop = true
  const airFilter = context.createBiquadFilter()
  airFilter.type = 'bandpass'
  airFilter.Q.value = .85
  const exhaustGain = context.createGain()
  const intakeGain = context.createGain()
  const airGain = context.createGain()
  exhaustGain.gain.value = intakeGain.gain.value = airGain.gain.value = 0
  exhaust.connect(lowpass).connect(bass).connect(exhaustGain).connect(destination)
  intake.connect(highpass).connect(intakeGain).connect(destination)
  air.connect(airFilter).connect(airGain).connect(destination)
  air.start(0, Math.min(1.17, noise.duration * .42))

  return (rpm: number, load: number, active: boolean) => {
    const time = context.currentTime
    const cycle = rpm / 120 * (1 + Math.sin(time * 37) * .007 * (1 - load))
    const rev = MathUtils.smoothstep(rpm, IDLE_RPM, REDLINE_RPM)
    exhaust.frequency.setTargetAtTime(cycle, time, .028)
    intake.frequency.setTargetAtTime(cycle, time, .028)
    lowpass.frequency.setTargetAtTime(390 + rev * 1450 + load * 870, time, .047)
    airFilter.frequency.setTargetAtTime(480 + rev * 1420, time, .057)
    exhaustGain.gain.setTargetAtTime(active ? .071 + rev * .048 + load * .138 : 0, time, .034)
    intakeGain.gain.setTargetAtTime(active ? rev * (.022 + load * .108) : 0, time, .045)
    airGain.gain.setTargetAtTime(active ? load * (.018 + rev * .051) : 0, time, .046)
  }
}
