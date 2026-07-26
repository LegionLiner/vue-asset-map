# Связи

Ребро — это кривая Безье между центрами двух узлов, стиль которой задаёт класс, выведенный из `link.kind`. Цвета живут
в токенах темы, а не в инлайновом `stroke`, поэтому при переключении темы ребро перекрашивается само.

## Типы и направление

```ts
const links: AssetLink[] = [
  { id: 'l1', source: 'internet', target: 'router', layers: ['physical'] },
  { id: 'l2', source: 'cloudflare', target: 'nginx', layers: ['physical'], kind: 'dashed', directed: true },
]
```

`kind` попадает в класс `vam-edge--kind-{kind}`, который вы стилизуете из своего CSS. `directed` добавляет стрелку и
ограничивает обходы, считающиеся по направлению, — см. [Обходы графа](./traversal).

<LiveDemo :source="edgeKindSource" source-label="Показать исходник">
  <EdgeKindMap />
</LiveDemo>

## Подписи

Своя подпись связи рисуется, если она есть. У агрегированных рёбер — тех, что получились из
[свёртки групп](./collapse), — вместо неё показывается счётчик. Ниже порога LOD подписи не рисуются вовсе.

Слот `#edge-label` подменяет отрисовку:

```vue
<template #edge-label="{ link, aggregated, count }">
  <span class="edge-label">{{ aggregated ? `${count} связей` : link?.meta?.bandwidth }}</span>
</template>
```

## Параллельные связи сохраняются

Две связи между одной парой с разными id — это два ребра. Так и задумано: второй аплинк к тому же роутеру считается
фактом об инфраструктуре, а не дублем, который надо объединить.

Агрегация в один `AggregatedLink` происходит только когда свёртка поставила на один из концов группу, и тогда `count` и
`sourceLinkIds` фиксируют, что в неё вошло:

```ts
import { isAggregatedLink } from 'vue-asset-map/core'

if (isAggregatedLink(link)) {
  console.log(link.count, link.sourceLinkIds)
}
```

## Свой компонент ребра

Зарегистрируйте компонент под `kind` — так же, как с узлами:

```vue
<!-- TunnelEdge.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, getBezierPath, Position } from '@vue-flow/core'
import { useMapContext } from 'vue-asset-map'
import type { AssetEdgeData } from 'vue-asset-map'

const props = defineProps<{
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  data?: AssetEdgeData
}>()

defineOptions({ inheritAttrs: false })

const map = useMapContext()

const path = computed(() => {
  const [d] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  })
  return d
})
</script>

<template>
  <BaseEdge :id="id" :path="path" :class="{ dimmed: map.isEdgeDimmed(id) }" />
</template>
```

```vue
<AssetMap :entities="entities" :links="links" :edge-types="{ tunnel: TunnelEdge }" />
```

`defineOptions({ inheritAttrs: false })` здесь обязателен. Vue Flow передаёт ребру десятки собственных пропсов, и без
этой опции Vue пишет в консоль предупреждение о лишних атрибутах на каждое ребро карты.

Гашение и подсветку решает карта, а не ребро: правило зависит от режима — поиск, выделение или наведение на маркер, — а
ребро о режимах знать не должно. Читайте их через `map.isEdgeDimmed(id)`, `map.isEdgeHighlighted(id)` и
`map.isEdgeInfected(id)`.

<script setup>
import edgeKindSource from '../../.vitepress/demos/EdgeKindMap.vue?raw'
</script>
