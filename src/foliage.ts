import * as THREE from 'three'
import { canvasTexture, randomize } from './graphics'

const leafMaterial = new THREE.MeshStandardMaterial({
  map: canvasTexture(192, 192, (ctx) => {
    const wash = ctx.createLinearGradient(20, 105, 160, 40)
    wash.addColorStop(0, '#706548')
    wash.addColorStop(0.48, '#cdc6a7')
    wash.addColorStop(1, '#fbf5e4')
    ctx.fillStyle = wash
    ctx.beginPath()
    ctx.moveTo(22, 149)
    ctx.bezierCurveTo(30, 105, 45, 53, 157, 27)
    ctx.bezierCurveTo(151, 66, 134, 137, 23, 149)
    ctx.fill()
    ctx.strokeStyle = '#fff5cc60'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(22, 154)
    ctx.quadraticCurveTo(90, 77, 155, 29)
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(46 + i * 18, 126 - i * 17)
      ctx.lineTo(50 + i * 20, 144 - i * 18)
      ctx.moveTo(51 + i * 19, 117 - i * 17)
      ctx.lineTo(39 + i * 25, 99 - i * 18)
    }
    ctx.stroke()
  }),
  alphaTest: 0.56,
  alphaToCoverage: true,
  side: THREE.DoubleSide,
  vertexColors: true,
  roughness: 0.92,
  envMapIntensity: 0.23,
  emissive: '#9a5523',
  emissiveIntensity: 0.105,
})
const twigGeometry = new THREE.CylinderGeometry(0.57, 1, 1, 9)
const branchBase = new THREE.Vector3(0, 1, 0)

function limb(tree: THREE.Group, bark: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, rootRadius: number) {
  const axis = new THREE.Vector3().subVectors(to, from)
  const branch = new THREE.Mesh(twigGeometry, bark)
  branch.position.copy(from).addScaledVector(axis, 0.5)
  branch.quaternion.setFromUnitVectors(branchBase, axis.clone().normalize())
  branch.scale.set(rootRadius, axis.length(), rootRadius)
  branch.castShadow = branch.receiveShadow = true
  tree.add(branch)
}

const palette = [
  ['#c08439', '#d8ad54', '#bc8534', '#ad662c', '#e1b45e'],
  ['#7e914a', '#a5aa56', '#829947', '#a8aa5d', '#c2ac5e'],
  ['#b94d2c', '#c36c39', '#ce783c', '#a84829', '#e4995f'],
]
const variants = new Map<number, { crown: THREE.BufferGeometry; branches: THREE.Vector3[][] }>()

function mapleVariant(index: number) {
  const ready = variants.get(index)
  if (ready) return ready

  const rnd = randomize(4451 + index * 191)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const branches: THREE.Vector3[][] = []
  const hues = palette[index % palette.length].map((hex) => new THREE.Color(hex))
  const side = new THREE.Vector3()
  const up = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const center = new THREE.Vector3()
  const diffuse = new THREE.Color()
  const uvCorners = [[0, 0], [1, 0], [1, 1], [0, 1]]

  function leafCluster(root: THREE.Vector3, width: number, height: number, leaves: number) {
    const variantColor = hues[Math.floor(rnd() * hues.length)]
    for (let i = 0; i < leaves; i++) {
      const radius = Math.pow(rnd(), 0.43)
      const azimuth = rnd() * Math.PI * 2
      const y = rnd() * 2 - 1
      const outer = Math.sqrt(1 - y * y) * radius
      offset.set(Math.cos(azimuth) * outer * width, y * radius * height, Math.sin(azimuth) * outer * width)
      center.copy(root).add(offset)
      normal.copy(offset).normalize()
      normal.y += 0.61
      normal.normalize()
      const bearing = rnd() * Math.PI * 2
      const tilt = 0.24 + rnd() * 0.65
      side.set(Math.cos(bearing), tilt * Math.sin(bearing * 3), Math.sin(bearing)).normalize()
      up.crossVectors(normal, side).normalize()
      side.crossVectors(up, normal)
      const size = 0.155 + rnd() * 0.21
      side.multiplyScalar(size * (0.64 + rnd() * 0.26))
      up.multiplyScalar(size)
      diffuse.copy(variantColor).multiplyScalar(0.64 + radius * 0.36 + rnd() * 0.31)
      const base = positions.length / 3
      for (const [u, v] of uvCorners) {
        const sx = u * 2 - 1
        const sy = v * 2 - 1
        positions.push(center.x + sx * side.x + sy * up.x, center.y + sx * side.y + sy * up.y, center.z + sx * side.z + sy * up.z)
        normals.push(normal.x, normal.y, normal.z)
        colors.push(diffuse.r, diffuse.g, diffuse.b)
        uvs.push(u, v)
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  for (let i = 0; i < 8; i++) {
    const bearing = i * 2.39996 + rnd() * 0.43
    const span = 0.89 + rnd() * 0.88
    const stem = new THREE.Vector3(0.04, 1.5 + i * 0.25, 0)
    const joint = new THREE.Vector3(Math.cos(bearing) * span * 0.57, stem.y + 0.93, Math.sin(bearing) * span * 0.57)
    const tip = new THREE.Vector3(Math.cos(bearing) * span, joint.y + 0.77 + rnd() * 0.39, Math.sin(bearing) * span)
    const fork = new THREE.Vector3(Math.cos(bearing + 0.62) * span, tip.y - 0.39, Math.sin(bearing + 0.62) * span)
    branches.push([stem, joint, tip, fork])
    leafCluster(tip, 0.76, 0.73, 115)
    leafCluster(fork, 0.69, 0.46, 85)
  }
  leafCluster(new THREE.Vector3(0.1, 4.15, 0.03), 0.98, 0.89, 160)
  const crown = new THREE.BufferGeometry()
  crown.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  crown.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  crown.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  crown.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  crown.setIndex(indices)
  crown.computeBoundingSphere()
  const variant = { crown, branches }
  variants.set(index, variant)
  return variant
}

export function plantMaple(parent: THREE.Object3D, bark: THREE.Material, x: number, y: number, z: number, size: number, seed: number) {
  const tree = new THREE.Group()
  const variant = mapleVariant(seed % 6)
  tree.position.set(x, y, z)
  tree.rotation.y = seed * 2.31
  tree.scale.set(size, size * (0.90 + (seed % 5) * 0.048), size)
  parent.add(tree)
  const trunkBend = new THREE.Vector3(0.05, 2.0, -0.044)
  limb(tree, bark, new THREE.Vector3(0, 0, 0), trunkBend, 0.167)
  limb(tree, bark, trunkBend, new THREE.Vector3(0.04, 3.88, 0.046), 0.104)
  for (const [stem, joint, tip, fork] of variant.branches) {
    limb(tree, bark, stem, joint, 0.085)
    limb(tree, bark, joint, tip, 0.045)
    limb(tree, bark, joint, fork, 0.034)
  }
  const leaves = new THREE.Mesh(variant.crown, leafMaterial)
  leaves.castShadow = leaves.receiveShadow = true
  tree.add(leaves)
}
