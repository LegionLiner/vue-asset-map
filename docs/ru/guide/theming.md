# Темизация

Каждое значение — это CSS-переменная, объявленная на `.vam-root`, корневом элементе компонента, и никогда на `:root`.
Пакет не имеет права влиять на страницу за своими границами, и две карты с разными темами должны уживаться рядом.

<LiveDemo :source="darkSource" source-label="Показать исходник">
  <DarkThemeMap />
</LiveDemo>

## Светлая и тёмная

```vue
<AssetMap theme="dark" :entities="entities" :links="links" />
```

`'auto'` читает `prefers-color-scheme` **один раз** при инициализации и дальше за ним не следит. В продукте есть явный
переключатель, и он обязан побеждать систему: если бы `auto` подписывался, смена системной темы перебила бы выбор
пользователя. Карта с `theme: 'light'` к `matchMedia` не обращается вовсе.

Тёмная тема включается классом `.vam-theme-dark`, то есть это обычное переопределение каскада, которое можно расширить
или заменить.

## Переопределение токенов

```css
.vam-root {
  --vam-node-size: 44px;
  --vam-node-size-root: 72px;
  --vam-accent: #5a5ee7;
  --vam-selection: #4d6d9a;
  --vam-font: 'Inter', system-ui, sans-serif;
}
```

Ограничьте одной картой своим классом:

```vue
<AssetMap class="compact-map" :entities="entities" :links="links" />
```

```css
.compact-map.vam-root {
  --vam-node-size: 28px;
  --vam-node-label-width: 96px;
}
```

### Основные токены

| Группа      | Токены                                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Поверхности | `--vam-bg`, `--vam-surface`, `--vam-surface-raised`, `--vam-surface-sunken`                                                                                                |
| Текст       | `--vam-fg`, `--vam-fg-muted`, `--vam-fg-subtle`                                                                                                                            |
| Акцент      | `--vam-accent`, `--vam-accent-fg`, `--vam-accent-soft`, `--vam-selection`, `--vam-focus-ring`                                                                              |
| Рёбра       | `--vam-edge`, `--vam-edge-active`, `--vam-edge-width`                                                                                                                      |
| Узел        | `--vam-node-size`, `--vam-node-size-root`, `--vam-node-label-width`, `--vam-node-label-height`, `--vam-node-label-gap`, `--vam-node-toggle-size`, `--vam-node-status-size` |
| Текст узла  | `--vam-node-label-color`, `--vam-node-sublabel-color`, `--vam-node-overlay-color`                                                                                          |
| Маркеры     | `--vam-marker-1`, `--vam-marker-2`, `--vam-marker-3`, `--vam-marker-infected`, `--vam-marker-size`, `--vam-marker-gap`, `--vam-marker-offset`                              |
| Заражение   | `--vam-infected-bg`, `--vam-infected-border`, `--vam-infected-fg`                                                                                                          |
| Окна        | `--vam-window-width`, `--vam-window-radius`, `--vam-window-header-height`, `--vam-windows-top`, `--vam-details-top`                                                        |
| Фильтры     | `--vam-filter-width`, `--vam-filter-height`                                                                                                                                |
| Холст       | `--vam-canvas-dot`, `--vam-canvas-dot-size`, `--vam-canvas-grid`                                                                                                           |
| Анимация    | `--vam-transition`, `--vam-dimmed-opacity`                                                                                                                                 |

У плашки подписей ширина фиксирована намеренно: при смене представления подписи появляются и исчезают, и меняющийся
размер плашки дёргал бы всю раскладку.

## Цвета состояний

Значения `status` ваши, поэтому и сопоставление тоже:

```ts
const statusColors = {
  online: 'var(--vam-status-online)',
  offline: '#cb5555',
  degraded: '#e0a800',
}
```

```vue
<AssetMap :entities="entities" :links="links" :theme-config="{ statusColors }" />
```

## Иконки

`kindIcons` сопоставляет `type` компоненту. Используйте `currentColor` для всех обводок и заливок: иконка с зашитым
цветом проигнорирует и переключение темы, и ваши переопределения токенов. См. [Узлы](./nodes).

## Уменьшенная анимация

При `prefers-reduced-motion: reduce` переходы становятся мгновенными (`0s`). Настраивать нечего.

## Имена классов

Все классы с префиксом `vam-`, глобальных селекторов нет. Те, к которым чаще всего обращаются: `.vam-root`,
`.vam-canvas`, `.vam-toolbar`, `.vam-node`, `.vam-node__circle`, `.vam-node__info`, `.vam-edge`, `.vam-window`,
`.vam-details`, `.vam-filter`.

Классы состояний устроены так же: `.vam-node--selected`, `.vam-node--matched`, `.vam-node--dimmed`,
`.vam-node--highlighted`, `.vam-node--simplified`, `.vam-node--infected`.

<script setup>
import darkSource from '../../.vitepress/demos/DarkThemeMap.vue?raw'
</script>
