import { describe, expect, it } from 'vitest'
import { ByteLruCache, LruCache } from '@/domain/cache/lru-cache'

describe('LruCache', () => {
  it('evicts the least recently used entry', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBe(1)
    cache.set('c', 3)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('c')).toBe(3)
  })

  it('evicts byte-sized entries until the budget is respected', () => {
    const cache = new ByteLruCache<string, Uint8Array>(5, (value) => value.byteLength)
    cache.set('a', new Uint8Array(3))
    cache.set('b', new Uint8Array(2))
    expect(cache.totalBytes).toBe(5)
    cache.get('a')
    cache.set('c', new Uint8Array(2))
    expect(cache.get('b')).toBeUndefined()
    expect(cache.totalBytes).toBe(5)
    cache.set('too-large', new Uint8Array(6))
    expect(cache.get('too-large')).toBeUndefined()
    expect(cache.totalBytes).toBe(5)
  })
})
