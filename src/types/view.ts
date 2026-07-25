import type { NetworkEntity } from './entity'
import type { NetworkLink } from './link'

export interface NetworkView {
  id: string
  label: string
  /** Дефолт: link.layers.includes(view.id) */
  linkFilter?: (link: NetworkLink) => boolean
  entityFilter?: (entity: NetworkEntity) => boolean
  /** Показывать ли sublabels в этом виде */
  showSublabels?: boolean
  layout?: { engine: string; options?: unknown }
  /** Скрывать узлы, у которых в этом виде не осталось связей */
  hideIsolated?: boolean
}

/** Результат применения вида: что из графа попадает на карту. */
export interface ProjectionResult {
  entityIds: ReadonlySet<string>
  linkIds: ReadonlySet<string>
}
