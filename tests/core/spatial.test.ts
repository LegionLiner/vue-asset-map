import { describe, expect, it } from 'vitest'
import { intersects, SpatialIndex, unionRect } from '../../src/core/spatial'

const box = (x: number, y: number, width = 10, height = 10) => ({ x, y, width, height })

describe('SpatialIndex', () => {
  it('находит только то, что пересекает область', () => {
    const index = new SpatialIndex({ cellSize: 100 })
    index.set('a', box(0, 0))
    index.set('b', box(500, 500))
    index.set('c', box(95, 95))

    expect(index.search(box(0, 0, 100, 100)).sort()).toEqual(['a', 'c'])
    expect(index.search(box(490, 490, 30, 30))).toEqual(['b'])
    expect(index.search(box(2000, 2000, 10, 10))).toEqual([])
  })

  it('элемент на стыке ячеек находится один раз', () => {
    const index = new SpatialIndex({ cellSize: 100 })
    index.set('wide', box(50, 50, 200, 200))

    expect(index.search(box(0, 0, 400, 400))).toEqual(['wide'])
  })

  it('перемещение переносит элемент: старое место пустеет', () => {
    const index = new SpatialIndex({ cellSize: 100 })
    index.set('a', box(0, 0))
    index.set('a', box(1000, 1000))

    expect(index.search(box(0, 0, 50, 50))).toEqual([])
    expect(index.search(box(990, 990, 50, 50))).toEqual(['a'])
    expect(index.size).toBe(1)
  })

  it('удаление убирает элемент отовсюду', () => {
    const index = new SpatialIndex({ cellSize: 100 })
    index.set('a', box(0, 0, 300, 300))

    expect(index.delete('a')).toBe(true)
    expect(index.delete('a')).toBe(false)
    expect(index.search(box(0, 0, 400, 400))).toEqual([])
    expect(index.has('a')).toBe(false)
  })

  it('огромный элемент хранится отдельно и всё равно находится', () => {
    // Связь через всю карту не должна записываться в тысячи ячеек.
    const index = new SpatialIndex({ cellSize: 10, maxCellsPerItem: 4 })
    index.set('long', box(0, 0, 10_000, 10))

    expect(index.search(box(5000, 0, 10, 10))).toEqual(['long'])
    expect(index.search(box(5000, 500, 10, 10))).toEqual([])
    index.set('long', box(0, 500, 10, 10))
    expect(index.search(box(5000, 0, 10, 10))).toEqual([])
  })

  it('отрицательные координаты работают так же', () => {
    const index = new SpatialIndex({ cellSize: 100 })
    index.set('a', box(-250, -250))

    expect(index.search(box(-300, -300, 100, 100))).toEqual(['a'])
    expect(index.search(box(0, 0, 100, 100))).toEqual([])
  })

  it('запрос шире занятых ячеек сводится к перебору и даёт тот же ответ', () => {
    const index = new SpatialIndex({ cellSize: 10 })
    for (let i = 0; i < 20; i += 1) index.set(`n${i}`, box(i * 30, 0))

    expect(index.search(box(-1e6, -1e6, 2e6, 2e6))).toHaveLength(20)
    expect(index.search(box(0, 0, 65, 10)).sort()).toEqual(['n0', 'n1', 'n2'])
  })

  it('hitTest выбирает элемент, чей центр ближе к точке', () => {
    const index = new SpatialIndex({ cellSize: 100 })
    index.set('left', box(0, 0, 20, 20))
    index.set('right', box(15, 0, 20, 20))

    expect(index.hitTest({ x: 5, y: 10 })).toBe('left')
    expect(index.hitTest({ x: 30, y: 10 })).toBe('right')
    expect(index.hitTest({ x: 300, y: 300 })).toBeUndefined()
    expect(index.hitTest({ x: 40, y: 10 }, 6)).toBe('right')
  })

  it('bounds охватывает всё, а у пустого индекса их нет', () => {
    const index = new SpatialIndex()
    expect(index.bounds()).toBeUndefined()

    index.set('a', box(-10, 20, 10, 10))
    index.set('b', box(100, -5, 50, 5))
    expect(index.bounds()).toEqual({ x: -10, y: -5, width: 160, height: 35 })

    index.clear()
    expect(index.size).toBe(0)
    expect(index.bounds()).toBeUndefined()
  })

  it('повторная запись того же прямоугольника ничего не меняет', () => {
    const index = new SpatialIndex({ cellSize: 100 })
    index.set('a', box(0, 0))
    index.set('a', box(0, 0))
    expect(index.get('a')).toEqual(box(0, 0))
    expect([...index.ids()]).toEqual(['a'])
  })

  it('на 100 тысячах элементов запрос окна укладывается в миллисекунды', () => {
    const index = new SpatialIndex()
    const side = 317
    for (let i = 0; i < 100_000; i += 1) {
      index.set(`n${i}`, box((i % side) * 180, Math.floor(i / side) * 140, 128, 90))
    }

    const started = performance.now()
    const found = index.search(box(10_000, 10_000, 1920, 1080))
    const elapsed = performance.now() - started

    expect(found.length).toBeGreaterThan(50)
    expect(found.length).toBeLessThan(200)
    expect(elapsed).toBeLessThan(20)
  })
})

describe('геометрия прямоугольников', () => {
  it('касание краями считается пересечением', () => {
    expect(intersects(box(0, 0), box(10, 10))).toBe(true)
    expect(intersects(box(0, 0), box(11, 0))).toBe(false)
  })

  it('unionRect покрывает оба', () => {
    expect(unionRect(box(0, 0), box(100, 50))).toEqual({ x: 0, y: 0, width: 110, height: 60 })
  })
})
