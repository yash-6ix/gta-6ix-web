import * as THREE from 'three'

const materials = new Map<string, THREE.MeshStandardMaterial>()
const boxGeometry = new THREE.BoxGeometry()
const circleGeometry = new THREE.CylinderGeometry(1, 1, 1, 12)
const ballGeometry = new THREE.IcosahedronGeometry(1, 2)

export function matte(color: string) {
  let material = materials.get(color)
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.82 })
    materials.set(color, material)
  }
  return material
}

export function box(
  parent: THREE.Object3D, material: THREE.Material | THREE.Material[],
  x: number, y: number, z: number, w: number, h: number, d: number, shadow = true,
) {
  const mesh = new THREE.Mesh(boxGeometry, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(w, h, d)
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export function cylinder(
  parent: THREE.Object3D, material: THREE.Material,
  x: number, y: number, z: number, radius: number, height: number, shadow = true,
) {
  const mesh = new THREE.Mesh(circleGeometry, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(radius, height, radius)
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export function ellipsoid(
  parent: THREE.Object3D, material: THREE.Material,
  x: number, y: number, z: number, rx: number, ry: number, rz: number, shadow = true,
) {
  const mesh = new THREE.Mesh(ballGeometry, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(rx, ry, rz)
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas graphics are unavailable')
  paint(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function randomize(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
