import * as THREE from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'

const surfaceNames = ['asphalt', 'paving', 'sidewalk', 'wood', 'grass', 'bark'] as const
type SurfaceName = typeof surfaceNames[number]

interface SurfaceMaps {
  diffuse: THREE.Texture
  normal: THREE.Texture
}

export interface CityMaterials {
  sky: THREE.DataTexture
  surface: (name: SurfaceName, repeatX: number, repeatY: number) => THREE.MeshStandardMaterial
}

export async function loadCityMaterials(renderer: THREE.WebGLRenderer): Promise<CityMaterials> {
  const base = `${import.meta.env.BASE_URL}materials/`
  const loader = new THREE.TextureLoader()
  const hdrLoader = new HDRLoader()
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)

  async function loadMap(file: string, srgb = false) {
    const texture = await loader.loadAsync(base + file)
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = anisotropy
    return texture
  }

  const [sky, asphaltRoughness, maps] = await Promise.all([
    hdrLoader.loadAsync(base + 'industrial-sunset.hdr'),
    loadMap('asphalt-rough.jpg'),
    Promise.all(surfaceNames.map(async (name): Promise<[SurfaceName, SurfaceMaps]> => {
      const [diffuse, normal] = await Promise.all([
        loadMap(`${name}-diff.jpg`, true),
        loadMap(`${name}-nor_gl.jpg`),
      ])
      return [name, { diffuse, normal }]
    })),
  ])
  sky.mapping = THREE.EquirectangularReflectionMapping
  sky.wrapS = THREE.RepeatWrapping
  gradeSky(sky)
  const textures = new Map(maps)
  const style = {
    asphalt: { tint: '#afb5bc', roughness: 0.92, normal: 0.54 },
    paving: { tint: '#d9ccbd', roughness: 0.88, normal: 0.73 },
    sidewalk: { tint: '#a8a9b1', roughness: 0.84, normal: 0.68 },
    wood: { tint: '#c6b2a0', roughness: 0.89, normal: 0.70 },
    grass: { tint: '#bbc096', roughness: 0.96, normal: 0.72 },
    bark: { tint: '#bca28e', roughness: 0.95, normal: 0.84 },
  }
  const cache = new Map<string, THREE.MeshStandardMaterial>()

  return {
    sky,
    surface(name, repeatX, repeatY) {
      const key = `${name}/${repeatX}/${repeatY}`
      const ready = cache.get(key)
      if (ready) return ready
      const { diffuse, normal } = textures.get(name)!
      const settings = style[name]
      const map = (texture: THREE.Texture) => {
        const copy = texture.clone()
        copy.repeat.set(repeatX, repeatY)
        return copy
      }
      const material = new THREE.MeshStandardMaterial({
        map: map(diffuse),
        normalMap: map(normal),
        normalScale: new THREE.Vector2(settings.normal, settings.normal),
        color: settings.tint,
        roughness: settings.roughness,
        envMapIntensity: name === 'asphalt' ? 0.47 : 0.46,
      })
      if (name === 'asphalt') {
        material.roughnessMap = map(asphaltRoughness)
        addDampPatches(material)
      }
      cache.set(key, material)
      return material
    },
  }
}

function gradeSky(texture: THREE.DataTexture) {
  const { width, height, data } = texture.image
  if (!(data instanceof Uint16Array)) return
  for (let y = 0; y < height; y++) {
    const elevation = (0.5 - y / height) * Math.PI
    const horizon = Math.exp(-Math.abs(elevation - 0.03) * 6.2)
    const highSky = THREE.MathUtils.smoothstep(elevation, 0.03, 0.75)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const angle = (x / width - 0.60) * Math.PI * 2
      const glow = (0.14 + 0.86 * Math.pow(Math.max(0, Math.cos(angle)), 2.15)) * horizon
      const r = THREE.DataUtils.fromHalfFloat(data[i])
      const g = THREE.DataUtils.fromHalfFloat(data[i + 1])
      const b = THREE.DataUtils.fromHalfFloat(data[i + 2])
      const sunPeak = 1 / (1 + (r * 0.213 + g * 0.715 + b * 0.072) / 12)
      data[i] = THREE.DataUtils.toHalfFloat(r * sunPeak * (0.42 - highSky * 0.12 + glow * 1.02) + glow * 0.30)
      data[i + 1] = THREE.DataUtils.toHalfFloat(g * sunPeak * (0.45 - highSky * 0.13 + glow * 0.34) + glow * 0.069)
      data[i + 2] = THREE.DataUtils.toHalfFloat(b * sunPeak * (0.63 - highSky * 0.084 + glow * 0.012) + glow * 0.044)
    }
  }
  texture.needsUpdate = true
}

function addDampPatches(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec2 vStreetPosition;',
    ).replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvStreetPosition = (modelMatrix * vec4(position, 1.0)).xz;',
    )
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec2 vStreetPosition;
      float streetHash(vec2 point) {
        return fract(sin(dot(point, vec2(123.1, 298.9))) * 43758.54);
      }
      float streetNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 t = fract(point);
        t = t * t * (3.0 - 2.0 * t);
        return mix(
          mix(streetHash(cell), streetHash(cell + vec2(1.0, 0.0)), t.x),
          mix(streetHash(cell + vec2(0.0, 1.0)), streetHash(cell + vec2(1.0)), t.x),
          t.y
        );
      }
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      float low = streetNoise(vStreetPosition * vec2(0.29, 0.18));
      float high = streetNoise(vStreetPosition * 0.94);
      float damp = smoothstep(0.46, 0.79, low * 0.77 + high * 0.23);
      diffuseColor.rgb *= mix(0.94 + high * 0.14, 0.57, damp);
      roughnessFactor = mix(roughnessFactor, 0.22, damp * 0.82);
    `)
  }
}
