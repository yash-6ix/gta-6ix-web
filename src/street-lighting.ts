import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { canvasTexture } from './graphics'
import type { RoadVehicle } from './traffic'

export interface LampPosition {
  x: number
  z: number
  active?: boolean
}

const glowMap = canvasTexture(96, 96, (ctx) => {
  const glow = ctx.createRadialGradient(48, 48, 0, 48, 48, 48)
  glow.addColorStop(0, '#fff4d9f0')
  glow.addColorStop(.13, '#ffe1a755')
  glow.addColorStop(.38, '#ffb75c25')
  glow.addColorStop(1, '#ffb35a00')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 96, 96)
})
const glowMaterial = new THREE.SpriteMaterial({
  map: glowMap, transparent: true, opacity: .83, depthWrite: false, blending: THREE.AdditiveBlending,
})
const lightFootprint = new THREE.PlaneGeometry(7.3, 6.3)
glowMaterial.color.setRGB(2.65, 1.55, .92)
const poolMaterial = new THREE.MeshBasicMaterial({
  map: glowMap, color: '#f09e55', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .35,
})
const streetHeight = 4.29

export function makeStreetLighting(scene: THREE.Scene, lamps: readonly LampPosition[]) {
  const spots = Array.from({ length: Math.min(lamps.length, 5) }, () => {
    const light = new THREE.SpotLight('#ffd09d', 46, 11.3, .82, .84, 2)
    scene.add(light, light.target)
    light.layers.enable(1)
    return light
  })
  const fixtures = lamps.map((lamp) => {
    const glow = new THREE.Sprite(glowMaterial)
    glow.position.set(lamp.x, streetHeight, lamp.z)
    glow.scale.set(1.8, 1.2, 1)
    scene.add(glow)
    glow.layers.enable(1)
    const pool = new THREE.Mesh(lightFootprint, poolMaterial)
    pool.position.set(lamp.x, .159, lamp.z)
    pool.rotation.x = -Math.PI / 2
    scene.add(pool)
    return { lamp, glow, pool }
  })
  let lastX = Infinity
  let lastZ = Infinity
  return (anchor: THREE.Vector3, refresh = false) => {
    if (!refresh && Math.hypot(anchor.x - lastX, anchor.z - lastZ) < 4) return
    lastX = anchor.x
    lastZ = anchor.z
    for (const { lamp, glow, pool } of fixtures) {
      const distance = Math.hypot(lamp.x - lastX, lamp.z - lastZ)
      glow.visible = lamp.active !== false && distance < 145
      pool.visible = lamp.active !== false && distance < 58
    }
    const closest = lamps.filter(lamp => lamp.active !== false).sort((a, b) => Math.hypot(a.x - lastX, a.z - lastZ) - Math.hypot(b.x - lastX, b.z - lastZ))
    spots.forEach((light, i) => {
      const lamp = closest[i]
      light.visible = Boolean(lamp)
      if (!lamp) return
      light.position.set(lamp.x, streetHeight, lamp.z)
      light.target.position.set(lamp.x + .34, 0, lamp.z)
    })
  }
}

export function makeRoadReflection(width: number, depth: number, centerZ: number) {
  const mirror = new Reflector(new THREE.PlaneGeometry(width, depth), {
    textureWidth: 768,
    textureHeight: 400,
    multisample: 0,
    clipBias: .002,
    shader: {
      name: 'Wet street',
      uniforms: {
        tDiffuse: { value: null },
        textureMatrix: { value: new THREE.Matrix4() },
        color: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: `
        uniform mat4 textureMatrix;
        varying vec4 reflection;
        varying vec3 puddle;
        void main() {
          reflection = textureMatrix * vec4(position, 1.0);
          puddle = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec4 reflection;
        varying vec3 puddle;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(123.1, 298.9))) * 43758.54); }
        float noise(vec2 p) {
          vec2 cell = floor(p);
          vec2 t = fract(p);
          t = t * t * (3.0 - 2.0 * t);
          return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), t.x),
            mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), t.x), t.y);
        }

        void main() {
          vec2 world = puddle.xz;
          float dampness = noise(world * vec2(0.29, 0.18)) * 0.77 + noise(world * 0.94) * 0.23;
          float wet = smoothstep(0.43, 0.77, dampness);
          if (wet < 0.015) discard;
          vec3 toEye = cameraPosition - puddle;
          float range = length(toEye);
          float grazing = pow(1.0 - max(0.0, normalize(toEye).y), 2.45);
          vec2 position = reflection.xy / reflection.w;
          vec2 spread = vec2(0.0017, 0.0027) * (1.0 + (1.0 - wet) * 1.8);
          position.x += (noise(world * 1.3) - 0.5) * 0.0034;
          if (position.x < 0.002 || position.y < 0.002 || position.x > 0.998 || position.y > 0.998) discard;
          vec3 glint = texture2D(tDiffuse, position).rgb * 0.40;
          glint += texture2D(tDiffuse, position + vec2(spread.x, spread.y)).rgb * 0.15;
          glint += texture2D(tDiffuse, position - vec2(spread.x, spread.y)).rgb * 0.15;
          glint += texture2D(tDiffuse, position + vec2(-spread.x, spread.y)).rgb * 0.15;
          glint += texture2D(tDiffuse, position + vec2(spread.x, -spread.y)).rgb * 0.15;
          float opacity = (0.21 + grazing * 0.52) * wet * (1.0 - smoothstep(75.0, 180.0, range));
          gl_FragColor = vec4(glint * vec3(0.83, 0.87, 0.96), opacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    },
  })
  mirror.position.set(0, .019, centerZ)
  mirror.rotation.x = -Math.PI / 2
  const material = mirror.material as THREE.ShaderMaterial
  material.transparent = true
  material.depthWrite = false
  mirror.renderOrder = 1
  const render = mirror.onBeforeRender.bind(mirror)
  let frame = 0
  mirror.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    if (frame++ % 2 === 1) return
    mirror.getReflectionCamera(camera).layers.set(1)
    render(renderer, scene, camera, geometry, material, group)
  }
  return mirror
}

export function makeHeadlights(scene: THREE.Scene) {
  const beams = [-1, 1].map((side) => {
    const light = new THREE.SpotLight('#ffe3b6', 0, 28, .38, .75, 2)
    light.layers.enable(1)
    scene.add(light, light.target)
    return { light, side }
  })
  const direct = new THREE.Vector3()
  const lateral = new THREE.Vector3()
  return (vehicle: RoadVehicle | null) => {
    for (const { light, side } of beams) {
      const motorcycle = vehicle?.model.kind === 'motorcycle'
      light.intensity = vehicle && (!motorcycle || side === -1) ? (motorcycle ? 110 : 88) * vehicle.model.headlamp(side) : 0
      if (!vehicle) continue
      const yaw = vehicle.model.group.rotation.y
      direct.set(-Math.sin(yaw), 0, -Math.cos(yaw))
      lateral.set(Math.cos(yaw), 0, -Math.sin(yaw))
      const { halfWidth, halfLength } = vehicle.model.dimensions
      light.position.copy(vehicle.model.group.position).addScaledVector(direct, (motorcycle ? .83 : halfLength) + .02)
        .addScaledVector(lateral, motorcycle ? 0 : side * halfWidth * .64)
      light.position.y += vehicle.model.headlampHeight
      light.target.position.copy(light.position).addScaledVector(direct, 12).addScaledVector(lateral, motorcycle ? 0 : side * .47)
      light.target.position.y = .02
    }
  }
}
