import type { Vector3 } from 'three'
import { BLOCKS, BOARDWALK, BOUNDS, BUILDINGS, CITY_WIDTH, CN_TOWER, EAST_WEST, GO_RAIL, NORTH_SOUTH, PIERS, PLAZAS, ROGERS_CENTRE, UNION_STATION, streetLabel } from './layout'

interface Point { x: number; z: number }

export function makeMinimap(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('The neighbourhood map requires Canvas')
  const background = document.createElement('canvas')
  const { width, height } = canvas
  background.width = 1100
  background.height = 850
  const streets = background.getContext('2d')!
  const scale = Math.min((background.width - 58) / CITY_WIDTH, (background.height - 58) / (BOUNDS.pierEnd - BOUNDS.north))
  const mapX = (value: number) => value * scale + background.width / 2
  const mapZ = (value: number) => (value - (BOUNDS.north + BOUNDS.pierEnd) / 2) * scale + background.height / 2
  const rect = (left: number, top: number, w: number, h: number) => streets.fillRect(mapX(left), mapZ(top), w * scale, h * scale)
  streets.fillStyle = '#222c34'
  streets.fillRect(0, 0, background.width, background.height)
  streets.fillStyle = '#233d51'
  streets.fillRect(0, mapZ(BOUNDS.shore), background.width, background.height - mapZ(BOUNDS.shore))
  streets.fillStyle = '#505a65'
  rect(BOUNDS.west, BOUNDS.north, CITY_WIDTH, BOUNDS.shore - BOUNDS.north)
  streets.fillStyle = '#343f49'
  for (const block of BLOCKS) rect(block.x - block.w / 2, block.z - block.d / 2, block.w, block.d)
  streets.fillStyle = '#69737b'
  for (const b of BUILDINGS) rect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d)
  streets.fillStyle = '#a2a3a7'
  streets.beginPath()
  streets.ellipse(mapX(ROGERS_CENTRE.x), mapZ(ROGERS_CENTRE.z), ROGERS_CENTRE.rx * scale, ROGERS_CENTRE.rz * scale, 0, 0, Math.PI * 2)
  streets.moveTo(mapX(CN_TOWER.x) + CN_TOWER.radius * scale, mapZ(CN_TOWER.z))
  streets.ellipse(mapX(CN_TOWER.x), mapZ(CN_TOWER.z), CN_TOWER.radius * scale, CN_TOWER.radius * scale, 0, 0, Math.PI * 2)
  streets.fill()
  rect(UNION_STATION.x - UNION_STATION.width / 2, UNION_STATION.z - UNION_STATION.depth / 2, UNION_STATION.width, UNION_STATION.depth)
  streets.fillStyle = '#516c57'
  rect(13, 59, 29, 28)
  for (const plaza of PLAZAS) {
    streets.fillStyle = plaza.name.includes('Park') ? '#516c57' : '#827369'
    rect(plaza.x - plaza.w / 2, plaza.z - plaza.d / 2, plaza.w, plaza.d)
  }
  streets.fillStyle = '#9b876c'
  rect(BOUNDS.west, BOARDWALK.north, CITY_WIDTH, BOARDWALK.south - BOARDWALK.north)
  for (const pier of PIERS) rect(pier.x - pier.width / 2, BOARDWALK.south, pier.width, pier.end - BOARDWALK.south)
  streets.fillStyle = '#456760'
  rect(BOUNDS.west, GO_RAIL.z - GO_RAIL.width / 2, CITY_WIDTH, GO_RAIL.width)
  streets.fillStyle = '#95c4a8'
  for (const side of [-1, 1]) rect(BOUNDS.west, GO_RAIL.z + GO_RAIL.trackOffset * side, CITY_WIDTH, .62)
  streets.fillStyle = '#b29b86'
  streets.globalAlpha = 0.63
  for (const track of [40.1, 43.9]) rect(BOUNDS.west, track, CITY_WIDTH, 0.63)
  streets.globalAlpha = 1

  function overviewLabels() {
    if (!ctx) return
    ctx.save()
    ctx.font = '650 12px system-ui'
    ctx.textAlign = 'center'
    ctx.strokeStyle = '#1e2d38'
    ctx.lineWidth = 3.5
    ctx.font = '650 12px system-ui'
    ctx.fillStyle = '#c5e4ed'
    for (const [label, gx, gz] of [
      ...EAST_WEST.map(street => [streetLabel(street.name), -189, street.z + 2.1] as const),
      ...NORTH_SOUTH.map(street => [streetLabel(street.name), street.x, BOUNDS.north + 11] as const),
    ]) {
      const x = mapX(gx) * width / background.width
      const y = mapZ(gz) * height / background.height
      ctx.strokeText(label, x, y)
      ctx.fillText(label, x, y)
    }
    ctx.fillStyle = '#e2d9c9'
    for (const [label, gx, gz] of [
      ['THEATRE SQ.', -116.5, -159.2], ['MARKET SQ.', 117, -159.2],
      ['EAST BAYFRONT', 175, 73], ['HARBOURFRONT', -49, 76],
      ['ROGERS CENTRE', ROGERS_CENTRE.x, ROGERS_CENTRE.z], ['CN TOWER', CN_TOWER.x + 3, CN_TOWER.z - 11],
      ['UNION STATION', UNION_STATION.x, UNION_STATION.z], ['GO CORRIDOR', -123, GO_RAIL.z - 8],
      ['SPADINA MARINA', PIERS[0].x, 119], ['HARBOURFRONT PIER', PIERS[2].x, 126],
    ] as const) {
      ctx.strokeStyle = '#263542'
      ctx.lineWidth = 3.4
      const x = mapX(gx) * width / background.width
      const y = mapZ(gz) * height / background.height
      ctx.strokeText(label, x, y)
      ctx.fillText(label, x, y)
    }
    ctx.font = 'italic 14px system-ui'
    ctx.fillStyle = '#a8bfce'
    ctx.fillText('Lake Ontario', width * .44, height - 13)
    ctx.restore()
  }

  return (
    actor: Vector3, yaw: number, car: Point | null, motorcycle: Point | null, objective: Point | null, time: number,
    expanded: boolean,
  ) => {
    const frameW = expanded ? background.width : 141 * scale
    const frameH = expanded ? background.height : frameW * height / width
    const left = expanded ? 0 : Math.max(0, Math.min(mapX(actor.x) - frameW / 2, background.width - frameW))
    const top = expanded ? 0 : Math.max(0, Math.min(mapZ(actor.z) - frameH / 2, background.height - frameH))
    const x = (value: number) => (mapX(value) - left) * width / frameW
    const z = (value: number) => (mapZ(value) - top) * height / frameH

    ctx.drawImage(background, left, top, frameW, frameH, 0, 0, width, height)
    if (expanded) overviewLabels()
    ctx.fillStyle = '#cbd6e1'
    ctx.font = '700 17px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('N', width - 23, 27)

    if (car && x(car.x) >= 3 && x(car.x) <= width - 3 && z(car.z) >= 3 && z(car.z) <= height - 3) {
      ctx.fillStyle = '#a3d8de'
      ctx.strokeStyle = '#25353b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(x(car.x) - 7, z(car.z) - 5, 14, 10, 3)
      ctx.fill()
      ctx.stroke()
    }
    if (motorcycle && x(motorcycle.x) >= 6 && x(motorcycle.x) <= width - 6 && z(motorcycle.z) >= 6 && z(motorcycle.z) <= height - 6) {
      const mx = x(motorcycle.x)
      const mz = z(motorcycle.z)
      ctx.fillStyle = '#ffc374'
      ctx.strokeStyle = '#3c3028'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(mx - 5, mz - 4, 10, 8, 3)
      ctx.fill()
      ctx.stroke()
    }
    if (objective) {
      const targetX = x(objective.x)
      const targetZ = z(objective.z)
      const ox = x(actor.x)
      const oz = z(actor.z)
      const dx = targetX - ox
      const dz = targetZ - oz
      const edgeX = dx < 0 ? (13 - ox) / dx : dx > 0 ? (width - 13 - ox) / dx : 1
      const edgeZ = dz < 0 ? (13 - oz) / dz : dz > 0 ? (height - 13 - oz) / dz : 1
      const ratio = Math.min(1, edgeX, edgeZ)
      const mx = ox + dx * ratio
      const mz = oz + dz * ratio
      ctx.strokeStyle = '#ffc17b79'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(mx, mz, 12 + Math.sin(time * 3) * 2, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.strokeStyle = '#342e26'
      ctx.fillStyle = '#ffb45c'
      ctx.beginPath()
      ctx.moveTo(mx, mz - 8)
      ctx.lineTo(mx + 8, mz)
      ctx.lineTo(mx, mz + 8)
      ctx.lineTo(mx - 8, mz)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    ctx.save()
    ctx.translate(x(actor.x), z(actor.z))
    ctx.rotate(-yaw)
    ctx.fillStyle = '#fff5e5'
    ctx.strokeStyle = '#252d2d'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, -12)
    ctx.lineTo(8, 8)
    ctx.lineTo(0, 4.2)
    ctx.lineTo(-8, 8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}
