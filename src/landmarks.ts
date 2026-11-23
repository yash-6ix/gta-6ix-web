import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { box, cylinder, ellipsoid, matte } from './graphics'
import { fixed, showSign, surface } from './city-geometry'
import { CN_TOWER, ROGERS_CENTRE, UNION_STATION } from './layout'
import type { CityMaterials } from './materials'

type Profile = ReadonlyArray<readonly [radius: number, height: number]>

const limestone = matte('#b9b0a2')
const stoneBase = matte('#797878')
const concrete = matte('#a6a3a2')
const bronze = new THREE.MeshStandardMaterial({ color: '#403732', metalness: .48, roughness: .41 })
const glass = new THREE.MeshStandardMaterial({ color: '#414951', metalness: .62, roughness: .21, envMapIntensity: 1.22 })
const litGlass = new THREE.MeshStandardMaterial({ color: '#ab865d', emissive: '#f1ad63', emissiveIntensity: 1.1, roughness: .48 })
const redBeacon = new THREE.MeshStandardMaterial({ color: '#a84c4d', emissive: '#f7363c', emissiveIntensity: 2.5 })
const podLights = new THREE.MeshStandardMaterial({ color: '#d38d99', emissive: '#e35077', emissiveIntensity: 2.1 })

function radial(parent: THREE.Object3D, material: THREE.Material, profile: Profile, segments = 64) {
  const points = profile.map(([radius, height]) => new THREE.Vector2(radius, height))
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(points, segments), material)
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function towerShaft(tower: THREE.Group) {
  const sections = [
    [0, 3.03, 4.7], [4, 2.85, 3.9], [13, 2.62, 2.85], [25, 2.37, 1.85],
    [42, 1.96, 1.12], [59, 1.67, .63], [74, 1.44, .24], [92, 1.1, .11], [99, .85, .07],
  ]
  const positions: number[] = []
  const indices: number[] = []
  const sides = 60
  for (const [height, core, fins] of sections) {
    for (let i = 0; i < sides; i++) {
      const angle = i * Math.PI * 2 / sides
      const radius = core + Math.pow(.5 + .5 * Math.cos(angle * 3 + Math.PI), 2.5) * fins
      positions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
    }
  }
  for (let row = 1; row < sections.length; row++) {
    for (let side = 0; side < sides; side++) {
      const a = (row - 1) * sides + side
      const b = (row - 1) * sides + (side + 1) % sides
      indices.push(a, a + sides, b, b, a + sides, b + sides)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const shaft = new THREE.Mesh(geometry, concrete)
  tower.add(shaft)

  for (let i = 1; i < sections.length - 1; i++) {
    const [low, lowCore, lowFin] = sections[i - 1]
    const [high, highCore, highFin] = sections[i]
    const z1 = lowCore + lowFin * .177
    const z2 = highCore + highFin * .177
    const band = box(tower, glass, 0, (low + high) / 2, (z1 + z2) / 2 + .055, .39, Math.hypot(high - low, z2 - z1), .12, false)
    band.rotation.x = Math.atan2(z2 - z1, high - low)
  }
}

function addTower(parent: THREE.Group, world: RAPIER.World, materials: CityMaterials) {
  const { x, z, radius } = CN_TOWER
  surface(parent, materials.surface('paving', 7, 8), x + 2, .146, z + 1, 25, 28)
  const tower = new THREE.Group()
  tower.position.set(x, .15, z)
  parent.add(tower)
  radial(tower, stoneBase, [[0, .04], [radius, .04], [radius, .46], [7.7, .64], [0, .64]])
  radial(tower, limestone, [[0, .63], [5.5, .63], [5.5, 2.6], [5.1, 3.2], [0, 3.2]])
  towerShaft(tower)
  const centre = RAPIER.ColliderDesc.cylinder(1.45, 5.55).setTranslation(x, 1.6, z)
  world.createCollider(centre)
  for (const angle of [Math.PI / 3, Math.PI, Math.PI * 5 / 3]) {
    world.createCollider(RAPIER.ColliderDesc.cylinder(2.2, 1.3).setTranslation(x + Math.cos(angle) * 6.1, 2.25, z + Math.sin(angle) * 6.1))
  }
  box(tower, glass, 0, 1.6, 5.44, 4.9, 2.5, .22, false)
  box(tower, bronze, 0, 2.96, 5.26, 6.2, .24, 1.05)
  showSign(tower, 'CN TOWER', 0, 2.96, 5.8, 3.25, .37, '#404052')

  radial(tower, limestone, [[1.45, 71.6], [2.17, 72.3], [3.74, 74.3], [5.85, 76.1], [6.09, 76.5]])
  radial(tower, bronze, [[3.2, 73.8], [5.92, 76.13], [6.18, 76.6], [6.25, 77.03]])
  radial(tower, glass, [[6.27, 77.02], [6.62, 79.25], [6.67, 80.1]])
  for (const [y, radius] of [[76.97, 6.32], [78.05, 6.48], [79.29, 6.66], [80.18, 6.74]]) {
    radial(tower, limestone, [[radius - .12, y - .12], [radius, y - .105], [radius, y + .09]])
  }
  for (let i = 0; i < 58; i++) {
    const angle = i * Math.PI * 2 / 58
    const pane = box(tower, i % 5 < 2 ? litGlass : bronze,
      Math.sin(angle) * 6.53, 78.67, Math.cos(angle) * 6.53, .45, .68, .095, false)
    pane.rotation.y = angle
  }
  radial(tower, podLights, [[6.71, 80.11], [6.75, 80.17], [6.74, 80.23]])
  radial(tower, limestone, [[6.71, 80.26], [6.46, 80.65], [4.8, 81.63], [2.45, 82.8], [1.2, 82.8]])
  radial(tower, limestone, [[1.02, 95], [1.38, 95.24], [2.15, 96.37], [2.2, 96.52]])
  radial(tower, glass, [[2.2, 96.51], [2.35, 97.7], [2.22, 98.23]])
  radial(tower, limestone, [[2.23, 98.19], [2.28, 98.43], [1.28, 99.33], [.72, 99.48]])
  radial(tower, podLights, [[2.31, 98.23], [2.31, 98.31]])
  const antenna = [
    [.77, 99.3], [.59, 101.4], [.55, 101.48], [.44, 108.1],
    [.40, 108.12], [.34, 113.1], [.245, 113.14], [.17, 118.4], [.105, 121.6],
  ] as const
  radial(tower, limestone, antenna, 20)
  for (const [base, height, radius] of [[100.7, .42, .68], [104.2, .42, .58], [109.7, .36, .43], [114.8, .33, .22], [118.9, .26, .162]]) {
    radial(tower, matte('#a96c60'), [[radius, base], [radius, base + height]], 20)
  }
  ellipsoid(tower, redBeacon, 0, 121.65, 0, .16, .18, .16, false)
  tower.traverse(object => object.layers.enable(1))
}

function addRogersCentre(parent: THREE.Group, world: RAPIER.World, materials: CityMaterials) {
  const { x, z, rx, rz } = ROGERS_CENTRE
  surface(parent, materials.surface('paving', 15, 11), x, .146, z, 58, 39)
  const stadium = new THREE.Group()
  stadium.position.set(x, .15, z)
  parent.add(stadium)

  const oval = (material: THREE.Material, profile: Profile) => {
    const shape = radial(stadium, material, profile, 84)
    shape.scale.set(rx, 1, rz)
    return shape
  }
  oval(limestone, [[0, 0], [.98, 0], [1, .8], [1, 4], [.994, 5.1],
    [.964, 6.3], [.948, 8.8], [.911, 9.6], [.91, 10.15]])
  oval(glass, [[1.001, 3.58], [1.001, 4.12], [.994, 4.36]])
  oval(stoneBase, [[.969, 5.7], [.973, 6.02], [.962, 6.27], [.962, 6.53]])
  oval(glass, [[.951, 7.32], [.951, 8.1], [.947, 8.36]])
  oval(limestone, [[.953, 8.02], [.954, 8.28], [.937, 8.54]])
  const roofMaterial = new THREE.MeshStandardMaterial({ color: '#e1e6ee', roughness: .59, metalness: .32 })
  const roof = [[.915, 9.75], [.896, 10.9], [.851, 12.43], [.774, 13.86],
    [.65, 15.4], [.48, 16.68], [.25, 17.72], [0, 18.08]] as const
  oval(roofMaterial, roof)
  for (const i of [1, 3, 5]) {
    const [radius, y] = roof[i]
    const seam = oval(matte('#9ca6b1'), [[radius + .003, y - .08], [radius + .004, y + .065]])
    seam.scale.x *= 1.002
  }
  const seamMaterial = new THREE.LineBasicMaterial({ color: '#77818b', transparent: true, opacity: .58 })
  for (let i = 0; i < 12; i++) {
    const angle = (i + .5) * Math.PI / 6
    const points = roof.map(([r, y]) => new THREE.Vector3(Math.sin(angle) * (r + .002) * rx, y + .03, Math.cos(angle) * (r + .002) * rz))
    stadium.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), seamMaterial))
  }
  oval(matte('#a2a5ab'), [[.907, 9.64], [.919, 9.66], [.919, 9.79], [.913, 9.9]])
  for (let i = 0; i < 68; i++) {
    const angle = i * Math.PI * 2 / 68
    const pillar = box(stadium, concrete, Math.sin(angle) * rx * .995, 2.3, Math.cos(angle) * rz * .997, .38, 3.4, .36, false)
    pillar.rotation.y = angle
    if (i % 3 !== 0) continue
    const window = box(stadium, litGlass, Math.sin(angle) * rx * .953, 7.75, Math.cos(angle) * rz * .956, .77, .32, .11, false)
    window.rotation.y = angle
  }
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const entrance = new THREE.Group()
    entrance.position.set(Math.sin(angle) * rx * .985, 0, Math.cos(angle) * rz * .984)
    entrance.rotation.y = angle
    stadium.add(entrance)
    box(entrance, bronze, 0, 1.56, .19, 7.7, 2.68, .47)
    for (let gate = -3; gate <= 3; gate++) {
      box(entrance, glass, gate * .98, 1.43, .444, .86, 2.22, .086, false)
      box(entrance, litGlass, gate * .98, 2.58, .466, .74, .09, .06, false)
    }
    box(entrance, limestone, 0, 3.36, .36, 8.42, .29, .89)
    showSign(entrance, 'ROGERS CENTRE', 0, 4.66, .55, 8.14, 1.12, '#253c56')
  }
  const boundary: number[] = []
  for (const y of [0, 9.7]) {
    for (let i = 0; i < 40; i++) {
      const angle = i / 40 * Math.PI * 2
      boundary.push(Math.sin(angle) * rx, y, Math.cos(angle) * rz)
    }
  }
  const collider = RAPIER.ColliderDesc.convexHull(new Float32Array(boundary))
  if (collider) world.createCollider(collider.setTranslation(x, .15, z))
  stadium.traverse(object => object.layers.enable(1))
}

function addUnionStation(parent: THREE.Group, world: RAPIER.World, materials: CityMaterials) {
  const { x, z, width, depth } = UNION_STATION
  const station = new THREE.Group()
  station.position.set(x, 0, z)
  parent.add(station)
  surface(parent, materials.surface('paving', 14, 10), x, .145, z, width + 5, 39)
  box(station, limestone, 0, 5.2, 0, width, 10.2, depth)
  box(station, matte('#717c84'), 0, 10.31, 0, width + .62, .35, depth + .38)
  box(station, limestone, 0, 10.75, 0, 32, 1.2, 13.4)
  box(station, concrete, 0, 11.44, 0, 32.7, .3, 13.9)
  for (const direction of [-1, 1]) {
    const porch = new THREE.Group()
    porch.position.z = direction * depth / 2
    porch.rotation.y = direction === -1 ? Math.PI : 0
    station.add(porch)
    box(porch, stoneBase, 0, .22, .83, 30.4, .38, 2.4)
    box(porch, limestone, 0, .58, .57, 30.1, .42, 2.12)
    box(porch, limestone, 0, 8.39, .49, 30.8, .68, 2)
    box(porch, concrete, 0, 8.89, .49, 31.8, .36, 2.3)
    for (let i = -5; i <= 5; i++) {
      const lx = i * 2.77
      cylinder(porch, limestone, lx, 4.4, 1.11, .355, 7.48)
      cylinder(porch, concrete, lx, 7.99, 1.11, .51, .37, false)
      box(porch, limestone, lx, .74, 1.11, .93, .32, .94)
      box(porch, bronze, lx + 1.38, 3.1, .034, 1.39, 3.9, .1, false)
      box(porch, litGlass, lx + 1.38, 4.32, .092, 1.06, 1.24, .13, false)
    }
    showSign(porch, 'UNION STATION', 0, 8.49, 1.517, 9.5, .58, '#444951')
    for (const wing of [-19, 19]) {
      for (const dx of [-2.5, 0, 2.5]) {
        box(porch, stoneBase, wing + dx, 4.4, .028, 1.48, 4.65, .12, false)
        box(porch, glass, wing + dx, 4.45, .108, 1.19, 4.27, .1, false)
        box(porch, litGlass, wing + dx, 2.91, .17, 1.065, .77, .04, false)
      }
    }
  }
  fixed(world, x, 5.2, z, width, 10.2, depth)
  station.traverse(object => object.layers.enable(1))
}

export function addLandmarks(parent: THREE.Group, world: RAPIER.World, materials: CityMaterials) {
  addTower(parent, world, materials)
  addRogersCentre(parent, world, materials)
  addUnionStation(parent, world, materials)
}
