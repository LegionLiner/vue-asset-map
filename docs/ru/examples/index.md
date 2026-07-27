# Примеры

Все примеры работают на одной демо-инфраструктуре: облака, VPS, роутеры, гипервизоры, рабочие станции и ферма
контейнеров. Поэтому поведение можно сравнивать между примерами. Исходник под каждым примером — это тот же файл,
который его рисует.

## Базовый граф

Сущности, связи, иконки и радиальная раскладка. Клик по узлу открывает подробности, перетаскивание двигает узел.

<LiveDemo :source="basicSource" source-label="Показать исходник">
  <BasicMap />
</LiveDemo>

## Переключение представлений

Один набор данных, две топологии. Счётчик считает страница через `vue-asset-map/core`, поэтому он всегда согласован с
тем, что рисует карта.

<LiveDemo :source="projectionsSource" source-label="Показать исходник">
  <ProjectionsMap />
</LiveDemo>

## Свёрнутая группа из 14 узлов

Четырнадцать контейнеров на одном гипервизоре складываются в один групповой узел со счётчиком. Их рёбра переезжают на
группу, а те, что были внутренними, считаются, а не рисуются. Клик раскрывает.

<LiveDemo :source="collapsedSource" source-label="Показать исходник">
  <CollapsedGroupMap />
</LiveDemo>

## Свой компонент узла

`#node-workstation` подменяет содержимое круга только для одного типа, остальные узлы рисуются как обычно.

<LiveDemo :source="customNodeSource" source-label="Показать исходник">
  <CustomNodeMap />
</LiveDemo>

## Своя панель подробностей

Слот `#details` с ярлыками полей приложения. Пакет не угадывает, что лежит в `meta`.

<LiveDemo :source="customDetailsSource" source-label="Показать исходник">
  <CustomDetailsMap />
</LiveDemo>

## Тёмная тема

`theme` — обычный prop. Карта читает системную настройку только по запросу `'auto'` и никуда её не записывает.

<LiveDemo :source="darkSource" source-label="Показать исходник">
  <DarkThemeMap />
</LiveDemo>

## Трассировка пути между двумя узлами

`autoPath` строит путь сам: два узла выбраны заранее, поэтому путь ниже уже подсвечен, и ничего вызывать не пришлось.
Чтобы проследить свою пару, зажмите Shift и кликните по двум узлам. Shift работает как аддитивный модификатор на любой
платформе, в отличие от Ctrl+клика, который macOS трактует как правый клик, а клик с модификатором только выделяет и
окном путь не закрывает. Маршрут приходит событием `path-change`; ищется он по исходному графу, а подсвечивается по
свёрнутому.

<LiveDemo :source="pathSource" source-label="Показать исходник">
  <PathTraceMap />
</LiveDemo>

## Маркеры принадлежности

Кружки под подписями, выведенные из графа. Узел, связанный с двумя центрами, несёт два кружка. Наведите на один, чтобы
подсветить всех, у кого он есть.

<LiveDemo :source="markersSource" source-label="Показать исходник">
  <MarkersMap />
</LiveDemo>

## Поиск и группы фильтров

Попробуйте `10.38.24.0/24`, `10.38.24.*` или обычное слово в поле поиска, и откройте панель фильтров слева.

<LiveDemo :source="searchSource" source-label="Показать исходник">
  <SearchMap />
</LiveDemo>

## Типы связей и подписи

`type` выбирает стиль ребра, `directed` добавляет стрелку, а `#edge-label` подменяет подпись.

<LiveDemo :source="edgeKindSource" source-label="Показать исходник">
  <EdgeKindMap />
</LiveDemo>

## Переключение алгоритмов раскладки

Один и тот же граф через `radial` и `manual`. Опции алгоритма проходят насквозь.

<LiveDemo :source="layoutSource" source-label="Показать исходник">
  <LayoutMap />
</LiveDemo>

## Большой граф: 1000 узлов

Сгенерирован детерминированно, свёрнут с порогом 12, с монтированием только видимых элементов и включённой обзорной
картой.

<LiveDemo :source="largeSource" source-label="Показать исходник" height="620px">
  <LargeGraphMap />
</LiveDemo>

## Всё заменяемое — заменено

Остальные примеры меняют что-то одно. Этот оставляет граф, проекции, раскладку, поиск и обходы — и заменяет каждый
пиксель над ними.

Ничего из этого не лезет во внутренности пакета: каждая часть — документированный проп или слот.

- **Фигуры вместо кругов.** Компонент из `nodeTypes` рисует пилюлю, ромб, квадрат, шестиугольник, скруглённый квадрат
  и восьмиугольник — по одной на вид. Фигура должна была заменить круг целиком, поэтому это компонент, а не слот
  `#node-{type}`: слот подменяет то, что _внутри_ круга, и оставляет сам круг. Тип несёт фигура, поэтому карта
  читается и без цвета.
- **Прямоугольная разводка.** Компонент из `edgeTypes` меняет кривую Безье на ступенчатую линию и ставит на неё свою
  плашку. Цвет и штрих по-прежнему приходят из `linkTypes` через `useMapContext()`.
- **Свой интерфейс.** `showToolbar` выключен; панель над картой — обычная разметка страницы, управляющая
  `v-model:filters`, `v-model:view` и методами `fitView` / `relayout`. Чипсы фильтров повторяют фигуры узлов, поэтому
  фильтр показывает, какую фигуру выбирает, а не только называет её.
- **Своё окно.** `showDetailsHeading` выключен, `detailsTitle` — функция, остальное дают `#details-title`,
  `#details-tabs` и `#details`. От пакета остаётся одна шапка.
- **Своя форма.** `#details-edit` рисует контролы потребителя; пакет даёт черновик, сохранение и отмену — и больше
  ничего.
- **Свои меню и модалка.** `showContextMenu` выключен, страница сама обрабатывает `node-context-menu` и подтверждает
  удаление собственным диалогом. Пакет везёт и то и другое — здесь видно, что ни то, ни другое не обязательно.
- **И всё остальное тоже своё.** Токены темы переопределены как обычные CSS-переменные на `.vam-root`, три строки
  локали переименованы, а легенда — это `MapWindow` в слоте `#windows`.

Правый клик по узлу открывает своё меню, кнопка правки — свою форму, а перетаскивание от точек по краям фигуры рисует
кабель.

<LiveDemo :source="fullyCustomSource" source-label="Показать исходник" height="640px">
  <FullyCustomMap />
</LiveDemo>

Компоненты узла и связи лежат рядом, в
[`demos/custom/`](https://github.com/LegionLiner/vue-asset-map/tree/main/docs/.vitepress/demos/custom).

<script setup>
import basicSource from '../../.vitepress/demos/BasicMap.vue?raw'
import projectionsSource from '../../.vitepress/demos/ProjectionsMap.vue?raw'
import collapsedSource from '../../.vitepress/demos/CollapsedGroupMap.vue?raw'
import customNodeSource from '../../.vitepress/demos/CustomNodeMap.vue?raw'
import customDetailsSource from '../../.vitepress/demos/CustomDetailsMap.vue?raw'
import darkSource from '../../.vitepress/demos/DarkThemeMap.vue?raw'
import pathSource from '../../.vitepress/demos/PathTraceMap.vue?raw'
import markersSource from '../../.vitepress/demos/MarkersMap.vue?raw'
import searchSource from '../../.vitepress/demos/SearchMap.vue?raw'
import edgeKindSource from '../../.vitepress/demos/EdgeKindMap.vue?raw'
import layoutSource from '../../.vitepress/demos/LayoutMap.vue?raw'
import largeSource from '../../.vitepress/demos/LargeGraphMap.vue?raw'
import fullyCustomSource from '../../.vitepress/demos/FullyCustomMap.vue?raw'
</script>
