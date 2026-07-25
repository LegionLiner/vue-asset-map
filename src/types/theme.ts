import type { Component } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'

/** Разрешённая тема: `auto` уже сведён к светлой или тёмной. */
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeConfig {
  /** status сущности → CSS-цвет или `var(--vnm-*)` */
  statusColors?: Record<string, string>
  /** kind сущности → компонент иконки */
  kindIcons?: Record<string, Component>
}
