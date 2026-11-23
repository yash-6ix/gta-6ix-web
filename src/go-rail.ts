import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { batchStatic, fixed, showSign } from './city-geometry'
import { box, cylinder, matte } from './graphics'
import { BOUNDS, CITY_WIDTH, GO_RAIL } from './layout'

const tail = 77
const trackEnd = BOUNDS.east + tail + 70
const wrapTrack = (distance: number) => THREE.MathUtils.euclideanModulo(distance + trackEnd, trackEnd * 2) - trackEnd
const stone = matte('#777579')
const girder = matte('#515b60')
const darkTie = matte('#574940')
const ballast = matte('#666369')
const steel = new THREE.MeshStandardMaterial({ color: '#a9acab', metalness: .61, roughness: .52 })
const enamel = new THREE.MeshStandardMaterial({ color: '#e1e3d8', roughness: .47, metalness: .27 })
const deepGreen = matte('#187251')
const lime = matte('#83ab49')
const roof = matte('#788581')
const glazing = new THREE.MeshStandardMaterial({ color: '#22323e', metalness: .56, roughness: .24 })
const litGlazing = new THREE.MeshStandardMaterial({ color: '#b3996e', emissive: '#dca55c', emissiveIntensity: .68, roughness: .49 })
const headlight = new THREE.MeshStandardMaterial({ color: '#e4f5ff', emissive: '#d7e9ff', emissiveIntensity: 2.2 })
const marker = new THREE.MeshStandardMaterial({ color: '#b5434b', emissive: '#ff4b58', emissiveIntensity: 1.77 })

export function addGoCorridor(parent: THREE.Group, world: RAPIER.World) {
  const { deck, z, width, trackOffset } = GO_RAIL
  const span = 2 * (trackEnd + tail + 10)
  box(parent, stone, 0, deck - .38, z, span, .76, width, false)
  fixed(world, 0, deck - .38, z, CITY_WIDTH, .76, width)
  for (const side of [-1, 1]) {
    box(parent, girder, 0, deck - .26, z + side * width / 2, span, 1.03, .18, false)
    box(parent, matte('#a2998b'), 0, deck + .281, z + side * width / 2, span, .095, .25, false)
    const track = z + side * trackOffset
    box(parent, ballast, 0, deck + .045, track, span, .092, 3.17, false)
    for (const rail of [-.75, .75]) {
      box(parent, steel, 0, deck + .158, track + rail, span, .104, .081, false)
    }
    for (let x = -span / 2 + .4; x < span / 2; x += 1.1) {
      box(parent, darkTie, x, deck + .091, track, .28, .076, 2.46, false)
    }
  }

  for (const avenue of [-160, -74, 0, 74, 160]) {
    for (const side of [-1, 1]) {
      const x = avenue + side * 12
      box(parent, stone, x, 2.42, z, 1.69, 4.84, 4.6)
      box(parent, girder, x, 4.76, z, 3.57, .74, 7.94)
      fixed(world, x, 2.45, z, 1.69, 4.9, 4.6)
    }
    box(parent, girder, avenue, 4.72, z + width / 2 - .07, 22.4, 1.01, .179, false)
  }
  for (const x of [-210, -190, -128, -105, -43, -29, 33, 49, 103, 124, 187, 207]) {
    box(parent, stone, x, 2.43, z, 1.7, 4.94, 3.9)
    box(parent, girder, x, 4.7, z, 4.25, .45, 7.8, false)
    fixed(world, x, 2.45, z, 1.7, 4.9, 3.9)
  }
  for (const side of [-1, 1]) {
    for (let x = BOUNDS.east + 8; x < span / 2; x += 18) {
      box(parent, stone, side * x, 2.42, z, 1.67, 4.84, 4.4, false)
    }
  }
  for (const x of [35, 60]) {
    showSign(parent, 'GO TRANSIT · UNION', x, 4.72, z + width / 2 + .106, 6.2, .44, '#216048')
  }
}

function rounded(parent: THREE.Group, material: THREE.Material, x: number, y: number, length: number, height: number, width: number, radius: number) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(length, height, width, 3, radius), material)
  mesh.position.set(x, y, 0)
  parent.add(mesh)
}

function gear(car: THREE.Group, halfLength: number) {
  box(car, girder, 0, .58, 0, halfLength * 1.65, .47, 2.23, false)
  for (const bogie of [-1, 1]) {
    const x = bogie * (halfLength - 2.02)
    box(car, girder, x, .53, 0, 2.52, .55, 2.65, false)
    for (const step of [-.71, .71]) {
      const wheel = cylinder(car, girder, x + step, .39, 0, .39, 2.24, false)
      wheel.rotation.x = Math.PI / 2
    }
  }
  for (const end of [-1, 1]) box(car, girder, end * halfLength, .68, 0, .95, .22, .44, false)
}

function coach(hasCab: boolean, variant: number) {
  const car = new THREE.Group()
  gear(car, 8.25)
  rounded(car, enamel, 0, 1.97, 16.5, 2.56, 3.2, .24)
  rounded(car, enamel, 0, 3.54, 12.36, 1.78, 3.14, .29)
  rounded(car, roof, 0, 4.35, 12.03, .24, 2.9, .13)
  rounded(car, glazing, -8.08, 2.57, .35, 2.37, 1.58, .15)
  rounded(car, glazing, 8.08, 2.57, .35, 2.37, 1.58, .15)
  for (const side of [-1, 1]) {
    box(car, deepGreen, 0, 1.14, side * 1.57, 16.37, .54, .073, false)
    box(car, lime, 0, 1.455, side * 1.6, 16.2, .092, .033, false)
    box(car, deepGreen, 0, 4.145, side * 1.506, 11.61, .083, .055, false)
    for (const x of [-6.67, 6.67]) {
      box(car, deepGreen, x, 1.97, side * 1.605, 1.35, 2.45, .064, false)
      box(car, glazing, x, 2.61, side * 1.643, .93, .54, .03, false)
      box(car, roof, x, 1.98, side * 1.651, .04, 2.22, .028, false)
    }
    for (let window = -3; window <= 3; window++) {
      const x = window * 1.56
      box(car, glazing, x, 2.095, side * 1.612, 1.31, .71, .038, false)
      box(car, glazing, x, 3.61, side * 1.575, 1.31, .76, .058, false)
      if ((window + variant + 3) % 3 !== 1) {
        box(car, litGlazing, x, 3.65, side * 1.611, 1.11, .51, .014, false)
        box(car, litGlazing, x, 2.122, side * 1.64, 1.13, .48, .016, false)
      }
    }
    const sign = new THREE.Group()
    sign.position.set(3.88, 2.753, side * 1.625)
    if (side < 0) sign.rotation.y = Math.PI
    car.add(sign)
    showSign(sign, 'GO TRANSIT', 0, 0, .023, 2.53, .31, '#217350')
    if (hasCab) box(car, marker, -8.31, 2.76, side * .93, .041, .11, .19, false)
  }
  return car
}

function locomotive() {
  const engine = new THREE.Group()
  gear(engine, 6.25)
  rounded(engine, deepGreen, -.3, 2.55, 11.86, 3.2, 3.11, .31)
  rounded(engine, enamel, 4.53, 2.85, 3.24, 2.77, 3.07, .32)
  rounded(engine, deepGreen, 5.43, 1.77, 1.78, 1.38, 3.11, .24)
  rounded(engine, lime, 5.96, 1.14, .91, .28, 3.15, .095)
  rounded(engine, roof, -.9, 4.17, 9.8, .19, 2.82, .075)
  for (const side of [-1, 1]) {
    box(engine, lime, -.85, 1.24, side * 1.567, 10.67, .21, .06, false)
    box(engine, glazing, 4.79, 3.5, side * 1.549, 1.55, .6, .035, false)
    const sideSign = new THREE.Group()
    sideSign.position.set(.19, 2.51, side * 1.573)
    if (side < 0) sideSign.rotation.y = Math.PI
    engine.add(sideSign)
    showSign(sideSign, 'GO', 0, 0, .015, 3.12, 1.33, '#187251')
    const windscreen = box(engine, glazing, 6.085, 3.52, side * .62, .06, .7, 1.04, false)
    windscreen.rotation.z = .18
    box(engine, headlight, 6.341, 2.26, side * .963, .05, .19, .23, false)
  }
  box(engine, headlight, 6.162, 3.085, 0, .045, .14, .31, false)
  return engine
}

export function makeGoService(scene: THREE.Scene) {
  const trains = [1, -1].map((direction, index) => {
    const group = new THREE.Group()
    group.rotation.y = direction === 1 ? 0 : Math.PI
    scene.add(group)
    const units = [locomotive(), ...[0, 1, 2, 3].map(unit => coach(unit === 3, index + unit))]
    for (const [part, unit] of units.entries()) {
      unit.traverse(object => object.layers.enable(1))
      batchStatic(unit)
      unit.position.x = part === 0 ? 0 : -15.1 - (part - 1) * 17.27
      group.add(unit)
    }
    const z = GO_RAIL.z + direction * GO_RAIL.trackOffset
    return { group, units, direction, z }
  })

  return (elapsed: number, anchor: THREE.Vector3) => {
    let closest = Infinity
    let closestX = 0
    let closestZ = 0
    for (const [index, train] of trains.entries()) {
      const start = index === 0 ? -45 : -205
      const speed = index === 0 ? 11.4 : 10.6
      const x = train.direction * wrapTrack(start + elapsed * speed)
      train.group.position.set(x, GO_RAIL.deck + .208, train.z)
      for (const unit of train.units) {
        unit.visible = Math.abs(anchor.z - train.z) < 242 && Math.abs(anchor.x - (x + train.direction * unit.position.x)) < 253
      }
      const lastX = x - train.direction * tail
      const trainX = THREE.MathUtils.clamp(anchor.x, Math.min(x, lastX), Math.max(x, lastX))
      const gap = Math.hypot(anchor.x - trainX, anchor.z - train.z, GO_RAIL.deck)
      if (gap < closest) {
        closest = gap
        closestX = trainX
        closestZ = train.z
      }
    }
    return { distance: closest, x: closestX, z: closestZ }
  }
}
