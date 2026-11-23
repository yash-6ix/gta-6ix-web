import { MathUtils, Vector3 } from 'three'
import type { TrafficBody } from './fleet-styles'

interface DriverInputs {
  throttle: number
  turn: number
  handbrake: boolean
}

// Speed in m/s, acceleration in m/s², and effective collision mass in kg.
export type DriveTuning = {
  topSpeed: number; acceleration: number; steering: number; grip: number; mass: number
  highSpeedYawRate: number; reverseSpeed?: number; handbrakeDrift?: boolean
}

function tune(topSpeed: number, acceleration: number, steering: number, grip: number, mass: number, highSpeedYawRate = 1.45 * steering * Math.sqrt(grip)): DriveTuning {
  return { topSpeed, acceleration, steering, grip, mass, highSpeedYawRate }
}

export const handling = {
  dispatch: tune(36, 14.7, 1.19, 1.08, 1480),
  sedan: tune(25, 10.9, 1, 1, 1530),
  wagon: tune(23.5, 9.7, .95, 1.03, 1640),
  hatchback: tune(24.2, 11.1, 1.24, 1.17, 1210),
  suv: tune(23, 8.8, .88, 1.03, 2120),
  van: tune(19.5, 7.7, .79, .93, 2300),
  coupe: tune(32, 13.6, 1.13, 1.08, 1390),
  taxi: tune(24, 10.1, .96, .97, 1610),
  pickup: tune(23, 8.9, .83, .82, 2210),
  convertible: tune(28.5, 12.2, 1.18, 1.08, 1320),
  classic: tune(29, 11.7, .88, .79, 1760),
  executive: tune(30, 10.5, .92, .96, 1690),
  electric: tune(31, 15.3, 1.04, 1.20, 1990),
  boxTruck: tune(16.5, 6.1, .67, .90, 3620),
  track: tune(43, 17.3, 1.24, 1.26, 1330),
  wedge: tune(41, 16.4, 1.31, 1.09, 1240),
  wideGT: tune(39, 15.5, 1.06, 1.16, 1740),
} satisfies Record<TrafficBody | 'dispatch', DriveTuning>

export const motorcycleHandling: Record<'sportBike' | 'streetBike', DriveTuning> = {
  sportBike: { ...tune(47, 17.2, .95, 1.16, 258, 0), reverseSpeed: 2.1, handbrakeDrift: false },
  streetBike: { ...tune(34.5, 13.2, 1.11, 1.12, 286, 0), reverseSpeed: 2.3, handbrakeDrift: false },
}

export function makeDrivetrain() {
  const velocity = new Vector3()
  const forward = new Vector3()
  const right = new Vector3()
  let steering = 0
  let wheelAngle = 0
  let signedSpeed = 0
  let lateralSpeed = 0
  let drifting = false

  function project(yaw: number) {
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw))
    right.set(Math.cos(yaw), 0, -Math.sin(yaw))
    signedSpeed = velocity.dot(forward)
    lateralSpeed = velocity.dot(right)
  }

  const centreDelta = new Vector3()
  function plan(dt: number, yaw: number, nextYaw: number, rearAxle: number, velocityYaw = nextYaw) {
    const halfTurn = (nextYaw - yaw) * .5
    const chord = Math.abs(halfTurn) < 1e-5 ? 1 : Math.sin(halfTurn) / halfTurn
    // Integrate the rear axle along the turn, then reconstruct the body's centre.
    centreDelta.copy(velocity).applyAxisAngle(up, nextYaw - velocityYaw - halfTurn).multiplyScalar(dt * chord)
    centreDelta.x += rearAxle * (Math.sin(yaw) - Math.sin(nextYaw))
    centreDelta.z += rearAxle * (Math.cos(yaw) - Math.cos(nextYaw))
    return centreDelta
  }

  return {
    velocity,
    get speed() { return velocity.length() },
    get forwardSpeed() { return signedSpeed },
    get slip() { return lateralSpeed },
    get steering() { return steering },
    get wheelAngle() { return wheelAngle },
    get drifting() { return drifting },
    reset() {
      velocity.set(0, 0, 0)
      signedSpeed = steering = lateralSpeed = wheelAngle = 0
      drifting = false
    },
    advance(dt: number, yaw: number, { throttle, turn, handbrake }: DriverInputs, condition: number, car: DriveTuning = handling.sedan, wheelbase = 2.56) {
      project(yaw)
      steering = MathUtils.damp(steering, turn, 10.5 * car.steering, dt)
      const gripLost = car.handbrakeDrift !== false && handbrake && Math.abs(steering) > .17 && Math.abs(signedSpeed) > (drifting ? 2.9 : 4.6)
      const engine = MathUtils.lerp(0.49, 1, condition)
      const brakes = MathUtils.clamp(25 * car.grip * (1530 / car.mass) ** .27, 16, 31)
      const brakeRate = gripLost ? 4.3 * car.grip : handbrake ? brakes : 0
      const slowing = throttle * signedSpeed < 0
      const power = (slowing ? brakes : throttle > 0 ? car.acceleration : car.acceleration * .67) * engine
      const drag = 1.2 + Math.abs(signedSpeed) * 0.15
      if (brakeRate && !gripLost) {
        signedSpeed = Math.sign(signedSpeed) * Math.max(0, Math.abs(signedSpeed) - brakeRate * dt)
      } else {
        signedSpeed += throttle * power * dt * (gripLost ? 0.52 : 1)
        const loss = (drag + brakeRate) * dt * (throttle && !gripLost ? 0.38 : 1)
        signedSpeed = Math.sign(signedSpeed) * Math.max(0, Math.abs(signedSpeed) - loss)
      }
      signedSpeed = MathUtils.clamp(signedSpeed, -(car.reverseSpeed ?? Math.min(8.5, car.topSpeed * .42)) * engine, car.topSpeed * MathUtils.lerp(0.59, 1, condition))
      velocity.copy(forward).multiplyScalar(signedSpeed).addScaledVector(right, lateralSpeed)
      const speed = Math.abs(signedSpeed)
      const lowSpeedLock = .59 * car.steering / (1 + (speed / 10.1) ** 2 * .68)
      const highwayLock = Math.atan(wheelbase * car.highSpeedYawRate / Math.max(speed, 1))
      const lock = MathUtils.lerp(lowSpeedLock, Math.max(lowSpeedLock, highwayLock), MathUtils.smoothstep(speed, 8, 24))
      wheelAngle = MathUtils.clamp(steering * lock, -.72, .72)
      const yawRate = gripLost ? steering * Math.min(1, speed / 4.1) * 2.42 * car.steering * Math.sign(signedSpeed)
        : signedSpeed * Math.tan(wheelAngle) / wheelbase
      const nextYaw = yaw + yawRate * dt
      if (gripLost) project(nextYaw)
      else {
        forward.set(-Math.sin(nextYaw), 0, -Math.cos(nextYaw))
        right.set(Math.cos(nextYaw), 0, -Math.sin(nextYaw))
      }
      lateralSpeed *= Math.exp(-dt * (gripLost ? .98 : 13) * car.grip)
      velocity.copy(forward).multiplyScalar(signedSpeed).addScaledVector(right, lateralSpeed)
      drifting = gripLost && (Math.abs(lateralSpeed) > 1.18 || Math.abs(steering) > 0.62)
      return nextYaw
    },
    plan,
    resolve(yaw: number, nextYaw: number, actualX: number, actualZ: number, dt: number, rearAxle: number) {
      const expected = plan(dt, yaw, nextYaw, rearAxle)
      const x = actualX - rearAxle * (Math.sin(yaw) - Math.sin(nextYaw))
      const z = actualZ - rearAxle * (Math.cos(yaw) - Math.cos(nextYaw))
      const middle = (yaw + nextYaw) * .5
      const sin = Math.sin(middle)
      const cos = Math.cos(middle)
      const measuredForward = -(x * sin + z * cos) / dt
      project(nextYaw)
      if (Math.hypot(expected.x - actualX, expected.z - actualZ) <= .001) return measuredForward

      // A contact can reduce tyre motion. A correction from the collider is
      // not drive velocity and should not kick the vehicle sideways or back.
      signedSpeed = MathUtils.clamp(measuredForward, Math.min(0, signedSpeed), Math.max(0, signedSpeed))
      lateralSpeed = MathUtils.clamp((x * cos - z * sin) / dt, Math.min(0, lateralSpeed), Math.max(0, lateralSpeed))
      velocity.copy(forward).multiplyScalar(signedSpeed).addScaledVector(right, lateralSpeed)
      return signedSpeed
    },
  }
}

const up = new Vector3(0, 1, 0)
