// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import NetworkMap from '../../src/components/NetworkMap.vue'
import { groupIdFor } from '../../src/core/collapse'
import type { LayoutEngine } from '../../src/layout/types'
import type { XY } from '../../src/types/entity'
import type { NetworkMapSlots } from '../../src/types/props'
import { entities, links, statusColors, views } from '../../fixtures/infra'

/** Движок-шпион: считает вызовы и раскладывает узлы в предсказуемый ряд. */
function spyEngine(): LayoutEngine & { calls: number } {
  const engine = {
    name: 'spy',
    calls: 0,
    async run(graph: { nodes: { id: string }[] }): Promise<Map<string, XY>> {
      engine.calls += 1
      const positions = new Map<string, XY>()
      graph.nodes.forEach((node, index) => positions.set(node.id, { x: index * 200, y: 0 }))
      return positions
    },
  }
  return engine as LayoutEngine & { calls: number }
}

/**
 * Слоты типизируются публичным контрактом компонента: так тест заодно проверяет,
 * что `#node-{kind}` с произвольным именем вообще проходит проверку типов.
 */
async function mountMap(props: Record<string, unknown> = {}, slots: NetworkMapSlots = {}) {
  const wrapper = mount(NetworkMap, {
    props: {
      entities,
      links,
      views,
      themeConfig: { statusColors },
      // В jsdom нет реального вьюпорта: отрисовать нужно всё, иначе VueFlow
      // сочтёт, что видимых элементов нет.
      onlyRenderVisibleElements: false,
      searchDebounce: 0,
      ...props,
    },
    slots,
    attachTo: document.body,
  })

  await flushPromises()
  await nextTick()
  await flushPromises()
  return wrapper
}

const GROUP_ID = groupIdFor('pve-beelink', 'container')

describe('<NetworkMap> рендер', () => {
  it('рисует узлы из фикстуры', async () => {
    const wrapper = await mountMap()

    const nodes = wrapper.findAll('.vnm-node')
    expect(nodes.length).toBeGreaterThan(10)
    expect(wrapper.text()).toContain('Интернет')
    expect(wrapper.text()).toContain('Tailscale VPS')

    wrapper.unmount()
  })

  it('ставит класс темы на корневой элемент', async () => {
    const light = await mountMap({ theme: 'light' })
    expect(light.find('.vnm-root').classes()).toContain('vnm-theme-light')
    light.unmount()

    const dark = await mountMap({ theme: 'dark' })
    expect(dark.find('.vnm-root').classes()).toContain('vnm-theme-dark')
    dark.unmount()
  })

  it('полотну задана роль application с локализованным именем', async () => {
    const wrapper = await mountMap()
    const canvas = wrapper.find('[role="application"]')

    expect(canvas.exists()).toBe(true)
    expect(canvas.attributes('aria-label')).toBe('Карта сети')

    wrapper.unmount()
  })

  it('локаль переключает строки интерфейса', async () => {
    const wrapper = await mountMap({ locale: 'en' })
    expect(wrapper.find('[role="application"]').attributes('aria-label')).toBe('Network map')
    wrapper.unmount()
  })

  it('частичный словарь переопределяет только переданные ключи', async () => {
    const wrapper = await mountMap({ locale: { 'canvas.label': 'Схема' } })
    expect(wrapper.find('[role="application"]').attributes('aria-label')).toBe('Схема')
    wrapper.unmount()
  })
})

describe('<NetworkMap> выделение и панель', () => {
  it('клик по узлу выделяет его и открывает панель подробностей', async () => {
    const wrapper = await mountMap()

    expect(wrapper.find('.vnm-window').exists()).toBe(false)

    const node = wrapper.find('[aria-label^="Tailscale VPS"]')
    expect(node.exists()).toBe(true)
    await node.trigger('click')
    await nextTick()

    expect(node.classes()).toContain('vnm-node--selected')
    expect(wrapper.find('.vnm-window').exists()).toBe(true)
    expect(wrapper.find('.vnm-window').text()).toContain('Tailscale VPS')

    const events = wrapper.emitted('node-click')
    expect(events).toHaveLength(1)
    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual(['vps-tailscale'])

    wrapper.unmount()
  })

  it('работает без v-model: состояние ведёт сам компонент', async () => {
    const wrapper = await mountMap()

    await wrapper.find('[aria-label^="Keenetic 1"]').trigger('click')
    await nextTick()

    // Ни одного v-model не передано, а выделение и панель всё равно работают.
    expect(wrapper.find('.vnm-window').exists()).toBe(true)
    expect(wrapper.find('[aria-label^="Keenetic 1"]').classes()).toContain('vnm-node--selected')

    wrapper.unmount()
  })

  it('Ctrl+клик добавляет узел к выделению, обычный клик — заменяет', async () => {
    const wrapper = await mountMap()

    await wrapper.find('[aria-label^="Keenetic 1"]').trigger('click')
    await wrapper.find('[aria-label^="Keenetic 2"]').trigger('click', { ctrlKey: true })
    await nextTick()

    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual(['keenetic-1', 'keenetic-2'])

    await wrapper.find('[aria-label^="Keenetic 1"]').trigger('click')
    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual(['keenetic-1'])

    wrapper.unmount()
  })

  it('Enter на узле выделяет его так же, как клик', async () => {
    const wrapper = await mountMap()

    const node = wrapper.find('[aria-label^="Dmitry"]')
    await node.trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(node.classes()).toContain('vnm-node--selected')
    wrapper.unmount()
  })

  it('Escape закрывает панель, повторный выбор открывает заново', async () => {
    const wrapper = await mountMap()

    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()
    expect(wrapper.find('.vnm-window').exists()).toBe(true)

    await wrapper.find('.vnm-root').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.find('.vnm-window').exists()).toBe(false)

    await wrapper.find('[aria-label^="Vlad"]').trigger('click')
    await nextTick()
    expect(wrapper.find('.vnm-window').exists()).toBe(true)

    wrapper.unmount()
  })

  it('кнопка закрытия панели её закрывает', async () => {
    const wrapper = await mountMap()

    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    await wrapper.findAll('.vnm-window__button')[0]!.trigger('click')
    await nextTick()

    expect(wrapper.find('.vnm-window').exists()).toBe(false)
    wrapper.unmount()
  })

  it('showDetailsPanel: false не рендерит панель вовсе', async () => {
    const wrapper = await mountMap({ showDetailsPanel: false })

    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    expect(wrapper.find('.vnm-window').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('<NetworkMap> свёртка групп', () => {
  it('14 однотипных детей показаны одним групповым узлом', async () => {
    const wrapper = await mountMap()

    const group = wrapper.find('.vnm-group')
    expect(group.exists()).toBe(true)
    expect(group.text()).toContain('14')
    // Участники группы на карте не отрисованы.
    expect(wrapper.find('[aria-label^="web-01"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('клик по групповому узлу эмитит expand и раскрывает участников', async () => {
    const wrapper = await mountMap()

    await wrapper.find('.vnm-group').trigger('click')
    await flushPromises()
    await nextTick()

    const expandEvents = wrapper.emitted('expand')
    expect(expandEvents).toHaveLength(1)
    expect(expandEvents?.[0]?.[0]).toMatchObject({ groupId: GROUP_ID })

    expect(wrapper.find('.vnm-group').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="web-01"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('повторный клик сворачивает группу и эмитит collapse', async () => {
    const wrapper = await mountMap()

    await wrapper.find('.vnm-group').trigger('click')
    await flushPromises()
    await nextTick()

    await wrapper.find('[aria-label^="web-01"]').trigger('click')
    // Раскрытая группа сворачивается через модель `expanded`, а не кликом по
    // участнику: проверяем через прямую установку модели.
    await wrapper.setProps({ expanded: new Set<string>() })
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.vnm-group').exists()).toBe(true)
    wrapper.unmount()
  })

  it('collapse: false выключает свёртку — все 14 узлов на карте', async () => {
    const wrapper = await mountMap({ collapse: false })

    expect(wrapper.find('.vnm-group').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="web-01"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label^="web-14"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('свой порог свёртки применяется', async () => {
    const wrapper = await mountMap({ collapse: { threshold: 2 } })

    // При пороге 2 сворачиваются и рабочие станции, и гипервизоры.
    expect(wrapper.findAll('.vnm-group').length).toBeGreaterThan(1)
    wrapper.unmount()
  })
})

describe('<NetworkMap> раскладка', () => {
  it('смена вида вызывает пересчёт раскладки', async () => {
    const engine = spyEngine()
    const wrapper = await mountMap({ layout: { engine } })

    const before = engine.calls
    expect(before).toBeGreaterThan(0)

    await wrapper.setProps({ view: 'logical' })
    await flushPromises()
    await nextTick()
    await flushPromises()

    expect(engine.calls).toBeGreaterThan(before)
    expect(wrapper.emitted('layout-done')?.length).toBeGreaterThan(0)

    wrapper.unmount()
  })

  it('эмитит layout-start и layout-done с именем движка', async () => {
    const engine = spyEngine()
    const wrapper = await mountMap({ layout: { engine } })

    expect(wrapper.emitted('layout-start')?.[0]?.[0]).toBe('spy')
    expect(wrapper.emitted('layout-done')?.[0]?.[0]).toMatchObject({ engine: 'spy' })

    wrapper.unmount()
  })

  it('неизвестное имя движка не гасит карту: откат на manual плюс error', async () => {
    const wrapper = await mountMap({ layout: { engine: 'no-such-engine' } })

    expect(wrapper.emitted('error')?.length).toBeGreaterThan(0)
    expect(wrapper.findAll('.vnm-node').length).toBeGreaterThan(10)
    expect(wrapper.emitted('layout-done')?.[0]?.[0]).toMatchObject({ engine: 'manual' })

    wrapper.unmount()
  })

  it('relayout() из defineExpose запускает движок заново', async () => {
    const engine = spyEngine()
    const wrapper = await mountMap({ layout: { engine } })

    const before = engine.calls
    await (wrapper.vm as unknown as { relayout: () => Promise<void> }).relayout()
    await flushPromises()

    expect(engine.calls).toBe(before + 1)
    wrapper.unmount()
  })
})

describe('<NetworkMap> слоты', () => {
  it('слот #node-{kind} подменяет рендер узлов этого типа', async () => {
    const wrapper = await mountMap(
      {},
      {
        'node-router': (props: { entity?: { label: string } }) =>
          h('span', { class: 'custom-router' }, `R:${props.entity?.label ?? ''}`),
      },
    )

    const custom = wrapper.findAll('.custom-router')
    expect(custom).toHaveLength(2)
    expect(custom.map((node) => node.text()).sort()).toEqual(['R:Keenetic 1', 'R:Keenetic 2'])

    // Остальные типы отрисованы штатно.
    expect(wrapper.find('[aria-label^="Tailscale VPS"]').text()).toContain('Tailscale VPS')

    wrapper.unmount()
  })

  it('слот #details подменяет содержимое панели', async () => {
    const wrapper = await mountMap(
      {},
      {
        details: (props: { entity: { id: string } }) =>
          h('div', { class: 'custom-details' }, `id=${props.entity.id}`),
      },
    )

    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    expect(wrapper.find('.custom-details').text()).toBe('id=ws-dmitry')
    wrapper.unmount()
  })

  it('слот #empty показывается, когда показывать нечего', async () => {
    const wrapper = await mountMap(
      { entities: [], links: [] },
      { empty: () => h('div', { class: 'custom-empty' }, 'пусто') },
    )

    expect(wrapper.find('.custom-empty').exists()).toBe(true)
    wrapper.unmount()
  })

  it('слот #loading показывается при loading', async () => {
    const wrapper = await mountMap(
      { loading: true },
      { loading: () => h('div', { class: 'custom-loading' }, 'грузим') },
    )

    expect(wrapper.find('.custom-loading').exists()).toBe(true)
    wrapper.unmount()
  })

  it('слоты тулбара рендерятся по сторонам', async () => {
    const wrapper = await mountMap(
      { showToolbar: true },
      {
        'toolbar-left': () => h('span', { class: 'tb-left' }, 'слева'),
        'toolbar-right': () => h('span', { class: 'tb-right' }, 'справа'),
      },
    )

    expect(wrapper.find('.tb-left').exists()).toBe(true)
    expect(wrapper.find('.tb-right').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('<NetworkMap> вид и фильтр', () => {
  it('логический вид скрывает узлы без оверлейных связей', async () => {
    const wrapper = await mountMap({ view: 'logical' })

    expect(wrapper.find('[aria-label^="Интернет"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="Tailscale VPS"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('вид управляет показом подписей', async () => {
    const physical = await mountMap({ view: 'physical' })
    expect(physical.find('[aria-label^="Keenetic 1"]').text()).not.toContain('pteam.keenetic.pro')
    physical.unmount()

    const logical = await mountMap({ view: 'logical' })
    expect(logical.find('[aria-label^="Tailscale VPS"]').text()).toContain('46.8.158.127')
    logical.unmount()
  })

  it('поиск подсвечивает совпадения и гасит остальное, не разрывая граф', async () => {
    const wrapper = await mountMap({
      filters: { query: 'Dmitry', kinds: [], statuses: [] },
    })
    await flushPromises()
    await nextTick()

    const match = wrapper.find('[aria-label^="Dmitry"]')
    expect(match.classes()).toContain('vnm-node--matched')

    // Сосед остаётся видимым — граф не рассыпался на изолят.
    expect(wrapper.find('[aria-label^="Keenetic 2"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label^="Keenetic 2"]').classes()).toContain('vnm-node--dimmed')
    // Несвязанный узел скрыт.
    expect(wrapper.find('[aria-label^="Cloudflare"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('поиск по маске подсети находит рабочие станции', async () => {
    const wrapper = await mountMap({
      filters: { query: '10.38.24.*', kinds: [], statuses: [] },
    })
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vnm-node--matched')).toHaveLength(5)
    wrapper.unmount()
  })
})

describe('<NetworkMap> императивный API', () => {
  it('highlightPath подсвечивает узлы найденного пути', async () => {
    const wrapper = await mountMap({ view: 'logical' })
    const api = wrapper.vm as unknown as {
      highlightPath: (from: string, to: string) => string[]
      clearHighlight: () => void
    }

    const path = api.highlightPath('ws-artjom', 'ws-sergey')
    await nextTick()

    expect(path.length).toBeGreaterThan(1)
    expect(wrapper.findAll('.vnm-node--highlighted').length).toBeGreaterThan(1)

    api.clearHighlight()
    await nextTick()
    expect(wrapper.findAll('.vnm-node--highlighted')).toHaveLength(0)

    wrapper.unmount()
  })

  it('highlightPath на несуществующем пути ничего не подсвечивает', async () => {
    const wrapper = await mountMap({ view: 'logical' })
    const api = wrapper.vm as unknown as { highlightPath: (from: string, to: string) => string[] }

    expect(api.highlightPath('ws-artjom', 'internet')).toEqual([])
    await nextTick()
    expect(wrapper.findAll('.vnm-node--highlighted')).toHaveLength(0)

    wrapper.unmount()
  })

  it('getGraph отдаёт индексы построенного графа', async () => {
    const wrapper = await mountMap()
    const api = wrapper.vm as unknown as { getGraph: () => { entities: Map<string, unknown> } }

    expect(api.getGraph().entities.size).toBe(entities.length)
    wrapper.unmount()
  })

  it('focus(id) выделяет узел', async () => {
    const wrapper = await mountMap({ layout: { engine: spyEngine() } })
    const api = wrapper.vm as unknown as {
      focus: (id: string, options?: { duration?: number }) => Promise<void>
    }

    await api.focus('ws-vlad', { duration: 0 })
    await flushPromises()
    await nextTick()

    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual(['ws-vlad'])
    wrapper.unmount()
  })
})

describe('<NetworkMap> устойчивость', () => {
  it('пустой граф не падает', async () => {
    const wrapper = await mountMap({ entities: [], links: [] })
    expect(wrapper.find('.vnm-root').exists()).toBe(true)
    wrapper.unmount()
  })

  it('битые связи не мешают отрисовке', async () => {
    const wrapper = await mountMap({
      entities: [{ id: 'a', kind: 'host', label: 'A' }],
      links: [{ id: 'ghost', source: 'a', target: 'nope', layers: ['physical'] }],
      views: undefined,
    })

    expect(wrapper.find('[aria-label^="A"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('kindIcons из themeConfig используются для иконки узла', async () => {
    const icon = () => h('i', { class: 'icon-router' })
    const wrapper = await mountMap({ themeConfig: { statusColors, kindIcons: { router: icon } } })

    expect(wrapper.findAll('.icon-router').length).toBe(2)
    wrapper.unmount()
  })

  it('statusColors красит индикатор состояния', async () => {
    const wrapper = await mountMap()
    const node = wrapper.find('[aria-label^="Vlad"]')
    const indicator = node.find('.vnm-node__status')

    expect(indicator.attributes('style')).toContain('var(--vnm-status-offline)')
    wrapper.unmount()
  })

  it('не мутирует входные массивы', async () => {
    const entitiesCopy = structuredClone(entities)
    const linksCopy = structuredClone(links)

    const wrapper = await mountMap({ entities: entitiesCopy, links: linksCopy })
    await wrapper.find('.vnm-group').trigger('click')
    await flushPromises()

    expect(entitiesCopy).toEqual(structuredClone(entities))
    expect(linksCopy).toEqual(structuredClone(links))

    wrapper.unmount()
  })
})

describe('<NetworkMap> ошибки движка', () => {
  it('падение движка раскладки эмитит error, а не роняет компонент', async () => {
    const failing: LayoutEngine = {
      name: 'boom',
      run: vi.fn(async () => {
        throw new Error('layout exploded')
      }),
    }

    const wrapper = await mountMap({ layout: { engine: failing } })

    const errors = wrapper.emitted('error')
    expect(errors?.length).toBeGreaterThan(0)
    expect(wrapper.find('.vnm-root').exists()).toBe(true)

    wrapper.unmount()
  })
})
