import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { canvasTexture } from './graphics'

export function fixed(world: RAPIER.World, x: number, y: number, z: number, w: number, h: number, d: number) {
  return world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z))
}

export function surface(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, d: number) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material)
  mesh.position.set(x, y, z)
  mesh.rotation.x = -Math.PI / 2
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export function showSign(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width: number, height: number, background: string) {
  const map = canvasTexture(512, 96, (ctx) => {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, 512, 96)
    ctx.strokeStyle = '#efcea472'
    ctx.lineWidth = 2
    ctx.strokeRect(8, 8, 496, 80)
    ctx.fillStyle = '#fff1ce'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '800 49px system-ui, sans-serif'
    ctx.fillText(text, 256, 49, 465)
  })
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map, roughness: 0.69, emissive: '#fff1ce', emissiveIntensity: 0.64, emissiveMap: map }),
  )
  sign.position.set(x, y, z)
  sign.layers.enable(1)
  sign.receiveShadow = true
  parent.add(sign)
  return sign
}

export function batchStatic(parent: THREE.Group) {
  parent.updateMatrixWorld(true)
  const batches = new Map<string, THREE.Mesh[]>()
  parent.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material) || object.material.transparent || object.material.type === 'ShaderMaterial') return
    const key = [object.geometry.uuid, object.material.uuid, object.castShadow, object.receiveShadow, object.layers.mask].join('/')
    const group = batches.get(key) ?? []
    group.push(object)
    batches.set(key, group)
  })
  for (const meshes of batches.values()) {
    if (meshes.length < 4) continue
    const first = meshes[0]
    const instances = new THREE.InstancedMesh(first.geometry, first.material, meshes.length)
    instances.castShadow = first.castShadow
    instances.receiveShadow = first.receiveShadow
    instances.layers.mask = first.layers.mask
    meshes.forEach((mesh, index) => {
      instances.setMatrixAt(index, mesh.matrixWorld)
      mesh.removeFromParent()
    })
    instances.computeBoundingSphere()
    parent.add(instances)
  }
}

