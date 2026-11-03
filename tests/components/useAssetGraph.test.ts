import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useAssetGraph } from '../../src/composables/useAssetGraph'
import { buildGraph } from '../../src/core/graph'
import type { AssetEntity } from '../../src/types/entity'
import type { AssetLink } from '../../src/types/link'

const e = (id: string, extra: Partial<AssetEntity> = {}): AssetEntity => ({
  id,
  type: 'host',
  label: id,
  ...extra,
})
const l = (id: string, source: string, target: string, extra: Partial<AssetLink> = {}): AssetLink => ({
  id,
  source,
  target,
  layers: ['physical'],
  ...extra,
})

function setup() {
  const entities = ref<AssetEntity[]>([e('a'), e('b', { parentId: 'a' }), e('c', { parentId: 'a' })])
  const links = ref<AssetLink[]>([l('ab', 'a', 'b'), l('bc', 'b', 'c'), l('dangling', 'a', 'zzz')])
  return { entities, links, ...useAssetGraph(entities, links) }
}

describe('useAssetGraph: пересборка только при смене структуры', () => {
  it('новые объекты с теми же id и родителями — индексы связности те же', () => {
    const { entities, graph } = setup()
    const before = graph.value

    entities.value = entities.value.map((entity) => ({ ...entity, label: `${entity.label}!` }))
    const after = graph.value

    expect(after).not.toBe(before)
    expect(after.adjacency).toBe(before.adjacency)
    expect(after.childrenOf).toBe(before.childrenOf)
    expect(after.parentOf).toBe(before.parentOf)
    expect(after.entities.get('a')?.label).toBe('a!')
  })

  it('сменившийся родитель — полная пересборка', () => {
    const { entities, graph } = setup()
    const before = graph.value

    entities.value = entities.value.map((entity) =>
      entity.id === 'c' ? { ...entity, parentId: 'b' } : entity,
    )

    expect(graph.value.parentOf).not.toBe(before.parentOf)
    expect(graph.value.childrenOf.get('b')).toEqual(['c'])
  })

  it('связи с прежними концами переиспользуют индексы и отбрасывают те же битые', () => {
    const { links, graph, issues } = setup()
    const before = graph.value

    links.value = links.value.map((link) => ({ ...link, label: 'x' }))

    expect(graph.value.adjacency).toBe(before.adjacency)
    expect(graph.value.links.has('dangling')).toBe(false)
    expect(graph.value.links.get('ab')?.label).toBe('x')
    expect(issues.value.map((issue) => issue.code)).toEqual(['dangling-link'])
  })

  it('переадресованная связь — полная пересборка', () => {
    const { links, graph } = setup()
    const before = graph.value

    links.value = [l('ab', 'a', 'c'), l('bc', 'b', 'c'), l('dangling', 'a', 'zzz')]

    expect(graph.value.adjacency).not.toBe(before.adjacency)
    expect(graph.value.adjacency.get('b')).toEqual(['bc'])
  })

  it('результат тот же, что у полной сборки', () => {
    const { entities, links, graph } = setup()
    entities.value = entities.value.map((entity) => ({ ...entity, status: 'offline' }))

    const fresh = buildGraph(entities.value, links.value)
    expect([...graph.value.entities.values()]).toEqual([...fresh.entities.values()])
    expect([...graph.value.links.keys()]).toEqual([...fresh.links.keys()])
    expect(graph.value.roots).toEqual(fresh.roots)
  })
})

describe('useAssetGraph: updateEntity', () => {
  it('заменяет одну запись, не трогая индексы', () => {
    const { graph, updateEntity } = setup()
    const before = graph.value

    expect(updateEntity(e('b', { parentId: 'a', label: 'B2' }))).toBe(true)

    expect(graph.value.entities.get('b')?.label).toBe('B2')
    expect(graph.value.adjacency).toBe(before.adjacency)
  })

  it('правки копятся, пока массив прежний', () => {
    const { graph, updateEntity } = setup()
    updateEntity(e('b', { parentId: 'a', label: 'B2' }))
    updateEntity(e('c', { parentId: 'a', label: 'C2' }))

    expect(graph.value.entities.get('b')?.label).toBe('B2')
    expect(graph.value.entities.get('c')?.label).toBe('C2')
  })

  it('новый массив сущностей отменяет правки, новый массив связей — нет', () => {
    const { entities, links, graph, updateEntity } = setup()
    updateEntity(e('b', { parentId: 'a', label: 'B2' }))

    links.value = [...links.value]
    expect(graph.value.entities.get('b')?.label).toBe('B2')

    entities.value = [...entities.value]
    expect(graph.value.entities.get('b')?.label).toBe('b')
  })

  it('отказывает неизвестной записи и смене родителя', () => {
    const { graph, updateEntity } = setup()
    expect(updateEntity(e('nope'))).toBe(false)
    expect(updateEntity(e('c', { parentId: 'b' }))).toBe(false)
    expect(updateEntity(graph.value.entities.get('a') as AssetEntity)).toBe(true)
  })
})
