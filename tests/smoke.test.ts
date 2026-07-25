import { describe, expect, it } from 'vitest'
import { version } from '../src/index'

describe('package entry', () => {
  it('exposes a version', () => {
    expect(version).toBe('0.1.0')
  })
})
