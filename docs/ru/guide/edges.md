# Связи

Ребро — это кривая Безье между центрами двух узлов. По умолчанию стиль задаёт класс, выведенный из `link.type`, а цвета
живут в токенах темы, а не в инлайновом `stroke`, — поэтому при переключении темы ребро перекрашивается само. Если
объявить [виды соединений](./editing#виды-соединении), вместо этого применяются ваши цвет и штрих.

## Типы и направление

```ts
const links: AssetLink[] = [
  { id: 'l1', source: 'internet', target: 'router', layers: ['physical'] },
  { id: 'l2', source: 'cloudflare', target: 'nginx', layers: ['physical'], type: 'dashed', directed: true },
]
```

`type` попадает в класс `vam-edge--type-{type}`, который вы стилизуете из своего CSS. `directed` добавляет стрелку и
ограничивает обходы, считающиеся по направлению, — см. [Обходы графа](./traversal).

Если нужны цвет, штрих и человеческое название на каждый вид — а с ними легенда и выбор типа при правке связи, — вместо
ручной стилизации классов объявите `linkTypes`. Одно объявление управляет всеми тремя, поэтому разойтись они не могут.
См. [Соединения и правка](./editing#виды-соединении).

<LiveDemo :source="edgeKindSource" source-label="Показать исходник">
  <EdgeKindMap />
</LiveDemo>

## Клик по связи

Клик открывает окно соединения: что оно соединяет, его вид, слои и `meta`. Набор открытых окон — `v-model:openLinks`,
тело подменяется слотом `#link-details`. **Агрегированное** ребро не открывает ничего: за ним стоит сразу несколько
связей и нет одной записи, которую можно было бы показать, — но событие `edge-click` приходит по-прежнему.

Правый клик вешает на связь меню, если включён `showContextMenu`, а с `editable` в нём появляется удаление. Всё это
описано в [Соединениях и правке](./editing).

Сама линия толщиной в пиксель — не мишень для клика, поэтому у каждого ребра есть ещё невидимый путь шириной 16px по
тому же маршруту. Именно он принимает указатель: без него клик в девяти случаях из десяти попадал бы в полотно.

## Привязка к конкретной ручке

Узел, который рисует больше одной ручки — порты коммутатора, слоты в стойке, объекты внутри блока, — может иметь линии,
соединяющие **конкретную пару**, а не два узла целиком:

```ts
{ id: 'l1', source: 'switch-a', target: 'switch-b', layers: ['physical'],
  sourceHandle: 'port-3', targetHandle: 'port-1' }
```

Это id из пропа `id` компонентов `<Handle>` внутри вашего узла. Без них линия садится на первую ручку подходящего типа —
ровно то, что нужно узлу с одной ручкой, поэтому без явной просьбы ничего не меняется.

Когда связь рисуют перетаскиванием, реально соединённые ручки приезжают на кандидате в событии `link-create`. Это
единственный момент, когда эта информация существует: по паре id узлов уже не восстановить, что именно соединили.

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

Зарегистрируйте компонент под `type` — так же, как с узлами:

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
