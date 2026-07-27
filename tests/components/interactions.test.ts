// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { VueFlow } from '@vue-flow/core'
import AssetMap from '../../src/components/AssetMap.vue'
import type { LinkTypeDef } from '../../src/types/linkType'
import { entities, links, statusColors, views } from '../../fixtures/infra'

const linkTypes: LinkTypeDef[] = [
  { id: 'solid', label: 'Оптоволокно', color: '#2f7d4f', width: 2 },
  { id: 'dashed', label: 'Wi-Fi', color: '#c07b1e', dash: '6 4' },
  { id: 'plain', label: 'Без оформления' },
]

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

/** Правый клик по узлу с указанной подписью. */
async function rightClickNode(wrapper: Awaited<ReturnType<typeof mountMap>>, label: string) {
  await wrapper.find(`[aria-label^="${label}"]`).trigger('contextmenu')
  await flushPromises()
  await nextTick()
}

describe('легенда соединений', () => {
  it('показывается только с showLegend и только для оформленных типов', async () => {
    const wrapper = await mountMap({ linkTypes, showLegend: true })

    const rows = wrapper.findAll('.vam-legend__row')
    // Тип без цвета и штриха от дефолтного не отличается — строка о нём ничего
    // бы не объясняла.
    expect(rows).toHaveLength(2)
    expect(wrapper.find('.vam-legend').text()).toContain('Оптоволокно')
    expect(wrapper.find('.vam-legend').text()).toContain('Wi-Fi')
    expect(wrapper.find('.vam-legend').text()).not.toContain('Без оформления')

    wrapper.unmount()
  })

  it('без showLegend её нет вовсе', async () => {
    const wrapper = await mountMap({ linkTypes })

    expect(wrapper.find('.vam-legend').exists()).toBe(false)
    wrapper.unmount()
  })

  it('образец рисуется тем же цветом и штрихом, что и связь', async () => {
    const wrapper = await mountMap({ linkTypes, showLegend: true })

    const line = wrapper.find('.vam-legend__swatch line')
    expect(line.attributes('stroke')).toBe('#2f7d4f')
    expect(line.attributes('stroke-width')).toBe('2')

    wrapper.unmount()
  })
})

describe('цвет связи по её типу', () => {
  it('связь объявленного типа красится в его цвет', async () => {
    const wrapper = await mountMap({ linkTypes, view: 'physical' })

    const styled = wrapper
      .findAll('.vam-edge')
      .map((edge) => edge.attributes('style') ?? '')
      .filter((style) => style.includes('2f7d4f'))

    expect(styled.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('без объявленных типов связи остаются на теме', async () => {
    const wrapper = await mountMap({ view: 'physical' })

    const withStroke = wrapper
      .findAll('.vam-edge')
      .filter((edge) => (edge.attributes('style') ?? '').includes('stroke:'))

    expect(withStroke).toHaveLength(0)
    wrapper.unmount()
  })
})

describe('окно соединения', () => {
  it('клик по связи открывает окно с концами и типом', async () => {
    const wrapper = await mountMap({ linkTypes, view: 'physical' })

    await wrapper.find('.vam-edge__hit').trigger('click')
    await flushPromises()
    await nextTick()

    const panel = wrapper.find('.vam-link-details')
    expect(panel.exists()).toBe(true)
    // Концы показаны подписями сущностей, а не их id.
    expect(panel.findAll('.vam-link-details__end')).toHaveLength(2)

    wrapper.unmount()
  })

  it('v-model:openLinks управляет окнами снаружи', async () => {
    const firstLink = links[0]
    const wrapper = await mountMap({ openLinks: [firstLink?.id] })

    expect(wrapper.findAll('.vam-link-details')).toHaveLength(1)

    await wrapper.setProps({ openLinks: [] })
    await nextTick()
    expect(wrapper.findAll('.vam-link-details')).toHaveLength(0)

    wrapper.unmount()
  })
})

describe('контекстное меню', () => {
  it('без showContextMenu правый клик меню не открывает', async () => {
    const wrapper = await mountMap()

    await rightClickNode(wrapper, 'Tailscale VPS')

    expect(wrapper.find('.vam-menu').exists()).toBe(false)
    // Событие при этом эмитится по-прежнему: приложение может показать своё.
    expect(wrapper.emitted('node-context-menu')).toBeTruthy()

    wrapper.unmount()
  })

  it('на узле предлагает открыть в новом окне', async () => {
    const wrapper = await mountMap({ showContextMenu: true })

    await rightClickNode(wrapper, 'Tailscale VPS')

    const items = wrapper.findAll('.vam-menu__item')
    expect(items).toHaveLength(1)
    expect(items[0]?.text()).toContain('новом окне')

    wrapper.unmount()
  })

  it('удаление появляется только при editable', async () => {
    const wrapper = await mountMap({ showContextMenu: true, editable: true })

    await rightClickNode(wrapper, 'Tailscale VPS')

    const labels = wrapper.findAll('.vam-menu__item').map((item) => item.text())
    expect(labels).toHaveLength(2)
    expect(labels[1]).toBe('Удалить')
    expect(wrapper.findAll('.vam-menu__item--danger')).toHaveLength(1)

    wrapper.unmount()
  })

  it('«открыть в новом окне» копит окна даже в режиме замены', async () => {
    const wrapper = await mountMap({ showContextMenu: true, maxDetailsWindows: 3 })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await flushPromises()
    await nextTick()
    expect(wrapper.findAll('.vam-details')).toHaveLength(1)

    await rightClickNode(wrapper, 'NGINX VPS')
    await wrapper.find('.vam-menu__item').trigger('click')
    await flushPromises()
    await nextTick()

    // Обычный клик заменяет, а эта кнопка — именно для второго окна.
    expect(wrapper.findAll('.vam-details')).toHaveLength(2)
    expect(wrapper.find('.vam-menu').exists()).toBe(false)

    wrapper.unmount()
  })

  it('на групповом узле меню пустое: за группой нет сущности', async () => {
    const wrapper = await mountMap({ showContextMenu: true, editable: true })

    await wrapper.find('.vam-group').trigger('contextmenu')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.vam-menu').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('удаление через подтверждение', () => {
  it('пункт удаления открывает модалку пакета, а не браузерную', async () => {
    const wrapper = await mountMap({ showContextMenu: true, editable: true })

    await rightClickNode(wrapper, 'Tailscale VPS')
    await wrapper.findAll('.vam-menu__item')[1]?.trigger('click')
    await nextTick()

    const dialog = wrapper.find('.vam-confirm')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('Tailscale VPS')
    // Пока не подтвердили — ничего не удалено.
    expect(wrapper.emitted('entity-delete')).toBeFalsy()

    wrapper.unmount()
  })

  it('отмена ничего не эмитит и закрывает модалку', async () => {
    const wrapper = await mountMap({ showContextMenu: true, editable: true })

    await rightClickNode(wrapper, 'Tailscale VPS')
    await wrapper.findAll('.vam-menu__item')[1]?.trigger('click')
    await nextTick()
    await wrapper.find('.vam-confirm__button').trigger('click')
    await nextTick()

    expect(wrapper.find('.vam-confirm').exists()).toBe(false)
    expect(wrapper.emitted('entity-delete')).toBeFalsy()

    wrapper.unmount()
  })

  it('подтверждение эмитит entity-delete и закрывает окно узла', async () => {
    const wrapper = await mountMap({ showContextMenu: true, editable: true })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await flushPromises()
    await nextTick()
    expect(wrapper.findAll('.vam-details')).toHaveLength(1)

    await rightClickNode(wrapper, 'Tailscale VPS')
    await wrapper.findAll('.vam-menu__item')[1]?.trigger('click')
    await nextTick()
    await wrapper.findAll('.vam-confirm__button')[1]?.trigger('click')
    await nextTick()

    expect(wrapper.emitted('entity-delete')?.at(-1)?.[0]).toMatchObject({ id: 'vps-tailscale' })
    // Окно закрыто: оставить его открытым значило бы показывать запись, которую
    // приложению только что велели убрать.
    expect(wrapper.findAll('.vam-details')).toHaveLength(0)

    wrapper.unmount()
  })

  it('правый клик по связи предлагает её удалить', async () => {
    const wrapper = await mountMap({ showContextMenu: true, editable: true, view: 'physical' })

    await wrapper.find('.vam-edge__hit').trigger('contextmenu')
    await flushPromises()
    await nextTick()

    const labels = wrapper.findAll('.vam-menu__item').map((item) => item.text())
    expect(labels).toContain('Удалить соединение')

    wrapper.unmount()
  })
})

describe('смена представления', () => {
  it('сбрасывает выделение', async () => {
    // Узел, выделенный в одном виде, в другом может не существовать вовсе, а
    // невидимое выделение всё равно гасит всё вокруг себя.
    const wrapper = await mountMap({ view: 'physical' })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()
    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual(['vps-tailscale'])

    await wrapper.setProps({ view: 'logical' })
    await flushPromises()
    await nextTick()

    expect(wrapper.emitted('selection-change')?.at(-1)?.[0]).toEqual([])
    expect(wrapper.findAll('.vam-node--selected')).toHaveLength(0)

    wrapper.unmount()
  })

  it('снимает и подсветку пути: маршрут мог идти по связям другого вида', async () => {
    const wrapper = await mountMap({ view: 'logical' })
    const api = wrapper.vm as unknown as { highlightPath: (from: string, to: string) => string[] }

    api.highlightPath('ws-artjom', 'ws-sergey')
    await nextTick()
    expect(wrapper.findAll('.vam-node--highlighted').length).toBeGreaterThan(1)

    await wrapper.setProps({ view: 'physical' })
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.vam-node--highlighted')).toHaveLength(0)
    wrapper.unmount()
  })
})

describe('рисование связи между сущностями', () => {
  /**
   * Тянуть за ручку узла в jsdom нечем: VueFlow строит соединение на pointer-
   * событиях с реальной геометрией. Поэтому дёргаем ровно то событие, которым он
   * сообщает о доведённом до конца перетаскивании.
   */
  async function connect(wrapper: Awaited<ReturnType<typeof mountMap>>, source: string, target: string) {
    wrapper.findComponent(VueFlow).vm.$emit('connect', { source, target })
    await flushPromises()
    await nextTick()
  }

  it('без editable узлы соединять нельзя', async () => {
    const wrapper = await mountMap()

    expect(wrapper.findComponent(VueFlow).props('nodesConnectable')).toBe(false)
    // И на самом узле тоже: VueFlow читает его флаг последним, поэтому
    // зашитый сюда `false` молча отменял бы проп выше.
    const nodes = wrapper.findComponent(VueFlow).props('nodes') ?? []
    expect(nodes.find((n) => n.id === 'ws-vlad')?.connectable).toBe(false)
    expect(wrapper.findAll('.vam-node__connector')).toHaveLength(0)

    wrapper.unmount()
  })

  it('с editable узел соединяем и показывает четыре точки захвата', async () => {
    const wrapper = await mountMap({ editable: true })

    expect(wrapper.findComponent(VueFlow).props('nodesConnectable')).toBe(true)
    const nodes = wrapper.findComponent(VueFlow).props('nodes') ?? []
    expect(nodes.find((n) => n.id === 'ws-vlad')?.connectable).toBe(true)

    // По одной на сторону круга: направление, в котором тянут, — это заявление
    // о том, куда должна идти связь.
    const own = wrapper.find('[aria-label^="Vlad"]')
    expect(own.findAll('.vam-node__connector')).toHaveLength(4)
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(own.find(`.vam-node__connector--${side}`).exists()).toBe(true)
    }

    wrapper.unmount()
  })

  it('групповой узел соединять нельзя: за ним нет записи', async () => {
    const wrapper = await mountMap({ editable: true })

    const group = wrapper.find('.vam-group')
    expect(group.findAll('.vam-node__connector')).toHaveLength(0)

    wrapper.unmount()
  })

  it('связи по-прежнему цепляются к центральным ручкам, а не к точкам захвата', async () => {
    // Точки захвата объявлены после центральных: ребро без явной ручки
    // разрешается в первую своего типа, и рисование не должно это менять.
    const wrapper = await mountMap({ editable: true, view: 'physical' })

    const edges = wrapper.findComponent(VueFlow).props('edges') ?? []
    expect(edges.every((edge) => !edge.sourceHandle && !edge.targetHandle)).toBe(true)

    wrapper.unmount()
  })

  it('доведённое соединение открывает окно сразу в режиме правки', async () => {
    const wrapper = await mountMap({ editable: true, linkTypes, view: 'physical' })

    await connect(wrapper, 'vps-tailscale', 'keenetic-1')

    const panel = wrapper.find('.vam-link-details')
    expect(panel.exists()).toBe(true)
    // Форма уже раскрыта: тип и скорость заполняют сразу, не нажимая «Править».
    expect(panel.findAll('.vam-fields__input').length).toBeGreaterThan(0)

    wrapper.unmount()
  })

  it('link-create эмитится только на сохранении, а не на рисовании', async () => {
    const wrapper = await mountMap({ editable: true, linkTypes, view: 'physical' })

    await connect(wrapper, 'vps-tailscale', 'keenetic-1')
    // Пока форму не сохранили, связи не существует.
    expect(wrapper.emitted('link-create')).toBeFalsy()

    const panel = wrapper.find('.vam-link-details')
    await panel.findAll('.vam-fields__input')[0]?.setValue('dashed')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    const payload = wrapper.emitted('link-create')?.at(-1)?.[0] as {
      source: string
      target: string
      link: { type: string; layers: string[] }
    }
    expect(payload.source).toBe('vps-tailscale')
    expect(payload.target).toBe('keenetic-1')
    expect(payload.link.type).toBe('dashed')
    // Слой текущего вида, иначе новая связь исчезла бы сразу после создания.
    expect(payload.link.layers).toEqual(['physical'])

    wrapper.unmount()
  })

  it('закрытие окна до сохранения бросает нарисованную связь', async () => {
    const wrapper = await mountMap({ editable: true, view: 'physical' })

    await connect(wrapper, 'vps-tailscale', 'keenetic-1')
    expect(wrapper.findAll('.vam-link-details')).toHaveLength(1)

    await wrapper.find('.vam-link-details .vam-window__button').trigger('click')
    await nextTick()

    expect(wrapper.findAll('.vam-link-details')).toHaveLength(0)
    expect(wrapper.emitted('link-create')).toBeFalsy()

    wrapper.unmount()
  })

  it('петля на себя связью не считается', async () => {
    const wrapper = await mountMap({ editable: true })

    await connect(wrapper, 'vps-tailscale', 'vps-tailscale')

    expect(wrapper.findAll('.vam-link-details')).toHaveLength(0)
    wrapper.unmount()
  })
})

describe('редактирование', () => {
  const entityFields = [
    { key: 'label', label: 'Название' },
    { key: 'meta.owner', label: 'Владелец' },
  ]

  it('без editable кнопки редактирования нет', async () => {
    const wrapper = await mountMap({ entityFields })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    expect(wrapper.find('.vam-window__actions').exists()).toBe(false)
    wrapper.unmount()
  })

  it('одного editable хватает: сущность правится без объявленной схемы', async () => {
    // Та же любезность, что и у связей: иначе одна запись правилась бы из
    // коробки, а другая молча нет.
    const wrapper = await mountMap({ editable: true })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    const panel = wrapper.find('.vam-details')
    expect(panel.find('.vam-window__actions').exists()).toBe(true)

    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    // Название и состояние — те два поля, значение которых пакет знает сам.
    const labels = panel.findAll('.vam-fields__key').map((key) => key.text())
    expect(labels).toHaveLength(2)

    // Состояние — выбор по статусам, которые потребитель уже назвал в
    // `themeConfig.statusColors`.
    const select = panel.find('select.vam-fields__input')
    expect(select.exists()).toBe(true)
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      '—',
      'online',
      'offline',
      'degraded',
    ])

    wrapper.unmount()
  })

  it('без statusColors состояние правится текстом, а не пустым списком', async () => {
    const wrapper = mount(AssetMap, {
      props: { entities, links, views, onlyRenderVisibleElements: false, searchDebounce: 0, editable: true },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()
    await flushPromises()

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    const panel = wrapper.find('.vam-details')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    expect(panel.find('select.vam-fields__input').exists()).toBe(false)
    expect(panel.findAll('input.vam-fields__input')).toHaveLength(2)

    wrapper.unmount()
  })

  it('объявленная схема отменяет умолчание', async () => {
    const wrapper = await mountMap({ editable: true, entityFields })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    const panel = wrapper.find('.vam-details')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    expect(panel.findAll('.vam-fields__key').map((key) => key.text())).toEqual(['Название', 'Владелец'])
    wrapper.unmount()
  })

  it('первое нажатие превращает поля в инпуты, второе — сохраняет', async () => {
    const wrapper = await mountMap({ editable: true, entityFields })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    const panel = wrapper.find('.vam-details')
    expect(panel.findAll('.vam-fields__input')).toHaveLength(0)

    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    const inputs = panel.findAll('.vam-fields__input')
    expect(inputs).toHaveLength(2)

    await inputs[0]?.setValue('Новое имя')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    const payload = wrapper.emitted('entity-update')?.at(-1)?.[0] as { entity: { label: string } }
    expect(payload.entity.label).toBe('Новое имя')
    // Форма закрылась обратно в чтение.
    expect(panel.findAll('.vam-fields__input')).toHaveLength(0)

    wrapper.unmount()
  })

  it('сохранение без правок ничего не эмитит', async () => {
    const wrapper = await mountMap({ editable: true, entityFields })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    const panel = wrapper.find('.vam-details')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    expect(wrapper.emitted('entity-update')).toBeFalsy()
    wrapper.unmount()
  })

  it('отмена выходит из режима правки, не сохраняя', async () => {
    const wrapper = await mountMap({ editable: true, entityFields })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    const panel = wrapper.find('.vam-details')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()
    await panel.findAll('.vam-fields__input')[0]?.setValue('Не сохранять')
    await panel.find('.vam-window__action').trigger('click')
    await nextTick()

    expect(wrapper.emitted('entity-update')).toBeFalsy()
    expect(panel.findAll('.vam-fields__input')).toHaveLength(0)

    wrapper.unmount()
  })

  it('правка работает и когда тело окна занято слотом #details', async () => {
    // Слот — это представление для чтения: печатать в него нечего. Раньше поля
    // правки жили внутри запасной ветки шаблона, и с чужим телом кнопка
    // «Редактировать» была, а инпутов не появлялось.
    const wrapper = mount(AssetMap, {
      props: {
        entities,
        links,
        views,
        themeConfig: { statusColors },
        onlyRenderVisibleElements: false,
        searchDebounce: 0,
        editable: true,
        entityFields,
      },
      slots: { details: () => h('div', { class: 'own-body' }, 'своё тело') },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()
    await flushPromises()

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    const panel = wrapper.find('.vam-details')
    expect(panel.find('.own-body').exists()).toBe(true)

    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    expect(panel.findAll('.vam-fields__input')).toHaveLength(2)
    // Пока правят — читать нечего: форма занимает тело целиком.
    expect(panel.find('.own-body').exists()).toBe(false)

    await panel.findAll('.vam-fields__input')[0]?.setValue('Из слота')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    const payload = wrapper.emitted('entity-update')?.at(-1)?.[0] as { entity: { label: string } }
    expect(payload.entity.label).toBe('Из слота')
    // И тело потребителя вернулось.
    expect(panel.find('.own-body').exists()).toBe(true)

    wrapper.unmount()
  })

  it('в режиме правки поля идут в одну колонку, подпись над контролом', async () => {
    // Раньше форма была вторым столбцом сетки секции и ужималась в её ширину.
    const wrapper = await mountMap({ editable: true, entityFields })

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    const panel = wrapper.find('.vam-details')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    expect(panel.find('.vam-fields--editing').exists()).toBe(true)
    expect(panel.findAll('.vam-fields__field')).toHaveLength(2)
    // Читающий вид остаётся двухколоночным: там сканируют, а не печатают.
    await panel.find('.vam-window__action').trigger('click')
    await nextTick()
    expect(panel.find('.vam-fields--editing').exists()).toBe(false)

    wrapper.unmount()
  })

  it('#details-edit подменяет форму своими контролами', async () => {
    const wrapper = mount(AssetMap, {
      props: {
        entities,
        links,
        views,
        themeConfig: { statusColors },
        onlyRenderVisibleElements: false,
        searchDebounce: 0,
        editable: true,
        entityFields,
      },
      slots: {
        'details-edit': ({ value, fields, setValue, save }) =>
          h('div', { class: 'own-form' }, [
            h('span', { class: 'own-form__id' }, value.id),
            h('span', { class: 'own-form__count' }, String(fields.length)),
            h('input', {
              class: 'own-form__input',
              onInput: (event: Event) => setValue('label', (event.target as HTMLInputElement).value),
            }),
            h('button', { class: 'own-form__save', onClick: () => save() }, 'ok'),
          ]),
      },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()
    await flushPromises()

    await wrapper.find('[aria-label^="Tailscale VPS"]').trigger('click')
    await nextTick()

    const panel = wrapper.find('.vam-details')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    // Ни одного инпута пакета: форма целиком потребительская.
    expect(panel.findAll('.vam-fields__input')).toHaveLength(0)
    expect(panel.find('.own-form__id').text()).toBe('vps-tailscale')
    expect(panel.find('.own-form__count').text()).toBe('2')

    await panel.find('.own-form__input').setValue('Своим контролом')
    await panel.find('.own-form__save').trigger('click')
    await nextTick()

    const payload = wrapper.emitted('entity-update')?.at(-1)?.[0] as { entity: { label: string } }
    expect(payload.entity.label).toBe('Своим контролом')

    wrapper.unmount()
  })

  it('у связи тип редактируется выбором из объявленных типов', async () => {
    const wrapper = await mountMap({ editable: true, linkTypes, view: 'physical' })

    await wrapper.find('.vam-edge__hit').trigger('click')
    await flushPromises()
    await nextTick()

    const panel = wrapper.find('.vam-link-details')
    await panel.find('.vam-window__action--primary').trigger('click')
    await nextTick()

    const select = panel.find('select.vam-fields__input')
    expect(select.exists()).toBe(true)
    // Пустой вариант плюс три объявленных типа.
    expect(select.findAll('option')).toHaveLength(4)
    expect(select.text()).toContain('Wi-Fi')

    wrapper.unmount()
  })
})
