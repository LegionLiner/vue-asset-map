// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AssetMap from '../../src/components/AssetMap.vue'
import { entities, links, statusColors, views } from '../../fixtures/infra'

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
  await flushPromises()
  await nextTick()
  await flushPromises()
  return wrapper
}

/** Последний путь, о котором сообщило событие. */
function lastPath(wrapper: Awaited<ReturnType<typeof mountMap>>): string[] | undefined {
  return wrapper.emitted('path-change')?.at(-1)?.[0] as string[] | undefined
}

/** Shift+клик: набирает выделение, окно при этом не открывая. */
async function pick(wrapper: Awaited<ReturnType<typeof mountMap>>, label: string) {
  await wrapper.find(`[aria-label^="${label}"]`).trigger('click', { shiftKey: true })
  await flushPromises()
  await nextTick()
}

describe('autoPath: путь определяется сам', () => {
  it('выключен по умолчанию: два выделенных узла путь не строят', async () => {
    const wrapper = await mountMap({ view: 'logical' })

    await pick(wrapper, 'Artjom')
    await pick(wrapper, 'Sergey')

    expect(wrapper.findAll('.vam-node--highlighted')).toHaveLength(0)
    expect(wrapper.emitted('path-change')).toBeUndefined()

    wrapper.unmount()
  })

  it('два выделенных узла подсвечивают путь между собой', async () => {
    const wrapper = await mountMap({ view: 'logical', autoPath: true })

    await pick(wrapper, 'Artjom')
    // Один узел — пары ещё нет, подсвечивать нечего.
    expect(wrapper.findAll('.vam-node--highlighted')).toHaveLength(0)

    await pick(wrapper, 'Sergey')

    expect(wrapper.findAll('.vam-node--highlighted').length).toBeGreaterThan(1)
    expect(lastPath(wrapper)?.length).toBeGreaterThan(1)

    wrapper.unmount()
  })

  it('путь идёт от первого выделенного узла ко второму', async () => {
    const wrapper = await mountMap({ view: 'logical', autoPath: true })

    await pick(wrapper, 'Artjom')
    await pick(wrapper, 'Sergey')

    const path = lastPath(wrapper)
    expect(path?.at(0)).toBe('ws-artjom')
    expect(path?.at(-1)).toBe('ws-sergey')

    wrapper.unmount()
  })

  it('третий узел путь снимает: пары больше нет', async () => {
    const wrapper = await mountMap({ view: 'logical', autoPath: true })

    await pick(wrapper, 'Artjom')
    await pick(wrapper, 'Sergey')
    expect(wrapper.findAll('.vam-node--highlighted').length).toBeGreaterThan(1)

    await pick(wrapper, 'Vlad')

    expect(wrapper.findAll('.vam-node--highlighted')).toHaveLength(0)
    expect(lastPath(wrapper)).toEqual([])

    wrapper.unmount()
  })

  it('снятие выделения снимает и путь', async () => {
    const wrapper = await mountMap({ view: 'logical', autoPath: true, selection: ['ws-artjom', 'ws-sergey'] })

    expect(wrapper.findAll('.vam-node--highlighted').length).toBeGreaterThan(1)

    await wrapper.setProps({ selection: [] })
    await nextTick()

    expect(wrapper.findAll('.vam-node--highlighted')).toHaveLength(0)
    expect(lastPath(wrapper)).toEqual([])

    wrapper.unmount()
  })

  it('работает и от выделения снаружи, без единого клика', async () => {
    // Пара может прийти из приложения — например из своего списка активов.
    const wrapper = await mountMap({
      view: 'logical',
      autoPath: true,
      selection: ['ws-artjom', 'ws-sergey'],
    })

    expect(lastPath(wrapper)?.at(0)).toBe('ws-artjom')
    expect(wrapper.findAll('.vam-node--highlighted').length).toBeGreaterThan(1)

    wrapper.unmount()
  })

  it('несуществующий путь сообщается пустым списком', async () => {
    const wrapper = await mountMap({
      view: 'logical',
      autoPath: true,
      // В логическом виде интернет со станцией не связан.
      selection: ['ws-artjom', 'internet'],
    })

    expect(wrapper.findAll('.vam-node--highlighted')).toHaveLength(0)
    // О событии сообщать нечего: пути не было и не появилось.
    expect(wrapper.emitted('path-change')).toBeUndefined()

    wrapper.unmount()
  })

  it('смена вида пересчитывает путь по слоям нового вида', async () => {
    const wrapper = await mountMap({ view: 'logical', autoPath: true, selection: ['ws-vlad', 'ws-sergey'] })

    const logical = lastPath(wrapper)
    expect(logical?.length).toBeGreaterThan(1)

    await wrapper.setProps({ view: 'physical' })
    await flushPromises()
    await nextTick()

    // Тот же путь пересчитан по другим связям: маршрут либо иной, либо его нет.
    expect(lastPath(wrapper)).not.toEqual(logical)

    wrapper.unmount()
  })

  it('pathOptions.maxDepth обрывает слишком длинный поиск', async () => {
    const wrapper = await mountMap({
      view: 'logical',
      autoPath: true,
      pathOptions: { maxDepth: 1 },
      selection: ['ws-artjom', 'ws-sergey'],
    })

    // Один шаг между станциями не проходит: путь через координатора длиннее.
    expect(wrapper.emitted('path-change')).toBeUndefined()
    expect(wrapper.findAll('.vam-node--highlighted')).toHaveLength(0)

    wrapper.unmount()
  })

  it('path-change не повторяется, пока путь тот же', async () => {
    const wrapper = await mountMap({ view: 'logical', autoPath: true, selection: ['ws-artjom', 'ws-sergey'] })

    const before = wrapper.emitted('path-change')?.length ?? 0

    // Тот же набор новым массивом: путь не изменился, событию взяться неоткуда.
    await wrapper.setProps({ selection: ['ws-artjom', 'ws-sergey'] })
    await flushPromises()
    await nextTick()

    expect(wrapper.emitted('path-change')?.length ?? 0).toBe(before)

    wrapper.unmount()
  })

  it('включение autoPath на уже выделенной паре строит путь', async () => {
    const wrapper = await mountMap({ view: 'logical', selection: ['ws-artjom', 'ws-sergey'] })

    expect(wrapper.findAll('.vam-node--highlighted')).toHaveLength(0)

    await wrapper.setProps({ autoPath: true })
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vam-node--highlighted').length).toBeGreaterThan(1)
    wrapper.unmount()
  })

  it('ручной highlightPath тоже сообщает о пути', async () => {
    const wrapper = await mountMap({ view: 'logical' })
    const api = wrapper.vm as unknown as {
      highlightPath: (from: string, to: string, options?: { maxDepth?: number }) => string[]
      clearHighlight: () => void
    }

    api.highlightPath('ws-artjom', 'ws-sergey')
    await nextTick()
    expect(lastPath(wrapper)?.length).toBeGreaterThan(1)

    api.clearHighlight()
    await nextTick()
    expect(lastPath(wrapper)).toEqual([])

    wrapper.unmount()
  })

  it('своё maxDepth в вызове перекрывает pathOptions', async () => {
    const wrapper = await mountMap({ view: 'logical', pathOptions: { maxDepth: 1 } })
    const api = wrapper.vm as unknown as {
      highlightPath: (from: string, to: string, options?: { maxDepth?: number }) => string[]
    }

    expect(api.highlightPath('ws-artjom', 'ws-sergey')).toEqual([])
    expect(api.highlightPath('ws-artjom', 'ws-sergey', { maxDepth: 12 }).length).toBeGreaterThan(1)

    wrapper.unmount()
  })
})
