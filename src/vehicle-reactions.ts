import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { RoadVehicle } from './traffic'

type Slide = { time: number; yaw: number; position: THREE.Vector3; scrub: number }
const stationary = { x: 0, y: 0, z: 0 }

export function makeVehicleReactions() {
  const sliding = new Map<RoadVehicle, Slide>()

  function stop(vehicle: RoadVehicle) {
    if (!sliding.delete(vehicle)) return
    const body = vehicle.body
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true)
    body.setLinvel(stationary, true)
    body.setAngvel(stationary, true)
    body.enableCcd(false)
    body.setNextKinematicTranslation(body.translation())
    body.setNextKinematicRotation(body.rotation())
    vehicle.model.setBraking(true)
  }

  return {
    reset() {
      for (const vehicle of sliding.keys()) stop(vehicle)
    },
    stop,
    speedOf(vehicle: RoadVehicle) {
      if (!sliding.has(vehicle)) return 0
      const velocity = vehicle.body.linvel()
      return Math.hypot(velocity.x, velocity.z)
    },
    push(vehicle: RoadVehicle, point: THREE.Vector3, direction: THREE.Vector3, closingSpeed: number, strikerMass: number) {
      const body = vehicle.body
      const mass = vehicle.model.handling.mass
      if (!sliding.has(vehicle)) {
        const prior = body.linvel()
        sliding.set(vehicle, { time: 0, yaw: vehicle.yaw, position: vehicle.model.group.position.clone(), scrub: 0 })
        body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
        body.setEnabledTranslations(true, false, true, true)
        body.setEnabledRotations(false, true, false, true)
        body.setLinearDamping(1.35)
        body.setAngularDamping(2.2)
        body.enableCcd(true)
        vehicle.collider.setMass(mass)
        body.recomputeMassPropertiesFromColliders()
        body.setLinvel({ x: prior.x, y: 0, z: prior.z }, true)
      }
      const impulse = 1.07 * Math.min(closingSpeed, 31) * mass * strikerMass / (mass + strikerMass)
      body.applyImpulseAtPoint({ x: direction.x * impulse, y: 0, z: direction.z * impulse }, point, true)
      const slide = sliding.get(vehicle)!
      slide.time = 0
      vehicle.model.setBraking(true)
    },
    sync(dt: number, onSlide: (vehicle: RoadVehicle, speed: number, settled: boolean) => void) {
      for (const [vehicle, slide] of sliding) {
        const { body, model } = vehicle
        slide.time += dt
        const p = body.translation()
        const r = body.rotation()
        vehicle.yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.z * r.z))
        const deltaYaw = Math.atan2(Math.sin(vehicle.yaw - slide.yaw), Math.cos(vehicle.yaw - slide.yaw))
        const dx = (p.x - slide.position.x) / dt
        const dz = (p.z - slide.position.z) / dt
        const sin = Math.sin(vehicle.yaw)
        const cos = Math.cos(vehicle.yaw)
        const speed = Math.hypot(dx, dz)
        const forward = -dx * sin - dz * cos
        const slip = dx * cos - dz * sin
        const scrub = Math.abs(slip) + Math.abs(deltaYaw / dt) * .8 + speed * .3
        slide.scrub = THREE.MathUtils.clamp((scrub - .37) / 5.6, 0, 1)
        model.group.position.set(p.x, .02, p.z)
        model.group.rotation.y = vehicle.yaw
        model.spin(dt, forward, 0, slip, deltaYaw)
        slide.position.copy(model.group.position)
        slide.yaw = vehicle.yaw
        const settled = !body.isEnabled() || (slide.time > .38 && speed < .32 && Math.abs(deltaYaw / dt) < .12) || slide.time > 5
        if (settled) stop(vehicle)
        onSlide(vehicle, settled ? 0 : speed, settled)
      }
    },
    nearestSkid(anchor: THREE.Vector3) {
      let best = 0
      let position = anchor
      for (const [vehicle, slide] of sliding) {
        const source = vehicle.model.group.position
        const distance = source.distanceTo(anchor)
        const energy = slide.scrub * Math.max(0, 1 - distance / 36) ** 2
        if (energy <= best) continue
        best = energy
        position = source
      }
      return { strength: best, position }
    },
  }
}
