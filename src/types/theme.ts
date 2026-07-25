import type { Component } from 'vue'

/** Theme choice; `'auto'` follows the OS `prefers-color-scheme`. */
export type ThemeMode = 'light' | 'dark' | 'auto'

/** A theme with `'auto'` already resolved against the OS setting. */
export type ResolvedTheme = 'light' | 'dark'

/**
 * Maps the consumer's own vocabulary onto visuals. Everything here is data: the
 * package ships no status names and no kind list of its own.
 */
export interface ThemeConfig {
  /** Entity `status` → CSS color or a `var(--vnm-*)` reference. */
  statusColors?: Record<string, string>
  /** Entity `kind` → icon component. */
  kindIcons?: Record<string, Component>
}
