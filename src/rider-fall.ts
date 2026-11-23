import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { RoadVehicle } from './traffic'

export const EJECTION_SPEED = 6.4
const upright = { x: 0, y: 0, z: 0, w: 1 }
const slideShape = new RAPIER.Ball(.30)
const roll = new THREE.Euler(0, 0, 0, 'YXZ')

export function startRiderFall(scene: THREE.Scene, world: RAPIER.World, bike: RoadVehicle,
  velocity: THREE.Vector3, normal: THREE.Vector3, closing: number) {
  if (bike.model.kind !== 'motorcycle') return null
  const position = bike.model.group.position
  const tangent = new THREE.Vector3(normal.z, 0, -normal.x)
  const swing = velocity.dot(tangent) < 0 ? -1 : 1
  const travel = THREE.MathUtils.clamp(1.65 + closing * .16, 2.4, 6.6)
  const landing = new THREE.Vector3(position.x, position.y, position.z)
  let bestDistance = -1
  let direction = tangent.clone().multiplyScalar(swing)

  for (const sign of [swing, -swing]) {
    const path = tangent.clone().multiplyScalar(sign).addScaledVector(normal, .58).normalize()
    const blocker = world.castShape(
      { x: position.x, y: .57, z: position.z }, upright, path, slideShape,
      .03, travel, true, undefined, undefined, bike.collider,
    )
    const distance = blocker ? Math.max(0, blocker.time_of_impact - .48) : travel
    if (distance <= bestDistance) continue
    const x = position.x + path.x * distance
    const z = position.z + path.z * distance
    const ground = world.castRay(new RAPIER.Ray({ x, y: 2.2, z }, { x: 0, y: -1, z: 0 }),
      2.45, true, RAPIER.QueryFilterFlags.ONLY_FIXED)
    if (!ground) continue
    direction = path
    landing.set(x, 2.2 - ground.timeOfImpact + .03, z)
    bestDistance = distance
  }

  const side = Math.sign(direction.x * Math.cos(bike.yaw) - direction.z * Math.sin(bike.yaw)) || 1
  const rider = bike.model.ejectRider(-side)
  if (!rider) return null
  const origin = rider.position.clone()
  const initialRotation = rider.quaternion.clone()
  const targetRotation = new THREE.Quaternion()
  const tumbleYaw = Math.atan2(-direction.x, -direction.z) + side * .72
  const fallTime = .31 + Math.min(closing / 100, .18)
  const slideTime = fallTime + .28
  const standTime = slideTime + .44
  const duration = standTime + .48
  let age = 0
  scene.add(rider)

  return {
    landing,
    position: rider.position,
    get steppingUp() { return age >= standTime },
    step(dt: number) {
      const t = age = Math.min(duration, age + dt)
      const travelProgress = 1 - (1 - Math.min(1, t / slideTime)) ** 2
      const fall = THREE.MathUtils.smoothstep(t, 0, fallTime)
      const rise = THREE.MathUtils.smoothstep(t, standTime, duration)
      rider.position.lerpVectors(origin, landing, travelProgress)
      rider.position.y = THREE.MathUtils.lerp(origin.y, landing.y + .25, fall) +
        Math.sin(fall * Math.PI) * Math.min(.65, closing * .033) + .55 * rise
      roll.set(-1.47 * (1 - rise), tumbleYaw, -.30 * side * (1 - rise), 'YXZ')
      targetRotation.setFromEuler(roll)
      rider.quaternion.slerpQuaternions(initialRotation, targetRotation, fall)
      return t >= duration
    },
    remove() { rider.removeFromParent() },
  }
}
