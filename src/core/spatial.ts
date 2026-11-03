import type { XY } from '../types/entity'

/** Axis-aligned rectangle in canvas px; `x`/`y` is the top-left corner. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Options of {@link SpatialIndex}. */
export interface SpatialIndexOptions {
  /**
   * Edge of one grid cell, in canvas px.
   *
   * @default 512
   */
  cellSize?: number
  /**
   * An item covering more cells than this is kept in a short list checked on
   * every query instead of being written into each cell — a link spanning the
   * whole map would otherwise touch thousands of them.
   *
   * @default 256
   */
  maxCellsPerItem?: number
}

const DEFAULT_CELL_SIZE = 512
const DEFAULT_MAX_CELLS = 256

/**
 * Cell coordinates are packed into one number: `(cx + OFFSET) * SPAN + (cy + OFFSET)`.
 * With 2^20 cells either side of the origin and the default cell size that is
 * ±5·10^8 px — far past anything a map lays out — and the product stays under
 * 2^53, so the key is exact.
 */
const OFFSET = 2 ** 20
const SPAN = 2 ** 21

function clampCell(value: number): number {
  return Math.max(-OFFSET, Math.min(OFFSET - 1, value))
}

/** Whether two rectangles overlap; touching edges count. */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height
}

/** Smallest rectangle covering both. */
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

/**
 * A uniform grid over canvas space: which items fall inside a rectangle,
 * without looking at all of them.
 *
 * Node sizes are known before anything is rendered, so the map can answer "what
 * is on screen" itself instead of mounting everything and asking the DOM. A grid
 * rather than an R-tree: items move one at a time when dragged, and a grid
 * updates in place where a packed tree would have to be rebuilt.
 *
 * Mutable on purpose — this is the one structure that changes per node. Callers
 * that need reactivity bump a version of their own after writing to it.
 */
export class SpatialIndex {
  private readonly cellSize: number
  private readonly maxCells: number
  private readonly cells = new Map<number, Set<string>>()
  private readonly rects = new Map<string, Rect>()
  private readonly keysOf = new Map<string, number[]>()
  /** Items too large for the grid, checked on every query. */
  private readonly oversized = new Set<string>()

  constructor(options: SpatialIndexOptions = {}) {
    this.cellSize = Math.max(1, options.cellSize ?? DEFAULT_CELL_SIZE)
    this.maxCells = Math.max(1, options.maxCellsPerItem ?? DEFAULT_MAX_CELLS)
  }

  get size(): number {
    return this.rects.size
  }

  has(id: string): boolean {
    return this.rects.has(id)
  }

  get(id: string): Rect | undefined {
    return this.rects.get(id)
  }

  ids(): IterableIterator<string> {
    return this.rects.keys()
  }

  /** Inserts an item, or moves it when it is already indexed. */
  set(id: string, rect: Rect): void {
    const previous = this.rects.get(id)
    if (previous && sameRect(previous, rect)) return
    if (previous) this.unlink(id)

    const stored = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    this.rects.set(id, stored)

    const span = this.cellSpan(stored)
    const count = (span.x1 - span.x0 + 1) * (span.y1 - span.y0 + 1)
    if (count > this.maxCells) {
      this.oversized.add(id)
      return
    }

    const keys: number[] = []
    for (let cx = span.x0; cx <= span.x1; cx += 1) {
      for (let cy = span.y0; cy <= span.y1; cy += 1) {
        const key = (cx + OFFSET) * SPAN + (cy + OFFSET)
        const cell = this.cells.get(key)
        if (cell) cell.add(id)
        else this.cells.set(key, new Set([id]))
        keys.push(key)
      }
    }
    this.keysOf.set(id, keys)
  }

  delete(id: string): boolean {
    if (!this.rects.has(id)) return false
    this.unlink(id)
    this.rects.delete(id)
    return true
  }

  clear(): void {
    this.cells.clear()
    this.rects.clear()
    this.keysOf.clear()
    this.oversized.clear()
  }

  /**
   * Ids of every item overlapping `area`, in no particular order.
   *
   * When the area covers more cells than there are occupied ones — a zoomed-out
   * viewport over a sparse map — the occupied cells are walked instead, so a
   * query never costs more than a scan.
   */
  search(area: Rect): string[] {
    const found = new Set<string>()
    const span = this.cellSpan(area)
    const count = (span.x1 - span.x0 + 1) * (span.y1 - span.y0 + 1)

    if (count > this.cells.size) {
      for (const [id, rect] of this.rects) {
        if (intersects(rect, area)) found.add(id)
      }
      return [...found]
    }

    for (let cx = span.x0; cx <= span.x1; cx += 1) {
      for (let cy = span.y0; cy <= span.y1; cy += 1) {
        const cell = this.cells.get((cx + OFFSET) * SPAN + (cy + OFFSET))
        if (!cell) continue
        for (const id of cell) {
          if (found.has(id)) continue
          const rect = this.rects.get(id)
          if (rect && intersects(rect, area)) found.add(id)
        }
      }
    }

    for (const id of this.oversized) {
      const rect = this.rects.get(id)
      if (rect && intersects(rect, area)) found.add(id)
    }

    return [...found]
  }

  /**
   * The item under a point, or `undefined`.
   *
   * With several overlapping, the one whose centre is nearest wins: at a zoom
   * where items are a few pixels across, that is the one the pointer was aimed at.
   */
  hitTest(point: XY, tolerance = 0): string | undefined {
    const hits = this.search({
      x: point.x - tolerance,
      y: point.y - tolerance,
      width: tolerance * 2,
      height: tolerance * 2,
    })

    let best: string | undefined
    let bestDistance = Number.POSITIVE_INFINITY
    for (const id of hits) {
      const rect = this.rects.get(id)
      if (!rect) continue
      const distance = Math.hypot(rect.x + rect.width / 2 - point.x, rect.y + rect.height / 2 - point.y)
      if (distance < bestDistance) {
        best = id
        bestDistance = distance
      }
    }
    return best
  }

  /** Smallest rectangle covering every item, or `undefined` when empty. */
  bounds(): Rect | undefined {
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY

    for (const rect of this.rects.values()) {
      minX = Math.min(minX, rect.x)
      minY = Math.min(minY, rect.y)
      maxX = Math.max(maxX, rect.x + rect.width)
      maxY = Math.max(maxY, rect.y + rect.height)
    }

    if (minX === Number.POSITIVE_INFINITY) return undefined
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  private unlink(id: string): void {
    if (this.oversized.delete(id)) return
    for (const key of this.keysOf.get(id) ?? []) {
      const cell = this.cells.get(key)
      if (!cell) continue
      cell.delete(id)
      if (cell.size === 0) this.cells.delete(key)
    }
    this.keysOf.delete(id)
  }

  private cellSpan(rect: Rect): { x0: number; y0: number; x1: number; y1: number } {
    const size = this.cellSize
    return {
      x0: clampCell(Math.floor(rect.x / size)),
      y0: clampCell(Math.floor(rect.y / size)),
      x1: clampCell(Math.floor((rect.x + Math.max(0, rect.width)) / size)),
      y1: clampCell(Math.floor((rect.y + Math.max(0, rect.height)) / size)),
    }
  }
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
