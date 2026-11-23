import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { box, canvasTexture, cylinder, matte } from './graphics'

const partGeometries = new Map<string, THREE.BufferGeometry>()

export function part(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, radius = .035) {
  const key = [width, height, depth, radius].join(',')
  let geometry = partGeometries.get(key)
  if (!geometry) {
    geometry = new RoundedBoxGeometry(width, height, depth, 2, radius)
    partGeometries.set(key, geometry)
  }
  const model = new THREE.Mesh(geometry, material)
  model.position.set(x, y, z)
  model.receiveShadow = true
  model.castShadow = height > .09
  parent.add(model)
  return model
}

export type Station = readonly [z: number, width: number, bottom: number, shoulder: number, crown: number]
type PerformanceBody = 'track' | 'wedge' | 'wideGT'
export type NewTrafficBody = 'pickup' | 'convertible' | 'classic' | 'executive' | 'electric' | 'boxTruck' | PerformanceBody
export type TrafficBody = 'sedan' | 'wagon' | 'hatchback' | 'suv' | 'van' | 'coupe' | 'taxi' | NewTrafficBody

export function isPerformanceCar(style: TrafficBody): style is PerformanceBody {
  return style === 'track' || style === 'wedge' || style === 'wideGT'
}

type FleetDesign = {
  body: readonly Station[]
  cabin: readonly Station[]
  roof?: readonly Station[]
  lift: number
  sound: number
  width: number
  length: number
}

export const fleetDesigns: Record<NewTrafficBody, FleetDesign> = {
  track: {
    body: [
      [-2.10,.81,.29,.52,.644], [-1.97,.927,.262,.65,.733], [-1.59,.974,.252,.78,.833],
      [-1.27,.984,.249,.848,.884], [-.78,.943,.244,.811,.864], [-.17,.911,.249,.765,.854],
      [.66,.951,.245,.814,.896], [1.24,.991,.266,.9,.957], [1.91,.978,.286,.86,.921], [2.1,.91,.311,.738,.839],
    ],
    cabin: [
      [-.83,.676,.81,.83,.88], [-.57,.735,.824,.971,1.071], [-.31,.731,.839,1.125,1.245],
      [-.01,.712,.851,1.188,1.312], [.36,.698,.861,1.199,1.346], [.73,.683,.871,1.154,1.29],
      [1.02,.59,.895,1.07,1.162], [1.43,.529,.914,.938,.984],
    ],
    roof: [[-.23,.446,1.135,1.18,1.263], [.02,.553,1.188,1.249,1.327], [.37,.581,1.209,1.265,1.355], [.74,.515,1.17,1.221,1.308], [.91,.455,1.12,1.156,1.23]],
    lift: -.12, sound: 1.32, width: 1.037, length: 1.062,
  },
  wedge: {
    body: [
      [-2.10,.737,.323,.46,.567], [-1.96,.871,.285,.56,.649], [-1.62,.968,.258,.705,.759],
      [-1.27,.982,.248,.801,.82], [-.72,.908,.246,.772,.852], [-.07,.914,.249,.771,.857],
      [.55,.949,.251,.837,.915], [1.28,.986,.263,.922,.989], [1.91,.977,.29,.905,.962], [2.1,.895,.343,.765,.858],
    ],
    cabin: [
      [-.97,.656,.802,.821,.855], [-.64,.735,.812,.937,1.006], [-.26,.738,.819,1.083,1.208],
      [.07,.718,.833,1.139,1.283], [.46,.704,.85,1.154,1.28], [.78,.658,.89,1.103,1.218], [1.28,.555,.942,.97,1.031],
    ],
    roof: [[-.24,.464,1.119,1.155,1.215], [.06,.556,1.151,1.203,1.289], [.41,.581,1.154,1.206,1.294], [.69,.505,1.121,1.163,1.245]],
    lift: -.14, sound: 1.38, width: 1.035, length: .99,
  },
  wideGT: {
    body: [
      [-2.10,.79,.314,.64,.758], [-2.00,.899,.281,.732,.831], [-1.62,.961,.268,.841,.927],
      [-1.24,.981,.263,.901,.985], [-.74,.947,.266,.881,1.032], [-.1,.935,.268,.87,1.035],
      [.62,.965,.265,.87,.997], [1.21,.995,.278,.933,1.061], [1.92,.954,.295,.899,1.009], [2.1,.87,.349,.774,.911],
    ],
    cabin: [
      [-.62,.657,.974,.995,1.039], [-.4,.714,.981,1.117,1.188], [-.1,.737,.981,1.248,1.385],
      [.28,.724,.983,1.32,1.439], [.72,.714,.995,1.302,1.404], [1.11,.696,1.013,1.202,1.303],
      [1.49,.633,1.014,1.11,1.177], [1.77,.58,1.042,1.059,1.081],
    ],
    roof: [[-.16,.49,1.296,1.319,1.357], [.08,.557,1.334,1.361,1.423], [.4,.585,1.352,1.388,1.455], [.78,.569,1.331,1.369,1.423], [1.05,.509,1.247,1.284,1.339]],
    lift: -.026, sound: 1.15, width: 1.052, length: 1.083,
  },
  pickup: {
    body: [
      [-2.1,.79,.34,.75,.969],[-1.98,.9,.33,.88,1.06],[-1.4,.953,.31,.997,1.143],
      [-.86,.92,.31,1.003,1.13],[-.35,.922,.305,.983,1.12],[.41,.941,.31,.971,1.08],
      [.65,.954,.33,1.04,.701],[1.25,.957,.32,1.047,.7],[1.83,.941,.34,1.044,.728],[2.1,.867,.39,.913,.862],
    ],
    cabin: [
      [-.95,.72,1.062,1.13,1.19],[-.59,.799,1.072,1.37,1.59],[-.3,.805,1.087,1.55,1.75],
      [.17,.794,1.082,1.56,1.76],[.49,.78,1.067,1.50,1.68],[.61,.74,1.053,1.29,1.44],
    ],
    roof: [[-.46,.575,1.591,1.636,1.687],[-.22,.663,1.676,1.718,1.777],[.28,.667,1.668,1.714,1.78],[.499,.593,1.59,1.629,1.697]],
    lift: .135, sound: .88, width: 1.02, length: 1.11,
  },
  convertible: {
    body: [
      [-2.1,.75,.28,.60,.70],[-1.89,.884,.28,.71,.807],[-1.28,.937,.269,.81,.895],
      [-.8,.901,.26,.798,.911],[-.49,.899,.266,.805,.948],[.15,.904,.261,.881,.869],
      [.65,.923,.26,.942,.884],[1.26,.951,.276,.878,.974],[1.86,.877,.284,.82,.924],[2.1,.794,.34,.74,.85],
    ],
    cabin: [[-.775,.636,.892,.909,.946],[-.61,.651,.912,1.098,1.173],[-.428,.625,.946,1.198,1.266]],
    lift: -.105, sound: 1.14, width: .985, length: 1.006,
  },
  classic: {
    body: [
      [-2.1,.816,.322,.7,.9],[-1.948,.913,.292,.8,.949],[-1.45,.961,.29,.859,.988],
      [-.75,.937,.281,.873,1.045],[-.21,.939,.28,.915,1.034],[.64,.944,.278,.906,1.04],
      [1.24,.953,.28,.916,1.055],[1.95,.94,.31,.914,1.047],[2.1,.89,.352,.807,.962],
    ],
    cabin: [
      [-.82,.64,1.01,1.036,1.087],[-.49,.747,1.01,1.185,1.34],[-.19,.754,1.005,1.331,1.51],
      [.19,.752,1.006,1.366,1.544],[.68,.748,1.011,1.343,1.51],[1.17,.733,1.02,1.181,1.33],[1.4,.655,1.018,1.094,1.16],
    ],
    roof: [[-.33,.497,1.39,1.42,1.473],[-.1,.611,1.443,1.496,1.543],[.49,.633,1.446,1.496,1.552],[.82,.602,1.393,1.442,1.51],[1.04,.526,1.32,1.39,1.441]],
    lift: .021, sound: .94, width: 1.017, length: 1.077,
  },
  executive: {
    body: [
      [-2.1,.87,.352,.802,.879], [-2.025,.923,.320,.844,.900], [-1.72,.951,.300,.862,.920],
      [-1.28,.957,.295,.871,.930], [-.81,.950,.291,.890,.958], [-.22,.956,.288,.902,.964],
      [.55,.958,.288,.905,.968], [1.23,.964,.294,.907,.969], [1.96,.950,.322,.882,.966], [2.1,.888,.388,.818,.929],
    ],
    cabin: [
      [-.84,.69,.929,.946,.992], [-.56,.758,.947,1.143,1.299], [-.31,.762,.953,1.311,1.503],
      [.04,.761,.956,1.396,1.547], [.66,.754,.955,1.396,1.547], [1.06,.733,.956,1.327,1.504],
      [1.31,.706,.956,1.195,1.337], [1.53,.653,.956,1.037,1.115],
    ],
    roof: [
      [-.42,.509,1.405,1.449,1.495], [-.20,.620,1.475,1.516,1.554], [.10,.653,1.490,1.530,1.566],
      [.67,.646,1.490,1.530,1.566], [.94,.603,1.464,1.500,1.535], [1.10,.520,1.401,1.432,1.493],
    ],
    lift: .035, sound: .89, width: 1.012, length: 1.17,
  },
  electric: {
    body: [
      [-2.1,.799,.31,.66,.798],[-1.92,.888,.295,.749,.861],[-1.34,.937,.28,.821,.927],
      [-.82,.903,.28,.902,.995],[-.25,.912,.275,.933,1.002],[.52,.922,.273,.926,1.011],
      [1.29,.948,.28,.925,1.047],[1.89,.916,.313,.887,1.049],[2.1,.804,.36,.773,.927],
    ],
    cabin: [
      [-1.02,.62,.912,.943,.998],[-.71,.729,.934,1.083,1.218],[-.36,.753,.955,1.215,1.394],
      [-.08,.751,.957,1.321,1.493],[.44,.75,.969,1.365,1.54],[.95,.738,.994,1.323,1.482],
      [1.35,.714,1.022,1.226,1.369],[1.805,.648,1.028,1.099,1.159],
    ],
    lift: -.008, sound: 1.26, width: 1.01, length: 1.023,
  },
  boxTruck: {
    body: [
      [-2.1,.837,.4,.73,1.019],[-2,.912,.331,.874,1.104],[-1.49,.974,.29,.994,1.164],
      [-.94,.948,.288,1.018,1.204],[-.41,.945,.28,.947,1.161],[.18,.942,.278,.78,.908],
      [.8,.96,.275,.795,.898],[1.3,.984,.284,.816,.894],[1.87,.957,.334,.768,.855],[2.1,.891,.399,.724,.805],
    ],
    cabin: [
      [-1.93,.79,1.025,1.11,1.20],[-1.75,.845,1.055,1.38,1.526],[-1.44,.859,1.093,1.624,1.799],
      [-1.13,.865,1.099,1.695,1.855],[-.69,.87,1.099,1.69,1.852],[-.46,.823,1.099,1.616,1.79],
    ],
    roof: [[-1.51,.552,1.675,1.714,1.76],[-1.25,.741,1.728,1.775,1.863],[-.67,.799,1.734,1.78,1.863],[-.43,.754,1.695,1.767,1.839]],
    lift: .123, sound: .75, width: 1.064, length: 1.249,
  },
}

const dark = matte('#262a30')
const deck = matte('#393e45')
const tanLeather = matte('#a88060')
const cream = matte('#dfd6bf')
const ivoryVinyl = matte('#e3cead')
const cargoWhite = matte('#dadfda')
const cargoSilver = new THREE.MeshStandardMaterial({ color: '#9ca8a9', roughness: .49, metalness: .6 })
const indicator = new THREE.MeshStandardMaterial({ color: '#d99947', emissive: '#f99929', emissiveIntensity: 1.2 })
const taxiLight = new THREE.MeshStandardMaterial({ color: '#ffe1af', emissive: '#ffc775', emissiveIntensity: .93 })
const bumper = new THREE.MeshStandardMaterial({ color: '#aab7bb', roughness: .28, metalness: .86 })
const blueCab = matte('#237e84')
const composite = new THREE.MeshPhysicalMaterial({ color: '#20242f', metalness: .68, roughness: .35, clearcoat: .52 })
const racingWhite = matte('#e8e4d5')

export function accentRoof(style: TrafficBody) {
  if (style === 'classic') return ivoryVinyl
  if (isPerformanceCar(style)) return composite
}

const decalMaterials = new Map<string, THREE.MeshStandardMaterial>()
function fleetDecal(parent: THREE.Object3D, name: string, ink: string, background: string, x: number, y: number, z: number, angle: number, w: number, h: number) {
  let material = decalMaterials.get(name)
  if (!material) {
    const texture = canvasTexture(512, 160, ctx => {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, 512, 160)
      ctx.strokeStyle = ink
      ctx.lineWidth = 4
      ctx.strokeRect(12, 12, 488, 136)
      ctx.fillStyle = ink
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = '800 59px system-ui,sans-serif'
      ctx.fillText(name, 256, 81, 447)
    })
    material = new THREE.MeshStandardMaterial({ map: texture, roughness: .71 })
    decalMaterials.set(name, material)
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
  sign.position.set(x, y, z)
  sign.rotation.y = angle
  parent.add(sign)
}

export function lampStyle(style: TrafficBody) {
  if (isPerformanceCar(style) || style === 'executive') return style
  if (style === 'classic') return 'round'
  if (style === 'electric') return 'blade'
  if (style === 'convertible') return 'split'
  if (style === 'boxTruck' || style === 'pickup') return 'vertical'
  return 'stock'
}

function executiveTrim(parent: THREE.Group, detailed: boolean) {
  const grille = part(parent, bumper, 0, .786, -2.113, .70, .291, .078, .022)
  grille.rotation.x = -.065
  const insert = part(parent, dark, 0, .781, -2.157, .621, .224, .028, .013)
  insert.rotation.x = -.065
  for (let row = 0; row < 6; row += detailed ? 1 : 2) {
    part(parent, bumper, 0, .691 + row * .0355, -2.175, .608, .012, .014, .003)
  }
  part(parent, bumper, 0, .786, -2.181, .016, .220, .016, .003)
  if (detailed) {
    const ornament = part(parent, bumper, 0, .957, -2.025, .043, .043, .012, .003)
    ornament.rotation.z = Math.PI / 4
  }
  for (const [z, y] of [[-2.085, .503], [2.085, .525]]) {
    part(parent, deck, 0, y, z, 1.69, .184, .155, .033)
    part(parent, bumper, 0, y + .060, z * 1.037, 1.66, .023, .025, .007)
    part(parent, dark, 0, y - .013, z * 1.039, 1.66, .052, .027, .009)
  }
  for (const side of [-1, 1]) {
    for (const [z, length] of [[-1.81,.52], [.055,1.83], [1.82,.51]]) {
      part(parent, deck, side * .940, .514, z, .046, .246, length, .028)
      part(parent, bumper, side * .968, .642, z, .013, .023, length, .004)
    }
    part(parent, bumper, side * .765, .971, .368, .021, .018, 1.82, .005)
    if (!detailed) continue
    for (const z of [.015, 1.0]) {
      part(parent, dark, side * .961, .774, z, .028, .051, .171, .01)
      part(parent, bumper, side * .982, .775, z, .017, .019, .144, .003)
    }
    const pillar = part(parent, dark, side * .704, 1.224, .354, .052, .475, .086, .014)
    pillar.rotation.z = side * .22
  }
}

function performanceTrim(parent: THREE.Group, style: PerformanceBody, paint: THREE.Material, detailed: boolean) {
  const gt = style === 'wideGT'
  const nose = gt ? .555 : .445
  part(parent, composite, 0, .303, -1.992, 1.813, .075, .297, .022)
  part(parent, dark, 0, nose, -2.104, gt ? 1.33 : .94, gt ? .226 : .158, .081, .032)
  part(parent, composite, 0, .409, 2.065, 1.75, .148, .183, .029)
  for (const side of [-1, 1]) {
    const duct = part(parent, dark, side * .683, nose - .008, -2.104, .332, .153, .074, .023)
    duct.rotation.set(0, -side * .24, side * .14)
    part(parent, composite, side * .934, .327, -.027, .117, .092, 1.58, .018)
    if (detailed) {
      part(parent, composite, side * .803, nose + .003, -2.118, .044, .156, .084, .012).rotation.z = -side * .37
      const intake = part(parent, dark, side * .92, gt ? .612 : .582, .706, .045, gt ? .171 : .25, .488, .022)
      intake.rotation.x = -side * .065 + .16
      intake.rotation.y = side * .17
      part(parent, composite, side * .94, .449, 2.057, .04, .144, .253, .014)
      for (const dx of [0, .133]) {
        part(parent, bumper, side * ((gt ? .59 : .36) + dx), .449, 2.126, .099, .056, .077, .017)
        part(parent, dark, side * ((gt ? .59 : .36) + dx), .449, 2.169, .072, .035, .014, .008)
      }
    }
  }
  if (style === 'track') {
    part(parent, composite, 0, 1.134, 1.847, 1.93, .05, .261, .018)
    part(parent, paint, 0, 1.16, 1.816, 1.78, .024, .205, .011)
    for (const side of [-1, 1]) {
      const mount = part(parent, composite, side * .484, 1.008, 1.813, .071, .311, .199, .018)
      mount.rotation.z = -side * .15
      part(parent, composite, side * .939, 1.146, 1.853, .058, .119, .278, .02)
      if (detailed) part(parent, racingWhite, side * .105, .845, -1.61, .094, .015, .53, .004).rotation.x = -.224
    }
  } else if (style === 'wedge') {
    part(parent, composite, 0, .967, 1.843, 1.609, .065, .233, .018)
    for (const z of detailed ? [1.28, 1.39, 1.5, 1.61] : [1.39, 1.57]) {
      part(parent, composite, 0, 1.003 - (z - 1.28) * .044, z, .8, .025, .07, .009)
    }
  } else {
    const lip = part(parent, paint, 0, 1.006, 1.947, 1.722, .089, .231, .021)
    lip.rotation.x = -.17
    part(parent, composite, 0, .978, 2.045, 1.609, .056, .067, .019)
  }
}

function pickupBed(parent: THREE.Group, paint: THREE.Material, detailed: boolean) {
  part(parent, dark, 0, .775, 1.36, 1.425, .077, 1.43)
  part(parent, dark, 0, 1.006, .632, 1.388, .295, .103)
  part(parent, paint, 0, .943, 2.021, 1.682, .316, .177)
  part(parent, dark, 0, 1.105, 2.018, 1.68, .055, .16, .013)
  for (const side of [-1, 1]) {
    part(parent, dark, side * .705, .922, 1.354, .175, .294, 1.447)
    part(parent, paint, side * .811, 1.037, 1.352, .162, .153, 1.469)
    part(parent, dark, side * .816, 1.115, 1.333, .151, .041, 1.492, .012)
    if (detailed) part(parent, deck, side * .566, .842, 1.265, .33, .163, .464)
  }
  if (detailed) {
    for (let i = -3; i <= 3; i++) part(parent, deck, i * .137, .823, 1.346, .027, .028, 1.32, .008)
    part(parent, bumper, 0, .991, 2.117, .174, .052, .032, .011)
  }
}

function openCabin(parent: THREE.Group, detailed: boolean) {
  part(parent, dark, 0, .943, .104, 1.298, .192, 1.28)
  part(parent, dark, 0, 1.042, -.416, 1.296, .147, .237)
  for (const side of [-1, 1]) {
    const back = part(parent, tanLeather, side * .326, 1.123, .317, .382, .383, .14, .057)
    back.rotation.x = .24
    part(parent, tanLeather, side * .326, 1.297, .385, .205, .15, .138, .044)
    if (detailed) {
      part(parent, tanLeather, side * .326, 1.002, .076, .364, .108, .416, .048)
      part(parent, bumper, side * .332, 1.125, .57, .299, .074, .083, .028)
    }
  }
  if (detailed) part(parent, deck, 0, 1.008, .035, .27, .147, .69)
}

function truckCargo(parent: THREE.Group, paint: THREE.Material, detailed: boolean) {
  part(parent, cargoWhite, 0, 1.798, .827, 1.912, 1.828, 2.45, .057)
  part(parent, cargoSilver, 0, 2.718, .832, 1.925, .093, 2.487, .031)
  part(parent, dark, 0, .91, .833, 1.914, .126, 2.463)
  part(parent, cargoSilver, 0, 1.823, 2.068, 1.799, 1.623, .052, .023)
  for (const side of [-1, 1]) {
    part(parent, paint, side * .962, 1.279, .828, .021, .3, 2.355, .01)
    part(parent, indicator, side * .79, 2.562, 2.092, .157, .076, .038, .015)
    part(parent, indicator, side * .791, 2.568, -.422, .132, .068, .037, .011)
    if (!detailed) continue
    fleetDecal(parent, 'QUAY PARCEL', '#193f45', '#e8e6d9', side * .976, 1.988, .771, side * Math.PI / 2, 1.99, .59)
    for (const height of [1.108, 1.872, 2.516]) part(parent, dark, side * .848, height, 2.103, .125, .069, .044)
  }
  if (detailed) {
    for (let slat = 0; slat < 8; slat++) part(parent, cargoWhite, 0, 1.19 + slat * .184, 2.101, 1.639, .034, .036, .01)
    part(parent, dark, 0, 1.404, 2.133, .303, .075, .056)
  }
}

export function addFleetTrim(parent: THREE.Group, style: TrafficBody, paint: THREE.Material, detailed: boolean) {
  if (style === 'executive') {
    executiveTrim(parent, detailed)
    return
  }
  if (isPerformanceCar(style)) {
    performanceTrim(parent, style, paint, detailed)
    return
  }
  switch (style) {
    case 'pickup':
      pickupBed(parent, paint, detailed)
      return
    case 'convertible':
      openCabin(parent, detailed)
      return
    case 'boxTruck':
      truckCargo(parent, paint, detailed)
      return
    case 'classic':
      if (!detailed) return
      part(parent, bumper, 0, .491, -2.105, 1.74, .131, .171)
      part(parent, bumper, 0, .524, 2.105, 1.8, .134, .15)
      for (const side of [-1, 1]) {
        part(parent, bumper, side * .928, .819, -.2, .037, .035, 1.72, .012)
        const support = part(parent, ivoryVinyl, side * .706, 1.291, .817, .084, .337, .183)
        support.rotation.z = side * .23
      }
      return
    case 'electric':
      part(parent, dark, 0, .532, -2.09, 1.37, .169, .107)
      part(parent, paint, 0, .662, -2.104, 1.336, .084, .097)
      if (detailed) {
        for (const side of [-1, 1]) {
          part(parent, dark, side * .889, .812, -.231, .035, .053, .118, .008)
          part(parent, dark, side * .912, .818, .759, .035, .053, .117, .008)
        }
      }
      return
    case 'taxi':
      part(parent, dark, 0, 1.59, .37, .67, .074, .33)
      part(parent, taxiLight, 0, 1.66, .37, .57, .121, .251)
      for (const side of [-1, 1]) {
        part(parent, blueCab, side * .906, .641, -.087, .082, .224, 1.64, .024)
        if (detailed) fleetDecal(parent, 'CITY CAB', '#fff0ca', '#237e84', side * .95, .645, -.087, side * Math.PI / 2, .79, .18)
      }
      return
    case 'van':
      for (const side of [-1, 1]) {
        part(parent, paint, side * .794, 1.47, .77, .095, .55, 2.14, .04)
        if (detailed) fleetDecal(parent, 'HARBOUR SERVICE', '#153944', '#e2e2d5', side * .845, 1.467, .765, side * Math.PI / 2, 1.42, .297)
      }
      return
  }
}

export function addTrafficLamps(parent: THREE.Group, style: ReturnType<typeof lampStyle>, side: number, lift: number, head: THREE.Material, tail: THREE.Material, detailed: boolean) {
  const front = .753 + lift
  const rear = .799 + lift
  if (style === 'executive') {
    part(parent, dark, side * .592, .787, -2.107, .506, .170, .070, .020)
    part(parent, head, side * .549, .797, -2.148, .360, .118, .035, .012)
    const corner = part(parent, indicator, side * .773, .796, -2.123, .135, .127, .075, .015)
    corner.rotation.y = side * -.21
    part(parent, dark, side * .587, .796, 2.105, .503, .163, .063, .019)
    part(parent, tail, side * .612, .806, 2.143, .426, .122, .035, .013)
    if (detailed) {
      for (const y of [.772,.811,.850]) part(parent, dark, side * .611, y, 2.163, .417, .008, .009, .002)
    }
  } else if (style === 'track' || style === 'wedge') {
    const wedge = style === 'wedge'
    const position = wedge ? .63 : .663
    const lens = part(parent, head, side * position, front, -2.101, wedge ? .318 : .392, .045, .039, .012)
    lens.rotation.set(0, -side * .23, side * (wedge ? .24 : .12))
    const corner = part(parent, head, side * .767, front + .006, -2.052, .034, .038, wedge ? .196 : .113, .011)
    corner.rotation.y = -side * .49
    const light = part(parent, tail, side * .567, rear + .058, 2.12, wedge ? .567 : .412, .043, .034, .01)
    light.rotation.z = side * (wedge ? -.026 : .11)
    if (detailed) part(parent, tail, side * .759, rear + .088, 2.12, .162, .033, .026, .01).rotation.z = side * .37
  } else if (style === 'wideGT') {
    if (detailed) part(parent, composite, side * .65, front, -2.088, .44, .137, .075, .048)
    for (const dx of [.563, .739]) {
      part(parent, head, side * dx, front + .01, -2.132, .141, .063, .033, .029)
      part(parent, tail, side * dx, rear, 2.134, .142, .075, .035, .03)
    }
  } else if (style === 'round') {
    for (const x of [.528, .745]) {
      if (detailed) {
        const rim = cylinder(parent, bumper, x * side, front, -2.077, .112, .092, false)
        rim.rotation.x = Math.PI / 2
      }
      const lens = cylinder(parent, head, x * side, front, -2.127, .081, .029, false)
      lens.rotation.x = Math.PI / 2
    }
    part(parent, tail, side * .62, rear + .018, 2.108, .391, .075, .039)
    part(parent, tail, side * .62, rear - .079, 2.109, .391, .039, .03, .01)
  } else if (style === 'blade') {
    part(parent, head, side * .402, front, -2.119, .779, .037, .033, .01)
    part(parent, tail, side * .408, rear, 2.121, .783, .041, .031, .01)
  } else if (style === 'split') {
    const lens = part(parent, head, side * .644, front + .043, -2.101, .35, .061, .053, .018)
    lens.rotation.y = side * -.22
    lens.rotation.z = side * .12
    part(parent, tail, side * .622, rear + .029, 2.113, .363, .057, .038, .019)
    if (detailed) part(parent, tail, side * .681, rear - .026, 2.109, .24, .029, .026, .011)
  } else if (style === 'vertical') {
    if (detailed) part(parent, dark, side * .649, front, -2.08, .472, .181, .099)
    part(parent, head, side * .672, front + .009, -2.133, .334, .091, .027)
    part(parent, tail, side * .773, rear + .13, 2.123, .169, .326, .034, .024)
    if (detailed) part(parent, indicator, side * .73, front - .087, -2.132, .218, .04, .025)
  } else {
    const lens = part(parent, head, side * .588, front, -2.075, .36, .093, .055)
    lens.rotation.y = side * -.22
    if (detailed) {
      part(parent, indicator, side * .751, front - .035, -2.023, .085, .063, .083)
      part(parent, dark, side * .534, rear - .008, 2.066, .468, .115, .064)
    }
    part(parent, tail, side * .545, rear, 2.096, .406, .043, .026)
    if (detailed) part(parent, tail, side * .578, rear - .044, 2.099, .339, .028, .02)
  }
}
