import type { AssetEntity, AssetLink } from 'vue-asset-map'

/**
 * One object inside a layer.
 *
 * Objects are the consumer's own idea, not the package's: to the map a layer is
 * an ordinary entity and its objects are payload in `meta`. What makes them
 * more than decoration is that each gets a VueFlow handle of its own, so a line
 * can join two objects rather than the two layers containing them.
 */
export interface LayerObject {
  id: string
  label: string
}

export interface LayerMeta {
  objects: LayerObject[]
}

export type LayerEntity = AssetEntity<LayerMeta>
export type LayerLink = AssetLink<unknown>

/** Handle ids. A layer draws two per object, so a line has a top and a bottom. */
export const outHandle = (objectId: string): string => `out:${objectId}`
export const inHandle = (objectId: string): string => `in:${objectId}`

/** The object an `out:`/`in:` handle belongs to. */
export function objectOfHandle(handle: string | undefined): string | undefined {
  if (!handle) return undefined
  const [, id] = handle.split(':')
  return id
}
