// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import NetworkMap from '../../src/components/NetworkMap.vue'
import type { NetworkMapSlots } from '../../src/types/props'
import { entities, links, statusColors, views } from '../../fixtures/infra'

async function mountMap(props: Record<string, unknown> = {}, slots: NetworkMapSlots = {}) {
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
    slots,
    attachTo: document.body,
  })

  await flushPromises()
  await nextTick()
  await flushPromises()
  return wrapper
}

/** Открывает панель кликом по узлу. */
async function openPanel(wrapper: Awaited<ReturnType<typeof mountMap>>, label: string) {
  await wrapper.find(`[aria-label^="${label}"]`).trigger('click')
  await nextTick()
  return wrapper.find('.vnm-window')
}

describe('панель подробностей: каркас от пакета', () => {
  it('шапка показывает имя и тип, а не содержимое meta', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    expect(panel.find('.vnm-window__title').text()).toBe('Tailscale VPS')
    expect(panel.find('.vnm-window__kind').text()).toBe('vps')

    wrapper.unmount()
  })

  it('кнопка закрытия подписана строкой из локали', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Dmitry')

    expect(panel.findAll('.vnm-window__button')[0]!.attributes('aria-label')).toBe('Закрыть панель')

    const english = await mountMap({ locale: 'en' })
    const englishPanel = await openPanel(english, 'Dmitry')
    expect(englishPanel.findAll('.vnm-window__button')[0]!.attributes('aria-label')).toBe('Close panel')

    wrapper.unmount()
    english.unmount()
  })

  it('индикатор состояния окрашен через themeConfig.statusColors', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Vlad')

    expect(panel.find('.vnm-window__status').attributes('style')).toContain('var(--vnm-status-offline)')

    wrapper.unmount()
  })

  it('табы объявлены как tablist и переключаются', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Keenetic 2')

    const tabs = panel.findAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]?.attributes('aria-selected')).toBe('true')
    expect(tabs[1]?.attributes('aria-selected')).toBe('false')

    await tabs[1]?.trigger('click')
    await nextTick()

    expect(panel.findAll('[role="tab"]')[1]?.attributes('aria-selected')).toBe('true')

    wrapper.unmount()
  })

  it('смена узла возвращает панель на первый таб', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Keenetic 2')

    await panel.findAll('[role="tab"]')[1]?.trigger('click')
    await nextTick()
    expect(panel.findAll('[role="tab"]')[1]?.attributes('aria-selected')).toBe('true')

    await openPanel(wrapper, 'Keenetic 1')
    expect(wrapper.find('.vnm-window').findAll('[role="tab"]')[0]?.attributes('aria-selected')).toBe('true')

    wrapper.unmount()
  })
})

describe('панель подробностей: fallback-содержимое', () => {
  it('показывает плоский список полей meta', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Tailscale VPS')

    // Ключи — как в данных потребителя: пакет их не переименовывает.
    expect(panel.text()).toContain('externalIp')
    expect(panel.text()).toContain('46.8.158.127')
    expect(panel.text()).toContain('Debian 12')

    wrapper.unmount()
  })

  it('массивы в meta выводятся списком через запятую', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Cloudflare')

    expect(panel.text()).toContain('cdn, dns')
    wrapper.unmount()
  })

  it('узел без meta показывает пустую секцию, а не пропадает', async () => {
    const wrapper = await mountMap({
      entities: [{ id: 'bare', kind: 'host', label: 'Без метаданных' }],
      links: [],
      views: undefined,
    })

    const panel = await openPanel(wrapper, 'Без метаданных')
    expect(panel.find('.vnm-section__empty').exists()).toBe(true)

    wrapper.unmount()
  })

  it('таб связей перечисляет инцидентные рёбра', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Keenetic 1')

    await panel.findAll('[role="tab"]')[1]?.trigger('click')
    await nextTick()

    const text = wrapper.find('.vnm-window__content').text()
    expect(text).toContain('Интернет')
    expect(text).toContain('Proxmox Artjom home')

    wrapper.unmount()
  })

  it('адреса выводятся отдельной секцией', async () => {
    const wrapper = await mountMap()
    const panel = await openPanel(wrapper, 'Andrey')

    expect(panel.text()).toContain('10.38.24.74')
    expect(panel.text()).toContain('100.64.0.74')

    wrapper.unmount()
  })
})

describe('панель подробностей: слоты потребителя', () => {
  it('#details наполняет содержимое, шапка остаётся от пакета', async () => {
    const wrapper = await mountMap(
      {},
      {
        details: (props) => h('div', { class: 'own-body' }, `body:${props.entity.id}:${props.tab}`),
      },
    )

    const panel = await openPanel(wrapper, 'Dmitry')

    expect(panel.find('.own-body').text()).toBe('body:ws-dmitry:overview')
    // Шапка и табы — часть каркаса, их слот не отменяет.
    expect(panel.find('.vnm-window__title').text()).toBe('Dmitry')
    expect(panel.findAll('[role="tab"]')).toHaveLength(2)
    // Fallback-список meta заменён полностью.
    expect(panel.text()).not.toContain('overlayIp')

    wrapper.unmount()
  })

  it('#details получает активный таб и реагирует на переключение', async () => {
    const wrapper = await mountMap({}, { details: (props) => h('div', { class: 'own-body' }, props.tab) })

    const panel = await openPanel(wrapper, 'Dmitry')
    expect(panel.find('.own-body').text()).toBe('overview')

    await panel.findAll('[role="tab"]')[1]?.trigger('click')
    await nextTick()

    expect(wrapper.find('.own-body').text()).toBe('links')
    wrapper.unmount()
  })

  it('#details-header подменяет шапку, кнопка закрытия остаётся', async () => {
    const wrapper = await mountMap(
      {},
      {
        'details-header': (props) => h('div', { class: 'own-head' }, `H:${props.entity.label}`),
      },
    )

    const panel = await openPanel(wrapper, 'Vlad')

    expect(panel.find('.own-head').text()).toBe('H:Vlad')
    expect(panel.find('.vnm-window__title').exists()).toBe(false)
    expect(panel.findAll('.vnm-window__button')[0]!.exists()).toBe(true)

    wrapper.unmount()
  })

  it('close из слота закрывает панель', async () => {
    const wrapper = await mountMap(
      {},
      {
        details: (props) => h('button', { class: 'own-close', onClick: props.close }, 'x'),
      },
    )

    await openPanel(wrapper, 'Vlad')
    await wrapper.find('.own-close').trigger('click')
    await nextTick()

    expect(wrapper.find('.vnm-window').exists()).toBe(false)
    wrapper.unmount()
  })
})
