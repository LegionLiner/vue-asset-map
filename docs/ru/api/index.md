# Справочник API

Всё, что экспортирует пакет. Точек входа четыре:

| Импорт                       | Что внутри                                              |
| ---------------------------- | ------------------------------------------------------- |
| `vue-asset-map`              | Компоненты, composables, типы и всё содержимое ядра.    |
| `vue-asset-map/core`         | Функции по графу без Vue и без Vue Flow.                |
| `vue-asset-map/layout-dagre` | Алгоритм раскладки dagre, за опциональной зависимостью. |
| `vue-asset-map/style.css`    | Токены, светлая и тёмная темы, правила компонентов.     |

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
| `onlyRenderVisibleElements` | `boolean`                         | `true`                 | Монтирование только элементов в области просмотра.   |
| `lodThreshold`              | `number`                          | `0.5`                  | Масштаб, ниже которого узлы рисуются упрощённо.      |
| `searchDebounce`            | `number`                          | `200`                  | Задержка в мс перед применением запроса.             |
| `loading`                   | `boolean`                         | `false`                | Индикатор загрузки.                                  |
| `autoFitView`               | `boolean`                         | `false`                | Автоподгонка холста под содержимое после раскладки.  |

`entities` и `links` компонент только читает: он не добавляет, не переставляет и не нормализует поля во входных
массивах. Без `views` рисуются все сущности и связи.

#### Двусторонние привязки

| Модель             | Тип                     | Что хранит                                   |
| ------------------ | ----------------------- | -------------------------------------------- |
| `view`             | `string \| undefined`   | Id активного представления.                  |
| `selection`        | `EntityId[]`            | Выделенные id в порядке выбора.              |
| `expanded`         | `Set<string>`           | Id групп, раскрытых руками.                  |
| `filters`          | `FilterState`           | Запрос, группы фильтров, выбор по группам.   |
| `viewport`         | `Viewport`              | Сдвиг в пикселях плюс масштаб.               |
| `openDetails`      | `EntityId[]`            | Сущности с открытым окном; последняя сверху. |
| `collapsedNodes`   | `Set<EntityId>`         | Узлы со свёрнутым поддеревом.                |
| `openFilterGroups` | `string[] \| undefined` | Раскрытые списки фильтров.                   |

Каждая привязка работает и без `v-model`. Тогда состоянием владеет компонент.

#### События

| Событие                                            | Данные события                                            |
| -------------------------------------------------- | --------------------------------------------------------- |
| `node-click`, `node-dblclick`, `node-context-menu` | `NodeEventPayload`                                        |
| `edge-click`                                       | `{ id: string; event: MouseEvent }`                       |
| `pane-click`                                       | `MouseEvent`                                              |
| `expand`, `collapse`                               | `{ groupId: string; group: CollapsedGroup \| undefined }` |
| `node-expand`, `node-collapse`                     | `{ id: EntityId; entity: AssetEntity<E> \| undefined }`   |
| `selection-change`                                 | `EntityId[]`                                              |
| `path-change`                                      | `EntityId[]` — путь; пустой, когда подсветку сняли        |
| `layout-start`                                     | `string` — имя алгоритма                                  |
| `layout-done`                                      | `{ engine: string; positions: number }`                   |
| `error`                                            | `unknown`                                                 |

#### Слоты

| Слот                            | Параметры                   |
| ------------------------------- | --------------------------- |
| `toolbar-left`, `toolbar-right` | —                           |
| `empty`, `loading`              | —                           |
| `windows`                       | —                           |
| `details`                       | `DetailsSlotProps<E>`       |
| `details-header`                | `DetailsHeaderSlotProps<E>` |
| `details-title`                 | `DetailsTitleSlotProps<E>`  |
| `details-tabs`                  | `DetailsTabsSlotProps<E>`   |
| `edge-label`                    | `EdgeLabelSlotProps<L>`     |
| `node-{type}`, `node-badge`     | `NodeSlotProps<E>`          |
| `node-label`, `node-status`     | `NodeSlotProps<E>`          |

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

### Остальные компоненты

| Компонент                                   | Зачем                                                            |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `MapWindow`                                 | Каркас плавающего окна: шапка, перетаскивание, сжатие, закрытие. |
| `DetailsPanel`                              | Окно подробностей по умолчанию.                                  |
| `DetailsSection`                            | Секция панели: заголовок плюс содержимое.                        |
| `BaseNode`, `GroupNode`                     | Узел и групповой узел по умолчанию.                              |
| `AssetEdge`                                 | Ребро по умолчанию.                                              |
| `MiniMap`                                   | Обзорная карта.                                                  |
| `SearchInput`, `ViewSwitcher`, `FilterMenu` | Контролы тулбара; работают и вне карты.                          |

## Типы

### Данные

`AssetEntity<M>`, `AssetLink<M>`, `AssetView`, `ProjectionResult`, `EntityId`, `XY`, `Badge`, `AssetGraph<E, L>`,
`GraphIssue`, `GraphIssueCode`.

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
`DetailsTabDef`, `EdgeLabelSlotProps<L>`, `EmptySlotProps`, `MiniMapNode`, `MapContext`, `AssetNodeData<E>`,
`EntityNodeData<E>`, `GroupNodeData`, `AssetEdgeData`.

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

### IP

`parseIPv4(value)`, `extractIPv4(text)`, `parseCidr(query)`, `cidrContains(range, address)`,
`isIPv4Wildcard(query)`, `wildcardToRegExp(query)`, `matchesWildcard(text, query)`, `matchesCidr(text, range)`.

### Раскладка

`manualLayout`, `radialLayout`, `builtinLayoutEngines`, `resolveLayoutEngine(engine, extra?)`,
`applyPinned(positions, nodes)`, `throwIfAborted(signal, engineName)`, `isLayoutAborted(error)`,
`LayoutAbortedError`. Алгоритм dagre экспортируется как `dagreLayout` из `vue-asset-map/layout-dagre`.

### Реестр

`buildNodeTypes(custom?)`, `buildEdgeTypes(custom?)`, `nodeTypeFor(type, types)`, `edgeTypeFor(type, types)`,
`NODE_TYPE_BASE`, `NODE_TYPE_GROUP`, `EDGE_TYPE_BASE`.

### Локаль

`builtinLocales`, `defaultLocale`, `resolveLocale(locale?)`, `createTranslator(messages)`, `en`, `ru`.
