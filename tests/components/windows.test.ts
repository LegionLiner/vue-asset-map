// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import AssetMap from '../../src/components/AssetMap.vue'
import MapWindow from '../../src/components/MapWindow.vue'
import type { AssetMapSlots } from '../../src/types/props'
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

/** Кликает по узлу с указанной подписью. */
async function clickNode(
  wrapper: Awaited<ReturnType<typeof mountMap>>,
  label: string,
  options: { ctrl?: boolean; shift?: boolean } = {},
) {
  await wrapper.find(`[aria-label^="${label}"]`).trigger('click', {
    ctrlKey: options.ctrl === true,
    shiftKey: options.shift === true,
  })
  await flushPromises()
  await nextTick()
}

describe('несколько окон подробностей', () => {
  it('по умолчанию клик заменяет содержимое окна, а не открывает второе', async () => {
    // Кликая по карте, читают по узлу за раз: если каждый клик открывал бы ещё
    // одно окно, к третьему узлу карту было бы уже не видно.
    const wrapper = await mountMap()

    await clickNode(wrapper, 'Dmitry')
    expect(wrapper.findAll('.vam-window')).toHaveLength(1)

    await clickNode(wrapper, 'Vlad')

    const windows = wrapper.findAll('.vam-window')
    expect(windows).toHaveLength(1)
    expect(windows[0]?.text()).toContain('Vlad')
    expect(wrapper.emitted('update:openDetails')?.at(-1)?.[0]).toEqual(['ws-vlad'])

    wrapper.unmount()
  })

  it('detailsMode: stack возвращает прежнее накопление окон', async () => {
    const wrapper = await mountMap({ detailsMode: 'stack' })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad')

    expect(wrapper.findAll('.vam-window')).toHaveLength(2)
    wrapper.unmount()
  })

  it('повторный клик по уже открытому узлу окно не дёргает', async () => {
    // Переприсваивание сбросило бы окну позицию, в которую его перетащили.
    const wrapper = await mountMap()

    await clickNode(wrapper, 'Dmitry')
    const before = wrapper.emitted('update:openDetails')?.length ?? 0

    await clickNode(wrapper, 'Dmitry')

    expect(wrapper.emitted('update:openDetails')?.length ?? 0).toBe(before)
    expect(wrapper.findAll('.vam-window')).toHaveLength(1)

    wrapper.unmount()
  })

  it('maxDetailsWindows: 1 возвращает поведение «одно окно на весь экран»', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 1 })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad')

    const windows = wrapper.findAll('.vam-window')
    expect(windows).toHaveLength(1)
    expect(windows[0]?.text()).toContain('Vlad')

    wrapper.unmount()
  })

  it('maxDetailsWindows позволяет держать несколько окон сразу', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 3, detailsMode: 'stack' })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad')
    await clickNode(wrapper, 'Andrey')

    const windows = wrapper.findAll('.vam-window')
    expect(windows).toHaveLength(3)
    expect(wrapper.text()).toContain('Dmitry')
    expect(wrapper.text()).toContain('Vlad')
    expect(wrapper.text()).toContain('Andrey')

    wrapper.unmount()
  })

  it('при достижении лимита закрывается самое старое окно', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 2, detailsMode: 'stack' })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad')
    await clickNode(wrapper, 'Andrey')

    expect(wrapper.findAll('.vam-window')).toHaveLength(2)
    // Самый старый узел уступил место новому.
    expect(wrapper.emitted('update:openDetails')?.at(-1)?.[0]).toEqual(['ws-vlad', 'ws-andrey'])
    expect(wrapper.text()).not.toContain('Fedora 41')

    wrapper.unmount()
  })

  it('повторный клик по узлу не открывает второе окно, а поднимает его наверх', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 3, detailsMode: 'stack' })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad')
    await clickNode(wrapper, 'Dmitry')

    expect(wrapper.findAll('.vam-window')).toHaveLength(2)
    expect(wrapper.emitted('update:openDetails')?.at(-1)?.[0]).toEqual(['ws-vlad', 'ws-dmitry'])

    wrapper.unmount()
  })

  it('окна не ложатся ровно друг на друга', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 2, detailsMode: 'stack' })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad')

    const styles = wrapper.findAll('.vam-window').map((node) => node.attributes('style') ?? '')
    expect(styles[0]).toContain('translate(0px, 0px)')
    expect(styles[1]).toContain('translate(-24px, 24px)')

    wrapper.unmount()
  })

  it('каждое окно сворачивается и закрывается независимо', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 2, detailsMode: 'stack' })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad')

    // Сворачиваем второе окно — первое остаётся раскрытым.
    const second = wrapper.findAll('.vam-window')[1]
    await second?.findAll('.vam-window__button')[1]?.trigger('click')
    await nextTick()

    const windows = wrapper.findAll('.vam-window')
    expect(windows[0]?.classes()).not.toContain('vam-window--collapsed')
    expect(windows[1]?.classes()).toContain('vam-window--collapsed')
    // Свёрнутое окно осталось открытым: его не пришлось закрывать.
    expect(windows).toHaveLength(2)

    await windows[0]?.findAll('.vam-window__button')[0]?.trigger('click')
    await nextTick()

    expect(wrapper.findAll('.vam-window')).toHaveLength(1)
    wrapper.unmount()
  })

  it('Escape закрывает по одному окну, начиная с верхнего', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 3, detailsMode: 'stack' })

    await clickNode(wrapper, 'Dmitry')
    await clickNode(wrapper, 'Vlad')

    await wrapper.find('.vam-root').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.findAll('.vam-window')).toHaveLength(1)
    expect(wrapper.find('.vam-window').text()).toContain('Dmitry')

    await wrapper.find('.vam-root').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.findAll('.vam-window')).toHaveLength(0)

    wrapper.unmount()
  })

  it('maxDetailsWindows: 0 не открывает окна вовсе', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 0 })

    await clickNode(wrapper, 'Dmitry')

    expect(wrapper.findAll('.vam-window')).toHaveLength(0)
    // Выделение при этом работает.
    expect(wrapper.find('[aria-label^="Dmitry"]').classes()).toContain('vam-node--selected')

    wrapper.unmount()
  })

  it('Shift+клик только выделяет и окно не открывает', async () => {
    // Модификатор — жест набора выделения: кто выбирает вторую точку для пути,
    // не хочет получить окно поверх карты на каждый узел, который тронул.
    const wrapper = await mountMap({ maxDetailsWindows: 3, detailsMode: 'stack' })

    await clickNode(wrapper, 'Dmitry', { shift: true })
    await clickNode(wrapper, 'Vlad', { shift: true })

    expect(wrapper.findAll('.vam-window')).toHaveLength(0)
    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual(['ws-dmitry', 'ws-vlad'])

    wrapper.unmount()
  })

  it('Ctrl+клик окно тоже не открывает', async () => {
    const wrapper = await mountMap({ maxDetailsWindows: 3, detailsMode: 'stack' })

    await clickNode(wrapper, 'Dmitry', { ctrl: true })

    expect(wrapper.findAll('.vam-window')).toHaveLength(0)
    expect(wrapper.find('[aria-label^="Dmitry"]').classes()).toContain('vam-node--selected')

    wrapper.unmount()
  })

  it('обычный клик после Shift+клика окно открывает', async () => {
    // Простой клик остаётся простым кликом: модификатор ничего не переключает
    // насовсем.
    const wrapper = await mountMap()

    await clickNode(wrapper, 'Dmitry', { shift: true })
    await clickNode(wrapper, 'Vlad')

    const windows = wrapper.findAll('.vam-window')
    expect(windows).toHaveLength(1)
    expect(windows[0]?.text()).toContain('Vlad')

    wrapper.unmount()
  })

  it('клик по групповому узлу окно не открывает: у группы нет сущности', async () => {
    const wrapper = await mountMap()

    await wrapper.find('.vam-group').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vam-window')).toHaveLength(0)
    wrapper.unmount()
  })

  it('v-model:openDetails управляет окнами снаружи', async () => {
    const wrapper = await mountMap({
      maxDetailsWindows: 2,
      openDetails: ['ws-vlad', 'keenetic-1'],
    })

    expect(wrapper.findAll('.vam-window')).toHaveLength(2)

    await wrapper.setProps({ openDetails: [] })
    await nextTick()
    expect(wrapper.findAll('.vam-window')).toHaveLength(0)

    wrapper.unmount()
  })
})

describe('MapWindow: каркас для своих окон', () => {
  it('окно только из шапки не имеет тела', () => {
    const wrapper = mount(MapWindow, {
      props: { headerOnly: true, title: 'История' },
      attachTo: document.body,
    })

    expect(wrapper.find('.vam-window__body').exists()).toBe(false)
    expect(wrapper.classes()).toContain('vam-window--header-only')
    expect(wrapper.text()).toContain('История')

    wrapper.unmount()
  })

  it('closable: false убирает кнопку закрытия', () => {
    const wrapper = mount(MapWindow, { props: { closable: false, collapsible: false } })

    expect(wrapper.findAll('.vam-window__button')).toHaveLength(0)
    wrapper.unmount()
  })

  it('ручка перетаскивания подписана из локали', () => {
    const wrapper = mount(MapWindow, { props: { dragHandle: true } })

    expect(wrapper.find('.vam-window__grip').attributes('aria-label')).toBe('Перетащить окно')
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

    await wrapper.findAll('.vam-window__button')[1]?.trigger('click')
    await nextTick()

    expect(wrapper.find('.own-head').text()).toBe('сжато')
    expect(wrapper.emitted('collapse-change')?.at(-1)?.[0]).toBe(true)

    wrapper.unmount()
  })

  it('своя подпись кнопок перекрывает локаль', () => {
    const wrapper = mount(MapWindow, { props: { closeLabel: 'Убрать' } })

    expect(wrapper.findAll('.vam-window__button')[0]?.attributes('aria-label')).toBe('Убрать')
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

describe('окна не перекрывают кнопки приложения в тулбаре', () => {
  it('без правого слота окна прижаты к верху полотна', async () => {
    const wrapper = await mountMap()

    // Токен не подменён — окна используют значение по умолчанию.
    expect(wrapper.find('.vam-canvas').attributes('style') ?? '').not.toContain('--vam-windows-top')

    wrapper.unmount()
  })

  it('с кнопкой в правом слоте окна опускаются под тулбар', async () => {
    const wrapper = await mountMap(
      {},
      { 'toolbar-right': () => h('button', { class: 'add-btn' }, 'Добавить') },
    )

    const style = wrapper.find('.vam-canvas').attributes('style') ?? ''
    expect(style).toContain('--vam-windows-top')
    expect(style).toContain('var(--vam-toolbar-height)')

    wrapper.unmount()
  })

  it('выключенный тулбар отступ не создаёт', async () => {
    const wrapper = await mountMap(
      { showToolbar: false },
      { 'toolbar-right': () => h('button', {}, 'Добавить') },
    )

    expect(wrapper.find('.vam-canvas').attributes('style') ?? '').not.toContain('--vam-windows-top')
    wrapper.unmount()
  })
})

describe('свои окна через слот #windows', () => {
  it('слот рендерится поверх окон подробностей', async () => {
    const wrapper = await mountMap({}, { windows: () => h('div', { class: 'own-window' }, 'история') })

    expect(wrapper.find('.vam-windows .own-window').exists()).toBe(true)
    wrapper.unmount()
  })

  it('своё окно живёт независимо от окон подробностей', async () => {
    const wrapper = await mountMap(
      {},
      { windows: () => h(MapWindow, { headerOnly: true, closable: false, title: 'История' }) },
    )

    await clickNode(wrapper, 'Dmitry')
    // Два окна: подробности и своё. Своё закрыть нельзя — у него нет кнопки.
    expect(wrapper.findAll('.vam-window')).toHaveLength(2)

    await wrapper.find('.vam-root').trigger('keydown', { key: 'Escape' })
    await nextTick()

    // Escape убрал только окно подробностей.
    const remaining = wrapper.findAll('.vam-window')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.text()).toContain('История')

    wrapper.unmount()
  })
})
