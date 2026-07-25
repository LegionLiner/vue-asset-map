export type EntityId = string

export interface XY {
  x: number
  y: number
}

export interface Badge {
  id: string
  /** CSS-цвет или имя токена темы */
  color?: string
  tooltip?: string
}

export interface NetworkEntity<M = unknown> {
  id: EntityId
  /** Тип узла: определяет иконку и компонент рендера. Открытый строковый союз. */
  kind: string
  label: string
  /** Дополнительные строки под именем: IP, домен, FQDN */
  sublabels?: string[]
  /** Индикатор состояния; маппится в цвет через themeConfig.statusColors */
  status?: string
  badges?: Badge[]
  /** Иерархия для группировки и свёртки */
  parentId?: EntityId | null
  /** Закреплённая позиция с бэкенда — имеет приоритет над раскладкой */
  position?: XY
  /** Произвольные данные потребителя. Внутри — markRaw, реактивность не нужна. */
  meta?: M
}
