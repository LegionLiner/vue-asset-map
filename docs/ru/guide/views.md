# Представления

Представление — это объект конфигурации, который определяет проекцию графа на холст: какие сущности и связи до него
доходят и как они раскладываются. Представления являются данными: пакет не содержит ни одного своего представления и
не знает заранее ни одного имени. `physical` и `logical` в примерах — это id, которые выбрали вы.

```ts
interface AssetView {
  id: string
  label: string
  linkFilter?: (link: AssetLink) => boolean
  entityFilter?: (entity: AssetEntity) => boolean
  showSublabels?: boolean
  layout?: { engine: string; options?: unknown }
  hideIsolated?: boolean
}
```

## Фильтрация по слоям

Без `linkFilter` связь попадает в представление, если её `layers` содержат id представления:

```ts
const links: AssetLink[] = [
  { id: 'l1', source: 'router', target: 'laptop', layers: ['physical'] },
  { id: 'l2', source: 'vpn', target: 'laptop', layers: ['logical'] },
  { id: 'l3', source: 'internet', target: 'router', layers: ['physical', 'logical'] },
]
```

`l3` виден в обоих представлениях, остальные связи — в одном каждая. Один массив связей описывает несколько топологий.

## Порядок применения

Порядок проекции зафиксирован и наблюдаем:

1. `entityFilter` отбирает сущности-кандидаты.
2. `linkFilter` оставляет связи, у которых **оба** конца прошли шаг 1.
3. `hideIsolated` убирает сущности, у которых не осталось ни одной видимой связи.

`hideIsolated` учитывает только связи: у сущности без видимой инцидентной связи узел не рисуется. Предки не спасают
потомков, потомки не спасают предков — иерархия в проекции не участвует. Она нужна свёртке, а связность карты при
поиске обеспечивает `keepPathToRoot` из фильтра.

## Переключение представлений

```vue
<AssetMap v-model:view="view" :entities="entities" :links="links" :views="views" />
```

Встроенный переключатель появляется в тулбаре, как только представлений становится два и больше. Неизвестный или
отсутствующий id откатывается к первому представлению, а не рисует пустую карту: значение, сохранённое от старой
конфигурации, не может обнулить экран.

Переключение сбрасывает **выделение** и подсветку пути. Узел, выделенный в одном представлении, в другом может не
существовать вовсе, а невидимое выделение всё равно гасит всё вокруг себя. С включённым `autoFitView` заодно
пересчитывается и вид: другое представление — другой граф, а прежний вид описывает раскладку, которой больше нет.

<LiveDemo :source="projectionsSource" source-label="Показать исходник">
  <ProjectionsMap />
</LiveDemo>

Счётчик в этом демо считает приложение, а не карта — той же функцией ядра, которой пользуется карта:

```ts
import { buildGraph, projectGraph, resolveView } from 'vue-asset-map/core'

const graph = buildGraph(entities, links)
const result = projectGraph(graph, resolveView(views, 'physical'))

result.entityIds.size
result.linkIds.size
```

## Раскладка представления

```ts
const views: AssetView[] = [
  { id: 'physical', label: 'Физическая', layout: { engine: 'radial', options: { radius: 240 } } },
  { id: 'logical', label: 'VPN-оверлей', layout: { engine: 'dagre', options: { rankdir: 'LR' } } },
]
```

Prop `layout` у компонента сильнее раскладки представления: props ближе к потребителю.

## Свои фильтры

`linkFilter` и `entityFilter`, если заданы, полностью заменяют правило по умолчанию:

```ts
const criticalOnly: AssetView = {
  id: 'critical',
  label: 'Критичные активы',
  entityFilter: (entity) => entity.meta?.severity === 'critical',
  hideIsolated: false,
}
```

С `hideIsolated: false` выжившие сущности остаются на карте, даже если фильтр обрезал все связи между ними. Это нужно
представлению, построенному на свойствах сущностей, а не на топологии.

## Подписи

`showSublabels: false` прячет строки с адресами в конкретном представлении. Геометрия узла при этом не меняется:
плашка подписей фиксированного размера, поэтому переключение представления ничего не масштабирует и не дёргает
раскладку.

<script setup>
import projectionsSource from '../../.vitepress/demos/ProjectionsMap.vue?raw'
</script>
