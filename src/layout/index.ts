import type { LayoutEngine } from './types'
import { manualLayout } from './manual'
import { radialLayout } from './radial'

export type { LayoutEngine, LayoutGraph, LayoutNode } from './types'
export { isLayoutAborted, LayoutAbortedError } from './types'
export { manualLayout } from './manual'
export type { ManualLayoutOptions } from './manual'
export { radialLayout } from './radial'
export type { RadialLayoutOptions } from './radial'
export { applyPinned, throwIfAborted } from './shared'

/**
 * Движки, доступные по имени из коробки.
 *
 * `dagre` здесь отсутствует намеренно: он тянет опциональную зависимость и
 * подключается отдельным подпутём `network-map/layout-dagre`, после чего
 * передаётся объектом — `:layout="{ engine: dagreLayout }"`.
 */
export const builtinLayoutEngines: Readonly<Record<string, LayoutEngine>> = Object.freeze({
  [manualLayout.name]: manualLayout,
  [radialLayout.name]: radialLayout,
})

/**
 * Движок по имени или объекту. Неизвестное имя — не ошибка вызова, а `undefined`:
 * решение, что делать дальше, принимает вызывающий слой (он умеет откатиться на
 * `manual` и сообщить об этом через событие `error`).
 */
export function resolveLayoutEngine(
  engine: string | LayoutEngine | undefined,
  extra?: Readonly<Record<string, LayoutEngine>>,
): LayoutEngine | undefined {
  if (engine === undefined) return undefined
  if (typeof engine !== 'string') return engine
  return extra?.[engine] ?? builtinLayoutEngines[engine]
}
