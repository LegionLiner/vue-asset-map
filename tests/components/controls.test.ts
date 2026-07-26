// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AssetMap from '../../src/components/AssetMap.vue'
import SearchInput from '../../src/components/controls/SearchInput.vue'
import ViewSwitcher from '../../src/components/controls/ViewSwitcher.vue'
import FilterMenu from '../../src/components/controls/FilterMenu.vue'
import type { FacetCounts, FilterState } from '../../src/types/filter'
import { entities, links, statusColors, views } from '../../fixtures/infra'

describe('SearchInput отдельно от карты', () => {
  it('работает вне <AssetMap> и берёт строки из встроенной локали', () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '' } })

    expect(wrapper.find('input').attributes('aria-label')).toBe('Поиск по карте')
    wrapper.unmount()
  })

  it('печать обновляет модель немедленно, без задержки', async () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '' } })

    await wrapper.find('input').setValue('10.38.24.*')

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('10.38.24.*')
    wrapper.unmount()
  })

  it('кнопка очистки появляется только при непустом запросе', async () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '' } })
    expect(wrapper.find('.vam-search__clear').exists()).toBe(false)

    await wrapper.setProps({ modelValue: 'dmitry' })
    expect(wrapper.find('.vam-search__clear').exists()).toBe(true)

    await wrapper.find('.vam-search__clear').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('')

    wrapper.unmount()
  })

  it('счётчик совпадений показывается в live-области', async () => {
    const wrapper = mount(SearchInput, { props: { modelValue: 'ws', resultCount: 5 } })

    const summary = wrapper.find('.vam-search__summary')
    expect(summary.text()).toBe('Найдено: 5')
    expect(summary.attributes('aria-live')).toBe('polite')

    await wrapper.setProps({ resultCount: 0 })
    expect(wrapper.find('.vam-search__summary').text()).toBe('Ничего не найдено')

    wrapper.unmount()
  })

  it('без запроса счётчик не показывается', () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '', resultCount: 0 } })
    expect(wrapper.find('.vam-search__summary').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('ViewSwitcher', () => {
  it('рисует кнопку на каждый вид и помечает активный', () => {
    const wrapper = mount(ViewSwitcher, { props: { views, modelValue: 'logical' } })

    const buttons = wrapper.findAll('.vam-views__button')
    // Подпись читаем из видимого элемента: рядом лежит невидимая жирная копия,
    // резервирующая ширину, и `button.text()` вернул бы текст дважды.
    expect(wrapper.findAll('.vam-views__label').map((node) => node.text())).toEqual([
      'Физическая топология',
      'VPN-оверлей',
    ])
    expect(buttons[1]?.attributes('aria-pressed')).toBe('true')
    expect(buttons[0]?.attributes('aria-pressed')).toBe('false')

    wrapper.unmount()
  })

  it('клик переключает вид', async () => {
    const wrapper = mount(ViewSwitcher, { props: { views, modelValue: 'physical' } })

    await wrapper.findAll('.vam-views__button')[1]?.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('logical')
    wrapper.unmount()
  })

  it('повторный клик по активному виду ничего не эмитит', async () => {
    const wrapper = mount(ViewSwitcher, { props: { views, modelValue: 'physical' } })

    await wrapper.findAll('.vam-views__button')[0]?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('без выбранного вида активен первый', () => {
    const wrapper = mount(ViewSwitcher, { props: { views, modelValue: undefined } })

    expect(wrapper.findAll('.vam-views__button')[0]?.attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('неизвестный id сводится к первому виду, как и в проекции', () => {
    const wrapper = mount(ViewSwitcher, { props: { views, modelValue: 'ghost' } })

    expect(wrapper.findAll('.vam-views__button')[0]?.attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })
})

/** Раскрывает панель фильтров: список значений спрятан за кнопкой. */
async function openFilters(wrapper: {
  find: (selector: string) => { trigger: (event: string) => Promise<void> }
}) {
  await wrapper.find('.vam-filter__button').trigger('click')
}

describe('FilterMenu', () => {
  const facets: FacetCounts = {
    types: new Map([
      ['router', 2],
      ['vps', 4],
    ]),
    statuses: new Map([['offline', 1]]),
    groups: new Map(),
  }

  const state = (partial: Partial<FilterState> = {}): FilterState => ({
    query: '',
    types: [],
    statuses: [],
    ...partial,
  })

  it('показывает значения фасетов со счётчиками', async () => {
    const wrapper = mount(FilterMenu, { props: { facets, modelValue: state() } })
    await openFilters(wrapper)

    const options = wrapper.findAll('.vam-filter__option')
    expect(options).toHaveLength(3)
    expect(options[0]?.text()).toContain('router')
    expect(options[0]?.text()).toContain('2')

    wrapper.unmount()
  })

  it('отметка фасета отдаёт новый объект состояния, не мутируя старый', async () => {
    const original = state()
    const wrapper = mount(FilterMenu, { props: { facets, modelValue: original } })
    await openFilters(wrapper)

    await wrapper.findAll('input[type="checkbox"]')[0]?.setValue(true)

    const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as FilterState
    expect(emitted.types).toEqual(['router'])
    // Исходный объект не тронут.
    expect(original.types).toEqual([])
    expect(emitted).not.toBe(original)

    wrapper.unmount()
  })

  it('повторная отметка снимает значение', async () => {
    const wrapper = mount(FilterMenu, {
      props: { facets, modelValue: state({ types: ['router'] }) },
    })
    await openFilters(wrapper)

    await wrapper.findAll('input[type="checkbox"]')[0]?.setValue(false)

    const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as FilterState
    expect(emitted.types).toEqual([])

    wrapper.unmount()
  })

  it('счётчик активных фильтров считает оба фасета', async () => {
    const wrapper = mount(FilterMenu, {
      props: { facets, modelValue: state({ types: ['router'], statuses: ['offline'] }) },
    })
    await openFilters(wrapper)

    expect(wrapper.find('.vam-filter__badge').text()).toBe('2')
    wrapper.unmount()
  })

  it('сброс очищает фасеты, но не поисковый запрос', async () => {
    const wrapper = mount(FilterMenu, {
      props: { facets, modelValue: state({ query: 'dmitry', types: ['router'] }) },
    })
    await openFilters(wrapper)

    await wrapper.find('.vam-filter__reset').trigger('click')

    const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as FilterState
    expect(emitted.types).toEqual([])
    expect(emitted.query).toBe('dmitry')

    wrapper.unmount()
  })

  it('кнопка сброса заблокирована, когда нечего сбрасывать', async () => {
    const wrapper = mount(FilterMenu, { props: { facets, modelValue: state() } })
    await openFilters(wrapper)
    expect(wrapper.find('.vam-filter__reset').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('пустой фасет показывает подпись, а не пустоту', async () => {
    const wrapper = mount(FilterMenu, {
      props: { facets: { types: new Map(), statuses: new Map(), groups: new Map() }, modelValue: state() },
    })
    await openFilters(wrapper)

    expect(wrapper.findAll('.vam-filter__empty')).toHaveLength(2)
    wrapper.unmount()
  })
})

describe('контролы внутри <AssetMap>', () => {
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

  it('тулбар показывает все три контрола', async () => {
    const wrapper = await mountMap()

    expect(wrapper.find('.vam-views').exists()).toBe(true)
    expect(wrapper.find('.vam-search').exists()).toBe(true)
    expect(wrapper.find('.vam-filter').exists()).toBe(true)

    wrapper.unmount()
  })

  it('showToolbar: false убирает тулбар целиком', async () => {
    const wrapper = await mountMap({ showToolbar: false })

    expect(wrapper.find('.vam-toolbar').exists()).toBe(false)
    expect(wrapper.find('.vam-search').exists()).toBe(false)

    wrapper.unmount()
  })

  it('переключатель видов не рисуется, когда вид один', async () => {
    const wrapper = await mountMap({ views: [views[0]] })

    expect(wrapper.find('.vam-views').exists()).toBe(false)
    wrapper.unmount()
  })

  it('поиск из тулбара подсвечивает совпадения на карте', async () => {
    const wrapper = await mountMap()

    await wrapper.find('.vam-search__input').setValue('Dmitry')
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vam-node--matched')).toHaveLength(1)
    expect(wrapper.find('.vam-search__summary').text()).toBe('Найдено: 1')

    wrapper.unmount()
  })

  it('поиск не разрывает граф: соседи совпадения остаются на карте', async () => {
    const wrapper = await mountMap()

    await wrapper.find('.vam-search__input').setValue('web-07')
    await flushPromises()
    await nextTick()

    // Контейнер спрятан в группу, поэтому подсвечивается групповой узел, а
    // цепочка до корня (гипервизор, роутер) остаётся видимой.
    expect(wrapper.find('[aria-label^="Proxmox Beelink"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label^="Keenetic 2"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label^="Cloudflare"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('очистка поиска возвращает карту целиком', async () => {
    const wrapper = await mountMap()
    const before = wrapper.findAll('.vam-node').length

    await wrapper.find('.vam-search__input').setValue('Dmitry')
    await flushPromises()
    await nextTick()
    expect(wrapper.findAll('.vam-node').length).toBeLessThan(before)

    await wrapper.find('.vam-search__clear').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vam-node').length).toBe(before)
    wrapper.unmount()
  })

  it('фасеты собраны из данных и сужаются проекцией вида', async () => {
    const physical = await mountMap({ view: 'physical' })
    await openFilters(physical)
    const physicalKinds = physical.findAll('.vam-filter__option-label').map((node) => node.text())
    expect(physicalKinds).toContain('cloud')
    expect(physicalKinds).toContain('container')
    physical.unmount()

    const logical = await mountMap({ view: 'logical' })
    await openFilters(logical)
    const logicalKinds = logical.findAll('.vam-filter__option-label').map((node) => node.text())
    // В оверлее нет ни облаков, ни контейнеров.
    expect(logicalKinds).not.toContain('cloud')
    expect(logicalKinds).not.toContain('container')
    logical.unmount()
  })

  it('фильтр по типу из меню применяется к карте', async () => {
    const wrapper = await mountMap()
    await openFilters(wrapper)

    const routerCheckbox = wrapper
      .findAll('.vam-filter__option')
      .find((option) => option.text().includes('router'))
      ?.find('input')

    await routerCheckbox?.setValue(true)
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vam-node--matched')).toHaveLength(2)
    wrapper.unmount()
  })

  it('переключатель видов из тулбара меняет проекцию', async () => {
    const wrapper = await mountMap()

    expect(wrapper.find('[aria-label^="Интернет"]').exists()).toBe(true)

    const logicalButton = wrapper
      .findAll('.vam-views__button')
      .find((button) => button.find('.vam-views__label').text() === 'VPN-оверлей')
    await logicalButton?.trigger('click')
    await flushPromises()
    await nextTick()
    await flushPromises()

    expect(wrapper.find('[aria-label^="Интернет"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="Tailscale VPS"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('v-model:filters получает обновления от контролов', async () => {
    const wrapper = await mountMap({ filters: { query: '', types: [], statuses: [] } })

    await wrapper.find('.vam-search__input').setValue('vlad')
    await flushPromises()

    const emitted = wrapper.emitted('update:filters')?.at(-1)?.[0] as FilterState
    expect(emitted.query).toBe('vlad')

    wrapper.unmount()
  })
})
