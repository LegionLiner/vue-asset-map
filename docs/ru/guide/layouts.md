# Раскладки

Движок раскладки превращает схлопнутый граф в позиции. Два встроены в пакет, третий лежит за отдельным подпутём, и
любой объект с методом `run` может их заменить.

<LiveDemo :source="layoutSource" source-label="Показать исходник">
  <LayoutMap />
</LiveDemo>

## Встроенные движки

### manual

Закреплённые позиции сохраняются как есть, всё остальное выкладывается в детерминированную сетку. Смысл не в том, чтобы
рисовать красиво, а в том, чтобы не потерять координаты, — это движок для случая, когда позиции приходят с бэкенда.

```ts
{ engine: 'manual', options: { columns: 8, columnGap: 200, rowGap: 140, origin: { x: 0, y: 0 } } }
```

`columnGap` и `rowGap` по умолчанию равны самому крупному узлу плюс 48 px, поэтому карточки разных размеров не
наезжают друг на друга.

### radial

Концентрические кольца по расстоянию от корня в рёбрах, поэтому номер кольца читается как число хопов.

```ts
{ engine: 'radial', options: { rootId: 'internet', radius: 220, ringGap: 180, startAngle: -Math.PI / 2 } }
```

Без `rootId` центром становится узел наибольшей степени. Компоненты, недостижимые из корня, не выбрасываются: они
получают кольцо за самым дальним связанным, поэтому изоляты остаются видимыми.

### dagre

Ярусная раскладка, за своим подпутём, чтобы опциональная зависимость не попадала в основной бандл:

```bash
npm install @dagrejs/dagre
```

```vue
<script setup lang="ts">
import { AssetMap } from 'vue-asset-map'
import { dagreLayout } from 'vue-asset-map/layout-dagre'
</script>

<template>
  <AssetMap
    :entities="entities"
    :links="links"
    :layout="{ engine: dagreLayout, options: { rankdir: 'LR', ranksep: 120 } }"
  />
</template>
```

Опции проходят насквозь: `rankdir`, `align`, `nodesep`, `ranksep`, `edgesep`, `ranker`.

## Приоритет позиций

Конкурируют три источника, в таком порядке:

1. позиция, полученная перетаскиванием узла,
2. `entity.position` из ваших данных,
3. результат движка.

Первые два уходят в движок как `pinned`, поэтому движок их не переставляет, а не «переставляет, и мы потом чиним».
Dagre не умеет фиксировать узлы, поэтому поверх его результата закреплённые позиции проставляются заново — снаружи
поведение такое же, как у остальных движков.

## Свой движок

```ts
import type { LayoutEngine } from 'vue-asset-map'
import { applyPinned, throwIfAborted } from 'vue-asset-map'

export const columnsLayout: LayoutEngine<{ gap?: number }> = {
  name: 'columns',
  async run(graph, options, signal) {
    throwIfAborted(signal, 'columns')

    const gap = options?.gap ?? 160
    const positions = new Map<string, { x: number; y: number }>()

    graph.nodes.forEach((node, index) => {
      positions.set(node.id, { x: index * gap, y: 0 })
    })

    return applyPinned(positions, graph.nodes)
  },
}
```

```vue
<AssetMap :entities="entities" :links="links" :layout="{ engine: columnsLayout, options: { gap: 200 } }" />
```

Позиции — это левые верхние углы в пикселях полотна, по id узла. Узлы, которых нет в возвращённой карте, остаются на
своих местах.

**Уважайте signal.** Каждый запуск отменяет предыдущий, поэтому пользователь, трижды переключивший вид, увидит
результат только последней раскладки. Для этого экспортируются `throwIfAborted` и `yieldAndCheck`; устаревший результат
отбрасывается, даже если сторонний движок игнорирует сигнал, но долгий движок без проверок будет впустую жечь CPU.

## Регистрация по имени

```vue
<AssetMap :entities="entities" :links="links" :layout="{ engine: 'columns' }" />
```

Неизвестное имя движка не фатально: карта откатывается на `manual` и сообщает об этом событием `error`, потому что имя
может прийти из данных вида — то есть снаружи.

```ts
import { builtinLayoutEngines, resolveLayoutEngine } from 'vue-asset-map'

resolveLayoutEngine('radial')                       // radialLayout
resolveLayoutEngine('columns', { columns: columnsLayout })
```

## Пересчёт по требованию

```ts
const map = useTemplateRef<AssetMapExposed>('map')
await map.value?.relayout()
```

`layout-start`, `layout-done` и `error` сообщают о ходе запуска.

<script setup>
import layoutSource from '../../.vitepress/demos/LayoutMap.vue?raw'
</script>
