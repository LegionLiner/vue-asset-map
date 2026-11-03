// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import { VueFlow, type Node } from '@vue-flow/core'
import AssetMap from '../../src/components/AssetMap.vue'
import { dagreLayout } from '../../src/layout/dagre'
import { groupIdFor, pageIdFor } from '../../src/core/collapse'
import { buildGraph } from '../../src/core/graph'
import { useCollapse } from '../../src/composables/useCollapse'
import type { AssetEntity, XY } from '../../src/types/entity'
import type { AssetMapExposed } from '../../src/types/props'
import { entities, generateLargeGraph, links, statusColors, views } from '../../fixtures/infra'

// Монтаж в jsdom медленный, а файлы идут параллельно: запас по времени, чтобы
// тест падал от поведения, а не от загрузки машины.
vi.setConfig({ testTimeout: 30_000 })

const big = generateLargeGraph(1000, 400)

async function settle() {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

async function mountMap(props: Record<string, unknown> = {}) {
  const wrapper = mount(AssetMap, {
    props: {
      entities: big.entities,
      links: big.links,
      collapse: false,
      themeConfig: { statusColors },
      searchDebounce: 0,
      ...props,
    },
    attachTo: document.body,
  })
  await settle()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountMap>>

const flowNodes = (wrapper: Wrapper): Node[] =>
  (wrapper.findComponent(VueFlow).props('nodes') ?? []) as Node[]
const flowEdges = (wrapper: Wrapper) => wrapper.findComponent(VueFlow).props('edges') ?? []
const api = (wrapper: Wrapper) => wrapper.vm as unknown as AssetMapExposed

async function setViewport(wrapper: Wrapper, viewport: { x: number; y: number; zoom: number }) {
  await wrapper.setProps({ viewport })
  await settle()
}

describe('отсечение по области видимости', () => {
  it('большая карта отдаёт VueFlow только узлы у экрана, а не все', async () => {
    const wrapper = await mountMap()

    const count = flowNodes(wrapper).length
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(big.entities.length / 2)
    wrapper.unmount()
  })

  it('встроенное отсечение VueFlow при этом выключено', async () => {
    const wrapper = await mountMap({ onlyRenderVisibleElements: true })
    expect(wrapper.findComponent(VueFlow).props('onlyRenderVisibleElements')).toBe(false)
    wrapper.unmount()
  })

  it('каждое переданное ребро имеет оба своих узла: VueFlow не может рисовать в пустоту', async () => {
    const wrapper = await mountMap()

    const ids = new Set(flowNodes(wrapper).map((node) => node.id))
    for (const edge of flowEdges(wrapper)) {
      expect(ids.has(edge.source) && ids.has(edge.target)).toBe(true)
    }
    wrapper.unmount()
  })

  it('сдвиг вида меняет набор узлов', async () => {
    const wrapper = await mountMap()
    const before = new Set(flowNodes(wrapper).map((node) => node.id))

    const far = api(wrapper).getPositions()['n-999'] as XY
    await setViewport(wrapper, { x: -far.x + 100, y: -far.y + 100, zoom: 1 })

    const after = flowNodes(wrapper).map((node) => node.id)
    expect(after).toContain('n-999')
    expect(after.some((id) => !before.has(id))).toBe(true)
    wrapper.unmount()
  })

  it('мелкий сдвиг внутри запаса не пересобирает массив узлов', async () => {
    const wrapper = await mountMap()
    const before = flowNodes(wrapper)

    await setViewport(wrapper, { x: -3, y: -2, zoom: 1 })

    expect(flowNodes(wrapper)).toBe(before)
    wrapper.unmount()
  })

  it('virtualize: false отдаёт всё, как раньше', async () => {
    const wrapper = await mountMap({ virtualize: false })
    expect(flowNodes(wrapper)).toHaveLength(big.entities.length)
    wrapper.unmount()
  })

  it('маленькая карта ниже порога не меняется вовсе', async () => {
    const wrapper = mount(AssetMap, {
      props: { entities, links, views, view: 'physical', searchDebounce: 0 },
      attachTo: document.body,
    })
    await settle()

    const vueFlow = wrapper.findComponent(VueFlow)
    expect(vueFlow.props('onlyRenderVisibleElements')).toBe(true)
    expect((vueFlow.props('nodes') ?? []).length).toBeGreaterThan(0)
    expect((vueFlow.props('nodes') ?? []).every((node: Node) => 'hidden' in node)).toBe(true)
    wrapper.unmount()
  })

  it('скрытые фильтром узлы не передаются вовсе, а не помечаются hidden', async () => {
    const wrapper = await mountMap({ filters: { query: 'node-1', types: [], statuses: [] } })

    const nodes = flowNodes(wrapper)
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes.every((node) => node.hidden !== true)).toBe(true)
    wrapper.unmount()
  })

  it('перетаскивание обновляет узел, не перезапуская раскладку', async () => {
    const wrapper = await mountMap()
    const starts = wrapper.emitted('layout-start')?.length ?? 0
    const id = flowNodes(wrapper)[0]?.id ?? ''

    wrapper.findComponent(VueFlow).vm.$emit('node-drag-stop', { nodes: [{ id, position: { x: 33, y: 44 } }] })
    await settle()

    expect(flowNodes(wrapper).find((node) => node.id === id)?.position).toEqual({ x: 33, y: 44 })
    expect(wrapper.emitted('layout-start')?.length ?? 0).toBe(starts)
    wrapper.unmount()
  })

  it('узел, утащенный за экран, уходит из набора', async () => {
    const wrapper = await mountMap()
    const id = flowNodes(wrapper)[0]?.id ?? ''

    wrapper.findComponent(VueFlow).vm.$emit('node-drag-stop', {
      nodes: [{ id, position: { x: 900_000, y: 900_000 } }],
    })
    await settle()

    expect(flowNodes(wrapper).some((node) => node.id === id)).toBe(false)
    wrapper.unmount()
  })
})

describe('точечные изменения не перекладывают карту', () => {
  it('новый массив с теми же id и родителями — без новой раскладки', async () => {
    const wrapper = await mountMap()
    const starts = wrapper.emitted('layout-start')?.length ?? 0
    const id = flowNodes(wrapper)[0]?.id ?? ''

    const renamed = big.entities.map((entity) =>
      entity.id === id ? { ...entity, label: 'renamed' } : { ...entity },
    )
    await wrapper.setProps({ entities: renamed })
    await settle()

    const node = flowNodes(wrapper).find((candidate) => candidate.id === id)
    expect((node?.data as { entity: AssetEntity }).entity.label).toBe('renamed')
    expect(wrapper.emitted('layout-start')?.length ?? 0).toBe(starts)
    wrapper.unmount()
  })

  it('добавленная сущность — структурное изменение, и раскладка запускается', async () => {
    const wrapper = await mountMap()
    const starts = wrapper.emitted('layout-start')?.length ?? 0

    await wrapper.setProps({ entities: [...big.entities, { id: 'extra', type: 'vps', label: 'Extra' }] })
    await settle()

    expect(wrapper.emitted('layout-start')?.length ?? 0).toBe(starts + 1)
    wrapper.unmount()
  })

  it('updateEntity меняет запись без нового массива и без раскладки', async () => {
    const wrapper = await mountMap()
    const starts = wrapper.emitted('layout-start')?.length ?? 0
    const id = flowNodes(wrapper)[0]?.id ?? ''
    const original = big.entities.find((entity) => entity.id === id) as AssetEntity

    expect(api(wrapper).updateEntity({ ...original, status: 'offline', label: 'patched' })).toBe(true)
    await settle()

    const node = flowNodes(wrapper).find((candidate) => candidate.id === id)
    expect((node?.data as { entity: AssetEntity }).entity.label).toBe('patched')
    expect(api(wrapper).getGraph().entities.get(id)?.label).toBe('patched')
    expect(wrapper.emitted('layout-start')?.length ?? 0).toBe(starts)
    wrapper.unmount()
  })

  it('updateEntity отказывает неизвестной сущности и смене родителя', async () => {
    const wrapper = await mountMap()
    const child = big.entities.find((entity) => entity.parentId) as AssetEntity

    expect(api(wrapper).updateEntity({ id: 'nope', type: 'vps', label: 'x' })).toBe(false)
    expect(api(wrapper).updateEntity({ ...child, parentId: null })).toBe(false)
    wrapper.unmount()
  })

  it('правка через updateEntity уступает новому массиву', async () => {
    const wrapper = await mountMap()
    const original = big.entities[5] as AssetEntity

    api(wrapper).updateEntity({ ...original, label: 'patched' })
    await settle()
    await wrapper.setProps({ entities: big.entities.map((entity) => ({ ...entity })) })
    await settle()

    expect(api(wrapper).getGraph().entities.get(original.id)?.label).toBe(original.label)
    wrapper.unmount()
  })
})

describe('canvas на мелком масштабе', () => {
  const calls = { arc: 0, lineTo: 0 }

  beforeEach(() => {
    calls.arc = 0
    calls.lineTo = 0
    const context = {
      setTransform: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {
        calls.lineTo += 1
      },
      arc: () => {
        calls.arc += 1
      },
      stroke: () => {},
      fill: () => {},
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    )
  })

  afterEach(() => vi.restoreAllMocks())

  async function zoomedOut() {
    const wrapper = await mountMap({ viewport: { x: 0, y: 0, zoom: 0.2 } })
    await new Promise((resolve) => setTimeout(resolve, 40))
    return wrapper
  }

  it('ниже порога узлы не монтируются, а рисуются точками', async () => {
    const wrapper = await zoomedOut()

    expect(flowNodes(wrapper)).toHaveLength(0)
    expect(wrapper.find('.vam-lod-canvas').exists()).toBe(true)
    expect(calls.arc).toBeGreaterThan(0)
    expect(calls.lineTo).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('lodCanvas: false оставляет упрощённые узлы', async () => {
    const wrapper = await mountMap({ viewport: { x: 0, y: 0, zoom: 0.2 }, lodCanvas: false })

    expect(flowNodes(wrapper).length).toBeGreaterThan(0)
    expect(wrapper.find('.vam-lod-canvas').exists()).toBe(false)
    wrapper.unmount()
  })

  it('клик по точке выбирает узел, клик мимо — снимает выбор', async () => {
    const wrapper = await zoomedOut()
    const position = api(wrapper).getPositions()['n-0'] as XY
    const zoom = 0.2

    const onPoint = new MouseEvent('click', {
      clientX: (position.x + 64) * zoom,
      clientY: (position.y + 30) * zoom,
    })
    wrapper.findComponent(VueFlow).vm.$emit('pane-click', onPoint)
    await settle()
    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual(['n-0'])

    const empty = new MouseEvent('click', { clientX: -5000, clientY: -5000 })
    wrapper.findComponent(VueFlow).vm.$emit('pane-click', empty)
    await settle()
    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual([])
    wrapper.unmount()
  })
})

describe('раскрытие порциями в карте', () => {
  it('узел «ещё» подписан как остаток группы', async () => {
    const parent = { id: 'parent', type: 'hypervisor', label: 'Parent' }
    const children = Array.from({ length: 14 }, (_, index) => ({
      id: `c${index}`,
      type: 'container',
      label: `c${index}`,
      parentId: 'parent',
    }))
    const groupId = groupIdFor('parent', 'container')

    const wrapper = mount(AssetMap, {
      props: {
        entities: [parent, ...children],
        links: [],
        collapse: { pageSize: 5 },
        expanded: new Set([groupId]),
        searchDebounce: 0,
        onlyRenderVisibleElements: false,
      },
      attachTo: document.body,
    })
    await settle()

    const more = wrapper.find('.vam-group--more')
    expect(more.exists()).toBe(true)
    expect(more.text()).toContain('ещё 9')
    wrapper.unmount()
  })

  it('клик по группе, затем по «ещё» открывает следующую порцию', async () => {
    const parent = { id: 'parent', type: 'hypervisor', label: 'Parent' }
    const children = Array.from({ length: 14 }, (_, index) => ({
      id: `c${index}`,
      type: 'container',
      label: `c${index}`,
      parentId: 'parent',
    }))
    const groupId = groupIdFor('parent', 'container')

    const wrapper = mount(AssetMap, {
      props: { entities: [parent, ...children], links: [], collapse: { pageSize: 5 }, searchDebounce: 0 },
      attachTo: document.body,
    })
    await settle()

    await wrapper.find('.vam-group').trigger('click')
    await settle()
    expect(wrapper.find('.vam-group--more').text()).toContain('ещё 9')

    await wrapper.find('.vam-group--more').trigger('click')
    await settle()
    const expanded = wrapper.emitted('update:expanded')?.at(-1)?.[0] as Set<string>
    expect([...expanded].sort()).toEqual([groupId, pageIdFor(groupId, 5)].sort())
    expect(wrapper.find('.vam-group--more').text()).toContain('ещё 4')
    wrapper.unmount()
  })

  it('сворачивание группы забывает и её открытые порции', () => {
    const groupId = groupIdFor('parent', 'container')
    const other = groupIdFor('other', 'host')
    const expanded = ref(new Set([groupId, pageIdFor(groupId, 5), pageIdFor(groupId, 10), other]))
    const graph = computed(() => buildGraph([], []))
    const empty = computed(() => new Set<string>())

    const state = useCollapse(
      graph,
      empty,
      computed(() => ({ entityIds: new Set<string>(), linkIds: new Set<string>() })),
      ref(undefined),
      expanded,
    )
    state.collapse(groupId)

    expect([...expanded.value]).toEqual([other])
  })
})

describe('отказ движка по размеру', () => {
  it('dagre выше предела сообщает ошибку и карта раскладывается сеткой', async () => {
    const wrapper = mount(AssetMap, {
      props: {
        entities,
        links,
        views,
        view: 'physical',
        layout: { engine: dagreLayout, options: { maxNodes: 2 } },
        searchDebounce: 0,
      },
      attachTo: document.body,
    })
    await settle()

    const error = wrapper.emitted('error')?.[0]?.[0] as Error | undefined
    expect(error?.name).toBe('LayoutLimitError')
    expect(wrapper.emitted('layout-done')?.at(-1)?.[0]).toMatchObject({ engine: 'manual' })
    expect(Object.keys(api(wrapper).getPositions()).length).toBeGreaterThan(2)
    wrapper.unmount()
  })
})
