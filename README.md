# vue-asset-map

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
- [Окна](#окна)
- [Подсветка связей и «заражение»](#подсветка-связей-и-заражение)
- [Маркеры принадлежности](#маркеры-принадлежности)
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
pnpm add vue-asset-map vue @vue-flow/core
```

`vue` и `@vue-flow/core` — **peer**-зависимости. VueFlow должен быть в дереве зависимостей ровно один раз: он работает
через `provide`/`inject`, и две копии ломают контекст провайдера.

Подключите два файла стилей — структурные стили VueFlow и токены темы пакета:

```ts
import '@vue-flow/core/dist/style.css'
import 'vue-asset-map/style.css'
```

> Стили VueFlow подключаете вы, а не пакет: из опубликованного CSS нельзя надёжно разрешить путь к CSS peer-зависимости.
> Пакет также не импортирует CSS из JS — иначе модуль нельзя было бы загрузить в чистом Node (SSR без бандлера).

## Минимальный пример

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap, type AssetEntity, type AssetLink, type AssetView } from 'vue-asset-map'
import '@vue-flow/core/dist/style.css'
import 'vue-asset-map/style.css'

const entities: AssetEntity[] = [
  { id: 'internet', kind: 'cloud', label: 'Интернет', status: 'online' },
  { id: 'router', kind: 'router', label: 'Keenetic 1', sublabels: ['pteam.keenetic.pro'] },
  { id: 'host', kind: 'workstation', label: 'Dmitry', sublabels: ['10.38.24.72'], parentId: 'router' },
]

const links: AssetLink[] = [
  { id: 'l1', source: 'internet', target: 'router', layers: ['physical'] },
  { id: 'l2', source: 'router', target: 'host', layers: ['physical'] },
]

const views: AssetView[] = [{ id: 'physical', label: 'Физическая топология' }]

const selection = ref<string[]>([])
</script>

<template>
  <!-- Карта занимает весь размер контейнера: задайте ему высоту. -->
  <div style="height: 600px">
    <AssetMap v-model:selection="selection" :entities="entities" :links="links" :views="views" />
  </div>
</template>
```

Карта растягивается на 100% ширины и высоты родителя. Без высоты у контейнера полотно будет нулевой высоты.

## Props

| Prop                        | Тип                               | Дефолт               | Описание                                                               |
| --------------------------- | --------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `entities`                  | `AssetEntity<E>[]`              | —                    | Узлы графа. Только чтение: пакет их не мутирует.                       |
| `links`                     | `AssetLink<L>[]`                | —                    | Связи. Только чтение.                                                  |
| `views`                     | `AssetView[]`                   | `undefined`          | Проекции графа. Без них видно весь граф целиком.                       |
| `nodeTypes`                 | `Record<string, Component>`       | `{}`                 | Реестр компонентов узлов: `kind` → компонент. Мержится с дефолтным.    |
| `edgeTypes`                 | `Record<string, Component>`       | `{}`                 | Реестр компонентов рёбер: `link.kind` → компонент.                     |
| `layout`                    | `{ engine, options? }`            | `undefined`          | Раскладка. Сильнее, чем `view.layout`. Без обоих — `manual`.           |
| `collapse`                  | `CollapseRule \| false`           | правило по умолчанию | Свёртка групп. `false` выключает её полностью.                         |
| `filterOptions`             | `FilterOptions`                   | `{}`                 | Настройки поиска: глубина соседей, поля поиска, `keepPathToRoot`.      |
| `theme`                     | `'light' \| 'dark' \| 'auto'`     | `'light'`            | Тема. `auto` читает систему один раз при инициализации.                |
| `themeConfig`               | `{ statusColors?, kindIcons? }`   | `{}`                 | `status` → цвет, `kind` → компонент иконки.                            |
| `locale`                    | `string \| PartialLocaleMessages` | `'ru'`               | Код встроенной локали или свой словарь (можно частичный).              |
| `showToolbar`               | `boolean`                         | `true`               | Встроенный тулбар с поиском, видами и фильтрами.                       |
| `showDetailsPanel`          | `boolean`                         | `true`               | Окна подробностей.                                                     |
| `showMinimap`               | `boolean`                         | `false`              | Обзорная карта в углу полотна.                                         |
| `maxDetailsWindows`         | `number`                          | `2`                  | Сколько окон подробностей открыто одновременно.                        |
| `neighborHighlightDepth`    | `number`                          | `1`                  | На сколько шагов подсвечивать связи выделенного узла. `0` — выключить. |
| `infected`                  | `EntityId[]`                      | `[]`                 | Помеченные «заражёнными» сущности.                                     |
| `infectionOptions`          | `InfectionOptions`                | `{}`                 | Как считать распространение захвата.                                   |
| `markers`                   | `NodeMarkerDef[]`                 | `[]`                 | Маркеры принадлежности — кружки под подписью узла.                     |
| `markerHoverDelay`          | `number`                          | `500`                | Задержка перед подсветкой при наведении на кружок, мс.                 |
| `onlyRenderVisibleElements` | `boolean`                         | `true`               | Рендерить только попавшие во вьюпорт элементы.                         |
| `lodThreshold`              | `number`                          | `0.5`                | Масштаб, ниже которого узлы рисуются упрощённо (иконка без подписей).  |
| `searchDebounce`            | `number`                          | `200`                | Задержка применения поискового запроса, мс.                            |
| `loading`                   | `boolean`                         | `false`              | Показать индикатор поверх полотна.                                     |

Дженерики `AssetMapProps<E, L>` задают тип ваших `meta`:

```vue
<AssetMap :entities="entities" :links="links" />
<!-- entities: AssetEntity<AssetMeta>[] → в слотах и событиях meta уже типизирован -->
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
| `v-model:openDetails`      | `EntityId[]`    | Сущности открытых окон; последняя — сверху.  |

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
| `windows`        | —                                       | Свои окна поверх окон подробностей.       |

Подробности показываются **плавающим перетаскиваемым окном**, а не приклеенным сайдбаром: карту читают по путям между
узлами, и панель, съедающая треть полотна, обрезает как раз то, что рассматривают. Окно тянут за шапку, сжимают до
высоты шапки и закрывают.

Наполняет его не пакет: он рендерит окно, шапку с именем и типом, кнопки закрытия и сжатия и табы, а
содержимое отдаёт в `#details`. Встроенный плоский список полей из `meta` — только fallback для демо: пакет не знает,
какие ваши поля важны.

```vue
<AssetMap :entities="entities" :links="links">
  <template #details="{ entity, tab, close }">
    <MyAssetCard v-if="tab === 'overview'" :asset="entity.meta" @close="close" />
    <MyAssetLinks v-else :id="entity.id" />
  </template>
</AssetMap>
```

## Императивный API

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { AssetMap, type AssetMapExposed } from 'vue-asset-map'

const map = useTemplateRef<AssetMapExposed>('map')

async function showPath() {
  const path = map.value?.highlightPath('ws-artjom', 'vps-nginx')
  await map.value?.focus('vps-nginx', { zoom: 1.2 })
}
</script>

<template>
  <AssetMap ref="map" :entities="entities" :links="links" />
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
<AssetMap :entities="entities" :links="links">
  <template #node-router="{ entity, simplified }">
    <div class="my-router" :class="{ 'my-router--small': simplified }">
      {{ entity?.label }}
    </div>
  </template>
</AssetMap>
```

Реестр компонентов — когда узел сложный и живёт своим файлом:

```vue
<script setup lang="ts">
import RouterNode from './RouterNode.vue'

const nodeTypes = { router: RouterNode }
</script>

<template>
  <AssetMap :node-types="nodeTypes" :entities="entities" :links="links" />
</template>
```

Компонент узла получает props `{ id, data }`, где `data` — `{ variant: 'entity', entity }` или
`{ variant: 'group', group }`. Всё остальное — выделение, подсветку, LOD, локаль, иконки — берите из контекста карты:

```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { useMapContext, type AssetNodeData } from 'vue-asset-map'

const props = defineProps<{ id: string; data?: AssetNodeData }>()
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

## Окна

Подробности живут в плавающих окнах. По умолчанию их можно держать два;
`maxDetailsWindows` меняет лимит. Окна не приходится закрывать — их достаточно
свернуть до шапки:

```vue
<AssetMap v-model:open-details="openDetails" :max-details-windows="3" :entities="entities" :links="links" />
```

При достижении лимита закрывается самое старое окно. Уже открытое окно повторным
кликом не дублируется, а поднимается наверх. `Escape` закрывает верхнее окно, по
одному за нажатие. `maxDetailsWindows: 0` отключает окна, не убирая остальной
интерфейс.

### Свои окна

`<MapWindow>` — тот же каркас, на котором построено окно подробностей: шапка,
перетаскивание, сжатие, закрытие и токены темы. Собирайте из него свои окна и
кладите в слот `#windows` — он рендерится поверх окон подробностей:

```vue
<AssetMap :entities="entities" :links="links">
  <template #windows>
    <!-- Окно из одной шапки, которое нельзя закрыть: история событий. -->
    <MapWindow class="my-history" header-only drag-handle :closable="false" :collapsible="false">
      <template #header>
        <button type="button" @click="stepBack">←</button>
        <span>{{ currentMoment }}</span>
        <button type="button" @click="stepForward">→</button>
      </template>
    </MapWindow>
  </template>
</AssetMap>
```

```css
/* Позиционирует окно приложение: `transform` от перетаскивания складывается
   с вашими top/right. */
.my-history {
  top: 12px;
  right: 12px;
}
```

| Prop               | Тип       | Дефолт  | Описание                                    |
| ------------------ | --------- | ------- | ------------------------------------------- |
| `title`            | `string`  | —       | Подпись в центре шапки.                     |
| `closable`         | `boolean` | `true`  | Кнопка закрытия.                            |
| `collapsible`      | `boolean` | `true`  | Кнопка сжатия до высоты шапки.              |
| `headerOnly`       | `boolean` | `false` | Окно без тела: только шапка.                |
| `dragHandle`       | `boolean` | `false` | Ручка перетаскивания слева.                 |
| `offset`           | `XY`      | `{0,0}` | Начальный сдвиг.                            |
| `closeLabel` и др. | `string`  | локаль  | Свои подписи кнопок вместо строк из локали. |

Слоты: `#header` (содержимое шапки, получает `{ collapsed }`) и `#default`
(тело). Событие `close` и `collapse-change`.

## Подсветка связей и «заражение»

Выделенный узел остаётся ярким вместе со своими связями, всё остальное
затемняется. Глубина — `neighborHighlightDepth` (дефолт 1, `0` выключает).
Связи считаются по слоям текущего вида, поэтому в физическом виде подсветятся
физические соседи, а в оверлее — оверлейные.

Пока активен поиск, он главнее: смешивать два режима затемнения нельзя.

«Заражение» помечает сущности и показывает **всё, что они захватывают** —
набор считается через `blastRadius`, поэтому распространение видно целиком:

```vue
<AssetMap
  :infected="['vps-tailscale']"
  :infection-options="{ direction: 'downstream', maxDepth: 2 }"
  :entities="entities"
  :links="links"
/>
```

Захваченные узлы получают класс `vam-node--infected` (помеченные вручную — ещё и
`vam-node--infection-source`), связи внутри захвата — `vam-edge--infected`.
Красится связь только когда заражены **оба** её конца: ребро с одним заражённым
концом — это ровно та связь, по которой захват не прошёл.

Цвета — четыре токена:

| Токен                   | Назначение                      |
| ----------------------- | ------------------------------- |
| `--vam-infected-bg`     | Заливка круга и плашки подписей |
| `--vam-infected-border` | Обводка круга и плашки          |
| `--vam-infected-fg`     | Цвет иконки                     |
| `--vam-infected-edge`   | Цвет заражённых связей          |

## Маркеры принадлежности

Кружки под подписью узла показывают те же группировки, что и связи, но читаются
взглядом — нажимать на узел не нужно.

Обычный случай — принадлежность к «центрам»: роутерам, координаторам, кластерам.
Она выводится из связей графа, поэтому `connectionMarkers` считает её за вас:

```ts
import { connectionMarkers } from 'vue-asset-map/core'

const markers = connectionMarkers([
  { id: 'keenetic-1', label: 'Keenetic 1' },
  { id: 'keenetic-2', label: 'Keenetic 2' },
  { id: 'vps-tailscale', label: 'Tailscale VPS' },
])
```

Узел получает кружок каждого центра, с которым связан, — и **сразу несколько**,
если связан с несколькими. Рабочая станция, подключённая к роутеру физически и к
координатору VPN логически, получит два кружка. Слои по умолчанию не
ограничиваются именно поэтому: смысл кружков — показать полную принадлежность, не
переключая вид.

Опорные узлы можно не перечислять руками, а взять самые связанные:

```ts
import { buildGraph, connectionMarkers, topAnchors } from 'vue-asset-map/core'

const graph = buildGraph(entities, links)
const markers = connectionMarkers(topAnchors(graph, 3))
```

| Опция           | Дефолт | Описание                                          |
| --------------- | ------ | ------------------------------------------------- |
| `depth`         | `1`    | На сколько шагов от центра считать принадлежность |
| `layers`        | все    | Ограничить слоями связей                          |
| `includeAnchor` | `true` | Включать сам центр в свой маркер                  |

Если принадлежность видна из самой сущности, а не из связей, вместо `members`
задаётся предикат:

```ts
import type { NodeMarkerDef } from 'vue-asset-map'

const markers: NodeMarkerDef[] = [
  { id: 'critical', label: 'Критичные', match: (entity) => entity.meta?.severity === 'critical' },
]
```

`members` дешевле: он вызывается один раз на смену графа, тогда как `match` — на
каждую сущность.

```vue
<AssetMap :markers="markers" :marker-hover-delay="500" :entities="entities" :links="links" />
```

Наведение на кружок подсвечивает всех, у кого он есть, и затемняет остальных.
Подсветка включается после задержки `markerHoverDelay` (дефолт 500 мс), чтобы
курсор, проходящий над кружками по пути к чему-то другому, не устраивал мигание
всей карты. Уход курсора отменяет и ожидание, и уже включённую подсветку. Кружки
— настоящие кнопки, поэтому работают и с клавиатуры: фокус подсвечивает сразу,
без задержки.

Порядок кружков повторяет порядок `markers`, поэтому один и тот же маркер у
разных узлов всегда стоит на одном месте. Цвет берётся из `marker.color`, а без
него раздаётся из палитры по порядку объявления. У заражённого узла кружки
красятся цветом заражения независимо от своего.

| Токен                   | Назначение                       |
| ----------------------- | -------------------------------- |
| `--vam-marker-1..3`     | Палитра обычных маркеров         |
| `--vam-marker-infected` | Цвет маркеров заражённого узла   |
| `--vam-marker-size`     | Диаметр кружка                   |
| `--vam-marker-dot-size` | Диаметр заполнения внутри кружка |
| `--vam-marker-gap`      | Расстояние между кружками        |
| `--vam-marker-offset`   | Отступ от плашки подписей        |
| `--vam-marker-bg`       | Фон кружка под заполнением       |

Приоритет затемнения, когда несколько режимов активны сразу: наведение на маркер
→ поиск → выделение. Наведение самое короткое и самое свежее действие, поэтому
пока курсор на кружке, показывается именно принадлежность.

## Темизация

Все цвета, отступы, радиусы и шрифты — CSS custom properties на корневом элементе `.vam-root`. В компонентах нет ни
одного литерального цвета, и это проверяется тестом.

Тёмная тема включается **классом** `.vam-theme-dark`, а не `@media (prefers-color-scheme)`: явный переключатель в
продукте должен побеждать системную настройку.

Переопределяйте токены на своём контейнере:

```css
.my-app .vam-root {
  --vam-accent: #7c3aed;
  --vam-node-radius: 4px;
  --vam-font: 'Inter', sans-serif;
}
```

Основные токены:

| Токен                       | Назначение                                 |
| --------------------------- | ------------------------------------------ |
| `--vam-bg`                  | Фон полотна                                |
| `--vam-surface`             | Фон контролов, окна, кругов узлов          |
| `--vam-surface-sunken`      | Шапка окна подробностей, вдавленные плашки |
| `--vam-fg`                  | Основной текст                             |
| `--vam-fg-subtle`           | Заголовки фильтров, подписи контролов      |
| `--vam-fg-muted`            | Второстепенный текст, иконки               |
| `--vam-border`              | Границы                                    |
| `--vam-accent`              | Акцент, рамка выделенного узла, чекбоксы   |
| `--vam-accent-soft`         | Фон активного режима в переключателе видов |
| `--vam-edge`                | Обычные рёбра                              |
| `--vam-edge-active`         | Пунктирные и подсвеченные рёбра            |
| `--vam-status-online`       | Индикатор состояния                        |
| `--vam-status-offline`      | Индикатор состояния                        |
| `--vam-status-warning`      | Индикатор состояния                        |
| `--vam-node-size`           | Диаметр круга дочернего узла               |
| `--vam-node-size-root`      | Диаметр круга корневого узла               |
| `--vam-node-label-gap`      | Отступ от круга до подписи                 |
| `--vam-node-label-width`    | Ширина блока подписей                      |
| `--vam-node-label-color`    | Цвет имени узла                            |
| `--vam-node-sublabel-color` | Цвет внешнего адреса                       |
| `--vam-node-overlay-color`  | Цвет оверлейного адреса                    |
| `--vam-node-radius`         | Радиус рамки выделения вокруг узла         |
| `--vam-node-toggle-size`    | Размер кнопки свёртки поддерева            |
| `--vam-node-status-size`    | Размер индикатора состояния                |
| `--vam-window-width`        | Ширина окна подробностей                   |
| `--vam-filter-width`        | Ширина панели фильтров                     |
| `--vam-font`                | Шрифт                                      |

### Как выглядит узел по умолчанию

Круг с иконкой плюс блок подписей под ним. Корневые сущности (`parentId` пуст)
рисуются кругом `--vam-node-size-root`, остальные — `--vam-node-size`; уровень
читается по размеру, а не по отдельному полю в данных.

Подписи берутся из `label` и `sublabels`: первая строка — имя, вторая считается
внешним адресом, остальные — оверлейными, и цвета у них разные
(`--vam-node-sublabel-color` против `--vam-node-overlay-color`). Так в
VPN-оверлее внешний и внутренний адрес различаются с одного взгляда.

Индикатор состояния — круг в правом верхнем углу, цвет берётся из
`themeConfig.statusColors`. Иконка — из `themeConfig.kindIcons`; в её SVG
используйте `currentColor`, иначе она не отреагирует на смену темы.

Выделенный узел получает рамку `--vam-accent` вокруг круга и подписи целиком.

### Свёртка поддерева кнопкой на узле

У узла с потомками в правом верхнем углу есть кнопка `--vam-node-toggle-size`:
она прячет всё поддерево внутрь узла и возвращает обратно. Рёбра спрятанных
потомков переносятся на сам узел и схлопываются в `AggregatedLink` — связь не
теряется, только перестаёт быть детализированной.

Это не то же самое, что автоматическая свёртка групп: там появляется отдельный
групповой узел, здесь остаётся сама сущность. Состояние — в
`v-model:collapsedNodes`.

Значения `status` — ваши. Сопоставьте их цветам через `themeConfig`:

```vue
<AssetMap
  :theme-config="{
    statusColors: {
      online: 'var(--vam-status-online)',
      offline: 'var(--vam-status-offline)',
      degraded: 'var(--vam-status-warning)',
    },
  }"
  :entities="entities"
  :links="links"
/>
```

## Свои раскладки

Встроены `manual` (сетка с сохранением закреплённых позиций) и `radial` (кольца по расстоянию от корня).

```vue
<AssetMap
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
import { dagreLayout } from 'vue-asset-map/layout-dagre'
// :layout="{ engine: dagreLayout, options: { rankdir: 'LR' } }"
```

Свой движок — это объект с `name` и `run`:

```ts
import type { LayoutEngine } from 'vue-asset-map'

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
<AssetMap
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
<AssetMap
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
import type { FilterGroupDef } from 'vue-asset-map'

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
<AssetMap
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
  JSON.parse(localStorage.getItem('vam:filters') ?? 'null') ?? undefined,
)
watch(openFilterGroups, (value) => localStorage.setItem('vam:filters', JSON.stringify(value)))
```

## Ядро без Vue

Индексы, проекции, свёртка, фильтры и обходы — чистый TypeScript без Vue и VueFlow. Их можно использовать отдельно,
например на сервере:

```ts
import { blastRadius, buildGraph, findPaths, projectGraph } from 'vue-asset-map/core'

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
- `--vam-transition` обнуляется при `prefers-reduced-motion: reduce`.

## SSR

Пакет импортируется на сервере: обращений к `window` и `document` на верхнем уровне модулей нет, а CSS не импортируется
из JS. Само полотно VueFlow рендерится только в браузере — оборачивайте карту в `<ClientOnly>` (Nuxt) или его аналог.

## Лицензия

MIT
