export type TouchInput = {
  forward: number
  strafe: number
  throttle: number
  brake: boolean
  sprint: boolean
}

export const noTouch: Readonly<TouchInput> = { forward: 0, strafe: 0, throttle: 0, brake: false, sprint: false }

function stickAxis(x: number, y: number) {
  const distance = Math.hypot(x, y)
  const deadZone = .14
  const magnitude = Math.max(0, (Math.min(distance, 1) - deadZone) / (1 - deadZone))
  const scale = distance === 0 ? 0 : magnitude / distance
  return { x: x * scale, y: y * scale }
}

export function makeTouchControls(root: HTMLElement, stick: HTMLElement) {
  const input = { ...noTouch }
  const pads = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-hold]'))
  const held = new Map<number, HTMLButtonElement>()
  let stickPointer: number | null = null
  let enabled = false

  function updatePedals() {
    const pressed = new Set(held.values())
    for (const pad of pads) pad.classList.toggle('held', pressed.has(pad))
    const actions = new Set(Array.from(pressed, pad => pad.dataset.hold))
    input.throttle = Number(actions.has('gas')) - Number(actions.has('reverse'))
    input.brake = actions.has('brake')
    input.sprint = actions.has('sprint')
  }

  function moveStick(x: number, y: number, throwRadius: number) {
    const direction = stickAxis(x / throwRadius, y / throwRadius)
    input.strafe = direction.x
    input.forward = -direction.y
    stick.style.setProperty('--thumb-x', `${direction.x * throwRadius}px`)
    stick.style.setProperty('--thumb-y', `${direction.y * throwRadius}px`)
  }

  function updateStick(event: PointerEvent) {
    const rect = stick.getBoundingClientRect()
    moveStick(event.clientX - (rect.left + rect.width * .5), event.clientY - (rect.top + rect.height * .5), rect.width * .32)
  }

  function release(pointerId: number) {
    if (stickPointer === pointerId) {
      stickPointer = null
      stick.classList.remove('held')
      moveStick(0, 0, 1)
      if (stick.hasPointerCapture(pointerId)) stick.releasePointerCapture(pointerId)
    }
    const button = held.get(pointerId)
    if (button) {
      held.delete(pointerId)
      updatePedals()
      if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId)
    }
  }

  function clear() {
    if (stickPointer !== null) release(stickPointer)
    for (const pointerId of held.keys()) release(pointerId)
  }

  root.addEventListener('contextmenu', event => event.preventDefault())
  stick.addEventListener('pointerdown', event => {
    if (!enabled || stickPointer !== null || event.button !== 0) return
    event.preventDefault()
    stick.setPointerCapture(event.pointerId)
    stickPointer = event.pointerId
    stick.classList.add('held')
    updateStick(event)
  })
  stick.addEventListener('pointermove', event => {
    if (event.pointerId === stickPointer) updateStick(event)
  })

  for (const pad of pads) {
    pad.addEventListener('pointerdown', event => {
      if (!enabled || pad.disabled || event.button !== 0 || held.has(event.pointerId)) return
      event.preventDefault()
      pad.setPointerCapture(event.pointerId)
      held.set(event.pointerId, pad)
      updatePedals()
    })
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    root.addEventListener(name, event => release(event.pointerId))
  }

  return {
    input,
    clear,
    show(value: boolean) {
      if (enabled === value) return
      enabled = value
      if (!enabled) clear()
      root.hidden = !enabled
    },
  }
}
