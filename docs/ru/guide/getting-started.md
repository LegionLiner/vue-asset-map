# Начало работы

## Установка

```bash
npm install vue-asset-map vue @vue-flow/core
```

`vue` и `@vue-flow/core` — peer-зависимости. Vue Flow должен быть в дереве зависимостей ровно один раз. Он работает
через `provide`/`inject`, и вторая копия ломает контекст провайдера.

Раскладка на dagre опциональна и подтягивается, только если вы её импортируете:

```bash
npm install @dagrejs/dagre
```

## Подключение стилей

Нужны два файла, и оба подключает приложение. Vue Flow даёт структурный CSS холста, пакет — свои токены и правила
компонентов.

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'

import '@vue-flow/core/dist/style.css'
import 'vue-asset-map/style.css'

createApp(App).mount('#app')
```

Пакет никогда не импортирует CSS из JavaScript: так модуль остаётся загружаемым в чистом Node (SSR без бандлера), а
порядок каскада остаётся под вашим контролем.

## Первая карта

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AssetMap } from 'vue-asset-map'
import type { AssetEntity, AssetLink, AssetView } from 'vue-asset-map'

const entities: AssetEntity[] = [
  { id: 'internet', type: 'cloud', label: 'Интернет' },
  { id: 'router', type: 'router', label: 'Роутер офиса', parentId: 'internet', sublabels: ['10.0.0.1'] },
  { id: 'vpn', type: 'vps', label: 'Координатор VPN', parentId: 'internet', status: 'online' },
  { id: 'laptop', type: 'host', label: 'Ноутбук', parentId: 'router', sublabels: ['10.0.0.14'] },
]

const links: AssetLink[] = [
  { id: 'l1', source: 'internet', target: 'router', layers: ['physical'] },
  { id: 'l2', source: 'internet', target: 'vpn', layers: ['physical'] },
  { id: 'l3', source: 'router', target: 'laptop', layers: ['physical'] },
  { id: 'l4', source: 'vpn', target: 'laptop', layers: ['logical'] },
]

const views: AssetView[] = [
  { id: 'physical', label: 'Физическая', hideIsolated: true },
  { id: 'logical', label: 'VPN-оверлей', hideIsolated: true },
]

const view = ref('physical')
const selection = ref<string[]>([])
</script>

<template>
  <AssetMap
    v-model:view="view"
    v-model:selection="selection"
    :entities="entities"
    :links="links"
    :views="views"
    style="height: 100vh"
  />
</template>
```

Три вещи, которые стоит заметить.

**Карта занимает свой контейнер.** Своей высоты у неё нет. Задайте её сами: `height: 100vh`, ячейка грида, что угодно.

**Связь попадает в представление, если её `layers` содержат id представления.** `l4` лежит только на слое `logical`,
поэтому он виден в оверлее и больше нигде. С `hideIsolated` узел, оставшийся в представлении без связей, из него
убирается.

**`v-model` не обязателен.** Если вы его привязали, состояние хранится у вас; если нет, им управляет компонент. Это
верно для `view`, `selection`, `expanded`, `filters`, `viewport`, `openDetails`, `collapsedNodes` и
`openFilterGroups`.

## Результат

<LiveDemo :source="basicSource" source-label="Показать исходник">
  <BasicMap />
</LiveDemo>

Демо выше работает на большей фикстуре и добавляет иконки и алгоритм раскладки — об этом на следующих страницах.

## Дальше

- [Модель данных](./data-model) — что может нести сущность и связь.
- [Представления](./views) — представления, слои и изолированные узлы.
- [Узлы](./nodes) — иконки, свои компоненты узлов и слоты.
- [Поиск и фильтры](./search) — поиск по IP и группы фильтров.

<script setup>
import basicSource from '../../.vitepress/demos/BasicMap.vue?raw'
</script>
