import './style.css'
import { loadGame } from './game'
import { CAR_START, DROPOFF, PICKUP, RAIL_STOP, districtName, locationName } from './layout'
import { makeMinimap } from './minimap'
import { makeTouchControls } from './touch-controls'

type Phase = 'menu' | 'play' | 'pause'
type Mode = 'shift' | 'free'
type Job = 'pickup' | 'pier' | 'car' | 'rail' | 'complete' | 'free'
type Point = { x: number; z: number }

const jobs = {
  pickup: { name: 'Waterfront Run', step: 'Pick up the parcel', detail: 'Quay Market', point: PICKUP },
  pier: { name: 'Waterfront Run', step: 'Deliver the parcel', detail: 'Harbourfront Pier', point: DROPOFF },
  car: { name: 'Rail Run', step: 'Get in the dispatch car', detail: 'Follow the marker to the car', point: CAR_START },
  rail: { name: 'Rail Run', step: 'Reach the rail district', detail: 'Stop at the Bremner drop point', point: RAIL_STOP },
  complete: { name: 'Shift complete', step: 'Both jobs delivered', detail: 'Explore Toronto or replay from the pause menu.', point: null },
  free: { name: 'Free roam', step: 'Explore Toronto', detail: 'A car and a motorcycle are parked on York Street.', point: null },
} satisfies Record<Job, { name: string; step: string; detail: string; point: Point | null }>

const handledKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyM', 'KeyE', 'KeyF', 'KeyC', 'ShiftLeft', 'ShiftRight', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
const zoomKeys = new Map([['Minus', 1], ['NumpadSubtract', 1], ['Equal', -1], ['NumpadAdd', -1]])
const zoomStep = 1 / 6

function element<T extends HTMLElement>(id: string) {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing game interface element ${id}`)
  return node as T
}

function text(node: HTMLElement, value: string) {
  if (node.textContent !== value) node.textContent = value
}

const menu = element('menu')
const root = element('game')
const hud = element('hud')
const pause = element('pause')
const rotateScreen = element('rotate-screen')
const loading = element('loading')
const startButton = element<HTMLButtonElement>('start')
const freeButton = element<HTMLButtonElement>('free')
const resumeButton = element<HTMLButtonElement>('resume')
const restartButton = element<HTMLButtonElement>('restart')
const muteButton = element<HTMLButtonElement>('mute')
const mapFrame = element<HTMLButtonElement>('map-frame')
const mapLabel = element('map-label')
const jobName = element('job-name')
const jobStep = element('job-step')
const jobDetail = element('job-detail')
const announcement = element('announcement')
const prompt = element('prompt')
const promptKey = element('prompt-key')
const promptText = element('prompt-text')
const toastNode = element('toast')
const controlsHint = element('controls-hint')
const locationNode = element('street-name')
const vehicleReadout = element('vehicle-readout')
const driftLabel = element('drift-label')
const conditionNode = element<HTMLMeterElement>('body-condition')
const conditionValue = element('body-condition-value')
const speedNode = element('speed')
const speedValue = speedNode.querySelector('strong')!
const phone = window.matchMedia('(pointer: coarse)')
const landscape = window.matchMedia('(orientation: landscape)')
const touchStickLabel = element('touch-stick-label')
const touchSprint = element('touch-sprint')
const touchPedals = element('touch-pedals')
const touchBrake = element('touch-brake')
const touchInteract = element<HTMLButtonElement>('touch-interact')
const touchVehicle = element<HTMLButtonElement>('touch-vehicle')

function updateScreen() {
  const portraitLocked = phone.matches && !landscape.matches
  root.classList.toggle('touch-mode', phone.matches)
  rotateScreen.hidden = !portraitLocked
  menu.inert = pause.inert = portraitLocked
  return portraitLocked
}

updateScreen()

async function startApp() {
  const game = await loadGame(element('scene'), phone.matches)
  const drawMap = makeMinimap(element<HTMLCanvasElement>('map'))
  const touch = makeTouchControls(element('touch-controls'), element('touch-stick'))
  const keys = new Set<string>()
  let phase: Phase = 'menu'
  let mode: Mode = 'shift'
  let job: Job = 'pickup'
  let toastUntil = 0
  let hadPointerLock = false
  let dragPointer: { id: number; x: number; y: number; touch: boolean } | null = null
  let expanded = false
  let showingControls: 'walk' | 'car' | 'motorcycle' | null = null
  let muted = false
  let portraitLocked = updateScreen()
  const canPlay = () => phase === 'play' && !portraitLocked

  startButton.disabled = false
  freeButton.disabled = false
  loading.hidden = true

  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
  const currentPoint = () => job === 'car' ? game.state.car : jobs[job].point

  function selectJob(next: Job) {
    job = next
    text(jobName, jobs[job].name)
    text(jobStep, jobs[job].step)
    text(announcement, jobs[job].step)
    game.setWaypoint(currentPoint())
  }

  function toast(message: string) {
    toastUntil = game.state.elapsed + 4.8
    text(toastNode, message)
    toastNode.hidden = false
  }

  function requestMouse() {
    if (phone.matches || !canPlay()) return
    if (document.pointerLockElement === game.canvas || !game.canvas.requestPointerLock) return
    try {
      const result = game.canvas.requestPointerLock()
      Promise.resolve(result).catch(() => {})
    } catch {
      // Arrow keys and pointer dragging are available without pointer lock.
    }
  }

  function clearInputs() {
    keys.clear()
    touch.clear()
    const drag = dragPointer
    dragPointer = null
    if (drag && game.canvas.hasPointerCapture(drag.id)) game.canvas.releasePointerCapture(drag.id)
  }

  function updateAvailability() {
    touch.show(phone.matches && canPlay())
    hud.inert = !canPlay()
    game.sound.setPlaying(canPlay())
  }

  function show(next: Phase) {
    phase = next
    menu.hidden = next !== 'menu'
    hud.hidden = next === 'menu'
    pause.hidden = next !== 'pause'
    clearInputs()
    updateAvailability()
    if (next !== 'play' && document.pointerLockElement === game.canvas) document.exitPointerLock()
    if (next === 'pause') resumeButton.focus()
  }

  function start(nextMode: Mode) {
    if (portraitLocked) return
    mode = nextMode
    setMap(false)
    toastNode.hidden = true
    toastUntil = 0
    game.reset()
    game.setMenu(false)
    selectJob(nextMode === 'shift' ? 'pickup' : 'free')
    text(restartButton, nextMode === 'shift' ? 'Restart shift' : 'Reset free roam')
    show('play')
    renderHud()
    requestMouse()
  }

  function backToMenu() {
    show('menu')
    game.reset()
    game.setMenu(true)
    startButton.focus()
  }

  function resume() {
    if (portraitLocked) return
    show('play')
    requestMouse()
  }

  function interact() {
    const { actor, driving, riderFall, speed } = game.state
    if (riderFall) return
    if (job === 'pickup' && !driving && distance(actor, PICKUP) <= 3.3) {
      selectJob('pier')
      toast('Parcel picked up')
    } else if (job === 'pier' && !driving && distance(actor, DROPOFF) <= 3.4) {
      selectJob('car')
      toast('Waterfront Run complete')
    } else if (job === 'rail' && distance(actor, RAIL_STOP) <= 5.1 && Math.abs(speed) <= 3.4) {
      selectJob('complete')
      toast('Rail Run complete')
    } else {
      game.greetPedestrian()
    }
  }

  function toggleCar() {
    const result = game.enterOrExit()
    if (result === 'moving') toast('Brake before exiting')
    if (result === 'wait') toast('Wait for the vehicle to stop')
    if (result === 'blocked') toast(game.state.driving ? 'Pull away from the obstacle to exit' : 'There’s no room to step off')
    if (result === 'entered' && job === 'car' && game.state.drivingDispatch) {
      selectJob('rail')
      toast('Rail Run started')
    }
  }

  function setMap(value: boolean) {
    expanded = value
    mapFrame.classList.toggle('expanded', expanded)
    mapFrame.setAttribute('aria-expanded', String(expanded))
    mapFrame.setAttribute('aria-label', expanded ? 'Collapse map' : 'Expand map')
  }

  function renderHud() {
    const { actor, heading, car, motorcycle, driving, drivingDispatch, ridingMotorcycle, ridingStarterBike, riderFall,
      speed, condition, drifting, elapsed, pedestrian, entry, entryMotorcycle, takeover, takeoverMotorcycle } = game.state
    const point = currentPoint()
    const description = jobs[job].detail
    text(jobDetail, point ? `${description} · ${Math.ceil(distance(actor, point))} m` : description)
    if (job === 'car') game.setWaypoint(car)
    text(locationNode, locationName(actor.x, actor.z))
    vehicleReadout.hidden = !driving
    if (driving) {
      text(speedValue, Math.round(speed * 3.6).toString())
      const percent = Math.round(condition * 100)
      if (conditionNode.value !== percent) conditionNode.value = percent
      text(conditionValue, `${percent}%`)
      driftLabel.hidden = !drifting
    }
    toastNode.hidden = elapsed >= toastUntil
    const controls = ridingMotorcycle ? 'motorcycle' : driving ? 'car' : 'walk'
    if (showingControls !== controls) {
      touch.clear()
      showingControls = controls
      controlsHint.innerHTML = driving
        ? `<div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>${ridingMotorcycle ? 'Ride' : 'Drive'}</span></div><div><kbd>Space</kbd><span>${ridingMotorcycle ? 'Brake' : 'Handbrake'}</span></div><div><kbd>F</kbd><span>${ridingMotorcycle ? 'Dismount' : 'Exit'}</span></div>`
        : '<div><kbd>Shift</kbd><span>Sprint</span></div><div><kbd>E</kbd><span>Interact</span></div><div><kbd>F</kbd><span>Vehicle</span></div>'
      controlsHint.insertAdjacentHTML('beforeend', '<div><kbd>−</kbd><kbd>+</kbd><span>Zoom</span></div><div><kbd>Esc</kbd><span>Pause</span></div>')
      touchSprint.hidden = driving
      touchPedals.hidden = !driving
      text(touchStickLabel, driving ? 'Steer' : 'Move')
      touchBrake.setAttribute('aria-label', ridingMotorcycle ? 'Brake' : 'Handbrake')
    }

    let key = ''
    let label = ''
    if (riderFall) {
      label = riderFall === 'rising' ? 'Getting up…' : 'Knocked off the motorcycle'
    } else if (job === 'pickup' && !driving && distance(actor, PICKUP) <= 3.3) {
      key = 'E'
      label = 'Pick up parcel'
    } else if (job === 'pier' && !driving && distance(actor, DROPOFF) <= 3.4) {
      key = 'E'
      label = 'Drop off parcel'
    } else if (job === 'rail' && distance(actor, RAIL_STOP) <= 5.1) {
      key = Math.abs(speed) <= 3.4 ? 'E' : 'Space'
      label = Math.abs(speed) <= 3.4 ? 'Check in' : 'Stop at the marker'
    } else if (takeover) {
      label = takeoverMotorcycle ? 'Rider stepping off…' : 'Driver getting out…'
    } else if (entry && entry !== 'moving') {
      key = 'F'
      label = entryMotorcycle ? (entry === 'take' ? 'Take motorcycle' : 'Mount motorcycle')
        : entry === 'take' ? 'Take car' : entry === 'dispatch' ? 'Enter dispatch car' : 'Enter car'
    } else if (pedestrian) {
      key = 'E'
      label = `Greet ${pedestrian}`
    } else if (entry === 'moving') {
      label = entryMotorcycle ? 'Wait for the motorcycle to stop' : 'Wait for the car to stop'
    }
    prompt.hidden = !label
    promptKey.hidden = phone.matches || !key
    text(promptKey, key)
    text(promptText, label)
    if (phone.matches) {
      touchInteract.disabled = key !== 'E'
      touchInteract.classList.toggle('prompted', key === 'E')
      touchVehicle.disabled = !driving && (!entry || entry === 'moving')
      touchVehicle.classList.toggle('prompted', key === 'F')
      text(touchVehicle, driving ? (ridingMotorcycle ? 'Dismount' : 'Exit') : entryMotorcycle ? 'Mount' : 'Enter')
    }
    text(mapLabel, expanded ? 'TORONTO' : districtName(actor.x, actor.z).toUpperCase())
    drawMap(actor, heading, drivingDispatch ? null : car, ridingStarterBike ? null : motorcycle, point, elapsed, expanded)
  }

  startButton.addEventListener('click', () => start('shift'))
  freeButton.addEventListener('click', () => start('free'))
  resumeButton.addEventListener('click', resume)
  restartButton.addEventListener('click', () => start(mode))
  muteButton.addEventListener('click', () => {
    muted = !muted
    game.sound.mute(muted)
    muteButton.setAttribute('aria-pressed', String(muted))
    text(muteButton, muted ? 'Unmute sound' : 'Mute sound')
  })
  document.addEventListener('visibilitychange', game.sound.refresh)
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInputs() })
  element('back').addEventListener('click', backToMenu)
  element('pause-button').addEventListener('click', () => { if (canPlay()) show('pause') })
  mapFrame.addEventListener('click', event => {
    if (canPlay()) setMap(!expanded)
    if (event.detail > 0) mapFrame.blur()
  })
  touchInteract.addEventListener('click', () => { if (canPlay()) interact() })
  touchVehicle.addEventListener('click', () => { if (canPlay()) toggleCar() })
  element('touch-zoom-out').addEventListener('click', () => { if (canPlay()) game.zoomCamera(zoomStep) })
  element('touch-zoom-in').addEventListener('click', () => { if (canPlay()) game.zoomCamera(-zoomStep) })
  element('touch-center').addEventListener('click', () => { if (canPlay()) game.centerCamera() })

  function viewportChanged() {
    portraitLocked = updateScreen()
    clearInputs()
    updateAvailability()
    if (phone.matches && document.pointerLockElement === game.canvas) {
      hadPointerLock = false
      document.exitPointerLock()
    }
  }
  phone.addEventListener('change', viewportChanged)
  landscape.addEventListener('change', viewportChanged)
  updateAvailability()

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === game.canvas
    if (hadPointerLock && !locked && phase === 'play') show('pause')
    hadPointerLock = locked
  })
  game.canvas.addEventListener('pointerdown', (event) => {
    if (!canPlay() || document.pointerLockElement === game.canvas || dragPointer || event.button !== 0) return
    game.canvas.setPointerCapture(event.pointerId)
    dragPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch' }
  })
  function endDrag(event: PointerEvent) {
    if (dragPointer?.id === event.pointerId) dragPointer = null
  }
  game.canvas.addEventListener('lostpointercapture', endDrag)
  game.canvas.addEventListener('pointerup', endDrag)
  game.canvas.addEventListener('pointercancel', endDrag)
  document.addEventListener('pointermove', (event) => {
    if (!canPlay()) return
    if (document.pointerLockElement === game.canvas) game.mouseLook(event.movementX, event.movementY)
    else if (dragPointer?.id === event.pointerId) {
      const gain = dragPointer.touch ? 1.7 : 1
      game.mouseLook((event.clientX - dragPointer.x) * gain, (event.clientY - dragPointer.y) * gain)
      dragPointer.x = event.clientX
      dragPointer.y = event.clientY
    }
  })
  window.addEventListener('wheel', (event) => {
    if (!canPlay() || event.ctrlKey || event.metaKey) return
    const pixels = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
    if (!event.deltaY) return
    event.preventDefault()
    const amount = pixels ? Math.max(-1, Math.min(1, event.deltaY / 100)) : Math.sign(event.deltaY)
    game.zoomCamera(amount * zoomStep)
  }, { passive: false })

  window.addEventListener('keydown', (event) => {
    if (portraitLocked || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.code === 'Escape' && !event.repeat) {
      if (phase === 'play') show('pause')
      else if (phase === 'pause') resume()
      return
    }
    if (phase === 'menu' && event.code === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      if (!event.repeat) start('shift')
      return
    }
    const zoomDirection = zoomKeys.get(event.code)
    if (phase === 'play' && zoomDirection !== undefined) {
      event.preventDefault()
      game.zoomCamera(zoomDirection * zoomStep)
      return
    }
    if (phase !== 'play' || !handledKeys.has(event.code) || (event.code === 'Space' && event.target instanceof HTMLButtonElement)) return
    event.preventDefault()
    keys.add(event.code)
    if (event.repeat) return
    if (event.code === 'KeyE') interact()
    if (event.code === 'KeyF') toggleCar()
    if (event.code === 'KeyC') game.centerCamera()
    if (event.code === 'KeyM') setMap(!expanded)
  })
  window.addEventListener('keyup', (event) => { keys.delete(event.code) })
  window.addEventListener('blur', clearInputs)

  let lastTime = performance.now()
  function frame(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.08)
    lastTime = now
    if (phase !== 'pause' && !portraitLocked) game.frame(dt, keys, touch.input)
    if (canPlay()) renderHud()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

startApp().catch((error: unknown) => {
  console.error(error)
  text(loading, 'The 3D scene could not start. GTA 6ix needs a browser with WebGL 2 and hardware acceleration.')
})
