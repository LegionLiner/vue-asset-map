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

`#details-header` так же подменяет содержимое шапки.

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

| Prop | По умолчанию | Зачем |
| --- | --- | --- |
| `title` | — | Подпись по центру шапки. |
| `closable` | `true` | `false` для окон, которые закрывать нельзя. |
| `collapsible` | `true` | Кнопка сжатия до шапки. |
| `headerOnly` | `false` | Только шапка, без тела. |
| `dragHandle` | `false` | Ручка перетаскивания — нужна окнам без заголовка. |
| `offset` | — | Начальный сдвиг в пикселях, чтобы окна не ложились ровно друг на друга. |

Окна из слота `#windows` рисуются поверх окон подробностей, а окна подробностей замеряют их и начинаются ниже — новое
окно не закроет вашу «историю». И те и другие опускаются под тулбар, если в `#toolbar-right` что-то есть, чтобы кнопки
приложения оставались нажимаемыми.

Интерактивные элементы внутри шапки не являются ручкой перетаскивания: кнопки, ссылки и поля получают свои клики. Без
этого исключения кнопки закрытия и сжатия не работали бы вовсе, потому что `preventDefault()` на `pointerdown` запрещает
браузеру синтезировать `click`.

## Табы

В дефолтной панели два таба: обзор и связи. Id активного таба доходит до слота как `tab`, поэтому своя панель может
рисовать разное содержимое. Он никогда не сбрасывается при смене сущности: карта рендерит окна с `key` по id сущности,
поэтому другая сущность — это другой экземпляр компонента с состоянием по умолчанию.

<script setup>
import detailsSource from '../../.vitepress/demos/CustomDetailsMap.vue?raw'
</script>
