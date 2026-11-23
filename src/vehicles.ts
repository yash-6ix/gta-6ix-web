import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { box, canvasTexture, matte, randomize } from './graphics'
import { handling } from './driving'
import { accentRoof, addFleetTrim, addTrafficLamps, fleetDesigns, isPerformanceCar, lampStyle, part, type NewTrafficBody, type Station, type TrafficBody } from './fleet-styles'

export type { TrafficBody } from './fleet-styles'

const bodyStations: readonly Station[] = [
  [-2.1, .71, .34, .66, .82], [-2.01, .83, .31, .74, .88], [-1.71, .895, .29, .78, .925],
  [-1.27, .932, .29, .86, .99], [-.76, .908, .294, .95, 1.073], [-.18, .912, .28, .961, 1.061],
  [.62, .925, .28, .93, 1.042], [1.32, .941, .29, .93, 1.073],
  [1.9, .887, .32, .89, 1.06], [2.055, .81, .355, .81, .985], [2.105, .737, .399, .73, .904],
]
const glassStations: readonly Station[] = [
  [-.91,.67,1.01,1.047,1.091],[-.65,.766,1.016,1.138,1.261],[-.34,.768,1.012,1.309,1.459],
  [-.01,.751,1.007,1.38,1.534],[.60,.758,.998,1.40,1.557],[.99,.754,1.04,1.353,1.495],
  [1.31,.715,1.075,1.199,1.302],[1.58,.64,1.067,1.101,1.166],
]
const roofStations: readonly Station[] = [
  [-.36,.507,1.408,1.448,1.469],[-.06,.604,1.464,1.502,1.545],[.38,.618,1.483,1.523,1.571],
  [.71,.599,1.482,1.518,1.554],[1.03,.535,1.415,1.451,1.495],
]
const sportsBodyStations: readonly Station[] = [
  [-2.10,.84,.28,.57,.655], [-2.00,.92,.265,.62,.70], [-1.70,.96,.26,.72,.767],
  [-1.28,.976,.26,.82,.81], [-.88,.928,.257,.79,.822], [-.49,.893,.252,.73,.857],
  [.05,.89,.245,.721,.852], [.44,.911,.247,.765,.856], [.85,.955,.25,.833,.903],
  [1.27,.984,.26,.868,.95], [1.65,.971,.271,.872,.959], [1.95,.932,.31,.852,.911], [2.10,.868,.355,.735,.844],
]
const sportsGlassStations: readonly Station[] = [
  [-.86,.656,.796,.818,.833], [-.66,.702,.799,.87,.925], [-.41,.721,.806,.98,1.10],
  [-.16,.713,.813,1.11,1.245], [.13,.685,.822,1.16,1.303], [.54,.666,.84,1.16,1.308],
  [.78,.646,.86,1.10,1.245], [1.1,.605,.88,.99,1.11], [1.51,.519,.90,.915,.961],
]
const sportsRoofStations: readonly Station[] = [
  [-.29,.419,1.12,1.14,1.157], [-.14,.483,1.206,1.217,1.255], [.09,.536,1.238,1.267,1.316],
  [.44,.551,1.244,1.28,1.325], [.67,.532,1.214,1.24,1.28], [.86,.494,1.151,1.18,1.197],
]
const tireGeometry = new THREE.CylinderGeometry(.348, .348, .218, 32)
const sidewallGeometry = new THREE.TorusGeometry(.305, .031, 8, 32)
const brakeGeometry = new THREE.CylinderGeometry(.186, .186, .028, 24)
const dark = new THREE.MeshStandardMaterial({ color: '#161c21', roughness: .62 })
const rubber = new THREE.MeshStandardMaterial({ color: '#141515', roughness: .96 })
const metal = new THREE.MeshStandardMaterial({ color: '#aebbc1', metalness: .89, roughness: .31 })
const rotor = new THREE.MeshStandardMaterial({ color: '#653a2f', metalness: .63, roughness: .61 })
const glass = new THREE.MeshPhysicalMaterial({ color: '#354552', metalness: .46, roughness: .16, clearcoat: 1, clearcoatRoughness: .13, envMapIntensity: 1.38 })
const treadAccent = new THREE.MeshStandardMaterial({ color: '#d8d5c9', roughness: .61, metalness: .27 })
const carbon = new THREE.MeshPhysicalMaterial({ color: '#1c1727', metalness: .64, roughness: .33, clearcoat: .62, side: THREE.DoubleSide })
const intake = new THREE.MeshStandardMaterial({ color: '#100e16', roughness: .91, side: THREE.DoubleSide })
const aeroAccent = new THREE.MeshStandardMaterial({ color: '#a298bc', metalness: .78, roughness: .31, side: THREE.DoubleSide })
const sportAlloy = new THREE.MeshStandardMaterial({ color: '#a09aab', metalness: .76, roughness: .27 })
const orangeCaliper = new THREE.MeshStandardMaterial({ color: '#f25e31', metalness: .28, roughness: .37 })
const rimShapes = [-1, 1].map(side => {
  const ring = new THREE.TorusGeometry(.207, .017, 8, 24).rotateY(Math.PI / 2).translate(side * .124, 0, 0)
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const angle = i * Math.PI * 2 / 5
    return new THREE.BoxGeometry(.025, .17, i === 0 ? .056 : .039)
      .rotateX(angle + .08).translate(side * .12, Math.cos(angle) * .107, Math.sin(angle) * .107)
  })
  return mergeGeometries([ring, ...spokes])!
})
const sportsRims = [-1, 1].map(side => {
  const ring = new THREE.TorusGeometry(.251, .014, 8, 40).rotateY(Math.PI / 2).translate(side * .13, 0, 0)
  const centre = new THREE.CylinderGeometry(.065, .077, .052, 18).rotateZ(Math.PI / 2).translate(side * .116, 0, 0)
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const angle = i * Math.PI * 2 / 5
    return [-1, 1].map(split => new THREE.BoxGeometry(.026, .194, .025)
      .rotateX(split * .18).translate(side * .124, .149, split * .030).rotateX(angle))
  }).flat()
  return mergeGeometries([ring, centre, ...spokes])!
})
const sportsTire = new THREE.CylinderGeometry(.348, .348, .239, 36)
const sportsSidewall = new THREE.TorusGeometry(.304, .035, 8, 36)
const sportsBrake = new THREE.CylinderGeometry(.215, .215, .027, 30)
const exhaustRim = new THREE.TorusGeometry(.043, .009, 7, 16)
const commercialRims = [-1, 1].map(side => new THREE.CylinderGeometry(.197, .214, .04, 20)
  .rotateZ(Math.PI / 2).translate(side * .109, 0, 0))
const whitewallGeometry = new THREE.TorusGeometry(.287, .023, 8, 32)
const executiveRims = [-1, 1].map(side =>
  new THREE.CylinderGeometry(.216, .232, .034, 36).rotateZ(Math.PI / 2).translate(side * .118, 0, 0))
const executiveSlots = [-1, 1].map(side => mergeGeometries(Array.from({ length: 15 }, (_, index) =>
  new THREE.BoxGeometry(.004, .032, .017).translate(side * .138, .174, 0).rotateX(index * Math.PI * 2 / 15),
))!)
const whitewall = matte('#dfd9c9')
const distantWheels = mergeGeometries([-1, 1].flatMap(side => [-1.28, 1.28].map(axle =>
  new THREE.CylinderGeometry(.346, .346, .224, 12).rotateZ(Math.PI / 2).translate(side * .844, .344, axle),
)))!
const paintWearRandom = randomize(91381)

const rimProfile = [
  [-.72,0],[-.94,.09],[-.992,.28],[-1,.57],[-.97,.82],[-.91,.94],[-.76,1],
  [-.48,1.035],[-.24,1.048],[0,1.052],[.24,1.048],[.48,1.035],[.76,1],
  [.91,.94],[.97,.82],[1,.57],[.992,.28],[.94,.09],[.72,0],[.21,-.04],[-.21,-.04],[-.72,0],
] as const
const hoodProfile = rimProfile.slice(9, 13)

function coachwork(stations: readonly Station[], wheelOpenings = false, roofLift = 0, density = 1) {
  const position: number[] = []
  const uv: number[] = []
  const indices: number[] = []
  const sections = Math.round((stations.length - 1) * (wheelOpenings ? 8 : 6) * density)
  const profileCount = rimProfile.length
  for (let section = 0; section <= sections; section++) {
    const location = section / sections * (stations.length - 1)
    const index = Math.min(Math.floor(location), stations.length - 2)
    const mix = location - index
    const a = stations[index]
    const b = stations[index + 1]
    const cell = (column: number) => THREE.MathUtils.lerp(a[column], b[column], mix)
    const z = cell(0)
    const width = cell(1)
    const bottom = cell(2)
    const shoulder = cell(3)
    const top = cell(4)
    const axleDistance = Math.min(Math.abs(z + 1.28), Math.abs(z - 1.28))
    const arch = wheelOpenings && axleDistance < .44 ? .35 + Math.sqrt(.44 ** 2 - axleDistance ** 2) : bottom
    for (const [point, [side, height]] of rimProfile.entries()) {
      const roundY = THREE.MathUtils.lerp(bottom, shoulder, Math.min(height * 1.35, 1))
      let y = roundY + (top - shoulder + roofLift) * Math.max(0, (height - .70) / .352)
      if (wheelOpenings && Math.abs(side) > .85 && height < .81) {
        y = Math.max(y, THREE.MathUtils.lerp(arch, shoulder, Math.max(0, (height - .28) / .61)))
      }
      position.push(side * width, y, z)
      uv.push(point / (profileCount - 1), section / sections)
    }
  }
  for (let section = 0; section < sections; section++) {
    for (let ring = 0; ring < profileCount - 1; ring++) {
      const a = section * profileCount + ring
      const b = a + profileCount
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  for (let i = 1; i < profileCount - 2; i++) {
    indices.push(0, i, i + 1)
    indices.push(sections * profileCount, sections * profileCount + i + 1, sections * profileCount + i)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

const chassis = coachwork(bodyStations, true)
const distantChassis = coachwork(bodyStations, true, 0, .39)
const sedanGlass = coachwork(glassStations)
const touringGlass = coachwork(glassStations, false, .115)
const sedanRoof = coachwork(roofStations)
const touringRoof = coachwork(roofStations, false, .115)
const sportsChassis = coachwork(sportsBodyStations, true)
const distantSportsChassis = coachwork(sportsBodyStations, true, 0, .39)
const sportsGlass = coachwork(sportsGlassStations)
const sportsRoof = coachwork(sportsRoofStations)
const hatchGlass: readonly Station[] = [
  [-.85,.65,.98,1.02,1.07],[-.41,.76,1.017,1.26,1.41],[-.02,.755,1.032,1.45,1.56],
  [.81,.755,1.034,1.45,1.59],[1.35,.73,1.041,1.374,1.49],[1.79,.69,1.055,1.16,1.25],[1.91,.664,1.054,1.09,1.13],
]
const hatchRoof: readonly Station[] = [
  [-.19,.49,1.41,1.45,1.5],[.08,.596,1.49,1.54,1.59],[.92,.63,1.515,1.558,1.62],[1.29,.594,1.432,1.485,1.553],[1.42,.54,1.39,1.425,1.491],
]
const utilityGlass: readonly Station[] = [
  [-1.09,.68,1.03,1.056,1.105],[-.82,.763,1.065,1.21,1.36],[-.45,.789,1.072,1.463,1.65],
  [-.11,.795,1.084,1.57,1.744],[.82,.802,1.09,1.6,1.767],[1.54,.795,1.101,1.579,1.709],
  [1.86,.755,1.11,1.447,1.563],[1.984,.704,1.113,1.21,1.324],
]
const utilityRoof: readonly Station[] = [
  [-.4,.512,1.572,1.63,1.687],[-.04,.67,1.644,1.716,1.785],[.922,.699,1.667,1.735,1.802],
  [1.56,.672,1.63,1.7,1.753],[1.7,.569,1.562,1.617,1.717],
]
const vanGlass: readonly Station[] = [
  [-1.79,.742,1.08,1.12,1.174],[-1.50,.811,1.13,1.29,1.42],[-1.12,.831,1.144,1.63,1.79],
  [-.81,.839,1.154,1.72,1.905],[-.34,.835,1.164,1.76,1.943],
  [1.53,.833,1.17,1.771,1.955],[1.96,.821,1.17,1.706,1.88],[2.055,.789,1.17,1.228,1.51],
]
const vanRoof: readonly Station[] = [
  [-1.11,.552,1.655,1.714,1.793],[-.76,.753,1.752,1.855,1.926],[-.32,.79,1.8,1.879,1.963],
  [1.64,.79,1.803,1.893,1.975],[1.995,.75,1.721,1.79,1.896],[2.05,.701,1.531,1.65,1.733],
]

function shapedTraffic(cabin: readonly Station[], roof: readonly Station[], lift: number, widthScale: number, sound: number) {
  const body: Station[] = bodyStations.map(([z, width, floor, shoulder, crown]) => [z, width * widthScale, floor, shoulder + lift, crown + lift])
  return { chassis: coachwork(body, true), proxy: coachwork(body, true, 0, .39), glass: coachwork(cabin), roof: coachwork(roof), lift, sound }
}

const stockSedan = { chassis, proxy: distantChassis, glass: sedanGlass, roof: sedanRoof, lift: 0, sound: 1 }
function bespokeTraffic(style: NewTrafficBody) {
  const { body, cabin, roof, lift, sound } = fleetDesigns[style]
  return { chassis: coachwork(body, true), proxy: coachwork(body, true, 0, .39), glass: coachwork(cabin), roof: roof ? coachwork(roof) : undefined, lift, sound }
}

const stockBodies = {
  sedan: stockSedan,
  taxi: stockSedan,
  wagon: { ...stockSedan, glass: touringGlass, roof: touringRoof, sound: .96 },
  hatchback: shapedTraffic(hatchGlass, hatchRoof, -.023, .967, 1.16),
  suv: shapedTraffic(utilityGlass, utilityRoof, .112, 1.025, .86),
  van: shapedTraffic(vanGlass, vanRoof, .173, 1.03, .81),
  coupe: shapedTraffic(sportsGlassStations, sportsRoofStations, -.16, 1.016, 1.07),
  pickup: bespokeTraffic('pickup'),
  convertible: bespokeTraffic('convertible'),
  classic: bespokeTraffic('classic'),
  executive: bespokeTraffic('executive'),
  electric: bespokeTraffic('electric'),
  boxTruck: bespokeTraffic('boxTruck'),
  track: bespokeTraffic('track'),
  wedge: bespokeTraffic('wedge'),
  wideGT: bespokeTraffic('wideGT'),
} satisfies Record<TrafficBody, Omit<typeof stockSedan, 'roof'> & { roof?: THREE.BufferGeometry }>
const windscreen = new THREE.MeshPhysicalMaterial({ color: '#526673', metalness: .19, roughness: .13, clearcoat: .9, transparent: true, opacity: .63, depthWrite: false })
const contactMap = canvasTexture(128, 128, (ctx) => {
  const shade = ctx.createRadialGradient(64, 64, 6, 64, 64, 64)
  shade.addColorStop(0, '#fff')
  shade.addColorStop(.6, '#8b8b8b')
  shade.addColorStop(1, '#000')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, 128, 128)
})
contactMap.colorSpace = THREE.NoColorSpace
const contactGeometry = new THREE.PlaneGeometry(3.1, 5.2)
const contactMaterial = new THREE.MeshBasicMaterial({
  color: '#060713', alphaMap: contactMap, transparent: true, opacity: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
})

function trim(parent: THREE.Group, material: THREE.Material, ...outline: THREE.Vector3Tuple[]) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(outline.flat(), 3))
  geometry.setIndex(outline.slice(2).flatMap((_, i) => [0, i + 1, i + 2]))
  geometry.computeVertexNormals()
  const detail = new THREE.Mesh(geometry, material)
  detail.receiveShadow = true
  parent.add(detail)
}

function hoodHeight(x: number, z: number) {
  const back = sportsBodyStations.findIndex((station) => station[0] > z)
  const [frontZ, frontWidth, , frontShoulder, frontTop] = sportsBodyStations[back - 1]
  const [backZ, backWidth, , backShoulder, backTop] = sportsBodyStations[back]
  const fraction = (z - frontZ) / (backZ - frontZ)
  const width = THREE.MathUtils.lerp(frontWidth, backWidth, fraction)
  const shoulder = THREE.MathUtils.lerp(frontShoulder, backShoulder, fraction)
  const top = THREE.MathUtils.lerp(frontTop, backTop, fraction)
  const lateral = Math.abs(x) / width
  const outside = hoodProfile.findIndex(([side]) => side > lateral)
  const [innerX, innerHeight] = hoodProfile[outside - 1]
  const [outerX, outerHeight] = hoodProfile[outside]
  const height = THREE.MathUtils.lerp(innerHeight, outerHeight, (lateral - innerX) / (outerX - innerX))
  return shoulder + (top - shoulder) * (height - .70) / .352
}

function hoodVent(shell: THREE.Group, side: number) {
  const skin = (x: number, z: number, lift: number): THREE.Vector3Tuple => [side * x, hoodHeight(x, z) + lift, z]
  for (let slat = 0; slat < 3; slat++) {
    const front = -1.52 + slat * .119
    const inner = .295 + slat * .024
    trim(shell, intake, skin(inner, front, .008), skin(.51, front - .025, .008),
      skin(.49, front + .055, .008), skin(inner + .021, front + .048, .008))
    trim(shell, carbon, skin(inner + .005, front + .039, .01), skin(.49, front + .043, .01),
      skin(.488, front + .06, .01), skin(inner + .021, front + .057, .01))
  }
}

function sportsTrim(shell: THREE.Group, paint: THREE.Material) {
  part(shell, intake, 0, .453, -2.102, .79, .207, .043, .022)
  for (const height of [.404, .451, .498]) part(shell, carbon, 0, height, -2.129, .74, .011, .022)
  part(shell, carbon, 0, .286, -1.989, 1.774, .071, .292, .028)
  part(shell, aeroAccent, 0, .281, -2.138, 1.63, .013, .019)

  part(shell, intake, 0, .522, 2.074, 1.634, .236, .079, .048)
  part(shell, carbon, 0, .362, 2.011, 1.627, .064, .294, .025)
  for (const blade of [-.65,-.47,-.29,.29,.47,.65]) part(shell, carbon, blade, .378, 2.063, .03, .104, .178, .012)
  part(shell, carbon, 0, 1.005, 1.979, 1.735, .049, .175, .02)
  part(shell, paint, 0, 1.019, 1.915, 1.7, .029, .069, .013)

  for (const side of [-1, 1]) {
    trim(shell, intake, [side * .444,.366,-2.125], [side * .773,.369,-2.127],
      [side * .839,.52,-2.111], [side * .522,.563,-2.125])
    trim(shell, carbon, [side * .508,.376,-2.142], [side * .548,.376,-2.143],
      [side * .65,.54,-2.125], [side * .619,.543,-2.125])
    hoodVent(shell, side)
    trim(shell, intake, [side * .907,.473,-.10], [side * .925,.476,.641],
      [side * .962,.795,.838], [side * .934,.746,.48])
    trim(shell, carbon, [side * .914,.473,-.12], [side * .929,.451,.642],
      [side * .96,.491,.826], [side * .943,.51,.571])
    const sill = part(shell, carbon, side * .918, .285, -.105, .132, .073, 1.412)
    sill.rotation.y = side * .042
    const mirror = part(shell, paint, side * .777, .94, -.482, .282, .085, .155)
    mirror.rotation.y = side * -.28
    part(shell, carbon, side * .728, .889, -.479, .097, .091, .081)
    part(shell, aeroAccent, side * .921, .76, .107, .013, .022, .153, .006)
    const wingMount = part(shell, carbon, side * .551, .916, 1.934, .051, .155, .12, .013)
    wingMount.rotation.z = side * .17
    for (const offset of [0, .12]) {
      const exhaust = new THREE.Mesh(exhaustRim, aeroAccent)
      exhaust.position.set(side * (.48 + offset), .439, 2.113)
      shell.add(exhaust)
    }
  }
}

export function makeCar(trafficColor?: string, style: TrafficBody | boolean = trafficColor === undefined ? 'executive' : 'sedan') {
  const dispatch = trafficColor === undefined
  const variant = typeof style === 'boolean' ? style ? 'wagon' : 'sedan' : style
  const executive = variant === 'executive'
  const sports = dispatch && !executive
  const performance = isPerformanceCar(variant)
  const performanceWheels = sports || performance
  const touring = variant === 'wagon'
  const trafficBody = stockBodies[variant]
  const scale = (fleetDesigns as Partial<Record<TrafficBody, typeof fleetDesigns[NewTrafficBody]>>)[variant]
  const lengthScale = sports ? 1 : scale?.length ?? 1
  const widthScale = sports ? 1 : scale?.width ?? 1
  const dimensions = { halfWidth: .97 * widthScale, halfLength: 2.1 * lengthScale }
  const rearWheelOffset = { x: .844 * widthScale, z: 1.28 * lengthScale }
  const group = new THREE.Group()
  const shell = new THREE.Group()
  shell.scale.set(widthScale, 1, lengthScale)
  group.add(shell)
  const contact = new THREE.Mesh(contactGeometry, contactMaterial)
  contact.rotation.x = -Math.PI / 2
  contact.position.y = .021
  contact.scale.set(widthScale, lengthScale, 1)
  group.add(contact)

  let paintContext!: CanvasRenderingContext2D
  const paintMap = canvasTexture(256, 512, (ctx) => {
    paintContext = ctx
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 256, 512)
  })
  const paint = new THREE.MeshPhysicalMaterial({
    color: trafficColor ?? (executive ? '#385173' : '#a144da'), map: paintMap, roughness: performanceWheels ? .24 : .29, metalness: performanceWheels ? .57 : .48,
    clearcoat: .94, clearcoatRoughness: .15, envMapIntensity: 1.34,
  })
  const frame = sports ? sportsChassis : trafficBody.chassis
  const panels = frame.clone()
  const baseline = frame.attributes.position
  const body = new THREE.Mesh(panels, paint)
  body.castShadow = body.receiveShadow = true
  shell.add(body)
  const glassGeometry = sports ? sportsGlass : trafficBody.glass
  const glazing = new THREE.Mesh(glassGeometry, variant === 'convertible' ? windscreen : glass)
  glazing.receiveShadow = true
  glazing.castShadow = variant !== 'convertible'
  shell.add(glazing)
  const bodyFinish = new THREE.MeshPhysicalMaterial({
    color: paint.color, roughness: .31, metalness: .45, clearcoat: .92, clearcoatRoughness: .15, envMapIntensity: 1.28,
  })
  const roofGeometry = sports ? sportsRoof : trafficBody.roof
  const roofAccent = accentRoof(variant)
  if (roofGeometry) {
    const roof = new THREE.Mesh(roofGeometry, sports ? carbon : roofAccent ?? bodyFinish)
    roof.castShadow = roof.receiveShadow = true
    shell.add(roof)
  }

  const lampsLook = lampStyle(variant)
  const coolLight = performanceWheels || variant === 'electric'
  const lensColor = coolLight ? '#d9f6ff' : '#dec7a4'
  const lift = sports ? 0 : trafficBody.lift
  const plateHeight = sports ? .551 : .711 + lift
  function addReverseLens(parent: THREE.Group, side: number, material: THREE.Material) {
    const vertical = lampsLook === 'vertical'
    const y = sports ? .671 : executive ? .710 : .714 + lift
    const lens = part(parent, material, side * (vertical ? .771 : executive ? .404 : .337), y,
      vertical || executive ? 2.142 : 2.122, vertical || executive ? .143 : .169, .049, .034, .011)
    lens.name = 'Reverse light'
  }
  const lights = [-1, 1].map((side) => {
    const head = new THREE.MeshPhysicalMaterial({ color: lensColor, emissive: coolLight ? '#a4ddff' : '#ffe9bb', emissiveIntensity: 2.75, roughness: .19, clearcoat: 1 })
    const tail = new THREE.MeshPhysicalMaterial({ color: '#942225', emissive: '#fd1635', emissiveIntensity: 1.4, roughness: .25, clearcoat: .85 })
    const reverse = new THREE.MeshStandardMaterial({ color: '#778794', emissive: '#edf6ff', emissiveIntensity: 0, roughness: .25 })
    if (sports) {
      const lens = part(shell, carbon, side * .646, .61, -2.076, .422, .103, .076)
      lens.rotation.set(0, side * -.24, side * .16)
      const strip = part(shell, head, side * .648, .622, -2.115, .389, .027, .025, .009)
      strip.rotation.copy(lens.rotation)
      const hook = part(shell, head, side * .818, .61, -2.063, .027, .026, .137, .009)
      hook.rotation.set(side * -.035, side * .55, 0)
      part(shell, carbon, side * .413, .772, 2.096, .839, .087, .062)
      part(shell, tail, side * .411, .784, 2.128, .782, .032, .025, .01)
      part(shell, tail, side * .792, .749, 2.125, .03, .091, .026, .01)
    } else {
      addTrafficLamps(shell, lampsLook, side, lift, head, tail, true)
    }
    addReverseLens(shell, side, reverse)
    return { head, tail, reverse, frontBroken: false, rearBroken: false }
  })
  if (sports) {
    sportsTrim(shell, paint)
  } else {
    if (!performance && !executive && variant !== 'electric') {
      part(shell, dark, 0, .571 + lift * .82, -2.098, 1.312, .194, .065)
      for (let i = 0; i < 5; i++) part(shell, metal, 0, .507 + i * .03 + lift * .82, -2.136, 1.171, .009, .019)
    }
    if (!performance && !executive) part(shell, dark, 0, .467, 2.055, 1.585, .165, .107)
    if (!performance && !executive && variant !== 'electric') {
      part(shell, metal, -.60, .405, 2.089, .178, .062, .092)
      part(shell, metal, .60, .405, 2.089, .178, .062, .092)
    }
    addFleetTrim(shell, variant, paint, true)
  }
  part(shell, dark, 0, plateHeight, sports ? 2.105 : 2.088, .417, .145, .048)
  const license = canvasTexture(192, 80, (ctx) => {
    ctx.fillStyle = '#e4e5d8'
    ctx.fillRect(0, 0, 192, 80)
    ctx.strokeStyle = '#304763'
    ctx.strokeRect(4, 4, 184, 72)
    ctx.fillStyle = '#304763'
    ctx.textAlign = 'center'
    ctx.font = '700 13px system-ui'
    ctx.fillText('ONTARIO', 96, 21)
    ctx.font = '800 32px monospace'
    ctx.fillText(dispatch ? '6IX 01' : 'LAKE 18', 96, 56)
  })
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.378, .115), new THREE.MeshStandardMaterial({ map: license, roughness: .68 }))
  plate.position.set(0, plateHeight, sports ? 2.133 : 2.118)
  shell.add(plate)
  const cabShift = variant === 'boxTruck' ? -.57 : variant === 'pickup' ? -.17 : 0
  const openRoof = variant === 'convertible' || variant === 'electric'
  const wheels: Array<{ pivot: THREE.Group; hub: THREE.Group; front: boolean; side: number; roll: number }> = []
  const doors: Array<{ side: number; hinge: THREE.Group }> = []
  for (const side of [-1, 1]) {
    if (!sports) {
      if (!performance && !executive) {
        part(shell, dark, side * .906, .386, 0, .059, .111, 1.68)
        part(shell, dark, side * .907, .817, .28, .016, .012, 1.63)
      }
      if (variant !== 'electric' && !executive) part(shell, metal, side * .928, .855 + lift, .42 + cabShift, .039, .027, .193, .014)
      part(shell, paint, side * .887, 1.087 + lift, -.46 + cabShift, .259, .102, .208, .05)
      part(shell, dark, side * .987, 1.087 + lift, -.375 + cabShift, .098, .072, .024)
      if (variant !== 'van' && variant !== 'boxTruck' && !openRoof && !performance && !executive) {
        const bPillar = part(shell, dark, side * .741, 1.221 + lift + (touring ? .035 : 0), .35 + cabShift, .09, .402, .088)
        bPillar.rotation.z = side * .24
      }
    }
    for (const axle of [-1.28, 1.28]) {
      const pivot = new THREE.Group()
      pivot.position.set(side * rearWheelOffset.x, .344, axle * lengthScale)
      group.add(pivot)
      const hub = new THREE.Group()
      pivot.add(hub)
      const tire = new THREE.Mesh(performanceWheels ? sportsTire : tireGeometry, rubber)
      tire.rotation.z = Math.PI / 2
      tire.castShadow = tire.receiveShadow = true
      hub.add(tire)
      const sidewall = new THREE.Mesh(performanceWheels ? sportsSidewall : sidewallGeometry, rubber)
      sidewall.position.x = side * (performanceWheels ? .12 : .106)
      sidewall.rotation.y = Math.PI / 2
      hub.add(sidewall)
      if (variant === 'classic') {
        const band = new THREE.Mesh(whitewallGeometry, whitewall)
        band.position.x = side * .126
        band.rotation.y = Math.PI / 2
        hub.add(band)
      }
      const brake = new THREE.Mesh(performanceWheels ? sportsBrake : brakeGeometry, performanceWheels ? aeroAccent : rotor)
      brake.rotation.z = Math.PI / 2
      brake.position.x = side * .097
      hub.add(brake)
      const rimGeometry = executive ? executiveRims : performanceWheels || variant === 'convertible' || variant === 'electric' ? sportsRims
        : variant === 'boxTruck' || variant === 'van' || variant === 'classic' ? commercialRims : rimShapes
      const rim = new THREE.Mesh(rimGeometry[side < 0 ? 0 : 1], performanceWheels || variant === 'electric' ? sportAlloy : metal)
      rim.receiveShadow = true
      hub.add(rim)
      if (executive) hub.add(new THREE.Mesh(executiveSlots[side < 0 ? 0 : 1], dark))
      const indexMark = box(hub, treadAccent, side * (performanceWheels ? .124 : .114), .283, .073, .013, .018, .071, false)
      indexMark.rotation.x = .26
      if (performanceWheels) {
        const caliper = part(pivot, orangeCaliper, side * .113, .072, .174, .028, .123, .057, .014)
        caliper.rotation.x = .36
      }
      hub.rotation.x = Math.PI * (side > 0 ? .34 : .77) + (axle > 0 ? .51 : 0)
      wheels.push({ pivot, hub, front: axle < 0, side, roll: hub.rotation.x })
    }
    const hinge = new THREE.Group()
    hinge.position.set(side * .898, 0, -.59 + cabShift)
    hinge.visible = false
    part(hinge, paint, side * .013, .79, .54, .071, .428, 1.080)
    part(hinge, dark, side * .022, 1.005, .535, .049, .048, 1.03)
    part(hinge, metal, side * .05, .841, .902, .035, .032, .169)
    shell.add(hinge)
    doors.push({ side, hinge })
  }

  const detailParts = group.children.slice()
  const proxy = new THREE.Group()
  proxy.scale.set(widthScale, 1, lengthScale)
  const proxyBody = new THREE.Mesh(sports ? distantSportsChassis : trafficBody.proxy, bodyFinish)
  proxyBody.castShadow = proxyBody.receiveShadow = true
  proxy.add(proxyBody)
  const proxyCabin = new THREE.Mesh(glassGeometry, glass)
  proxyCabin.receiveShadow = true
  proxy.add(proxyCabin, new THREE.Mesh(distantWheels, rubber))
  if (roofAccent && roofGeometry) proxy.add(new THREE.Mesh(roofGeometry, roofAccent))
  if (!sports) addFleetTrim(proxy, variant, bodyFinish, false)
  for (const [i, side] of [-1, 1].entries()) {
    if (sports) {
      part(proxy, lights[i].head, side * .588, .615, -2.11, .39, .061, .051)
      part(proxy, lights[i].tail, side * .407, .793, 2.13, .77, .041, .037)
    } else {
      addTrafficLamps(proxy, lampsLook, side, lift, lights[i].head, lights[i].tail, false)
    }
    addReverseLens(proxy, side, lights[i].reverse)
  }
  proxy.visible = false
  group.add(proxy)
  let detailed = true

  let condition = 1
  let braking = false
  let reversing = false
  function lamps() {
    lights.forEach(({ head, tail, reverse, frontBroken, rearBroken }) => {
      head.emissiveIntensity = frontBroken ? .035 : 2.75
      tail.emissiveIntensity = rearBroken ? .045 : braking ? 4.7 : 1.4
      reverse.emissiveIntensity = reversing && !rearBroken ? 4.2 : 0
      head.color.set(frontBroken ? '#6b5748' : lensColor)
      tail.color.set(rearBroken ? '#482329' : '#942225')
      reverse.color.set(rearBroken ? '#504d49' : '#778794')
    })
  }

  return {
    kind: 'car' as const,
    group,
    dimensions,
    rearWheelOffset,
    wheelbase: 2 * rearWheelOffset.z,
    headlampHeight: sports ? .622 : executive ? .797 : .753 + lift,
    handling: handling[dispatch ? 'dispatch' : variant],
    doorOffset: cabShift * lengthScale,
    engineSound: dispatch || performance || executive || variant === 'coupe' ? 'v10' as const
      : variant === 'electric' ? 'electric' as const : 'standard' as const,
    enginePitch: sports ? 1.23 : trafficBody.sound,
    get condition() { return condition },
    setDetail(value: boolean) {
      if (detailed === value) return
      detailed = value
      proxy.visible = !value
      for (const item of detailParts) item.visible = value
      if (value) for (const wheel of wheels) wheel.hub.rotation.x = wheel.roll
    },
    headlamp(side: number) { return lights[side < 0 ? 0 : 1].frontBroken ? 0 : 1 },
    repair() {
      condition = 1
      reversing = false
      const live = panels.attributes.position as THREE.BufferAttribute
      live.copy(baseline as THREE.BufferAttribute)
      live.needsUpdate = true
      panels.computeVertexNormals()
      paintContext.fillStyle = '#fff'
      paintContext.fillRect(0, 0, 256, 512)
      paintMap.needsUpdate = true
      lights.forEach((lamp) => { lamp.frontBroken = lamp.rearBroken = false })
      shell.rotation.set(0, 0, 0)
      lamps()
    },
    damage(point: THREE.Vector3, inward: THREE.Vector3, severity: number) {
      condition = Math.max(0, condition - severity * .37)
      const live = panels.attributes.position
      const px = THREE.MathUtils.clamp(point.x / widthScale, -.96, .96)
      const pz = THREE.MathUtils.clamp(point.z / lengthScale, -2.1, 2.1)
      const py = THREE.MathUtils.clamp(point.y, .56, .96)
      let nearest = Infinity
      let nearestIndex = 0
      for (let i = 0; i < live.count; i++) {
        const x = baseline.getX(i)
        const y = baseline.getY(i)
        const z = baseline.getZ(i)
        const distance = (x - px) ** 2 + (z - pz) ** 2 + (y - py) ** 2 * .62
        if (distance < nearest) {
          nearest = distance
          nearestIndex = i
        }
        const push = Math.exp(-distance / (.062 + severity * .27)) * (.075 + severity * .32)
        if (push < .003) continue
        live.setXYZ(i,
          x + THREE.MathUtils.clamp(live.getX(i) - x + inward.x * push, -.34, .34),
          y + THREE.MathUtils.clamp(live.getY(i) - y - push * .20, -.17, .03),
          z + THREE.MathUtils.clamp(live.getZ(i) - z + inward.z * push, -.37, .37),
        )
      }
      live.needsUpdate = true
      panels.computeVertexNormals()
      const uvs = panels.attributes.uv
      const u = uvs.getX(nearestIndex) * 256
      const v = (1 - uvs.getY(nearestIndex)) * 512
      const mark = paintContext.createRadialGradient(u, v, 2, u, v, 18 + severity * 31)
      mark.addColorStop(0, '#422c2bd1')
      mark.addColorStop(.36, '#654d4794')
      mark.addColorStop(1, '#76695e00')
      paintContext.fillStyle = mark
      paintContext.fillRect(u - 54, v - 54, 108, 108)
      for (let i = 0; i < 4 + severity * 12; i++) {
        const a = (paintWearRandom() - .5) * 28
        const b = (paintWearRandom() - .5) * 44
        paintContext.strokeStyle = i % 3 === 0 ? '#d4cdddaf' : '#25191799'
        paintContext.lineWidth = .6 + paintWearRandom() * .84
        paintContext.beginPath()
        paintContext.moveTo(u + a - 3, v + b - 12)
        paintContext.lineTo(u + a, v + b)
        paintContext.lineTo(u + a + 2, v + b + 8 * paintWearRandom())
        paintContext.stroke()
      }
      paintMap.needsUpdate = true
      if (severity > .44 && Math.abs(pz) > 1.46) {
        const lamp = lights[px < 0 ? 0 : 1]
        if (pz < 0) lamp.frontBroken = true
        else lamp.rearBroken = true
      }
      lamps()
    },
    setBraking(enabled: boolean) {
      if (braking === enabled) return
      braking = enabled
      lamps()
    },
    setReversing(enabled: boolean) {
      if (reversing === enabled) return
      reversing = enabled
      lamps()
    },
    setDoor(side: number, amount: number) {
      for (const door of doors) {
        door.hinge.visible = door.side === side && amount > .01
        door.hinge.rotation.y = door.side * amount * 1.08
      }
    },
    spin(dt: number, speed: number, steering: number, slip = 0, yawDelta = 0, wheelAngle = steering * .38) {
      const wheelbase = 2 * rearWheelOffset.z
      const curvature = Math.tan(wheelAngle) / wheelbase
      for (const wheel of wheels) {
        let metres = dt * speed + yawDelta * wheel.side * rearWheelOffset.x
        if (wheel.front) metres = Math.sign(metres) * Math.hypot(metres, yawDelta * wheelbase)
        wheel.roll = (wheel.roll - metres / .348) % (Math.PI * 2)
        if (detailed) {
          wheel.hub.rotation.x = wheel.roll
          wheel.pivot.rotation.y = wheel.front ? Math.atan2(curvature * wheelbase, 1 + wheel.side * rearWheelOffset.x * curvature) : 0
        }
      }
      if (!detailed) return
      shell.rotation.z = THREE.MathUtils.damp(shell.rotation.z, THREE.MathUtils.clamp(slip * .016 + steering * Math.abs(speed) * -.0018, -.109, .109), 8.4, dt)
      shell.rotation.x = THREE.MathUtils.damp(shell.rotation.x, braking ? -.033 : .006, 7, dt)
    },
  }
}
