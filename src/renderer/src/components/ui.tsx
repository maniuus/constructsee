import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { Icon, type IconName } from './Icons'

/* ------------------------------ Toasts ------------------------------ */

type ToastKind = 'ok' | 'err' | 'info'

export interface ToastAction {
  label: string
  run: () => void
}

interface ToastItem {
  id: number
  kind: ToastKind
  msg: string
  action?: ToastAction
}

interface ToastCtx {
  push: (msg: string, kind?: ToastKind, action?: ToastAction, ttlMs?: number) => void
}

const ToastContext = createContext<ToastCtx>({ push: () => {} })

export function useToast(): ToastCtx {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(1)

  const push = useCallback(
    (msg: string, kind: ToastKind = 'info', action?: ToastAction, ttlMs?: number) => {
      const id = idRef.current++
      setItems((xs) => [...xs, { id, kind, msg, action }])
      const ttl = ttlMs ?? (action ? 8000 : kind === 'err' ? 6000 : 3500)
      setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), ttl)
    },
    []
  )

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role="status" aria-live="polite">
            <span className="ico">
              <Icon name={t.kind === 'ok' ? 'check' : t.kind === 'err' ? 'alert' : 'info'} />
            </span>
            <span className="grow">{t.msg}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action?.run()
                  setItems((xs) => xs.filter((x) => x.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              className="icon-btn"
              aria-label="Tutup"
              onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ----------------------------- Confirm ------------------------------ */

export interface ConfirmOpts {
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setReq({ opts, resolve })),
    []
  )

  const close = useCallback(
    (v: boolean) => {
      req?.resolve(v)
      setReq(null)
    },
    [req]
  )

  useEffect(() => {
    if (!req) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [req, close])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {req && (
        <div className="overlay-backdrop" onClick={() => close(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{req.opts.title ?? 'Konfirmasi'}</h3>
            <p>{req.opts.message}</p>
            <div className="dialog-foot">
              <button className="btn ghost" onClick={() => close(false)}>
                Batal
              </button>
              <button
                className={`btn ${req.opts.danger ? 'danger' : 'primary'}`}
                autoFocus
                onClick={() => close(true)}
              >
                {req.opts.confirmLabel ?? 'Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

/* ------------------------------ Drawer ------------------------------ */

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer
}: {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="overlay-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="grow">
            <h2>{title}</h2>
            {subtitle && <div className="panel-sub">{subtitle}</div>}
          </div>
          <button className="icon-btn" aria-label="Tutup" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  )
}

/* --------------------------- Error box ------------------------------ */

/** Terjemahkan pesan error teknis (SQLite/Rust) menjadi kalimat yang bisa ditindaklanjuti. */
export function friendlyError(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes('unique constraint')) return 'Data dengan kunci yang sama sudah ada.'
  if (s.includes('foreign key constraint')) return 'Data ini masih dipakai oleh data lain, jadi belum bisa diubah/dihapus.'
  if (s.includes('not null constraint')) return 'Ada kolom wajib yang belum diisi.'
  if (s.includes('no such table') || s.includes('no such column')) return 'Struktur basis data belum lengkap. Tutup lalu buka lagi aplikasi agar migrasi berjalan.'
  if (s.includes('database is locked') || s.includes('sqlite_busy')) return 'Basis data sedang dipakai proses lain. Coba lagi sebentar.'
  if (s.includes('no rows') || s.includes('not found')) return 'Data tidak ditemukan — mungkin sudah dihapus.'
  if (s.includes('invalid') || s.includes('expected')) return 'Nilai yang dikirim tidak valid.'
  return 'Terjadi kesalahan saat memproses data.'
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div className="err-box" role="alert">
      <span className="ico">
        <Icon name="alert" size={15} />
      </span>
      <div className="grow">
        <div>{friendlyError(error)}</div>
        <details>
          <summary>Detail teknis</summary>
          <pre className="err">{error}</pre>
        </details>
      </div>
    </div>
  )
}

/* --------------------------- Command palette ------------------------ */

export interface Command {
  id: string
  label: string
  group?: string
  icon?: IconName
  run: () => void
}

export function CommandPalette({
  open,
  onClose,
  commands
}: {
  open: boolean
  onClose: () => void
  commands: Command[]
}) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return commands
    return commands.filter(
      (c) => c.label.toLowerCase().includes(s) || (c.group ?? '').toLowerCase().includes(s)
    )
  }, [q, commands])

  if (!open) return null

  const run = (c?: Command) => {
    if (!c) return
    onClose()
    c.run()
  }

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIdx((i) => Math.min(i + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIdx((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            run(filtered[idx])
          } else if (e.key === 'Escape') {
            onClose()
          }
        }}
      >
        <div className="palette-search">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setIdx(0)
            }}
            placeholder="Cari perintah atau modul…"
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-list">
          {filtered.length === 0 && <div className="palette-item muted">Tidak ada hasil</div>}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              className={`palette-item${i === idx ? ' active' : ''}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(c)}
            >
              {c.icon && <Icon name={c.icon} />}
              <span className="grow">{c.label}</span>
              {c.group && <span className="muted">{c.group}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
