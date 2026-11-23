export const BOUNDS = { west: -232, east: 232, north: -228, shore: 97, pierEnd: 138 }
export const SPAWN = { x: -11.4, z: 57.8, yaw: 0 }
export const CAR_START = { x: 4.5, z: 59, yaw: 0 }
export const MOTORCYCLE_START = { x: -4.35, z: 63.3, yaw: Math.PI }
export const PICKUP = { x: -31, z: 29.4 }
export const DROPOFF = { x: 42, z: 109 }
export const RAIL_STOP = { x: 21, z: -64.5 }
export const BOARDWALK = { north: 91.3, south: 99.8, height: .17 }
export const PIERS = [
  { x: -112, width: 12, end: 124, name: 'Spadina Marina' },
  { x: -29, width: 11, end: 131, name: 'Rees Street Dock' },
  { x: 42, width: 17, end: 130, name: 'Harbourfront Pier' },
  { x: 134, width: 14, end: BOUNDS.pierEnd, name: 'East Bayfront Dock' },
] as const
export const CN_TOWER = { x: 18, z: -44, radius: 8.2 }
export const ROGERS_CENTRE = { x: -37, z: -41, rx: 25.7, rz: 17.4 }
export const UNION_STATION = { x: 43, z: -102, width: 48, depth: 24 }
export const GO_RAIL = { z: -81.2, width: 9.4, deck: 5.62, trackOffset: 2.42 }

export const EAST_WEST = [
  { z: -191, name: 'King Street W', width: 17 },
  { z: -128, name: 'Front Street W', width: 16 },
  { z: -68, name: 'Bremner Boulevard', width: 14 },
  { z: -12, name: 'Lake Shore Boulevard W', width: 16 },
  { z: 42, name: 'Queens Quay W', width: 19 },
]

export const NORTH_SOUTH = [
  { x: -160, name: 'Portland Street', width: 15 },
  { x: -74, name: 'Lower Spadina Avenue', width: 15 },
  { x: 0, name: 'York Street', width: 15 },
  { x: 74, name: 'Bay Street', width: 15 },
  { x: 160, name: 'Jarvis Street', width: 15 },
]

export const CITY_WIDTH = BOUNDS.east - BOUNDS.west
export const CITY_DEPTH = BOUNDS.shore - BOUNDS.north
export const CITY_CENTER_Z = (BOUNDS.shore + BOUNDS.north) / 2

const columns = [
  BOUNDS.west + 1,
  ...NORTH_SOUTH.map(({ x, width }) => x + width / 2 + 0.5),
]
const endOfColumns = [
  ...NORTH_SOUTH.map(({ x, width }) => x - width / 2 - 0.5),
  BOUNDS.east - 1,
]
const rows = [[-226, -200], [-181.9, -136.5], [-119.5, -75.5], [-60.5, -20.5], [-4, 32.5], [51.5, 95]] as const

export const BLOCKS = rows.flatMap(([front, back]) => columns.map((left, i) => ({
  x: (left + endOfColumns[i]) * 0.5, z: (front + back) * 0.5, w: endOfColumns[i] - left, d: back - front,
})))

export const PLAZAS = [
  { x: -116.5, z: -159.2, w: 48, d: 34, name: 'Theatre Square' },
  { x: 117, z: -159.2, w: 48, d: 34, name: 'Market Square' },
  { x: 196, z: 72.8, w: 47, d: 34, name: 'East Bayfront Park' },
]
type BuildingKind = 'brick' | 'glass' | 'stone' | 'warehouse'
export interface Building {
  x: number
  z: number
  w: number
  d: number
  h: number
  color: string
  kind: BuildingKind
  sign?: string
  awning?: string
}

function fitBuildingToBlock(b: Building, block: typeof BLOCKS[number]) {
  // Leave room for storefronts, steps and roof trim within the sidewalk edge.
  const west = block.x - block.w / 2 + 3.6
  const east = block.x + block.w / 2 - 3.6
  const north = block.z - block.d / 2 + 2.65
  const south = Math.min(block.z + block.d / 2 - 3.9,
    block.z > -120 && block.z < GO_RAIL.z ? GO_RAIL.z - GO_RAIL.width / 2 - 2 : Infinity)
  const w = Math.min(b.w, east - west)
  const d = Math.min(b.d, south - north)
  return {
    ...b, w, d,
    x: Math.max(west + w / 2, Math.min(b.x, east - w / 2)),
    z: Math.max(north + d / 2, Math.min(b.z, south - d / 2)),
  }
}

const coreBuildings: Building[] = [
  { x: 51, z: -38, w: 23, d: 29, h: 16, color: '#aa876d', kind: 'stone', sign: 'YORK COFFEE', awning: '#2d5558' },
  { x: -35, z: 16, w: 25, d: 21, h: 10.8, color: '#b07155', kind: 'brick', sign: 'QUAY MARKET', awning: '#b94526' },
  { x: -57, z: 11, w: 14, d: 20, h: 7.7, color: '#bd9b7e', kind: 'brick', sign: 'LAKE ST. BOOKS', awning: '#34595e' },
  { x: -16, z: 9, w: 11, d: 16, h: 14, color: '#a1806a', kind: 'brick' },
  { x: 20, z: 13, w: 16, d: 19, h: 33, color: '#74979c', kind: 'glass' },
  { x: 40, z: 11, w: 15, d: 18, h: 26, color: '#a3a7a0', kind: 'stone' },
  { x: 58, z: 16, w: 13.5, d: 23, h: 13, color: '#8e5347', kind: 'brick', sign: 'COMMON GROUND', awning: '#9d4939' },
  { x: -53, z: 72, w: 19, d: 29, h: 8.3, color: '#a3634f', kind: 'warehouse', sign: 'SPADINA WORKS' },
  { x: -30, z: 71, w: 18, d: 23, h: 6.4, color: '#a3816f', kind: 'warehouse', sign: 'HARBOUR STUDIO' },
  { x: 54, z: 66, w: 18, d: 19, h: 7.2, color: '#8b594b', kind: 'warehouse', sign: 'BOATHOUSE', awning: '#2b5659' },
  { x: -104, z: -43, w: 34, d: 28, h: 37, color: '#81949d', kind: 'glass' },
  { x: 104, z: -42, w: 34, d: 31, h: 41, color: '#8ca2a6', kind: 'glass' },
  { x: -102, z: 14, w: 33, d: 28, h: 19, color: '#a77964', kind: 'brick', sign: 'SPADINA HOUSE' },
  { x: 104, z: 14, w: 32, d: 29, h: 17, color: '#aa9584', kind: 'stone', sign: 'BAY STREET BAKERY', awning: '#486261' },
  { x: -106, z: 68, w: 29, d: 22, h: 15, color: '#a46859', kind: 'warehouse', sign: 'WEST QUAY' },
  { x: 102, z: 67, w: 30, d: 23, h: 15, color: '#978e82', kind: 'warehouse', sign: 'EAST PIER' },
  { x: -93, z: -96, w: 36, d: 18, h: 24, color: '#827d7d', kind: 'stone' },
  { x: -31, z: -97, w: 28, d: 19, h: 14, color: '#827770', kind: 'warehouse', sign: 'RAIL DISTRICT' },
  { x: 94, z: -98, w: 31, d: 19, h: 28, color: '#8b9eaa', kind: 'glass' },
]

export const CORE_BUILDINGS = coreBuildings.map(b => {
  const block = BLOCKS.find(p => Math.abs(p.x - b.x) < p.w / 2 && Math.abs(p.z - b.z) < p.d / 2)
  if (!block) throw new Error(`Building at ${b.x}, ${b.z} must belong to a city block`)
  return fitBuildingToBlock(b, block)
})

export const WALK_ROUTES = [
  [[-65.6, 28], [-10, 28], [-10, -1], [-65.6, -1]],
  [[10, 55], [36, 55], [42, 82], [11, 87]],
  [[-11.3, 54.9], [-15.5, 53.65], [-65.8, 53.65], [-65.8, 84], [-17, 89], [-11.3, 82]],
  [[66, 28], [10, 28], [10, -1], [66, -1]],
  [[9.25, -58.8], [66, -58.8], [66, -22.8], [9.25, -22.8]],
] as const

const facadeStyles = [
  { color: '#9b6458', kind: 'brick' },
  { color: '#a98970', kind: 'stone' },
  { color: '#849ba0', kind: 'glass' },
  { color: '#766773', kind: 'warehouse' },
  { color: '#976f68', kind: 'brick' },
  { color: '#7195a5', kind: 'glass' },
] as const

export const DISTRICT_BUILDINGS: Building[] = BLOCKS.flatMap((block, index) => {
  if (Math.abs(block.x) < 150 && block.z > -121) return []
  if (PLAZAS.some((plaza) => Math.abs(plaza.x - block.x) < 12 && Math.abs(plaza.z - block.z) < 12)) return []
  const styles = block.x < -78 ? [0, 3, 1, 4] : block.x > 79 ? [1, 0, 4, 2] : [2, 5, 1, 2]
  return [-1, 1].map((side, portion) => {
    const seed = (index * 37 + portion * 11) % 19
    const style = facadeStyles[styles[(index + portion) % styles.length]]
    const height = style.kind === 'glass' ? 24 + seed * 1.65 : 8.5 + seed * 0.72
    const depth = block.d * (0.61 + seed % 4 * 0.035)
    const z = block.z + (seed % 3 - 1) * Math.min(3, block.d * 0.09)
    return fitBuildingToBlock({
      x: block.x + side * (block.w * 0.23), z,
      w: block.w * (0.34 + seed % 3 * 0.016), d: depth, h: height,
      ...style,
    }, block)
  })
})

export const BUILDINGS = [...CORE_BUILDINGS, ...DISTRICT_BUILDINGS]

export const DISTRICT_WALKS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [...BLOCKS.filter((block, index) =>
  (index % 2 === 1 && block.z < -136) || (Math.abs(block.x) > 165 && index % 3 === 2),
).map(({ x, z, w, d }) => [
  [x - w / 2 + 2.2, z - d / 2 + 2.2], [x + w / 2 - 2.2, z - d / 2 + 2.2],
  [x + w / 2 - 2.2, z + d / 2 - 2.2], [x - w / 2 + 2.2, z + d / 2 - 2.2],
] as const),
  [[-91, 94], [-51, 94], [-32, 94], [-32, 125], [-26, 125], [-26, 95.5], [-91, 95.5]],
  [[-4, 93.8], [38, 93.8], [38, 124], [46, 124], [46, 95.7], [-4, 95.7]],
  [[128.5, 94], [130, 132], [138.7, 132], [139.3, 95.8], [180, 95.8], [180, 93.6]],
]

export function districtName(x: number, z: number) {
  if (z >= 38 && x > 95) return 'East Bayfront'
  if (z >= 38) return 'Harbourfront'
  if (x < -78 && z > -136) return 'West Rail Yards'
  if (x > 70 && z < -35) return 'St. Lawrence'
  if (z < -96) return 'Entertainment District'
  return z < -20 ? 'Rail District' : 'Harbourfront'
}

function streetAt(x: number, z: number, padding = 0) {
  const horizontal = EAST_WEST.find(street => Math.abs(z - street.z) <= street.width / 2 + padding)
  const vertical = NORTH_SOUTH.find(street => Math.abs(x - street.x) <= street.width / 2 + padding)
  if (!horizontal) return vertical?.name
  if (!vertical) return horizontal.name
  return Math.abs(z - horizontal.z) / horizontal.width <= Math.abs(x - vertical.x) / vertical.width
    ? horizontal.name : vertical.name
}

export function streetLabel(name: string) {
  return name.replace('Boulevard', 'Blvd').replace('Avenue', 'Ave').replace('Street', 'St')
}

export function locationName(x: number, z: number) {
  if (z >= BOARDWALK.south) return PIERS.find(pier => z <= pier.end && Math.abs(x - pier.x) <= pier.width / 2)?.name ?? 'Lake Ontario'
  if (z >= BOARDWALK.north) return 'Waterfront Boardwalk'
  const street = streetAt(x, z)
  if (street) return street
  if (z >= 83) return 'Waterfront Promenade'
  if (Math.hypot(x - CN_TOWER.x, z - CN_TOWER.z) < 15) return 'CN Tower'
  if (Math.hypot((x - ROGERS_CENTRE.x) / 30, (z - ROGERS_CENTRE.z) / 21) < 1.2) return 'Rogers Centre'
  if (Math.abs(x - UNION_STATION.x) < 27 && Math.abs(z - UNION_STATION.z) < 19) return 'Union Station'
  return streetAt(x, z, 4) ?? districtName(x, z)
}
