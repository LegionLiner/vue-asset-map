# Модель данных

Всё, что видно на экране, описывают два массива: `entities` и `links`. Карта их читает и никогда не пишет — ни одно
поле не добавляется, не переставляется и не нормализуется на месте.

## AssetEntity

```ts
interface AssetEntity<M = unknown> {
  id: EntityId
  kind: string
  label: string
  sublabels?: string[]
  status?: string
  badges?: Badge[]
  parentId?: EntityId | null
  position?: XY
  meta?: M
}
```

| Поле        | Зачем                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| `id`        | Уникален в наборе. Всё остальное ссылается на сущность по нему.                                      |
| `kind`      | Выбирает иконку и компонент отрисовки. Открытый строковый союз — годится любое значение.             |
| `label`     | Название на плашке под кругом.                                                                       |
| `sublabels` | Строки под названием: IP, FQDN, домен. Первая рисуется приглушённым цветом, вторая — цветом оверлея. |
| `status`    | Через `themeConfig.statusColors` превращается в цвет. Пакет не знает ни одного статуса заранее.      |
| `badges`    | Небольшие метки под плашкой.                                                                         |
| `parentId`  | Иерархия для группировки и свёртки. `null` или отсутствие — корень.                                  |
| `position`  | Закреплённая позиция в пикселях полотна. Сильнее движка раскладки.                                   |
| `meta`      | Ваши данные. Внутри помечаются `markRaw` и реактивными не становятся.                                |

`meta` — это то, что рисует панель подробностей и что читают группы фильтров через `valuesOf`. Задайте ему тип, и он
дойдёт до слотов:

```ts
interface AssetMeta {
  owner?: string
  subnet?: 'internet' | 'vpn' | 'docker'
  severity?: 'critical' | 'high' | 'medium' | 'low'
}

const entities: AssetEntity<AssetMeta>[] = [
  { id: 'ws-1', kind: 'workstation', label: 'Рабочая станция', meta: { owner: 'Дмитрий', severity: 'low' } },
]
```

## AssetLink

```ts
interface AssetLink<M = unknown> {
  id: string
  source: EntityId
  target: EntityId
  layers: string[]
  kind?: string
  label?: string
  directed?: boolean
  meta?: M
}
```

| Поле       | Зачем                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `layers`   | В какие проекции попадает связь. См. [Проекции](./views).                                       |
| `kind`     | Выбирает стиль ребра через CSS-класс и свой компонент ребра, если он зарегистрирован.           |
| `directed` | Рисует стрелку и ограничивает обходы, которые считаются по направлению, например `blastRadius`. |

Параллельные связи сохраняются: две связи между той же парой с разными id — это два ребра, и кратность доживает до
агрегации при свёртке группы.

## Битые данные чинятся, а не роняют карту

`buildGraph` никогда не бросает исключение на плохих данных. Он сообщает через `onIssue` и продолжает:

| Ситуация                             | Что происходит                                          |
| ------------------------------------ | ------------------------------------------------------- |
| Дубль id сущности или связи          | Побеждает первая запись.                                |
| Связь в несуществующую сущность      | Связь отбрасывается.                                    |
| `parentId` в несуществующую сущность | Узел становится корневым.                               |
| Цикл в иерархии                      | Связь с родителем разрывается у узла, замкнувшего цикл. |
| `parentId`, равный своему же id      | Считается корнем.                                       |

Это важно, потому что данные об активах обычно приходят из систем инвентаризации, где висячая ссылка — обычное дело.
Карта, которая отказывается рисоваться, полезнее не становится:

```ts
import { buildGraph } from 'vue-asset-map/core'

const graph = buildGraph(entities, links, {
  onIssue: (issue) => console.warn(`[asset-map] ${issue.code}: ${issue.id}`, issue.detail),
})
```

## Индексированный граф

`buildGraph` возвращает `AssetGraph`: те же сущности и связи плюс индексы, которые читает всё остальное.

```ts
interface AssetGraph<E = unknown, L = unknown> {
  entities: ReadonlyMap<EntityId, AssetEntity<E>>
  links: ReadonlyMap<string, AssetLink<L>>
  adjacency: ReadonlyMap<EntityId, readonly string[]>
  childrenOf: ReadonlyMap<EntityId, readonly EntityId[]>
  roots: readonly EntityId[]
  parentOf: ReadonlyMap<EntityId, EntityId | null>
  outgoing: ReadonlyMap<EntityId, readonly string[]>
  incoming: ReadonlyMap<EntityId, readonly string[]>
}
```

Две детали несущие. Петля попадает в `adjacency` **один** раз, а не два, поэтому «двойная» петля остаётся отличимой от
двух параллельных связей. И `parentOf` — это _эффективный_ родитель, уже после починки, поэтому цикл не подвесит обход.

Внутри компонента граф обычно не строят руками — карта строит его сама и отдаёт наружу:

```ts
const map = useTemplateRef<AssetMapExposed>('map')
const graph = map.value?.getGraph()
```

Пересчёт привязан к ссылкам на массивы. Правка поля внутри существующей сущности индексы не трогает — подставьте новый
массив, как это делает любой иммутабельный стор.
