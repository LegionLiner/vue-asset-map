// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { VueFlow } from '@vue-flow/core'
import AssetMap from '../../src/components/AssetMap.vue'
import { groupIdFor } from '../../src/core/collapse'
import type { XY } from '../../src/types/entity'
import { entities, links, statusColors, views } from '../../fixtures/infra'

async function mountMap(props: Record<string, unknown> = {}) {
  const wrapper = mount(AssetMap, {
    props: {
      entities,
      links,
      views,
      view: 'physical',
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

/**
 * Перетаскивание в jsdom не воспроизвести — у VueFlow нет геометрии. Дёргаем то
 * событие, которым он сообщает о доведённом до конца перетаскивании.
 */
async function drag(wrapper: Awaited<ReturnType<typeof mountMap>>, id: string, position: XY) {
  wrapper.findComponent(VueFlow).vm.$emit('node-drag-stop', {
    nodes: [{ id, position }],
  })
  await flushPromises()
  await nextTick()
}

type Positions = Record<string, XY>

/** Последнее состояние, ушедшее наружу через `v-model:positions`. */
function emittedPositions(wrapper: Awaited<ReturnType<typeof mountMap>>): Positions | undefined {
  return wrapper.emitted('update:positions')?.at(-1)?.[0] as Positions | undefined
}

describe('v-model:positions', () => {
  it('перетаскивание уходит наружу', async () => {
    const wrapper = await mountMap()

    await drag(wrapper, 'ws-vlad', { x: 320, y: 180 })

    expect(emittedPositions(wrapper)).toEqual({ 'ws-vlad': { x: 320, y: 180 } })
    wrapper.unmount()
  })

  it('копятся только тронутые узлы, а не весь граф', async () => {
    // Это и делает сохранённую раскладку живучей: сущность, добавленная позже,
    // раскладывается алгоритмом, а не встаёт туда, что запомнил файл.
    const wrapper = await mountMap()

    await drag(wrapper, 'ws-vlad', { x: 10, y: 20 })
    await drag(wrapper, 'ws-dmitry', { x: 30, y: 40 })

    expect(Object.keys(emittedPositions(wrapper) ?? {})).toEqual(['ws-vlad', 'ws-dmitry'])
    wrapper.unmount()
  })

  it('переданные снаружи позиции карта применяет', async () => {
    const saved: Positions = { 'ws-vlad': { x: 640, y: 480 } }
    const wrapper = await mountMap({ positions: saved })

    const nodes = wrapper.findComponent(VueFlow).props('nodes') ?? []
    expect(nodes.find((node) => node.id === 'ws-vlad')?.position).toEqual({ x: 640, y: 480 })

    wrapper.unmount()
  })

  it('раскладка ручную позицию не перебивает', async () => {
    // Ровно то, ради чего это и сохраняют: перестроение не должно стирать то,
    // что человек расставил руками.
    const wrapper = await mountMap({ positions: { 'ws-vlad': { x: 640, y: 480 } } })

    await (wrapper.vm as unknown as { relayout: () => Promise<void> }).relayout()
    await flushPromises()
    await nextTick()

    const nodes = wrapper.findComponent(VueFlow).props('nodes') ?? []
    expect(nodes.find((node) => node.id === 'ws-vlad')?.position).toEqual({ x: 640, y: 480 })

    wrapper.unmount()
  })

  it('состояние переживает перемонтирование', async () => {
    const first = await mountMap()
    await drag(first, 'ws-vlad', { x: 111, y: 222 })
    const saved = emittedPositions(first)
    first.unmount()

    // Как если бы его положили в localStorage и достали в следующий заход.
    const restored = JSON.parse(JSON.stringify(saved)) as Positions
    const second = await mountMap({ positions: restored })

    const nodes = second.findComponent(VueFlow).props('nodes') ?? []
    expect(nodes.find((node) => node.id === 'ws-vlad')?.position).toEqual({ x: 111, y: 222 })

    second.unmount()
  })

  it('это обычный объект: JSON его не теряет', async () => {
    // `Map` при сериализации превратился бы в `{}`, и сохранять было бы нечего.
    const wrapper = await mountMap()
    await drag(wrapper, 'ws-vlad', { x: 5, y: 6 })

    expect(JSON.parse(JSON.stringify(emittedPositions(wrapper)))).toEqual({
      'ws-vlad': { x: 5, y: 6 },
    })
    wrapper.unmount()
  })
})

describe('node-move', () => {
  it('сообщает о каждом сдвинутом узле отдельно', async () => {
    const wrapper = await mountMap()

    await drag(wrapper, 'ws-vlad', { x: 12, y: 34 })

    const payload = wrapper.emitted('node-move')?.at(-1)?.[0] as {
      id: string
      entity: { label: string } | undefined
      position: XY
    }
    expect(payload.id).toBe('ws-vlad')
    expect(payload.position).toEqual({ x: 12, y: 34 })
    // Сущность приходит вместе с id: сохранять обычно нужно её, а не узел.
    expect(payload.entity?.label).toBe('Vlad')

    wrapper.unmount()
  })

  it('без перетаскивания не эмитится', async () => {
    const wrapper = await mountMap()

    expect(wrapper.emitted('node-move')).toBeFalsy()
    wrapper.unmount()
  })
})

describe('getPositions()', () => {
  it('отдаёт позиции всех видимых узлов, а не только тронутых', async () => {
    const wrapper = await mountMap()
    const api = wrapper.vm as unknown as { getPositions: () => Positions }

    const all = api.getPositions()
    const visible = (wrapper.findComponent(VueFlow).props('nodes') ?? []).length

    expect(Object.keys(all)).toHaveLength(visible)
    for (const position of Object.values(all)) {
      expect(typeof position.x).toBe('number')
      expect(typeof position.y).toBe('number')
    }

    wrapper.unmount()
  })

  it('ручная позиция в снимке главнее раскладки', async () => {
    const wrapper = await mountMap()
    const api = wrapper.vm as unknown as { getPositions: () => Positions }

    await drag(wrapper, 'ws-vlad', { x: 777, y: 888 })

    expect(api.getPositions()['ws-vlad']).toEqual({ x: 777, y: 888 })
    wrapper.unmount()
  })

  it('снимок — копия: править его безопасно', async () => {
    const wrapper = await mountMap()
    const api = wrapper.vm as unknown as { getPositions: () => Positions }

    const snapshot = api.getPositions()
    const first = Object.keys(snapshot)[0] as string
    const before = { ...(snapshot[first] as XY) }
    ;(snapshot[first] as XY).x = -9999

    expect(api.getPositions()[first]).toEqual(before)
    wrapper.unmount()
  })

  it('свёрнутая группа отчитывается своим id, а не участниками', async () => {
    const wrapper = await mountMap()
    const api = wrapper.vm as unknown as { getPositions: () => Positions }

    const keys = Object.keys(api.getPositions())
    // Контейнеры сложены в группу: их на экране нет, и позиции у них тоже нет.
    expect(keys).toContain(groupIdFor('pve-beelink', 'container'))
    expect(keys).not.toContain('ct-web-1')

    wrapper.unmount()
  })
})

describe('resetPositions()', () => {
  it('возвращает карту алгоритму', async () => {
    const wrapper = await mountMap()
    const api = wrapper.vm as unknown as { resetPositions: () => void }

    await drag(wrapper, 'ws-vlad', { x: 300, y: 300 })
    expect(emittedPositions(wrapper)).toEqual({ 'ws-vlad': { x: 300, y: 300 } })

    api.resetPositions()
    await nextTick()

    expect(emittedPositions(wrapper)).toEqual({})
    wrapper.unmount()
  })

  it('без ручных позиций ничего не эмитит', async () => {
    const wrapper = await mountMap()
    const api = wrapper.vm as unknown as { resetPositions: () => void }

    api.resetPositions()
    await nextTick()

    expect(wrapper.emitted('update:positions')).toBeFalsy()
    wrapper.unmount()
  })
})
