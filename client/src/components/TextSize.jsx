import { TEXT_SCALES, useUi } from '../store/ui'
import { cx } from './ui'

/** A− / A+ buttons that make all text smaller or larger (iPad has no Cmd-plus). */
export default function TextSize({ className }) {
  const scale = useUi((s) => s.textScale)
  const step = useUi((s) => s.stepTextScale)
  const btn = 'pressable flex h-8 w-9 items-center justify-center rounded-full font-semibold text-accent hover:bg-fill disabled:text-muted disabled:opacity-50'
  return (
    <div role="group" aria-label={`Text size ${Math.round(scale * 100)}%`} className={cx('material-bar flex items-center rounded-full p-0.5 shadow-card', className)}>
      <button type="button" className={cx(btn, 'text-sm')} onClick={() => step(-1)} disabled={scale === TEXT_SCALES[0]} aria-label="Smaller text" title="Smaller text">A−</button>
      <span className="h-4 w-px bg-line" aria-hidden />
      <button type="button" className={cx(btn, 'text-lg')} onClick={() => step(1)} disabled={scale === TEXT_SCALES.at(-1)} aria-label="Larger text" title="Larger text">A+</button>
    </div>
  )
}
