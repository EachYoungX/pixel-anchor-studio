export class LruCache<K, V> {
  private readonly map = new Map<K, V>()

  constructor(
    private readonly maxEntries: number,
    private readonly onEvict?: (value: V) => void,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) throw new Error('LRU缓存容量必须为正整数')
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      const evicted = this.map.get(oldest)
      this.map.delete(oldest)
      if (evicted !== undefined) this.onEvict?.(evicted)
    }
  }

  has(key: K): boolean { return this.map.has(key) }
  get size(): number { return this.map.size }

  clear(): void {
    if (this.onEvict) for (const value of this.map.values()) this.onEvict(value)
    this.map.clear()
  }
}

export class ByteLruCache<K, V> {
  private readonly map = new Map<K, V>()
  private bytes = 0

  constructor(
    private readonly maxBytes: number,
    private readonly getBytes: (value: V) => number,
    private readonly onEvict?: (value: V) => void,
  ) {
    if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new Error('字节缓存容量必须为正整数')
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    const valueBytes = this.getBytes(value)
    if (!Number.isFinite(valueBytes) || valueBytes < 0) throw new Error('字节缓存大小必须为非负数')
    const previous = this.map.get(key)
    if (previous !== undefined) {
      this.bytes -= this.getBytes(previous)
      this.map.delete(key)
      this.onEvict?.(previous)
    }
    if (valueBytes > this.maxBytes) {
      this.onEvict?.(value)
      return
    }
    this.map.set(key, value)
    this.bytes += valueBytes
    while (this.bytes > this.maxBytes) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      const evicted = this.map.get(oldest)
      this.map.delete(oldest)
      if (evicted !== undefined) {
        this.bytes -= this.getBytes(evicted)
        this.onEvict?.(evicted)
      }
    }
  }

  has(key: K): boolean { return this.map.has(key) }
  get size(): number { return this.map.size }
  get totalBytes(): number { return this.bytes }

  clear(): void {
    if (this.onEvict) for (const value of this.map.values()) this.onEvict(value)
    this.map.clear()
    this.bytes = 0
  }
}
