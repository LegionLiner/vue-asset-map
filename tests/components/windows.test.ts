// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import NetworkMap from '../../src/components/NetworkMap.vue'
import MapWindow from '../../src/components/MapWindow.vue'
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

/** Кликает по узлу с указанной подписью. */
async function clickNode(
  wrapper: Awaited<ReturnType<typeof mountMap>>,
  label: string,
  options: { ctrl?: boolean } = {},
) {
  await wrapper.find(`[aria-label^="${label}"]`).trigger('click', { ctrlKey: options.ctrl === true })
  await flushPromises()
  await nextTick()
}

describe('несколько окон подробностей', () => {
  it('по умолчанию открыто одно окно: новый узел заменяет предыдущее', async () => {
    const wrapper = await mountMap()

    await clickNode(wrapper, 'Dmitry')
    expect(wrapper.findAll('.vnm-window')).toHaveLength(1)

    await clickNode(wrapper, 'Vlad')
    const windows = wrapper.findAll('.vnm-window')
    expect(windows).toHaveLength(1)
    expect(windows[0]?.text()).toContain('Vlad')

    wrapper.unmount()
  })

  it('maxDetailsWindows позволяет держать несколько окон сразу', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 3 })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad', { ctrl: true })
    await clickNode(wrapper, 'Andrey', { ctrl: true })

    const windows = wrapper.findAll('.vnm-window')
    expect(windows).toHaveLength(3)
    expect(wrapper.text()).toContain('Dmitry')
    expect(wrapper.text()).toContain('Vlad')
    expect(wrapper.text()).toContain('Andrey')

    wrapper.unmount()
  })

  it('при достижении лимита закрывается самое старое окно', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 2 })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad', { ctrl: true })
    await clickNode(wrapper, 'Andrey', { ctrl: true })

    expect(wrapper.findAll('.vnm-window')).toHaveLength(2)
    // Самый старый узел уступил место новому.
    expect(wrapper.emitted('update:openDetails')?.at(-1)?.[0]).toEqual(['ws-vlad', 'ws-andrey'])
    expect(wrapper.text()).not.toContain('Fedora 41')

    wrapper.unmount()
  })

  it('повторный клик по узлу не открывает второе окно, а поднимает его наверх', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 3 })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad', { ctrl: true })
    await clickNode(wrapper, 'Dmitry', { ctrl: true })

    expect(wrapper.findAll('.vnm-window')).toHaveLength(2)
    expect(wrapper.emitted('update:openDetails')?.at(-1)?.[0]).toEqual(['ws-vlad', 'ws-dmitry'])

    wrapper.unmount()
  })

  it('окна не ложатся ровно друг на друга', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 2 })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad', { ctrl: true })

    const styles = wrapper.findAll('.vnm-window').map((node) => node.attributes('style') ?? '')
    expect(styles[0]).toContain('translate(0px, 0px)')
    expect(styles[1]).toContain('translate(-24px, 24px)')

    wrapper.unmount()
  })

  it('каждое окно сворачивается и закрывается независимо', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 2 })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad', { ctrl: true })

    // Сворачиваем второе окно — первое остаётся раскрытым.
    const second = wrapper.findAll('.vnm-window')[1]
    await second?.findAll('.vnm-window__button')[1]?.trigger('click')
    await nextTick()

    const windows = wrapper.findAll('.vnm-window')
    expect(windows[0]?.classes()).not.toContain('vnm-window--collapsed')
    expect(windows[1]?.classes()).toContain('vnm-window--collapsed')
    // Свёрнутое окно осталось открытым: его не пришлось закрывать.
    expect(windows).toHaveLength(2)

    await windows[0]?.findAll('.vnm-window__button')[0]?.trigger('click')
    await nextTick()

    expect(wrapper.findAll('.vnm-window')).toHaveLength(1)
    wrapper.unmount()
  })

  it('Escape закрывает по одному окну, начиная с верхнего', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 3 })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad', { ctrl: true })

    await wrapper.find('.vnm-root').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.findAll('.vnm-window')).toHaveLength(1)
    expect(wrapper.find('.vnm-window').text()).toContain('Dmitry')

    await wrapper.find('.vnm-root').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.findAll('.vnm-window')).toHaveLength(0)

    wrapper.unmount()
  })

  it('maxDetailsWindows: 0 не открывает окна вовсе', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 0 })

    await clickNode(wrapper, 'Dmitry')

    expect(wrapper.findAll('.vnm-window')).toHaveLength(0)
    // Выделение при этом работает.
    expect(wrapper.find('[aria-label^="Dmitry"]').classes()).toContain('vnm-node--selected')

    wrapper.unmount()
  })

  it('клик по групповому узлу окно не открывает: у группы нет сущности', async () => {
    const wrapper = await mountMap()

    await wrapper.find('.vnm-group').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vnm-window')).toHaveLength(0)
    wrapper.unmount()
  })

  it('v-model:openDetails управляет окнами снаружи', async () => {
    const wrapper = await mountMap({
      maxDetailsWindows: 2,
      openDetails: ['ws-vlad', 'keenetic-1'],
    })

    expect(wrapper.findAll('.vnm-window')).toHaveLength(2)

    await wrapper.setProps({ openDetails: [] })
    await nextTick()
    expect(wrapper.findAll('.vnm-window')).toHaveLength(0)

    wrapper.unmount()
  })
})

describe('MapWindow: каркас для своих окон', () => {
  it('окно только из шапки не имеет тела', () => {
    const wrapper = mount(MapWindow, {
      props: { headerOnly: true, title: 'История' },
      attachTo: document.body,
    })

    expect(wrapper.find('.vnm-window__body').exists()).toBe(false)
    expect(wrapper.classes()).toContain('vnm-window--header-only')
    expect(wrapper.text()).toContain('История')

    wrapper.unmount()
  })

  it('closable: false убирает кнопку закрытия', () => {
    const wrapper = mount(MapWindow, { props: { closable: false, collapsible: false } })

    expect(wrapper.findAll('.vnm-window__button')).toHaveLength(0)
    wrapper.unmount()
  })

  it('ручка перетаскивания подписана из локали', () => {
    const wrapper = mount(MapWindow, { props: { dragHandle: true } })

    expect(wrapper.find('.vnm-window__grip').attributes('aria-label')).toBe('Перетащить окно')
    wrapper.unmount()
  })

  it('слот шапки получает состояние сжатия', async () => {
    const wrapper = mount(MapWindow, {
      slots: {
        header: (props: { collapsed: boolean }) =>
          h('span', { class: 'own-head' }, props.collapsed ? 'сжато' : 'раскрыто'),
      },
      attachTo: document.body,
    })

    expect(wrapper.find('.own-head').text()).toBe('раскрыто')

    await wrapper.findAll('.vnm-window__button')[1]?.trigger('click')
    await nextTick()

    expect(wrapper.find('.own-head').text()).toBe('сжато')
    expect(wrapper.emitted('collapse-change')?.at(-1)?.[0]).toBe(true)

    wrapper.unmount()
  })

  it('своя подпись кнопок перекрывает локаль', () => {
    const wrapper = mount(MapWindow, { props: { closeLabel: 'Убрать' } })

    expect(wrapper.findAll('.vnm-window__button')[0]?.attributes('aria-label')).toBe('Убрать')
    wrapper.unmount()
  })

  it('позиционирование задаёт вызывающая сторона, перетаскивание его не ломает', async () => {
    const wrapper = mount(MapWindow, {
      props: { headerOnly: true, dragHandle: true },
      attrs: { style: 'top: 12px; right: 12px' },
      attachTo: document.body,
    })

    const style = wrapper.attributes('style') ?? ''
    expect(style).toContain('top: 12px')
    expect(style).toContain('right: 12px')
    expect(style).toContain('translate(0px, 0px)')

    wrapper.unmount()
  })
})

describe('свои окна через слот #windows', () => {
  it('слот рендерится поверх окон подробностей', async () => {
    const wrapper = await mountMap({}, { windows: () => h('div', { class: 'own-window' }, 'история') })

    expect(wrapper.find('.vnm-windows .own-window').exists()).toBe(true)
    wrapper.unmount()
  })

  it('своё окно живёт независимо от окон подробностей', async () => {
    const wrapper = await mountMap(
      {},
      { windows: () => h(MapWindow, { headerOnly: true, closable: false, title: 'История' }) },
    )

    await clickNode(wrapper, 'Dmitry')
    // Два окна: подробности и своё. Своё закрыть нельзя — у него нет кнопки.
    expect(wrapper.findAll('.vnm-window')).toHaveLength(2)

    await wrapper.find('.vnm-root').trigger('keydown', { key: 'Escape' })
    await nextTick()

    // Escape убрал только окно подробностей.
    const remaining = wrapper.findAll('.vnm-window')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.text()).toContain('История')

    wrapper.unmount()
  })
})
