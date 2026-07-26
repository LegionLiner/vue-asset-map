# Панель подробностей

Клик по узлу открывает перетаскиваемое окно. Пакет наполняет его по минимуму — название, тип, табы и плоский список
полей `meta`, — потому что не знает ни имён ваших полей, ни того, какие из них важны. Настоящее содержимое идёт в слот
`#details`.

<LiveDemo :source="detailsSource" source-label="Показать исходник">
  <CustomDetailsMap />
</LiveDemo>

## Наполнение окна

```vue
<script setup lang="ts">
import { AssetMap, DetailsSection } from 'vue-asset-map'

const LABELS = { owner: 'Владелец', os: 'ОС', cpu: 'vCPU' }
</script>

<template>
  <AssetMap :entities="entities" :links="links">
    <template #details="{ entity, close, tab }">
      <DetailsSection title="Инвентаризация">
        <div v-for="(label, key) in LABELS" :key="key">
          <span>{{ label }}</span>
          <span>{{ entity.meta?.[key] ?? '—' }}</span>
        </div>
      </DetailsSection>
      <button type="button" @click="close">Закрыть</button>
    </template>
  </AssetMap>
</template>
```

`DetailsSection` экспортируется, чтобы свою панель можно было собрать из тех же блоков, что и дефолтную, и не подбирать
отступы и типографику на глаз.

## Полностью своё оформление

Окно подробностей — это четыре части одна под другой: шапка (`.vam-window__header`), заголовочный блок
(`.vam-window__heading`), полоса вкладок (`.vam-window__tabs`) и тело (`.vam-window__content`). Всё, что ниже шапки,
можно подменить или убрать совсем, и останется только одна шапка:

| Часть             | Замена            | Убрать                      |
| ----------------- | ----------------- | --------------------------- |
| Шапка             | `detailsTitle`    | —                           |
| Подпись в шапке   | `#details-title`  | —                           |
| Заголовочный блок | `#details-header` | `showDetailsHeading: false` |
| Полоса вкладок    | `#details-tabs`   | `detailsTabs: false`        |
| Состав вкладок    | `detailsTabs`     | —                           |
| Тело              | `#details`        | —                           |

По умолчанию окно называется `entity.label`. `detailsTitle` меняет название — строкой или функцией от сущности:

```vue
<AssetMap
  :entities="entities"
  :links="links"
  :details-title="(entity) => `${entity.type.toUpperCase()} · ${entity.label}`"
/>
```

`#details-title` забирает подпись себе целиком — не строкой, а разметкой, — и получает вместе с сущностью состояние
`collapsed`:

```vue
<template #details-title="{ entity, collapsed }">
  <b>{{ entity.label }}</b>
  <small v-if="!collapsed">{{ entity.type }}</small>
</template>
```

`#details-header` подменяет заголовочный блок под шапкой — крупное название со строкой типа и состояния.
`showDetailsHeading: false` его убирает.

Всё вместе оставляет от дефолтного оформления одну шапку:

```vue
<AssetMap
  :entities="entities"
  :links="links"
  details-title="Карточка актива"
  :show-details-heading="false"
  :details-tabs="[{ id: 'risk', label: 'Риски' }]"
>
  <template #details-tabs="{ tabs, active, select }">
    <nav class="my-tabs">
      <button v-for="tab in tabs" :key="tab.id" :class="{ on: tab.id === active }" @click="select(tab.id)">
        {{ tab.label }}
      </button>
    </nav>
  </template>
  <template #details="{ entity, tab }">
    <MyPanel :entity="entity" :tab="tab" />
  </template>
</AssetMap>
```

Сама шапка остаётся: на ней держатся перетаскивание, сжатие и закрытие — то, что делает это окном. Если своей должна быть
и шапка, соберите окно из `MapWindow` в слоте `#windows` — об этом ниже.

## Несколько окон сразу

`maxDetailsWindows` ограничивает, сколько окон остаётся открытыми; по умолчанию `2`, а `0` выключает окна полностью, не
убирая остальной интерфейс. При достижении лимита открытие следующего закрывает самое старое — молча проигнорировать
клик хуже: пользователь решит, что карта не отвечает.

Окно можно не закрывать, а сжать до шапки. `Escape` закрывает верхнее, по одному за нажатие.

Набор открытых окон — такое же состояние, как остальные:

```vue
<AssetMap v-model:open-details="openDetails" :entities="entities" :links="links" />
```

## Свои окна

`MapWindow` экспортируется: шапка, перетаскивание, сжатие и закрытие, а позиционирование остаётся за вызывающей
стороной.

```vue
<script setup lang="ts">
import { AssetMap, MapWindow } from 'vue-asset-map'
</script>

<template>
  <AssetMap :entities="entities" :links="links">
    <template #windows>
      <MapWindow
        title="История"
        :closable="false"
        :collapsible="false"
        drag-handle
        header-only
        :style="{ position: 'absolute', top: '16px', right: '16px' }"
      >
        <template #header>
          <button type="button">⏮</button>
          <button type="button">⏭</button>
        </template>
      </MapWindow>
    </template>
  </AssetMap>
</template>
```

| Prop          | По умолчанию | Зачем                                                                  |
| ------------- | ------------ | ---------------------------------------------------------------------- |
| `title`       | —            | Подпись по центру шапки.                                               |
| `closable`    | `true`       | `false` для окон, которые закрывать нельзя.                            |
| `collapsible` | `true`       | Кнопка сжатия до шапки.                                                |
| `headerOnly`  | `false`      | Только шапка, без тела.                                                |
| `dragHandle`  | `false`      | Ручка перетаскивания — нужна окнам без заголовка.                      |
| `offset`      | —            | Начальный сдвиг в пикселях, чтобы окна не накладывались друг на друга. |

Окна из слота `#windows` рисуются поверх окон подробностей, а окна подробностей замеряют их и начинаются ниже — новое
окно не закроет вашу «историю». И те и другие опускаются под тулбар, если в `#toolbar-right` что-то есть, чтобы кнопки
приложения оставались доступными.

Интерактивные элементы внутри шапки не являются ручкой перетаскивания: кнопки, ссылки и поля получают свои клики.

## Табы

В дефолтной панели два таба: обзор и связи. Id активного таба доходит до слота `#details` как `tab`, поэтому своя панель
может рисовать разное содержимое. Он никогда не сбрасывается при смене сущности: карта рендерит окна с `key` по id
сущности, поэтому другая сущность — это другой экземпляр компонента с состоянием по умолчанию.

`detailsTabs` заменяет эту пару своими табами. `label` — готовая строка, а не ключ локали: ваши табы — ваши, и словарь
пакета о них ничего не знает. Первый в списке открыт сразу.

```vue
<AssetMap
  :entities="entities"
  :links="links"
  :details-tabs="[
    { id: 'risk', label: 'Риски' },
    { id: 'audit', label: 'Аудит' },
  ]"
>
  <template #details="{ entity, tab }">
    <RiskPanel v-if="tab === 'risk'" :entity="entity" />
    <AuditPanel v-else :entity="entity" />
  </template>
</AssetMap>
```

Со своими табами пакет своего тела не рисует: под незнакомым табом ему нечего показать, а подставить под «Риски»
встроенный список связей было бы прямой ложью. Заполняйте `#details` вместе с ними.

`detailsTabs: false` убирает полосу. Встроенное тело при этом остаётся — табы убраны, а не подменены, — поэтому для окна
без вкладок больше ничего не нужно.

`#details-tabs` подменяет отрисовку полосы, сохраняя поведение: слот получает табы, id активного и колбэк `select`.

<script setup>
import detailsSource from '../../.vitepress/demos/CustomDetailsMap.vue?raw'
</script>
