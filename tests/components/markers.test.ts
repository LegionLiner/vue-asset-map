// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import NetworkMap from '../../src/components/NetworkMap.vue'
import { entities, links, nodeMarkers, statusColors, views } from '../../fixtures/infra'

async function mountMap(props: Record<string, unknown> = {}) {
  const wrapper = mount(NetworkMap, {
    props: {
      entities,
      links,
      views,
      themeConfig: { statusColors },
      markers: nodeMarkers,
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

function node(wrapper: Awaited<ReturnType<typeof mountMap>>, label: string) {
  return wrapper.find(`[aria-label^="${label}"]`)
}

/** Кружок маркера по подписи, внутри указанного узла. */
function marker(wrapper: Awaited<ReturnType<typeof mountMap>>, label: string, title: string) {
  return node(wrapper, label)
    .findAll('.vnm-node__marker')
    .find((dot) => dot.attributes('title') === title)
}

describe('маркеры принадлежности', () => {
  it('без markers кружков нет', async () => {
    const wrapper = await mountMap({ markers: undefined })

    expect(wrapper.findAll('.vnm-node__marker')).toHaveLength(0)
    wrapper.unmount()
  })

  it('узел получает кружок того маркера, которому принадлежит', async () => {
    const wrapper = await mountMap()

    // Координатор связан с Интернетом, но не с роутером офиса A.
    expect(marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')).toBeDefined()
    expect(marker(wrapper, 'Tailscale VPS', 'Keenetic 1')).toBeUndefined()
    expect(marker(wrapper, 'Keenetic 1', 'Keenetic 1')).toBeDefined()

    wrapper.unmount()
  })

  it('цвета раздаются из палитры по порядку объявления', async () => {
    const wrapper = await mountMap()

    const ownRouter = marker(wrapper, 'Keenetic 1', 'Keenetic 1')
    const coordinator = marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')

    // Опорные узлы объявлены в порядке keenetic-1, keenetic-2, vps-tailscale.
    expect(ownRouter?.find('.vnm-node__marker-dot').attributes('style')).toContain('--vnm-marker-1')
    expect(coordinator?.find('.vnm-node__marker-dot').attributes('style')).toContain('--vnm-marker-3')

    wrapper.unmount()
  })

  it('свой цвет маркера перекрывает палитру', async () => {
    const wrapper = await mountMap({
      markers: [{ id: 'own', label: 'Своё', color: '#123456', match: () => true }],
    })

    expect(wrapper.find('.vnm-node__marker-dot').attributes('style')).toContain('rgb(18, 52, 86)')

    wrapper.unmount()
  })

  it('у заражённого узла кружок красится цветом заражения', async () => {
    const wrapper = await mountMap({
      view: 'logical',
      infected: ['vps-tailscale'],
      infectionOptions: { maxDepth: 0 },
    })

    const infectedDot = marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')?.find('.vnm-node__marker-dot')
    expect(infectedDot?.attributes('style')).toContain('--vnm-marker-infected')

    // Незаражённый сосед сохраняет свой цвет из палитры.
    const cleanDot = marker(wrapper, 'Dmitry', 'Tailscale VPS')?.find('.vnm-node__marker-dot')
    expect(cleanDot?.attributes('style')).toContain('--vnm-marker-3')

    wrapper.unmount()
  })

  it('кружок подписан для screen reader', async () => {
    const wrapper = await mountMap()

    expect(marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')?.attributes('aria-label')).toBe(
      'Принадлежность: Tailscale VPS',
    )
    wrapper.unmount()
  })

  it('в упрощённом режиме кружки скрыты вместе с подписями', async () => {
    const wrapper = await mountMap({ viewport: { x: 0, y: 0, zoom: 0.3 } })
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vnm-node__marker')).toHaveLength(0)
    wrapper.unmount()
  })

  it('клик по кружку не выделяет узел', async () => {
    const wrapper = await mountMap()

    await marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')?.trigger('click')
    await nextTick()

    expect(wrapper.emitted('node-click')).toBeUndefined()
    expect(node(wrapper, 'Tailscale VPS').classes()).not.toContain('vnm-node--selected')

    wrapper.unmount()
  })
})

describe('подсветка по наведению на маркер', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Наводит на кружок и прокручивает таймеры на указанное время. */
  async function hover(
    wrapper: Awaited<ReturnType<typeof mountMap>>,
    label: string,
    title: string,
    ms: number,
  ) {
    await marker(wrapper, label, title)?.trigger('mouseenter')
    vi.advanceTimersByTime(ms)
    await nextTick()
  }

  it('до истечения задержки ничего не подсвечивается', async () => {
    const wrapper = await mountMap()

    await hover(wrapper, 'Tailscale VPS', 'Tailscale VPS', 400)

    expect(wrapper.findAll('.vnm-node--dimmed')).toHaveLength(0)
    wrapper.unmount()
  })

  it('после задержки подсвечиваются узлы того же маркера, остальные гаснут', async () => {
    const wrapper = await mountMap()

    await hover(wrapper, 'Tailscale VPS', 'Tailscale VPS', 500)

    // Всё, что связано с координатором, остаётся ярким.
    expect(node(wrapper, 'Tailscale VPS').classes()).not.toContain('vnm-node--dimmed')
    expect(node(wrapper, 'Dmitry').classes()).not.toContain('vnm-node--dimmed')
    expect(node(wrapper, 'Proxmox Beelink').classes()).not.toContain('vnm-node--dimmed')
    // Роутеры и Cloudflare с координатором напрямую не связаны — гаснут.
    expect(node(wrapper, 'Keenetic 1').classes()).toContain('vnm-node--dimmed')
    expect(node(wrapper, 'Keenetic 2').classes()).toContain('vnm-node--dimmed')
    expect(node(wrapper, 'Cloudflare').classes()).toContain('vnm-node--dimmed')

    wrapper.unmount()
  })

  it('уход курсора снимает подсветку', async () => {
    const wrapper = await mountMap()

    await hover(wrapper, 'Tailscale VPS', 'Tailscale VPS', 500)
    expect(wrapper.findAll('.vnm-node--dimmed').length).toBeGreaterThan(0)

    await marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')?.trigger('mouseleave')
    await nextTick()

    expect(wrapper.findAll('.vnm-node--dimmed')).toHaveLength(0)
    wrapper.unmount()
  })

  it('уход курсора до задержки отменяет ожидание', async () => {
    const wrapper = await mountMap()

    await marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')?.trigger('mouseenter')
    vi.advanceTimersByTime(300)
    await marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')?.trigger('mouseleave')
    vi.advanceTimersByTime(1000)
    await nextTick()

    expect(wrapper.findAll('.vnm-node--dimmed')).toHaveLength(0)
    wrapper.unmount()
  })

  it('задержка настраивается', async () => {
    const wrapper = await mountMap({ markerHoverDelay: 1200 })

    await hover(wrapper, 'Tailscale VPS', 'Tailscale VPS', 500)
    expect(wrapper.findAll('.vnm-node--dimmed')).toHaveLength(0)

    vi.advanceTimersByTime(700)
    await nextTick()
    expect(wrapper.findAll('.vnm-node--dimmed').length).toBeGreaterThan(0)

    wrapper.unmount()
  })

  it('нулевая задержка подсвечивает сразу', async () => {
    const wrapper = await mountMap({ markerHoverDelay: 0 })

    await marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')?.trigger('mouseenter')
    await nextTick()

    expect(wrapper.findAll('.vnm-node--dimmed').length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('фокус с клавиатуры подсвечивает без задержки', async () => {
    const wrapper = await mountMap()

    await marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')?.trigger('focus')
    await nextTick()

    expect(wrapper.findAll('.vnm-node--dimmed').length).toBeGreaterThan(0)

    await marker(wrapper, 'Tailscale VPS', 'Tailscale VPS')?.trigger('blur')
    await nextTick()
    expect(wrapper.findAll('.vnm-node--dimmed')).toHaveLength(0)

    wrapper.unmount()
  })

  it('наведение главнее выделения', async () => {
    const wrapper = await mountMap({ view: 'physical' })

    // Выделяем Cloudflare: подсвечиваются он и его связи.
    await node(wrapper, 'Cloudflare').trigger('click')
    await nextTick()
    expect(node(wrapper, 'Cloudflare').classes()).not.toContain('vnm-node--dimmed')

    // Наводим на маркер координатора: Cloudflare с ним не связан и гаснет,
    // хотя только что был выделен.
    await hover(wrapper, 'NGINX VPS', 'Tailscale VPS', 500)
    expect(node(wrapper, 'NGINX VPS').classes()).not.toContain('vnm-node--dimmed')
    expect(node(wrapper, 'Cloudflare').classes()).toContain('vnm-node--dimmed')

    wrapper.unmount()
  })

  it('связи внутри маркера остаются яркими, наружу — гаснут', async () => {
    const wrapper = await mountMap({ view: 'physical' })

    await hover(wrapper, 'Dmitry', 'Tailscale VPS', 500)

    const dimmed = wrapper.findAll('.vnm-edge--dimmed').length
    const total = wrapper.findAll('.vnm-edge').length
    expect(dimmed).toBeGreaterThan(0)
    expect(dimmed).toBeLessThan(total)

    wrapper.unmount()
  })
})
