import { h, type FunctionalComponent } from 'vue'

/**
 * Иконки типов активов — часть демо, а не библиотеки.
 *
 * Именно так потребитель и подключает свои иконки: `themeConfig.kindIcons`
 * сопоставляет `kind` компоненту. Библиотека не знает ни одного типа заранее.
 *
 * Обводка — `currentColor`, чтобы иконка внутри узла красилась темой карты.
 */
const icon =
  (paths: string[], viewBox = '0 0 32 32', width = 2): FunctionalComponent =>
  () =>
    h(
      'svg',
      { xmlns: 'http://www.w3.org/2000/svg', viewBox, fill: 'none', 'aria-hidden': 'true' },
      paths.map((d) =>
        h('path', {
          d,
          stroke: 'currentColor',
          'stroke-width': width,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      ),
    )

/** Облако — «Интернет» и внешние сервисы. */
export const CloudIcon: FunctionalComponent = () =>
  h(
    'svg',
    { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 32 25', fill: 'none', 'aria-hidden': 'true' },
    [
      h('path', {
        d: 'M1.125 16.921C1.125 18.7112 1.83616 20.4281 3.10203 21.694C4.3679 22.9599 6.08479 23.671 7.875 23.671H24.75C26.0667 23.6725 27.3422 23.2119 28.3543 22.3696C29.3664 21.5273 30.0509 20.3566 30.2887 19.0615C30.5264 17.7664 30.3022 16.429 29.6552 15.2821C29.0082 14.1353 27.9794 13.2518 26.748 12.7855C27.0263 11.9939 27.0778 11.1402 26.8965 10.3208C26.7152 9.50148 26.3085 8.74914 25.7222 8.14879C25.1359 7.54843 24.3934 7.12398 23.5785 6.92337C22.7637 6.72276 21.909 6.75399 21.111 7.01353C20.5949 5.03356 19.3283 3.33222 17.5796 2.2698C15.8309 1.20737 13.7374 0.867286 11.7423 1.32155C9.74725 1.77582 8.00731 2.98877 6.89098 4.70355C5.77464 6.41833 5.36955 8.50028 5.7615 10.5085C4.41237 10.9538 3.23804 11.8132 2.40561 12.9645C1.57318 14.1158 1.12505 15.5003 1.125 16.921Z',
        stroke: 'currentColor',
        'stroke-width': 2.25,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    ],
  )

/** Роутер. */
export const RouterIcon = icon([
  'M4 18h24v8H4z',
  'M16 18V9',
  'M16 9l-6-4',
  'M16 9l6-4',
  'M9 22h2',
  'M15 22h2',
])

/** Сервер и гипервизор. */
export const ServerIcon = icon(['M5 5h22v9H5z', 'M5 18h22v9H5z', 'M10 9.5h1', 'M10 22.5h1'])

/** Виртуальная машина, VPS. */
export const VpsIcon = icon(['M4 6h24v15H4z', 'M12 25h8', 'M16 21v4'])

/** Рабочая станция. */
export const WorkstationIcon = icon(['M6 6h20v14H6z', 'M11 26h10', 'M16 20v6'])

/** Контейнер. */
export const ContainerIcon = icon([
  'M6 12l10-5 10 5v8l-10 5-10-5z',
  'M16 17l10-5',
  'M16 17v10',
  'M16 17L6 12',
])
