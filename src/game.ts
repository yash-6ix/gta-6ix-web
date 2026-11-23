import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { makeStreetcar, makeWaypoint } from './actors'
import { makeCar } from './vehicles'
import { makeRendering } from './rendering'
import { makeHeadlights } from './street-lighting'
import { makeDrivetrain } from './driving'
import { makeVehicleEffects } from './vehicle-effects'
import { makeCity } from './city'
import { box, matte } from './graphics'
import { BOARDWALK, BOUNDS, CAR_START, DROPOFF, EAST_WEST, NORTH_SOUTH, RAIL_STOP, SPAWN } from './layout'
import { loadCityMaterials } from './materials'
import { makePedestrians } from './pedestrians'
import { loadPeopleModels } from './people-models'
import { makeTraffic, type RoadVehicle } from './traffic'
import { makeGoService } from './go-rail'
import { makeGameAudio } from './game-audio'
import { makeEngineTransmission } from './engine-audio'
import { makeVehicleReactions } from './vehicle-reactions'
import { EJECTION_SPEED, startRiderFall } from './rider-fall'
import { noTouch, type TouchInput } from './touch-controls'

interface Point { x: number; z: number }
type TrafficCar = ReturnType<typeof makeTraffic>['vehicles'][number]
type EntryChoice = { kind: 'dispatch'; vehicle: RoadVehicle } | { kind: 'moving' | 'take' | 'vacant'; vehicle: TrafficCar }
type RiderImpact = { closing: number; normal: THREE.Vector3; velocity: THREE.Vector3 }
type RiderFall = NonNullable<ReturnType<typeof startRiderFall>>

const STEP = 1 / 60
const PLAYER_HEIGHT = 0.87
const CAR_HEIGHT = 0.7
const CAR_HALF_HEIGHT = 0.49
const STEERING_CLEARANCE = 0.025
const DRIVER_EXIT_TIME = 0.72
const TAKEOVER_TIME = 0.94
const ENTRY_RANGE = 3.85
const TAKEOVER_SPEED = 1.65
const pitchLimits = [-1.43, 1.04] as const
const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b))
const heading = (yaw: number) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) })
const quaternion = (yaw: number) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
const controlAxis = (value: number) => THREE.MathUtils.clamp(value, -1, 1)
const throttleInput = (keys: ReadonlySet<string>, touch: Readonly<TouchInput>) =>
  controlAxis(Number(keys.has('KeyW')) - Number(keys.has('KeyS')) + touch.throttle)

export async function loadGame(container: HTMLElement, compactRendering = false) {
  const renderer = new THREE.WebGLRenderer({ antialias: !compactRendering, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compactRendering ? 1 : 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.06
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.setAttribute('aria-label', 'Third-person view of Harbourfront')
  container.append(renderer.domElement)
  const [materials, characterModels] = await Promise.all([loadCityMaterials(renderer), loadPeopleModels(renderer), RAPIER.init()])

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(56, 1, 0.09, 815)
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = STEP
  const { water, reflection, fixtures, updateLighting } = makeCity(scene, world, materials, compactRendering ? 1536 : undefined)
  const updateGoTrains = makeGoService(scene)
  const sound = makeGameAudio()
  const render = makeRendering(renderer, scene, camera, compactRendering)
  const aimHeadlights = makeHeadlights(scene)
  reflection.visible = render.effectsAvailable
  const player = characterModels.courier()
  const dispatchModel = makeCar()
  const tram = makeStreetcar()
  scene.add(player.group, dispatchModel.group, tram)
  const people = makePedestrians(scene, world, characterModels.resident)
  const traffic = makeTraffic(scene, world)
  for (const model of [dispatchModel.group, tram, ...traffic.vehicles.map((vehicle) => vehicle.model.group)]) {
    model.traverse((object) => object.layers.enable(1))
  }
  const effects = makeVehicleEffects(scene)
  const drivetrain = makeDrivetrain()
  const transmission = makeEngineTransmission()
  const reactions = makeVehicleReactions()
  const waypoint = makeWaypoint(scene)
  waypoint.group.visible = false

  for (const [x, y, z, width, height, depth] of [
    [DROPOFF.x + 2.6, 0.5, DROPOFF.z + 1.44, 1.07, 0.74, 0.84],
    [DROPOFF.x + 3.42, 0.45, DROPOFF.z + 0.61, 0.59, 0.66, 0.77],
    [DROPOFF.x + 2.68, 1.02, DROPOFF.z + 1.42, 0.71, 0.35, 0.54],
  ]) {
    box(scene, matte('#a77f54'), x, y, z, width, height, depth)
    for (const side of [-1, 1]) box(scene, matte('#644b3b'), x + side * width * 0.34, y, z, 0.055, height + 0.018, depth + 0.013)
  }
  box(scene, matte('#474d46'), RAIL_STOP.x + 4, 1.56, -58.5, 0.09, 2.86, 0.09)
  box(scene, matte('#c8a476'), RAIL_STOP.x + 4, 2.78, -58.49, 0.87, 0.44, 0.11)

  const playerBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
  const playerShape = new RAPIER.Capsule(0.54, 0.32)
  const playerCollider = world.createCollider(RAPIER.ColliderDesc.capsule(0.54, 0.32), playerBody)
  const walker = world.createCharacterController(0.025)
  walker.enableAutostep(0.27, 0.26, false)
  walker.enableSnapToGround(0.26)

  const carBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
  const { halfWidth, halfLength } = dispatchModel.dimensions
  const carCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(halfWidth, CAR_HALF_HEIGHT, halfLength), carBody)
  const carController = world.createCharacterController(0.048)
  const steeringShape = new RAPIER.Cuboid(halfWidth + STEERING_CLEARANCE, CAR_HALF_HEIGHT, halfLength + STEERING_CLEARANCE)
  const dispatch: RoadVehicle = { model: dispatchModel, body: carBody, collider: carCollider, yaw: CAR_START.yaw }

  const tramLimit = BOUNDS.east + 19
  const tramYaw = -Math.PI / 2
  const tramBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
  const tramCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(1.32, 1.39, 6.41), tramBody)
  tram.rotation.y = tramYaw
  tramBody.setRotation(quaternion(tramYaw), true)

  const cameraTarget = new THREE.Vector3()
  const aim = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const targetPosition = new THREE.Vector3()
  const movement = new THREE.Vector3()
  const previousCarPosition = new THREE.Vector3()
  const currentCarPosition = new THREE.Vector3()
  const cameraRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
  let accumulator = 0
  let elapsed = 0
  let fallingSpeed = 0
  let activeCar: RoadVehicle | null = null
  let playerFall: RiderFall | null = null
  const trafficFalls = new Map<TrafficCar, RiderFall>()
  let previousCarYaw = 0
  let takeover: { car: TrafficCar; side: number; remaining: number } | null = null
  const recentImpacts = new Map<number, number>()
  let shake = 0
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const worldUp = new THREE.Vector3(0, 1, 0)
  let playerYaw: number = SPAWN.yaw
  let lookYaw: number = SPAWN.yaw
  let pitch = 0.28
  let cameraArm = 5.5
  let zoomTarget = 0
  let zoom = 0
  let tramX = -21
  let lookIdle = 0
  let onMenu = true

  function resize() {
    const { clientWidth: width, clientHeight: height } = container
    if (!width || !height) return
    render.resize(width, height)
    effects.resize(height * renderer.getPixelRatio())
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    render.render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)

  function placePlayer(x: number, y: number, z: number) {
    const position = { x, y: y + PLAYER_HEIGHT, z }
    playerBody.setTranslation(position, true)
    playerBody.setNextKinematicTranslation(position)
    player.group.position.set(x, y, z)
    fallingSpeed = 0
    movement.set(0, 0, 0)
  }

  function reset() {
    accumulator = elapsed = shake = 0
    recentImpacts.clear()
    drivetrain.reset()
    transmission.reset()
    effects.reset()
    reactions.reset()
    playerFall?.remove()
    playerFall = null
    for (const fall of trafficFalls.values()) fall.remove()
    trafficFalls.clear()
    fixtures.reset()
    playerYaw = lookYaw = SPAWN.yaw
    dispatch.yaw = CAR_START.yaw
    dispatch.model.setBraking(false)
    dispatch.model.repair()
    player.group.rotation.set(0, playerYaw, 0)
    cameraArm = 5.5
    pitch = 0.28
    lookIdle = 0
    activeCar = takeover = null
    dispatch.model.group.rotation.y = dispatch.yaw
    dispatch.model.group.position.set(CAR_START.x, 0.02, CAR_START.z)
    const carPosition = { x: CAR_START.x, y: CAR_HEIGHT, z: CAR_START.z }
    carBody.setTranslation(carPosition, true)
    carBody.setNextKinematicTranslation(carPosition)
    carBody.setRotation(quaternion(dispatch.yaw), true)
    carBody.setNextKinematicRotation(quaternion(dispatch.yaw))
    player.group.visible = true
    playerCollider.setEnabled(true)
    placePlayer(SPAWN.x, 0.17, SPAWN.z)
    tramX = -21
    const tramPosition = { x: tramX, y: 1.61, z: 40.04 }
    tramBody.setTranslation(tramPosition, true)
    tramBody.setNextKinematicTranslation(tramPosition)
    tram.position.set(tramX, 0, 40.04)
    targetPosition.copy(player.group.position).y += 1.32
    people.reset()
    traffic.reset()
    world.step()
  }

  function setMenu(show: boolean) {
    onMenu = show
    if (show) {
      waypoint.group.visible = false
      menuCamera()
    } else {
      followCamera(STEP, true)
    }
    render.render()
  }

  function mouseLook(dx: number, dy: number) {
    lookYaw -= dx * 0.0032
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.00265, ...pitchLimits)
    lookIdle = 0
  }

  function nearbyCar(): EntryChoice | null {
    if (activeCar || takeover || playerFall) return null
    const playerPosition = player.group.position
    const dispatchDistance = playerPosition.distanceTo(dispatch.model.group.position)
    let choice: EntryChoice | null = dispatchDistance <= 3.75 && reactions.speedOf(dispatch) <= TAKEOVER_SPEED ? { kind: 'dispatch', vehicle: dispatch } : null
    let closest = choice ? dispatchDistance : ENTRY_RANGE
    for (const vehicle of traffic.vehicles) {
      const gap = playerPosition.distanceTo(vehicle.model.group.position)
      if (gap >= closest) continue
      choice = { kind: vehicle.speed > TAKEOVER_SPEED ? 'moving' : vehicle.taken ? 'vacant' : 'take', vehicle }
      closest = gap
    }
    return choice
  }

  function findExit(vehicle: RoadVehicle, driver = false) {
    const p = vehicle.model.group.position
    const right = { x: Math.cos(vehicle.yaw), z: -Math.sin(vehicle.yaw) }
    const forward = heading(vehicle.yaw)
    const sideDistance = vehicle.model.dimensions.halfWidth + 1
    const door = vehicle.model.doorOffset
    const positions = [-1, 1].map(side => ({
      dx: right.x * sideDistance * side - forward.x * door,
      dz: right.z * sideDistance * side - forward.z * door,
      side,
    }))
    const rear = vehicle.model.dimensions.halfLength + 1.04
    if (!driver) positions.push({ dx: -forward.x * rear, dz: -forward.z * rear, side: 0 })
    for (const { dx, dz, side } of positions) {
      const x = p.x + dx
      const z = p.z + dz
      if (x <= BOUNDS.west + 0.5 || x >= BOUNDS.east - 0.5 || z < BOUNDS.north + 0.5 || z > BOUNDS.shore - 0.5) continue
      const ray = new RAPIER.Ray({ x, y: 1.5, z }, { x: 0, y: -1, z: 0 })
      const ground = world.castRay(ray, 1.8, true, undefined, undefined, vehicle.collider)
      if (!ground || ground.timeOfImpact < 1.14) continue
      const y = 1.5 - ground.timeOfImpact + 0.035
      const overlap = world.intersectionWithShape(
        { x, y: y + PLAYER_HEIGHT, z }, quaternion(0), playerShape, undefined, undefined, driver ? undefined : playerCollider,
      )
      if (!overlap) return { point: new THREE.Vector3(x, y, z), side }
    }
    return null
  }

  function sitIn(vehicle: RoadVehicle) {
    reactions.stop(vehicle)
    activeCar = vehicle
    previousCarPosition.copy(vehicle.model.group.position)
    previousCarYaw = vehicle.yaw
    steeringShape.halfExtents.x = vehicle.model.dimensions.halfWidth + STEERING_CLEARANCE
    steeringShape.halfExtents.z = vehicle.model.dimensions.halfLength + STEERING_CLEARANCE
    if (vehicle.model.kind === 'motorcycle') vehicle.model.setRider('player')
    else sound.door()
    player.group.visible = false
    playerCollider.setEnabled(false)
    drivetrain.reset()
    transmission.reset()
    effects.breakTrail()
    recentImpacts.clear()
    lookYaw = vehicle.yaw
    pitch = 0.265
    lookIdle = 1.8
  }

  function letDriverOut(car: TrafficCar) {
    const exit = findExit(car, true)
    if (!exit) return false
    const origin = car.model.group.position.clone().lerp(exit.point, 0.31)
    origin.y = car.model.kind === 'motorcycle' ? .52 : .32
    const direction = new THREE.Vector3().subVectors(exit.point, origin)
    const curb = exit.point.clone()
    if (Math.abs(direction.x) >= Math.abs(direction.z)) {
      const street = NORTH_SOUTH.reduce((nearest, next) =>
        Math.abs(next.x - curb.x) < Math.abs(nearest.x - curb.x) ? next : nearest,
      )
      curb.x = street.x + Math.sign(direction.x) * (street.width / 2 + 1.7)
    } else {
      const street = EAST_WEST.reduce((nearest, next) =>
        Math.abs(next.z - curb.z) < Math.abs(nearest.z - curb.z) ? next : nearest,
      )
      curb.z = street.z + Math.sign(direction.z) * (street.width / 2 + 1.7)
    }
    const along = heading(car.yaw)
    const walkX = THREE.MathUtils.clamp(curb.x + along.x * 6, BOUNDS.west + 1, BOUNDS.east - 1)
    const walkZ = THREE.MathUtils.clamp(curb.z + along.z * 6, BOUNDS.north + 1, BOUNDS.shore - 1)
    reactions.stop(car)
    traffic.take(car)
    people.releaseDriver(car.id, origin, exit.point, [[exit.point.x, exit.point.z], [curb.x, curb.z], [walkX, walkZ]], DRIVER_EXIT_TIME)
    takeover = { car, side: exit.side, remaining: TAKEOVER_TIME }
    return true
  }

  function enterOrExit() {
    if (playerFall) return 'recovering'
    if (takeover) return 'pending'
    if (!activeCar) {
      const entry = nearbyCar()
      if (!entry) return 'far'
      if (entry.kind === 'moving') return 'wait'
      if (entry.kind === 'take') return letDriverOut(entry.vehicle) ? 'pending' : 'blocked'
      sitIn(entry.vehicle)
      return 'entered'
    }

    if (drivetrain.speed > 3.4) return 'moving'
    const exit = findExit(activeCar)
    if (!exit) return 'blocked'
    drivetrain.reset()
    effects.breakTrail()
    playerYaw = activeCar.yaw
    player.group.rotation.y = playerYaw
    player.group.visible = true
    playerCollider.setEnabled(true)
    activeCar.model.setBraking(false)
    if (activeCar.model.kind === 'motorcycle') activeCar.model.setRider(null)
    else {
      activeCar.model.setReversing(false)
      sound.door()
    }
    activeCar = null
    placePlayer(exit.point.x, exit.point.y, exit.point.z)
    world.propagateModifiedBodyPositionsToColliders()
    return 'exited'
  }

  function movePlayer(keys: ReadonlySet<string>, touch: Readonly<TouchInput>) {
    const forward = controlAxis(Number(keys.has('KeyW')) - Number(keys.has('KeyS')) + touch.forward)
    const strafe = controlAxis(Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + touch.strafe)
    const basis = heading(lookYaw)
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.sprint
    const targetSpeed = sprint ? 6.85 : 2.55
    const magnitude = Math.max(Math.hypot(forward, strafe), 1)
    const desiredX = (basis.x * forward - basis.z * strafe) * targetSpeed / magnitude
    const desiredZ = (basis.z * forward + basis.x * strafe) * targetSpeed / magnitude
    movement.x = THREE.MathUtils.damp(movement.x, desiredX, 14, STEP)
    movement.z = THREE.MathUtils.damp(movement.z, desiredZ, 14, STEP)
    fallingSpeed = Math.max(-16, fallingSpeed - 23 * STEP)
    walker.computeColliderMovement(playerCollider, { x: movement.x * STEP, y: fallingSpeed * STEP, z: movement.z * STEP })
    const delta = walker.computedMovement()
    if (Math.hypot(movement.x, movement.z) > 0.5) {
      for (let i = 0; i < walker.numComputedCollisions(); i++) {
        const collider = walker.computedCollision(i)?.collider
        if (collider) people.contact(collider.handle)
      }
    }
    const current = playerBody.translation()
    playerBody.setNextKinematicTranslation({ x: current.x + delta.x, y: current.y + delta.y, z: current.z + delta.z })
    if (walker.computedGrounded()) fallingSpeed = -0.6
    const velocity = Math.hypot(delta.x, delta.z) / STEP
    if (velocity > 0.1) {
      playerYaw += angleDifference(Math.atan2(-movement.x, -movement.z), playerYaw) * (1 - Math.exp(-STEP * 16))
    }
    player.group.rotation.y = playerYaw
    player.animate(STEP, velocity, sprint)
  }

  function damageCar(vehicle: RoadVehicle, point: THREE.Vector3, normal: THREE.Vector3, amount: number) {
    const local = point.clone().sub(vehicle.model.group.position).applyAxisAngle(worldUp, -vehicle.yaw)
    const inward = normal.clone().applyAxisAngle(worldUp, -vehicle.yaw)
    vehicle.model.damage(local, inward, amount)
  }

  function processImpact(vehicle: RoadVehicle, velocityX: number, velocityZ: number) {
    let impact: { contact: RAPIER.CharacterCollision; handle: number; closing: number; normal: THREE.Vector3; car?: RoadVehicle } | undefined
    let riderImpact: RiderImpact | undefined
    const cleared = new Set<number>()
    for (let i = 0; i < carController.numComputedCollisions(); i++) {
      const contact = carController.computedCollision(i)
      const other = contact?.collider
      if (!contact || !other || Math.abs(contact.normal1.y) > 0.66) continue
      const { handle } = other
      if (cleared.has(handle)) continue
      const normal = new THREE.Vector3(contact.normal1.x, 0, contact.normal1.z).normalize()
      const obstacleVelocity = other.parent()?.linvel()
      const closing = ((obstacleVelocity?.x ?? 0) - velocityX) * normal.x + ((obstacleVelocity?.z ?? 0) - velocityZ) * normal.z
      const away = normal.clone().negate()
      if (vehicle.model.kind === 'motorcycle' && closing >= EJECTION_SPEED && closing > (riderImpact?.closing ?? 0)) {
        riderImpact = { closing, normal, velocity: new THREE.Vector3(velocityX, 0, velocityZ) }
      }
      if (people.knockDown(handle, away, closing)) {
        cleared.add(handle)
        drivetrain.velocity.multiplyScalar(.92)
        shake = Math.max(shake, .10)
        continue
      }
      if (fixtures.strike(handle, away, closing)) {
        cleared.add(handle)
        const force = THREE.MathUtils.clamp(closing / 22, .12, .83)
        effects.impact(new THREE.Vector3().copy(contact.witness1), away, force * .43)
        sound.fixture(force)
        drivetrain.velocity.multiplyScalar(.86)
        shake = Math.max(shake, force * .19)
        continue
      }
      const car = handle === dispatch.collider.handle ? dispatch : traffic.vehicleAt(handle)
      if (closing <= (car ? 2.35 : 4.35) || closing <= (impact?.closing ?? 0)) continue
      if (elapsed - (recentImpacts.get(handle) ?? -Infinity) < .28) continue
      impact = { contact, handle, closing, normal, car }
    }
    if (impact) {
      const { contact, handle, normal, car, closing } = impact
      recentImpacts.set(handle, elapsed)
      const severity = THREE.MathUtils.clamp((closing - 3.1) / 18.4, .055, 1)
      const hitAt = new THREE.Vector3().copy(contact.witness2)
      damageCar(vehicle, hitAt, normal, severity)
      if (car && car !== vehicle) {
        const point = new THREE.Vector3().copy(contact.witness1)
        const direction = normal.clone().negate()
        const trafficCar = traffic.vehicleAt(handle)
        if (trafficCar) {
          if (!trafficCar.taken && closing >= EJECTION_SPEED && trafficCar.model.kind === 'motorcycle') {
            const fall = startRiderFall(scene, world, trafficCar, new THREE.Vector3(velocityX, 0, velocityZ), direction, closing)
            if (fall) {
              traffic.take(trafficCar)
              trafficFalls.set(trafficCar, fall)
            }
          }
          traffic.holdAfterImpact(trafficCar)
        }
        reactions.push(car, point, direction, closing, vehicle.model.handling.mass)
        damageCar(car, point, direction, severity * .79)
      }
      effects.impact(hitAt, normal, severity)
      sound.impact(severity)
      shake = Math.max(shake, severity * .43)
    }
    return { cleared, riderImpact }
  }

  function moveCar(keys: ReadonlySet<string>, vehicle: RoadVehicle, touch: Readonly<TouchInput>) {
    const throttle = throttleInput(keys, touch)
    const turn = controlAxis(Number(keys.has('KeyA')) - Number(keys.has('KeyD')) - touch.strafe)
    const handbrake = keys.has('Space') || touch.brake
    const previousYaw = vehicle.yaw
    const { model } = vehicle
    previousCarPosition.copy(model.group.position)
    previousCarYaw = previousYaw
    model.setBraking(handbrake || drivetrain.forwardSpeed * throttle < -.05)
    const rearAxle = model.rearWheelOffset.z
    const intendedYaw = drivetrain.advance(STEP, previousYaw, { throttle, turn, handbrake }, model.condition, model.handling, model.wheelbase)
    const intended = drivetrain.plan(STEP, previousYaw, intendedYaw, rearAxle)
    carController.computeColliderMovement(vehicle.collider, intended)
    const { cleared, riderImpact } = processImpact(vehicle, intended.x / STEP, intended.z / STEP)
    const filter = cleared.size ? (collider: RAPIER.Collider) => !cleared.has(collider.handle) : undefined
    if (filter) carController.computeColliderMovement(vehicle.collider, drivetrain.plan(STEP, previousYaw, intendedYaw, rearAxle), undefined, undefined, filter)
    const origin = vehicle.body.translation()
    const advanceAt = (yaw: number) => {
      carController.computeColliderMovement(vehicle.collider,
        drivetrain.plan(STEP, previousYaw, yaw, rearAxle, intendedYaw), undefined, undefined, filter)
      return carController.computedMovement()
    }
    const overlaps = (yaw: number, delta: RAPIER.Vector) => world.intersectionWithShape(
      { x: origin.x + delta.x, y: CAR_HEIGHT, z: origin.z + delta.z }, quaternion(yaw), steeringShape,
      undefined, undefined, vehicle.collider, undefined, filter,
    )

    let nextYaw = intendedYaw
    let delta = carController.computedMovement()
    const intendedTravel = intended.lengthSq()
    if (nextYaw !== previousYaw && intendedTravel > 1e-8) {
      // A blocked axle cannot complete the full turn. Keep as much of the
      // turn as fits beside the obstacle without rotating into it.
      const progress = THREE.MathUtils.clamp((delta.x * intended.x + delta.z * intended.z) / intendedTravel, 0, 1)
      if (progress < .98) {
        nextYaw = THREE.MathUtils.lerp(previousYaw, intendedYaw, progress)
        delta = advanceAt(nextYaw)
      }
      if (nextYaw !== previousYaw && overlaps(nextYaw, delta)) {
        let blockedYaw = nextYaw
        nextYaw = previousYaw
        delta = advanceAt(nextYaw)
        for (let i = 0; i < 4; i++) {
          const trialYaw = (nextYaw + blockedYaw) * .5
          const trialDelta = advanceAt(trialYaw)
          if (overlaps(trialYaw, trialDelta)) blockedYaw = trialYaw
          else {
            nextYaw = trialYaw
            delta = trialDelta
          }
        }
      }
    }
    if (nextYaw !== intendedYaw) drivetrain.velocity.applyAxisAngle(worldUp, nextYaw - intendedYaw)
    vehicle.yaw = nextYaw
    vehicle.body.setNextKinematicRotation(quaternion(nextYaw))
    vehicle.body.setNextKinematicTranslation({ x: origin.x + delta.x, y: CAR_HEIGHT, z: origin.z + delta.z })
    const wheelSpeed = drivetrain.resolve(previousYaw, nextYaw, delta.x, delta.z, STEP, rearAxle)
    if (model.kind === 'car') {
      model.setReversing(drivetrain.forwardSpeed < -.15 || (throttle < 0 && drivetrain.forwardSpeed <= .01))
      if (model.engineSound !== 'electric') transmission.advance(STEP, drivetrain.forwardSpeed, throttle, model.handling.topSpeed)
    }
    model.group.rotation.y = nextYaw
    model.spin(STEP, wheelSpeed, drivetrain.steering, drivetrain.slip, nextYaw - previousYaw, drivetrain.wheelAngle)
    effects.drive(STEP, model.group.position, nextYaw, drivetrain.slip, drivetrain.drifting, model.condition, model.rearWheelOffset)
    return riderImpact
  }

  function safeLanding(point: THREE.Vector3) {
    for (const radius of [0, .8, 1.65, 2.8, 4]) {
      const samples = radius === 0 ? 1 : 8
      for (let i = 0; i < samples; i++) {
        const angle = i * Math.PI * 2 / samples
        const x = point.x + radius * Math.cos(angle)
        const z = point.z + radius * Math.sin(angle)
        const ground = world.castRay(new RAPIER.Ray({ x, y: 2.2, z }, { x: 0, y: -1, z: 0 }),
          2.45, true, RAPIER.QueryFilterFlags.ONLY_FIXED)
        if (!ground || ground.timeOfImpact < 1.88) continue
        const y = 2.2 - ground.timeOfImpact + .035
        if (!world.intersectionWithShape({ x, y: y + PLAYER_HEIGHT, z }, quaternion(0),
          playerShape, undefined, undefined, playerCollider)) return new THREE.Vector3(x, y, z)
      }
    }
    return null
  }

  function ejectPlayer(vehicle: RoadVehicle, impact: RiderImpact) {
    const fall = startRiderFall(scene, world, vehicle, impact.velocity, impact.normal, impact.closing)
    if (!fall) return
    playerFall = fall
    activeCar = null
    playerYaw = vehicle.yaw
    player.group.position.copy(fall.position)
    reactions.push(vehicle, new THREE.Vector3().copy(vehicle.body.translation()), impact.normal, impact.closing * .63, 480)
    drivetrain.reset()
    effects.breakTrail()
    shake = Math.max(shake, .24)
  }

  function updateRiderFalls() {
    if (playerFall) {
      if (playerFall.step(STEP)) {
        const point = safeLanding(playerFall.landing) ?? new THREE.Vector3(SPAWN.x, .17, SPAWN.z)
        playerFall.remove()
        playerFall = null
        placePlayer(point.x, point.y, point.z)
        player.group.rotation.set(0, playerYaw, 0)
        player.group.visible = true
        playerCollider.setEnabled(true)
        world.propagateModifiedBodyPositionsToColliders()
      } else player.group.position.copy(playerFall.position)
    }
    for (const [bike, fall] of trafficFalls) {
      if (!fall.step(STEP)) continue
      fall.remove()
      trafficFalls.delete(bike)
      const point = safeLanding(fall.landing)
      if (!point) continue
      const heading = point.clone().sub(bike.model.group.position).setY(0).normalize()
      const next = safeLanding(point.clone().addScaledVector(heading, 3.6)) ?? point
      people.releaseDriver(bike.id, point, point, [[point.x, point.z], [next.x, next.z]], .1)
    }
  }

  function simulate(keys: ReadonlySet<string>, touch: Readonly<TouchInput>) {
    const person = activeCar?.model.group.position ?? player.group.position
    // Yield at the crossing when a player or parked car occupies the track.
    const occupied = [person, dispatch.model.group.position].some((p) =>
      Math.abs(p.z - 40.04) < 1.62 && p.x > tramX - 7 && p.x < tramX + 11,
    )
    tramX += (occupied || traffic.blocksTrack(tramX, 40.04) ? 0 : 7.4) * STEP
    if (tramX > tramLimit) {
      tramX = -tramLimit
      tramBody.setTranslation({ x: tramX, y: 1.61, z: 40.04 }, true)
    }
    tramBody.setNextKinematicTranslation({ x: tramX, y: 1.61, z: 40.04 })
    let riderImpact: RiderImpact | undefined
    if (onMenu) player.animate(STEP, 0, false)
    else if (activeCar) riderImpact = moveCar(keys, activeCar, touch)
    else if (!playerFall) movePlayer(keys, touch)
    people.step(STEP, activeCar || onMenu || playerFall ? null : player.group.position, playerCollider.handle, person)
    traffic.step(STEP, person)
    world.step()
    reactions.sync(STEP, (vehicle, speed, settled) => traffic.reportSlide(vehicle.collider.handle, speed, settled))
    fixtures.step(STEP)
    if (!activeCar && !playerFall) {
      const p = playerBody.translation()
      player.group.position.set(p.x, p.y - PLAYER_HEIGHT, p.z)
      if (p.y < -1.6) {
        placePlayer(SPAWN.x, 0.17, SPAWN.z)
        targetPosition.copy(player.group.position).y += 1.32
      }
    }
    if (activeCar) {
      const c = activeCar.body.translation()
      activeCar.model.group.position.set(c.x, 0.02, c.z)
      if (riderImpact) ejectPlayer(activeCar, riderImpact)
    }
    updateRiderFalls()
    if (takeover) {
      const { car, side } = takeover
      takeover.remaining -= STEP
      const time = TAKEOVER_TIME - takeover.remaining
      const open = Math.min(THREE.MathUtils.smoothstep(time, 0, 0.24), 1 - THREE.MathUtils.smoothstep(time, 0.6, TAKEOVER_TIME))
      if (car.model.kind === 'car') car.model.setDoor(side, open)
      if (takeover.remaining <= 0) {
        takeover = null
        if (player.group.position.distanceTo(car.model.group.position) <= ENTRY_RANGE + 0.45) sitIn(car)
      }
    }
    tram.position.x = tramX
  }

  function menuCamera() {
    if (camera.fov !== 59) {
      camera.fov = 59
      camera.updateProjectionMatrix()
    }
    const sweep = Math.sin(elapsed * 0.22) * 0.83
    camera.position.set(-18.6 + sweep, 5.65, 89.8 + sweep * 0.22)
    camera.lookAt(-7.2 + sweep * 0.85, 42, -51)
  }

  function followCamera(dt: number, instant = false) {
    const actor = activeCar?.model.group ?? player.group
    const motorcycle = activeCar?.model.kind === 'motorcycle'
    cameraTarget.copy(actor.position)
    cameraTarget.y += motorcycle ? 1.15 : 1.26
    if (instant) targetPosition.copy(cameraTarget)
    else targetPosition.lerp(cameraTarget, 1 - Math.exp(-dt * (activeCar ? 16 : 13)))

    zoom = instant ? zoomTarget : THREE.MathUtils.damp(zoom, zoomTarget, 9, dt)
    const armLength = activeCar ? (motorcycle ? 6.25 : 8.2) + drivetrain.speed * .042 + zoom * 10 : 5.65 + zoom * 7.5
    const zoomLift = zoom * .16 * THREE.MathUtils.smoothstep(pitch, -.12, .21)
    const viewPitch = Math.min(pitch + zoomLift, pitchLimits[1])
    const boomPitch = Math.max(.09, viewPitch)
    const horizontal = Math.cos(boomPitch)
    offset.set(Math.sin(lookYaw) * horizontal, Math.sin(boomPitch), Math.cos(lookYaw) * horizontal)
    cameraRay.origin = targetPosition
    cameraRay.dir = offset
    const hit = world.castRay(
      cameraRay, armLength, true, undefined, undefined, undefined, undefined,
      (collider) => collider.handle !== playerCollider.handle && collider.handle !== activeCar?.collider.handle,
    )
    const reach = hit ? Math.max(0.37, hit.timeOfImpact - 0.32) : armLength
    if (instant || reach < cameraArm) cameraArm = reach
    else cameraArm = THREE.MathUtils.damp(cameraArm, reach, 8, dt)
    camera.position.copy(targetPosition).addScaledVector(offset, cameraArm)
    if (!reducedMotion && shake > .001) {
      camera.position.y += Math.sin(elapsed * 119) * shake * .18
      camera.position.addScaledVector(offset, Math.cos(elapsed * 91) * shake * .24)
    }
    aim.copy(targetPosition)
    // The boom keeps its ground clearance while the lens is free to aim upward.
    aim.y += cameraArm * horizontal * (Math.tan(boomPitch) - Math.tan(viewPitch))
    camera.lookAt(aim)
    const nextFov = activeCar && !reducedMotion ? 56 + Math.min(drivetrain.speed * .41, 10) : 56
    camera.fov = instant ? nextFov : THREE.MathUtils.damp(camera.fov, nextFov, 6, dt)
    camera.updateProjectionMatrix()
  }

  function mixSound(anchor: THREE.Vector3, train: ReturnType<typeof updateGoTrains>, keys: ReadonlySet<string>, touch: Readonly<TouchInput>) {
    let nearest: (typeof traffic.vehicles)[number] | undefined
    let distance = 43
    const rightX = Math.cos(lookYaw)
    const rightZ = -Math.sin(lookYaw)
    const pan = (x: number, z: number) => THREE.MathUtils.clamp(((x - anchor.x) * rightX + (z - anchor.z) * rightZ) / 21, -.86, .86)
    for (const car of traffic.vehicles) {
      if (car.taken || car.speed < .65) continue
      const gap = car.model.group.position.distanceTo(anchor)
      if (gap >= distance) continue
      distance = gap
      nearest = car
    }
    const source = nearest?.model.group.position
    const skid = reactions.nearestSkid(anchor)
    const throttle = throttleInput(keys, touch)
    const model = activeCar?.model
    const engine = model?.kind === 'car' ? model.engineSound : 'motorcycle'
    sound.frame({
      waterfront: THREE.MathUtils.smoothstep(anchor.z, BOARDWALK.north - 25, BOARDWALK.south + 2),
      traffic: { distance, speed: nearest?.speed ?? 0, pan: source ? pan(source.x, source.z) : 0 },
      streetcar: { distance: Math.hypot(Math.max(0, Math.abs(tramX - anchor.x) - 5.5), 40.04 - anchor.z), pan: pan(tramX, 40.04) },
      train: { distance: train.distance, pan: pan(train.x, train.z) },
      collisionSkid: { strength: skid.strength, pan: pan(skid.position.x, skid.position.z) },
      drive: model ? {
        speed: drivetrain.speed, throttle: throttle * drivetrain.forwardSpeed < -1 ? 0 : throttle, slip: drivetrain.slip,
        handbrake: keys.has('Space') || touch.brake, drifting: drivetrain.drifting, pitch: model.enginePitch, engine,
        rpm: engine === 'standard' || engine === 'v10' ? transmission.rpm : undefined, load: transmission.load,
      } : null,
    })
  }

  reset()
  updateGoTrains(0, player.group.position)
  menuCamera()
  updateLighting(player.group.position)
  resize()
  return {
    canvas: renderer.domElement,
    reset,
    setMenu,
    sound,
    mouseLook,
    centerCamera() {
      lookYaw = activeCar?.yaw ?? playerYaw
      pitch = activeCar ? .265 : .28
      lookIdle = 0
    },
    zoomCamera(amount: number) {
      zoomTarget = THREE.MathUtils.clamp(zoomTarget + amount, 0, 1)
    },
    enterOrExit,
    greetPedestrian() {
      if (!activeCar && !takeover && !playerFall) people.greet(player.group.position)
    },
    setWaypoint(point: Point | null) {
      waypoint.group.visible = !!point
      if (point) waypoint.group.position.set(point.x, 0, point.z)
    },
    get state() {
      const entry = nearbyCar()
      return {
        actor: activeCar?.model.group.position ?? player.group.position,
        heading: activeCar?.yaw ?? playerYaw,
        car: dispatch.model.group.position,
        motorcycle: traffic.starterBike.model.group.position,
        driving: !!activeCar,
        drivingDispatch: activeCar === dispatch,
        ridingMotorcycle: activeCar?.model.kind === 'motorcycle',
        ridingStarterBike: activeCar === traffic.starterBike,
        riderFall: playerFall ? (playerFall.steppingUp ? 'rising' : 'fallen') : null,
        entry: entry?.kind ?? null,
        entryMotorcycle: entry?.vehicle.model.kind === 'motorcycle',
        takeover: !!takeover,
        takeoverMotorcycle: takeover?.car.model.kind === 'motorcycle',
        speed: drivetrain.speed,
        condition: activeCar?.model.condition ?? 1,
        drifting: !!activeCar && drivetrain.drifting,
        elapsed,
        pedestrian: activeCar || playerFall ? null : people.nearbyName(player.group.position),
      }
    },
    frame(dt: number, keys: ReadonlySet<string>, touch: Readonly<TouchInput> = noTouch) {
      elapsed += dt
      if (!onMenu) {
        const yawInput = Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))
        const pitchInput = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'))
        lookYaw += yawInput * dt * 1.82
        pitch = THREE.MathUtils.clamp(pitch + pitchInput * dt * 1.1, ...pitchLimits)
        lookIdle = yawInput || pitchInput ? 0 : lookIdle + dt
        if (activeCar && lookIdle > 1.2 && drivetrain.speed > 1) {
          lookYaw += angleDifference(activeCar.yaw, lookYaw) * Math.min(1, dt * (drivetrain.drifting ? .78 : 1.55 + drivetrain.speed / 12))
        }
      }
      accumulator = Math.min(accumulator + dt, 0.08)
      while (accumulator >= STEP) {
        simulate(keys, touch)
        accumulator -= STEP
      }
      effects.update(dt)
      shake *= Math.exp(-dt * 9)
      water.uniforms.time.value = elapsed
      const anchor = activeCar?.model.group.position ?? player.group.position
      updateLighting(anchor)
      const train = updateGoTrains(elapsed, anchor)
      if (sound.isAudible()) mixSound(anchor, train, keys, touch)
      waypoint.animate(elapsed)
      const carGroup = activeCar?.model.group
      if (activeCar && carGroup) {
        // Draw between fixed physics ticks, then restore the simulation pose.
        const blend = accumulator / STEP
        currentCarPosition.copy(carGroup.position)
        carGroup.position.lerp(previousCarPosition, 1 - blend)
        carGroup.rotation.y = THREE.MathUtils.lerp(previousCarYaw, activeCar.yaw, blend)
      }
      aimHeadlights(activeCar)
      if (onMenu) menuCamera()
      else followCamera(dt)
      render.render()
      if (activeCar && carGroup) {
        carGroup.position.copy(currentCarPosition)
        carGroup.rotation.y = activeCar.yaw
      }
    },
  }
}
