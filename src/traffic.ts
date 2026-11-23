import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { makeCar, type TrafficBody } from './vehicles'
import { makeMotorcycle, type MotorcycleStyle } from './motorcycles'
import { EAST_WEST, MOTORCYCLE_START, NORTH_SOUTH } from './layout'

type Corner = readonly [number, number]
type TrafficStyle = TrafficBody | MotorcycleStyle
type Profile = { loop: number; offset: number; style: TrafficStyle; color: string; pace: number; parking?: typeof MOTORCYCLE_START }

const loops: ReadonlyArray<ReadonlyArray<Corner>> = [
  [[0, 42], [-74, 42], [-74, -12], [0, -12]],
  [[0, -12], [0, 42], [74, 42], [74, -12]],
  [[74, -68], [0, -68], [-74, -68], [-74, -12], [0, -12], [74, -12]],
  [[0, 42], [0, -12], [74, -12], [74, 42]],
  [[-160, 42], [-160, -12], [-74, -12], [-74, 42]],
  [[74, 42], [74, -12], [160, -12], [160, 42]],
  [[-160, -12], [-160, -128], [-74, -128], [-74, -12]],
  [[74, -12], [74, -128], [160, -128], [160, -12]],
  [[-160, -128], [-160, -191], [0, -191], [0, -128]],
  [[0, -128], [0, -191], [160, -191], [160, -128]],
  [[-160, 42], [160, 42], [160, -191], [-160, -191]],
  [[-74, -191], [-74, 42], [74, 42], [74, -191]],
]
const initialTraffic = [
  { loop: 0, offset: 14, style: 'pickup', color: '#98624a', pace: 10.3 },
  { loop: 0, offset: 136, style: 'boxTruck', color: '#327873', pace: 10.8 },
  { loop: 1, offset: 60, style: 'track', color: '#df6d2d', pace: 10.7 },
  { loop: 1, offset: 182, style: 'taxi', color: '#de733a', pace: 10.2 },
  { loop: 2, offset: 38, style: 'classic', color: '#467c64', pace: 11.2 },
  { loop: 2, offset: 222, style: 'wedge', color: '#a4bd3a', pace: 10.9 },
  { loop: 3, offset: 17, style: 'hatchback', color: '#e3b34e', pace: 10.1 },
  { loop: 3, offset: 139, style: 'wideGT', color: '#bd314e', pace: 11.1 },
] satisfies ReadonlyArray<Profile>
const motorcycleProfiles: readonly Profile[] = [
  { loop: 0, offset: 66, style: 'streetBike', color: '#b66b43', pace: 9.7 },
  { loop: 9, offset: 245, style: 'sportBike', color: '#297d9c', pace: 11.4 },
  { loop: 6, offset: 174, style: 'streetBike', color: '#5e7976', pace: 10.2 },
  { loop: 7, offset: 98, style: 'sportBike', color: '#b43343', pace: 11.3 },
  { loop: 0, offset: 0, style: 'sportBike', color: '#db823a', pace: 0, parking: MOTORCYCLE_START },
]
const paintByStyle: Record<TrafficBody, readonly string[]> = {
  sedan: ['#627789', '#c5a46b', '#79566e', '#a5afb4'],
  wagon: ['#526f60', '#8a7167', '#5e6883'],
  hatchback: ['#d29c38', '#d5d0bd', '#5c8795'],
  suv: ['#587758', '#354b5a', '#ae9a82'],
  van: ['#b4c0bb', '#526d82', '#998372'],
  coupe: ['#546b9c', '#ac523b', '#a8b6bc'],
  taxi: ['#de733a'],
  pickup: ['#592f45', '#568380', '#be8d61'],
  convertible: ['#428897', '#b73e4c', '#766396'],
  classic: ['#7c3b48', '#435d82', '#55735a'],
  executive: ['#57484d', '#485f52', '#6d737b'],
  electric: ['#8f9caf', '#bfacac', '#57618d'],
  boxTruck: ['#416d80', '#967153'],
  track: ['#ca703a', '#98b5c3'],
  wedge: ['#a4bd3a', '#259ca2'],
  wideGT: ['#a72a42', '#356785'],
}
const bodyMix: readonly TrafficBody[] = [
  'electric', 'executive', 'van', 'coupe', 'pickup', 'sedan', 'wagon', 'wideGT', 'convertible',
  'boxTruck', 'hatchback', 'suv', 'sedan', 'electric', 'pickup', 'classic', 'van', 'coupe',
  'boxTruck', 'suv', 'executive', 'hatchback', 'track', 'wedge', 'taxi', 'electric',
]
const extraPerRoute = [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 2, 2]
const junctions = EAST_WEST.flatMap(({ z }) => NORTH_SOUTH.map(({ x }) => ({ x, z })))
const bodyHeight = 0.7
const braking = 10.5
const orientation = (yaw: number) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })

interface Crossing { junction: number; entry: number; exit: number }

export interface RoadVehicle {
  model: ReturnType<typeof makeCar> | ReturnType<typeof makeMotorcycle>
  body: RAPIER.RigidBody
  collider: RAPIER.Collider
  yaw: number
}

function makeRoute(loop: ReadonlyArray<Corner>) {
  const corners = loop.flatMap((from, index) => {
    const to = loop[(index + 1) % loop.length]
    const horizontal = from[1] === to[1]
    const axis = horizontal ? 0 : 1
    const direction = Math.sign(to[axis] - from[axis])
    const intermediate = (horizontal ? NORTH_SOUTH.map(({ x }) => x) : EAST_WEST.map(({ z }) => z))
      .filter((value) => (value - from[axis]) * direction > 0 && (to[axis] - value) * direction > 0)
      .sort((a, b) => (a - b) * direction)
      .map((value): Corner => horizontal ? [value, from[1]] : [from[0], value])
    return [from, ...intermediate]
  })
  const turns = corners.map(([x, z], index) => {
    const [oldX, oldZ] = corners[(index + corners.length - 1) % corners.length]
    const [nextX, nextZ] = corners[(index + 1) % corners.length]
    const incoming = new THREE.Vector3(x - oldX, 0, z - oldZ).normalize()
    const outgoing = new THREE.Vector3(nextX - x, 0, nextZ - z).normalize()
    const sameStreet = incoming.dot(outgoing) > 0.99
    const corner = new THREE.Vector3(x, bodyHeight, z)
    const inLane = incoming.z === 0 && z === 42 ? 5.8 : 3.55
    const outLane = outgoing.z === 0 && z === 42 ? 5.8 : 3.55
    corner.x -= incoming.z * inLane + (sameStreet ? 0 : outgoing.z * outLane)
    corner.z += incoming.x * inLane + (sameStreet ? 0 : outgoing.x * outLane)
    const radius = sameStreet ? 0 : 5.2
    return {
      corner,
      entry: corner.clone().addScaledVector(incoming, -radius),
      exit: corner.clone().addScaledVector(outgoing, radius),
    }
  })
  const path = new THREE.CurvePath<THREE.Vector3>()
  let meters = 0
  const centers = turns.map(({ corner, entry, exit }, index) => {
    const previous = turns[(index + turns.length - 1) % turns.length]
    const straight = new THREE.LineCurve3(previous.exit, entry)
    path.add(straight)
    meters += straight.getLength()
    const bend = entry.equals(exit) ? null : new THREE.QuadraticBezierCurve3(entry, corner, exit)
    const bendLength = bend?.getLength() ?? 0
    if (bend) path.add(bend)
    const center = meters + bendLength * 0.5
    meters += bendLength
    return center
  })
  const length = path.getLength()
  const wrapped = (distance: number) => ((distance % length) + length) % length
  const count = Math.ceil(length / .36)
  const samples = Array.from({ length: count + 1 }, (_, index) => path.getPoint(index / count)!)
  const at = (distance: number) => {
    const sample = wrapped(distance) / length * count
    const i = Math.min(count - 1, Math.floor(sample))
    return new THREE.Vector3().lerpVectors(samples[i], samples[i + 1], sample - i)
  }
  const yawAt = (distance: number, position: THREE.Vector3) => {
    const ahead = at(distance + 0.22)
    return Math.atan2(position.x - ahead.x, position.z - ahead.z)
  }
  const crossings: Crossing[] = corners.map(([x, z], index) => {
    const center = centers[index]
    let entry = center
    let exit = center
    const isNear = (distance: number) => {
      const p = at(distance)
      return Math.abs(p.x - x) <= 10.2 && Math.abs(p.z - z) <= 10.2
    }
    while (isNear(entry)) entry -= 0.45
    while (isNear(exit)) exit += 0.45
    return { junction: junctions.findIndex((point) => point.x === x && point.z === z), entry: wrapped(entry - 2), exit: wrapped(exit + 2) }
  })
  return { at, yawAt, length, wrapped, crossings }
}

export function makeTraffic(scene: THREE.Scene, world: RAPIER.World) {
  const routes = loops.map(makeRoute)
  const owners = new Map<number, number>()
  let time = 0
  let nextStyle = 0
  const fleet: Profile[] = [...initialTraffic, ...extraPerRoute.flatMap((count, loop) => Array.from({ length: count }, (_, index) => {
    const style = bodyMix[nextStyle++ % bodyMix.length]
    const colours = paintByStyle[style]
    return {
      loop, offset: routes[loop].length * (index + (.42 + loop % 4 * .11)) / count,
      style, color: colours[(loop * 3 + index) % colours.length], pace: 9.45 + (loop * 7 + index * 3) % 9 * .23,
    }
  })), ...motorcycleProfiles]
  const cars = fleet.map((profile, id) => {
    const { color, style } = profile
    const model = style === 'sportBike' || style === 'streetBike' ? makeMotorcycle(color, style) : makeCar(color, style)
    scene.add(model.group)
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
    const { halfWidth, halfLength } = model.dimensions
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(halfWidth, 0.49, halfLength), body)
    return {
      id, taken: false, offRoute: false, profile, route: routes[profile.loop], model, body, collider, nearby: true,
      distance: profile.offset, yaw: 0, speed: profile.pace, reservation: null as Crossing | null,
      waitingSince: Infinity,
    }
  })

  const byCollider = new Map(cars.map(car => [car.collider.handle, car]))
  type Car = typeof cars[number]
  type Approach = { car: Car; crossing: Crossing; gap: number }

  function poseAt(car: Car, distance: number) {
    const position = car.route.at(distance)
    const yaw = car.route.yawAt(distance, position)
    const rearAxle = car.model.rearWheelOffset.z
    position.x -= Math.sin(yaw) * rearAxle
    position.z -= Math.cos(yaw) * rearAxle
    return { position, yaw }
  }

  function place(car: Car, immediately = false, pose = poseAt(car, car.distance)) {
    const { position, yaw } = pose
    car.yaw = yaw
    const rotation = orientation(yaw)
    if (immediately) {
      car.body.setTranslation(position, true)
      car.body.setRotation(rotation, true)
    }
    if (car.nearby) {
      car.body.setNextKinematicTranslation(position)
      car.body.setNextKinematicRotation(rotation)
    }
    car.model.group.position.set(position.x, 0.02, position.z)
    car.model.group.rotation.y = yaw
  }

  function releaseJunction(car: Car) {
    if (car.reservation) owners.delete(car.reservation.junction)
    car.reservation = null
  }

  function crossingAt(route: Car['route'], distance: number) {
    return route.crossings.find((crossing) =>
      route.wrapped(distance - crossing.entry) < route.wrapped(crossing.exit - crossing.entry),
    )
  }

  function reset() {
    owners.clear()
    time = 0
    for (const car of cars) {
      car.taken = false
      car.offRoute = false
      car.nearby = true
      car.model.group.visible = true
      car.model.setDetail(true)
      car.body.setEnabled(true)
      car.model.repair()
      if (car.model.kind === 'motorcycle') car.model.setRider(car.profile.parking ? null : 'traffic')
      else car.model.setDoor(0, 0)
      car.speed = car.profile.pace
      car.reservation = null
      car.waitingSince = Infinity
      car.model.setBraking(false)
      const parking = car.profile.parking
      if (parking) {
        car.taken = true
        place(car, true, { position: new THREE.Vector3(parking.x, bodyHeight, parking.z), yaw: parking.yaw })
        continue
      }

      // Distribute vehicles before enabling the simulation, including shared lanes.
      for (let attempt = 0; attempt < 35; attempt++) {
        car.distance = car.route.wrapped(car.profile.offset + attempt * 7.3)
        const pose = poseAt(car, car.distance).position
        const inside = crossingAt(car.route, car.distance)
        if (inside && owners.has(inside.junction)) continue
        if (cars.slice(0, car.id).some((other) =>
          pose.distanceTo(other.model.group.position) < 2.25 + car.model.dimensions.halfLength + other.model.dimensions.halfLength,
        )) continue
        if (inside) {
          car.reservation = inside
          owners.set(inside.junction, car.id)
        }
        break
      }
      place(car, true)
    }
  }

  function step(dt: number, anchor?: THREE.Vector3) {
    time += dt
    // Serve vehicles already at a stop line in arrival order. A small
    // difference between stop lines can otherwise keep one lane waiting.
    const approaching: Array<Approach | undefined> = []
    const atJunction = new Map<number, Approach>()
    for (const car of cars) {
      const position = car.model.group.position
      const range = anchor ? Math.hypot(position.x - anchor.x, position.z - anchor.z) : 0
      const physics = range < (car.nearby ? 132 : 116)
      car.model.group.visible = range < 198
      car.model.setDetail(range < 77)
      if (physics !== car.nearby) {
        car.nearby = physics
        car.body.setEnabled(physics)
        if (physics && !car.body.isDynamic()) {
          car.body.setTranslation({ x: position.x, y: bodyHeight, z: position.z }, true)
          car.body.setRotation(orientation(car.yaw), true)
        }
      }
      if (car.taken || car.offRoute) continue

      const { route, distance } = car
      if (car.reservation && route.wrapped(distance - car.reservation.exit) < 1) {
        releaseJunction(car)
      }
      if (car.reservation) continue
      for (const crossing of route.crossings) {
        const gap = route.wrapped(crossing.entry - distance)
        if (gap > 9) continue
        if (gap < 1.25) car.waitingSince = Math.min(car.waitingSince, time)
        const request = { car, crossing, gap }
        approaching[car.id] = request
        const selected = atJunction.get(crossing.junction)
        if (!selected || car.waitingSince < selected.car.waitingSince ||
          (car.waitingSince === selected.car.waitingSince && gap < selected.gap)) {
          atJunction.set(crossing.junction, request)
        }
        break
      }
    }
    for (const [junction, { car, crossing }] of atJunction) {
      if (owners.has(junction)) continue
      owners.set(junction, car.id)
      car.reservation = crossing
      car.waitingSince = Infinity
    }

    for (const car of cars) {
      if (car.taken || car.offRoute) continue
      const { route, distance, model } = car
      let clearance = car.reservation ? Infinity : approaching[car.id]?.gap ?? Infinity
      const position = model.group.position
      const direction = { x: -Math.sin(car.yaw), y: 0, z: -Math.cos(car.yaw) }
      const probe = 2.5 + car.speed * 0.73
      const { halfWidth, halfLength } = model.dimensions

      // Following is lane-based at every distance. Intersections are reserved
      // separately, so straight-line probes cannot jam vehicles on a bend.
      for (const other of cars) {
        if (other === car) continue
        const dx = other.model.group.position.x - position.x
        const dz = other.model.group.position.z - position.z
        const ahead = dx * direction.x + dz * direction.z
        const space = halfLength + other.model.dimensions.halfLength + .25
        if (ahead <= 0 || ahead > probe + space) continue
        const lateral = dx * direction.z - dz * direction.x
        if (Math.abs(lateral) < halfWidth + other.model.dimensions.halfWidth - .12 && (other.taken || other.offRoute || Math.cos(other.yaw - car.yaw) > .57)) {
          clearance = Math.min(clearance, Math.max(0, ahead - space))
        }
      }
      if (car.nearby) {
        const obstacle = world.castShape(
          car.body.translation(), orientation(car.yaw), direction, car.collider.shape, 0.26, probe, true,
          RAPIER.QueryFilterFlags.EXCLUDE_FIXED, undefined, car.collider, undefined,
          (collider) => {
            const vehicle = byCollider.get(collider.handle)
            return !vehicle || vehicle.taken || vehicle.offRoute
          },
        )
        if (obstacle) clearance = Math.min(clearance, obstacle.time_of_impact)
      }

      const target = Math.min(
        car.profile.pace * (.77 + .23 * model.condition),
        car.reservation ? 6.9 : Infinity,
        Math.sqrt(2 * braking * Math.max(0, clearance - 0.55)),
      )
      const oldSpeed = car.speed
      car.speed += THREE.MathUtils.clamp(target - car.speed, -braking * dt, 2.75 * dt)
      const previousYaw = car.yaw
      const advance = Math.min(car.speed * dt, Math.max(0, clearance - 0.33))
      car.distance = route.wrapped(distance + advance)
      place(car)
      const deltaYaw = Math.atan2(Math.sin(car.yaw - previousYaw), Math.cos(car.yaw - previousYaw))
      const wheelAngle = advance > .001 ? Math.atan(model.wheelbase * deltaYaw / advance) : 0
      model.spin(dt, advance / dt, wheelAngle / .59, 0, deltaYaw, wheelAngle)
      model.setBraking(target < oldSpeed - 0.35 || advance < 0.02)
    }
  }

  return {
    reset,
    step,
    vehicles: cars,
    starterBike: cars.find(car => car.profile.parking)!,
    vehicleAt(handle: number) { return byCollider.get(handle) },
    holdAfterImpact(car: Car) {
      releaseJunction(car)
      car.offRoute = true
      car.waitingSince = Infinity
    },
    reportSlide(handle: number, speed: number, settled: boolean) {
      const car = byCollider.get(handle)
      if (!car) return
      car.speed = speed
      if (!settled || car.taken || !car.nearby) return
      const route = car.route
      const position = car.model.group.position
      let closest = .43
      let distance = car.distance
      for (let offset = -17; offset <= 27; offset += .25) {
        const candidate = route.wrapped(car.distance + offset)
        const { position: p, yaw } = poseAt(car, candidate)
        const gap = Math.hypot(p.x - position.x, p.z - position.z)
        if (gap >= closest) continue
        if (Math.cos(yaw - car.yaw) < .97) continue
        closest = gap
        distance = candidate
      }
      if (closest >= .43) return
      const inside = crossingAt(route, distance)
      if (inside && owners.has(inside.junction)) return
      const pose = poseAt(car, distance)
      if (world.intersectionWithShape(pose.position, orientation(pose.yaw), car.collider.shape, undefined, undefined, car.collider)) return
      car.offRoute = false
      car.distance = distance
      car.reservation = inside ?? null
      if (inside) owners.set(inside.junction, car.id)
      place(car, true, pose)
    },
    take(car: typeof cars[number]) {
      releaseJunction(car)
      car.taken = true
      car.offRoute = false
      car.speed = 0
      car.model.setBraking(false)
      if (car.model.kind === 'motorcycle') car.model.setRider(null)
      car.body.setNextKinematicTranslation(car.body.translation())
      car.body.setNextKinematicRotation(car.body.rotation())
    },
    blocksTrack(tramX: number, track: number) {
      return cars.some(({ model, yaw }) => {
        const { x, z } = model.group.position
        return Math.abs(z - track) < 1.52 + model.dimensions.halfLength * Math.abs(Math.cos(yaw)) + model.dimensions.halfWidth * Math.abs(Math.sin(yaw))
          && x > tramX - 8.6 && x < tramX + 13
      })
    },
  }
}
