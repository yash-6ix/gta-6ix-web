import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { box, cylinder, ellipsoid, matte } from './graphics'
import { part } from './fleet-styles'
import { motorcycleHandling } from './driving'

export type MotorcycleStyle = keyof typeof motorcycleHandling
type Rider = 'player' | 'traffic' | null
const frontAxle = -.738
const rearAxle = .742
const wheelbase = rearAxle - frontAxle
const radius = .319
const wheelY = .316
const groundUp = new THREE.Vector3(0, 1, 0)
const rubber = matte('#1c1d21')
const graphite = matte('#222a2f')
const seatMaterial = matte('#24202a')
const riderPants = matte('#2f3946')
const helmetMaterial = new THREE.MeshPhysicalMaterial({ color: '#d3d3cc', roughness: .24, metalness: .35, clearcoat: .96 })
const visor = new THREE.MeshPhysicalMaterial({ color: '#2d4158', roughness: .15, metalness: .76, clearcoat: .8 })
const alloy = new THREE.MeshStandardMaterial({ color: '#a2adbb', metalness: .84, roughness: .27 })
const trim = new THREE.MeshStandardMaterial({ color: '#3b454e', metalness: .66, roughness: .47 })
const trackRubber = new THREE.LatheGeometry([
  new THREE.Vector2(.23, -.082), new THREE.Vector2(.28, -.079), new THREE.Vector2(.306, -.057),
  new THREE.Vector2(radius, -.028), new THREE.Vector2(radius, .029), new THREE.Vector2(.305, .059),
  new THREE.Vector2(.279, .079), new THREE.Vector2(.23, .082),
], 32).rotateZ(Math.PI / 2)
const spokeRim = mergeGeometries([
  new THREE.CylinderGeometry(.241, .241, .085, 24, 1, true).rotateZ(Math.PI / 2),
  new THREE.CylinderGeometry(.063, .063, .19, 18).rotateZ(Math.PI / 2),
  ...Array.from({ length: 5 }, (_, i) => new THREE.BoxGeometry(.044, .199, .035)
    .translate(0, .143, 0).rotateX(i * Math.PI * 2 / 5)),
])!
const disc = new THREE.RingGeometry(.079, .203, 28).rotateY(Math.PI / 2)
const soilShadow = new THREE.MeshBasicMaterial({ color: '#101017', opacity: .24, transparent: true, depthWrite: false })
const shadowGeometry = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2)

function limb(mesh: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  const axis = new THREE.Vector3().subVectors(to, from)
  mesh.position.copy(from).lerp(to, .5)
  mesh.scale.y = axis.length() * 1.08
  mesh.quaternion.setFromUnitVectors(groundUp, axis.normalize())
}

function link(parent: THREE.Object3D, material: THREE.Material, radius: number, from: THREE.Vector3Tuple, to: THREE.Vector3Tuple, shadow = true) {
  const tube = cylinder(parent, material, 0, 0, 0, radius, 1, shadow)
  limb(tube, new THREE.Vector3(...from), new THREE.Vector3(...to))
  return tube
}

function makeRider(parent: THREE.Group, sport: boolean) {
  const group = new THREE.Group()
  parent.add(group)
  const jacket = new THREE.MeshStandardMaterial({ color: '#687d91', roughness: .77 })
  const chestY = sport ? 1.183 : 1.311
  const chestZ = sport ? -.12 : .035
  ellipsoid(group, riderPants, 0, .853, .229, .193, .145, .162)
  const torso = ellipsoid(group, jacket, 0, chestY - .116, (chestZ + .206) * .5, .239, .276, .146)
  torso.rotation.x = sport ? -.60 : -.29
  const backpack = part(group, seatMaterial, 0, chestY - .055, chestZ + .253, .261, .305, .111, .045)
  backpack.rotation.x = torso.rotation.x
  const headZ = sport ? -.206 : -.055
  ellipsoid(group, helmetMaterial, 0, chestY + .232, headZ, .145, .155, .155)
  const face = part(group, visor, 0, chestY + .236, headZ - .109, .251, .095, .1, .044)
  face.rotation.x = -.12
  part(group, helmetMaterial, 0, chestY + .158, headZ - .105, .221, .048, .099, .022)

  const arms = [-1, 1].map(side => {
    const shoulder = new THREE.Vector3(side * .199, chestY, chestZ)
    const elbow = new THREE.Vector3(side * .285, chestY - .152, chestZ - .068)
    ellipsoid(group, jacket, ...shoulder.toArray(), .081, .086, .084)
    link(group, jacket, .063, shoulder.toArray(), elbow.toArray())
    ellipsoid(group, jacket, ...elbow.toArray(), .064, .062, .066)
    const forearm = cylinder(group, jacket, 0, 0, 0, .049, 1)
    const glove = ellipsoid(group, graphite, 0, 0, 0, .051, .046, .062)
    return { side, elbow, forearm, glove }
  })
  const legs = [-1, 1].map(side => {
    const knee = new THREE.Vector3(side * .215, .614, -.034)
    link(group, riderPants, .089, [side * .109, .86, .214], knee.toArray())
    ellipsoid(group, riderPants, ...knee.toArray(), .076, .081, .072)
    const calf = cylinder(group, riderPants, 0, 0, 0, .055, 1)
    const boot = part(group, graphite, 0, 0, 0, .114, .102, .201, .036)
    return { side, knee, calf, boot }
  })
  const end = new THREE.Vector3()
  function pose(yaw: number, speed: number) {
    const sy = Math.sin(yaw)
    const cy = Math.cos(yaw)
    const barZ = sport ? .17 : .21
    for (const { side, elbow, forearm, glove } of arms) {
      const x = side * (sport ? .309 : .36)
      end.set(x * cy + barZ * sy, sport ? .95 : 1.024, frontAxle + barZ * cy - x * sy)
      limb(forearm, elbow, end)
      glove.position.copy(end)
    }
    const stop = 1 - THREE.MathUtils.smoothstep(Math.abs(speed), .45, 2.8)
    for (const { side, knee, calf, boot } of legs) {
      const footDown = side < 0 ? stop : 0
      end.set(side * (.206 + footDown * .16), .471 - footDown * .35, .315 - footDown * .12)
      limb(calf, knee, end)
      boot.position.set(end.x, end.y - .03, end.z - .056)
    }
  }

  return {
    group,
    pose,
    show(value: Rider) {
      group.visible = value !== null
      jacket.color.set(value === 'player' ? '#9a694d' : '#566c82')
      backpack.visible = value === 'player'
    },
  }
}

export function makeMotorcycle(color: string, style: MotorcycleStyle, rider: Rider = null) {
  const sport = style === 'sportBike'
  const group = new THREE.Group()
  const lean = new THREE.Group()
  group.add(lean)
  const shadow = new THREE.Mesh(shadowGeometry, soilShadow)
  shadow.position.y = .009
  shadow.scale.set(.32, 1, .99)
  group.add(shadow)
  const paint = new THREE.MeshPhysicalMaterial({
    color, metalness: .47, roughness: .25, clearcoat: 1, clearcoatRoughness: .13, envMapIntensity: 1.34,
  })
  const cleanColor = paint.color.clone()
  const head = new THREE.MeshPhysicalMaterial({ color: '#dcedfc', emissive: '#c4dcff', emissiveIntensity: 2.8, roughness: .19 })
  const tail = new THREE.MeshStandardMaterial({ color: '#b02a3b', emissive: '#ff2744', emissiveIntensity: 1.3, roughness: .34 })
  const details = new THREE.Group()
  lean.add(details)
  const headlampHeight = sport ? .812 : .895
  const widths = { halfWidth: sport ? .36 : .425, halfLength: 1.072 }

  const engine = part(lean, trim, 0, .525, .095, .377, .331, .497, .065)
  part(lean, alloy, 0, .648, .007, .353, .146, .365, .04).rotation.x = -.24
  part(lean, graphite, 0, .475, -.114, .285, .133, .298, .052)
  for (const side of [-1, 1]) {
    link(lean, alloy, .033, [side * .147, .385, rearAxle], [side * .155, .476, -.013])
    link(lean, sport ? graphite : paint, .034, [side * .161, .458, -.101], [side * .105, .858, -.489])
    link(lean, sport ? graphite : paint, .029, [side * .158, .473, .001], [side * .135, .755, .43])
    for (let i = 0; i < 5; i++) part(details, alloy, side * .184, .508 + i * .033, .027, .034, .014, .256, .005)
    part(lean, graphite, side * .23, .44, .317, .107, .038, .069, .011)
  }
  const tank = part(lean, paint, 0, sport ? .801 : .811, -.155, .409, .279, .546, .129)
  tank.rotation.x = -.07
  part(details, trim, 0, .945, -.11, .103, .026, .103, .012)
  part(lean, paint, 0, .76, .487, sport ? .39 : .318, .158, .452, .056).rotation.x = .11
  part(lean, seatMaterial, 0, .827, .261, .321, .106, .449, .034).rotation.x = -.084
  part(lean, seatMaterial, 0, .863, .565, .247, .066, .183, .023).rotation.x = .13
  part(lean, tail, 0, .785, .718, .239, .046, .034, .012)
  part(details, graphite, 0, .682, .773, .22, .143, .042, .014)
  part(details, matte('#dedbd1'), 0, .677, .798, .165, .077, .014, .008)
  const exhaust = link(lean, alloy, sport ? .067 : .082, [.246, .397, .289], [.235, sport ? .52 : .463, .74])
  const cap = ellipsoid(details, graphite, exhaust.position.x, sport ? .527 : .465, .751, .054, .045, .02)
  cap.rotation.x = .19

  if (sport) {
    part(lean, paint, 0, .795, -.551, .473, .258, .415, .102).rotation.x = .19
    const windscreen = part(lean, visor, 0, 1.028, -.488, .298, .252, .07, .031)
    windscreen.rotation.x = -.67
    for (const side of [-1, 1]) {
      const fairing = part(lean, paint, side * .208, .623, -.309, .124, .293, .492, .044)
      fairing.rotation.x = .31
      fairing.rotation.y = side * .095
      part(details, graphite, side * .268, .632, -.286, .018, .062, .19, .009).rotation.x = .22
      const lens = part(lean, head, side * .115, headlampHeight, -.741, .17, .048, .031, .014)
      lens.rotation.z = side * .21
      link(details, graphite, .017, [side * .163, .929, -.472], [side * .316, 1.064, -.458], false)
      part(details, graphite, side * .342, 1.074, -.47, .103, .069, .053, .018)
    }
  } else {
    const shell = cylinder(lean, graphite, 0, headlampHeight, -.716, .139, .106)
    shell.rotation.x = Math.PI / 2
    const lens = cylinder(lean, head, 0, headlampHeight, -.774, .112, .028)
    lens.rotation.x = Math.PI / 2
    for (const side of [-1, 1]) {
      link(details, trim, .013, [side * .298, .995, -.474], [side * .379, 1.149, -.436], false)
      ellipsoid(details, graphite, side * .388, 1.154, -.435, .083, .045, .04, false)
    }
  }

  const wheels = [frontAxle, rearAxle].map((z, index) => {
    const pivot = new THREE.Group()
    pivot.position.z = z
    lean.add(pivot)
    const wheel = new THREE.Group()
    wheel.position.y = wheelY
    pivot.add(wheel)
    const tire = new THREE.Mesh(trackRubber, rubber)
    tire.castShadow = tire.receiveShadow = true
    const rim = new THREE.Mesh(spokeRim, alloy)
    wheel.add(tire, rim)
    const rotor = new THREE.Mesh(disc, alloy)
    rotor.material = new THREE.MeshStandardMaterial({ color: '#767b8c', metalness: .84, roughness: .34, side: THREE.DoubleSide })
    rotor.position.x = index ? -.074 : .077
    wheel.add(rotor)
    if (index === 0) {
      for (const side of [-1, 1]) {
        link(pivot, alloy, .027, [side * .116, wheelY, 0], [side * .109, .898, .21])
        part(pivot, graphite, side * .116, .412, .015, .071, .112, .083, .024)
      }
      part(pivot, paint, 0, .631, -.019, .192, .074, .385, .032).rotation.x = -.065
      const zGrip = sport ? .17 : .21
      const yGrip = sport ? .95 : 1.024
      link(pivot, alloy, .025, [sport ? -.309 : -.36, yGrip, zGrip], [sport ? .309 : .36, yGrip, zGrip])
      for (const side of [-1, 1]) part(pivot, graphite, side * (sport ? .311 : .362), yGrip, zGrip, .112, .043, .046, .016)
    }
    return { pivot, wheel, rotor }
  })

  const stand = link(lean, alloy, .023, [-.146, .37, .096], [-.313, .087, .179])
  const person = makeRider(lean, sport)
  let seated: Rider = rider
  let knockedSide = 0
  let condition = 1
  let braking = false
  let brokenFront = false
  let brokenTail = false
  function lights() {
    head.emissiveIntensity = brokenFront ? .04 : 2.8
    tail.emissiveIntensity = brokenTail ? .05 : braking ? 4.8 : 1.3
  }
  function setRider(next: Rider) {
    seated = next
    person.show(next)
    person.pose(0, 0)
    if (next) knockedSide = 0
    stand.visible = !next && !knockedSide
    if (!knockedSide) {
      lean.position.y = 0
      lean.rotation.z = next ? 0 : .19
    }
  }
  setRider(rider)

  return {
    kind: 'motorcycle' as const,
    group,
    dimensions: widths,
    wheelbase,
    rearWheelOffset: { x: 0, z: rearAxle },
    headlampHeight,
    handling: motorcycleHandling[style],
    doorOffset: .224,
    enginePitch: sport ? 1.78 : 1.47,
    get condition() { return condition },
    setRider,
    ejectRider(side: number) {
      if (!seated) return null
      const thrown = new THREE.Group()
      const hips = new THREE.Vector3(0, .86, .20)
      const figure = person.group.clone(true)
      figure.position.copy(hips).negate()
      thrown.add(figure)
      thrown.position.copy(lean.localToWorld(hips))
      lean.getWorldQuaternion(thrown.quaternion)
      knockedSide = side
      setRider(null)
      return thrown
    },
    setDetail(value: boolean) {
      details.visible = value
      for (const { rotor } of wheels) rotor.visible = value
    },
    headlamp(_side: number) { return Number(!brokenFront) },
    setBraking(value: boolean) { braking = value; lights() },
    repair() {
      condition = 1
      knockedSide = 0
      setRider(seated)
      paint.color.copy(cleanColor)
      paint.roughness = .25
      tank.rotation.x = -.07
      engine.rotation.z = 0
      brokenFront = brokenTail = false
      lights()
    },
    damage(point: THREE.Vector3, inward: THREE.Vector3, severity: number) {
      condition = Math.max(0, condition - severity * .47)
      paint.color.copy(cleanColor).multiplyScalar(.70 + condition * .30)
      paint.roughness = .25 + (1 - condition) * .22
      engine.rotation.z = THREE.MathUtils.clamp(engine.rotation.z + inward.x * severity * .19, -.19, .19)
      if (severity > .42 && point.z < -.52) brokenFront = true
      if (severity > .42 && point.z > .52) brokenTail = true
      lights()
    },
    spin(dt: number, speed: number, steering: number, _slip = 0, turn = 0, wheelAngle = steering * .38) {
      const metres = speed * dt
      const frontTravel = Math.sign(speed) * Math.hypot(metres, turn * wheelbase)
      wheels[0].wheel.rotation.x = (wheels[0].wheel.rotation.x - frontTravel / radius) % (Math.PI * 2)
      wheels[1].wheel.rotation.x = (wheels[1].wheel.rotation.x - metres / radius) % (Math.PI * 2)
      wheels[0].pivot.rotation.y = wheelAngle
      const cornering = Math.atan(turn / dt * Math.max(0, speed) / 9.81)
      const target = knockedSide ? knockedSide * 1.37 : seated
        ? THREE.MathUtils.clamp(cornering, -.67, .67) + (Math.abs(speed) < .55 ? .052 : 0) : .19
      lean.rotation.z = THREE.MathUtils.damp(lean.rotation.z, target, knockedSide ? 8.5 : 7.4, dt)
      lean.position.y = THREE.MathUtils.smoothstep(Math.abs(lean.rotation.z), .7, 1.37) * .22
      if (seated) person.pose(wheelAngle, speed)
    },
  }
}
