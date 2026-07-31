# Узлы

Узел — это круг с иконкой, а под ним плашка с названием и подписями сущности. Корневые сущности рисуются размером
60 px, дочерние — 36 px. Это единственный визуальный признак уровня, а не поле в ваших данных.

Всё это необязательно. В этом оформлении нет ничего несущего: индикатор состояния, кнопку свёртки, плашку с подписями и
сами подписи можно по отдельности выключить пропом или подменить слотом, а оформление, у которого с этой структурой
ничего общего, делается компонентом в `nodeTypes`. Разделы ниже идут от наименьшего изменения к наибольшему.

## Иконки по типу

Пакет не знает ваших типов, поэтому не везёт иконок. Сопоставьте их сами:

```vue
<script setup lang="ts">
import { AssetMap } from 'vue-asset-map'
import CloudIcon from './icons/CloudIcon.vue'
import RouterIcon from './icons/RouterIcon.vue'

const kindIcons = { cloud: CloudIcon, router: RouterIcon }
</script>

<template>
  <AssetMap :entities="entities" :links="links" :theme-config="{ kindIcons }" />
</template>
```

Рисуйте иконки через `currentColor`. Иконка с зашитым цветом не отреагирует ни на переключение темы, ни на ваши
переопределения токенов. Тип без иконки показывает первые два символа своего имени.

## Индикатор состояния

`status` — открытая строка. Через `statusColors` он превращается в цветной кружок в правом верхнем углу круга:

```ts
const statusColors = {
  online: 'var(--vam-status-online)',
  offline: '#cb5555',
  degraded: '#e0a800',
}
```

Работают и ссылка на токен, и литеральный цвет. Ссылка на токен означает, что кружок следует за темой.

`showNodeStatus: false` убирает этот кружок — плашку «online / offline» — со всех узлов:

```vue
<AssetMap :entities="entities" :links="links" :show-node-status="false" />
```

Значение остаётся в данных: окна подробностей и фильтры по-прежнему видят `status`, пропадает только индикатор. Чтобы не
убрать, а нарисовать иначе, есть `#node-status`:

```vue
<template #node-status="{ status, statusColor }">
  <span class="my-status" :style="{ background: statusColor }">{{ status }}</span>
</template>
```

Слот рисуется на месте кружка, внутри круга. `showNodeStatus: false` главнее слота: «убрать индикатор» не должно
приходиться говорить дважды.

## Подписи под кругом

`sublabels` — обычный массив, и собственного предела длины у пакета нет: сущность с шестью подписями нарисует шесть
строк, а плашка вырастет под них. Две — это просто то, что лежит в примерах данных.

`maxSublabels` обрезает список, когда ровная высота узлов важнее полноты.

```vue
<AssetMap :entities="entities" :links="links" :max-sublabels="2" />
```

`0` убирает подписи совсем, оставляя название. Вид тоже может выключить их сразу для всех узлов через
`showSublabels: false` — это главнее `maxSublabels`.

`showNodeLabel: false` убирает всю плашку вместе с названием, оставляя на полотне один круг:

```vue
<AssetMap :entities="entities" :links="links" :show-node-label="false" />
```

Раскладка при этом всё равно резервирует высоту плашки, поэтому выключение не перестраивает карту.

`#node-label` не убирает плашку, а подменяет её. Слот получает подписи, уже суженные видом и `maxSublabels`, поэтому
переписывать эти правила ему не нужно:

```vue
<template #node-label="{ entity, sublabels }">
  <div class="my-plate">
    <b>{{ entity?.label }}</b>
    <small v-for="line in sublabels" :key="line">{{ line }}</small>
  </div>
</template>
```

## Как убрать кнопку свёртки

`showNodeToggle: false` убирает кнопку свёртки со всех узлов. Само состояние при этом не трогается: им по-прежнему можно
управлять через `v-model:collapsed-nodes` — именно так сворачивает узлы оформление без кнопки.

```vue
<AssetMap
  :entities="entities"
  :links="links"
  v-model:collapsed-nodes="collapsedNodes"
  :show-node-toggle="false"
/>
```

## Подмена содержимого круга

Слот `#node-{type}` подменяет то, что внутри круга, для одного типа, оставляя на месте плашку, индикатор состояния и
кнопку свёртки:

```vue
<AssetMap :entities="entities" :links="links">
  <template #node-workstation="{ entity, nodeId, simplified }">
    <span :title="entity?.label">{{ simplified ? '·' : entity?.label?.slice(0, 2) }}</span>
  </template>
</AssetMap>
```

`simplified` равен `true` ниже порога LOD, когда карта рисует только круги. Учитывайте его: содержимое слота рендерится
для каждого узла на экране.

<LiveDemo :source="customNodeSource" source-label="Показать исходник">
  <CustomNodeMap />
</LiveDemo>

## Полная замена узла

Для полного контроля зарегистрируйте компонент под типом. Он получает `id` и `data` от Vue Flow, а всё остальное
читает из контекста карты:

```vue
<!-- RouterNode.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useMapContext } from 'vue-asset-map'
import type { AssetNodeData } from 'vue-asset-map'

const props = defineProps<{ id: string; data?: AssetNodeData }>()
const map = useMapContext()

const entity = computed(() => (props.data?.variant === 'entity' ? props.data.entity : undefined))
</script>

<template>
  <div class="router-node" :class="{ selected: map.isSelected(id) }" @click="map.onNodeClick(id, $event)">
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />
    {{ entity?.label }}
  </div>
</template>
```

```vue
<AssetMap :entities="entities" :links="links" :node-types="{ router: RouterNode }" />
```

`useMapContext()` бросает понятную ошибку вне `<AssetMap>`, поэтому компонент, отрисованный не там, прямо об этом
скажет, а не упадёт где-то в глубине рендера.

Взаимодействия идут через контекст (`onNodeClick`, `onNodeDoubleClick`, `onNodeContextMenu`), а не через события Vue
Flow. Так поведение одинаково независимо от того, включено ли у Vue Flow собственное выделение.

## Рисование связей от узла

С `editable` при наведении на узел по краям круга появляются четыре точки захвата, и перетаскивание от одной из них к
другому узлу рисует связь. В покое они скрыты — четыре кружка на каждом узле были бы четырьмя элементами интерфейса на
узел на карте, рассчитанной на сотни, — а свой компонент узла рисует свои: `nodeTypes` заменяет этот компонент целиком.
См. [Соединения и правка](./editing#рисование-новои-связи).

## Свёртка поддерева

У узла с потомками появляется кнопка в правом верхнем углу. Нажатие прячет всё поддерево и переносит рёбра потомков на
сам узел — так же, как групповой узел собирает рёбра своих участников.

Состояние — это множество id, и им можно управлять:

```vue
<AssetMap v-model:collapsed-nodes="collapsedNodes" :entities="entities" :links="links" />
```

## Бейджи

```ts
{ id: 'ws-1', type: 'workstation', label: 'Станция', badges: [{ id: 'cve', color: '#cb5555', tooltip: '3 CVE' }] }
```

Бейджи рисуются под плашкой. Слот `#node-badge` подменяет их отрисовку:

```vue
<template #node-badge="{ badge, entity }">
  <span class="my-badge">{{ badge?.id }} · {{ entity?.label }}</span>
</template>
```

<script setup>
import customNodeSource from '../../.vitepress/demos/CustomNodeMap.vue?raw'
</script>
