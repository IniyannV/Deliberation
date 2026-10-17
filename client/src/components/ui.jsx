import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from './icons'
import { useUi } from '../store/ui'

const cx = (...c) => c.filter(Boolean).join(' ')
export { cx }

const BUTTON = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong border-transparent',
  secondary: 'bg-surface text-ink border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-2',
  danger: 'bg-surface text-danger border-danger/40 hover:bg-danger-soft',
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'pressable inline-flex items-center justify-center gap-2 rounded-lg border font-semibold disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : size === 'lg' ? 'px-6 py-3 text-lg' : 'px-4 py-2',
        BUTTON[variant],
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, className, size = 20, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('pressable inline-flex items-center justify-center rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40', className)}
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-xl border border-line bg-surface', className)} {...props}>
      {children}
    </div>
  )
}

const BADGE = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  ok: 'bg-ok-soft text-ok',
}

export function Badge({ tone = 'neutral', className, children }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap', BADGE[tone], className)}>{children}</span>
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Field({ label, hint, children, className }) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="font-semibold">{label}</label>
      {typeof children === 'function' ? children(id) : children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}

const INPUT = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-muted/70 focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)] focus:outline-none'
export const Input = ({ className, ...p }) => <input className={cx(INPUT, className)} {...p} />
export const Textarea = ({ className, ...p }) => <textarea className={cx(INPUT, 'min-h-28', className)} {...p} />
export const Select = ({ className, children, ...p }) => <select className={cx(INPUT, 'pr-8', className)} {...p}>{children}</select>

/**
 * The selected option is marked by a thumb that slides between options,
 * so the eye can follow the change instead of seeing two states swap.
 */
export function Segmented({ value, onChange, options, label, className }) {
  const group = useRef(null)
  const [thumb, setThumb] = useState(null)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const el = group.current?.querySelector('[aria-checked="true"]')
    if (!el) return setThumb(null)
    const measure = () => setThumb({ x: el.offsetLeft, w: el.offsetWidth })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [value, options.length])

  // Place the thumb without animating on first paint; animate every change after.
  useEffect(() => {
    if (!thumb || ready) return
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [thumb, ready])

  return (
    <div ref={group} role="radiogroup" aria-label={label} className={cx('relative inline-flex rounded-lg border border-line bg-surface-2 p-1', className)}>
      {thumb && (
        <span
          aria-hidden
          className={cx('motion-travel absolute top-1 bottom-1 left-0 rounded-md bg-surface shadow-sm ring-1 ring-black/5 dark:ring-white/5', ready && 'transition-[transform,width] duration-[var(--duration-ui)] ease-[var(--ease-fluid)]')}
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('pressable pressable-soft relative rounded-md px-3 py-1.5 text-sm font-semibold', value === o.value ? 'text-ink' : 'text-muted hover:text-ink', !thumb && value === o.value && 'bg-surface shadow-sm')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null)
  // Keep showing the last content while the dialog animates out, so it
  // leaves looking the way it arrived instead of emptying first.
  const last = useRef(null)
  if (open) last.current = { title, children, footer }
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) { setClosing(false); d.showModal() }
    if (!open && d.open) {
      setClosing(true)
      d.close()
      const t = setTimeout(() => setClosing(false), 260)
      return () => clearTimeout(t)
    }
  }, [open])

  const shown = open ? { title, children, footer } : closing ? last.current : null
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      className={cx(
        'sheet m-auto w-full rounded-2xl border border-line bg-surface p-0 text-ink shadow-[0_24px_64px_-12px_rgb(0_0_0/0.35)]',
        wide ? 'max-w-3xl' : 'max-w-lg',
        !open && 'pointer-events-none',
      )}
    >
      {shown && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="text-xl font-bold">{shown.title}</h2>
            <IconButton icon="x" label="Close" onClick={onClose} />
          </div>
          <div className="overflow-y-auto px-6 py-5 scrollbar-thin">{shown.children}</div>
          {shown.footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{shown.footer}</div>}
        </div>
      )}
    </dialog>
  )
}

export function EmptyState({ icon = 'folder', title, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <Icon name={icon} size={36} className="mb-3 text-muted" />
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-md text-muted">{children}</div>}
    </div>
  )
}

export function ErrorText({ children }) {
  if (!children) return null
  return <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-danger">{children}</p>
}

export function Toaster() {
  const { toasts, dismiss } = useUi()
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-6 bottom-6 z-50 flex w-96 max-w-[90vw] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex origin-bottom-right items-start gap-3 rounded-xl border px-4 py-3',
            t.leaving ? 'toast-out' : 'toast-in',
            t.tone === 'error' ? 'border-danger/40 bg-danger-soft text-danger shadow-lg' : t.tone === 'warn' ? 'border-warn/40 bg-warn-soft text-warn shadow-lg' : 'material border-line text-ink',
          )}
        >
          <p className="flex-1">{t.message}</p>
          <IconButton icon="x" label="Dismiss" size={16} className="-m-1" onClick={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return <p className="py-10 text-center text-muted" role="status">{label}</p>
}
