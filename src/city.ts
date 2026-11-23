import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { BLOCKS, BOUNDS, CITY_CENTER_Z, CITY_DEPTH, CITY_WIDTH, CORE_BUILDINGS, DISTRICT_BUILDINGS, EAST_WEST, NORTH_SOUTH, PLAZAS, streetLabel, type Building } from './layout'
import { box, cylinder, ellipsoid, matte, randomize } from './graphics'
import { batchStatic, fixed, showSign, surface } from './city-geometry'
import { lightCity, makeLake } from './environment'
import { addShopWindows, facade, facadeRelief } from './facades'
import { plantMaple } from './foliage'
import type { CityMaterials } from './materials'
import { makeRoadReflection, makeStreetLighting, type LampPosition } from './street-lighting'
import { addBikeRack, addFerry } from './harbour-props'
import { addBoardwalk } from './boardwalk'
import { addLandmarks } from './landmarks'
import { addGoCorridor } from './go-rail'
import { makeRetail } from './storefronts'
import { makeStreetFixtures } from './street-fixtures'

type StreetFixtures = ReturnType<typeof makeStreetFixtures>

const color = (hex: string) => new THREE.Color(hex)
const steel = matte('#3d4749')
const concrete = matte('#a7a29a')
const trim = matte('#d2bca3')
const cream = matte('#f5d9aa')
const wood = matte('#6d4b38')
const roadPaint = matte('#d7d2c5')
const yellow = matte('#be9b4e')
const lampGlass = new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffad60', emissiveIntensity: 3.15 })
const signalRed = new THREE.MeshStandardMaterial({ color: '#bb462e', emissive: '#f03d22', emissiveIntensity: 2.18 })
const signalGreen = new THREE.MeshStandardMaterial({ color: '#729a59', emissive: '#62a63f', emissiveIntensity: 1.72 })
const signalDark = matte('#282e30')
const rail = new THREE.MeshStandardMaterial({ color: '#a7a2a1', roughness: 0.36, metalness: 0.56 })

function addStorefront(parent: THREE.Object3D, b: Building) {
  const front = b.z + b.d / 2
  const frame = matte(b.awning ?? '#39484a')
  const divisions = Math.max(3, Math.round(b.w / 4.7))
  const bay = b.w / divisions
  addShopWindows(parent, b, front, frame, bay, divisions)
  for (let i = 0; i < divisions; i++) {
    const x = b.x - b.w / 2 + bay * (i + 0.5)
    if (b.awning) {
      const canopy = box(parent, frame, x, 3.03, front + 0.77, bay - 0.13, 0.1, 1.46)
      canopy.rotation.x = 0.18
      box(parent, frame, x, 2.84, front + 1.49, bay - 0.13, 0.33, 0.065)
      for (let stripe = -1; stripe <= 1; stripe++) {
        const xStripe = x + stripe * bay / 3
        const stripeTop = box(parent, cream, xStripe, 3.085, front + 0.77, bay * 0.095, 0.012, 1.46, false)
        stripeTop.rotation.x = 0.18
        box(parent, cream, xStripe, 2.84, front + 1.525, bay * 0.095, 0.327, 0.008, false)
      }
    }
  }
  box(parent, trim, b.x, 3.53, front + 0.15, b.w + 0.22, 0.18, 0.35)
  const signWidth = Math.min(b.w - 1, b.sign!.length * 0.54 + 1.8)
  box(parent, frame, b.x, 4.24, front + 0.2, signWidth + 0.14, 1.32, 0.33)
  showSign(parent, b.sign!, b.x, 4.24, front + 0.374, signWidth, 1.17, b.awning ?? '#38484a')
}

function addBuilding(parent: THREE.Object3D, physics: RAPIER.World, b: Building, index: number) {
  const side = facade(b, b.d, index * 11 + 15, false)
  const front = facade(b, b.w, index * 13 + 52, Boolean(b.sign))
  const rear = b.sign ? facade(b, b.w, index * 13 + 54, false) : front
  const roof = matte(b.kind === 'glass' ? '#8e9091' : '#706967')
  box(parent, [side, side, roof, roof, front, rear], b.x, b.h / 2 + 0.12, b.z, b.w, b.h, b.d).layers.enable(1)
  fixed(physics, b.x, b.h / 2 + 0.12, b.z, b.w, b.h, b.d)
  const coping = matte(color(b.color).multiplyScalar(1.02).getStyle())
  box(parent, coping, b.x, b.h + 0.22, b.z, b.w + 0.52, 0.34, b.d + 0.52)
  if (b.kind === 'glass') {
    const aluminum = matte(index % 2 ? '#9199a3' : '#728895')
    const step = b.h / Math.max(5, Math.round(b.h / 3.15))
    for (let level = 1; level < Math.round(b.h / step); level++) {
      const inset = index % 2 === 0 && level % 3 === 1 ? .79 : .31
      box(parent, aluminum, b.x, level * step + .12, b.z, b.w + inset, .12, b.d + inset, false)
    }
    for (const dx of [-.5, -.19, .19, .5]) {
      box(parent, aluminum, b.x + dx * b.w, b.h * .50 + .12, b.z + b.d / 2, .14, b.h, .14, false)
    }
    box(parent, steel, b.x, 3.22, b.z + b.d / 2 + .61, b.w * .67, .16, 1.42)
    for (let i = -2; i <= 2; i++) {
      box(parent, lampGlass, b.x + i * b.w / 9.1, 3.13, b.z + b.d / 2 + 1.02, b.w / 12, .039, .13, false)
    }
    if (b.h >= 32) {
      const crownHeight = index % 2 === 0 ? 4.9 : 7.3
      const pocket = { ...b, h: crownHeight, w: b.w * .71, d: b.d * .68 }
      const capFace = facade(pocket, pocket.w, 1500 + index * 17, false, true)
      box(parent, capFace, b.x + (index % 2 ? .08 : -.07) * b.w, b.h + crownHeight * .5, b.z - b.d * .07, pocket.w, crownHeight, pocket.d, false).layers.enable(1)
      box(parent, aluminum, b.x + (index % 2 ? .08 : -.07) * b.w, b.h + crownHeight + .13, b.z - b.d * .07, pocket.w + .4, .27, pocket.d + .37, false)
    }
  } else if (b.h > 8) {
    box(parent, coping, b.x, b.h - 0.76, b.z, b.w + 0.32, 0.23, b.d + 0.32)
  }
  box(parent, roof, b.x - b.w * 0.25, b.h + 0.95, b.z - b.d * 0.23, 2.4, 1.25, 2.0)
  box(parent, steel, b.x + b.w * 0.24, b.h + 0.46, b.z + b.d * 0.21, 1.45, 0.5, 1.35)
  facadeRelief(parent, b, index)
  if (b.sign) addStorefront(parent, b)
}

function tree(parent: THREE.Object3D, physics: RAPIER.World, bark: THREE.Material, x: number, z: number, scale: number, seed: number, y = 0.13) {
  plantMaple(parent, bark, x, y, z, scale, seed)
  fixed(physics, x, 1.15, z, 0.3 * scale, 2.3, 0.3 * scale)
}

function lamp(fixtures: StreetFixtures, x: number, z: number, direction: number) {
  const light = { x: x + .97 * direction, z, active: true }
  const pole = fixtures.mount('lamp', x, .14, z, .26, 3.88, .26, light)
  cylinder(pole, steel, 0, 2.13, 0, 0.065, 4.3)
  cylinder(pole, steel, 0, 0.15, 0, 0.16, 0.35)
  const arm = box(pole, steel, 0.44 * direction, 4.3, 0, 1.05, 0.07, 0.075)
  arm.rotation.z = -0.12 * direction
  box(pole, steel, 0.96 * direction, 4.25, 0, 0.49, 0.15, 0.28)
  box(pole, lampGlass, 0.97 * direction, 4.17, 0, 0.39, 0.04, 0.19, false).userData.fixtureLens = true
  box(pole, steel, 0.11 * direction, 4.05, 0, 0.19, 0.41, 0.14, false)
  return light
}

function bench(parent: THREE.Object3D, x: number, z: number, angle = 0) {
  const object = new THREE.Group()
  object.position.set(x, 0.14, z)
  object.rotation.y = angle
  parent.add(object)
  for (const dx of [-0.68, 0.68]) {
    box(object, steel, dx, 0.24, 0, 0.085, 0.46, 0.38)
    box(object, steel, dx, 0.61, -0.17, 0.075, 0.43, 0.08)
  }
  for (let i = 0; i < 3; i++) {
    box(object, wood, 0, 0.47, (i - 1) * 0.13, 1.82, 0.06, 0.117)
  }
  for (const y of [0.65, 0.78]) box(object, wood, 0, y, -0.19, 1.82, 0.1, 0.067)
}

function addCrosswalks(parent: THREE.Object3D, fixtures: StreetFixtures) {
  const blades = new Map<string, { width: number; front: THREE.Mesh }>()
  function nameplate(pole: THREE.Group, name: string, height: number, yaw: number) {
    const blade = new THREE.Group()
    blade.position.y = height
    blade.rotation.y = yaw
    pole.add(blade)
    let design = blades.get(name)
    if (!design) {
      const label = streetLabel(name).toUpperCase()
      const width = Math.max(1.48, label.length * .111 + .64)
      const front = showSign(new THREE.Group(), label, 0, 0, .041, width, .34, '#345771')
      design = { width, front }
      blades.set(name, design)
    }
    box(blade, steel, 0, 0, 0, design.width + .04, .369, .072, false)
    const reverse = design.front.clone()
    reverse.rotation.y = Math.PI
    reverse.position.z = -.041
    blade.add(design.front.clone(), reverse)
  }

  for (const avenue of NORTH_SOUTH) {
    for (const street of EAST_WEST) {
      const pole = fixtures.mount('sign', avenue.x - avenue.width / 2 - 2.4, .14, street.z + street.width / 2 + 2.4, .19, 3.22, .19)
      cylinder(pole, steel, 0, 1.67, 0, .064, 3.35)
      nameplate(pole, street.name, 3.19, 0)
      nameplate(pole, avenue.name, 3.58, Math.PI / 2)
      for (const side of [-1, 1]) {
        for (let i = -3; i <= 3; i++) {
          box(parent, roadPaint, avenue.x + i * 1.57, 0.035, street.z + side * (street.width / 2 + 0.95), 0.64, 0.012, 2.05, false)
        }
        for (let i = -3; i <= 3; i++) {
          box(parent, roadPaint, avenue.x + side * (avenue.width / 2 + 1.01), 0.034, street.z + i * (street.width - 1) / 7, 2.14, 0.012, 0.63, false)
        }
      }
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = avenue.x + sx * (avenue.width / 2 + 1.38)
          const z = street.z + sz * (street.width / 2 + 1.72)
          const pole = fixtures.mount('signal', x, .14, z, .208, 3.14, .208)
          cylinder(pole, steel, 0, 1.66, 0, 0.068, 3.32)
          box(pole, steel, 0, 3.36, 0, 0.23, 0.58, 0.26)
          for (const [index, offset] of [0.17, 0, -0.17].entries()) {
            const signal = index === 0 && sx === sz ? signalRed : index === 2 && sx !== sz ? signalGreen : signalDark
            const lens = cylinder(pole, signal, 0, 3.36 + offset, -sz * 0.145, 0.062, 0.04, false)
            lens.rotation.x = Math.PI / 2
            lens.userData.fixtureLens = true
            box(pole, steel, 0, 3.44 + offset, -sz * 0.18, 0.151, 0.034, 0.13, false)
          }
        }
      }
    }
  }
}

function addRoads(parent: THREE.Object3D, physics: RAPIER.World, materials: CityMaterials, fixtures: StreetFixtures) {
  const asphalt = materials.surface('asphalt', Math.round((CITY_WIDTH + 18) / 3.7), Math.round(CITY_DEPTH / 3.65))
  surface(parent, asphalt, 0, 0.014, CITY_CENTER_Z, CITY_WIDTH + 18, CITY_DEPTH)
  for (const block of BLOCKS) {
    const pavement = materials.surface('sidewalk', Math.round(block.w / 2.05), Math.round(block.d / 2.05))
    box(parent, [concrete, concrete, pavement, concrete, concrete, concrete], block.x, 0.066, block.z, block.w, 0.132, block.d, false)
    fixed(physics, block.x, 0.066, block.z, block.w, 0.132, block.d)
    const curb = matte('#aba8a1')
    for (const side of [-1, 1]) {
      box(parent, curb, block.x, 0.120, block.z + side * (block.d / 2 - 0.075), block.w, 0.029, 0.15, false)
      box(parent, curb, block.x + side * (block.w / 2 - 0.075), 0.122, block.z, 0.15, 0.029, block.d, false)
    }
  }
  for (const avenue of NORTH_SOUTH) {
    for (let z = BOUNDS.north + 3; z < 94; z += 5.4) {
      if (EAST_WEST.some((street) => Math.abs(street.z - z) < street.width / 2 + 4)) continue
      box(parent, yellow, avenue.x, 0.03, z, 0.125, 0.009, 2.9, false)
      for (const side of [-1, 1]) box(parent, roadPaint, avenue.x + side * 5.75, 0.028, z, 0.101, 0.009, 2.55, false)
    }
  }
  for (const street of EAST_WEST) {
    for (let x = BOUNDS.west; x < BOUNDS.east; x += 5.4) {
      if (NORTH_SOUTH.some((avenue) => Math.abs(avenue.x - x) < 11)) continue
      if (street.z !== 42) box(parent, yellow, x, 0.027, street.z, 2.75, 0.009, 0.115, false)
      for (const side of [-1, 1]) {
        const dz = street.z === 42 ? 4 : street.width / 2 - 1.4
        box(parent, roadPaint, x, 0.028, street.z + side * dz, 2.4, 0.009, 0.105, false)
      }
    }
  }
  box(parent, matte('#6d6c66'), 0, 0.023, 42, CITY_WIDTH + 18, 0.015, 6.4, false)
  for (const off of [-2.72, -1.2, 1.2, 2.72]) {
    box(parent, matte('#333e40'), 0, 0.035, 42 + off, CITY_WIDTH + 18, 0.012, 0.24, false)
    box(parent, rail, 0, 0.044, 42 + off, CITY_WIDTH + 18, 0.012, 0.08, false)
  }
  addCrosswalks(parent, fixtures)

  const wires: number[] = []
  for (let x = BOUNDS.west + 8; x <= BOUNDS.east - 8; x += 16) {
    if (NORTH_SOUTH.some((street) => Math.abs(street.x - x) < 11)) continue
    cylinder(parent, steel, x, 3.08, 30.7, 0.065, 6)
    wires.push(x, 5.88, 30.7, x, 5.26, 40.05, x, 5.26, 40.05, x, 5.12, 43.95)
  }
  for (const z of [40.05, 43.95]) wires.push(BOUNDS.west, 5.17, z, BOUNDS.east, 5.17, z)
  const cables = new THREE.BufferGeometry()
  cables.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3))
  parent.add(new THREE.LineSegments(cables, new THREE.LineBasicMaterial({ color: '#535657' })))
}

function addStreetDetails(parent: THREE.Object3D) {
  const iron = new THREE.MeshStandardMaterial({ color: '#495052', roughness: 0.65, metalness: 0.48 })
  const drain = matte('#283238')
  const shell = matte('#85827b')
  const rand = randomize(6412)
  for (const block of BLOCKS) {
    for (const side of [-1, 1]) {
      const dx = block.x + side * (block.w / 2 + 0.21)
      const dz = block.z + (rand() - 0.5) * block.d * 0.79
      box(parent, drain, dx, 0.026, dz, 0.41, 0.014, 0.73, false)
      for (let slat = -3; slat <= 3; slat++) {
        box(parent, iron, dx, 0.039, dz + slat * 0.097, 0.40, 0.011, 0.032, false)
      }
    }
  }
  for (const [x, z] of [[-4.3, 47.84], [8.1, -12.6], [13.4, -67.4], [-43.4, 46.6], [49, 36.5], [-74.2, 62.3], [78, 18.9]]) {
    cylinder(parent, shell, x, 0.024, z, 0.358, 0.02, false)
    cylinder(parent, iron, x, 0.036, z, 0.313, 0.008, false)
    for (let mark = -3; mark <= 3; mark++) {
      box(parent, drain, x + mark * 0.069, 0.043, z, 0.022, 0.006, 0.39, false)
    }
  }

  const shelterGlass = new THREE.MeshPhysicalMaterial({
    color: '#8aa9ab', transparent: true, opacity: 0.27,
    depthWrite: false, side: THREE.DoubleSide, roughness: 0.26, clearcoat: 0.55,
  })
  for (const [x, z] of [[-49.5, 32.1], [56.2, 51.9]]) {
    for (const side of [-1, 1]) {
      box(parent, steel, x + side * 2.24, 1.37, z - 0.46, 0.108, 2.62, 0.108)
      box(parent, steel, x + side * 2.24, 1.37, z + 0.46, 0.108, 2.62, 0.108)
    }
    box(parent, steel, x, 2.71, z, 4.65, 0.14, 1.26)
    box(parent, shelterGlass, x, 1.49, z - 0.48, 4.45, 1.96, 0.022, false)
    box(parent, steel, x, 0.37, z - 0.46, 4.51, 0.09, 0.066, false)
    box(parent, steel, x, 2.51, z - 0.46, 4.51, 0.09, 0.066, false)
    box(parent, wood, x, 0.62, z - 0.31, 3.13, 0.09, 0.44, false)
    box(parent, lampGlass, x, 2.632, z + 0.11, 2.11, 0.032, 0.07, false)
    showSign(parent, 'HARBOURFRONT', x, 2.73, z + 0.638, 2.27, 0.13, '#50463e')
  }
}

function addWaterfront(parent: THREE.Group, physics: RAPIER.World, materials: CityMaterials, bark: THREE.Material, lights: LampPosition[], fixtures: StreetFixtures) {
  const promenade = materials.surface('paving', Math.round(CITY_WIDTH / 3.4), 3)
  surface(parent, promenade, 0, .15, 89.8, CITY_WIDTH, 12.1)
  addBoardwalk(parent, physics, materials)
  for (const x of [-202, -177, -150, -128, -103, -76, -51, -26, 8, 65, 91, 114, 146, 171, 203]) bench(parent, x, 94.25, Math.PI)
  for (let i = 0; i < 18; i++) {
    const x = BOUNDS.west + 10 + i * 26
    lights.push(lamp(fixtures, x, 88.45, i % 2 === 0 ? 1 : -1))
    if (Math.abs(x - 42) > 11) tree(parent, physics, bark, x + 4, 89.1, 0.8 + (i % 3) * 0.13, i + 6)
  }
  const grass = materials.surface('grass', 7.5, 7)
  surface(parent, grass, 28, 0.143, 73.3, 29, 28)
  for (const [x, z, scale, seed] of [[15.5, 61.5, 1.16, 1], [39.2, 61.3, 1.17, 3], [16, 82, 1.2, 8], [34, 73.1, 1.18, 5], [52, 82, 1.12, 12]]) {
    tree(parent, physics, bark, x, z, scale, seed)
  }
  bench(parent, 31.5, 75.1)
  bench(parent, 13.7, 75.1, Math.PI / 2)

  addFerry(parent)
  for (const px of [35, 49]) {
    for (const pz of [100.5, 115.4]) {
      cylinder(parent, steel, px, .47, pz, .095, .63)
      cylinder(parent, lampGlass, px, .795, pz, .105, .107, false)
      cylinder(parent, steel, px, .866, pz, .12, .046, false)
    }
  }
  addBikeRack(parent, 15.2, 91.1, Math.PI * .41, ['#b06049', '#344f58', '#c4a56d'])

  // Low silhouettes across the water keep the horizon distinct from the pier.
  for (const [x, z, length, rotation] of [[-82, 142, 12, 0.34], [76, 157, 9, -0.62], [107, 125, 6, 0.21]]) {
    const boat = new THREE.Group()
    boat.position.set(x, -0.48, z)
    boat.rotation.y = rotation
    ellipsoid(boat, matte('#d5c7b4'), 0, 0.13, 0, 1.45, 0.62, length / 2, false)
    box(boat, matte('#dbdcd0'), 0, 0.68, 0.1, 2.2, 0.53, length * 0.42, false)
    box(boat, matte('#35717d'), 0, 0.99, 0.1, 2.03, 0.25, length * 0.29, false)
    parent.add(boat)
  }
}

function addSkyline(parent: THREE.Object3D) {
  const rand = randomize(663)
  for (let i = 0; i < 21; i++) {
    const x = (i - 10) * 19 + rand() * 12
    const z = BOUNDS.north - 26 - rand() * 89
    const w = 12 + rand() * 14
    const d = 12 + rand() * 18
    const h = 21 + rand() * 61
    if (x > -11 && x < 34) continue
    const building: Building = { x, z, w, d, h, color: i % 3 === 0 ? '#89878a' : i % 3 === 1 ? '#8a9da8' : '#a8aaa6', kind: i % 4 ? 'glass' : 'stone' }
    const side = facade(building, w, i * 33 + 171, false, true)
    box(parent, side, x, h / 2 - 2, z, w, h, d, false).layers.enable(1)
    if (i % 3 === 0) {
      box(parent, side, x + w * .075, h + 1.25, z, w * 0.71, 6.8, d * 0.75, false).layers.enable(1)
      box(parent, matte('#797f83'), x + w * .075, h + 4.73, z, w * 0.75, .45, d * 0.81, false)
    }
  }

}

function addDistricts(parent: THREE.Group, world: RAPIER.World, materials: CityMaterials, bark: THREE.Material, lights: LampPosition[], retail: ReturnType<typeof makeRetail>, fixtures: StreetFixtures) {
  const chunks = new Map<string, { x: number; z: number; detail: THREE.Group; buildings: THREE.Group }>()
  const tileSize = 85
  function chunkAt(x: number, z: number) {
    const col = Math.floor(x / tileSize)
    const row = Math.floor(z / tileSize)
    const key = `${col},${row}`
    let cell = chunks.get(key)
    if (!cell) {
      cell = { x: (col + .5) * tileSize, z: (row + .5) * tileSize, detail: new THREE.Group(), buildings: new THREE.Group() }
      chunks.set(key, cell)
      parent.add(cell.buildings, cell.detail)
    }
    return cell
  }

  const facadeCache = new Map<string, THREE.Material>()
  for (const [index, b] of DISTRICT_BUILDINGS.entries()) {
    const chunk = chunkAt(b.x, b.z)
    const band = b.h > 23 ? 36 : b.h > 14 ? 19 : 11
    const key = `${b.color}/${band}`
    let walls = facadeCache.get(key)
    if (!walls) {
      walls = facade({ ...b, h: band }, 24, 873 + facadeCache.size * 13, false, true)
      facadeCache.set(key, walls)
    }
    box(chunk.buildings, walls, b.x, b.h * .5 + .13, b.z, b.w, b.h, b.d).layers.enable(1)
    fixed(world, b.x, b.h * .5 + .13, b.z, b.w, b.h, b.d)
    const coping = matte(b.kind === 'glass' ? '#687884' : '#8c776c')
    box(chunk.buildings, coping, b.x, b.h + .32, b.z, b.w + .35, .43, b.d + .35, false).layers.enable(1)
    if (b.h > 24) {
      box(chunk.buildings, walls, b.x + .07 * b.w, b.h + 2.15, b.z, b.w * .72, 3.95, b.d * .66, false).layers.enable(1)
    }
    // The ground-level details can go out of range while the skyline remains visible.
    if (index % 4 !== 1) {
      retail(chunk.detail, b, index * 7 + 4)
      if (index % 5 === 0) retail(chunk.detail, b, index + 13, index % 2 ? 1 : -1)
    } else {
      const storefrontZ = b.z + b.d / 2
      box(chunk.detail, steel, b.x, 3.04, storefrontZ + .63, b.w * .67, .14, 1.32)
      for (const dx of [-.2, 0, .2]) box(chunk.detail, lampGlass, b.x + b.w * dx, 2.95, storefrontZ + 1.01, .89, .033, .095, false)
      bench(chunk.detail, b.x - b.w * .3, storefrontZ + 1.07, Math.PI)
    }
    if (index % 3 === 0) {
      const treeX = b.x - b.w * .36
      const treeZ = b.z + b.d / 2 + 2.25
      plantMaple(chunk.detail, bark, treeX, .135, treeZ, .73 + (index % 4) * .075, index + 36)
    }
  }

  for (const block of BLOCKS) {
    if (Math.abs(block.x) < 149 && block.z > -121) continue
    const chunk = chunkAt(block.x, block.z)
    const z = block.z + block.d / 2 - 1.45
    for (const dx of [-.31, .31]) lights.push(lamp(fixtures, block.x + block.w * dx, z, dx < 0 ? -1 : 1))
  }

  for (const plaza of PLAZAS) {
    const chunk = chunkAt(plaza.x, plaza.z)
    const park = plaza.name.includes('Park')
    const center = materials.surface(park ? 'grass' : 'paving', 13, 10)
    surface(chunk.buildings, center, plaza.x, .144, plaza.z, plaza.w, plaza.d)
    const marker = park ? '#3c6263' : '#3f566b'
    box(chunk.detail, steel, plaza.x, 1.3, plaza.z + plaza.d * .4, 6.7, .34, .11)
    showSign(chunk.detail, plaza.name.toUpperCase(), plaza.x, 1.31, plaza.z + plaza.d * .4 + .062, 6.7, .35, marker)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = plaza.x + sx * plaza.w * .37
        const z = plaza.z + sz * plaza.d * .32
        plantMaple(chunk.detail, bark, x, .14, z, 1.09, Math.round(x + z + 500))
        bench(chunk.detail, x - sx * 2.1, z, sz > 0 ? Math.PI : 0)
      }
    }
    if (!park) {
      for (const side of [-1, 1]) {
        const x = plaza.x + side * 5.8
        const pavilion = matte(side === 1 ? '#68546a' : '#925e50')
        box(chunk.detail, pavilion, x, 2.67, plaza.z - 5.2, 7.1, .22, 4.72)
        box(chunk.detail, wood, x, .91, plaza.z - 5.2, 6.65, .24, 3.58)
        for (const offset of [-3.23, 3.23]) {
          for (const dz of [-2.06, 2.06]) cylinder(chunk.detail, steel, x + offset, 1.4, plaza.z - 5.2 + dz, .095, 2.7)
        }
        box(chunk.detail, lampGlass, x, 2.506, plaza.z - 5.44, 4.64, .036, .065, false)
      }
    }
  }

  // Batch in local coordinates before attaching actors and distant lighting to the city.
  for (const { detail, buildings } of chunks.values()) {
    batchStatic(buildings)
    batchStatic(detail)
  }
  return (anchor: THREE.Vector3) => {
    for (const cell of chunks.values()) {
      cell.detail.visible = Math.abs(cell.x - anchor.x) < 142 && Math.abs(cell.z - anchor.z) < 142
    }
  }
}

export function makeCity(scene: THREE.Scene, world: RAPIER.World, materials: CityMaterials, shadowSize?: number) {
  const updateShadows = lightCity(scene, materials.sky, shadowSize)
  const city = new THREE.Group()
  scene.add(city)
  const fixtures = makeStreetFixtures(city, world)
  const lights: LampPosition[] = []
  const reflection = makeRoadReflection(CITY_WIDTH + 18, CITY_DEPTH, CITY_CENTER_Z)
  city.add(reflection)
  const water = makeLake(city, materials.sky)
  const bark = materials.surface('bark', 1, 1.2)
  const retail = makeRetail()
  fixed(world, 0, -0.51, CITY_CENTER_Z, CITY_WIDTH, 1.02, CITY_DEPTH)
  fixed(world, BOUNDS.west - 0.35, 1.5, CITY_CENTER_Z, 0.6, 3, CITY_DEPTH + 1)
  fixed(world, BOUNDS.east + 0.35, 1.5, CITY_CENTER_Z, 0.6, 3, CITY_DEPTH + 1)
  fixed(world, 0, 1.5, BOUNDS.north - 0.35, CITY_WIDTH, 3, 0.6)
  addRoads(city, world, materials, fixtures)
  addStreetDetails(city)
  for (const [index, building] of CORE_BUILDINGS.entries()) {
    addBuilding(city, world, building, index)
    if (!building.sign) retail(city, building, index * 7 + 1)
    if (index % 2 === 0 || building.kind === 'glass') retail(city, building, index * 5 + 3, building.x < 0 ? 1 : -1)
  }
  for (const [i, z] of [-93, -56, -30, 2, 26, 56, 77].entries()) {
    for (const x of [-83.8, -64.4, -9.75, 9.75, 64.8, 83.8]) {
      const lampX = Math.abs(x) === 9.75 ? Math.sign(x) * 10.9 : x
      lights.push(lamp(fixtures, lampX, z, x % 37 > 0 ? -1 : 1))
      if ((i + Math.floor(Math.abs(x))) % 3 === 0 && !(i === 5 && x === -9.75)) tree(city, world, bark, x - 0.41, z + 3, 0.77 + (i % 3) * 0.09, i + Math.round(Math.abs(x)))
    }
  }
  for (const x of [-61, -46, -20, 15, 31, 48, 63]) {
    const bin = fixtures.mount('bin', x, .13, 31.36, .59, .69, .59)
    cylinder(bin, matte('#424c49'), 0, 0.32, 0, 0.3, 0.65)
    cylinder(bin, steel, 0, 0.67, 0, 0.33, 0.08)
  }
  // Planters and seating frame the spawn plaza without blocking the crossing.
  for (const [x, z, i] of [[-16.5, 56.7, 4], [-22.3, 60.8, 3], [-29.5, 55.2, 11], [25, 57.8, 2], [-40.6, 77.1, 1]]) {
    box(city, concrete, x, 0.29, z, 2.45, 0.34, 2.05)
    box(city, matte('#625347'), x, 0.47, z, 2.15, 0.045, 1.77, false)
    tree(city, world, bark, x, z, 1.04, i, 0.46)
    fixed(world, x, 0.27, z, 2.45, 0.32, 2.05)
  }
  bench(city, -16.2, 67, Math.PI / 2)
  bench(city, -33, 54.82)
  showSign(city, 'HARBOURFRONT', -17.8, 2.1, 60.34, 4.35, 0.62, '#31565b')
  cylinder(city, steel, -19.5, 1.14, 60.23, 0.041, 2.1)
  cylinder(city, steel, -16.1, 1.14, 60.23, 0.041, 2.1)
  addBikeRack(city, -19.9, 59.5, Math.PI * .32, ['#b15b48', '#768568', '#576b7b'])
  addBikeRack(city, 44, 31.32, Math.PI / 2, ['#bb975a', '#743e35'])
  addWaterfront(city, world, materials, bark, lights, fixtures)
  addSkyline(city)
  addLandmarks(city, world, materials)
  addGoCorridor(city, world)
  batchStatic(city)
  const updateDistricts = addDistricts(city, world, materials, bark, lights, retail, fixtures)
  fixtures.prepare()
  const updateLights = makeStreetLighting(scene, lights)
  let lightRev = fixtures.revision
  return {
    water,
    reflection,
    fixtures,
    updateLighting(anchor: THREE.Vector3) {
      updateShadows(anchor)
      updateLights(anchor, lightRev !== fixtures.revision)
      lightRev = fixtures.revision
      updateDistricts(anchor)
    },
  }
}
