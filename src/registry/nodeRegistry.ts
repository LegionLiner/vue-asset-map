import { markRaw, type Component } from 'vue'
import BaseNode from '../components/nodes/BaseNode.vue'
import GroupNode from '../components/nodes/GroupNode.vue'
import NetworkEdge from '../components/edges/NetworkEdge.vue'

/**
 * Внутренние типы, которыми компонент помечает узлы для VueFlow.
 *
 * `kind` сущности не подставляется в `node.type` напрямую: VueFlow ругается в
 * консоль на неизвестный тип, а `kind` — открытый строковый союз из данных
 * потребителя. Поэтому свой `kind` попадает в `type` только если под него
 * действительно зарегистрирован компонент.
 */
export const NODE_TYPE_BASE = 'vnm-node'
export const NODE_TYPE_GROUP = 'vnm-group'
export const EDGE_TYPE_BASE = 'vnm-edge'

/**
 * Реестр компонентов узлов: пользовательский мержится с дефолтным.
 *
 * `markRaw` обязателен: VueFlow держит реестр в реактивном объекте, а
 * реактивный прокси над определением компонента — предупреждение в консоли и
 * лишняя работа на каждый рендер.
 */
export function buildNodeTypes(custom?: Record<string, Component>): Record<string, Component> {
  const types: Record<string, Component> = {
    [NODE_TYPE_BASE]: markRaw(BaseNode),
    [NODE_TYPE_GROUP]: markRaw(GroupNode),
  }

  for (const [name, component] of Object.entries(custom ?? {})) {
    types[name] = markRaw(component)
  }

  return types
}

export function buildEdgeTypes(custom?: Record<string, Component>): Record<string, Component> {
  const types: Record<string, Component> = {
    [EDGE_TYPE_BASE]: markRaw(NetworkEdge),
  }

  for (const [name, component] of Object.entries(custom ?? {})) {
    types[name] = markRaw(component)
  }

  return types
}

/** Тип узла для VueFlow: свой компонент под `kind`, иначе базовый. */
export function nodeTypeFor(kind: string, types: Readonly<Record<string, Component>>): string {
  return Object.prototype.hasOwnProperty.call(types, kind) ? kind : NODE_TYPE_BASE
}

/** Тип ребра: свой компонент под `kind` ребра, иначе базовый. */
export function edgeTypeFor(kind: string | undefined, types: Readonly<Record<string, Component>>): string {
  if (kind !== undefined && Object.prototype.hasOwnProperty.call(types, kind)) return kind
  return EDGE_TYPE_BASE
}
