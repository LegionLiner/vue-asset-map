import { describe, expect, it } from 'vitest'
import {
  cidrContains,
  extractIPv4,
  isIPv4Wildcard,
  matchesCidr,
  matchesWildcard,
  parseCidr,
  parseIPv4,
} from '../../src/core/index'

describe('parseIPv4', () => {
  it('разбирает корректные адреса', () => {
    expect(parseIPv4('0.0.0.0')).toBe(0)
    expect(parseIPv4('255.255.255.255')).toBe(4294967295)
    expect(parseIPv4('10.38.24.70')).toBe(10 * 2 ** 24 + 38 * 2 ** 16 + 24 * 256 + 70)
    expect(parseIPv4('  100.64.0.2  ')).toBe(100 * 2 ** 24 + 64 * 2 ** 16 + 2)
  })

  it('отвергает мусор', () => {
    expect(parseIPv4('10.38.24')).toBeNull()
    expect(parseIPv4('10.38.24.70.1')).toBeNull()
    expect(parseIPv4('10.38.24.256')).toBeNull()
    expect(parseIPv4('10.38.24.x')).toBeNull()
    expect(parseIPv4('10.38..70')).toBeNull()
    expect(parseIPv4('10.38.24.0700')).toBeNull()
    expect(parseIPv4('')).toBeNull()
  })
})

describe('extractIPv4', () => {
  it('вытаскивает адреса из текста в порядке появления', () => {
    expect(extractIPv4('внешний 46.8.158.127, оверлей 100.64.0.2')).toEqual([
      parseIPv4('46.8.158.127'),
      parseIPv4('100.64.0.2'),
    ])
  })

  it('не находит адресов там, где их нет', () => {
    expect(extractIPv4('pteam.keenetic.pro')).toEqual([])
    expect(extractIPv4('999.1.1.1')).toEqual([])
  })
})

describe('parseCidr', () => {
  it('разбирает подсеть', () => {
    const range = parseCidr('10.38.24.0/24')
    expect(range).not.toBeNull()
    expect(range?.prefix).toBe(24)
    expect(range?.start).toBe(parseIPv4('10.38.24.0'))
    expect(range?.end).toBe(parseIPv4('10.38.24.255'))
  })

  it('нормализует базу: любой адрес внутри сети задаёт ту же сеть', () => {
    expect(parseCidr('10.38.24.5/24')).toEqual(parseCidr('10.38.24.0/24'))
  })

  it('поддерживает крайние префиксы', () => {
    expect(parseCidr('0.0.0.0/0')).toEqual({ start: 0, end: 4294967295, prefix: 0 })
    const host = parseCidr('10.0.0.1/32')
    expect(host?.start).toBe(host?.end)
    expect(host?.start).toBe(parseIPv4('10.0.0.1'))
  })

  it('отвергает не-CIDR', () => {
    expect(parseCidr('10.38.24.0')).toBeNull()
    expect(parseCidr('10.38.24.0/33')).toBeNull()
    expect(parseCidr('10.38.24.0/abc')).toBeNull()
    expect(parseCidr('not-an-ip/24')).toBeNull()
  })
})

describe('сопоставление по подсети', () => {
  it('cidrContains проверяет границы включительно', () => {
    const range = parseCidr('10.38.24.0/24')
    expect(range).not.toBeNull()
    if (!range) return
    expect(cidrContains(range, parseIPv4('10.38.24.0') as number)).toBe(true)
    expect(cidrContains(range, parseIPv4('10.38.24.255') as number)).toBe(true)
    expect(cidrContains(range, parseIPv4('10.38.25.0') as number)).toBe(false)
    expect(cidrContains(range, parseIPv4('10.38.23.255') as number)).toBe(false)
  })

  it('matchesCidr работает по адресам внутри произвольного текста', () => {
    const range = parseCidr('100.64.0.0/24')
    expect(range).not.toBeNull()
    if (!range) return
    expect(matchesCidr('внешний 46.8.158.127 / оверлей 100.64.0.70', range)).toBe(true)
    expect(matchesCidr('46.8.158.127', range)).toBe(false)
  })
})

describe('маски адресов', () => {
  it('распознаёт форму маски', () => {
    expect(isIPv4Wildcard('10.38.24.*')).toBe(true)
    expect(isIPv4Wildcard('web-*')).toBe(false)
    expect(isIPv4Wildcard('10.38.24.70')).toBe(false)
  })

  it('маска по последнему октету', () => {
    expect(matchesWildcard('10.38.24.70', '10.38.24.*')).toBe(true)
    expect(matchesWildcard('10.38.25.70', '10.38.24.*')).toBe(false)
  })

  it('маска в середине адреса', () => {
    expect(matchesWildcard('10.38.24.70', '10.*.*.70')).toBe(true)
    expect(matchesWildcard('10.38.24.71', '10.*.*.70')).toBe(false)
  })

  it('частичный октет: 10.38.24.7* находит и .7, и .70', () => {
    expect(matchesWildcard('10.38.24.7', '10.38.24.7*')).toBe(true)
    expect(matchesWildcard('10.38.24.70', '10.38.24.7*')).toBe(true)
    expect(matchesWildcard('10.38.24.80', '10.38.24.7*')).toBe(false)
  })

  it('ищет адрес внутри текста', () => {
    expect(matchesWildcard('оверлей 100.64.0.72 (Dmitry)', '100.64.0.*')).toBe(true)
  })
})
