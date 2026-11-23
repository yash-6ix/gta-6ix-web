import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { makePerson } from './actors'
import { box, matte } from './graphics'

export type PersonModel = ReturnType<typeof makePerson>
export type ResidentModel = (index: number, jacket: string, skin: string) => PersonModel

interface Model {
  asset: GLTF
  idle: THREE.AnimationClip
  walk: THREE.AnimationClip
  jog: THREE.AnimationClip
  rest: THREE.Box3
}

const importantBones = /^(hips|spine1?|chest|neck|head|shoulder_[LR]|upperarm_[LR]|forearm_[LR]|hand_[LR]|thigh_[LR]|calf_[LR]|foot_[LR]|toe_[LR])\.quaternion$/
const bagBody = new RoundedBoxGeometry(.307, .38, .194, 4, .053)
const bagPocket = new RoundedBoxGeometry(.252, .16, .065, 3, .022)
const bagMaterial = matte('#303c40')
const trim = matte('#7d8a89')
const wardrobed = new Map<string, THREE.MeshStandardMaterial>()

function isolateMotion(clip: THREE.AnimationClip) {
  const tracks = clip.tracks.filter((track) => importantBones.test(track.name) || track.name === 'hips.position').map((track) => {
    const copy = track.clone()
    if (copy.name === 'hips.position') {
      for (let i = 0; i < copy.values.length; i += 3) {
        copy.values[i] = track.values[0]
        copy.values[i + 2] = track.values[2]
      }
    }
    return copy.optimize()
  })
  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}

function jogMotion(walk: THREE.AnimationClip) {
  const base = new THREE.Quaternion()
  const other = new THREE.Quaternion()
  const q = new THREE.Quaternion()
  const blended = new THREE.Quaternion()
  const tracks = walk.tracks.map((original) => {
    const track = original.clone()
    if (!/^(thigh|calf|foot|upperarm|forearm)_/.test(track.name) || track.getValueSize() !== 4) return track
    const steps = track.values.length / 4
    if (steps < 3) return track
    base.fromArray(track.values, 0)
    other.fromArray(track.values, Math.floor(steps * .5) * 4)
    base.slerp(other, .5)
    const factor = track.name.startsWith('calf') ? 1.24 : track.name.startsWith('thigh') ? 1.21 : 1.13
    for (let i = 0; i < steps; i++) {
      q.fromArray(track.values, i * 4)
      blended.copy(base).slerp(q, factor).normalize().toArray(track.values, i * 4)
    }
    return track
  })
  return new THREE.AnimationClip('Jog', walk.duration, tracks)
}

function wardrobe(source: THREE.MeshStandardMaterial, color: string) {
  const key = `${source.uuid}/${color}`
  let material = wardrobed.get(key)
  if (material) return material
  material = source.clone()
  const tint = new THREE.Color(color)
  material.envMapIntensity = .62
  material.onBeforeCompile = (shader) => {
    shader.uniforms.clothAccent = { value: tint }
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 clothAccent;')
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        float clothHigh = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
        float clothLow = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
        float colorGap = (clothHigh - clothLow) / max(clothHigh, 0.001);
        float clothMask = (1.0 - smoothstep(0.09, 0.22, colorGap))
          * smoothstep(0.035, 0.105, clothHigh) * (1.0 - smoothstep(0.48, 0.72, clothHigh));
        vec3 tunedWardrobe = clothAccent * dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * 2.25;
        diffuseColor.rgb = mix(diffuseColor.rgb, tunedWardrobe, clothMask * 0.75);
      `)
  }
  material.customProgramCacheKey = () => 'quay-cloth-accent'
  wardrobed.set(key, material)
  return material
}

function attachBag(group: THREE.Group, rig: THREE.Object3D) {
  const chest = rig.getObjectByName('chest')
  if (!chest) return
  const bag = new THREE.Group()
  bag.position.set(0, 1.195, .195)
  const shell = new THREE.Mesh(bagBody, bagMaterial)
  shell.castShadow = shell.receiveShadow = true
  bag.add(shell)
  const pocket = new THREE.Mesh(bagPocket, matte('#6a5145'))
  pocket.position.set(0, -.072, .105)
  bag.add(pocket)
  box(bag, trim, .05, -.040, .14, .13, .011, .006, false)
  for (const side of [-1, 1]) {
    const strap = box(bag, bagMaterial, side * .114, .106, -.12, .038, .14, .243)
    strap.rotation.x = .27
  }
  group.add(bag)
  group.updateMatrixWorld(true)
  chest.attach(bag)
}

function animateRig(model: Model, jacket: string, courier = false): PersonModel {
  const group = new THREE.Group()
  const facing = new THREE.Group()
  const rig = clone(model.asset.scene)
  facing.rotation.y = Math.PI
  facing.add(rig)
  group.add(facing)
  rig.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return
    object.castShadow = object.receiveShadow = true
    object.frustumCulled = false
    if (object.material instanceof THREE.MeshStandardMaterial) object.material = wardrobe(object.material, jacket)
  })

  const mixer = new THREE.AnimationMixer(rig)
  const actions = [model.idle, model.walk, model.jog].map((clip) => mixer.clipAction(clip).play())
  actions[1].setEffectiveWeight(0)
  actions[2].setEffectiveWeight(0)
  mixer.update(0)
  const height = model.rest.max.y - model.rest.min.y
  const scale = (courier ? 1.78 : 1.74) / height
  facing.scale.setScalar(scale)
  facing.position.y = -model.rest.min.y * scale
  if (courier) attachBag(group, rig)

  let weightWalking = 0
  let weightRunning = 0
  return {
    group,
    animate(dt: number, speed: number, sprint: boolean, greeting = 0) {
      const run = THREE.MathUtils.smoothstep(speed, 2.05, 4.2)
      const walk = THREE.MathUtils.smoothstep(speed, .12, .93) * (1 - run)
      weightWalking = THREE.MathUtils.damp(weightWalking, walk, 13, dt)
      weightRunning = THREE.MathUtils.damp(weightRunning, run, 10, dt)
      actions[0].setEffectiveWeight(1 - Math.min(1, weightWalking + weightRunning))
      actions[1].setEffectiveWeight(weightWalking).setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 1.77, .49, 1.58))
      actions[2].setEffectiveWeight(weightRunning).setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 3.42, .91, 1.98))
      facing.rotation.x = THREE.MathUtils.damp(facing.rotation.x, -(sprint ? .17 : .09) * weightRunning, 9, dt)
      facing.rotation.z = THREE.MathUtils.damp(facing.rotation.z, greeting * .058, 10, dt)
      mixer.update(dt)
    },
  }
}

export async function loadPeopleModels(renderer: THREE.WebGLRenderer) {
  const base = `${import.meta.env.BASE_URL}people/`
  const transcoder = new KTX2Loader().setWorkerLimit(2).detectSupport(renderer)
  const loader = new GLTFLoader().setKTX2Loader(transcoder).setMeshoptDecoder(MeshoptDecoder)
  const fetchRig = async (filename: string): Promise<Model | null> => {
    try {
      const asset = await loader.loadAsync(base + filename + '.glb')
      const idle = THREE.AnimationClip.findByName(asset.animations, 'idle')
      const walk = THREE.AnimationClip.findByName(asset.animations, 'walk')
      if (!idle || !walk) return null
      const sample = clone(asset.scene)
      const mixer = new THREE.AnimationMixer(sample)
      mixer.clipAction(idle).play()
      mixer.update(0)
      sample.updateMatrixWorld(true)
      const rest = new THREE.Box3().setFromObject(sample, true)
      const height = rest.max.y - rest.min.y
      if (!Number.isFinite(height) || height < .1) return null
      const locomotion = isolateMotion(walk)
      return { asset, idle: isolateMotion(idle), walk: locomotion, jog: jogMotion(locomotion), rest }
    } catch (error) {
      console.warn(`Character model ${filename} could not load`, error)
      return null
    }
  }
  const [courier, resident] = await Promise.all(['Courier', 'Resident'].map(fetchRig))
  transcoder.dispose()
  return {
    courier: (): PersonModel => courier ? animateRig(courier, '#c58b64', true) : makePerson('#d1854d', '#a47458', true),
    resident: ((_index, jacket, skin) => resident ? animateRig(resident, jacket) : makePerson(jacket, skin)) satisfies ResidentModel,
  }
}
