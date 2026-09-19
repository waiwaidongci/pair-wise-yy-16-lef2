import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyMark } from '../domain/marks'
import { lockSeries, type LockResult } from '../domain/locking'
import { emptyCullingState, type CullingState, type Mark } from '../domain/types'
import { photoById, seriesById } from '../data/photos'
import {
  clearAll,
  defaultPrefs,
  loadPrefs,
  loadState,
  savePrefs,
  saveState,
  type UiPrefs,
} from '../storage/persistence'

/**
 * 界面绑定层 —— 把状态规则（domain/）与记录存储（storage/）接到 React 上。
 * 业务判断全部在 domain 层完成，这里只负责调用、持有结果并触发持久化。
 */

interface StoreValue {
  state: CullingState
  prefs: UiPrefs
  submitMark: (photoId: string, mark: Mark) => void
  lock: (seriesId: string) => LockResult
  updatePrefs: (patch: Partial<UiPrefs>) => void
  resetAll: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function CullingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CullingState>(() => loadState(window.localStorage))
  const [prefs, setPrefs] = useState<UiPrefs>(() => loadPrefs(window.localStorage))

  // 状态或偏好一旦变化（引用变化）即写入本地；重复提交沿用首次结果时
  // domain 层返回原引用，这里自然不会触发多余的写入。
  useEffect(() => {
    saveState(window.localStorage, state)
  }, [state])
  useEffect(() => {
    savePrefs(window.localStorage, prefs)
  }, [prefs])

  const value = useMemo<StoreValue>(
    () => ({
      state,
      prefs,
      submitMark(photoId, mark) {
        const photo = photoById.get(photoId)
        if (!photo) return
        setState((prev) => applyMark(prev, photo, mark, Date.now()))
      },
      lock(seriesId) {
        const series = seriesById.get(seriesId)
        if (!series) {
          return { ok: false, state, eligibility: { ok: false, unmarked: [], review: [], hasActiveLock: false } }
        }
        const result = lockSeries(state, series, Date.now())
        if (result.ok) setState(result.state)
        return result
      },
      updatePrefs(patch) {
        setPrefs((prev) => ({ ...prev, ...patch }))
      },
      resetAll() {
        clearAll(window.localStorage)
        setState(emptyCullingState())
        setPrefs(defaultPrefs())
      },
    }),
    [state, prefs],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useCulling(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useCulling must be used within CullingProvider')
  return ctx
}
