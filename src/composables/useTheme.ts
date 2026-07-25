import { computed, type ComputedRef, type Ref } from 'vue'
import type { ResolvedTheme, ThemeMode } from '../types/theme'

/**
 * Reduces `theme` to `light` or `dark`.
 *
 * `auto` reads the system setting **once** and then stops watching it: the
 * product has an explicit switch, and that switch has to beat the system. Were
 * `auto` subscribed to `prefers-color-scheme`, changing the OS theme would
 * override the user's own choice.
 *
 * The read is lazy and memoised: a map with `theme: 'light'` never calls
 * `matchMedia` at all, and switching back to `auto` returns the same value read
 * at initialisation rather than re-reading behind the caller's back.
 *
 * The `window` access sits inside the function and behind a guard — it cannot be
 * at module top level, since the package has to import under SSR.
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
        : // SSR, or an environment without matchMedia: light is the neutral default.
          'light'

    return cached
  }

  return computed<ResolvedTheme>(() => {
    const value = mode.value ?? 'light'
    return value === 'auto' ? systemTheme() : value
  })
}
