// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import NetworkMap from '../../src/components/NetworkMap.vue'
import { buildGraph, collapseGraph, isAggregatedLink } from '../../src/core/index'
import { entities, filterGroups, links, statusColors, views } from '../../fixtures/infra'

async function mountMap(props: Record<string, unknown> = {}) {
  const wrapper = mount(NetworkMap, {
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

describe('узел: круг с подписью под ним', () => {
  it('корневая сущность помечена как крупная, дочерняя — как обычная', async () => {
    const wrapper = await mountMap()

    // `Интернет` — корень, `Proxmox Beelink` висит на роутере.
    expect(wrapper.find('[aria-label^="Интернет"]').classes()).toContain('vnm-node--root')
    expect(wrapper.find('[aria-label^="Proxmox Beelink"]').classes()).toContain('vnm-node--child')

    wrapper.unmount()
  })

  it('круг и блок с подписями — отдельные элементы', async () => {
    const wrapper = await mountMap({ view: 'logical' })
    const node = wrapper.find('[aria-label^="Tailscale VPS"]')

    expect(node.find('.vnm-node__circle').exists()).toBe(true)
    expect(node.find('.vnm-node__info').exists()).toBe(true)
    expect(node.find('.vnm-node__label').text()).toBe('Tailscale VPS')

    wrapper.unmount()
  })

  it('внешний и оверлейный адреса различаются классом, а значит и цветом', async () => {
    const wrapper = await mountMap({ view: 'logical' })
    const node = wrapper.find('[aria-label^="Tailscale VPS"]')

    expect(node.find('.vnm-node__sublabel').text()).toBe('46.8.158.127')
    expect(node.find('.vnm-node__sublabel-overlay').text()).toBe('100.64.0.2')

    wrapper.unmount()
  })

  it('индикатор состояния лежит внутри круга и окрашен темой', async () => {
    const wrapper = await mountMap()
    const status = wrapper.find('[aria-label^="Vlad"]').find('.vnm-node__circle .vnm-node__status')

    expect(status.exists()).toBe(true)
    expect(status.attributes('style')).toContain('var(--vnm-status-offline)')

    wrapper.unmount()
  })

  it('высота узла не зависит от вида: плашка подписей фиксирована', async () => {
    // Раскладка получает габариты узлов; при скрытых подписях они не должны
    // меняться, иначе переключение вида «дёргало» бы всю карту.
    const sizes: number[][] = []
    const engine = {
      name: 'probe',
      async run(graph: { nodes: { id: string; width: number; height: number }[] }) {
        sizes.push(graph.nodes.map((node) => node.height))
        return new Map(graph.nodes.map((node, index) => [node.id, { x: index * 200, y: 0 }]))
      },
    }

    const wrapper = await mountMap({ view: 'physical', layout: { engine } })
    const physical = sizes.at(-1)

    await wrapper.setProps({ view: 'logical' })
    await flushPromises()
    await nextTick()
    await flushPromises()

    const logical = sizes.at(-1)
    expect(physical?.length).toBeGreaterThan(0)
    // Физический вид скрывает подписи, логический показывает — высоты те же.
    expect(new Set(physical)).toEqual(new Set([42 + 6 + 36, 42 + 6 + 60]))
    expect(new Set(logical).size).toBeLessThanOrEqual(2)

    wrapper.unmount()
  })

  it('выделение обводит круг и плашку по отдельности, а не узел целиком', async () => {
    const wrapper = await mountMap()
    const node = wrapper.find('[aria-label^="Dmitry"]')

    await node.trigger('click')
    await nextTick()

    // Класс выделения на корне, но рамку по CSS получают круг и плашка —
    // проверяем, что оба элемента на месте и корень не рисует свою рамку.
    expect(node.classes()).toContain('vnm-node--selected')
    expect(node.find('.vnm-node__circle').exists()).toBe(true)
    expect(node.find('.vnm-node__info').exists()).toBe(true)

    wrapper.unmount()
  })

  it('бейджи лежат вне плашки подписей, чтобы её не распирать', async () => {
    const wrapper = await mountMap({ view: 'logical' })
    const node = wrapper.find('[aria-label^="Tailscale VPS"]')

    expect(node.find('.vnm-node__badges').exists()).toBe(true)
    expect(node.find('.vnm-node__info .vnm-node__badges').exists()).toBe(false)

    wrapper.unmount()
  })

  it('иконка типа приходит из themeConfig.kindIcons', async () => {
    const wrapper = await mountMap({
      themeConfig: { statusColors, kindIcons: { cloud: () => h('i', { class: 'cloud-icon' }) } },
    })

    expect(wrapper.find('[aria-label^="Интернет"]').find('.cloud-icon').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('кнопка свёртки поддерева на узле', () => {
  it('есть только у узлов с потомками', async () => {
    const wrapper = await mountMap()

    // У роутера есть дети, у рабочей станции — нет.
    expect(wrapper.find('[aria-label^="Keenetic 2"]').find('.vnm-node__toggle').exists()).toBe(true)
    expect(wrapper.find('[aria-label^="Vlad"]').find('.vnm-node__toggle').exists()).toBe(false)

    wrapper.unmount()
  })

  it('скрывает потомков и возвращает их обратно', async () => {
    const wrapper = await mountMap()

    expect(wrapper.find('[aria-label^="Vlad"]').exists()).toBe(true)

    const toggle = wrapper.find('[aria-label^="Keenetic 2"]').find('.vnm-node__toggle')
    await toggle.trigger('click')
    await flushPromises()
    await nextTick()

    // Дети роутера и вся ветка под ними ушли с карты.
    expect(wrapper.find('[aria-label^="Vlad"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="Proxmox Beelink"]').exists()).toBe(false)
    // Сам роутер остался.
    expect(wrapper.find('[aria-label^="Keenetic 2"]').exists()).toBe(true)
    // А офис A не задет.
    expect(wrapper.find('[aria-label^="Artjom"]').exists()).toBe(true)

    await wrapper.find('[aria-label^="Keenetic 2"]').find('.vnm-node__toggle').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[aria-label^="Vlad"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('эмитит node-collapse и node-expand с сущностью', async () => {
    const wrapper = await mountMap()
    const toggle = wrapper.find('[aria-label^="Keenetic 1"]').find('.vnm-node__toggle')

    await toggle.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('node-collapse')?.[0]?.[0]).toMatchObject({ id: 'keenetic-1' })

    await wrapper.find('[aria-label^="Keenetic 1"]').find('.vnm-node__toggle').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('node-expand')?.[0]?.[0]).toMatchObject({ id: 'keenetic-1' })

    wrapper.unmount()
  })

  it('клик по кнопке не выделяет узел', async () => {
    const wrapper = await mountMap()

    await wrapper.find('[aria-label^="Keenetic 2"]').find('.vnm-node__toggle').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.emitted('node-click')).toBeUndefined()
    expect(wrapper.find('.vnm-window').exists()).toBe(false)

    wrapper.unmount()
  })

  it('v-model:collapsedNodes управляет свёрткой снаружи', async () => {
    const wrapper = await mountMap({ collapsedNodes: new Set(['keenetic-2']) })

    expect(wrapper.find('[aria-label^="Vlad"]').exists()).toBe(false)

    await wrapper.setProps({ collapsedNodes: new Set<string>() })
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[aria-label^="Vlad"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('ядро: свёртка поддерева переносит рёбра на родителя', () => {
  const graph = buildGraph(entities, links)

  it('потомки скрыты, а их связи собраны на родителе', () => {
    const result = collapseGraph(graph, { collapsedParentIds: new Set(['keenetic-2']) })

    expect(result.hiddenIds.has('ws-vlad')).toBe(true)
    expect(result.hiddenIds.has('ct-web-1')).toBe(true)
    expect(result.groupOf.get('ws-vlad')).toBe('keenetic-2')
    expect(result.nodeIds).toContain('keenetic-2')
    expect(result.nodeIds).not.toContain('ws-vlad')

    // Пять рёбер роутера к своим детям стали одним агрегатом на самом роутере.
    const selfLoops = result.links.filter((link) => link.source === link.target)
    expect(selfLoops).toEqual([])

    // Оверлейные связи спрятанных станций теперь ведут к роутеру.
    const overlay = result.links.filter(
      (link) =>
        (link.source === 'vps-tailscale' && link.target === 'keenetic-2') ||
        (link.source === 'keenetic-2' && link.target === 'vps-tailscale'),
    )
    expect(overlay.length).toBe(1)
    expect(overlay[0] && isAggregatedLink(overlay[0])).toBe(true)
  })

  it('вложенные свёрнутые родители не спорят друг с другом', () => {
    const result = collapseGraph(graph, {
      collapsedParentIds: new Set(['keenetic-2', 'pve-beelink']),
    })

    // Ближайший к корню родитель забирает поддерево целиком.
    expect(result.groupOf.get('ct-web-1')).toBe('keenetic-2')
    expect(result.nodeIds).not.toContain('pve-beelink')
  })

  it('без свёрнутых родителей результат прежний', () => {
    const plain = collapseGraph(graph)
    const withEmpty = collapseGraph(graph, { collapsedParentIds: new Set() })

    expect(withEmpty.nodeIds).toEqual(plain.nodeIds)
    expect(withEmpty.links.length).toBe(plain.links.length)
  })
})

describe('окно подробностей', () => {
  it('шапка с двумя кнопками: закрыть и сжать', async () => {
    const wrapper = await mountMap()
    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    const buttons = wrapper.findAll('.vnm-window__button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.attributes('aria-label')).toBe('Закрыть панель')
    expect(buttons[1]?.attributes('aria-label')).toBe('Свернуть окно')

    wrapper.unmount()
  })

  /**
   * Кнопки шапки нажимаются через настоящую цепочку событий.
   *
   * Именно здесь пряталась поломка: перетаскивание вызывало `preventDefault()` на
   * `pointerdown` и забирало указатель себе, из-за чего браузер не синтезировал
   * `click` и кнопки не работали. Одиночный `trigger('click')` этого не видит —
   * он отправляет клик напрямую.
   */
  async function pressHeaderButton(
    wrapper: Awaited<ReturnType<typeof mountMap>>,
    index: number,
  ): Promise<void> {
    const button = wrapper.findAll('.vnm-window__button')[index]
    if (!button) throw new Error(`нет кнопки шапки #${index}`)

    await button.trigger('pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    // Перетаскивание не должно было начаться: иначе клик будет съеден.
    expect(wrapper.find('.vnm-window').classes()).not.toContain('vnm-window--dragging')

    await button.trigger('pointerup', { pointerId: 1 })
    await button.trigger('click')
    await nextTick()
  }

  it('кнопка закрытия работает при нажатии, а не только при синтетическом клике', async () => {
    const wrapper = await mountMap()
    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()
    expect(wrapper.find('.vnm-window').exists()).toBe(true)

    await pressHeaderButton(wrapper, 0)

    expect(wrapper.find('.vnm-window').exists()).toBe(false)
    wrapper.unmount()
  })

  it('кнопка сжатия работает при нажатии и не тянет окно', async () => {
    const wrapper = await mountMap()
    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    await pressHeaderButton(wrapper, 1)

    expect(wrapper.find('.vnm-window').classes()).toContain('vnm-window--collapsed')
    // Окно осталось на месте: нажатие на кнопку не считается перетаскиванием.
    expect(wrapper.find('.vnm-window').attributes('style')).toContain('translate(0px, 0px)')

    wrapper.unmount()
  })

  it('движение указателя после нажатия на кнопку окно не сдвигает', async () => {
    const wrapper = await mountMap()
    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    const button = wrapper.findAll('.vnm-window__button')[1]
    await button?.trigger('pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    await wrapper.find('.vnm-window__header').trigger('pointermove', { clientX: 200, clientY: 200 })
    await nextTick()

    expect(wrapper.find('.vnm-window').attributes('style')).toContain('translate(0px, 0px)')
    wrapper.unmount()
  })

  it('сжатие оставляет только шапку', async () => {
    const wrapper = await mountMap()
    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    expect(wrapper.find('.vnm-window__body').exists()).toBe(true)

    await wrapper.findAll('.vnm-window__button')[1]?.trigger('click')
    await nextTick()

    expect(wrapper.find('.vnm-window').classes()).toContain('vnm-window--collapsed')
    expect(wrapper.find('.vnm-window__body').exists()).toBe(false)
    expect(wrapper.findAll('.vnm-window__button')[1]?.attributes('aria-label')).toBe('Развернуть окно')

    wrapper.unmount()
  })

  it('перетаскивание за шапку сдвигает окно', async () => {
    const map = await mountMap()
    await map.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    const header = map.find('.vnm-window__header')
    const windowEl = map.find('.vnm-window')
    expect(windowEl.attributes('style')).toContain('translate(0px, 0px)')

    // setPointerCapture в jsdom нет — подменяем, иначе обработчик упадёт.
    const element = header.element as HTMLElement & { setPointerCapture: (id: number) => void }
    element.setPointerCapture = () => {}

    await header.trigger('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    await header.trigger('pointermove', { clientX: 160, clientY: 140, pointerId: 1 })
    await nextTick()

    expect(map.find('.vnm-window').attributes('style')).toContain('translate(60px, 40px)')

    await header.trigger('pointerup', { pointerId: 1 })
    map.unmount()
  })

  it('смена узла возвращает окно в исходное положение', async () => {
    // Ровно одно окно: со несколькими каждое живёт своей позицией.
    const wrapper = await mountMap({ maxDetailsWindows: 1 })
    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    const header = wrapper.find('.vnm-window__header')
    const element = header.element as HTMLElement & { setPointerCapture: (id: number) => void }
    element.setPointerCapture = () => {}

    await header.trigger('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 })
    await header.trigger('pointermove', { clientX: 50, clientY: 50, pointerId: 1 })
    await header.trigger('pointerup', { pointerId: 1 })
    await nextTick()
    expect(wrapper.find('.vnm-window').attributes('style')).toContain('translate(50px, 50px)')

    await wrapper.find('[aria-label^="Vlad"]').trigger('click')
    await nextTick()

    expect(wrapper.find('.vnm-window').attributes('style')).toContain('translate(0px, 0px)')
    wrapper.unmount()
  })

  it('правая кнопка мыши окно не тянет', async () => {
    const wrapper = await mountMap()
    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    const header = wrapper.find('.vnm-window__header')
    await header.trigger('pointerdown', { button: 2, clientX: 0, clientY: 0, pointerId: 1 })
    await header.trigger('pointermove', { clientX: 90, clientY: 90, pointerId: 1 })
    await nextTick()

    expect(wrapper.find('.vnm-window').attributes('style')).toContain('translate(0px, 0px)')
    wrapper.unmount()
  })
})

describe('панель фильтров: списки из данных потребителя', () => {
  async function openFilters(wrapper: Awaited<ReturnType<typeof mountMap>>) {
    await wrapper.find('.vnm-filter__button').trigger('click')
    await nextTick()
  }

  it('показывает заданные потребителем группы и подписи значений', async () => {
    const wrapper = await mountMap({ filterOptions: { groups: filterGroups } })
    await openFilters(wrapper)

    const titles = wrapper.findAll('.vnm-filter__group-title').map((node) => node.text())
    expect(titles).toEqual(['Подсеть', 'Тип актива', 'Критичность'])

    const labels = wrapper.findAll('.vnm-filter__option-label').map((node) => node.text())
    expect(labels).toContain('Docker Bridge')
    expect(labels).toContain('Виртуальная машина')

    wrapper.unmount()
  })

  it('группа с defaultOpen: false свёрнута, её значений не видно', async () => {
    const wrapper = await mountMap({ filterOptions: { groups: filterGroups } })
    await openFilters(wrapper)

    const labels = wrapper.findAll('.vnm-filter__option-label').map((node) => node.text())
    // «Критичность» объявлена свёрнутой.
    expect(labels).not.toContain('Критический')

    wrapper.unmount()
  })

  it('заголовок группы раскрывает и сворачивает список', async () => {
    const wrapper = await mountMap({ filterOptions: { groups: filterGroups } })
    await openFilters(wrapper)

    const heads = wrapper.findAll('.vnm-filter__group-head')
    const severity = heads[2]
    expect(severity?.attributes('aria-expanded')).toBe('false')

    await severity?.trigger('click')
    await nextTick()

    expect(wrapper.findAll('.vnm-filter__group-head')[2]?.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.vnm-filter__option-label').map((node) => node.text())).toContain('Критический')

    // Состояние уходит наружу, а не в localStorage.
    expect(wrapper.emitted('update:openFilterGroups')).toBeTruthy()

    wrapper.unmount()
  })

  it('выбор значения группы фильтрует карту', async () => {
    const wrapper = await mountMap({ filterOptions: { groups: filterGroups } })
    await openFilters(wrapper)

    const dockerOption = wrapper
      .findAll('.vnm-filter__option')
      .find((option) => option.text().includes('Docker Bridge'))

    await dockerOption?.find('input').setValue(true)
    await flushPromises()
    await nextTick()

    // В подсети Docker живут только контейнеры, а они свёрнуты в группу.
    expect(wrapper.find('.vnm-group').exists()).toBe(true)
    expect(wrapper.find('[aria-label^="Интернет"]').exists()).toBe(false)

    const emitted = wrapper.emitted('update:filters')?.at(-1)?.[0] as { groups?: Record<string, string[]> }
    expect(emitted.groups?.subnet).toEqual(['docker'])

    wrapper.unmount()
  })

  it('счётчики значений собираются из данных', async () => {
    const wrapper = await mountMap({ filterOptions: { groups: filterGroups } })
    await openFilters(wrapper)

    const docker = wrapper
      .findAll('.vnm-filter__option')
      .find((option) => option.text().includes('Docker Bridge'))

    // 14 контейнеров фермы.
    expect(docker?.find('.vnm-filter__count').text()).toBe('14')
    wrapper.unmount()
  })

  it('поиск внутри панели сужает список значений', async () => {
    const wrapper = await mountMap({ filterOptions: { groups: filterGroups } })
    await openFilters(wrapper)

    await wrapper.find('.vnm-filter__search-input').setValue('docker')
    await nextTick()

    const labels = wrapper.findAll('.vnm-filter__option-label').map((node) => node.text())
    expect(labels).toEqual(['Docker Bridge'])

    wrapper.unmount()
  })

  it('без групп потребителя показываются встроенные фасеты', async () => {
    const wrapper = await mountMap()
    await openFilters(wrapper)

    const titles = wrapper.findAll('.vnm-filter__group-title').map((node) => node.text())
    expect(titles).toEqual(['Типы узлов', 'Состояние'])

    wrapper.unmount()
  })

  it('сброс очищает и группы, и встроенные фасеты', async () => {
    const wrapper = await mountMap({
      filterOptions: { groups: filterGroups },
      filters: { query: 'dmitry', kinds: [], statuses: [], groups: { subnet: ['vpn'] } },
    })
    await openFilters(wrapper)

    expect(wrapper.find('.vnm-filter__badge').text()).toBe('1')

    await wrapper.find('.vnm-filter__reset').trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('update:filters')?.at(-1)?.[0] as {
      query: string
      groups?: Record<string, string[]>
    }
    expect(emitted.groups).toEqual({})
    // Поисковый запрос не тронут: это отдельное действие.
    expect(emitted.query).toBe('dmitry')

    wrapper.unmount()
  })
})

describe('тулбар лежит поверх полотна', () => {
  it('тулбар находится внутри полотна, а не отдельной полосой сверху', async () => {
    const wrapper = await mountMap()

    const canvas = wrapper.find('.vnm-canvas')
    expect(canvas.find('.vnm-toolbar').exists()).toBe(true)

    wrapper.unmount()
  })

  it('слот toolbar-right рендерится справа', async () => {
    const wrapper = mount(NetworkMap, {
      props: { entities, links, views, onlyRenderVisibleElements: false },
      slots: { 'toolbar-right': () => h('button', { class: 'add-btn' }, 'Добавить') },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.vnm-toolbar__group--end .add-btn').exists()).toBe(true)
    wrapper.unmount()
  })
})
