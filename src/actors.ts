import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { box, canvasTexture, cylinder, ellipsoid, matte } from './graphics'

const navy = matte('#283239')
const roundedParts = new Map<string, RoundedBoxGeometry>()
const fabricTexture = canvasTexture(160, 160, (ctx) => {
  ctx.fillStyle = '#979797'
  ctx.fillRect(0, 0, 160, 160)
  for (let y = 0; y < 160; y += 4) {
    ctx.fillStyle = '#bbb'
    ctx.fillRect(0, y, 160, 1)
    ctx.fillStyle = '#737373'
    for (let x = y % 8 ? 2 : 0; x < 160; x += 4) ctx.fillRect(x, y, 1, 3)
  }
})
fabricTexture.colorSpace = THREE.NoColorSpace
const groundShadowMap = canvasTexture(128, 128, (ctx) => {
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64)
  gradient.addColorStop(0, '#fff')
  gradient.addColorStop(0.54, '#898989')
  gradient.addColorStop(1, '#000')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
})
groundShadowMap.colorSpace = THREE.NoColorSpace
const shadowFootprint = new THREE.PlaneGeometry(1, 1)

function contactShadow(parent: THREE.Object3D, width: number, length: number, opacity: number) {
  const decal = new THREE.Mesh(shadowFootprint, new THREE.MeshBasicMaterial({
    color: '#171e1e', alphaMap: groundShadowMap, opacity, transparent: true, depthWrite: false,
  }))
  decal.position.y = 0.016
  decal.rotation.x = -Math.PI / 2
  decal.scale.set(width, length, 1)
  parent.add(decal)
}

function rounded(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, radius: number) {
  const key = `${w}/${h}/${d}/${radius}`
  let geometry = roundedParts.get(key)
  if (!geometry) {
    geometry = new RoundedBoxGeometry(w, h, d, 2, radius)
    roundedParts.set(key, geometry)
  }
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function garment(profile: ReadonlyArray<readonly [number, number, number]>) {
  const p: number[] = []
  const uv: number[] = []
  const indices: number[] = []
  const sides = 24
  for (const [row, [y, width, depth]] of profile.entries()) {
    for (let angle = 0; angle <= sides; angle++) {
      const phase = angle / sides * Math.PI * 2
      const folds = 1 + (Math.sin(phase * 5 + row * .31) + Math.sin(phase * 3 - row * .73)) * .018
      p.push(Math.sin(phase) * width * folds, y, Math.cos(phase) * depth * folds)
      uv.push(angle / sides, row / (profile.length - 1))
      if (angle < sides && row < profile.length - 1) {
        const a = row * (sides + 1) + angle
        const b = a + sides + 1
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const jacketShape = garment([
  [.839, .135, .091], [.863, .168, .121], [.927, .178, .135], [1.01, .19, .137],
  [1.087, .181, .135], [1.172, .197, .142], [1.238, .223, .146], [1.315, .24, .15],
  [1.353, .228, .138], [1.386, .192, .117], [1.412, .121, .098], [1.425, .067, .068],
])
const sleeveShape = garment([
  [-.274, .033, .041], [-.257, .058, .058], [-.207, .064, .068], [-.148, .068, .075],
  [-.075, .075, .083], [-.006, .082, .084], [.052, .063, .065], [.073, .024, .03],
])
const cuffShape = garment([
  [-.228,.047,.047], [-.205,.052,.055], [-.157,.055,.057], [-.091,.064,.065], [-.023,.071,.071], [.027,.059,.064],
])
const thighShape = garment([
  [-.41,.059,.059],[-.376,.074,.076],[-.303,.076,.085],[-.23,.086,.091],[-.12,.098,.102],[-.024,.102,.097],[.046,.078,.073],
])
const calfShape = garment([
  [-.386,.051,.054],[-.35,.056,.061],[-.288,.059,.06],[-.20,.067,.075],[-.122,.073,.084],[-.04,.069,.078],[.026,.057,.058],
])
const headShape = garment([
  [1.456,.034,.045], [1.481,.075,.082], [1.507,.102,.102], [1.548,.115,.113], [1.585,.121,.117],
  [1.623,.123,.111], [1.659,.115,.105], [1.695,.093,.086], [1.724,.061,.066], [1.739,.002,.002],
])

function fit(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, 0, z)
  mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
}

export function makePerson(jacketColor: string, skinColor: string, courier = false) {
  const group = new THREE.Group()
  const torso = new THREE.Group()
  const jacket = courier
    ? new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.91, bumpMap: fabricTexture, bumpScale: 0.0017 })
    : matte(jacketColor)
  const skin = matte(skinColor)
  const denim = matte(courier ? '#344b54' : '#555765')
  const shoe = matte('#373435')
  const shoeSole = matte('#beb1a1')
  const darkThread = matte('#363b3b')
  group.add(torso)
  if (courier) contactShadow(group, 1.25, 1.1, 0.42)
  fit(torso, jacketShape, jacket)
  rounded(torso, darkThread, 0, 1.422, -0.002, 0.209, 0.078, 0.229, 0.036)
  cylinder(torso, skin, 0, 1.44, -0.012, 0.069, 0.14)
  fit(torso, headShape, skin, 0, -.015)
  ellipsoid(torso, skin, 0, 1.566, -0.13, 0.025, 0.035, 0.023, false)
  for (const side of [-1, 1]) {
    ellipsoid(torso, skin, side * 0.123, 1.574, -0.003, 0.021, 0.039, 0.028, false)
    ellipsoid(torso, matte('#c9b4a1'), side * .046, 1.603, -.118, .022, .009, .009, false)
    ellipsoid(torso, darkThread, side * .047, 1.603, -.126, .007, .007, .005, false)
    ellipsoid(torso, darkThread, side * .05, 1.621, -.12, .023, .005, .008, false)
  }
  ellipsoid(torso, matte('#64483e'), 0, 1.524, -.107, .032, .004, .009, false)
  if (courier) {
    const cap = matte('#3b5151')
    const pack = matte('#313d41')
    const panel = matte('#b17744')
    const orangeStitch = matte('#db9b61')
    ellipsoid(torso, matte('#342d2a'), 0, 1.659, 0.03, 0.126, 0.09, 0.093, false)
    ellipsoid(torso, cap, 0, 1.695, -0.018, 0.134, 0.084, 0.125)
    rounded(torso, cap, 0, 1.668, -0.126, 0.205, 0.026, 0.157, 0.012)
    rounded(torso, matte('#c1986d'), 0, 1.671, 0.099, 0.072, 0.024, 0.014, 0.008)
    rounded(torso, pack, 0, 1.105, 0.216, 0.323, 0.463, 0.20, 0.088)
    rounded(torso, matte('#4c5b5d'), 0, 1.266, .266, .283, .096, .103, .044)
    for (const side of [-1, 1]) rounded(torso, matte('#516165'), side * .138, 1.097, .294, .014, .307, .017, .006)
    rounded(torso, panel, 0, 1.013, 0.321, 0.262, 0.241, 0.058, 0.026)
    rounded(torso, pack, 0, 1.114, 0.352, 0.224, 0.023, 0.013, 0.005)
    box(torso, matte('#d1bb9b'), 0.091, 1.097, 0.359, 0.013, 0.045, 0.009, false)
    box(torso, orangeStitch, 0, 0.94, 0.351, 0.176, 0.023, 0.007, false)
    rounded(torso, pack, 0, 1.359, 0.176, 0.122, 0.046, 0.071, 0.018)
    for (const side of [-1, 1]) {
      const strap = rounded(torso, pack, side * 0.142, 1.182, -0.127, 0.048, 0.403, 0.051, 0.019)
      strap.rotation.z = side * 0.13
      rounded(torso, darkThread, side * 0.171, 1.348, 0.09, 0.059, 0.087, 0.158, 0.019)
      box(torso, matte('#69726a'), side * 0.155, 1.088, -0.15, 0.048, 0.038, 0.023, false)
      box(torso, panel, side * 0.173, 0.949, 0.064, 0.036, 0.142, 0.12, false)
    }
    box(torso, darkThread, 0, 1.124, -0.143, 0.017, 0.45, 0.015, false)
  } else {
    const hair = matte('#473832')
    ellipsoid(torso, hair, 0, 1.683, 0.01, 0.134, 0.083, 0.117)
  }
  const arms: THREE.Group[] = []
  const elbows: THREE.Group[] = []
  const legs: THREE.Group[] = []
  const knees: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(side * 0.243, 1.341, 0)
    arm.rotation.z = side * 0.09
    torso.add(arm)
    fit(arm, sleeveShape, jacket, side * .019)
    const elbow = new THREE.Group()
    elbow.position.set(side * 0.023, -0.247, 0)
    fit(elbow, cuffShape, jacket)
    rounded(elbow, darkThread, 0, -0.205, -0.006, 0.105, 0.056, 0.11, 0.025)
    ellipsoid(elbow, skin, 0, -0.253, -0.005, 0.048, 0.066, 0.046)
    arm.add(elbow)
    arms.push(arm)
    elbows.push(elbow)

    const leg = new THREE.Group()
    leg.position.set(side * 0.106, 0.845, 0)
    group.add(leg)
    fit(leg, thighShape, denim)
    const knee = new THREE.Group()
    knee.position.set(0, -0.371, 0)
    fit(knee, calfShape, denim, 0, .004)
    rounded(knee, shoe, 0, -0.41, -0.037, 0.153, 0.119, 0.269, 0.035)
    rounded(knee, shoeSole, 0, -0.458, -0.035, 0.163, 0.031, 0.27, 0.012)
    if (courier) {
      const seam = matte('#526065')
      rounded(leg, seam, side * 0.079, -0.078, 0.051, 0.024, 0.088, 0.058, 0.008)
      box(knee, shoeSole, 0, -0.37, -0.095, 0.076, 0.012, 0.026, false)
    }
    leg.add(knee)
    legs.push(leg)
    knees.push(knee)
  }
  let stride = 0
  let energy = 0
  function animate(dt: number, speed: number, sprint: boolean, greeting = 0) {
    const active = Math.min(1, speed / 2.5)
    energy = THREE.MathUtils.damp(energy, active, 12, dt)
    stride += dt * (sprint ? 12.6 : 9.1) * Math.max(0.26, active)
    const amplitude = energy * (sprint ? 0.91 : 0.64)
    const swing = Math.sin(stride) * amplitude
    legs[0].rotation.x = swing - energy * 0.14
    legs[1].rotation.x = -swing - energy * 0.14
    knees[0].rotation.x = Math.max(0, swing) * 1.16 + energy * 0.07
    knees[1].rotation.x = Math.max(0, -swing) * 1.16 + energy * 0.07
    arms[0].rotation.x = -swing * 0.63 - energy * 0.12 - greeting * 0.88
    arms[0].rotation.z = -0.09 - greeting * 0.19
    arms[1].rotation.x = swing * 0.63 - energy * 0.12
    elbows[0].rotation.x = -energy * (sprint ? 0.66 : 0.21) - Math.max(0, swing) * 0.27 - greeting * 0.6
    elbows[1].rotation.x = -energy * (sprint ? 0.66 : 0.21) - Math.max(0, -swing) * 0.27
    torso.position.y = Math.cos(stride * 2) * energy * 0.027
    torso.rotation.x = -energy * (sprint ? 0.14 : 0.055)
    torso.rotation.y = Math.sin(stride) * energy * 0.055
  }
  return { group, animate }
}

export function makeStreetcar() {
  const group = new THREE.Group()
  const red = new THREE.MeshPhysicalMaterial({ color: '#ab302a', roughness: 0.42, clearcoat: 0.66, clearcoatRoughness: 0.25 })
  const white = new THREE.MeshPhysicalMaterial({ color: '#dfdbcd', roughness: 0.48, clearcoat: 0.53 })
  contactShadow(group, 3.45, 13.8, 0.6)
  const black = matte('#363c3b')
  const metal = matte('#696e70')
  const interior = canvasTexture(256, 192, (ctx) => {
    const shade = ctx.createLinearGradient(0, 0, 0, 192)
    shade.addColorStop(0, '#352b2e')
    shade.addColorStop(.22, '#ad885e')
    shade.addColorStop(.55, '#7b614b')
    shade.addColorStop(1, '#253741')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, 256, 192)
    ctx.fillStyle = '#f6d59b'
    ctx.fillRect(13, 27, 226, 8)
    ctx.fillStyle = '#3a3532'
    ctx.fillRect(0, 53, 256, 8)
    for (const x of [11, 108, 222]) {
      ctx.fillStyle = '#dec593'
      ctx.fillRect(x, 40, 6, 111)
      ctx.fillStyle = '#803c40'
      ctx.fillRect(x + 13, 124, 44, 64)
      ctx.fillStyle = '#482e33'
      ctx.fillRect(x + 13, 168, 44, 9)
    }
  })
  const glass = new THREE.MeshPhysicalMaterial({
    map: interior, emissiveMap: interior, emissive: '#edbe88', emissiveIntensity: .77,
    color: '#8b9a9b', roughness: .25, metalness: .24, clearcoat: .61, clearcoatRoughness: .20,
  })
  const trim = new THREE.MeshStandardMaterial({ color: '#c3ab9c', roughness: .45, metalness: .42 })
  const headlight = new THREE.MeshStandardMaterial({ color: '#e6d6b5', emissive: '#ffd893', emissiveIntensity: 2.55 })
  rounded(group, metal, 0, 0.49, 0, 2.44, 0.45, 12.25, 0.18)
  rounded(group, red, 0, 1.04, 0, 2.61, 1.07, 12.8, 0.22)
  rounded(group, white, 0, 2.14, 0, 2.58, 1.52, 12.72, 0.24)
  rounded(group, red, 0, 2.95, 0, 2.49, 0.39, 12.44, 0.17)
  rounded(group, black, 0, 3.22, -1, 1.17, 0.3, 2.8, 0.1)
  const pantograph = box(group, metal, 0, 4.13, -0.8, 0.1, 2.01, 0.12)
  pantograph.rotation.x = 0.37
  box(group, metal, 0, 5.03, -0.43, 0.79, 0.1, 0.1)
  for (const side of [-1, 1]) {
    box(group, trim, side * 1.31, 1.53, 0, .027, .057, 12.37, false)
    for (let i = -4; i <= 4; i++) {
      const zw = 1.18 * i
      const x = side * 1.296
      if (i === -2 || i === 3) {
        box(group, black, x, 1.49, zw, 0.031, 2.27, 1.08)
        for (const offset of [-0.26, 0.26]) box(group, glass, x + side * 0.02, 1.91, zw + offset, 0.02, 1.15, 0.43, false)
      } else {
        box(group, black, x, 2.21, zw, 0.032, 0.92, 1.15)
        box(group, glass, x + side * 0.02, 2.21, zw, 0.02, 0.82, 1.03, false)
      }
    }
    for (const z of [-4.3, -3.5, 3.5, 4.3]) {
      const wheel = cylinder(group, black, side * 0.89, 0.37, z, 0.36, 0.23)
      wheel.rotation.z = Math.PI / 2
    }
    for (const z of [-6.42, 6.42]) {
      rounded(group, headlight, side * 0.72, 0.95, z, 0.27, 0.2, 0.06, 0.03)
    }
  }
  const destination = canvasTexture(512, 80, (ctx) => {
    ctx.fillStyle = '#202526'
    ctx.fillRect(0, 0, 512, 80)
    ctx.fillStyle = '#ffb863'
    ctx.font = '700 43px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('509 HARBOURFRONT', 256, 41, 483)
  })
  const displayMaterial = new THREE.MeshBasicMaterial({ map: destination, toneMapped: false })
  const displaySize = new THREE.PlaneGeometry(0.94, 0.16)
  for (const sign of [-1, 1]) {
    rounded(group, glass, 0, 2.212, 6.35 * sign, 1.94, 0.99, 0.12, 0.059)
    box(group, black, 0, 2.212, 6.418 * sign, 0.075, 0.99, 0.035, false)
    box(group, black, 0, 2.832, 6.31 * sign, 0.93, 0.2, 0.06, false)
    const display = new THREE.Mesh(displaySize, displayMaterial)
    display.position.set(0, 2.831, 6.347 * sign)
    display.rotation.y = sign < 0 ? Math.PI : 0
    group.add(display)
  }
  return group
}

export function makeWaypoint(scene: THREE.Scene) {
  const group = new THREE.Group()
  const beacon = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshBasicMaterial({ color: '#ffd07c', toneMapped: false }),
  )
  const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ffb45c', transparent: true, opacity: 0.87, depthWrite: false, toneMapped: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 0.95, 48), ringMaterial)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.28
  group.add(ring, beacon)
  scene.add(group)
  return {
    group,
    animate(time: number) {
      beacon.position.y = 2.65 + Math.sin(time * 3.1) * 0.22
      beacon.rotation.y = time * 1.55
      const scale = 1 + Math.sin(time * 3.1) * 0.085
      ring.scale.set(scale, scale, scale)
    },
  }
}
