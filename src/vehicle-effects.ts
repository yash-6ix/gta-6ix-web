import * as THREE from 'three'
import { BLOCKS } from './layout'
import { randomize } from './graphics'

export function makeVehicleEffects(scene: THREE.Scene) {
  const marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    color: '#1b1720', transparent: true, opacity: .54, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  }), 1300)
  marks.count = 0
  marks.frustumCulled = false
  marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  marks.renderOrder = 2
  scene.add(marks)
  const instance = new THREE.Object3D()
  instance.rotation.order = 'YXZ'
  let markIndex = 0
  const trail: Array<THREE.Vector3 | null> = [null, null]
  let tireSmoke = 0
  let engineSmoke = 0

  const maxParticles = 360
  const locations = new Float32Array(maxParticles * 3)
  const scales = new Float32Array(maxParticles)
  const opacity = new Float32Array(maxParticles)
  const heat = new Float32Array(maxParticles)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(locations, 3).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('puffSize', new THREE.BufferAttribute(scales, 1).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('opacity', new THREE.BufferAttribute(opacity, 1).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('heat', new THREE.BufferAttribute(heat, 1).setUsage(THREE.DynamicDrawUsage))
  geometry.setDrawRange(0, 0)
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { pixelHeight: { value: 720 } },
    vertexShader: `
      attribute float puffSize;
      attribute float opacity;
      attribute float heat;
      uniform float pixelHeight;
      varying float vOpacity;
      varying float vHeat;
      varying vec2 vSeed;
      void main() {
        vOpacity = opacity;
        vHeat = heat;
        vSeed = position.xz * 4.91 + vec2(position.y * 3.7);
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(puffSize * pixelHeight * projectionMatrix[1][1] / max(-view.z, 0.01), 1.0, 184.0);
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying float vHeat;
      varying vec2 vSeed;
      float hash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 286.9))) * 43758.54);
      }
      float noise(vec2 point) {
        vec2 cell = floor(point);
        vec2 t = fract(point);
        t = t * t * (3.0 - 2.0 * t);
        return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), t.x),
          mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), t.x), t.y);
      }
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = length(p);
        if (d > 1.0) discard;
        float detail = noise(p * 2.7 + vSeed) * 0.77 + noise(p * 6.2 - vSeed) * 0.23;
        float smoke = (1.0 - smoothstep(0.04, 0.95, d + (detail - 0.5) * 0.33)) * (0.50 + detail * 0.60);
        float spark = pow(max(0.0, 1.0 - d), 2.8) * 2.45;
        vec3 fogColor = mix(vec3(0.105, 0.125, 0.145), vec3(0.62, 0.70, 0.76), clamp(vHeat, 0.0, 1.0));
        vec3 light = vec3(5.3, 1.55, 0.18);
        float fire = step(1.5, vHeat);
        gl_FragColor = vec4(mix(fogColor, light, fire), mix(smoke, spark, fire) * vOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const clouds = new THREE.Points(geometry, material)
  clouds.frustumCulled = false
  clouds.renderOrder = 3
  scene.add(clouds)

  const particles: Array<{ position: THREE.Vector3; velocity: THREE.Vector3; life: number; age: number; size: number; heat: number }> = []
  const rand = randomize(9658)
  function spawn(position: THREE.Vector3, life: number, size: number, temperature: number, velocity: THREE.Vector3) {
    if (particles.length >= maxParticles) particles.shift()
    particles.push({ position: position.clone(), velocity, life, age: 0, size, heat: temperature })
  }

  function leaveMark(a: THREE.Vector3, b: THREE.Vector3, skid: number) {
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    if (length < .035 || length > 1.3) return
    instance.position.copy(a).lerp(b, .5)
    const { x, z } = instance.position
    const onSidewalk = BLOCKS.some((block) => Math.abs(x - block.x) <= block.w / 2 && Math.abs(z - block.z) <= block.d / 2)
    instance.position.y = onSidewalk ? .151 : .025
    instance.rotation.set(-Math.PI / 2, Math.atan2(b.x - a.x, b.z - a.z), 0, 'YXZ')
    instance.scale.set(.145 + skid * .045, length + .049, 1)
    instance.updateMatrix()
    marks.setMatrixAt(markIndex, instance.matrix)
    markIndex = (markIndex + 1) % marks.instanceMatrix.count
    marks.count = Math.min(marks.count + 1, marks.instanceMatrix.count)
    marks.instanceMatrix.needsUpdate = true
  }

  return {
    resize(height: number) { material.uniforms.pixelHeight.value = height * .6 },
    reset() {
      markIndex = marks.count = 0
      trail[0] = trail[1] = null
      tireSmoke = engineSmoke = 0
      particles.length = 0
      geometry.setDrawRange(0, 0)
    },
    breakTrail() { trail[0] = trail[1] = null },
    impact(point: THREE.Vector3, normal: THREE.Vector3, force: number) {
      for (let i = 0; i < 7 + force * 16; i++) {
        const spread = new THREE.Vector3((rand() - .5) * 6.2, 1.25 + rand() * 3.6, (rand() - .5) * 6.2)
        spread.addScaledVector(normal, 1 + force * 5)
        spawn(point, .19 + rand() * .32, .022 + rand() * .052, 2, spread)
      }
    },
    drive(dt: number, position: THREE.Vector3, yaw: number, slip: number, drifting: boolean, condition: number, rearWheel: { x: number; z: number }) {
      tireSmoke -= dt
      engineSmoke -= dt
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
      if (drifting && Math.abs(slip) > 1.45) {
        const size = Math.min(Math.abs(slip) / 9, 1)
        for (const [i, side] of [-1, 1].entries()) {
          const tire = position.clone().addScaledVector(forward, -rearWheel.z).addScaledVector(right, side * rearWheel.x)
          const last = trail[i]
          if (last) leaveMark(last, tire, size)
          trail[i] = tire
          if (tireSmoke <= 0) {
            tire.y += .14
            spawn(tire, .65 + rand() * .38, .38 + size * .33, 1, new THREE.Vector3((rand()-.5) *.72, .43 + rand()*.38, (rand()-.5) *.68))
          }
        }
        if (tireSmoke <= 0) tireSmoke = .067
      } else {
        trail[0] = trail[1] = null
      }
      if (condition < .37 && engineSmoke <= 0) {
        engineSmoke = .11
        const hood = position.clone().addScaledVector(forward, rearWheel.x ? rearWheel.z * 1.07 : .13)
        hood.y += rearWheel.x ? .96 : .61
        spawn(hood, 1.15 + rand() * .68, .55, 0, new THREE.Vector3((rand() - .45) * .47, .74 + rand() * .38, (rand() - .5) * .41))
      }
    },
    update(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i]
        particle.age += dt
        if (particle.age >= particle.life) {
          particles.splice(i, 1)
          continue
        }
        particle.position.addScaledVector(particle.velocity, dt)
        if (particle.heat > 1.5) particle.velocity.y -= dt * 9.3
      }
      particles.forEach((particle, i) => {
        const phase = particle.age / particle.life
        particle.position.toArray(locations, i * 3)
        scales[i] = particle.heat > 1.5 ? particle.size : particle.size * (.8 + phase * 2.1)
        opacity[i] = particle.heat > 1.5 ? 1 - phase : Math.sin(Math.PI * phase) * .52
        heat[i] = particle.heat
      })
      geometry.setDrawRange(0, particles.length)
      for (const key of ['position', 'puffSize', 'opacity', 'heat']) geometry.attributes[key].needsUpdate = true
    },
  }
}
