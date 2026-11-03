# Справочник API

Всё, что экспортирует пакет. Точек входа пять:

| Импорт                        | Что внутри                                              |
| ----------------------------- | ------------------------------------------------------- |
| `vue-asset-map`               | Компоненты, composables, типы и всё содержимое ядра.    |
| `vue-asset-map/core`          | Функции по графу без Vue и без Vue Flow.                |
| `vue-asset-map/layout-dagre`  | Алгоритм раскладки dagre, за опциональной зависимостью. |
| `vue-asset-map/layout-worker` | Запуск раскладки в Web Worker; без Vue.                 |
| `vue-asset-map/style.css`     | Токены, светлая и тёмная темы, правила компонентов.     |

## Компонент

### `<AssetMap>`

Карта. Обобщён по типам пользовательских данных `entity.meta` и `link.meta`: `AssetMap<E, L>`.

#### Props

| Prop                        | Тип                               | По умолчанию           | Что делает                                           |
| --------------------------- | --------------------------------- | ---------------------- | ---------------------------------------------------- |
| `entities`                  | `AssetEntity<E>[]`                | —                      | Узлы карты.                                          |
| `links`                     | `AssetLink<L>[]`                  | —                      | Связи карты.                                         |
| `views`                     | `AssetView[]`                     | —                      | Представления.                                       |
| `nodeTypes`                 | `Record<string, Component>`       | —                      | Компоненты узлов по `type`, поверх встроенных.       |
| `edgeTypes`                 | `Record<string, Component>`       | —                      | Компоненты рёбер по `type`.                          |
| `layout`                    | `AssetMapLayoutSpec`              | `{ engine: 'manual' }` | Алгоритм раскладки по имени или объектом плюс опции. |
| `collapse`                  | `CollapseRule \| false`           | `{ threshold: 10 }`    | Правило свёртки групп; `false` выключает свёртку.    |
| `filterOptions`             | `FilterOptions`                   | —                      | Поля поиска, глубина соседей, группы фильтров.       |
| `theme`                     | `ThemeMode`                       | `'light'`              | Режим темы: `'light'`, `'dark'` или `'auto'`.        |
| `themeConfig`               | `ThemeConfig`                     | —                      | `statusColors` и `kindIcons`.                        |
| `locale`                    | `string \| PartialLocaleMessages` | `'ru'`                 | Код локали или словарь переопределений.              |
| `showToolbar`               | `boolean`                         | `true`                 | Видимость встроенных контролов.                      |
| `showDetailsPanel`          | `boolean`                         | `true`                 | Открытие окон подробностей по клику.                 |
| `showMinimap`               | `boolean`                         | `false`                | Видимость обзорной карты.                            |
| `linkTypes`                 | `LinkTypeDef[]`                   | —                      | Виды соединений: цвет, штрих, название.              |
| `showLegend`                | `boolean`                         | `false`                | Легенда соединений слева снизу.                      |
| `showContextMenu`           | `boolean`                         | `false`                | Меню по правому клику: на узлах и на связях.         |
| `editable`                  | `boolean`                         | `false`                | Кнопка правки, пункты удаления, рисование связей.    |
| `entityFields`              | `FieldDef[]`                      | —                      | Поля, предлагаемые при правке сущности.              |
| `linkFields`                | `FieldDef[]`                      | тип, подпись, скорость | Поля, предлагаемые при правке связи.                 |
| `detailsMode`               | `'replace' \| 'stack'`            | `'replace'`            | Что обычный клик делает с открытыми окнами.          |
| `showNodeStatus`            | `boolean`                         | `true`                 | Плашка состояния на круге узла.                      |
| `showNodeToggle`            | `boolean`                         | `true`                 | Кнопка свёртки поддерева на узле.                    |
| `showNodeLabel`             | `boolean`                         | `true`                 | Плашка с подписями под кругом.                       |
| `maxSublabels`              | `number`                          | без предела            | Предел числа подписей; `0` убирает их.               |
| `detailsTitle`              | `string \| (entity) => string`    | `entity.label`         | Подпись в шапке окна подробностей.                   |
| `showDetailsHeading`        | `boolean`                         | `true`                 | Заголовочный блок внутри окна подробностей.          |
| `detailsTabs`               | `DetailsTabDef[] \| false`        | встроенные табы        | Табы окна подробностей; `false` убирает полосу.      |
| `maxDetailsWindows`         | `number`                          | `2`                    | Лимит открытых окон; `0` выключает окна.             |
| `neighborHighlightDepth`    | `number`                          | `1`                    | Шаги выделения, остающиеся яркими; `0` выключает.    |
| `infected`                  | `EntityId[]`                      | —                      | Источники заражения для `blastRadius`.               |
| `infectionOptions`          | `InfectionOptions`                | —                      | `direction`, `maxDepth`, `layers` распространения.   |
| `autoPath`                  | `boolean`                         | `false`                | Сам строит путь между двумя выделенными узлами.      |
| `pathOptions`               | `PathOptions`                     | —                      | `maxDepth`, `layers` поиска пути.                    |
| `markers`                   | `NodeMarkerDef[]`                 | —                      | Кружки принадлежности под подписями.                 |
| `markerHoverDelay`          | `number`                          | `500`                  | Задержка в мс перед подсветкой по наведению.         |
| `virtualize`                | `boolean                          | number`                | `300`                                                | Отсечение невидимого начиная с N узлов. |
| `onlyRenderVisibleElements` | `boolean`                         | `true`                 | Отсечение самого Vue Flow, пока нет `virtualize`.    |
| `lodThreshold`              | `number`                          | `0.5`                  | Масштаб, ниже которого узлы рисуются упрощённо.      |
| `lodCanvas`                 | `boolean`                         | `true`                 | Точки на canvas ниже `lodThreshold` при отсечении.   |
| `searchDebounce`            | `number`                          | `200`                  | Задержка в мс перед применением запроса.             |
| `loading`                   | `boolean`                         | `false`                | Индикатор загрузки.                                  |
| `autoFitView`               | `boolean`                         | `false`                | Подгонка холста при появлении и при смене вида.      |

`entities` и `links` компонент только читает: он не добавляет, не переставляет и не нормализует поля во входных
массивах. Без `views` рисуются все сущности и связи.

#### Двусторонние привязки

| Модель             | Тип                     | Что хранит                                     |
| ------------------ | ----------------------- | ---------------------------------------------- |
| `view`             | `string \| undefined`   | Id активного представления.                    |
| `selection`        | `EntityId[]`            | Выделенные id в порядке выбора.                |
| `expanded`         | `Set<string>`           | Id групп, раскрытых руками.                    |
| `filters`          | `FilterState`           | Запрос, группы фильтров, выбор по группам.     |
| `viewport`         | `Viewport`              | Сдвиг в пикселях плюс масштаб.                 |
| `openDetails`      | `EntityId[]`            | Сущности с открытым окном; последняя сверху.   |
| `openLinks`        | `string[]`              | Связи с открытым окном; последняя сверху.      |
| `positions`        | `Record<EntityId, XY>`  | Куда узлы передвинули руками. Это и сохраняют. |
| `collapsedNodes`   | `Set<EntityId>`         | Узлы со свёрнутым поддеревом.                  |
| `openFilterGroups` | `string[] \| undefined` | Раскрытые списки фильтров.                     |

Каждая привязка работает и без `v-model`. Тогда состоянием владеет компонент.

#### События

| Событие                                            | Данные события                                               |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `node-click`, `node-dblclick`, `node-context-menu` | `NodeEventPayload`                                           |
| `edge-click`                                       | `{ id: string; event: MouseEvent }`                          |
| `pane-click`                                       | `MouseEvent`                                                 |
| `expand`, `collapse`                               | `{ groupId: string; group: CollapsedGroup \| undefined }`    |
| `node-expand`, `node-collapse`                     | `{ id: EntityId; entity: AssetEntity<E> \| undefined }`      |
| `selection-change`                                 | `EntityId[]`                                                 |
| `path-change`                                      | `EntityId[]` — путь; пустой, когда подсветку сняли           |
| `entity-update`                                    | `{ id: EntityId; entity: AssetEntity<E> }` — новый объект    |
| `link-update`                                      | `{ id: string; link: AssetLink<L> }` — новый объект          |
| `entity-delete`                                    | `{ id: EntityId; entity: AssetEntity<E> \| undefined }`      |
| `link-delete`                                      | `{ id: string; link: AssetLink<L> \| undefined }`            |
| `link-create`                                      | `{ link: AssetLink<L>; source: EntityId; target: EntityId }` |
| `node-move`                                        | `{ id: EntityId; entity?: AssetEntity<E>; position: XY }`    |
| `layout-start`                                     | `string` — имя алгоритма                                     |
| `layout-done`                                      | `{ engine: string; positions: number }`                      |
| `error`                                            | `unknown`                                                    |

#### Слоты

| Слот                            | Параметры                       |
| ------------------------------- | ------------------------------- |
| `toolbar-left`, `toolbar-right` | —                               |
| `empty`, `loading`              | —                               |
| `windows`                       | —                               |
| `details`                       | `DetailsSlotProps<E>`           |
| `details-header`                | `DetailsHeaderSlotProps<E>`     |
| `details-title`                 | `DetailsTitleSlotProps<E>`      |
| `details-tabs`                  | `DetailsTabsSlotProps<E>`       |
| `edge-label`                    | `EdgeLabelSlotProps<L>`         |
| `link-details`                  | `LinkDetailsSlotProps<L>`       |
| `details-edit`                  | `EditSlotProps<AssetEntity<E>>` |
| `link-edit`                     | `EditSlotProps<AssetLink<L>>`   |
| `node-{type}`, `node-badge`     | `NodeSlotProps<E>`              |
| `node-label`, `node-status`     | `NodeSlotProps<E>`              |

`NodeSlotProps` несёт `entity`, `nodeId` и `simplified` для всех слотов `node-*` плюс по одному полю тому слоту, которому
оно нужно: `badge` для `node-badge`, `sublabels` для `node-label`, `status` и `statusColor` для `node-status`.

#### Императивный API — `AssetMapExposed<E, L>`

| Метод            | Сигнатура                                                 |
| ---------------- | --------------------------------------------------------- |
| `fitView`        | `() => Promise<void>`                                     |
| `focus`          | `(id: EntityId, options?: FocusOptions) => Promise<void>` |
| `relayout`       | `() => Promise<void>`                                     |
| `highlightPath`  | `(from, to, options?: PathOptions) => EntityId[]`         |
| `clearHighlight` | `() => void`                                              |
| `getGraph`       | `() => AssetGraph<E, L>`                                  |
| `getPositions`   | `() => Record<EntityId, XY>` — все видимые узлы           |
| `resetPositions` | `() => void` — забыть расставленное руками                |
| `updateEntity`   | `(entity) => boolean` — заменить одну запись              |

### Остальные компоненты

| Компонент                                   | Зачем                                                            |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `MapWindow`                                 | Каркас плавающего окна: шапка, перетаскивание, сжатие, закрытие. |
| `DetailsPanel`                              | Окно подробностей по умолчанию.                                  |
| `LinkDetailsPanel`                          | Окно соединения по умолчанию.                                    |
| `DetailsSection`                            | Секция панели: заголовок плюс содержимое.                        |
| `EditableFields`                            | Строки полей, переключающиеся между чтением и правкой.           |
| `ContextMenu`                               | Меню в точке полотна.                                            |
| `ConfirmDialog`                             | Подтверждение пакета, а не `window.confirm`.                     |
| `MapLegend`                                 | Легенда соединений.                                              |
| `BaseNode`, `GroupNode`                     | Узел и групповой узел по умолчанию.                              |
| `AssetEdge`                                 | Ребро по умолчанию.                                              |
| `MiniMap`                                   | Обзорная карта.                                                  |
| `SearchInput`, `ViewSwitcher`, `FilterMenu` | Контролы тулбара; работают и вне карты.                          |

## Типы

### Данные

`AssetEntity<M>`, `AssetLink<M>`, `AssetView`, `ProjectionResult`, `EntityId`, `XY`, `Badge`, `AssetGraph<E, L>`,
`GraphIssue`, `GraphIssueCode`.

У `AssetLink` могут быть ещё `sourceHandle` и `targetHandle`. Они нужны только компоненту узла, который рисует
больше одной ручки — порты коммутатора, слоты в стойке, объекты внутри блока, — когда линия соединяет конкретную пару,
а не два узла целиком. Без них линия садится на первую ручку подходящего типа.

### Свёртка

`CollapseRule`, `CollapsedGroup`, `CollapsedLink<L>`, `CollapseResult<L>`, `AggregatedLink<L>`, `CollapseOptions`.

### Фильтрация

`FilterState`, `FilterOptions`, `FilterResult`, `FacetCounts`, `FilterGroupDef`, `FilterGroupOption`.

### Маркеры

`NodeMarkerDef`, `ResolvedNodeMarker`, `MarkerAnchor`, `ConnectionMarkerOptions`.

### Раскладка

`LayoutEngine<O>`, `LayoutGraph`, `LayoutNode`, `NodeSize`, `ManualLayoutOptions`, `RadialLayoutOptions`,
`DagreLayoutOptions`, `LayoutAbortedError`.

### Контракт компонента

`AssetMapProps<E, L>`, `AssetMapModels`, `AssetMapSlots<E, L>`, `AssetMapExposed<E, L>`, `AssetMapLayoutSpec`,
`Viewport`, `FocusOptions`, `InfectionOptions`, `PathOptions`, `NodeEventPayload`, `NodeSlotProps<E>`,
`DetailsSlotProps<E>`, `DetailsHeaderSlotProps<E>`, `DetailsTitleSlotProps<E>`, `DetailsTabsSlotProps<E>`,
`DetailsTabDef`, `LinkDetailsSlotProps<L>`, `EdgeLabelSlotProps<L>`, `EmptySlotProps`, `MiniMapNode`, `MapContext`,
`AssetNodeData<E>`, `EntityNodeData<E>`, `GroupNodeData`, `AssetEdgeData`, `ContextMenuItem`.

### Соединения и правка

`LinkTypeDef`, `FieldDef`, `FieldOption`, `EditSlotProps<T>`.

### Тема и локаль

`ThemeMode`, `ResolvedTheme`, `ThemeConfig`, `LocaleMessages`, `PartialLocaleMessages`, `LocaleKey`, `Translate`.

### IP

`CidrRange`.

## Composables

| Composable                                                                      | Что возвращает                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `useAssetGraph(entities, links)`                                                | `{ graph, issues }` — индексы плюс отчёты о починке.                    |
| `useViewProjection(graph, views, viewId)`                                       | `{ view, projection, showSublabels }`                                   |
| `useFilters(graph, projection, filters, options, debounceMs)`                   | `{ result, facets, active, visibleIds, matchedIds }`                    |
| `useCollapse(graph, visibleIds, projection, rule, expanded, collapsedParents?)` | Состояние групп плюс переключатели.                                     |
| `useLayout(params)`                                                             | `{ positions, running, engineName, relayout, positionOf, … }`           |
| `useFlowElements(params)`                                                       | `{ nodes, edges }` для `<VueFlow>`.                                     |
| `useSelection(selection)`                                                       | Состояние выделения и его изменение.                                    |
| `useNodeMarkers(graph, markers, hoverDelay)`                                    | `{ markersFor, hoveredMarker, memberIds, … }`                           |
| `useMapContext()`                                                               | Контекст, который читают узлы и рёбра. Вне `<AssetMap>` бросает ошибку. |
| `useTranslate()`                                                                | Переводчик с откатом на встроенную локаль.                              |
| `resolveTheme(mode)`                                                            | `ComputedRef<ResolvedTheme>`.                                           |

Это те самые части, из которых собран сам `<AssetMap>`; они экспортированы, чтобы карту можно было собрать руками.
Вместе они образуют конвейер, где каждая ступень принимает результат предыдущей:

```
entities, links → useAssetGraph → useViewProjection → useFilters → useCollapse → useLayout → useFlowElements → <VueFlow>
```

Браться за них имеет смысл, когда мешает сама структура карты: другое полотно, граф, посчитанный на сервере, панель
фильтров, живущая в другом месте приложения. Во всём, что не доходит до этого, ту же работу делают пропы и слоты
`<AssetMap>`.

Через все композаблы проходят два соглашения. На вход идут `Ref`, а не готовые значения, поэтому ступень продолжает
пересчитываться вслед за источником; на выходе — `ComputedRef`, и его никогда не мутируют на месте. А состояние, которым
может владеть потребитель — выделение, раскрытые группы, фильтры, — передаётся **внутрь** как `Ref` и записывается
обратно, а не создаётся внутри. Именно поэтому каждый из них одинаково работает и с `v-model`, и со стором.

### `useAssetGraph(entities, links)`

Строит индексы, которые читают все остальные ступени: `entities` и `links` как `Map`, плюс `parentOf`, `childrenOf`,
`adjacency`. Всё дальше по конвейеру становится поиском по ключу, а не перебором.

Пересчёт привязан к **ссылкам на массивы**, а не к их содержимому. Новый массив переиндексирует граф; правка поля внутри
существующей сущности — нет, потому что ни один индекс от полей не зависит. Мутировать сущность на месте и ждать, что
карта это заметит, — единственное, что здесь работать не будет.

`issues` — это то, что построитель починил или выбросил из текущих данных: связь в несуществующую сущность, цикл в
родителях, дублирующийся id. Сборка никогда не падает из-за плохих данных: карта, отрисовавшая 900 узлов из 1000,
полезнее пустого экрана, а отчёт точно говорит, что потерялось. В разработке его стоит логировать.

`meta` каждой сущности прогоняется через `markRaw`. Vue Flow делает `node.data` реактивным, и без этого Vue обернул бы
прокси каждый вложенный объект пользовательских данных без всякой пользы — панель подробностей их только читает.
Помечается именно `meta`, но не сама сущность.

### `useViewProjection(graph, views, viewId)`

Применяет активное представление и возвращает разрешённый `view`, `projection` (пережившие его `entityIds` и `linkIds`)
и `showSublabels`.

`viewId` приходит снаружи и может называть представление, которого уже нет, — например, сохранённое из старой
конфигурации. `resolveView` тогда откатывается на первое представление, а не в пустоту: устаревший id вырождается в
другую карту, а не в пустую.

Проекция — это и есть то, что везде дальше означает «в пределах текущего представления»: фильтрация, счётчики фасетов и
поиск пути берут область действия из неё.

### `useFilters(graph, projection, filters, options, debounceMs)`

Поиск и фасетная фильтрация поверх проекции. Возвращает `matchedIds` (прямые попадания, их и подсвечивают),
`visibleIds` (попадания плюс сохранённый контекст), `facets` для счётчиков и `active` — задан ли вообще хоть один
критерий.

Дебаунс живёт здесь, а не в поле ввода, и относится **только к текстовому запросу**. Ядро остаётся синхронной чистой
функцией, а «не пересчитывать граф на каждое нажатие» — свойство интерфейса. Клик по фасету — одно осознанное действие,
и задержка сделала бы его просто вязким. Очистка поля применяется сразу: ждать возвращения карты незачем.

`facets` считаются по проекции, а не по результату фильтрации. Счёт по результату обнулял бы все остальные счётчики в
момент выбора одного значения, не оставляя, куда вернуться.

### `useCollapse(graph, visibleIds, projection, rule, expanded, collapsedParents?)`

Схлопывает наборы однотипных соседей по родителю в групповые узлы, а через необязательный `collapsedParents` — прячет
поддеревья по кнопке на узле. Возвращает свёрнутый граф, группы и переключатели: `expand`, `collapse`, `toggle`,
`toggleSubtree`. Переключатели возвращают **новое** состояние, поэтому вызывающая сторона может сразу эмитить нужное
событие, ничего не перечитывая.

Работает до раскладки, и это осознанно: позиции считаются по свёрнутому графу, иначе один групповой узел встал бы в
место, размеченное под четырнадцать заменённых им узлов.

`expanded` никогда не мутируется на месте. Vue действительно отслеживает мутации `Set`, но этот набор мог прийти из
стора потребителя, поэтому наружу всегда уходит новый `Set`.

Обратите внимание на порядок аргументов: композабл принимает `visibleIds` от фильтра, но `<AssetMap>` передаёт ему id
**проекции**. Свёртка следует за представлением, а не за поиском, — иначе состав групп менялся бы на каждую набранную
букву и карта перестраивалась бы прямо под руками.

### `useLayout(params)`

Запускает алгоритм раскладки и применяет результат. Принимает объект: `graph`, `collapsed`, `spec`, `view`, колбэк
`sizeOf` и необязательные хуки `onStart` / `onDone` / `onError`. Возвращает `positions`, `running`, `engineName`,
`relayout`, `positionOf` и сеттеры ручных позиций.

Приоритет позиций: перетащено руками → `entity.position` с бэкенда → результат алгоритма. Первые два отдаются алгоритму
как `pinned`, а не накладываются поверх его результата: так алгоритм их не трогает вместо того, чтобы сдвинуть и быть
поправленным кадром позже. `positionOf` применяет тот же порядок, поэтому узел не прыгает между «до» и «после»
применения результата.

Каждый запуск прерывает предыдущий через `AbortSignal`: переключите вид трижды подряд — применится только последняя
раскладка. Прерывание перепроверяется после `await`, а не только внутри алгоритма, потому что сторонний алгоритм может
проигнорировать сигнал вовсе. Результат ложится одним присваиванием `Map` — один реактивный триггер на раскладку, а не
на узел.

Неизвестное имя алгоритма откатывается на `manual` и сообщается через `onError`, а не бросается. Имена приходят из
данных представления, то есть снаружи, и опечатка не должна обнулять карту.

Раскладка полностью игнорирует фильтр. Поиск прячет и подсвечивает, но никогда не перестраивает.

### `useFlowElements(params)`

Превращает свёрнутый граф в массивы `nodes` и `edges`, которые принимает Vue Flow.

`node.data` несёт необходимый минимум — сущность или группу. Всё изменчивое (выделение, подсветка, LOD) компоненты узлов
читают из контекста карты, поэтому смена выделения не перестраивает массив узлов. Это то единственное решение, которое
держит большие карты отзывчивыми.

Фильтрация прячет через `node.hidden`, штатный механизм Vue Flow, а не выбрасыванием узлов из массива: выброшенные узлы
оставили бы рёбра, тянущиеся к тому, чего больше нет. Групповой узел остаётся видимым, пока совпадает хоть один его
участник, — иначе группа исчезала бы ровно тогда, когда вы ищете что-то внутри неё.

Узлы строятся с `selectable: false, focusable: false`. У Vue Flow есть собственное состояние выделения, а два источника
истины для одного выделения всегда расходятся.

### `useSelection(selection)`

Состояние выделения поверх вашего `Ref<EntityId[]>`. Возвращает `selectedIds` (`Set`), `primaryId`, `isSelected` и
изменяющие функции `select`, `deselect`, `toggle`, `clear`, `replace`.

Наружу состояние уходит **массивом**, но внутри зеркалится в `Set` для проверок: `includes` на узел на рендер — это
квадрат на большой карте. Порядок сохраняется, и он осмысленный: «выбранный первым» — это то, что показывает панель
подробностей, а «выбраны двое» — та пара, между которой строится путь.

`toggle(id, additive)` — это то, что вызывает клик. Обычный клик по уже выделенному узлу оставляет его единственным
выделенным, а не снимает выделение: снимать — это задача клика по фону.

### `useNodeMarkers(graph, markers, hoverDelay)`

Кружки принадлежности и подсветка по наведению, которой они управляют. Возвращает `markersFor`, `hoveredMarker`,
`memberIds` и обработчики указателя.

Индекс «сущность → маркеры» строится один раз на изменение данных и перебирает **маркеры**, а не сущности: маркер с
`members` считает свой набор одним проходом по графу, тогда как предикат `match` на каждую сущность стоил бы
сущности × маркеры. Отсюда следствие, на которое можно опираться: порядок кружков на узле — это порядок объявления
маркеров, поэтому один и тот же маркер стоит на одном и том же месте на всех узлах.

Цвета раздаются по порядку объявления из палитры в три токена и закольцовываются, поэтому маркер держит свой цвет
независимо от того, какие узлы его несут.

Наведение выжидает `hoverDelay` (по умолчанию 500 мс) до подсветки, чтобы указатель, просто пересекающий кружки по пути
в другое место, не вспыхивал всей картой. Уход отменяет и отложенную задержку, и уже начавшуюся подсветку. Фокус с
клавиатуры подсвечивает сразу: фокус и так осознанное действие.

### `useMapContext()`

Читает контекст, который публикует `<AssetMap>`: переводчик, граф, предикаты состояния узла (`isSelected`, `isDimmed`,
`isInfected`, …) и колбэки взаимодействий. Именно им пользуется свой компонент узла или ребра — и именно поэтому такому
компоненту не нужны пропы, кроме `id` и `data`.

Взаимодействия идут через контекст (`onNodeClick`, `onNodeDoubleClick`, `onNodeContextMenu`), а не через события Vue
Flow, поэтому поведение одинаково независимо от того, включено ли собственное выделение Vue Flow, и одинаково для мыши и
клавиатуры.

Вне `<AssetMap>` он **бросает** ошибку с внятным текстом. Возврат `undefined` всплыл бы как
`undefined is not a function` где-то в глубине рендера чужого узла, а это куда худший способ узнать, что компонент
смонтировали не в том месте.

### `useTranslate()`

Переводчик для отдельно стоящих контролов. В отличие от `useMapContext`, без контекста он **не** бросает ошибку, а
откатывается на встроенную локаль. `SearchInput`, `ViewSwitcher` и `FilterMenu` экспортируются для использования вне
карты — скажем, в шапке страницы, — и контрол не должен ломаться просто оттого, что его оттуда вынесли.

### `resolveTheme(mode)`

Сводит `ThemeMode` к `'light' | 'dark'`.

`'auto'` читает системную настройку **один раз** и дальше за ней не следит. У продукта есть явный переключатель темы, и
он должен побеждать; будь `auto` подписан на `prefers-color-scheme`, смена темы ОС молча перебила бы выбор, сделанный
пользователем руками.

Чтение ленивое и запоминается: карта с `theme: 'light'` не вызывает `matchMedia` вовсе, а обращение к `window` спрятано
за проверкой внутри функции, а не на верхнем уровне модуля, — поэтому пакет по-прежнему импортируется под SSR.

## Ядро

Доступно и из `vue-asset-map`, и из `vue-asset-map/core`.

### Граф

| Функция                                 | Зачем                                               |
| --------------------------------------- | --------------------------------------------------- |
| `buildGraph(entities, links, options?)` | Строит индексы, сообщает о починке через `onIssue`. |
| `emptyGraph()`                          | Граф без сущностей и связей.                        |
| `parentIdOf(graph, id)`                 | Эффективный родитель, `null` для корня.             |
| `ancestorsOf(graph, id)`                | Цепочка до корня. Циклобезопасно.                   |
| `descendantsOf(graph, id)`              | Обход в глубину, без самого узла. Циклобезопасно.   |
| `incidentLinks(graph, id, layers?)`     | Связи, касающиеся узла.                             |
| `matchesLayers(link, layers)`           | Пустой список слоёв совпадает со всем.              |
| `otherEnd(link, id)`                    | Другой конец; для петли — сам `id`.                 |

### Проекция

`projectGraph(graph, view?)`, `resolveView(views, viewId)`, `defaultLinkFilter(view)`.

### Фильтрация

`applyFilters(graph, state, options?)`, `facetCounts(graph, restrictTo?, groups?)`, `emptyFilterState()`,
`isFilterActive(state)`, `matchesQuery(fields, query)`, `defaultSearchFields(entity)`, `groupValuesOf(group, entity)`,
`selectedGroupCount(state)`.

### Свёртка

`collapseGraph(graph, options?)`, `groupIdFor(parentId, bucket)`, `isAggregatedLink(link)`.

### Обходы

`neighbors(graph, id, depth, layers?)`, `findPaths(graph, from, to, options?)`, `blastRadius(graph, id, options?)`.

### Маркеры

`connectionMarkers(anchors, options?)`, `topAnchors(graph, count, layers?)`.

### Поля

Чистые функции, на которых держатся формы правки. `readField(source, path)` и `writeField(source, path, value)` читают
и пишут по точечному пути (`'meta.speed'`); `writeField` копирует каждый затронутый уровень и создаёт недостающие ветки,
поэтому `meta.speed` можно задать сущности, у которой `meta` ещё нет. `applyFields(source, values)` применяет весь
черновик разом и возвращает **тот же объект**, если ничего фактически не изменилось, — так нетронутая форма отличается
от настоящей правки. `fieldLabel`, `fieldToInput` и `fieldFromInput` переводят между хранимым значением и тем, что
лежит в `<input>`.

### IP

`parseIPv4(value)`, `extractIPv4(text)`, `parseCidr(query)`, `cidrContains(range, address)`,
`isIPv4Wildcard(query)`, `wildcardToRegExp(query)`, `matchesWildcard(text, query)`, `matchesCidr(text, range)`.

### Раскладка

`manualLayout`, `radialLayout`, `builtinLayoutEngines`, `resolveLayoutEngine(engine, extra?)`,
`applyPinned(positions, nodes)`, `throwIfAborted(signal, engineName)`, `isLayoutAborted(error)`,
`LayoutAbortedError`, `isLayoutLimit(error)`, `LayoutLimitError`, `createWorkerLayout(name, createWorker)`. Алгоритм
dagre экспортируется как `dagreLayout` из `vue-asset-map/layout-dagre`; `exposeLayoutEngine(engines)` для стороны
воркера — из `vue-asset-map/layout-worker`.

### Реестр

`buildNodeTypes(custom?)`, `buildEdgeTypes(custom?)`, `nodeTypeFor(type, types)`, `edgeTypeFor(type, types)`,
`NODE_TYPE_BASE`, `NODE_TYPE_GROUP`, `EDGE_TYPE_BASE`.

### Локаль

`builtinLocales`, `defaultLocale`, `resolveLocale(locale?)`, `createTranslator(messages)`, `en`, `ru`.
