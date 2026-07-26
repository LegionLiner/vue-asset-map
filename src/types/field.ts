/** One option of a `select` field. */
export interface FieldOption {
  value: string
  /** Falls back to the raw `value`. */
  label?: string
}

/**
 * One editable field of an entity or a link.
 *
 * Editing is the one feature the package cannot do on its own vocabulary: it
 * knows an entity has a `label` and a `meta`, but not that `meta.speed` is a
 * link speed measured in megabits, nor which of a consumer's twenty fields are
 * worth putting in front of someone. So the shape of the form is data, declared
 * once and used for both the read view and the edit view — a field that cannot
 * be shown cannot be edited either, and the two can never drift apart.
 */
export interface FieldDef {
  /**
   * Where the value lives, as a dotted path: `'label'`, `'meta.speed'`.
   *
   * The path is read for display and written on save. Intermediate objects are
   * created as needed, so `meta.speed` works on an entity that has no `meta` yet.
   */
  key: string
  /** Row label. Falls back to the last segment of `key`. */
  label?: string
  /**
   * How the value is edited.
   *
   * @default 'text'
   */
  type?: 'text' | 'number' | 'select' | 'textarea'
  /** Choices for `type: 'select'`. */
  options?: readonly FieldOption[]
  placeholder?: string
  /** Shown in the read view but not editable — an id, a computed total. */
  readonly?: boolean
}
