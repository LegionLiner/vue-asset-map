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

Два узла выбраны заранее, поэтому путь ниже уже подсвечен. Чтобы проследить свою пару, зажмите Shift и кликните по двум
узлам. Shift работает как аддитивный модификатор на любой платформе, в отличие от Ctrl+клика, который macOS трактует
как правый клик. Путь ищется по исходному графу, а подсвечивается по свёрнутому.

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

`kind` выбирает стиль ребра, `directed` добавляет стрелку, а `#edge-label` подменяет подпись.

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
</script>
