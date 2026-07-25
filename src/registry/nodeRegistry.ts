import { markRaw, type Component } from 'vue'
import BaseNode from '../components/nodes/BaseNode.vue'
import GroupNode from '../components/nodes/GroupNode.vue'
import AssetEdge from '../components/edges/AssetEdge.vue'

/**
 * Internal `node.type` values the map hands to VueFlow.
 *
 * An entity's `kind` is not used as `node.type` directly: VueFlow logs a warning
 * for an unknown type, and `kind` is an open string union coming from consumer
 * data. A `kind` reaches `type` only when a component is actually registered
 * under it.
 */
export const NODE_TYPE_BASE = 'vam-node'
export const NODE_TYPE_GROUP = 'vam-group'
export const EDGE_TYPE_BASE = 'vam-edge'

/**
 * Node component registry: the consumer's entries merged over the built-ins.
 *
 * `markRaw` is mandatory: VueFlow keeps the registry in a reactive object, and a
 * reactive proxy around a component definition means a console warning plus
 * wasted work on every render.
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

/** Edge component registry, following the same rules as {@link buildNodeTypes}. */
export function buildEdgeTypes(custom?: Record<string, Component>): Record<string, Component> {
  const types: Record<string, Component> = {
    [EDGE_TYPE_BASE]: markRaw(AssetEdge),
  }

  for (const [name, component] of Object.entries(custom ?? {})) {
    types[name] = markRaw(component)
  }

  return types
}

/** `node.type` for an entity: its own `kind` when registered, else the base node. */
export function nodeTypeFor(kind: string, types: Readonly<Record<string, Component>>): string {
  return Object.prototype.hasOwnProperty.call(types, kind) ? kind : NODE_TYPE_BASE
}

/** `edge.type` for a link: its own `kind` when registered, else the base edge. */
export function edgeTypeFor(kind: string | undefined, types: Readonly<Record<string, Component>>): string {
  if (kind !== undefined && Object.prototype.hasOwnProperty.call(types, kind)) return kind
  return EDGE_TYPE_BASE
}
