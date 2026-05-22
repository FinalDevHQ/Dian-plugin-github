import { useState, useCallback, type ReactNode } from "react"

interface ToastItem { id: number; msg: string; ok: boolean }
let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const show = useCallback((msg: string, ok = true) => {
    const id = ++toastId
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500)
  }, [])
  const ToastPortal = () => (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-md border px-3 py-2 text-xs shadow-lg transition-all ${
            t.ok
              ? "border-emerald-600/40 bg-emerald-50 text-emerald-700"
              : "border-destructive/40 bg-red-50 text-destructive"
          }`}
        >
          {t.ok ? "✓" : "✗"} {t.msg}
        </div>
      ))}
    </div>
  )
  return { show, ToastPortal }
}

export function ConfirmModal({
  open, message, onConfirm, onCancel,
}: {
  open: boolean; message: string; onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="rounded-xl border bg-card p-5 shadow-xl w-80" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-foreground mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="h-8 rounded-md border px-3 text-xs hover:bg-accent">取消</button>
          <button onClick={onConfirm} className="h-8 rounded-md bg-destructive text-white px-3 text-xs hover:bg-destructive/90">确认</button>
        </div>
      </div>
    </div>
  )
}
