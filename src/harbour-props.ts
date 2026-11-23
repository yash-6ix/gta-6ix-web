import * as THREE from 'three'
import { box, canvasTexture, cylinder, ellipsoid, matte } from './graphics'

const steel = new THREE.MeshStandardMaterial({ color: '#4e575e', metalness: .63, roughness: .42 })
const deckLight = new THREE.MeshStandardMaterial({ color: '#ffe1b0', emissive: '#ffaf67', emissiveIntensity: 2.2 })

function link(parent: THREE.Object3D, material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
  const center = from.clone().lerp(to, .5)
  const tube = cylinder(parent, material, center.x, center.y, center.z, radius, from.distanceTo(to), false)
  tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
}

export function addBikeRack(parent: THREE.Object3D, x: number, z: number, yaw: number, colors: readonly string[]) {
  const rack = new THREE.Group()
  rack.position.set(x, .14, z)
  rack.rotation.y = yaw
  const wheel = new THREE.TorusGeometry(.325, .032, 8, 28)
  const rim = new THREE.TorusGeometry(.298, .013, 7, 24)
  const tire = matte('#26252d')
  const saddle = matte('#282632')
  parent.add(rack)
  for (const [index, color] of colors.entries()) {
    const offset = (index - (colors.length - 1) * .5) * .62
    const bike = new THREE.Group()
    bike.position.set(offset, 0, index % 2 * .22)
    rack.add(bike)
    const paint = matte(color)
    for (const dz of [-.51, .52]) {
      const tireMesh = new THREE.Mesh(wheel, tire)
      tireMesh.position.set(0, .355, dz)
      tireMesh.rotation.y = Math.PI / 2
      bike.add(tireMesh)
      const rimMesh = new THREE.Mesh(rim, steel)
      rimMesh.position.copy(tireMesh.position)
      rimMesh.rotation.copy(tireMesh.rotation)
      bike.add(rimMesh)
      for (let i = 0; i < 6; i++) {
        const angle = i / 6 * Math.PI
        const spoke = box(bike, steel, 0, .355, dz, .012, .57, .008, false)
        spoke.rotation.x = angle
      }
    }
    const rear = new THREE.Vector3(0, .36, .52)
    const crank = new THREE.Vector3(0, .43, .13)
    const seat = new THREE.Vector3(0, .83, .22)
    const fork = new THREE.Vector3(0, .84, -.35)
    const front = new THREE.Vector3(0, .36, -.51)
    for (const [a, b] of [[rear, crank], [crank, seat], [rear, seat], [crank, fork], [seat, fork], [fork, front]]) link(bike, paint, a, b, .022)
    box(bike, saddle, 0, .86, .236, .15, .043, .21, false)
    link(bike, steel, fork, new THREE.Vector3(0, .99, -.39), .024)
    box(bike, saddle, 0, .984, -.39, .45, .024, .038, false)
    const stand = box(rack, steel, offset + .2, .39, 0, .035, .78, .29, false)
    stand.rotation.x = .15
  }
}

export function addFerry(parent: THREE.Object3D) {
  const ferry = new THREE.Group()
  ferry.position.set(54.1, -.45, 115.8)
  parent.add(ferry)
  const navy = matte('#294452')
  const white = matte('#d5c4b2')
  const red = matte('#875344')
  const black = matte('#233442')
  ellipsoid(ferry, navy, 0, .32, 0, 2.39, .81, 10.1)
  box(ferry, red, 0, .77, 0, 4.07, .26, 16.8)
  box(ferry, white, 0, 1.02, 0, 4.04, .31, 16.8)
  box(ferry, matte('#b19982'), 0, 1.28, 0, 3.86, .24, 15.37)
  box(ferry, white, 0, 2.1, .35, 3.36, 1.75, 10.43)
  box(ferry, navy, 0, 3.04, -.25, 3.69, .28, 10.62)
  box(ferry, white, 0, 3.48, -2.8, 2.44, .74, 3.05)
  box(ferry, navy, 0, 3.9, -2.8, 2.61, .13, 3.19)
  const nameMap = canvasTexture(512, 80, (ctx) => {
    ctx.fillStyle = '#233b4a'
    ctx.fillRect(0, 0, 512, 80)
    ctx.font = '800 39px system-ui'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffe9c7'
    ctx.fillText('HARBOUR LINE', 256, 55)
  })
  const name = new THREE.MeshStandardMaterial({ map: nameMap, emissiveMap: nameMap, emissive: '#eeac70', emissiveIntensity: .6 })
  for (const side of [-1, 1]) {
    for (let window = -4; window <= 4; window++) {
      const z = window * 1.03 + .24
      box(ferry, black, side * 1.681, 2.27, z, .067, .83, .91, false)
      box(ferry, window % 3 ? deckLight : black, side * 1.72, 2.28, z, .027, .66, .765, false)
    }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.9, .43), name)
    label.position.set(side * 2.043, .98, -1.8)
    label.rotation.y = side * Math.PI / 2
    ferry.add(label)
    for (const z of [-7.8, -6.5, 6.4, 7.8]) {
      cylinder(ferry, steel, side * 1.83, 1.63, z, .045, .74, false)
    }
    for (const z of [-7.09, 7.09]) box(ferry, steel, side * 1.85, 1.99, z, .049, .06, 1.5, false)
  }
  cylinder(ferry, steel, 0, 4.78, -3.65, .05, 1.8, false)
  box(ferry, deckLight, 0, 5.3, -3.65, .23, .17, .19, false)
  for (const x of [-.84, 0, .84]) box(ferry, black, x, 3.59, -4.297, .76, .31, .033, false)
}
