import { computed, type ComputedRef, type Ref } from 'vue'
import type { ResolvedTheme, ThemeMode } from '../types/theme'

/**
 * Сводит `theme` к `light` или `dark`.
 *
 * `auto` читает системную настройку **один раз** и дальше за ней не следит: в
 * продукте есть явный переключатель, и он обязан побеждать систему. Если бы
 * `auto` подписывался на `prefers-color-scheme`, смена системной темы перебила бы
 * выбор пользователя.
 *
 * Чтение ленивое и запоминается: у карты с `theme: 'light'` обращения к
 * `matchMedia` не будет вовсе, а возврат к `auto` отдаст то же значение, что было
 * прочитано при инициализации — никаких скрытых перечитываний.
 *
 * Обращение к `window` спрятано внутрь функции и защищено проверкой: на верхнем
 * уровне модуля его быть не может, пакет должен импортироваться в SSR.
 */
export function resolveTheme(
  mode: Ref<ThemeMode | undefined> | ComputedRef<ThemeMode | undefined>,
): ComputedRef<ResolvedTheme> {
  let cached: ResolvedTheme | undefined

  const systemTheme = (): ResolvedTheme => {
    if (cached !== undefined) return cached

    cached =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : // SSR или окружение без matchMedia: светлая тема как нейтральный дефолт.
          'light'

    return cached
  }

  return computed<ResolvedTheme>(() => {
    const value = mode.value ?? 'light'
    return value === 'auto' ? systemTheme() : value
  })
}
