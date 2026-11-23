import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { makePerson } from './actors'
import { DISTRICT_WALKS, WALK_ROUTES } from './layout'
import type { ResidentModel } from './people-models'

const neighbours = [
  { name: 'Maya', colour: '#646e81', skin: '#86604d' },
  { name: 'Daniel', colour: '#b48964', skin: '#c58465' },
  { name: 'Priya', colour: '#66765a', skin: '#a87155' },
  { name: 'Noah', colour: '#9b716b', skin: '#bc896c' },
  { name: 'Alex', colour: '#778883', skin: '#c58465' },
  { name: 'Sam', colour: '#8e805a', skin: '#86604d' },
  { name: 'Riley', colour: '#756c7e', skin: '#bc896c' },
  { name: 'Avery', colour: '#855c54', skin: '#a87155' },
  { name: 'Jules', colour: '#545f73', skin: '#c58465' },
  { name: 'Taylor', colour: '#827766', skin: '#86604d' },
]
const greetingRange = 2.15

type Profile = typeof neighbours[number]
type Route = ReadonlyArray<readonly [number, number]>
type Departure = { origin: THREE.Vector3; exit: THREE.Vector3; started: number; duration: number }
type Knockdown = { origin: THREE.Vector3; end: THREE.Vector3; age: number; rise: number; force: number }
const upright = { x: 0, y: 0, z: 0, w: 1 }

export function makePedestrians(scene: THREE.Scene, world: RAPIER.World, makeResident?: ResidentModel) {
  const controller = world.createCharacterController(0.025)
  const slideShape = new RAPIER.Ball(.245)
  controller.enableAutostep(0.23, 0.24, false)
  controller.enableSnapToGround(0.24)
  function makeWalker(id: number, profile: Profile, route: Route, first: number) {
    const model = makeResident?.(id, profile.colour, profile.skin) ?? makePerson(profile.colour, profile.skin)
    const size = 0.92 + (id % 5) * 0.027
    model.group.scale.setScalar(size)
    model.group.name = profile.name
    scene.add(model.group)
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.53 * size, 0.255 * size), body)
    return {
      id, profile, route, first, model, body, collider, size, height: (0.53 + 0.255) * size,
      target: first + 1, pauseUntil: 0, hit: false, fall: 0, facing: 0, nearby: true, animationTime: 0,
      departure: null as Departure | null, knockdown: null as Knockdown | null,
    }
  }

  const pedestrians = WALK_ROUTES.flatMap((route, routeIndex) => [0, 2].map((first, index) => {
    const id = routeIndex * 2 + index
    return makeWalker(id, neighbours[id], route, first)
  }))
  const districtNames = ['Nadia', 'Cameron', 'Devon', 'Remy', 'Tariq', 'Kim', 'Finley', 'Marin', 'Sasha', 'Rowan', 'Chris', 'Sky', 'Tess', 'Lee']
  for (const [index, route] of DISTRICT_WALKS.entries()) {
    const id = pedestrians.length
    const profile = { ...neighbours[(index * 3 + 3) % neighbours.length], name: districtNames[index % districtNames.length] }
    pedestrians.push(makeWalker(id, profile, route, index % 2))
  }
  const residentCount = pedestrians.length
  const byCollider = new Map(pedestrians.map((person) => [person.collider.handle, person]))
  type Person = typeof pedestrians[number]
  let time = 0

  function reset() {
    time = 0
    for (const person of pedestrians.splice(residentCount)) {
      byCollider.delete(person.collider.handle)
      world.removeRigidBody(person.body)
      person.model.group.removeFromParent()
    }
    for (const person of pedestrians) {
      const [x, z] = person.route[person.first]
      const [nextX, nextZ] = person.route[person.first + 1]
      const y = 0.16 + person.height
      person.target = person.first + 1
      person.fall = person.pauseUntil = 0
      person.hit = false
      person.knockdown = null
      person.nearby = true
      person.animationTime = 0
      person.model.group.visible = true
      person.body.setEnabled(true)
      person.facing = Math.atan2(x - nextX, z - nextZ)
      person.body.setTranslation({ x, y, z }, true)
      person.body.setNextKinematicTranslation({ x, y, z })
      person.model.group.position.set(x, y - person.height, z)
      person.model.group.rotation.set(0, person.facing, 0)
      person.model.group.scale.setScalar(person.size)
    }
  }

  function bump(person: Person) {
    if (person.hit || person.knockdown || person.departure) return
    person.hit = true
    person.pauseUntil = time + .8
  }

  function nearby(player: THREE.Vector3) {
    let chosen: Person | null = null
    let closest = greetingRange
    for (const person of pedestrians) {
      if (person.departure || person.knockdown || !person.nearby) continue
      const gap = player.distanceTo(person.model.group.position)
      if (gap < closest) {
        closest = gap
        chosen = person
      }
    }
    return chosen
  }

  function knockDown(handle: number, direction: THREE.Vector3, closingSpeed: number) {
    const person = byCollider.get(handle)
    if (!person || person.knockdown || person.departure || closingSpeed < 2.45) return false
    const force = THREE.MathUtils.clamp((closingSpeed - 2) / 16, .1, 1)
    const origin = person.model.group.position.clone()
    const travel = .43 + force * 2.17
    const block = world.castShape(
      { x: origin.x, y: origin.y + .37, z: origin.z }, upright, direction, slideShape, .04, travel, false,
      RAPIER.QueryFilterFlags.ONLY_FIXED,
    )
    const end = origin.clone().addScaledVector(direction, block ? Math.max(0, block.time_of_impact - .14) : travel)
    const down = new RAPIER.Ray({ x: end.x, y: origin.y + .92, z: end.z }, { x: 0, y: -1, z: 0 })
    const floor = world.castRay(down, 1.25, true, RAPIER.QueryFilterFlags.ONLY_FIXED)
    if (floor) end.y = origin.y + .92 - floor.timeOfImpact + .025
    else end.copy(origin)
    person.facing = Math.atan2(-direction.x, -direction.z)
    person.knockdown = { origin, end, age: 0, rise: 0, force }
    person.body.setEnabled(false)
    return true
  }

  function updateKnockdown(person: Person, knockdown: Knockdown, dt: number, range: number) {
    const { origin, end, force } = knockdown
    const { group, animate } = person.model
    knockdown.age += dt
    const slide = 1 - (1 - Math.min(1, knockdown.age / (.32 + force * .32))) ** 2
    const fall = THREE.MathUtils.smoothstep(knockdown.age, 0, .21 + force * .1)
    const bodyPosition = { x: end.x, y: end.y + person.height, z: end.z }
    if (knockdown.age > 2.1 + force * 1.45 && range < 110) {
      const blocked = world.intersectionWithShape(bodyPosition, upright, person.collider.shape, RAPIER.QueryFilterFlags.EXCLUDE_FIXED)
      knockdown.rise = blocked ? Math.max(0, knockdown.rise - dt * 2) : Math.min(1, knockdown.rise + dt / .8)
    }
    const down = fall * (1 - THREE.MathUtils.smoothstep(knockdown.rise, 0, 1))
    group.position.lerpVectors(origin, end, slide)
    group.position.y += down * .155
    group.rotation.set(-down * 1.52, person.facing, down * .19, 'YXZ')
    group.scale.set(person.size, person.size * (1 - down * .08), person.size * (1 - down * .48))
    if (group.visible && range < 46) animate(dt, 0, false)
    if (knockdown.rise < 1) return
    person.knockdown = null
    person.fall = 0
    person.nearby = false
    person.body.setTranslation(bodyPosition, true)
    person.body.setNextKinematicTranslation(bodyPosition)
  }

  function step(dt: number, player: THREE.Vector3 | null, playerHandle: number, anchor?: THREE.Vector3) {
    time += dt
    for (const person of pedestrians) {
      if (person.departure) {
        const { origin, exit, started, duration } = person.departure
        const progress = Math.min(1, (time - started) / duration)
        const stride = THREE.MathUtils.smoothstep(progress, 0.1, 1)
        const group = person.model.group
        group.visible = progress > 0.18
        group.position.lerpVectors(origin, exit, stride)
        group.scale.y = person.size * THREE.MathUtils.lerp(0.7, 1, stride)
        person.model.animate(dt, 1.8, false)
        if (progress >= 1) {
          person.departure = null
          person.body.setEnabled(true)
          const ready = { x: exit.x, y: exit.y + person.height, z: exit.z }
          person.body.setTranslation(ready, true)
          person.body.setNextKinematicTranslation(ready)
        }
        continue
      }
      const group = person.model.group
      const range = anchor ? Math.hypot(group.position.x - anchor.x, group.position.z - anchor.z) : 0
      const physicallyNearby = range < (person.nearby ? 86 : 75)
      group.visible = range < 122
      if (person.knockdown) {
        updateKnockdown(person, person.knockdown, dt, range)
        continue
      }
      if (physicallyNearby !== person.nearby) {
        person.nearby = physicallyNearby
        person.body.setEnabled(physicallyNearby)
        if (physicallyNearby) {
          const current = group.position
          person.body.setTranslation({ x: current.x, y: current.y + person.height, z: current.z }, true)
          person.fall = 0
        }
      }
      const position = physicallyNearby ? person.body.translation() : {
        x: group.position.x, y: group.position.y + person.height, z: group.position.z,
      }
      const [targetX, targetZ] = person.route[person.target]
      if (Math.hypot(targetX - position.x, targetZ - position.z) < 0.17) {
        const next = person.target + 1
        person.target = person.id < residentCount ? next % person.route.length : Math.min(next, person.route.length - 1)
      }
      const [x, z] = person.route[person.target]
      if (!player || Math.hypot(player.x - position.x, player.z - position.z) > 1.13) person.hit = false
      const paused = time < person.pauseUntil && player !== null
      const dx = x - position.x
      const dz = z - position.z
      const distance = Math.hypot(dx, dz)
      const speed = paused || distance < 0.12 ? 0 : 1.2 + (person.id % 4) * 0.13
      const scale = speed * dt / Math.max(distance, 0.01)
      let moved = { x: dx * scale, y: 0, z: dz * scale }
      if (physicallyNearby) {
        person.fall = Math.max(-5, person.fall - 21 * dt)
        controller.computeColliderMovement(person.collider, { ...moved, y: person.fall * dt })
        moved = controller.computedMovement()
        if (controller.computedGrounded()) person.fall = -0.48
        if (player && !paused) {
          for (let i = 0; i < controller.numComputedCollisions(); i++) {
            if (controller.computedCollision(i)?.collider?.handle === playerHandle) bump(person)
          }
        }
      }
      const next = { x: position.x + moved.x, y: position.y + moved.y, z: position.z + moved.z }
      if (physicallyNearby) person.body.setNextKinematicTranslation(next)
      person.model.group.position.set(next.x, next.y - person.height, next.z)
      const wanted = paused && player
        ? Math.atan2(position.x - player.x, position.z - player.z)
        : speed > 0 ? Math.atan2(-dx, -dz) : person.facing
      const diff = wanted - person.facing
      person.facing += Math.atan2(Math.sin(diff), Math.cos(diff)) * (1 - Math.exp(-dt * 8))
      person.model.group.rotation.y = person.facing
      const greeting = paused ? Math.min(1, (person.pauseUntil - time) * 4) * 0.78 : 0
      person.animationTime += dt
      if (group.visible && (range < 38 || person.animationTime >= 1 / 17)) {
        person.model.animate(Math.min(person.animationTime, .13), Math.hypot(moved.x, moved.z) / dt, false, greeting)
        person.animationTime = 0
      }
    }
  }

  return {
    reset,
    step,
    knockDown,
    releaseDriver(index: number, origin: THREE.Vector3, exit: THREE.Vector3, route: Route, duration: number) {
      const names = ['Jamie', 'Morgan', 'Casey', 'Robin', 'Jordan', 'Ellis', 'Adrian', 'Reese']
      const profile = { ...neighbours[index % neighbours.length], name: names[index % names.length] }
      const driver = makeWalker(residentCount + index, profile, route, 0)
      driver.facing = Math.atan2(origin.x - exit.x, origin.z - exit.z)
      driver.model.group.rotation.y = driver.facing
      driver.model.group.position.copy(origin)
      driver.model.group.visible = false
      driver.body.setEnabled(false)
      driver.departure = { origin, exit, started: time, duration }
      pedestrians.push(driver)
      byCollider.set(driver.collider.handle, driver)
    },
    nearbyName(player: THREE.Vector3) { return nearby(player)?.profile.name ?? null },
    greet(player: THREE.Vector3) {
      const person = nearby(player)
      if (person && person.pauseUntil <= time) person.pauseUntil = time + 1.45
    },
    contact(handle: number) {
      const person = byCollider.get(handle)
      if (person) bump(person)
    },
  }
}
