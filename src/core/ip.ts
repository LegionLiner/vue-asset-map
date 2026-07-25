/**
 * Разбор IPv4 и сопоставление по подсети — ровно столько, сколько нужно поиску.
 *
 * Поддерживаются две формы запроса:
 *  - маска с `*`: `10.38.24.*`, `10.38.*.*`, `10.38.24.7*`
 *  - CIDR: `10.38.24.0/24`, причём база может быть любым адресом внутри сети
 *    (`10.38.24.5/24` эквивалентно `10.38.24.0/24`).
 */

const IPV4_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g

/** Адрес → 32-битное число. `null`, если это не корректный IPv4. */
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

/** Все IPv4-подстроки из текста, в порядке появления. */
export function extractIPv4(value: string): number[] {
  const out: number[] = []
  for (const match of value.matchAll(IPV4_RE)) {
    const parsed = parseIPv4(match[0])
    if (parsed !== null) out.push(parsed)
  }
  return out
}

export interface CidrRange {
  /** Первый адрес сети */
  start: number
  /** Последний адрес сети */
  end: number
  prefix: number
}

/** `10.38.24.0/24` → диапазон. `null`, если строка не CIDR. */
export function parseCidr(query: string): CidrRange | null {
  const slash = query.indexOf('/')
  if (slash === -1) return null
  const base = parseIPv4(query.slice(0, slash))
  const prefixText = query.slice(slash + 1).trim()
  if (base === null || !/^\d{1,2}$/.test(prefixText)) return null
  const prefix = Number(prefixText)
  if (prefix > 32) return null
  // >>> 0 держит результат беззнаковым: побитовые операции в JS 32-битные и знаковые.
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const start = (base & mask) >>> 0
  const end = (start + (prefix === 32 ? 0 : ~mask >>> 0)) >>> 0
  return { start, end, prefix }
}

/** Похоже ли на маску адреса: есть `*` и хотя бы одна точка. */
export function isIPv4Wildcard(query: string): boolean {
  return query.includes('*') && query.includes('.')
}

export function cidrContains(range: CidrRange, address: number): boolean {
  return address >= range.start && address <= range.end
}

/**
 * Маска → регулярка по строковому виду адреса. `*` внутри октета разрешён
 * (`10.38.24.7*` найдёт и `.7`, и `.70`), поэтому сравниваем текст, а не числа.
 *
 * На месте `*` ставится U+0000 как временный маркер: он не может встретиться во
 * вводе пользователя, поэтому его нельзя спутать с экранированным символом.
 */
export function wildcardToRegExp(query: string): RegExp {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, (char) => (char === '*' ? '\u0000' : `\\${char}`))
  return new RegExp(`^${escaped.split('\u0000').join('\\d*')}$`)
}

/** Совпадает ли хоть один адрес из текста с маской. */
export function matchesWildcard(text: string, query: string): boolean {
  const pattern = wildcardToRegExp(query.trim())
  for (const match of text.matchAll(IPV4_RE)) {
    if (pattern.test(match[0])) return true
  }
  return false
}

/** Совпадает ли хоть один адрес из текста с CIDR-подсетью. */
export function matchesCidr(text: string, range: CidrRange): boolean {
  return extractIPv4(text).some((address) => cidrContains(range, address))
}
