import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { ResolvedTheme, ThemeMode } from '../types/theme'

/**
 * Сводит `theme` к `light` или `dark`.
 *
 * `auto` читает системную настройку **один раз** при инициализации и больше за
 * ней не следит: в продукте есть явный переключатель, и он обязан побеждать
 * систему. Если бы `auto` подписывался на `prefers-color-scheme`, смена системной
 * темы перебила бы выбор пользователя.
 *
 * Обращение к `window` спрятано внутрь функции и защищено проверкой: на верхнем
 * уровне модуля его быть не может — пакет должен импортироваться в SSR.
 */
export function resolveTheme(
  mode: Ref<ThemeMode | undefined> | ComputedRef<ThemeMode | undefined>,
): ComputedRef<ResolvedTheme> {
  const systemTheme = ref<ResolvedTheme>('light')
  let systemRead = false

  const readSystemTheme = (): ResolvedTheme => {
    if (systemRead) return systemTheme.value
    systemRead = true

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      systemTheme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return systemTheme.value
  }

  // Явно заданная тема сбрасывает «прочитано»: если потребитель вернётся к
  // `auto`, систему надо перечитать заново, а не отдать значение годичной давности.
  watch(mode, (next) => {
    if (next !== 'auto') systemRead = false
  })

  return computed<ResolvedTheme>(() => {
    const value = mode.value ?? 'light'
    if (value === 'auto') return readSystemTheme()
    return value
  })
}
