// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import AssetMap from '../../src/components/AssetMap.vue'
import MiniMap from '../../src/components/MiniMap.vue'
import { resolveTheme } from '../../src/composables/useTheme'
import type { ThemeMode } from '../../src/types/theme'
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

/** Подменяет системную настройку темы. */
function stubPrefersDark(dark: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('тема переключается классом', () => {
  it('light и dark ставят соответствующий класс', async () => {
    const light = await mountMap({ theme: 'light' })
    expect(light.find('.vam-root').classes()).toContain('vam-theme-light')
    expect(light.find('.vam-root').classes()).not.toContain('vam-theme-dark')
    light.unmount()

    const dark = await mountMap({ theme: 'dark' })
    expect(dark.find('.vam-root').classes()).toContain('vam-theme-dark')
    dark.unmount()
  })

  it('без темы карта светлая', async () => {
    const wrapper = await mountMap()
    expect(wrapper.find('.vam-root').classes()).toContain('vam-theme-light')
    wrapper.unmount()
  })

  it('смена prop переключает класс на живом компоненте', async () => {
    const wrapper = await mountMap({ theme: 'light' })

    await wrapper.setProps({ theme: 'dark' })
    await nextTick()

    expect(wrapper.find('.vam-root').classes()).toContain('vam-theme-dark')
    expect(wrapper.find('.vam-root').classes()).not.toContain('vam-theme-light')

    wrapper.unmount()
  })
})

describe('resolveTheme и режим auto', () => {
  it('auto читает системную тёмную настройку', () => {
    stubPrefersDark(true)
    const theme = resolveTheme(ref<ThemeMode>('auto'))
    expect(theme.value).toBe('dark')
  })

  it('auto читает системную светлую настройку', () => {
    stubPrefersDark(false)
    const theme = resolveTheme(ref<ThemeMode>('auto'))
    expect(theme.value).toBe('light')
  })

  it('явная тема побеждает системную настройку', () => {
    stubPrefersDark(true)
    const mode = ref<ThemeMode>('auto')
    const theme = resolveTheme(mode)

    expect(theme.value).toBe('dark')

    mode.value = 'light'
    expect(theme.value).toBe('light')
  })

  it('auto читает систему один раз и не следит за ней дальше', () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }))
    vi.stubGlobal('matchMedia', matchMedia)

    const theme = resolveTheme(ref<ThemeMode>('auto'))
    expect(theme.value).toBe('dark')
    expect(theme.value).toBe('dark')
    expect(theme.value).toBe('dark')

    // Ровно один запрос к системе: подписки на изменения нет, иначе системная
    // настройка перебивала бы явный выбор пользователя.
    expect(matchMedia).toHaveBeenCalledTimes(1)
  })

  it('возврат к auto отдаёт прочитанное при инициализации, не перечитывая систему', () => {
    stubPrefersDark(true)
    const mode = ref<ThemeMode>('auto')
    const theme = resolveTheme(mode)
    expect(theme.value).toBe('dark')

    mode.value = 'light'
    expect(theme.value).toBe('light')

    // Системная настройка сменилась, но `auto` уже зафиксировал своё значение:
    // подписки на систему нет по построению.
    stubPrefersDark(false)
    mode.value = 'auto'
    expect(theme.value).toBe('dark')
  })

  it('при theme: light к matchMedia не обращаемся вовсе', () => {
    const matchMedia = vi.fn(() => ({ matches: true }))
    vi.stubGlobal('matchMedia', matchMedia)

    const theme = resolveTheme(ref<ThemeMode>('light'))
    expect(theme.value).toBe('light')
    expect(matchMedia).not.toHaveBeenCalled()
  })

  it('без matchMedia auto не падает, а считает тему светлой', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(resolveTheme(ref<ThemeMode>('auto')).value).toBe('light')
  })

  it('карта в режиме auto ставит класс по системной настройке', async () => {
    stubPrefersDark(true)
    const wrapper = await mountMap({ theme: 'auto' })

    expect(wrapper.find('.vam-root').classes()).toContain('vam-theme-dark')
    wrapper.unmount()
  })
})

describe('LOD: упрощённый рендер на мелком масштабе', () => {
  it('при zoom ниже порога узлы рисуются упрощённо', async () => {
    const wrapper = await mountMap({ viewport: { x: 0, y: 0, zoom: 0.3 } })
    await flushPromises()
    await nextTick()

    const simplified = wrapper.findAll('.vam-node--simplified')
    expect(simplified.length).toBeGreaterThan(0)

    wrapper.unmount()
  })

  it('при обычном масштабе упрощения нет', async () => {
    const wrapper = await mountMap({ viewport: { x: 0, y: 0, zoom: 1 } })

    expect(wrapper.findAll('.vam-node--simplified')).toHaveLength(0)
    wrapper.unmount()
  })

  it('свой порог lodThreshold уважается', async () => {
    const wrapper = await mountMap({ viewport: { x: 0, y: 0, zoom: 0.9 }, lodThreshold: 1.5 })
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vam-node--simplified').length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('упрощённый узел скрывает подписи и бейджи', async () => {
    const wrapper = await mountMap({
      view: 'logical',
      viewport: { x: 0, y: 0, zoom: 0.3 },
    })
    await flushPromises()
    await nextTick()

    const node = wrapper.find('[aria-label^="Tailscale VPS"]')
    expect(node.classes()).toContain('vam-node--simplified')
    expect(node.find('.vam-node__sublabels').exists()).toBe(false)
    expect(node.find('.vam-node__badges').exists()).toBe(false)

    wrapper.unmount()
  })
})

describe('обзорная карта', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0, width: 100, height: 50 },
    { id: 'b', x: 400, y: 300, width: 100, height: 50 },
  ]
  const viewport = { x: 0, y: 0, zoom: 1 }
  const canvas = { width: 800, height: 600 }

  it('рисует прямоугольник на каждый узел плюс рамку вьюпорта', () => {
    const wrapper = mount(MiniMap, { props: { nodes, viewport, canvas } })

    expect(wrapper.findAll('.vam-minimap__node')).toHaveLength(2)
    expect(wrapper.find('.vam-minimap__viewport').exists()).toBe(true)

    wrapper.unmount()
  })

  it('подписана строкой из локали', () => {
    const wrapper = mount(MiniMap, { props: { nodes, viewport, canvas } })
    expect(wrapper.attributes('aria-label')).toBe('Обзорная карта')
    wrapper.unmount()
  })

  it('совпадения и выделение помечены отдельными классами', () => {
    const wrapper = mount(MiniMap, {
      props: {
        nodes: [
          { ...nodes[0]!, matched: true },
          { ...nodes[1]!, selected: true },
        ],
        viewport,
        canvas,
      },
    })

    expect(wrapper.findAll('.vam-minimap__node--matched')).toHaveLength(1)
    expect(wrapper.findAll('.vam-minimap__node--selected')).toHaveLength(1)

    wrapper.unmount()
  })

  it('пустой граф не ломает viewBox', () => {
    const wrapper = mount(MiniMap, { props: { nodes: [], viewport, canvas } })

    const viewBox = wrapper.attributes('viewBox') ?? wrapper.attributes('viewbox') ?? ''
    expect(viewBox.split(' ').every((value) => Number.isFinite(Number(value)))).toBe(true)

    wrapper.unmount()
  })

  it('нулевой zoom не даёт деления на ноль', () => {
    const wrapper = mount(MiniMap, { props: { nodes, viewport: { x: 0, y: 0, zoom: 0 }, canvas } })

    const rect = wrapper.find('.vam-minimap__viewport')
    expect(Number(rect.attributes('width'))).toBeGreaterThan(0)

    wrapper.unmount()
  })

  it('showMinimap управляет её показом в карте', async () => {
    const without = await mountMap()
    expect(without.find('.vam-minimap').exists()).toBe(false)
    without.unmount()

    const withMinimap = await mountMap({ showMinimap: true })
    expect(withMinimap.find('.vam-minimap').exists()).toBe(true)
    withMinimap.unmount()
  })
})
