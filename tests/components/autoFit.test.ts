// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import type * as VueFlowCore from '@vue-flow/core'

/**
 * Подгонку в jsdom не увидеть, и произойти она там тоже не может: `ResizeObserver`
 * — заглушка, поэтому VueFlow никогда не досчитывает размеры узлов и
 * `useNodesInitialized` навсегда остаётся `false`. Проверять «не подгоняли» в
 * таких условиях бессмысленно: не подгоняли бы в любом случае.
 *
 * Поэтому обе стороны берутся под контроль: сигнал «узлы измерены» подаётся
 * руками, а `fitView` — шпион. Так проверяется решение, которое принимает
 * компонент, а не то, умеет ли jsdom считать размеры.
 */
const fitView = vi.fn(() => Promise.resolve())
const nodesReady = ref(false)

type VueFlowModule = typeof VueFlowCore

vi.mock('@vue-flow/core', async (importOriginal) => {
  const actual = await importOriginal<VueFlowModule>()
  return {
    ...actual,
    useNodesInitialized: () => nodesReady,
    useVueFlow: (...args: unknown[]) => ({
      ...(actual.useVueFlow as (...a: unknown[]) => object)(...args),
      fitView,
    }),
  }
})

const AssetMap = (await import('../../src/components/AssetMap.vue')).default
const { entities, links, statusColors, views } = await import('../../fixtures/infra')

async function settle() {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

/** Сообщает компоненту, что набор видимых узлов пересчитан и измерен. */
async function measured() {
  nodesReady.value = false
  await nextTick()
  nodesReady.value = true
  await settle()
}

async function mountMap(props: Record<string, unknown> = {}) {
  const wrapper = mount(AssetMap, {
    props: {
      entities,
      links,
      views,
      themeConfig: { statusColors },
      onlyRenderVisibleElements: false,
      searchDebounce: 0,
      ...props,
    },
    attachTo: document.body,
  })
  await settle()
  return wrapper
}

describe('autoFitView', () => {
  beforeEach(() => {
    fitView.mockClear()
    nodesReady.value = false
  })

  it('подгоняет карту при появлении', async () => {
    const wrapper = await mountMap({ view: 'physical', autoFitView: true })

    await measured()

    expect(fitView).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('без autoFitView не подгоняет вовсе', async () => {
    const wrapper = await mountMap({ view: 'physical' })

    await measured()

    expect(fitView).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('второй пересчёт узлов карту уже не двигает', async () => {
    // Это и был баг: раскрытие поддерева меняет набор видимых узлов, `nodesReady`
    // проходит false → true ещё раз, и карта прыгала под руками.
    const wrapper = await mountMap({ view: 'physical', autoFitView: true })

    await measured()
    expect(fitView).toHaveBeenCalledTimes(1)

    fitView.mockClear()
    await measured()

    expect(fitView).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('раскрытие поддерева подгонку не запрашивает', async () => {
    const wrapper = await mountMap({
      view: 'physical',
      autoFitView: true,
      collapsedNodes: new Set(['keenetic-1']),
    })
    await measured()
    fitView.mockClear()

    const before = wrapper.findAll('.vam-node').length
    await wrapper.find('[aria-label^="Keenetic 1"] .vam-node__toggle').trigger('click')
    await settle()
    await measured()

    // Узлы появились…
    expect(wrapper.findAll('.vam-node').length).toBeGreaterThan(before)
    // …а вид остался прежним.
    expect(fitView).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('смена вида подгонку заслуживает: это другой граф', async () => {
    const wrapper = await mountMap({ view: 'physical', autoFitView: true })
    await measured()
    fitView.mockClear()

    await wrapper.setProps({ view: 'logical' })
    await settle()
    await measured()

    expect(fitView).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('смена вида без autoFitView подгонки не вызывает', async () => {
    const wrapper = await mountMap({ view: 'physical' })
    await measured()

    await wrapper.setProps({ view: 'logical' })
    await settle()
    await measured()

    expect(fitView).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('fitView() руками работает всегда', async () => {
    // Явный вызов — это не автоподгонка, и флаг его не касается.
    const wrapper = await mountMap({ view: 'physical' })
    await measured()

    await (wrapper.vm as unknown as { fitView: () => Promise<void> }).fitView()

    expect(fitView).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
