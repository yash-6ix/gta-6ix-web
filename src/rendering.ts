import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

class StreetGrade extends Pass {
  private readonly camera: THREE.PerspectiveCamera
  private readonly material: THREE.ShaderMaterial
  private readonly quad: FullScreenQuad

  constructor(camera: THREE.PerspectiveCamera) {
    super()
    this.camera = camera
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        frame: { value: null },
        depth: { value: null },
        inverseProjection: { value: camera.projectionMatrixInverse },
        projected: { value: new THREE.Vector2() },
        aspect: { value: camera.aspect },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NoBlending,
      vertexShader: `
        varying vec2 screenUV;
        void main() {
          screenUV = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D frame;
        uniform sampler2D depth;
        uniform mat4 inverseProjection;
        uniform vec2 projected;
        uniform float aspect;
        varying vec2 screenUV;

        vec3 viewPoint(vec2 uv, float d) {
          vec4 p = inverseProjection * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          return p.xyz / p.w;
        }
        float cavity(vec3 p, vec3 n, vec2 uv) {
          if (uv.x < 0.001 || uv.x > 0.999 || uv.y < 0.001 || uv.y > 0.999) return 0.0;
          float d = texture2D(depth, uv).x;
          if (d > 0.999998) return 0.0;
          vec3 offset = viewPoint(uv, d) - p;
          float lengthToSurface = length(offset);
          if (lengthToSurface < 0.035 || lengthToSurface > 2.2) return 0.0;
          float lift = max(0.0, dot(n, offset / lengthToSurface) - 0.08);
          return lift * (1.0 - smoothstep(0.18, 2.1, lengthToSurface));
        }

        void main() {
          vec3 color = texture2D(frame, screenUV).rgb;
          float d = texture2D(depth, screenUV).x;
          vec3 point = viewPoint(screenUV, d);
          vec3 normal = normalize(cross(dFdx(point), dFdy(point)));
          float ao = 0.0;
          if (d < 0.999998 && -point.z < 105.0) {
            vec2 stepSize = projected * (0.64 / max(-point.z, 1.35));
            for (int i = 0; i < 8; i++) {
              float theta = 0.3927 + float(i) * 0.785398;
              float radius = mod(float(i), 2.0) > 0.5 ? 0.62 : 1.28;
              ao += cavity(point, normal, screenUV + vec2(cos(theta), sin(theta)) * stepSize * radius);
            }
            ao = min(ao * 0.135, 0.43) * (1.0 - smoothstep(58.0, 105.0, -point.z));
          }
          vec2 edge = abs(screenUV * 2.0 - 1.0) * vec2(min(aspect, 1.3), 1.0);
          float vignette = 1.0 - 0.18 * smoothstep(0.53, 1.52, length(edge));
          float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
          vec3 grade = mix(vec3(0.88, 0.96, 1.10), vec3(1.08, 1.011, 0.945), smoothstep(0.06, 0.69, luma));
          gl_FragColor = vec4(color * grade * vignette * (1.0 - ao), 1.0);
        }
      `,
    })
    this.quad = new FullScreenQuad(this.material)
  }

  override render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const uniforms = this.material.uniforms
    uniforms.frame.value = read.texture
    uniforms.depth.value = read.depthTexture
    uniforms.projected.value.set(this.camera.projectionMatrix.elements[0], this.camera.projectionMatrix.elements[5])
    uniforms.aspect.value = this.camera.aspect
    renderer.setRenderTarget(this.renderToScreen ? null : write)
    this.quad.render(renderer)
  }
}

export function makeRendering(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, compact = false) {
  const effectsAvailable = !compact && renderer.extensions.has('EXT_color_buffer_float')
  if (!effectsAvailable) {
    return {
      effectsAvailable,
      resize(width: number, height: number) { renderer.setSize(width, height, false) },
      render() { renderer.render(scene, camera) },
    }
  }

  const buffer = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    samples: Math.min(2, renderer.capabilities.maxSamples),
  })
  const composer = new EffectComposer(renderer, buffer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new StreetGrade(camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .37, .48, 1.04))
  composer.addPass(new OutputPass())

  return {
    effectsAvailable,
    resize(width: number, height: number) {
      renderer.setSize(width, height, false)
      composer.setSize(width, height)
    },
    render() { composer.render() },
  }
}
