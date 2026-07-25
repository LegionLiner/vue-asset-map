# Обходы графа

Функции по графу живут в `vue-asset-map/core`, который не импортирует ни Vue, ни Vue Flow. Они одинаково работают в
браузере, в node-скрипте и на сервере.

```ts
import { buildGraph, neighbors, findPaths, blastRadius } from 'vue-asset-map/core'

const graph = buildGraph(entities, links)
```

## neighbors

Узлы на расстоянии до `depth` рёбер:

```ts
neighbors(graph, 'keenetic-1', 1)
neighbors(graph, 'keenetic-1', 2, ['physical'])
```

Сам узел в результат не входит — даже если он достижим из себя по циклу: нужна окрестность, а не её замыкание.

## findPaths

Простые пути между двумя узлами:

```ts
const paths = findPaths(graph, 'ws-artjom', 'ws-vlad', {
  maxDepth: 6,
  maxPaths: 10,
  layers: ['logical'],
})
```

Пути простые — узел не повторяется, поэтому обход завершается на любом цикле. Порядок результатов детерминирован: рёбра
перебираются в порядке `adjacency`, то есть в порядке входного массива.

`maxDepth` считается в рёбрах и по умолчанию равен 6, `maxPaths` — 10.

## blastRadius

Что затронет отказ узла: сам узел плюс всё, до чего распространяется влияние.

```ts
blastRadius(graph, 'vps-tailscale', { direction: 'downstream', maxDepth: 2, layers: ['logical'] })
```

`direction` ограничивает только **ориентированные** связи. Неориентированная проходится в обе стороны при любом
`direction`, потому что она не утверждает, кто от кого зависит. Это сознательно: выводить зависимость из
неориентированного ребра — значит уверенно выдавать неправду.

## Подсветка пути на карте

`highlightPath` принимает id двух сущностей — в демо ниже они берутся из `v-model:selection`, набранного зажатым Shift
и кликами по узлам. Shift — это модификатор, на который стоит полагаться: он добавляет к выделению на любой платформе,
тогда как Ctrl+клик на macOS вообще не доходит до обработчика клика узла — там это системный жест правого клика, и
браузер шлёт вместо `click` событие `contextmenu`. Ctrl и Cmd по-прежнему работают для тех, чья привычка настроена на
них.

```ts
const map = useTemplateRef<AssetMapExposed>('map')

const hops = map.value?.highlightPath('ws-artjom', 'ws-vlad') ?? []
map.value?.clearHighlight()
```

Поиск идёт по исходному графу с учётом слоёв текущего вида, а подсветка рисуется по схлопнутому: если участок пути
спрятан в группе, загорается групповой узел и ведущие к нему рёбра. Иначе путь визуально обрывался бы.

<LiveDemo :source="pathSource" source-label="Показать исходник">
  <PathTraceMap />
</LiveDemo>

## Режим «заражения»

`blastRadius` стоит и за режимом заражения: помечаете сущности, а карта показывает всё, что они захватывают.

```vue
<AssetMap
  :entities="entities"
  :links="links"
  :infected="['vps-tailscale']"
  :infection-options="{ direction: 'downstream', maxDepth: 2 }"
/>
```

Ребро считается заражённым, только если заражены **оба** конца. Один заражённый конец означает, что распространение
туда не дошло — направление или слой не позволили, — и красить его значило бы пометить ровно ту связь, по которой
захват не прошёл.

Групповой узел считается заражённым, если захвачен хоть один участник, иначе свёртка прятала бы факт заражения.

Цвета берутся из `--vam-infected-bg`, `--vam-infected-border` и `--vam-infected-fg`, а помеченный руками источник
рисуется толще, чем захваченные им узлы.

## Маркеры принадлежности

Маркеры — та же идея, но читаемая взглядом: кружок под подписью на каждый центр, с которым узел связан.

```ts
import { connectionMarkers, topAnchors } from 'vue-asset-map/core'

const markers = connectionMarkers([
  { id: 'keenetic-1', label: 'Офис A' },
  { id: 'vps-tailscale', label: 'VPN' },
])
```

У рабочей станции, подключённой к роутеру физически и к координатору VPN логически, окажется **два** кружка:
принадлежность к одному не отменяет другой. Слои по умолчанию не ограничены намеренно: кружки существуют, чтобы видеть
принадлежность не переключая вид, и подсчёт по текущему виду скрыл бы ровно ту связь, ради которой на них смотрят.

Если центры заранее не известны, возьмите их по степени связности:

```ts
const markers = connectionMarkers(topAnchors(graph, 3))
```

<LiveDemo :source="markersSource" source-label="Показать исходник">
  <MarkersMap />
</LiveDemo>

Наведение на кружок подсвечивает всех, у кого он есть, и гасит остальных — после `markerHoverDelay` (500 мс по
умолчанию). Задержка не даёт курсору, проходящему над кружками по пути к чему-то другому, мигать всей картой; фокус с
клавиатуры подсвечивает сразу, потому что фокус — уже осознанное действие.

## Помощники по иерархии

```ts
import { ancestorsOf, descendantsOf, incidentLinks, otherEnd } from 'vue-asset-map/core'

ancestorsOf(graph, 'ct-web-1')
descendantsOf(graph, 'pve-beelink')
incidentLinks(graph, 'keenetic-1', ['physical'])
```

Оба обхода циклобезопасны, `descendantsOf` возвращает порядок обхода в глубину и не включает сам узел.

<script setup>
import pathSource from '../../.vitepress/demos/PathTraceMap.vue?raw'
import markersSource from '../../.vitepress/demos/MarkersMap.vue?raw'
</script>
