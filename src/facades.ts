import * as THREE from 'three'
import { box, canvasTexture, matte, randomize } from './graphics'
import type { Building } from './layout'

interface WindowPane {
  x: number
  y: number
  w: number
  h: number
  lit: boolean
  closeBlind: boolean
  shade: number
  row: number
}

function facadeGrid(building: Building, span: number) {
  const glass = building.kind === 'glass'
  return {
    floors: Math.max(2, Math.round(building.h / (building.kind === 'warehouse' ? 4.35 : 3.2))),
    columns: Math.max(2, Math.round(span / (glass ? 2.5 : 3.5))),
    glass,
  }
}

export function facade(building: Building, span: number, seed: number, storefront: boolean, distant = false) {
  const { floors, columns, glass } = facadeGrid(building, span)
  const rand = randomize(seed)
  const masonry = building.kind === 'brick' || building.kind === 'warehouse'
  const base = new THREE.Color(building.color)
  const width = Math.min(distant ? 384 : 768, Math.ceil(span * 31))
  const height = Math.min(distant ? 512 : 1024, Math.ceil(building.h * 35))
  const cellW = width / columns
  const cellH = height / floors
  const storefrontY = storefront ? height - 3.48 * height / building.h : height
  const windows: WindowPane[] = []
  for (let row = 0; row < floors; row++) {
    if ((row + 1) * cellH > storefrontY + 2) continue
    for (let col = 0; col < columns; col++) {
      const edge = glass ? cellW * 0.066 : cellW * (building.kind === 'warehouse' ? 0.17 : 0.22)
      windows.push({
        x: col * cellW + edge,
        y: row * cellH + cellH * (glass ? 0.10 : 0.18),
        w: cellW - edge * 2,
        h: cellH * (glass ? 0.75 : 0.64),
        lit: rand() > (glass ? 0.74 : 0.66),
        closeBlind: rand() > 0.64,
        shade: rand(),
        row,
      })
    }
  }

  const map = canvasTexture(width, height, (ctx) => {
    ctx.fillStyle = base.getStyle()
    ctx.fillRect(0, 0, width, height)
    const brickPaint = Array.from({ length: 19 }, (_, index) => base.clone().multiplyScalar(0.63 + index * 0.031).getStyle())
    if (masonry) {
      const brickW = width / span * (building.kind === 'warehouse' ? 0.48 : 0.34)
      const brickH = height / building.h * (building.kind === 'warehouse' ? 0.19 : 0.122)
      ctx.fillStyle = '#918176'
      ctx.fillRect(0, 0, width, height)
      for (let row = 0; row * brickH < height; row++) {
        const y = row * brickH
        for (let x = row % 2 ? -brickW / 2 : 0; x < width; x += brickW) {
          ctx.fillStyle = brickPaint[Math.floor(rand() * brickPaint.length)]
          ctx.fillRect(x + 0.4, y + 0.45, brickW - 0.69, brickH - 0.74)
          ctx.fillStyle = '#33251934'
          ctx.fillRect(x + 0.4, y + brickH - 1.03, brickW - 0.63, 0.6)
        }
      }
    } else {
      for (let row = 0; row < floors; row++) {
        for (let col = 0; col < columns; col++) {
          ctx.fillStyle = brickPaint[Math.floor(6 + rand() * 10)]
          ctx.fillRect(col * cellW + 0.65, row * cellH + 0.65, cellW - 1.3, cellH - 1.3)
        }
      }
    }

    if (!distant) {
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = i % 3 ? '#32251b12' : '#fff2d71d'
        ctx.fillRect(rand() * width, rand() * height, 1 + rand() * 3, 0.65 + rand() * 2.5)
      }
    }

    for (const { x, y, w, h, lit, closeBlind, shade, row } of windows) {
      const reveal = Math.max(2.4, cellW * 0.055)
      ctx.fillStyle = glass ? '#2e383d' : '#5d473c'
      ctx.fillRect(x - reveal, y - reveal, w + 2 * reveal, h + 2 * reveal)
      const color = ctx.createLinearGradient(x, y, x + w * 0.12, y + h)
      color.addColorStop(0, lit ? '#514b49' : glass ? (shade > 0.48 ? '#778b9b' : '#5d778a') : '#536b7c')
      color.addColorStop(0.62, lit ? '#af916d' : (row > floors * 0.45 ? '#405258' : '#536a77'))
      color.addColorStop(1, lit ? '#5b5047' : (glass ? '#344850' : '#253741'))
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
      const reflectedLine = Math.floor(y + h * (0.47 + shade * 0.14))
      ctx.fillStyle = lit ? '#fff0c779' : '#cbd5d04b'
      ctx.fillRect(x, reflectedLine, w, Math.max(1, h * 0.07))
      if (closeBlind) {
        ctx.fillStyle = lit ? '#c3a88c70' : '#b7bdb63b'
        ctx.fillRect(x + w * 0.58, y + 1, w * 0.42, h * 0.77)
        ctx.fillStyle = '#38546436'
        for (let line = 1; line < 7; line++) ctx.fillRect(x + w * 0.58, y + h * line * 0.11, w * 0.42, 1)
      }
      ctx.fillStyle = glass ? '#b4bebeaa' : '#2d3c43'
      ctx.fillRect(x + w * 0.49, y, Math.max(1, w * 0.026), h)
      ctx.fillRect(x, y + h * 0.62, w, Math.max(1, h * 0.025))
      if (lit) {
        ctx.fillStyle = '#fff0c4'
        ctx.fillRect(x + w * 0.14, y + h * 0.15, w * 0.26, Math.max(1.2, h * 0.047))
        ctx.fillStyle = '#252c30aa'
        ctx.fillRect(x + w * 0.09, y + h * 0.77, w * 0.31, h * 0.2)
      }
      if (!glass) {
        ctx.fillStyle = '#ccb5a0'
        ctx.fillRect(x - reveal * 1.3, y + h + reveal, w + reveal * 2.6, Math.max(2, h * 0.055))
        ctx.fillStyle = '#4b382e74'
        ctx.fillRect(x - reveal, y + h + reveal + 3, w + reveal * 2, 2)
      }
    }

    ctx.fillStyle = base.clone().multiplyScalar(0.51).getStyle()
    ctx.fillRect(0, storefrontY, width, height - storefrontY)
    const weathering = ctx.createLinearGradient(0, 0, 0, height)
    weathering.addColorStop(0, '#15232c49')
    weathering.addColorStop(0.09, '#0000')
    weathering.addColorStop(0.72, '#0000')
    weathering.addColorStop(1, '#27272546')
    ctx.fillStyle = weathering
    ctx.fillRect(0, 0, width, height)
  })

  if (distant) return new THREE.MeshStandardMaterial({ map, roughness: 0.77, envMapIntensity: 0.44 })
  const mask = canvasTexture(Math.ceil(width / 2), Math.ceil(height / 2), (ctx) => {
    ctx.scale(0.5, 0.5)
    ctx.fillStyle = '#00dc00'
    ctx.fillRect(0, 0, width, height)
    for (const { x, y, w, h, shade } of windows) {
      const roughness = Math.round((glass ? 44 : 84) + shade * 31)
      ctx.fillStyle = `rgb(0,${roughness},${glass ? 121 : 61})`
      ctx.fillRect(x, y, w, h)
    }
  })
  mask.colorSpace = THREE.NoColorSpace
  const glow = canvasTexture(Math.ceil(width / 2), Math.ceil(height / 2), (ctx) => {
    ctx.scale(0.5, 0.5)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    for (const { x, y, w, h, lit } of windows) {
      if (!lit) continue
      const light = ctx.createLinearGradient(x, y, x + w * 0.24, y + h)
      light.addColorStop(0, '#100b07')
      light.addColorStop(0.53, '#cf9d5e')
      light.addColorStop(1, '#17313b')
      ctx.fillStyle = light
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#ffeac2'
      ctx.fillRect(x + w * 0.14, y + h * 0.15, w * 0.26, Math.max(1.2, h * 0.047))
    }
  })
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 1,
    metalness: 0.85,
    metalnessMap: mask,
    roughnessMap: mask,
    emissiveMap: glow,
    emissive: '#ffffff',
    emissiveIntensity: 1.02,
    envMapIntensity: glass ? 1.15 : 0.72,
  })
}

const storefronts = new Map<number, THREE.MeshPhysicalMaterial>()

function shopGlass(variant: number) {
  const loaded = storefronts.get(variant)
  if (loaded) return loaded
  const rand = randomize(511 + 1567 * variant)
  const map = canvasTexture(512, 384, (ctx) => {
    const room = ctx.createLinearGradient(0, 0, 0, 384)
    room.addColorStop(0, '#353c3b')
    room.addColorStop(0.18, '#534c3a')
    room.addColorStop(0.49, '#9f7c49')
    room.addColorStop(0.82, '#57483a')
    room.addColorStop(1, '#273942')
    ctx.fillStyle = room
    ctx.fillRect(0, 0, 512, 384)
    for (let shelf = 0; shelf < 3; shelf++) {
      const y = 134 + shelf * 58
      ctx.fillStyle = '#3b322a'
      ctx.fillRect(45, y - 16, 419, 54)
      for (let x = 55; x < 448;) {
        const w = 5 + rand() * 21
        const h = 7 + rand() * 29
        ctx.fillStyle = ['#9a8767', '#7f5544', '#5e6f63', '#c19862', '#584e4c'][Math.floor(rand() * 5)]
        ctx.fillRect(x, y + 28 - h, w, h)
        ctx.fillStyle = '#d3ba9774'
        ctx.fillRect(x + 1, y + 24 - h, w - 2, 4)
        x += w + 4
      }
      ctx.fillStyle = '#be9665'
      ctx.fillRect(40, y + 29, 435, 5)
      ctx.fillStyle = '#272a2b'
      ctx.fillRect(40, y + 34, 435, 6)
    }
    for (const i of [-1, 1]) {
      const x = 256 + i * 138
      ctx.fillStyle = '#332d26'
      ctx.fillRect(x - 1, 0, 3, 76)
      const light = ctx.createRadialGradient(x, 94, 4, x, 94, 97)
      light.addColorStop(0, '#ffc67084')
      light.addColorStop(1, '#ffc67000')
      ctx.fillStyle = light
      ctx.fillRect(x - 98, 0, 196, 192)
      ctx.fillStyle = '#493b2c'
      ctx.beginPath()
      ctx.moveTo(x - 14, 90)
      ctx.lineTo(x - 7, 71)
      ctx.lineTo(x + 7, 71)
      ctx.lineTo(x + 14, 90)
      ctx.fill()
      ctx.fillStyle = '#fff0ba'
      ctx.fillRect(x - 11, 89, 22, 4)
    }
    ctx.fillStyle = '#654434'
    ctx.fillRect(0, 323 + variant * 5, 512, 80)
    ctx.fillStyle = '#ab8661'
    ctx.fillRect(0, 321 + variant * 5, 512, 5)
    const reflection = ctx.createLinearGradient(0, 0, 512, 384)
    reflection.addColorStop(0, '#c1d1d65e')
    reflection.addColorStop(0.34, '#9facb523')
    reflection.addColorStop(0.53, '#a6b6c428')
    reflection.addColorStop(0.56, '#a6b6c479')
    reflection.addColorStop(0.81, '#253b4d14')
    reflection.addColorStop(1, '#2e49574a')
    ctx.fillStyle = reflection
    ctx.fillRect(0, 0, 512, 384)
  })

  const material = new THREE.MeshPhysicalMaterial({
    color: '#aba69f',
    map,
    emissiveMap: map,
    emissive: '#f4c38f',
    emissiveIntensity: 0.94,
    roughness: 0.33,
    metalness: 0.25,
    clearcoat: 0.69,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.97,
  })
  storefronts.set(variant, material)
  return material
}

const silver = new THREE.MeshStandardMaterial({ color: '#ad9e8b', metalness: 0.77, roughness: 0.32 })

export function addShopWindows(parent: THREE.Object3D, b: Building, front: number, frame: THREE.Material, bay: number, divisions: number) {
  const sill = matte('#b3a59b')
  const kickPlate = matte('#302b26')
  const door = matte('#353e3b')
  box(parent, frame, b.x, 1.66, front + 0.09, b.w - 0.22, 3.22, 0.23)
  for (let i = 0; i < divisions; i++) {
    const x = b.x - b.w / 2 + bay * (i + 0.5)
    const entrance = i === Math.floor(divisions * 0.54)
    const panelWidth = bay - 0.48
    box(parent, kickPlate, x, 1.69, front + 0.21, panelWidth + 0.1, 2.85, 0.09, false)
    box(parent, shopGlass(i % 4), x, 1.79, front + 0.267, panelWidth - 0.12, 2.53, 0.036, false)
    box(parent, door, x, 1.77, front + 0.31, 0.083, 2.64, 0.071, false)
    box(parent, door, x, 2.46, front + 0.307, panelWidth, 0.105, 0.077, false)
    box(parent, sill, x, 0.46, front + 0.31, panelWidth + 0.15, 0.17, 0.21, false)
    box(parent, door, x - bay / 2 + 0.17, 1.72, front + 0.31, 0.19, 3.17, 0.146)
    if (entrance) {
      box(parent, door, x - 0.62, 1.45, front + 0.318, 0.08, 2.69, 0.123)
      box(parent, door, x + 0.62, 1.45, front + 0.318, 0.08, 2.69, 0.123)
      box(parent, silver, x - 0.15, 1.1, front + 0.411, 0.044, 0.28, 0.037)
      box(parent, silver, x + 0.15, 1.1, front + 0.411, 0.044, 0.28, 0.037)
      box(parent, sill, x, 0.128, front + 0.5, 1.47, 0.16, 0.95, false)
    }
  }
}

export function facadeRelief(parent: THREE.Object3D, b: Building, index: number) {
  const { floors, columns, glass } = facadeGrid(b, b.w)
  const floor = b.h / floors
  const span = b.w / columns
  const front = b.z + b.d * 0.5
  const facing = matte(new THREE.Color(b.color).multiplyScalar(glass ? 0.86 : 1.14).getStyle())
  if (glass) {
    const edge = matte('#6d7c82')
    const railing = new THREE.MeshPhysicalMaterial({ color: '#6f8b98', roughness: 0.33, metalness: 0.58, clearcoat: 0.55 })
    for (let row = 1; row < floors - 1; row++) {
      const y = row * floor + 0.14
      const sill = row % 3 === 0 ? 1.1 : 0.67
      for (let col = index % 2; col < columns; col += 3) {
        const x = b.x - b.w * 0.5 + (col + 0.73) * span
        const w = span * 1.33
        box(parent, facing, x, y, front + sill * 0.41, w, 0.2, sill + 0.14, false)
        box(parent, railing, x, y + 0.52, front + sill * 0.91, w, 0.78, 0.045, false)
        box(parent, edge, x, y + 0.94, front + sill * 0.92, w + 0.045, 0.053, 0.079, false)
        box(parent, edge, x - w / 2, y + 0.54, front + sill * 0.92, 0.064, 0.83, 0.067, false)
        box(parent, edge, x + w / 2, y + 0.54, front + sill * 0.92, 0.064, 0.83, 0.067, false)
      }
    }
    return
  }
  const profile = matte('#b7a596')
  for (let row = 1; row < floors; row++) {
    const y = row * floor + floor * 0.19 + 0.11
    if (y < 4.4 && b.sign) continue
    for (let col = 0; col < columns; col++) {
      const x = b.x - b.w * 0.5 + (col + 0.5) * span
      box(parent, profile, x, y, front + 0.081, span * 0.65, 0.075, 0.19, false)
    }
  }
  for (const side of [-1, 1]) {
    const x = b.x + side * (b.w * 0.5 - 0.31)
    box(parent, facing, x, b.h / 2 + 0.12, front + 0.036, 0.49, b.h, 0.112, false)
  }
  for (const [offset, projection, thickness] of [[0.45, 0.37, 0.14], [0.28, 0.62, 0.15]]) {
    box(parent, facing, b.x, b.h - offset, b.z, b.w + projection, thickness, b.d + projection, false)
  }
}
