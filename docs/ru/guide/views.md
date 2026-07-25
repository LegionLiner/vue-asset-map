# Проекции

Вид — это проекция одного графа: какие сущности и связи доходят до полотна и как они раскладываются. Виды — данные.
Пакет не везёт ни одного своего и не знает ни одного имени вида заранее: `physical` и `logical` в примерах — это id,
которые выбрали вы.

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

## Слои — фильтр по умолчанию

Без `linkFilter` связь попадает в вид, если её `layers` содержат id вида:

```ts
const links: AssetLink[] = [
  { id: 'l1', source: 'router', target: 'laptop', layers: ['physical'] },
  { id: 'l2', source: 'vpn', target: 'laptop', layers: ['logical'] },
  { id: 'l3', source: 'internet', target: 'router', layers: ['physical', 'logical'] },
]
```

`l3` виден в обоих видах, остальные — в одном каждый. Это весь механизм: один массив связей, несколько топологий.

## Порядок, в котором применяется проекция

Порядок зафиксирован и наблюдаем:

1. `entityFilter` отбирает сущности-кандидаты.
2. `linkFilter` оставляет связи, у которых **оба** конца пережили шаг 1.
3. `hideIsolated` убирает сущности, у которых не осталось ни одной видимой связи.

`hideIsolated` буквален: нет инцидентной видимой связи — нет узла. Предки не спасают потомков, потомки не спасают
предков: иерархия в проекции не участвует вовсе. Она нужна свёртке, а связность карты при поиске держит
`keepPathToRoot` из фильтра.

## Переключение видов

```vue
<AssetMap v-model:view="view" :entities="entities" :links="links" :views="views" />
```

Встроенный переключатель появляется в тулбаре, как только видов становится два и больше. Неизвестный или отсутствующий
id откатывается к первому виду, а не рисует пустую карту, — значение, сохранённое от старой конфигурации, не может
обнулить экран.

<LiveDemo :source="projectionsSource" source-label="Показать исходник">
  <ProjectionsMap />
</LiveDemo>

Счётчик в этом демо считает приложение, а не карта, — той же функцией ядра, которой пользуется карта:

```ts
import { buildGraph, projectGraph, resolveView } from 'vue-asset-map/core'

const graph = buildGraph(entities, links)
const result = projectGraph(graph, resolveView(views, 'physical'))

result.entityIds.size
result.linkIds.size
```

## У вида может быть своя раскладка

```ts
const views: AssetView[] = [
  { id: 'physical', label: 'Физическая', layout: { engine: 'radial', options: { radius: 240 } } },
  { id: 'logical', label: 'VPN-оверлей', layout: { engine: 'dagre', options: { rankdir: 'LR' } } },
]
```

Prop `layout` у компонента сильнее раскладки вида: props ближе к потребителю.

## Фильтры помимо слоёв

`linkFilter` и `entityFilter`, если заданы, полностью заменяют правило по умолчанию:

```ts
const criticalOnly: AssetView = {
  id: 'critical',
  label: 'Критичные активы',
  entityFilter: (entity) => entity.meta?.severity === 'critical',
  hideIsolated: false,
}
```

С `hideIsolated: false` выжившие остаются на карте даже там, где фильтр обрезал все связи между ними, — обычно это и
нужно виду, построенному на свойствах сущностей, а не на топологии.

## Подписи по видам

`showSublabels: false` прячет строки с адресами в конкретном виде. Геометрия узла при этом не меняется — плашка
подписей фиксированного размера, — поэтому переключение вида ничего не масштабирует и не дёргает раскладку.

<script setup>
import projectionsSource from '../../.vitepress/demos/ProjectionsMap.vue?raw'
</script>
