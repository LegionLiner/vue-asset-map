import type { FieldDef } from '../types/field'

/**
 * Reads a dotted path out of an object.
 *
 * Returns `undefined` rather than throwing on a missing branch: a field schema
 * is written against the shape data is *supposed* to have, and a record missing
 * `meta` entirely is ordinary, not exceptional.
 */
export function readField(source: unknown, path: string): unknown {
  let current: unknown = source

  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

/**
 * Returns a copy of `source` with `path` set to `value`.
 *
 * Copies rather than mutates, every level down the path: entities and links
 * belong to the consumer and the package never writes to them — an edit leaves
 * as a new object for the application to accept or discard. Missing branches are
 * created, so `meta.speed` can be set on a record that has no `meta`.
 */
export function writeField<T extends object>(source: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  if (head === undefined) return source

  // Cast: spreading an unconstrained object yields the same opaque type, while
  // writing one key by name needs an index signature. The shape is preserved —
  // only the declared path is replaced — so the return cast is honest.
  const next = { ...source } as Record<string, unknown>

  if (rest.length === 0) {
    next[head] = value
    return next as T
  }

  const branch = next[head]
  // A non-object in the middle of the path is replaced rather than merged: there
  // is nothing to merge into, and refusing to write would lose the edit silently.
  const base = branch !== null && typeof branch === 'object' ? (branch as object) : {}
  next[head] = writeField(base, rest.join('.'), value)

  return next as T
}

/**
 * Applies a whole set of edited values, returning one new object.
 *
 * A value equal to what is already there is skipped, so an untouched form
 * produces no change at all and the caller can tell a real edit from a
 * round trip through the inputs.
 */
export function applyFields<T extends object>(source: T, values: Readonly<Record<string, unknown>>): T {
  let result = source

  for (const [path, value] of Object.entries(values)) {
    if (readField(result, path) === value) continue
    result = writeField(result, path, value)
  }

  return result
}

/** Row label for a field: its own, or the last segment of its path. */
export function fieldLabel(field: FieldDef): string {
  return field.label ?? field.key.split('.').at(-1) ?? field.key
}

/**
 * Turns a stored value into what an `<input>` shows.
 *
 * Arrays are joined, since a multi-value field (tags, layers) is edited as a
 * comma-separated line; `null` and `undefined` both become an empty field.
 */
export function fieldToInput(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

/**
 * Turns what an `<input>` holds back into a stored value.
 *
 * An empty string means "no value" rather than an empty string: for a numeric or
 * optional field, storing `''` would be a different kind of wrong from storing
 * nothing at all.
 */
export function fieldFromInput(raw: string, field: FieldDef): unknown {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined

  if (field.type === 'number') {
    const parsed = Number(trimmed)
    // A number field holding something unparseable keeps the text: silently
    // turning it into NaN would destroy what was typed.
    return Number.isFinite(parsed) ? parsed : trimmed
  }

  return trimmed
}
