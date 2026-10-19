import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from './icons'
import { useUi } from '../store/ui'
import { useCompactTitle } from './titleBar'

const cx = (...c) => c.filter(Boolean).join(' ')
export { cx }

// iOS button styles: filled, gray (tinted fill with accent label), plain, destructive.
// Disabled buttons go gray, the way UIKit draws them, rather than a faded tint.
const BUTTON = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong disabled:bg-fill disabled:text-muted',
  secondary: 'bg-fill text-accent hover:bg-fill-strong disabled:bg-fill disabled:text-muted',
  ghost: 'bg-transparent text-accent hover:bg-fill disabled:bg-transparent disabled:text-muted',
  danger: 'bg-danger-soft text-danger hover:bg-danger/20 disabled:bg-fill disabled:text-muted',
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'pressable inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap disabled:opacity-70',
        size === 'sm' ? 'min-h-8 px-3.5 py-1 text-sm' : size === 'lg' ? 'min-h-12 px-7 py-2.5 text-[1.0625rem]' : 'min-h-10 px-5 py-1.5',
        BUTTON[variant],
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} strokeWidth={2} />}
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
      className={cx('pressable inline-flex items-center justify-center rounded-full p-2 text-muted hover:bg-fill hover:text-ink disabled:opacity-40 pointer-coarse:min-h-11 pointer-coarse:min-w-11', className)}
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

/** A white rounded "inset grouped" card on the gray page background. */
export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-2xl border border-transparent bg-surface shadow-card', className)} {...props}>
      {children}
    </div>
  )
}

const BADGE = {
  neutral: 'bg-fill text-muted',
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  ok: 'bg-ok-soft text-ok',
}

export function Badge({ tone = 'neutral', className, children }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold whitespace-nowrap tabular-nums', BADGE[tone], className)}>{children}</span>
}

/** An on/off switch, iOS style. Pass `label` or `labelledBy` for its name. */
export function Switch({ checked, onChange, label, labelledBy, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cx('pressable relative inline-flex h-[1.625rem] w-[2.75rem] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200', checked ? 'bg-ok' : 'bg-fill-strong', className)}
    >
      <span className={cx('h-[1.375rem] w-[1.375rem] rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.2)] transition-transform duration-[var(--duration-ui)] ease-[var(--ease-fluid)]', checked && 'translate-x-[1.125rem]')} />
    </button>
  )
}

/** A red notification count, like an app icon badge. Renders nothing at zero. */
export function CountBadge({ count, className }) {
  if (!count) return null
  return (
    <span className={cx('inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-alert px-1.5 text-xs leading-none font-semibold text-white tabular-nums shadow-[0_1px_2px_rgb(0_0_0/0.15)]', className)}>
      {count > 99 ? '99+' : count}
      <span className="sr-only"> new</span>
    </span>
  )
}

/** Large title. Hands off to the compact title bar when scrolled away. */
export function PageHeader({ title, subtitle, actions }) {
  const titleRef = useRef(null)
  useCompactTitle(title, titleRef)
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 ref={titleRef} className="text-[2.125rem] font-bold">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-[1.0625rem] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Field({ label, hint, children, className }) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="px-1 text-sm font-semibold text-muted">{label}</label>
      {typeof children === 'function' ? children(id) : children}
      {hint && <p className="px-1 text-sm text-muted">{hint}</p>}
    </div>
  )
}

// Filled fields, as in iOS forms and search bars: no border until focused.
const INPUT = 'w-full rounded-lg border border-transparent bg-fill px-3.5 py-2 text-ink transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-muted focus:border-accent focus:bg-surface focus:shadow-[0_0_0_4px_var(--color-accent-soft)] focus:outline-none'
export const Input = ({ className, ...p }) => <input className={cx(INPUT, className)} {...p} />
export const Textarea = ({ className, ...p }) => <textarea className={cx(INPUT, 'min-h-28', className)} {...p} />
export const Select = ({ className, children, ...p }) => <select className={cx(INPUT, 'select-apple pr-9', className)} {...p}>{children}</select>

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
    <div ref={group} role="radiogroup" aria-label={label} className={cx('relative inline-flex max-w-full overflow-x-auto rounded-[0.6rem] bg-fill p-0.5 [scrollbar-width:none]', className)}>
      {thumb && (
        <span
          aria-hidden
          className={cx('motion-travel absolute top-0.5 bottom-0.5 left-0 rounded-[0.5rem] bg-surface shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] dark:bg-[#636366]', ready && 'transition-[transform,width] duration-[var(--duration-ui)] ease-[var(--ease-fluid)]')}
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
          className={cx('pressable pressable-soft relative shrink-0 rounded-[0.5rem] px-3.5 py-1 text-sm pointer-coarse:py-1.5', value === o.value ? 'font-semibold text-ink' : 'font-medium text-ink/80 hover:text-ink', !thumb && value === o.value && 'bg-surface shadow-sm')}
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
        'sheet m-auto w-[calc(100%-2rem)] rounded-3xl bg-elevated p-0 text-ink shadow-[var(--shadow-float)]',
        wide ? 'max-w-3xl' : 'max-w-lg',
        !open && 'pointer-events-none',
      )}
    >
      {shown && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line/40 px-6 pt-5 pb-3">
            <h2 className="text-[1.375rem] font-bold">{shown.title}</h2>
            <IconButton icon="x" label="Close" size={16} className="bg-fill p-1.5 text-muted hover:text-ink" onClick={onClose} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">{shown.children}</div>
          {shown.footer && <div className="flex shrink-0 justify-end gap-2 border-t border-line/40 px-6 pt-3 pb-5">{shown.footer}</div>}
        </div>
      )}
    </dialog>
  )
}

/** Like ContentUnavailableView: a large quiet symbol, a title, a hint. */
export function EmptyState({ icon = 'folder', title, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Icon name={icon} size={52} strokeWidth={1.4} className="mb-4 text-muted/70" />
      <p className="text-[1.375rem] font-bold tracking-tight">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-muted">{children}</div>}
    </div>
  )
}

export function ErrorText({ children }) {
  if (!children) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-danger">
      <Icon name="alert" size={20} className="mt-0.5 shrink-0" /> {children}
    </p>
  )
}

const TOAST_ICON = { error: ['alert', 'text-danger'], warn: ['alert', 'text-warn'], info: ['info', 'text-accent'] }

/** Notification-style banners centered at the top as frosted glass pills. */
export function Toaster() {
  const { toasts, dismiss } = useUi()
  return (
    <div aria-live="polite" className="pointer-events-none fixed top-5 left-1/2 z-50 flex w-auto max-w-[calc(100vw-2.5rem)] -translate-x-1/2 flex-col gap-2.5 items-center">
      {toasts.map((t) => {
        const [icon, color] = TOAST_ICON[t.tone] ?? TOAST_ICON.info
        return (
          <div
            key={t.id}
            className={cx('material pointer-events-auto flex items-center gap-3 rounded-full py-2 pr-2.5 pl-4 text-ink shadow-[var(--shadow-float)] border border-line/40 text-sm font-medium', t.leaving ? 'toast-out' : 'toast-in')}
          >
            <Icon name={icon} size={18} className={cx('shrink-0', color)} />
            <p className="flex-1">{t.message}</p>
            <IconButton icon="x" label="Dismiss" size={14} className="bg-fill p-1" onClick={() => dismiss(t.id)} />
          </div>
        )
      })}
    </div>
  )
}

/** A quiet activity indicator, like UIActivityIndicatorView. */
export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-muted" role="status">
      <svg viewBox="0 0 24 24" className="spinner h-6 w-6" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="11" y="2" width="2" height="6" rx="1" fill="currentColor" opacity={0.25 + (i / 8) * 0.75} transform={`rotate(${i * 45} 12 12)`} />
        ))}
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  )
}
