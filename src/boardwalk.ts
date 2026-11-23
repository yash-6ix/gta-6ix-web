import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { box, cylinder, ellipsoid, matte } from './graphics'
import { fixed, showSign, surface } from './city-geometry'
import { BOARDWALK, BOUNDS, PIERS } from './layout'
import type { CityMaterials } from './materials'

const steel = new THREE.MeshStandardMaterial({ color: '#435052', metalness: .61, roughness: .4 })
const cleat = matte('#4c4a45')
const timber = matte('#775845')
const pilings = matte('#54413a')
const roofWood = matte('#544954')
const lampGlow = new THREE.MeshStandardMaterial({ color: '#ffe1af', emissive: '#ffc075', emissiveIntensity: 2.2 })
const rope = matte('#a38d70')

function railing(parent: THREE.Group, world: RAPIER.World, fromX: number, fromZ: number, toX: number, toZ: number) {
  const span = Math.hypot(toX - fromX, toZ - fromZ)
  const x = (fromX + toX) / 2
  const z = (fromZ + toZ) / 2
  const alongX = fromZ === toZ
  const w = alongX ? span : .12
  const d = alongX ? .12 : span
  box(parent, timber, x, 1.26, z, w, .087, d, false)
  for (const y of [.49, .73, .98]) box(parent, steel, x, y, z, w, .037, d, false)
  const bays = Math.ceil(span / 2.65)
  for (let i = 0; i <= bays; i++) {
    const mix = i / bays
    const px = THREE.MathUtils.lerp(fromX, toX, mix)
    const pz = THREE.MathUtils.lerp(fromZ, toZ, mix)
    box(parent, steel, px, .729, pz, .09, 1.08, .09, false)
    box(parent, steel, px, .191, pz, .22, .05, .22, false)
  }
  fixed(world, x, .74, z, alongX ? span + .07 : .14, 1.15, alongX ? .14 : span + .07)
}

function bollard(parent: THREE.Group, x: number, z: number) {
  cylinder(parent, steel, x, .355, z, .133, .35, false)
  cylinder(parent, steel, x, .538, z, .173, .075, false)
  cylinder(parent, cleat, x, .177, z, .175, .048, false)
}

function dockLight(parent: THREE.Group, x: number, z: number) {
  cylinder(parent, steel, x, .56, z, .092, .77, false)
  cylinder(parent, lampGlow, x, .966, z, .099, .105, false)
  cylinder(parent, steel, x, 1.033, z, .123, .048, false)
}

function mooringLine(parent: THREE.Group, start: THREE.Vector3, end: THREE.Vector3) {
  const middle = start.clone().lerp(end, .54)
  middle.y -= .24
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start, middle, end), 7, .027, 5, false), rope)
  parent.add(cable)
}

function addBoat(parent: THREE.Group, x: number, z: number, length: number, paint: string, side: number, edge: number) {
  const boat = new THREE.Group()
  boat.position.set(x, -.62, z)
  parent.add(boat)
  const stripe = matte(paint)
  const enamel = matte('#ddd6c6')
  const windows = new THREE.MeshStandardMaterial({ color: '#35556a', metalness: .57, roughness: .19 })
  ellipsoid(boat, stripe, 0, .09, 0, 1.43, .63, length * .5, false)
  ellipsoid(boat, enamel, 0, .4, 0, 1.32, .34, length * .49, false)
  box(boat, timber, 0, .65, 0, 1.62, .09, length * .59, false)
  box(boat, enamel, 0, 1.02, -.37, 1.63, .72, length * .24)
  box(boat, windows, 0, 1.23, -length * .12 - .428, 1.38, .31, .044, false)
  box(boat, stripe, 0, 1.43, -.34, 1.75, .115, length * .25, false)
  for (const facing of [-1, 1]) {
    box(boat, windows, facing * .825, 1.21, -.42, .044, .31, length * .19, false)
    box(boat, enamel, facing * .847, 1.22, -.42, .035, .35, .055, false)
    for (const fender of [-1.53, 1.56]) cylinder(boat, steel, facing * 1.33, .38, fender, .091, .38, false)
  }
  for (const end of [-1, 1]) {
    const tie = z + end * length * .49
    bollard(parent, edge, tie)
    mooringLine(parent, new THREE.Vector3(x - side * .97, .03, z + end * length * .32), new THREE.Vector3(edge, .49, tie))
  }
}

function lookout(parent: THREE.Group, world: RAPIER.World, x: number, z: number) {
  box(parent, roofWood, x, 2.75, z, 5.7, .205, 3.2)
  box(parent, timber, x, 2.59, z, 5.44, .13, 3.02, false)
  box(parent, lampGlow, x, 2.498, z, 2.58, .032, .105, false)
  for (const dx of [-2.52, 2.52]) {
    for (const dz of [-1.3, 1.3]) {
      box(parent, steel, x + dx, 1.35, z + dz, .14, 2.47, .14)
      fixed(world, x + dx, 1.4, z + dz, .18, 2.49, .18)
    }
  }
  box(parent, steel, x, .47, z + .94, 3.73, .29, .46, false)
  box(parent, timber, x, .651, z + .94, 3.89, .12, .53, false)
}

export function addBoardwalk(parent: THREE.Group, world: RAPIER.World, materials: CityMaterials) {
  const width = BOUNDS.east - BOUNDS.west
  const depth = BOARDWALK.south - BOARDWALK.north
  const center = (BOARDWALK.north + BOARDWALK.south) / 2
  const deckY = BOARDWALK.height
  const panelWidth = width / 8
  for (let i = 0; i < 8; i++) {
    const x = BOUNDS.west + (i + .5) * panelWidth
    box(parent, timber, x, deckY - .23, center, panelWidth, .45, depth, false)
    surface(parent, materials.surface('wood', Math.round(panelWidth / 2.35), 1.75), x, deckY, center, panelWidth, depth)
  }
  fixed(world, 0, deckY - .48, center, width, .96, depth)
  railing(parent, world, BOUNDS.west + .09, BOARDWALK.north, BOUNDS.west + .09, BOARDWALK.south)
  railing(parent, world, BOUNDS.east - .09, BOARDWALK.north, BOUNDS.east - .09, BOARDWALK.south)
  const seawall = matte('#8d918b')
  box(parent, seawall, 0, -.48, BOUNDS.shore - .28, width, 1.11, .83, false)
  for (let x = BOUNDS.west + 1; x < BOUNDS.east; x += 3.5) {
    box(parent, pilings, x, -.36, BOARDWALK.south - .11, .27, 1.29, .38, false)
  }
  for (let x = BOUNDS.west + 7; x < BOUNDS.east; x += 16) {
    if (PIERS.some(pier => Math.abs(pier.x - x) < pier.width * .5 + 1.4)) continue
    dockLight(parent, x, BOARDWALK.south - .45)
  }
  let lastRail = BOUNDS.west
  for (const [index, pier] of PIERS.entries()) {
    const { x, width, end, name } = pier
    const left = x - width / 2
    const right = x + width / 2
    const start = BOARDWALK.south
    const length = end - start
    const centerZ = (start + end) * .5
    railing(parent, world, lastRail, start - .08, left + .09, start - .08)
    railing(parent, world, left + .09, start - .08, left + .09, end - .1)
    railing(parent, world, right - .09, start - .08, right - .09, end - .1)
    railing(parent, world, left + .09, end - .1, right - .09, end - .1)
    lastRail = right - .09
    box(parent, timber, x, deckY - .28, centerZ, width, .55, length, false)
    surface(parent, materials.surface('wood', width / 3.6, length / 2.45), x, deckY, centerZ, width, length)
    fixed(world, x, deckY - .48, centerZ, width, .96, length)
    for (const side of [-1, 1]) {
      const edge = x + side * (width / 2 - .25)
      for (let z = start + 1.1; z < end; z += 3.65) {
        box(parent, pilings, edge, -.48, z, .42, 1.57, .46, false)
      }
      for (const z of [start + 3.85, end - 3.1]) dockLight(parent, edge - side * .23, z)
      bollard(parent, edge, start + 1.6)
    }
    const signX = right - 1.82
    const signZ = start + 1.4
    for (const dx of [-1.22, 1.22]) box(parent, steel, signX + dx, .79, signZ, .07, 1.32, .075, false)
    box(parent, steel, signX, 1.36, signZ, 2.76, .54, .092, false)
    showSign(parent, name.toUpperCase(), signX, 1.36, signZ - .052, 2.72, .49, '#305660').rotation.y = Math.PI
    showSign(parent, name.toUpperCase(), signX, 1.36, signZ + .052, 2.72, .49, '#305660')
    if (index !== 2) {
      const side = index === 1 ? -1 : 1
      const edge = x + side * (width / 2 - .3)
      addBoat(parent, edge + side * 2.65, end - 7.4, 7.1 + index * 1.3, index === 0 ? '#b16c4b' : '#366b74', side, edge)
      if (index !== 1) lookout(parent, world, x, end - 4.4)
    }
  }
  railing(parent, world, lastRail, BOARDWALK.south - .08, BOUNDS.east, BOARDWALK.south - .08)
}
