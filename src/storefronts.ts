import * as THREE from 'three'
import { box, canvasTexture, matte, randomize } from './graphics'
import type { Building } from './layout'

const tenants = [
  ['QUAY COFFEE', '#37635d', 'coffee', 'ESPRESSO · PASTRIES'],
  ['CITY PHARMACY', '#376569', 'shelves', 'HEALTH & WELLNESS'],
  ['JUNIPER FLORAL', '#596344', 'plants', 'FLOWERS · PLANTS'],
  ['LAKESHORE PIZZA', '#8d3f3b', 'coffee', 'PIZZA BY THE SLICE'],
  ['PARKSIDE BOOKS', '#544355', 'shelves', 'NEW & USED'],
  ['FRONT ST. DELI', '#6c5837', 'shelves', 'SANDWICHES · GROCERIES'],
  ['GOOD NEIGHBOUR', '#703b49', 'shelves', 'CONVENIENCE'],
  ['QUEENS QUAY BAKERY', '#94502d', 'coffee', 'BREAD · COFFEE'],
  ['NIGHT OWL RECORDS', '#434360', 'shelves', 'VINYL · HI-FI'],
  ['YORK STREET BARBER', '#426572', 'coffee', 'CUTS & SHAVES'],
  ['HARBOUR BICYCLES', '#52624b', 'bikes', 'SALES · SERVICE'],
  ['SPADINA MARKET', '#7d4939', 'plants', 'FRESH PRODUCE'],
  ['SUGAR BEACH GELATO', '#755073', 'coffee', 'GELATO · SORBET'],
  ['STUDIO PRINT SHOP', '#39536d', 'shelves', 'PRINT · COPY'],
  ['LITTLE TOKYO RAMEN', '#803c3d', 'coffee', 'NOODLE BAR'],
  ['OLD TOWN VINTAGE', '#685d3d', 'shelves', 'VINTAGE CLOTHING'],
  ['UNION NEWS', '#506174', 'shelves', 'GIFTS · MAGAZINES'],
  ['LAKEVIEW OPTICAL', '#415f58', 'shelves', 'EYEWEAR'],
  ['CORNER HARDWARE', '#785649', 'shelves', 'TOOLS · SUPPLIES'],
  ['THE WATERLINE', '#465570', 'coffee', 'KITCHEN & BAR'],
  ['BAYFRONT TEA', '#754956', 'coffee', 'TEA · DESSERT'],
  ['PAPER & CLAY', '#89693f', 'shelves', 'CERAMICS · GIFTS'],
  ['PORTLAND GROCER', '#4f6747', 'plants', 'FRUIT · VEGETABLES'],
  ['DOCKSIDE FISH CO.', '#416871', 'shelves', 'FISH MARKET'],
] as const

const width = 360
const height = 270
const columns = 6
const rows = 4
const shopHeight = 3.42
const framing = matte('#6d665f')
const cream = matte('#e9cfad')
const canopyGlass = new THREE.MeshStandardMaterial({ color: '#5a6c73', metalness: .5, roughness: .32 })

function drawShop(ctx: CanvasRenderingContext2D, index: number) {
  const [name, paint, display, descriptor] = tenants[index]
  const rand = randomize(500 + index * 21)
  ctx.fillStyle = paint
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#292d35'
  ctx.fillRect(5, 6, width - 10, 52)
  ctx.fillStyle = paint
  ctx.fillRect(9, 10, width - 18, 44)
  ctx.strokeStyle = '#ead7b49a'
  ctx.strokeRect(13, 13, width - 26, 38)
  ctx.fillStyle = '#fff1d5'
  ctx.textAlign = 'center'
  ctx.font = index % 4 === 0 ? 'bold 26px Georgia,serif' : '800 26px system-ui,sans-serif'
  ctx.fillText(name, width / 2, 41, width - 40)

  const look = ctx.createLinearGradient(0, 63, 0, 251)
  look.addColorStop(0, '#5c4438')
  look.addColorStop(.37, index % 3 === 1 ? '#dec69d' : '#c88e58')
  look.addColorStop(.78, '#967563')
  look.addColorStop(1, '#53463e')
  ctx.fillStyle = look
  ctx.fillRect(10, 66, width - 20, 184)
  for (const x of [47, 133, 223, 313]) {
    ctx.fillStyle = '#47352b'
    ctx.fillRect(x, 64, 2, 26)
    ctx.fillStyle = '#ffffdc'
    ctx.fillRect(x - 11, 88, 24, 5)
    const halo = ctx.createRadialGradient(x, 96, 0, x, 96, 55)
    halo.addColorStop(0, '#ffd692b5')
    halo.addColorStop(1, '#ffd69200')
    ctx.fillStyle = halo
    ctx.fillRect(x - 55, 66, 110, 93)
  }
  if (display === 'shelves') {
    for (let y = 132; y <= 218; y += 38) {
      ctx.fillStyle = '#574535'
      ctx.fillRect(14, y + 24, width - 28, 6)
      for (let x = 17; x < width - 16; x += 13) {
        const size = 8 + rand() * 16
        ctx.fillStyle = ['#f0d2a0', '#694b49', '#969960', '#b68260', '#566375'][(x + y + index) % 5]
        ctx.fillRect(x, y + 24 - size, 8 + rand() * 4, size)
      }
    }
  } else if (display === 'plants') {
    for (let x = 20; x < width; x += 28) {
      const y = 162 + rand() * 41
      ctx.fillStyle = '#795345'
      ctx.fillRect(x - 7, y + 27, 22, 17)
      for (let leaf = 0; leaf < 9; leaf++) {
        ctx.fillStyle = ['#62714a', '#535939', '#9caa6f', '#b18163'][leaf % 4]
        ctx.beginPath()
        ctx.ellipse(x + rand() * 25 - 14, y + rand() * 33, 5, 12, rand() * 2 - 1, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (display === 'bikes') {
    ctx.strokeStyle = '#303e46'
    ctx.lineWidth = 4
    for (const x of [32, 145, 258]) {
      for (const dx of [0, 57]) {
        ctx.beginPath()
        ctx.arc(x + dx, 217, 19, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(x, 217)
      ctx.lineTo(x + 21, 178)
      ctx.lineTo(x + 38, 216)
      ctx.lineTo(x + 57, 217)
      ctx.lineTo(x + 49, 172)
      ctx.stroke()
    }
  } else {
    for (const x of [23, 103, 227, 301]) {
      ctx.fillStyle = '#654338'
      ctx.fillRect(x, 193, 48, 9)
      ctx.fillRect(x + 23, 202, 4, 33)
      ctx.fillStyle = '#e6bd91'
      ctx.fillRect(x + 16, 184, 10, 11)
      ctx.fillStyle = '#554e46'
      ctx.fillRect(x + 2, 213, 16, 18)
    }
    ctx.fillStyle = '#885f47'
    ctx.fillRect(120, 157, 111, 16)
  }
  const glare = ctx.createLinearGradient(28, 67, 292, 242)
  glare.addColorStop(0, '#a3ccdb51')
  glare.addColorStop(.43, '#9fbbce08')
  glare.addColorStop(.53, '#cce4f351')
  glare.addColorStop(.67, '#5c849e25')
  glare.addColorStop(1, '#27455765')
  ctx.fillStyle = glare
  ctx.fillRect(9, 67, width - 18, 184)
  ctx.fillStyle = '#243135'
  for (const x of [9, 121, 235, 342]) ctx.fillRect(x, 62, 9, 194)
  ctx.fillRect(9, 65, width - 18, 7)
  ctx.fillRect(9, 106, width - 18, 6)
  ctx.fillRect(9, 238, width - 18, 14)
  const doorX = index % 2 ? 122 : 214
  ctx.fillStyle = '#2f393e'
  ctx.fillRect(doorX, 119, 43, 139)
  ctx.fillStyle = '#80a1a7'
  ctx.fillRect(doorX + 4, 125, 35, 90)
  ctx.fillStyle = '#d5d2ba'
  ctx.fillRect(doorX + 35, 176, 3, 14)
  ctx.fillStyle = '#f9e7c3'
  ctx.font = 'bold 12px system-ui,sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(descriptor, index % 2 ? 247 : 103, 143, 160)
  ctx.fillStyle = '#62534d'
  ctx.fillRect(0, 257, width, 13)
}

export function makeRetail() {
  const map = canvasTexture(width * columns, height * rows, ctx => {
    for (let index = 0; index < tenants.length; index++) {
      ctx.save()
      ctx.translate(index % columns * width, Math.floor(index / columns) * height)
      ctx.beginPath()
      ctx.rect(0, 0, width, height)
      ctx.clip()
      drawShop(ctx, index)
      ctx.restore()
    }
  })
  const material = new THREE.MeshStandardMaterial({
    map, emissiveMap: map, emissive: '#f8e3cc', emissiveIntensity: .61, roughness: .51, metalness: .14,
  })
  const fronts = tenants.map((_, index) => {
    const plane = new THREE.PlaneGeometry(1, 1)
    const tex = plane.attributes.uv
    const u = index % columns / columns
    const v = (rows - 1 - Math.floor(index / columns)) / rows
    for (let i = 0; i < tex.count; i++) {
      tex.setXY(i, u + (1 + tex.getX(i) * (width - 2)) / (width * columns),
        v + (1 + tex.getY(i) * (height - 2)) / (height * rows))
    }
    return plane
  })
  return (parent: THREE.Object3D, building: Building, seed: number, side = 0) => {
    const { x, z, w, d } = building
    const span = side ? d : w
    const shops = THREE.MathUtils.clamp(Math.round(span / 7.3), 1, 4)
    const bay = (span - .42) / shops
    const row = new THREE.Group()
    row.position.set(x + side * w / 2, .128, z + (side ? 0 : d / 2))
    row.rotation.y = side * Math.PI / 2
    parent.add(row)
    for (let i = 0; i < shops; i++) {
      const index = THREE.MathUtils.euclideanModulo(seed + i * 5, tenants.length)
      const center = (i - (shops - 1) / 2) * bay
      const panel = new THREE.Mesh(fronts[index], material)
      panel.scale.set(bay - .16, shopHeight, 1)
      panel.position.set(center, shopHeight / 2, .09)
      panel.receiveShadow = true
      panel.layers.enable(1)
      row.add(panel)
      box(row, framing, center + bay / 2, 1.62, .095, .12, 3.24, .19, false)
      box(row, framing, center, .035, .16, bay - .17, .073, .41, false)
      const style = index % 5
      if (style < 2) {
        const awning = matte(tenants[index][1])
        box(row, awning, center, 2.57, .61, bay - .18, .095, 1.09, false).rotation.x = .19
        box(row, awning, center, 2.415, 1.13, bay - .18, .22, .061, false)
        if (style === 0) {
          for (const stripe of [-.35, -.12, .12, .35]) {
            box(row, cream, center + stripe * bay, 2.624, .61, bay * .063, .013, 1.09, false).rotation.x = .19
            box(row, cream, center + stripe * bay, 2.415, 1.164, bay * .063, .214, .012, false)
          }
        }
      } else if (style === 3) {
        box(row, canopyGlass, center, 2.67, .45, bay - .21, .078, .79, false)
      }
    }
  }
}
