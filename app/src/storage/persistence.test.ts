import { describe, expect, it } from 'vitest'
import {
  STATE_KEY,
  clearAll,
  defaultPrefs,
  loadPrefs,
  loadState,
  savePrefs,
  saveState,
  type StorageLike,
} from './persistence'
import { emptyCullingState } from '../domain/types'

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
    removeItem: (k) => {
      delete data[k]
    },
  }
}

describe('记录存储层', () => {
  it('状态写入后可完整读回（刷新后锁定状态一致）', () => {
    const storage = memoryStorage()
    const state = {
      ...emptyCullingState(),
      marks: { p1: { mark: 'selected' as const, at: 1000 } },
      locks: [
        {
          id: 'gaze-v1',
          seriesId: 'gaze',
          version: 1,
          lockedAt: 2000,
          status: 'invalidated' as const,
          invalidatedAt: 3000,
          snapshot: { p1: 'selected' as const },
        },
      ],
    }
    saveState(storage, state)
    expect(loadState(storage)).toEqual(state)
  })

  it('偏好写入后可完整读回（刷新后筛选与片序一致）', () => {
    const storage = memoryStorage()
    const prefs = { ...defaultPrefs(), filterSeries: 'wilderness', filterMark: 'selected', sortMode: 'status' as const }
    savePrefs(storage, prefs)
    expect(loadPrefs(storage)).toEqual(prefs)
  })

  it('损坏的 JSON 回退到空状态而不是抛错', () => {
    const storage = memoryStorage({ [STATE_KEY]: '{oops' })
    expect(loadState(storage)).toEqual(emptyCullingState())
  })

  it('schema 版本不符时回退到空状态', () => {
    const storage = memoryStorage({ [STATE_KEY]: JSON.stringify({ schemaVersion: 99 }) })
    expect(loadState(storage)).toEqual(emptyCullingState())
  })

  it('clearAll 清空状态与偏好', () => {
    const storage = memoryStorage()
    saveState(storage, emptyCullingState())
    savePrefs(storage, defaultPrefs())
    clearAll(storage)
    expect(storage.data).toEqual({})
  })
})
