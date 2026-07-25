# network-map

Интерактивная карта сетевой инфраструктуры для Vue 3 на базе [VueFlow](https://vueflow.dev).

Библиотека рендерит граф активов: узлы (хосты, роутеры, VPS, гипервизоры, облака), связи между ними, переключение между
**проекциями** одного графа (физическая топология, VPN-оверлей, что угодно ещё), поиск с фильтрами, панель подробностей,
свёртку крупных групп однотипных узлов и светлую/тёмную темы.

Пакет **не знает** ничего о вашем бэкенде, ваших типах активов и полях в панели подробностей. Всё это задаёте вы.

- [Установка](#установка)
- [Минимальный пример](#минимальный-пример)
- [Props](#props)
- [Двусторонние привязки](#двусторонние-привязки)
- [События](#события)
- [Слоты](#слоты)
- [Императивный API](#императивный-api)
- [Свои узлы и рёбра](#свои-узлы-и-рёбра)
- [Внешний вид узла](#как-выглядит-узел-по-умолчанию)
- [Темизация](#темизация)
- [Свои раскладки](#свои-раскладки)
- [Свёртка групп](#свёртка-групп)
- [Поиск и фильтры](#поиск-и-фильтры)
- [Локализация](#локализация)
- [Ядро без Vue](#ядро-без-vue)
- [Доступность](#доступность)
- [SSR](#ssr)

## Установка

```bash
pnpm add network-map vue @vue-flow/core
```

`vue` и `@vue-flow/core` — **peer**-зависимости. VueFlow должен быть в дереве зависимостей ровно один раз: он работает
через `provide`/`inject`, и две копии ломают контекст провайдера.

Подключите два файла стилей — структурные стили VueFlow и токены темы пакета:

```ts
import '@vue-flow/core/dist/style.css'
import 'network-map/style.css'
```

> Стили VueFlow подключаете вы, а не пакет: из опубликованного CSS нельзя надёжно разрешить путь к CSS peer-зависимости.
> Пакет также не импортирует CSS из JS — иначе модуль нельзя было бы загрузить в чистом Node (SSR без бандлера).

## Минимальный пример

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { NetworkMap, type NetworkEntity, type NetworkLink, type NetworkView } from 'network-map'
import '@vue-flow/core/dist/style.css'
import 'network-map/style.css'

const entities: NetworkEntity[] = [
  { id: 'internet', kind: 'cloud', label: 'Интернет', status: 'online' },
  { id: 'router', kind: 'router', label: 'Keenetic 1', sublabels: ['pteam.keenetic.pro'] },
  { id: 'host', kind: 'workstation', label: 'Dmitry', sublabels: ['10.38.24.72'], parentId: 'router' },
]

const links: NetworkLink[] = [
  { id: 'l1', source: 'internet', target: 'router', layers: ['physical'] },
  { id: 'l2', source: 'router', target: 'host', layers: ['physical'] },
]

const views: NetworkView[] = [{ id: 'physical', label: 'Физическая топология' }]

const selection = ref<string[]>([])
</script>

<template>
  <!-- Карта занимает весь размер контейнера: задайте ему высоту. -->
  <div style="height: 600px">
    <NetworkMap v-model:selection="selection" :entities="entities" :links="links" :views="views" />
  </div>
</template>
```

Карта растягивается на 100% ширины и высоты родителя. Без высоты у контейнера полотно будет нулевой высоты.

## Props

| Prop                        | Тип                               | Дефолт               | Описание                                                              |
| --------------------------- | --------------------------------- | -------------------- | --------------------------------------------------------------------- |
| `entities`                  | `NetworkEntity<E>[]`              | —                    | Узлы графа. Только чтение: пакет их не мутирует.                      |
| `links`                     | `NetworkLink<L>[]`                | —                    | Связи. Только чтение.                                                 |
| `views`                     | `NetworkView[]`                   | `undefined`          | Проекции графа. Без них видно весь граф целиком.                      |
| `nodeTypes`                 | `Record<string, Component>`       | `{}`                 | Реестр компонентов узлов: `kind` → компонент. Мержится с дефолтным.   |
| `edgeTypes`                 | `Record<string, Component>`       | `{}`                 | Реестр компонентов рёбер: `link.kind` → компонент.                    |
| `layout`                    | `{ engine, options? }`            | `undefined`          | Раскладка. Сильнее, чем `view.layout`. Без обоих — `manual`.          |
| `collapse`                  | `CollapseRule \| false`           | правило по умолчанию | Свёртка групп. `false` выключает её полностью.                        |
| `filterOptions`             | `FilterOptions`                   | `{}`                 | Настройки поиска: глубина соседей, поля поиска, `keepPathToRoot`.     |
| `theme`                     | `'light' \| 'dark' \| 'auto'`     | `'light'`            | Тема. `auto` читает систему один раз при инициализации.               |
| `themeConfig`               | `{ statusColors?, kindIcons? }`   | `{}`                 | `status` → цвет, `kind` → компонент иконки.                           |
| `locale`                    | `string \| PartialLocaleMessages` | `'ru'`               | Код встроенной локали или свой словарь (можно частичный).             |
| `showToolbar`               | `boolean`                         | `true`               | Встроенный тулбар с поиском, видами и фильтрами.                      |
| `showDetailsPanel`          | `boolean`                         | `true`               | Панель подробностей справа.                                           |
| `showMinimap`               | `boolean`                         | `false`              | Обзорная карта в углу полотна.                                        |
| `onlyRenderVisibleElements` | `boolean`                         | `true`               | Рендерить только попавшие во вьюпорт элементы.                        |
| `lodThreshold`              | `number`                          | `0.5`                | Масштаб, ниже которого узлы рисуются упрощённо (иконка без подписей). |
| `searchDebounce`            | `number`                          | `200`                | Задержка применения поискового запроса, мс.                           |
| `loading`                   | `boolean`                         | `false`              | Показать индикатор поверх полотна.                                    |

Дженерики `NetworkMapProps<E, L>` задают тип ваших `meta`:

```vue
<NetworkMap :entities="entities" :links="links" />
<!-- entities: NetworkEntity<AssetMeta>[] → в слотах и событиях meta уже типизирован -->
```

## Двусторонние привязки

Все привязки **необязательны**: без `v-model` компонент управляет состоянием сам.

| Привязка                   | Тип             | Описание                                     |
| -------------------------- | --------------- | -------------------------------------------- |
| `v-model:view`             | `string`        | id активного вида.                           |
| `v-model:selection`        | `EntityId[]`    | Выделенные узлы. Первый — тот, что в панели. |
| `v-model:expanded`         | `Set<string>`   | id раскрытых вручную групп.                  |
| `v-model:filters`          | `FilterState`   | Запрос и фасеты.                             |
| `v-model:viewport`         | `Viewport`      | Сдвиг и масштаб полотна.                     |
| `v-model:collapsedNodes`   | `Set<EntityId>` | Узлы, чьи потомки скрыты кнопкой на узле.    |
| `v-model:openFilterGroups` | `string[]`      | Раскрытые списки в панели фильтров.          |

Состояние наружу уходит только через привязки: пакет не пишет в `localStorage` и `sessionStorage`. Хотите сохранять
раскрытые группы между сессиями — сохраняйте `expanded` сами.

## События

| Событие             | Payload                                             |
| ------------------- | --------------------------------------------------- |
| `node-click`        | `{ id, entity, group, event }`                      |
| `node-dblclick`     | `{ id, entity, group, event }`                      |
| `node-context-menu` | `{ id, entity, group, event }`                      |
| `edge-click`        | `{ id, event }`                                     |
| `pane-click`        | `MouseEvent`                                        |
| `expand`            | `{ groupId, group }`                                |
| `collapse`          | `{ groupId, group }`                                |
| `selection-change`  | `EntityId[]`                                        |
| `layout-start`      | `string` — имя движка                               |
| `layout-done`       | `{ engine, positions }`                             |
| `error`             | `unknown` — ошибка раскладки или неизвестный движок |

У событий по узлу заполнено либо `entity` (обычный узел), либо `group` (свёрнутая группа).

## Слоты

| Слот             | Параметры                               | Назначение                                |
| ---------------- | --------------------------------------- | ----------------------------------------- |
| `node-{kind}`    | `{ entity, nodeId, simplified }`        | Полная замена рендера узлов этого типа.   |
| `node-badge`     | `{ badge, entity, nodeId, simplified }` | Свой рендер бейджа.                       |
| `edge-label`     | `{ link, aggregated, count }`           | Своя подпись ребра.                       |
| `details`        | `{ entity, close, tab }`                | Содержимое панели подробностей.           |
| `details-header` | `{ entity, close }`                     | Шапка панели.                             |
| `toolbar-left`   | —                                       | Слева в тулбаре, до встроенных контролов. |
| `toolbar-right`  | —                                       | Справа в тулбаре.                         |
| `empty`          | —                                       | Когда показывать нечего.                  |
| `loading`        | —                                       | Пока `loading: true`.                     |

Подробности показываются **плавающим перетаскиваемым окном**, а не приклеенным сайдбаром: карту читают по путям между
узлами, и панель, съедающая треть полотна, обрезает как раз то, что рассматривают. Окно тянут за шапку, сжимают до
высоты шапки и закрывают.

Наполняет его не пакет: он рендерит окно, шапку с именем и типом, кнопки закрытия и сжатия и табы, а
содержимое отдаёт в `#details`. Встроенный плоский список полей из `meta` — только fallback для демо: пакет не знает,
какие ваши поля важны.

```vue
<NetworkMap :entities="entities" :links="links">
  <template #details="{ entity, tab, close }">
    <MyAssetCard v-if="tab === 'overview'" :asset="entity.meta" @close="close" />
    <MyAssetLinks v-else :id="entity.id" />
  </template>
</NetworkMap>
```

## Императивный API

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { NetworkMap, type NetworkMapExposed } from 'network-map'

const map = useTemplateRef<NetworkMapExposed>('map')

async function showPath() {
  const path = map.value?.highlightPath('ws-artjom', 'vps-nginx')
  await map.value?.focus('vps-nginx', { zoom: 1.2 })
}
</script>

<template>
  <NetworkMap ref="map" :entities="entities" :links="links" />
</template>
```

| Метод                     | Описание                                                                |
| ------------------------- | ----------------------------------------------------------------------- |
| `fitView()`               | Вписать всю карту во вьюпорт.                                           |
| `focus(id, opts?)`        | Центрировать на узле; по умолчанию заодно выделяет его.                 |
| `relayout()`              | Пересчитать раскладку заново.                                           |
| `highlightPath(from, to)` | Подсветить путь; возвращает найденный путь в исходных id.               |
| `clearHighlight()`        | Снять подсветку.                                                        |
| `getGraph()`              | Индексы графа: `entities`, `links`, `adjacency`, `childrenOf`, `roots`. |

## Свои узлы и рёбра

Два способа. Слот — когда нужно поменять вид одного-двух типов:

```vue
<NetworkMap :entities="entities" :links="links">
  <template #node-router="{ entity, simplified }">
    <div class="my-router" :class="{ 'my-router--small': simplified }">
      {{ entity?.label }}
    </div>
  </template>
</NetworkMap>
```

Реестр компонентов — когда узел сложный и живёт своим файлом:

```vue
<script setup lang="ts">
import RouterNode from './RouterNode.vue'

const nodeTypes = { router: RouterNode }
</script>

<template>
  <NetworkMap :node-types="nodeTypes" :entities="entities" :links="links" />
</template>
```

Компонент узла получает props `{ id, data }`, где `data` — `{ variant: 'entity', entity }` или
`{ variant: 'group', group }`. Всё остальное — выделение, подсветку, LOD, локаль, иконки — берите из контекста карты:

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { useMapContext, type NetworkNodeData } from 'network-map'

const props = defineProps<{ id: string; data?: NetworkNodeData }>()
const map = useMapContext()
</script>

<template>
  <div
    :class="{ selected: map.isSelected(id), dimmed: map.isDimmed(id) }"
    @click="map.onNodeClick(id, $event)"
  >
    <!-- Хэндлы обязательны: к ним крепятся рёбра. -->
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />
    {{ data?.variant === 'entity' ? data.entity.label : '' }}
  </div>
</template>
```

Клики пропускайте через контекст, а не через события VueFlow: у VueFlow своё состояние выделения, а источником истины
должен остаться `v-model:selection`.

Рёбра работают так же: `edgeTypes` сопоставляет `link.kind` компоненту. Дефолтное ребро понимает `kind: 'solid'`,
`'dashed'` и `'dotted'`.

## Темизация

Все цвета, отступы, радиусы и шрифты — CSS custom properties на корневом элементе `.vnm-root`. В компонентах нет ни
одного литерального цвета, и это проверяется тестом.

Тёмная тема включается **классом** `.vnm-theme-dark`, а не `@media (prefers-color-scheme)`: явный переключатель в
продукте должен побеждать системную настройку.

Переопределяйте токены на своём контейнере:

```css
.my-app .vnm-root {
  --vnm-accent: #7c3aed;
  --vnm-node-radius: 4px;
  --vnm-font: 'Inter', sans-serif;
}
```

Основные токены:

| Токен                       | Назначение                                 |
| --------------------------- | ------------------------------------------ |
| `--vnm-bg`                  | Фон полотна                                |
| `--vnm-surface`             | Фон контролов, окна, кругов узлов          |
| `--vnm-surface-sunken`      | Шапка окна подробностей, вдавленные плашки |
| `--vnm-fg`                  | Основной текст                             |
| `--vnm-fg-subtle`           | Заголовки фильтров, подписи контролов      |
| `--vnm-fg-muted`            | Второстепенный текст, иконки               |
| `--vnm-border`              | Границы                                    |
| `--vnm-accent`              | Акцент, рамка выделенного узла, чекбоксы   |
| `--vnm-accent-soft`         | Фон активного режима в переключателе видов |
| `--vnm-edge`                | Обычные рёбра                              |
| `--vnm-edge-active`         | Пунктирные и подсвеченные рёбра            |
| `--vnm-status-online`       | Индикатор состояния                        |
| `--vnm-status-offline`      | Индикатор состояния                        |
| `--vnm-status-warning`      | Индикатор состояния                        |
| `--vnm-node-size`           | Диаметр круга дочернего узла               |
| `--vnm-node-size-root`      | Диаметр круга корневого узла               |
| `--vnm-node-label-gap`      | Отступ от круга до подписи                 |
| `--vnm-node-label-width`    | Ширина блока подписей                      |
| `--vnm-node-label-color`    | Цвет имени узла                            |
| `--vnm-node-sublabel-color` | Цвет внешнего адреса                       |
| `--vnm-node-overlay-color`  | Цвет оверлейного адреса                    |
| `--vnm-node-radius`         | Радиус рамки выделения вокруг узла         |
| `--vnm-node-toggle-size`    | Размер кнопки свёртки поддерева            |
| `--vnm-node-status-size`    | Размер индикатора состояния                |
| `--vnm-window-width`        | Ширина окна подробностей                   |
| `--vnm-filter-width`        | Ширина панели фильтров                     |
| `--vnm-font`                | Шрифт                                      |

### Как выглядит узел по умолчанию

Круг с иконкой плюс блок подписей под ним. Корневые сущности (`parentId` пуст)
рисуются кругом `--vnm-node-size-root`, остальные — `--vnm-node-size`; уровень
читается по размеру, а не по отдельному полю в данных.

Подписи берутся из `label` и `sublabels`: первая строка — имя, вторая считается
внешним адресом, остальные — оверлейными, и цвета у них разные
(`--vnm-node-sublabel-color` против `--vnm-node-overlay-color`). Так в
VPN-оверлее внешний и внутренний адрес различаются с одного взгляда.

Индикатор состояния — круг в правом верхнем углу, цвет берётся из
`themeConfig.statusColors`. Иконка — из `themeConfig.kindIcons`; в её SVG
используйте `currentColor`, иначе она не отреагирует на смену темы.

Выделенный узел получает рамку `--vnm-accent` вокруг круга и подписи целиком.

### Свёртка поддерева кнопкой на узле

У узла с потомками в правом верхнем углу есть кнопка `--vnm-node-toggle-size`:
она прячет всё поддерево внутрь узла и возвращает обратно. Рёбра спрятанных
потомков переносятся на сам узел и схлопываются в `AggregatedLink` — связь не
теряется, только перестаёт быть детализированной.

Это не то же самое, что автоматическая свёртка групп: там появляется отдельный
групповой узел, здесь остаётся сама сущность. Состояние — в
`v-model:collapsedNodes`.

Значения `status` — ваши. Сопоставьте их цветам через `themeConfig`:

```vue
<NetworkMap
  :theme-config="{
    statusColors: {
      online: 'var(--vnm-status-online)',
      offline: 'var(--vnm-status-offline)',
      degraded: 'var(--vnm-status-warning)',
    },
  }"
  :entities="entities"
  :links="links"
/>
```

## Свои раскладки

Встроены `manual` (сетка с сохранением закреплённых позиций) и `radial` (кольца по расстоянию от корня).

```vue
<NetworkMap
  :layout="{ engine: 'radial', options: { rootId: 'internet' } }"
  :entities="entities"
  :links="links"
/>
```

`dagre` живёт в отдельном подпути, чтобы опциональная зависимость не попадала в основной бандл:

```bash
pnpm add @dagrejs/dagre
```

```ts
import { dagreLayout } from 'network-map/layout-dagre'
// :layout="{ engine: dagreLayout, options: { rankdir: 'LR' } }"
```

Свой движок — это объект с `name` и `run`:

```ts
import type { LayoutEngine } from 'network-map'

export const circleLayout: LayoutEngine<{ radius?: number }> = {
  name: 'circle',
  async run(graph, options, signal) {
    // AbortSignal обязателен: при новом запросе предыдущий отменяется, и
    // устаревший результат применять нельзя.
    if (signal?.aborted) throw new Error('aborted')

    const radius = options?.radius ?? 300
    const step = (Math.PI * 2) / Math.max(1, graph.nodes.length)

    return new Map(
      graph.nodes.map((node, index) => [
        node.id,
        // Закреплённые позиции не перезаписываем.
        node.pinned ?? { x: Math.cos(index * step) * radius, y: Math.sin(index * step) * radius },
      ]),
    )
  },
}
```

Приоритет позиций при применении результата: перетащенное мышью → `entity.position` с бэкенда → результат движка.
Первые два приходят в движок как `node.pinned`, поэтому ручные сдвиги не теряются при релэйауте.

Раскладка пересчитывается при смене вида, данных и состояния групп, но **не** при поиске: иначе карта прыгала бы на
каждой набранной букве.

## Свёртка групп

Больше 10 однотипных детей у одного родителя — и они сворачиваются в один раскрываемый узел. Порог и правило
группировки настраиваются:

```vue
<NetworkMap
  :collapse="{
    threshold: 20,
    groupBy: (entity) => entity.meta?.cluster ?? entity.kind,
    shouldCollapse: (parentId, children) => children.length > 5 && parentId !== 'internet',
  }"
  :entities="entities"
  :links="links"
/>
```

- Свёртка выполняется **до** раскладки: позиции считаются по уже схлопнутому графу.
- Рёбра участников переносятся на групповой узел; параллельные схлопываются в `AggregatedLink` с полем `count`.
- Рёбра внутри группы не рисуются, их число доступно как `group.internalLinkCount`.
- `groupBy`, вернувший `null`, означает «этот узел не группировать никогда».
- Ручное раскрытие (`v-model:expanded`) сильнее любого правила.
- Группа из одного узла не создаётся никогда: она прятала бы узел за узлом.

`collapse: false` выключает свёртку целиком.

## Поиск и фильтры

Поиск регистронезависимый, по подстроке, плюс адреса:

| Запрос          | Находит                           |
| --------------- | --------------------------------- |
| `dmitry`        | подстрока в `label` и `sublabels` |
| `10.38.24.*`    | хосты внутри подсети по маске     |
| `10.38.24.0/24` | то же по CIDR                     |
| `10.38.24.7*`   | `.7` и `.70`–`.79`                |

```vue
<NetworkMap
  :filter-options="{
    neighborDepth: 2,
    keepPathToRoot: true,
    searchFields: (entity) => [entity.label, entity.id, ...(entity.sublabels ?? [])],
  }"
  :entities="entities"
  :links="links"
/>
```

Совпадения подсвечиваются, соседи на `neighborDepth` шагов остаются видимыми, а `keepPathToRoot` достраивает цепочку до
корня — граф не рассыпается на изоляты.

### Свои списки фильтров

Панель фильтров наполняется данными, а не кодом. «Подсеть», «Тип актива»,
«Критичность» — это ваши группы, пакет о них ничего не знает:

```ts
import type { FilterGroupDef } from 'network-map'

const filterGroups: FilterGroupDef[] = [
  {
    id: 'subnet',
    label: 'Подсеть',
    // Какие значения группы несёт сущность. Дефолт — её `kind`.
    valuesOf: (entity) => [entity.meta?.subnet ?? ''],
    // Порядок и подписи ваши; без `options` значения собираются из данных.
    options: [
      { value: 'internet', label: 'Интернет' },
      { value: 'vpn', label: 'VPN' },
      { value: 'docker', label: 'Docker Bridge' },
    ],
  },
  {
    id: 'severity',
    label: 'Критичность',
    valuesOf: (entity) => [entity.meta?.severity ?? ''],
    options: [
      { value: 'critical', label: 'Критический' },
      { value: 'high', label: 'Высокий' },
    ],
    // Список свёрнут при первом открытии панели.
    defaultOpen: false,
  },
]
```

```vue
<NetworkMap
  v-model:filters="filters"
  v-model:open-filter-groups="openFilterGroups"
  :filter-options="{ groups: filterGroups }"
  :entities="entities"
  :links="links"
/>
```

Выбор попадает в `filters.groups` (`{ subnet: ['vpn'] }`): внутри группы значения
соединяются по ИЛИ, группы между собой — по И. Счётчики значений считаются по
проекции вида, а не по результату фильтра, поэтому выбор значения не обнуляет
остальные и снять его всегда есть куда.

Без `groups` панель показывает встроенные фасеты по `kind` и `status`, собранные
из самих сущностей.

Какие списки раскрыты — в `v-model:openFilterGroups`. Пакет не пишет в
`localStorage`, поэтому сохранять это между сессиями решает приложение:

```ts
const openFilterGroups = ref<string[] | undefined>(
  JSON.parse(localStorage.getItem('vnm:filters') ?? 'null') ?? undefined,
)
watch(openFilterGroups, (value) => localStorage.setItem('vnm:filters', JSON.stringify(value)))
```

## Ядро без Vue

Индексы, проекции, свёртка, фильтры и обходы — чистый TypeScript без Vue и VueFlow. Их можно использовать отдельно,
например на сервере:

```ts
import { blastRadius, buildGraph, findPaths, projectGraph } from 'network-map/core'

const graph = buildGraph(entities, links)

const overlay = projectGraph(graph, { id: 'logical', label: 'VPN', hideIsolated: true })
const paths = findPaths(graph, 'ws-artjom', 'vps-nginx', { maxPaths: 3, layers: ['logical'] })
const affected = blastRadius(graph, 'keenetic-2', { direction: 'downstream' })
```

Битые входные данные не роняют построение: дубли id, связи в несуществующие узлы и циклы в иерархии починяются, а
сообщения приходят колбэком.

```ts
const graph = buildGraph(entities, links, {
  onIssue: (issue) => console.warn(issue.code, issue.id, issue.detail),
})
```

## Доступность

- Tab перемещает фокус по узлам, Enter выделяет, Escape закрывает панель, стрелки переходят к соседям по направлению.
- Видимый focus-ring на всех интерактивных элементах, не только `:hover`.
- `role="application"` у полотна, `aria-label` у иконок и кнопок, `role="tablist"` у табов панели.
- Счётчик результатов поиска — live-область, о результате сообщают, не уводя фокус из поля.
- `--vnm-transition` обнуляется при `prefers-reduced-motion: reduce`.

## SSR

Пакет импортируется на сервере: обращений к `window` и `document` на верхнем уровне модулей нет, а CSS не импортируется
из JS. Само полотно VueFlow рендерится только в браузере — оборачивайте карту в `<ClientOnly>` (Nuxt) или его аналог.

## Лицензия

MIT
