// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { VueFlow } from '@vue-flow/core'
import { describe, expect, it, vi } from 'vitest'
import AssetMap from '../../src/components/AssetMap.vue'
import LodCanvas from '../../src/components/LodCanvas.vue'
import { groupIdFor, pageIdFor } from '../../src/core/collapse'
import { buildGraph, findShortestPath } from '../../src/core'
import type { AssetMapExposed, AssetMapProps } from '../../src/types/props'
import type { AssetEntity } from '../../src/types/entity'
import type { AssetLink } from '../../src/types/link'

const nodes: AssetEntity[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, type: 'host', label: id }))
const cable = (id: string, source: string, target: string, type = 'fiber'): AssetLink => ({
  id,
  source,
  target,
  type,
  layers: ['physical'],
})
const links = [
  cable('ab', 'a', 'b'),
  cable('bc', 'b', 'c'),
  cable('cd', 'c', 'd'),
  cable('ad', 'a', 'd'),
  cable('da', 'd', 'a', 'wifi'),
]

async function mountMap(props: Partial<AssetMapProps> & { selection?: string[] } = {}) {
  const wrapper = mount(AssetMap, {
    props: { entities: nodes, links, onlyRenderVisibleElements: false, searchDebounce: 0, ...props },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, api: wrapper.vm as unknown as AssetMapExposed, flow: wrapper.findComponent(VueFlow) }
}

describe('exploring the projected graph', () => {
  it('chooses the shortest eligible original edge and distinguishes a cut frontier from exhaustion', () => {
    const graph = buildGraph(nodes, links)
    expect(findShortestPath(graph, 'a', 'd')).toEqual({
      status: 'found',
      nodeIds: ['a', 'd'],
      linkIds: ['ad'],
    })
    expect(findShortestPath(graph, 'a', 'd', { linkIds: new Set(['da']) }).linkIds).toEqual(['da'])
    expect(findShortestPath(graph, 'a', 'c', { maxDepth: 1 }).status).toBe('depth-limit')
    expect(findShortestPath(graph, 'a', 'e', { maxDepth: 2 }).status).toBe('unreachable')
    expect(findShortestPath(graph, 'a', 'a', { maxDepth: 0 }).nodeIds).toEqual(['a'])
  })

  it('intersects link and view predicates, showing only incident links without running layout', async () => {
    const { wrapper, flow, api } = await mountMap({
      links: [...links, { ...cable('overlay', 'a', 'e'), layers: ['logical'] }, cable('bd', 'b', 'd')],
      views: [{ id: 'physical', label: 'Physical' }],
      selectionLinkMode: 'neighborhood',
      previewNeighborsOnHover: true,
      linkFilter: (edge) => edge.type === 'fiber',
    })
    const runs = wrapper.emitted('layout-start')?.length
    flow.vm.$emit('nodeMouseEnter', { node: { id: 'a' } })
    await flushPromises()
    expect([...api.getVisibleProjection().linkIds]).toEqual(['ab', 'ad'])
    await wrapper.setProps({ selection: ['a'] })
    flow.vm.$emit('nodeMouseEnter', { node: { id: 'e' } })
    await flushPromises()
    expect(flow.props('edges')?.map((edge) => edge.id)).toEqual(['ab', 'ad'])
    await wrapper.setProps({ neighborHighlightDepth: 2 })
    expect(api.getVisibleProjection().linkIds.has('bc')).toBe(true)
    await wrapper.setProps({ selection: ['b', 'd'] })
    expect([...api.getVisibleProjection().linkIds]).toEqual(['bd'])
    expect(wrapper.emitted('layout-start')?.length).toBe(runs)
    wrapper.unmount()
  })

  it('updates a manual path when link filters change, including parallel edges and the depth limit', async () => {
    const { wrapper, api } = await mountMap()
    expect(api.highlightPath('a', 'd', { maxDepth: 1 })).toEqual(['a', 'd'])
    const result = () => wrapper.emitted('path-result')?.at(-1)?.[0]
    expect(result()).toMatchObject({ linkIds: ['ad'] })
    await flushPromises()
    expect(wrapper.findAll('.vam-edge--highlighted').map((el) => el.attributes('id'))).toEqual(['ad'])
    await wrapper.setProps({ linkFilter: (edge: AssetLink) => edge.id !== 'ad' })
    expect(result()).toMatchObject({ linkIds: ['da'] })
    await wrapper.setProps({ linkFilter: (edge: AssetLink) => !['ad', 'da'].includes(edge.id) })
    expect(result()).toMatchObject({ status: 'depth-limit' })
    wrapper.unmount()
  })

  it('reports only surviving source ids and the displayed count of an aggregate', async () => {
    const { wrapper, flow } = await mountMap({
      entities: nodes.map((n) => ({ ...n, type: n.id === 'a' ? 'router' : 'host' })),
      links: [cable('ab', 'a', 'b'), cable('ac', 'a', 'c'), cable('ad', 'a', 'd')],
      collapse: { threshold: 1 },
      filterOptions: { neighborDepth: 0 },
    })
    await wrapper.setProps({
      filters: { query: '', types: [], statuses: [], predicate: (n: AssetEntity) => n.id !== 'b' },
    })
    expect(flow.props('edges')?.[0]?.data.count).toBe(2)
    await wrapper.find('.vam-edge__hit').trigger('click')
    expect(wrapper.emitted('edge-click')?.at(-1)?.[0]).toMatchObject({
      sourceLinkIds: ['ac', 'ad'],
      count: 2,
    })
    wrapper.unmount()
  })

  it('traces through actual members of a folded group and highlights its representative', async () => {
    const endpoint = (id: string) => ({ id, label: id, type: id })
    const entities = [endpoint('a'), nodes[1]!, nodes[2]!, endpoint('d')]
    const connections = [cable('ab', 'a', 'b'), cable('cd', 'c', 'd')]
    const { wrapper, api } = await mountMap({ entities, links: connections, collapse: { threshold: 1 } })
    expect(api.highlightPath('a', 'd')).toEqual([])
    await wrapper.setProps({ links: [...connections, cable('bc', 'b', 'c')] })
    expect(wrapper.emitted('path-result')?.at(-1)?.[0]).toMatchObject({ nodeIds: ['a', 'b', 'c', 'd'] })
    expect(wrapper.find('.vam-group').classes()).toContain('vam-node--highlighted')
    expect(wrapper.findAll('.vam-edge--highlighted')).toHaveLength(2)
    wrapper.unmount()
  })

  it('paints the same incident edges on canvas and hit-tests just those lines', async () => {
    const drawing = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
    }
    const context = drawing as unknown as CanvasRenderingContext2D
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
    const { wrapper, flow } = await mountMap({
      entities: nodes
        .slice(0, 3)
        .map((n, i) => ({ ...n, position: { x: i ? 600 : 0, y: i === 2 ? 400 : 0 } })),
      links: [cable('ab', 'a', 'b'), cable('ac', 'a', 'c'), cable('bc', 'b', 'c')],
      selection: ['a'],
      selectionLinkMode: 'neighborhood',
      virtualize: true,
    })
    try {
      expect(flow.props('edges')?.map((e) => e.id)).toEqual(['ab', 'ac'])
      await wrapper.setProps({ viewport: { x: 0, y: 0, zoom: 0.2 } })
      await flushPromises()
      drawing.lineTo.mockClear()
      wrapper.findComponent(LodCanvas).props('paint')(context, (token) => token)
      expect(drawing.lineTo).toHaveBeenCalledTimes(2)
      const click = (x: number, y: number) =>
        flow.vm.$emit('pane-click', new MouseEvent('click', { clientX: x, clientY: y }))
      click(73, 6) // midway between a and b
      expect(wrapper.emitted('edge-click')?.at(-1)?.[0]).toMatchObject({ sourceLinkIds: ['ab'], count: 1 })
      click(133, 46) // the hidden b–c line
      expect(wrapper.emitted('edge-click')).toHaveLength(1)
    } finally {
      wrapper.unmount()
      canvas.mockRestore()
    }
  })

  it('reveals a paged member inside a collapsed parent and preserves unrelated branches and positions', async () => {
    const children = Array.from({ length: 9 }, (_, i) => ({
      id: 'n' + i,
      label: 'n' + i,
      type: 'host',
      parentId: 'a',
    }))
    const { wrapper, api } = await mountMap({
      entities: [nodes[0]!, { ...nodes[1]!, type: 'other' }, ...children],
      links: [],
      collapse: { threshold: 1, pageSize: 2 },
    })
    await wrapper.setProps({
      collapsedNodes: new Set(['a', 'b']),
      positions: { n6: { x: 380, y: 510 } },
      expanded: new Set<string>(),
      'onUpdate:collapsedNodes': (ids: Set<string>) => wrapper.setProps({ collapsedNodes: ids }),
      'onUpdate:expanded': (ids: Set<string>) => wrapper.setProps({ expanded: ids }),
    })
    await api.focus('n6', { reveal: true, duration: 0 })
    expect(wrapper.emitted('update:collapsedNodes')?.at(-1)?.[0]).toEqual(new Set(['b']))
    const group = groupIdFor('a', 'host')
    expect(wrapper.emitted('update:expanded')?.at(-1)?.[0]).toEqual(new Set([group, pageIdFor(group, 6)]))
    expect(api.getPositions().n3).toBeUndefined()
    expect(api.getPositions().n6).toEqual({ x: 380, y: 510 })
    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual(['n6'])
    expect(wrapper.emitted('update:positions')).toBeUndefined()
    await api.focus('n4', { reveal: true, duration: 0 })
    expect(wrapper.emitted('update:expanded')?.at(-1)?.[0]).toEqual(
      new Set([group, pageIdFor(group, 6), pageIdFor(group, 4)]),
    )
    expect(api.getPositions().n3).toBeUndefined()
    wrapper.unmount()
  })
})
