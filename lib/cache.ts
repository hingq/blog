/**
 * 简单的服务端内存 TTL 缓存。
 * 在 Next.js 独立进程（standalone 模式）及 dev 开发模式下，
 * 模块级变量在同一 Node.js 进程中跨请求共享。
 */
interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export function createTtlCache<T>(ttlMs: number) {
  let entry: CacheEntry<T> | null = null

  return {
    get(): T | null {
      if (entry && Date.now() < entry.expiresAt) {
        return entry.data
      }
      entry = null
      return null
    },
    set(data: T): void {
      entry = { data, expiresAt: Date.now() + ttlMs }
    },
    clear(): void {
      entry = null
    },
  }
}
