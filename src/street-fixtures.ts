import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { fixed } from './city-geometry'
import type { LampPosition } from './street-lighting'

type Kind = 'lamp' | 'signal' | 'sign' | 'bin'
type FixtureMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material>
type Slot = { mesh: FixtureMesh; batch: THREE.InstancedMesh; index: number; lens: boolean }
type Fixture = {
  group: THREE.Group
  collider: RAPIER.Collider
  kind: Kind
  light?: LampPosition
  slots: Slot[]
  base: THREE.Vector3
  fall: { time: number; duration: number; axis: THREE.Vector3; nudge: THREE.Vector3 } | null
}

const thresholds: Record<Kind, number> = { lamp: 3.65, signal: 3.4, sign: 2.7, bin: 2.2 }
const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
const unlit = new THREE.MeshStandardMaterial({ color: '#364047', roughness: .58 })

export function makeStreetFixtures(parent: THREE.Group, world: RAPIER.World) {
  const root = new THREE.Group()
  parent.add(root)
  const props = new Map<number, Fixture>()
  const falling = new Set<Fixture>()
  const broken = new Set<Fixture>()
  let revision = 0

  function write(fixture: Fixture, visible: boolean) {
    if (visible) fixture.group.updateMatrixWorld(true)
    for (const { mesh, batch, index, lens } of fixture.slots) {
      batch.setMatrixAt(index, visible && !(lens && broken.has(fixture)) ? mesh.matrixWorld : hidden)
      batch.instanceMatrix.needsUpdate = true
    }
  }

  return {
    get revision() { return revision },
    mount(kind: Kind, x: number, y: number, z: number, width: number, height: number, depth: number, light?: LampPosition) {
      const group = new THREE.Group()
      group.position.set(x, y, z)
      const collider = fixed(world, x, y + height / 2, z, width, height, depth)
      props.set(collider.handle, { group, collider, kind, light, slots: [], base: group.position.clone(), fall: null })
      return group
    },
    prepare() {
      const meshes = new Map<string, Array<{ fixture: Fixture; mesh: FixtureMesh }>>()
      for (const fixture of props.values()) {
        const { group, base } = fixture
        group.updateMatrixWorld(true)
        const chunk = `${Math.floor(base.x / 75)}/${Math.floor(base.z / 75)}`
        group.traverse(object => {
          if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return
          const mesh = object as FixtureMesh
          const key = [chunk, mesh.geometry.uuid, mesh.material.uuid, mesh.layers.mask, mesh.castShadow, mesh.receiveShadow].join('/')
          const entries = meshes.get(key) ?? []
          entries.push({ fixture, mesh })
          meshes.set(key, entries)
        })
      }
      for (const entries of meshes.values()) {
        const first = entries[0].mesh
        const batch = new THREE.InstancedMesh(first.geometry, first.material, entries.length)
        batch.layers.mask = first.layers.mask
        batch.castShadow = first.castShadow
        batch.receiveShadow = first.receiveShadow
        entries.forEach(({ fixture, mesh }, index) => {
          batch.setMatrixAt(index, mesh.matrixWorld)
          fixture.slots.push({ mesh, batch, index, lens: Boolean(mesh.userData.fixtureLens) })
        })
        batch.computeBoundingSphere()
        if (batch.boundingSphere) batch.boundingSphere.radius += 5
        root.add(batch)
      }
    },
    strike(handle: number, direction: THREE.Vector3, closingSpeed: number) {
      const fixture = props.get(handle)
      if (!fixture || broken.has(fixture) || closingSpeed < thresholds[fixture.kind]) return false
      const { group, collider, kind } = fixture
      collider.setEnabled(false)
      if (fixture.light) fixture.light.active = false
      broken.add(fixture)
      falling.add(fixture)
      revision++
      write(fixture, false)
      for (const { mesh, lens } of fixture.slots) if (lens) mesh.material = unlit
      root.add(group)
      const axis = new THREE.Vector3(direction.z, 0, -direction.x).normalize()
      const duration = THREE.MathUtils.clamp(.74 - closingSpeed * .018, .31, .68)
      const nudge = direction.clone().multiplyScalar(kind === 'bin' ? .78 : .26)
      fixture.fall = { time: 0, duration, axis, nudge }
      return true
    },
    step(dt: number) {
      for (const fixture of falling) {
        const { group, base, fall } = fixture
        if (!fall) continue
        fall.time += dt
        const progress = Math.min(1, fall.time / fall.duration)
        // A late bounce is kept small so the detached fixture settles against the curb.
        const angle = 1.52 * Math.sin(Math.PI * .5 * progress) + Math.sin(progress * Math.PI * 3) * progress * .07
        group.quaternion.setFromAxisAngle(fall.axis, angle)
        group.position.copy(base).addScaledVector(fall.nudge, progress)
        group.position.y += Math.sin(progress * Math.PI) * .09
        if (progress < 1) continue
        write(fixture, true)
        group.removeFromParent()
        fixture.fall = null
        falling.delete(fixture)
      }
    },
    reset() {
      for (const fixture of broken) {
        fixture.group.removeFromParent()
        fixture.group.position.copy(fixture.base)
        fixture.group.rotation.set(0, 0, 0)
        fixture.fall = null
        fixture.collider.setEnabled(true)
        if (fixture.light) fixture.light.active = true
        for (const { mesh, batch, lens } of fixture.slots) if (lens) mesh.material = batch.material as THREE.Material
      }
      const restored = [...broken]
      broken.clear()
      falling.clear()
      for (const fixture of restored) write(fixture, true)
      if (restored.length) revision++
    },
  }
}
