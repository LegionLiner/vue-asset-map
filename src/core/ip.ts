/**
 * IPv4 parsing and subnet matching — exactly as much as search needs.
 *
 * Two query forms are supported:
 *  - wildcard: `10.38.24.*`, `10.38.*.*`, `10.38.24.7*`
 *  - CIDR: `10.38.24.0/24`, where the base may be any address inside the network
 *    (`10.38.24.5/24` is equivalent to `10.38.24.0/24`).
 */

const IPV4_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g

/** Address → 32-bit unsigned number, or `null` when it is not valid IPv4. */
export function parseIPv4(value: string): number | null {
  const parts = value.trim().split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    if (part.length === 0 || part.length > 3 || !/^\d+$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    result = result * 256 + octet
  }
  return result
}

/** Every IPv4 substring found in the text, as numbers, in order of appearance. */
export function extractIPv4(value: string): number[] {
  const out: number[] = []
  for (const match of value.matchAll(IPV4_RE)) {
    const parsed = parseIPv4(match[0])
    if (parsed !== null) out.push(parsed)
  }
  return out
}

/** Inclusive address range of a subnet, as 32-bit unsigned numbers. */
export interface CidrRange {
  /** Network address — the first address of the range. */
  start: number
  /** Broadcast address — the last address of the range. */
  end: number
  /** Prefix length in bits, 0…32. */
  prefix: number
}

/** `10.38.24.0/24` → range, or `null` when the string is not CIDR. */
export function parseCidr(query: string): CidrRange | null {
  const slash = query.indexOf('/')
  if (slash === -1) return null
  const base = parseIPv4(query.slice(0, slash))
  const prefixText = query.slice(slash + 1).trim()
  if (base === null || !/^\d{1,2}$/.test(prefixText)) return null
  const prefix = Number(prefixText)
  if (prefix > 32) return null
  // `>>> 0` keeps the result unsigned: JS bitwise operators are 32-bit signed,
  // so a /1 mask would otherwise come out negative.
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const start = (base & mask) >>> 0
  const end = (start + (prefix === 32 ? 0 : ~mask >>> 0)) >>> 0
  return { start, end, prefix }
}

/** Whether a query looks like an address wildcard: contains `*` and a dot. */
export function isIPv4Wildcard(query: string): boolean {
  return query.includes('*') && query.includes('.')
}

/** Whether an address falls inside the range, both bounds inclusive. */
export function cidrContains(range: CidrRange, address: number): boolean {
  return address >= range.start && address <= range.end
}

/**
 * Wildcard → regexp over the textual form of an address. `*` is allowed inside an
 * octet (`10.38.24.7*` finds both `.7` and `.70`), which is why matching happens
 * on text rather than on numbers.
 *
 * Each `*` becomes U+0000 as a temporary marker: it cannot occur in user input,
 * so it can never be confused with an escaped character.
 */
export function wildcardToRegExp(query: string): RegExp {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, (char) => (char === '*' ? '\u0000' : `\\${char}`))
  return new RegExp(`^${escaped.split('\u0000').join('\\d*')}$`)
}

/** Whether any address in the text matches the wildcard. */
export function matchesWildcard(text: string, query: string): boolean {
  const pattern = wildcardToRegExp(query.trim())
  for (const match of text.matchAll(IPV4_RE)) {
    if (pattern.test(match[0])) return true
  }
  return false
}

/** Whether any address in the text falls inside the subnet. */
export function matchesCidr(text: string, range: CidrRange): boolean {
  return extractIPv4(text).some((address) => cidrContains(range, address))
}
