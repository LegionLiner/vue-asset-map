/**
 * One declared kind of connection.
 *
 * The package ships no vocabulary of its own — "Wi-Fi" and "fibre" mean nothing
 * to it. A consumer declares the kinds their data uses once, and that single
 * declaration drives three things at once: the color an edge is drawn in, the
 * legend in the corner, and the options offered when a link's type is edited.
 * Keeping them together is the point: a colour in the legend that no edge uses,
 * or an editable type the legend has never heard of, are the failures worth
 * designing out.
 */
export interface LinkTypeDef {
  /** Matched against `link.type`. */
  id: string
  /** Human name, for the legend and the type select. Falls back to `id`. */
  label?: string
  /**
   * CSS color or a `var(--vam-*)` reference.
   *
   * Omitted, the edge keeps the theme's default stroke — a declared type is
   * still useful without one, for the legend and for editing.
   */
  color?: string
  /**
   * SVG `stroke-dasharray`, e.g. `'6 4'`. Omitted draws a solid line.
   *
   * Colour alone does not survive a monochrome print or a red-green
   * deficiency, so a dash pattern is the second channel.
   */
  dash?: string
  /** Line thickness in px. Omitted keeps the theme's own. */
  width?: number
}
