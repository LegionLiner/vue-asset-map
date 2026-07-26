# Узлы

Узел — это круг с иконкой, а под ним плашка фиксированного размера с названием и максимум двумя подписями. Корневые
сущности рисуются размером 60 px, дочерние — 36 px. Это единственный визуальный признак уровня, а не поле в ваших
данных.

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

## Подмена содержимого круга

Слот `#node-{kind}` подменяет то, что внутри круга, для одного типа, оставляя на месте плашку, индикатор состояния и
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

## Свёртка поддерева

У узла с потомками появляется кнопка в правом верхнем углу. Нажатие прячет всё поддерево и переносит рёбра потомков на
сам узел — так же, как групповой узел собирает рёбра своих участников.

Состояние — это множество id, и им можно управлять:

```vue
<AssetMap v-model:collapsed-nodes="collapsedNodes" :entities="entities" :links="links" />
```

## Бейджи

```ts
{ id: 'ws-1', kind: 'workstation', label: 'Станция', badges: [{ id: 'cve', color: '#cb5555', tooltip: '3 CVE' }] }
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
