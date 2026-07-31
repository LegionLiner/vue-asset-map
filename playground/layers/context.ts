import { inject, provide, type InjectionKey } from 'vue'

/**
 * То, что слою нужно от приложения.
 *
 * Узлы рисует VueFlow, а не шаблон карты, поэтому `emit` наверх из них не
 * доходит — как и у самого пакета, связь идёт через provide/inject. Свой
 * контекст рядом с `useMapContext()` уживается спокойно: ключи разные.
 */
export interface LayersContext {
  /** Открыть модалку создания объекта в этом слое. */
  addObject: (layerId: string) => void
}

const LAYERS_KEY: InjectionKey<LayersContext> = Symbol('pg-layers')

export function provideLayers(context: LayersContext): void {
  provide(LAYERS_KEY, context)
}

export function useLayers(): LayersContext {
  const context = inject(LAYERS_KEY, undefined)
  if (!context) throw new Error('LayerNode must be rendered inside LayersMap')
  return context
}
