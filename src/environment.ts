import * as THREE from 'three'
import { ellipsoid, matte } from './graphics'
import { BOARDWALK, BOUNDS, PIERS } from './layout'

const sunDirection = new THREE.Vector3(-0.38, 0.21, -0.925).normalize()
const skyRotation = 2.53
const haze = '#8c8294'

export function lightCity(scene: THREE.Scene, sky: THREE.DataTexture, shadowSize = 3072) {
  scene.background = sky
  scene.environment = sky
  scene.backgroundRotation.y = skyRotation
  scene.environmentRotation.y = skyRotation
  scene.backgroundIntensity = 0.93
  scene.environmentIntensity = 0.91
  scene.fog = new THREE.FogExp2(haze, 0.0031)

  const fill = new THREE.HemisphereLight('#c8dafe', '#746778', 1.19)
  const sun = new THREE.DirectionalLight('#ffb47a', 2.18)
  sun.castShadow = true
  sun.shadow.mapSize.set(shadowSize, shadowSize)
  sun.shadow.camera.left = -86
  sun.shadow.camera.right = 86
  sun.shadow.camera.top = 65
  sun.shadow.camera.bottom = -65
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = 295
  sun.shadow.normalBias = 0.08
  sun.shadow.bias = -0.00016
  sun.shadow.radius = 3.5
  scene.add(fill, sun, sun.target)
  fill.layers.enable(1)
  sun.layers.enable(1)

  function aimAt(x: number, z: number) {
    sun.target.position.set(x, 1, z)
    sun.position.copy(sun.target.position).addScaledVector(sunDirection, 150)
  }
  aimAt(0, 10)
  return (anchor: THREE.Vector3) => {
    // Leave the light in place until the player approaches the edge of its shadow map.
    if (Math.abs(anchor.x - sun.target.position.x) > 24 || Math.abs(anchor.z - sun.target.position.z) > 24) {
      aimAt(Math.round(anchor.x / 15) * 15, Math.round(anchor.z / 15) * 15)
    }
  }
}

export function makeLake(parent: THREE.Object3D, sky: THREE.DataTexture) {
  const skyTransform = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(-skyRotation))
  const water = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      sky: { value: sky },
      skyTransform: { value: skyTransform },
      sunDirection: { value: sunDirection },
      haze: { value: new THREE.Color(haze) },
      deep: { value: new THREE.Color('#24344e') },
      shallows: { value: new THREE.Color('#3f6773') },
    },
    vertexShader: `
      varying vec3 vWater;
      void main() {
        vWater = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWater;
      uniform float time;
      uniform sampler2D sky;
      uniform mat3 skyTransform;
      uniform vec3 sunDirection;
      uniform vec3 haze;
      uniform vec3 deep;
      uniform vec3 shallows;

      vec3 skySample(vec3 direction) {
        direction = skyTransform * direction;
        vec2 uv = vec2(
          atan(direction.z, direction.x) * 0.15915494 + 0.5,
          asin(clamp(direction.y, -1.0, 1.0)) * 0.31830989 + 0.5
        );
        return min(texture2D(sky, uv).rgb, vec3(2.1));
      }

      vec2 wave(vec2 p, vec2 direction, float frequency, float height, float speed) {
        float phase = dot(p, direction) * frequency + time * speed;
        return direction * cos(phase) * frequency * height;
      }

      void main() {
        vec2 p = vWater.xz;
        vec3 toEye = cameraPosition - vWater;
        float distanceToEye = length(toEye);
        vec3 view = toEye / distanceToEye;
        float fineDetail = 1.0 - smoothstep(32.0, 155.0, distanceToEye);
        vec2 gradient =
          wave(p, vec2(0.25, 0.97), 1.82, 0.044, 1.32) +
          wave(p, vec2(-0.58, 0.81), 2.7, 0.019, -1.66) +
          wave(p, vec2(0.96, 0.29), 3.2, 0.017, 2.31);
        gradient += fineDetail * (
          wave(p, vec2(0.42, 0.91), 8.0, 0.009, 2.76) +
          wave(p, vec2(-0.89, 0.46), 11.3, 0.005, -3.11)
        );
        vec3 normal = normalize(vec3(gradient.x, 1.0, gradient.y));
        vec3 reflected = reflect(-view, normal);
        reflected.y = max(0.015, reflected.y);
        float fresnel = 0.08 + 0.84 * pow(1.0 - max(0.0, dot(normal, view)), 3.1);
        float shoreDistance = max(0.0, p.y - ${BOUNDS.shore.toFixed(1)});
        vec3 waterColor = mix(shallows, deep, smoothstep(0.5, 51.0, shoreDistance));
        vec3 water = mix(waterColor * (0.86 + gradient.y * 0.75), skySample(normalize(reflected)) * 0.64, fresnel);
        vec3 sunOnHorizon = normalize(vec3(sunDirection.x, 0.17, sunDirection.z));
        float highlight = pow(max(dot(normalize(reflected), sunOnHorizon), 0.0), 41.0);
        water += vec3(1.0, 0.62, 0.32) * highlight * (0.08 + fresnel * 0.25);
        float edge = abs(p.y - ${BOARDWALK.south.toFixed(2)});
        ${PIERS.map(({ x, width, end }) => `edge = min(edge, length(max(vec2(abs(p.x - (${x.toFixed(1)})) - ${(width / 2).toFixed(2)}, p.y - ${end.toFixed(1)}), 0.0)));`).join('\n        ')}
        float lap = pow(max(0.0, sin(edge * 9.0 - time * 1.8 + sin(p.x * 0.7))), 6.0);
        water += vec3(0.17, 0.22, 0.21) * lap * exp(-edge * 1.9) * fineDetail;
        water = mix(water, haze, 1.0 - exp(-distanceToEye * distanceToEye * 0.000014));
        gl_FragColor = vec4(water, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(1050, 620), water)
  surface.position.set(0, -0.71, BOUNDS.shore + 310)
  surface.rotation.x = -Math.PI / 2
  parent.add(surface)
  for (let i = 0; i < 12; i++) {
    const x = -273 + i * 51
    const z = 282 + 15 * Math.sin(i * 1.4)
    ellipsoid(parent, matte('#667b75'), x, -1.4, z, 40, 4.8 + Math.sin(i * 3) * 1.7, 14, false)
    for (let j = 0; j < 4; j++) {
      ellipsoid(parent, matte(j % 2 ? '#657875' : '#687e76'), x - 15 + j * 8.9, 2.1, z, 12, 2.4 + Math.sin(i * 1.2 + j), 7, false)
    }
  }
  return water
}
