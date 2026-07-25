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

function nodeClasses(wrapper: Awaited<ReturnType<typeof mountMap>>, label: string): string[] {
  return wrapper.find(`[aria-label^="${label}"]`).classes()
}

describe('выделение подсвечивает связи и затемняет остальное', () => {
  it('до выделения никто не затемнён', async () => {
    const wrapper = await mountMap()

    expect(wrapper.findAll('.vam-node--dimmed')).toHaveLength(0)
    wrapper.unmount()
  })

  it('выбранный узел и его соседи остаются яркими, остальные гаснут', async () => {
    const wrapper = await mountMap({ view: 'logical' })

    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    // Сам узел и его связи в оверлее: координатор и прямой пиринг с Artjom.
    expect(nodeClasses(wrapper, 'Dmitry')).not.toContain('vam-node--dimmed')
    expect(nodeClasses(wrapper, 'Tailscale VPS')).not.toContain('vam-node--dimmed')
    expect(nodeClasses(wrapper, 'Artjom')).not.toContain('vam-node--dimmed')
    // Всё остальное затемнено.
    expect(nodeClasses(wrapper, 'Vlad')).toContain('vam-node--dimmed')
    expect(nodeClasses(wrapper, 'Proxmox GPU server')).toContain('vam-node--dimmed')

    wrapper.unmount()
  })

  it('клик по фону снимает затемнение', async () => {
    const wrapper = await mountMap({ view: 'logical' })

    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('.vam-node--dimmed').length).toBeGreaterThan(0)

    await wrapper.find('.vue-flow__pane').trigger('click')
    await nextTick()

    expect(wrapper.findAll('.vam-node--dimmed')).toHaveLength(0)
    wrapper.unmount()
  })

  it('глубина подсветки настраивается', async () => {
    const shallow = await mountMap({ view: 'logical', neighborHighlightDepth: 1 })
    await shallow.find('[aria-label^="Vlad"]').trigger('click')
    await nextTick()
    const shallowBright = shallow.findAll('.vam-node').length - shallow.findAll('.vam-node--dimmed').length

    const deep = await mountMap({ view: 'logical', neighborHighlightDepth: 2 })
    await deep.find('[aria-label^="Vlad"]').trigger('click')
    await nextTick()
    const deepBright = deep.findAll('.vam-node').length - deep.findAll('.vam-node--dimmed').length

    expect(deepBright).toBeGreaterThan(shallowBright)

    shallow.unmount()
    deep.unmount()
  })

  it('neighborHighlightDepth: 0 выключает подсветку по выделению', async () => {
    const wrapper = await mountMap({ view: 'logical', neighborHighlightDepth: 0 })

    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    expect(wrapper.findAll('.vam-node--dimmed')).toHaveLength(0)
    // Выделение при этом работает.
    expect(nodeClasses(wrapper, 'Dmitry')).toContain('vam-node--selected')

    wrapper.unmount()
  })

  it('связи считаются по слоям текущего вида', async () => {
    // В физическом виде у станции сосед — роутер, а не координатор VPN.
    const wrapper = await mountMap({ view: 'physical' })

    await wrapper.find('[aria-label^="Dmitry"]').trigger('click')
    await nextTick()

    expect(nodeClasses(wrapper, 'Keenetic 2')).not.toContain('vam-node--dimmed')
    expect(nodeClasses(wrapper, 'Tailscale VPS')).toContain('vam-node--dimmed')

    wrapper.unmount()
  })

  it('несколько выделенных узлов подсвечивают связи каждого', async () => {
    const wrapper = await mountMap({ view: 'logical' })

    await wrapper.find('[aria-label^="Vlad"]').trigger('click')
    await wrapper.find('[aria-label^="NGINX VPS"]').trigger('click', { ctrlKey: true })
    await nextTick()

    expect(nodeClasses(wrapper, 'Vlad')).not.toContain('vam-node--dimmed')
    expect(nodeClasses(wrapper, 'NGINX VPS')).not.toContain('vam-node--dimmed')

    wrapper.unmount()
  })

  it('поиск главнее выделения: пока фильтр активен, он и решает', async () => {
    const wrapper = await mountMap({
      view: 'logical',
      filters: { query: 'Vlad', kinds: [], statuses: [] },
    })
    await flushPromises()
    await nextTick()

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    // Совпадение поиска яркое, а выбранный узел — нет: режимы не смешиваются.
    expect(nodeClasses(wrapper, 'Vlad')).toContain('vam-node--matched')
    expect(nodeClasses(wrapper, 'Tailscale VPS')).toContain('vam-node--dimmed')

    wrapper.unmount()
  })
})

describe('режим заражения', () => {
  it('без пометок никто не заражён', async () => {
    const wrapper = await mountMap()

    expect(wrapper.findAll('.vam-node--infected')).toHaveLength(0)
    wrapper.unmount()
  })

  it('помеченная сущность и захваченные ею окрашены', async () => {
    const wrapper = await mountMap({
      view: 'logical',
      infected: ['vps-tailscale'],
      infectionOptions: { maxDepth: 1 },
    })

    expect(nodeClasses(wrapper, 'Tailscale VPS')).toContain('vam-node--infected')
    expect(nodeClasses(wrapper, 'Tailscale VPS')).toContain('vam-node--infection-source')

    // На один шаг захвачены прямые связи координатора.
    expect(nodeClasses(wrapper, 'Dmitry')).toContain('vam-node--infected')
    // Помеченным вручную сосед не считается.
    expect(nodeClasses(wrapper, 'Dmitry')).not.toContain('vam-node--infection-source')

    wrapper.unmount()
  })

  it('глубина захвата ограничивается', async () => {
    const near = await mountMap({
      view: 'physical',
      infected: ['keenetic-2'],
      infectionOptions: { maxDepth: 1 },
    })
    const far = await mountMap({
      view: 'physical',
      infected: ['keenetic-2'],
      infectionOptions: { maxDepth: 3 },
    })

    expect(far.findAll('.vam-node--infected').length).toBeGreaterThan(
      near.findAll('.vam-node--infected').length,
    )

    near.unmount()
    far.unmount()
  })

  it('заражённые связи окрашены, а связи наружу — нет', async () => {
    const wrapper = await mountMap({
      view: 'physical',
      infected: ['keenetic-2'],
      infectionOptions: { maxDepth: 1 },
    })

    const infectedEdges = wrapper.findAll('.vam-edge--infected')
    expect(infectedEdges.length).toBeGreaterThan(0)
    // Не все связи карты покрашены: захват ограничен одним шагом.
    expect(infectedEdges.length).toBeLessThan(wrapper.findAll('.vam-edge').length)

    wrapper.unmount()
  })

  it('направление захвата учитывается', async () => {
    // `l-cf-nginx` — единственная направленная связь фикстуры: Cloudflare → NGINX.
    const downstream = await mountMap({
      view: 'physical',
      infected: ['vps-nginx'],
      infectionOptions: { direction: 'downstream', maxDepth: 1, layers: ['physical'] },
    })
    const upstream = await mountMap({
      view: 'physical',
      infected: ['vps-nginx'],
      infectionOptions: { direction: 'upstream', maxDepth: 1, layers: ['physical'] },
    })

    // Вверх по потоку добирается Cloudflare, вниз — нет.
    expect(nodeClasses(upstream, 'Cloudflare')).toContain('vam-node--infected')
    expect(nodeClasses(downstream, 'Cloudflare')).not.toContain('vam-node--infected')

    downstream.unmount()
    upstream.unmount()
  })

  it('группа краснеет, если захвачен хоть один её участник', async () => {
    const wrapper = await mountMap({
      view: 'physical',
      infected: ['ct-web-1'],
      infectionOptions: { maxDepth: 0 },
    })

    // Контейнер спрятан в группу — заражение видно на групповом узле.
    expect(wrapper.find('.vam-group').classes()).toContain('vam-node--infected')
    wrapper.unmount()
  })

  it('заражение можно включать и выключать', async () => {
    const wrapper = await mountMap({ view: 'logical', infected: [] })
    expect(wrapper.findAll('.vam-node--infected')).toHaveLength(0)

    await wrapper.setProps({ infected: ['vps-tailscale'] })
    await nextTick()
    expect(wrapper.findAll('.vam-node--infected').length).toBeGreaterThan(0)

    await wrapper.setProps({ infected: [] })
    await nextTick()
    expect(wrapper.findAll('.vam-node--infected')).toHaveLength(0)

    wrapper.unmount()
  })
})
