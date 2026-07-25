# network-map

Интерактивная карта сетевой инфраструктуры для Vue 3 на базе [VueFlow](https://vueflow.dev).

> Статус: в разработке. Полная документация появится на этапе 7.

## Установка

```bash
pnpm add network-map @vue-flow/core vue
```

## Скрипты

| Скрипт               | Что делает                                 |
| -------------------- | ------------------------------------------ |
| `pnpm build`         | Сборка библиотеки в `dist` (ESM + `.d.ts`) |
| `pnpm typecheck`     | `vue-tsc` в strict-режиме                  |
| `pnpm test`          | Vitest                                     |
| `pnpm test:coverage` | Vitest с порогом покрытия по `src/core`    |
| `pnpm lint`          | ESLint                                     |
| `pnpm dev`           | Playground с демо                          |
| `pnpm verify`        | lint + typecheck + test + build            |

## Лицензия

MIT
