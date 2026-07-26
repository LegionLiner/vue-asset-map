// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import AssetMap from '../../src/components/AssetMap.vue'
import type { AssetMapSlots, NodeSlotProps } from '../../src/types/props'
import type { AssetEntity } from '../../src/types/entity'
import { entities, links, statusColors, views } from '../../fixtures/infra'

async function mountMap(props: Record<string, unknown> = {}, slots: AssetMapSlots = {}) {
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
    slots,
    attachTo: document.body,
  })

  await flushPromises()
  await nextTick()
  await flushPromises()
  return wrapper
}

/** Открывает окно подробностей кликом по узлу. */
async function openPanel(wrapper: Awaited<ReturnType<typeof mountMap>>, label: string) {
  await wrapper.find(`[aria-label^="${label}"]`).trigger('click')
  await nextTick()
  return wrapper.find('.vam-window')
}

describe('оформление узла: любую часть можно убрать', () => {
  it('showNodeStatus: false убирает плашку состояния', async () => {
    const wrapper = await mountMap({ showNodeStatus: false })
    const node = wrapper.find('[aria-label^="Tailscale VPS"]')

    expect(node.find('.vam-node__status').exists()).toBe(false)
    // Круг и подписи на месте: выключен именно индикатор.
    expect(node.find('.vam-node__circle').exists()).toBe(true)
    expect(node.find('.vam-node__label').exists()).toBe(true)

    wrapper.unmount()
  })

  it('состояние остаётся в данных: убрана только его отрисовка', async () => {
    const wrapper = await mountMap({ showNodeStatus: false })
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    // Окно подробностей о состоянии по-прежнему знает.
    expect(panel.text()).toContain('online')

    wrapper.unmount()
  })

  it('showNodeToggle: false убирает кнопку свёртки', async () => {
    const wrapper = await mountMap({ showNodeToggle: false })

    expect(wrapper.find('.vam-node__toggle').exists()).toBe(false)
    wrapper.unmount()
  })

  it('showNodeLabel: false оставляет от узла один круг', async () => {
    const wrapper = await mountMap({ showNodeLabel: false })
    const node = wrapper.find('[aria-label^="Tailscale VPS"]')

    expect(node.find('.vam-node__info').exists()).toBe(false)
    expect(node.find('.vam-node__circle').exists()).toBe(true)

    wrapper.unmount()
  })

  it('#node-status подменяет индикатор своим', async () => {
    const wrapper = await mountMap(
      {},
      {
        'node-status': (props: NodeSlotProps) =>
          h('i', { class: 'own-status' }, `${props.status}/${props.statusColor}`),
      },
    )

    const node = wrapper.find('[aria-label^="Tailscale VPS"]')
    expect(node.find('.vam-node__status').exists()).toBe(false)
    expect(node.find('.own-status').text()).toBe(`online/${statusColors.online}`)

    wrapper.unmount()
  })

  it('#node-label подменяет всю плашку подписей', async () => {
    const wrapper = await mountMap(
      { view: 'logical' },
      {
        'node-label': (props: NodeSlotProps) =>
          h('div', { class: 'own-label' }, `${props.entity?.label}: ${props.sublabels?.join('|')}`),
      },
    )

    const node = wrapper.find('[aria-label^="Tailscale VPS"]')
    expect(node.find('.vam-node__info').exists()).toBe(false)
    expect(node.find('.own-label').text()).toBe('Tailscale VPS: 46.8.158.127|100.64.0.2')

    wrapper.unmount()
  })

  it('слоты узла получают nodeId, а не node-id', async () => {
    // Слот вызывается как функциональный компонент без объявленных пропов, а
    // значит получает имена атрибутов как есть: `:node-id="id"` в шаблоне пришёл
    // бы как `node-id`, и обещанный типом `nodeId` был бы всегда undefined.
    const keys: Record<string, string[]> = {}
    const capture =
      (name: string) =>
      (props: NodeSlotProps): unknown => {
        keys[name] = Object.keys(props)
        return h('i', { class: `own-${name}` })
      }

    const wrapper = await mountMap(
      {},
      {
        'node-vps': capture('kind'),
        'node-label': capture('label'),
        'node-status': capture('status'),
      },
    )

    expect(keys.kind).toEqual(['entity', 'nodeId', 'simplified'])
    expect(keys.label).toEqual(['entity', 'nodeId', 'simplified', 'sublabels'])
    expect(keys.status).toEqual(['entity', 'nodeId', 'simplified', 'status', 'statusColor'])

    wrapper.unmount()
  })

  it('showNodeStatus: false доходит и до своего слота', async () => {
    // Выключатель главнее слота: иначе «убрать индикатор» пришлось бы делать
    // дважды — и пропом, и пустым слотом.
    const wrapper = await mountMap(
      { showNodeStatus: false },
      { 'node-status': () => h('i', { class: 'own-status' }) },
    )

    expect(wrapper.find('.own-status').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('подписи под кругом: их столько, сколько в данных', () => {
  /** Узел с четырьмя подписями: встроенного предела в три строки нет. */
  const many: AssetEntity[] = [
    {
      id: 'host',
      type: 'vps',
      label: 'Хост',
      parentId: null,
      sublabels: ['10.0.0.1', '10.0.0.2', 'host.example', 'fe80::1'],
    },
  ]

  async function mountMany(props: Record<string, unknown> = {}) {
    return mountMap({ entities: many, links: [], views: undefined, ...props })
  }

  function sublabelCount(wrapper: Awaited<ReturnType<typeof mountMap>>): number {
    const node = wrapper.find('[aria-label^="Хост"]')
    return node.findAll('.vam-node__sublabel').length + node.findAll('.vam-node__sublabel-overlay').length
  }

  it('четыре подписи рисуются все четыре', async () => {
    const wrapper = await mountMany()

    expect(sublabelCount(wrapper)).toBe(4)
    wrapper.unmount()
  })

  it('maxSublabels обрезает список', async () => {
    const wrapper = await mountMany({ maxSublabels: 2 })
    const node = wrapper.find('[aria-label^="Хост"]')

    expect(sublabelCount(wrapper)).toBe(2)
    // Обрезаются хвостовые: первые — самые важные.
    expect(node.find('.vam-node__sublabel').text()).toBe('10.0.0.1')

    wrapper.unmount()
  })

  it('maxSublabels: 0 убирает подписи, оставляя имя', async () => {
    const wrapper = await mountMany({ maxSublabels: 0 })
    const node = wrapper.find('[aria-label^="Хост"]')

    expect(sublabelCount(wrapper)).toBe(0)
    expect(node.find('.vam-node__label').text()).toBe('Хост')

    wrapper.unmount()
  })

  it('вид без подписей главнее maxSublabels', async () => {
    const wrapper = await mountMap({ view: 'physical' })

    // В физическом виде подписи выключены самим видом.
    expect(wrapper.find('[aria-label^="Tailscale VPS"]').find('.vam-node__sublabel').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('окно подробностей: своё оформление ниже шапки', () => {
  it('detailsTitle строкой меняет подпись в шапке', async () => {
    const wrapper = await mountMap({ detailsTitle: 'Карточка актива' })
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vam-window__caption').text()).toBe('Карточка актива')
    wrapper.unmount()
  })

  it('detailsTitle функцией получает сущность', async () => {
    const wrapper = await mountMap({
      detailsTitle: (entity: AssetEntity) => `${entity.type.toUpperCase()} · ${entity.label}`,
    })
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vam-window__caption').text()).toBe('VPS · Tailscale VPS')
    wrapper.unmount()
  })

  it('без detailsTitle подпись — имя сущности', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vam-window__caption').text()).toBe('Tailscale VPS')
    wrapper.unmount()
  })

  it('#details-title подменяет подпись разметкой', async () => {
    const wrapper = await mountMap(
      {},
      { 'details-title': ({ entity }) => h('b', { class: 'own-title' }, entity.id) },
    )
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vam-window__caption .own-title').text()).toBe('vps-tailscale')
    wrapper.unmount()
  })

  it('showDetailsHeading: false убирает заголовочный блок', async () => {
    const wrapper = await mountMap({ showDetailsHeading: false })
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vam-window__heading').exists()).toBe(false)
    // Шапка окна при этом остаётся: её потребитель менять не просил.
    expect(panel.find('.vam-window__header').exists()).toBe(true)

    wrapper.unmount()
  })

  it('detailsTabs: false убирает полосу вкладок', async () => {
    const wrapper = await mountMap({ detailsTabs: false })
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vam-window__tabs').exists()).toBe(false)
    // Тело осталось встроенным: вкладки убраны, а не подменены.
    expect(panel.text()).toContain('vps')

    wrapper.unmount()
  })

  it('без detailsTabs остаются две встроенные вкладки', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.findAll('.vam-window__tab')).toHaveLength(2)
    wrapper.unmount()
  })

  it('свои вкладки заменяют встроенные, первая открыта сразу', async () => {
    const wrapper = await mountMap(
      {
        detailsTabs: [
          { id: 'risk', label: 'Риски' },
          { id: 'audit', label: 'Аудит' },
        ],
      },
      { details: ({ tab }) => h('div', { class: 'own-body' }, tab) },
    )
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    const tabs = panel.findAll('.vam-window__tab')
    expect(tabs.map((tab) => tab.text())).toEqual(['Риски', 'Аудит'])
    expect(panel.find('.own-body').text()).toBe('risk')

    await tabs[1]?.trigger('click')
    await nextTick()
    expect(panel.find('.own-body').text()).toBe('audit')

    wrapper.unmount()
  })

  it('под своей вкладкой пакет своего тела не подставляет', async () => {
    // Без слота `#details` содержимое чужой вкладки взять негде: показывать под
    // «Рисками» встроенный список связей было бы прямой ложью.
    const wrapper = await mountMap({ detailsTabs: [{ id: 'risk', label: 'Риски' }] })
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vam-window__content').text()).toBe('')
    wrapper.unmount()
  })

  it('#details-tabs подменяет полосу вкладок целиком', async () => {
    const wrapper = await mountMap(
      { detailsTabs: [{ id: 'risk', label: 'Риски' }] },
      {
        'details-tabs': ({ tabs, active, select }) =>
          h(
            'nav',
            { class: 'own-tabs' },
            tabs.map((tab) =>
              h(
                'button',
                { class: tab.id === active ? 'on' : 'off', onClick: () => select(tab.id) },
                tab.label,
              ),
            ),
          ),
      },
    )
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vam-window__tabs').exists()).toBe(false)
    expect(panel.find('.own-tabs .on').text()).toBe('Риски')

    wrapper.unmount()
  })

  it('всё разом: от оформления пакета остаётся только шапка', async () => {
    const wrapper = await mountMap(
      {
        detailsTitle: 'Свой заголовок',
        showDetailsHeading: false,
        detailsTabs: [{ id: 'one', label: 'Раз' }],
      },
      {
        'details-tabs': () => h('nav', { class: 'own-tabs' }),
        details: () => h('div', { class: 'own-body' }, 'своё'),
      },
    )
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vam-window__header').exists()).toBe(true)
    expect(panel.find('.vam-window__heading').exists()).toBe(false)
    expect(panel.find('.vam-window__tabs').exists()).toBe(false)
    expect(panel.find('.own-tabs').exists()).toBe(true)
    expect(panel.find('.own-body').text()).toBe('своё')

    wrapper.unmount()
  })
})
