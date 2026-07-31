import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastKind = 'info' | 'error' | 'success'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void
  /**
   * Run a database write (or any promise) surfacing failure to the user rather
   * than swallowing it. Every persistence call goes through this so a rejected
   * IndexedDB write can never look like a dead button.
   */
  run: <T>(work: () => Promise<T>, failMessage?: string) => Promise<T | undefined>
}

const Ctx = createContext<ToastApi | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId++
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 2800)
  }, [])

  const run = useCallback<ToastApi['run']>(
    async (work, failMessage) => {
      try {
        return await work()
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        toast(`${failMessage ?? 'Couldn’t save that'} — ${detail}`, 'error')
        return undefined
      }
    },
    [toast],
  )

  const api = useMemo(() => ({ toast, run }), [toast, run])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
