import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLive } from '../../store/live'
import { toast } from '../../store/ui'
import { load, store } from '../../lib/storage'
import { timeAgo } from '../../lib/format'
import { useSpeech } from '../../lib/speech'
import { Button, Card, EmptyState, Modal, PageHeader, cx } from '../../components/ui'
import { Icon } from '../../components/icons'
import { align, blocksIn, highlight, plainText, sanitize, unhighlight } from './richText'

const NONE = []
const SAVE_DELAY = 700
const MOD = typeof navigator !== 'undefined' && /Mac|iPad|iPhone/.test(navigator.userAgent) ? '⌘' : 'Ctrl+'

const STYLES = [
  { value: 'p', label: 'Normal text' },
  { value: 'h1', label: 'Title' },
  { value: 'h2', label: 'Heading' },
  { value: 'h3', label: 'Subheading' },
  { value: 'blockquote', label: 'Quote' },
]

/*
 * The juror's notebook: pages of formatted notes, like a word processor.
 * Private to the juror (only their own devices receive it), kept on the
 * court server so it follows them between devices, and never logged.
 */
export default function NotesPage() {
  const pages = useLive((s) => s.personal.notebook ?? NONE)
  const emit = useLive((s) => s.emit)
  const [selected, setSelected] = useState(() => load('notebookPage', null))
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const current = pages.find((p) => p.id === selected) ?? pages[0] ?? null
  const previews = useMemo(() => Object.fromEntries(pages.map((p) => [p.id, plainText(p.html)])), [pages])

  const select = (id) => {
    setSelected(id)
    store('notebookPage', id)
  }

  async function create() {
    setBusy(true)
    try {
      const { page } = await emit('notebook:save', { title: '', html: '' })
      select(page.id)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await emit('notebook:delete', { id: deleting.id })
      setDeleting(null)
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-var(--page-chrome,4rem))] min-h-[32rem] flex-col">
      <PageHeader
        title="My notes"
        subtitle="Only you can read these. Court staff and other jurors can't, and they follow you to any device you sign in on."
        actions={<Button variant="primary" icon="plus" onClick={create} disabled={busy}>New note</Button>}
      />

      {!current ? (
        <Card className="flex-1">
          <EmptyState icon="note" title="No notes yet">
            Write down testimony, questions and thoughts as you go, with headings, lists and highlights.
            <div className="mt-4"><Button variant="primary" icon="plus" onClick={create} disabled={busy}>Start a note</Button></div>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-4 md:grid-cols-[14rem_1fr] md:grid-rows-1 xl:grid-cols-[16rem_1fr]">
          <nav aria-label="Your notes" className="max-h-40 min-h-0 overflow-y-auto scrollbar-thin md:max-h-none">
            <ul className="flex flex-col gap-1">
              {pages.map((p) => {
                const on = p.id === current.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-current={on ? 'page' : undefined}
                      onClick={() => select(p.id)}
                      className={cx('pressable pressable-soft w-full rounded-xl px-3 py-2 text-left', on ? 'bg-accent text-accent-ink' : 'hover:bg-fill')}
                    >
                      <span className="block truncate font-semibold">{p.title || 'Untitled note'}</span>
                      <span className={cx('block truncate text-sm', on ? 'text-accent-ink/80' : 'text-muted')}>
                        {timeAgo(p.updatedAt)}{previews[p.id] && ` · ${previews[p.id]}`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
          <NoteEditor key={current.id} page={current} onDelete={() => setDeleting(current)} />
        </div>
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this note?"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={remove} disabled={busy}>Delete note</Button>
        </>}
      >
        <p>“{deleting?.title || 'Untitled note'}” will be deleted from all your devices. This can’t be undone.</p>
      </Modal>
    </div>
  )
}

/** Which formatting applies where the cursor is, for the toolbar's pressed states. */
function formatsAt(root) {
  const q = (cmd) => {
    try { return document.queryCommandState(cmd) } catch { return false }
  }
  let block = 'p'
  try { block = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, '') } catch { /* unsupported */ }
  // Highlighted if the first selected character sits inside a highlight.
  const sel = document.getSelection()
  let el = null
  if (sel?.rangeCount) {
    const r = sel.getRangeAt(0)
    el = r.startContainer.childNodes?.[r.startOffset] ?? r.startContainer
    while (el.firstChild) el = el.firstChild
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement
  }
  const hl = !!el?.closest('mark') && root.contains(el)
  const aligned = sel?.rangeCount ? blocksIn(root, sel.getRangeAt(0))[0]?.getAttribute('data-align') : null
  return {
    bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'),
    ul: q('insertUnorderedList'), ol: q('insertOrderedList'),
    center: aligned === 'center', right: aligned === 'right',
    block: STYLES.some((s) => s.value === block) ? block : 'p',
    hl,
  }
}

function Tool({ icon, glyph, label, shortcut, on, onClick, className }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={on}
      // Keep the selection in the note when a tool is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        'pressable flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 text-ink hover:bg-fill pointer-coarse:h-11 pointer-coarse:min-w-11',
        on && 'bg-accent-soft text-accent hover:bg-accent-soft',
        className,
      )}
    >
      {glyph ?? <Icon name={icon} size={18} strokeWidth={2} />}
    </button>
  )
}

const Divider = () => <span className="mx-1 h-5 w-px bg-line" aria-hidden />

function NoteEditor({ page, onDelete }) {
  const emit = useLive((s) => s.emit)
  const { supported: canSpeak, speaking, speak, stop } = useSpeech()
  const editor = useRef(null)
  const range = useRef(null) // the selection in the note, kept while a toolbar control has focus
  const html = useRef(page.html)
  const timer = useRef(null)
  const sync = useRef({ version: page.version, dirty: false, saving: false })
  const [title, setTitle] = useState(page.title)
  const titleNow = useRef(page.title)
  const [status, setStatus] = useState('saved')
  const [formats, setFormats] = useState({})
  const [words, setWords] = useState(0)

  const measure = useCallback(() => {
    const el = editor.current
    if (!el) return
    const text = el.innerText.trim()
    el.toggleAttribute('data-empty', !text && !el.querySelector('li'))
    setWords(text ? text.split(/\s+/).length : 0)
  }, [])

  const save = useCallback(async () => {
    const s = sync.current
    clearTimeout(timer.current)
    if (!s.dirty || s.saving) return
    s.saving = true
    s.dirty = false
    let failed = false
    setStatus('saving')
    try {
      const { page: saved } = await emit('notebook:save', { id: page.id, title: titleNow.current, html: sanitize(html.current) })
      s.version = Math.max(s.version, saved.version)
      setStatus(s.dirty ? 'editing' : 'saved')
    } catch {
      s.dirty = true
      failed = true
      setStatus('error')
    } finally {
      s.saving = false
      // Typing during the save, or a failed save: go again.
      if (s.dirty) timer.current = setTimeout(() => saveRef.current(), failed ? 3000 : SAVE_DELAY)
    }
  }, [emit, page.id])
  const saveRef = useRef(save)
  saveRef.current = save

  const changed = useCallback(() => {
    if (editor.current) html.current = editor.current.innerHTML
    sync.current.dirty = true
    setStatus('editing')
    measure()
    clearTimeout(timer.current)
    timer.current = setTimeout(() => saveRef.current(), SAVE_DELAY)
  }, [measure])

  // Load the note once; after that the editor's own content is the truth.
  useLayoutEffect(() => {
    editor.current.innerHTML = sanitize(page.html) || '<p><br></p>'
    measure()
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p')
      document.execCommand('styleWithCSS', false, false)
    } catch { /* unsupported */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // An edit from another of this juror's devices, while nothing here is unsaved.
  useEffect(() => {
    const s = sync.current
    if (page.version <= s.version || s.dirty || s.saving) return
    s.version = page.version
    html.current = page.html
    editor.current.innerHTML = sanitize(page.html) || '<p><br></p>'
    setTitle(page.title)
    titleNow.current = page.title
    measure()
  }, [page, measure])

  // Save what's left when switching notes, leaving the page or hiding the app.
  useEffect(() => {
    const flush = () => saveRef.current()
    const hidden = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  useEffect(() => {
    const onSelection = () => {
      const sel = document.getSelection()
      if (!sel?.rangeCount || !editor.current?.contains(sel.anchorNode)) return
      range.current = sel.getRangeAt(0).cloneRange()
      setFormats(formatsAt(editor.current))
    }
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [])

  // Run `fn` on the note with its selection back in place (a toolbar control may have taken focus).
  function edit(fn) {
    const el = editor.current
    el.focus()
    const sel = document.getSelection()
    if (range.current) {
      sel.removeAllRanges()
      sel.addRange(range.current)
    }
    fn(el, sel.rangeCount ? sel.getRangeAt(0) : null)
    changed()
    setFormats(formatsAt(el))
  }
  // The browser's formatting commands, kept to ones that write tags (<b>, <ul>…) and never inline styles, which the CSP refuses.
  const exec = (cmd, value) => edit(() => document.execCommand(cmd, false, value))

  // Highlights and alignment are done here rather than by the browser, which would use inline styles.
  const toggleHighlight = () => edit((el, r) => r && (formats.hl ? unhighlight(el, r) : highlight(el, r)))
  const alignTo = (value) => edit((el, r) => r && align(el, r, value))
  const clearFormatting = () => edit((el, r) => {
    document.execCommand('removeFormat')
    document.execCommand('formatBlock', false, '<p>')
    if (r) { unhighlight(el, r); align(el, r, 'left') }
  })

  // Typing "- " or "1. " at the start of a line starts a list.
  function autoList() {
    const sel = document.getSelection()
    const node = sel.anchorNode
    if (!sel.isCollapsed || node?.nodeType !== Node.TEXT_NODE || node.previousSibling) return
    const marker = /^([-*]|1[.)])[\s\u00a0]$/.exec(node.textContent.slice(0, sel.anchorOffset))
    const block = node.parentElement
    if (!marker || block.closest('li') || !(block === editor.current || /^(P|DIV)$/.test(block.tagName))) return
    const r = document.createRange()
    r.setStart(node, 0)
    r.setEnd(node, sel.anchorOffset)
    sel.removeAllRanges()
    sel.addRange(r)
    document.execCommand('delete')
    document.execCommand(marker[1] === '-' || marker[1] === '*' ? 'insertUnorderedList' : 'insertOrderedList')
  }

  function onInput(e) {
    if (e.nativeEvent.inputType === 'insertText' && e.nativeEvent.data?.endsWith(' ')) autoList()
    changed()
  }

  // Word-processor shortcuts. Bold, italic, underline, undo and redo are the browser's own.
  function onKeyDown(e) {
    const mod = e.metaKey || e.ctrlKey
    const inList = !!document.getSelection()?.anchorNode?.parentElement?.closest('li')
    if (e.key === 'Tab' && inList) {
      e.preventDefault()
      exec(e.shiftKey ? 'outdent' : 'indent')
    } else if (mod && e.shiftKey && e.code === 'KeyX') {
      e.preventDefault()
      exec('strikeThrough')
    } else if (mod && e.shiftKey && e.code === 'KeyH') {
      e.preventDefault()
      toggleHighlight()
    } else if (mod && e.shiftKey && (e.code === 'Digit7' || e.code === 'Digit8')) {
      e.preventDefault()
      exec(e.code === 'Digit7' ? 'insertOrderedList' : 'insertUnorderedList')
    } else if (mod && e.altKey && /^Digit[0-3]$/.test(e.code)) {
      e.preventDefault()
      exec('formatBlock', e.code === 'Digit0' ? '<p>' : `<h${e.code.at(-1)}>`)
    }
  }

  // Pasted text keeps simple formatting and loses everything else.
  function onPaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text/html')
    if (pasted) document.execCommand('insertHTML', false, sanitize(pasted))
    else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }

  function readAloud() {
    if (speaking) return stop()
    const sel = document.getSelection()
    const picked = sel && !sel.isCollapsed && editor.current.contains(sel.anchorNode) ? sel.toString() : ''
    speak(picked || `${title || 'Untitled note'}. ${editor.current.innerText}`)
  }

  const STATUS = { saved: 'Saved', saving: 'Saving…', editing: 'Editing…', error: 'Couldn’t save. Retrying…' }

  return (
    <section aria-label={title || 'Untitled note'} className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
      <div className="flex shrink-0 items-center gap-0.5 border-b border-line/60 py-1.5 pr-2">
        {/* One row that scrolls sideways on a narrow screen, like a word processor on a tablet. */}
        <div role="toolbar" aria-label="Formatting" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pl-2 [scrollbar-width:none]">
          <Tool icon="undo" label="Undo" shortcut={`${MOD}Z`} onClick={() => exec('undo')} />
          <Tool icon="redo" label="Redo" shortcut={`${MOD}⇧Z`} onClick={() => exec('redo')} />
          <Divider />
          <label className="sr-only" htmlFor={`style-${page.id}`}>Text style</label>
          <select
            id={`style-${page.id}`}
            value={formats.block ?? 'p'}
            onChange={(e) => exec('formatBlock', `<${e.target.value}>`)}
            className="h-9 rounded-lg bg-transparent px-2 text-sm font-medium text-ink hover:bg-fill focus:outline-none pointer-coarse:h-11"
          >
            {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Divider />
          <Tool glyph={<span className="text-[1.05rem] font-bold">B</span>} label="Bold" shortcut={`${MOD}B`} on={!!formats.bold} onClick={() => exec('bold')} />
          <Tool glyph={<span className="font-serif text-[1.1rem] italic">I</span>} label="Italic" shortcut={`${MOD}I`} on={!!formats.italic} onClick={() => exec('italic')} />
          <Tool glyph={<span className="text-[1.05rem] underline underline-offset-2">U</span>} label="Underline" shortcut={`${MOD}U`} on={!!formats.underline} onClick={() => exec('underline')} />
          <Tool glyph={<span className="text-[1.05rem] line-through">S</span>} label="Strikethrough" shortcut={`${MOD}⇧X`} on={!!formats.strike} onClick={() => exec('strikeThrough')} />
          <Tool icon="highlighter" label="Highlight" shortcut={`${MOD}⇧H`} on={!!formats.hl} onClick={toggleHighlight} />
          <Divider />
          <Tool icon="list" label="Bulleted list" shortcut={`${MOD}⇧8`} on={!!formats.ul} onClick={() => exec('insertUnorderedList')} />
          <Tool icon="listOrdered" label="Numbered list" shortcut={`${MOD}⇧7`} on={!!formats.ol} onClick={() => exec('insertOrderedList')} />
          <Divider />
          <Tool icon="alignLeft" label="Align left" on={!formats.center && !formats.right} onClick={() => alignTo('left')} />
          <Tool icon="alignCenter" label="Center" on={!!formats.center} onClick={() => alignTo('center')} />
          <Tool icon="alignRight" label="Align right" on={!!formats.right} onClick={() => alignTo('right')} />
          <Divider />
          <Tool icon="eraser" label="Clear formatting" onClick={clearFormatting} />
        </div>
        <span className="flex shrink-0 items-center gap-0.5 border-l border-line/60 pl-1.5">
          {canSpeak && (
            <Tool
              icon={speaking ? 'stop' : 'volume'}
              label={speaking ? 'Stop reading' : 'Read aloud (the selection, or the whole note)'}
              on={speaking}
              onClick={readAloud}
            />
          )}
          <Tool icon="trash" label="Delete note" onClick={onDelete} className="text-danger" />
        </span>
      </div>

      <div className="min-h-0 flex-1 cursor-text overflow-y-auto scrollbar-thin" onClick={(e) => e.target === e.currentTarget && editor.current.focus()}>
        <div className="mx-auto max-w-3xl px-6 pt-7 pb-16 md:px-10">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              titleNow.current = e.target.value
              changed()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                editor.current.focus()
              }
            }}
            maxLength={120}
            placeholder="Untitled note"
            aria-label="Note title"
            className="w-full bg-transparent text-[1.75rem] font-bold tracking-tight placeholder:text-muted/60 focus:outline-none"
          />
          <div
            ref={editor}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Note"
            spellCheck
            data-placeholder="Start writing… Type “- ” for a list."
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onDrop={(e) => e.dataTransfer.files.length && e.preventDefault()}
            className="notebook relative mt-4 min-h-[40vh] text-[1.0625rem] leading-relaxed"
          />
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line/60 px-4 py-1.5 text-sm text-muted">
        <span className="tabular-nums">{words} {words === 1 ? 'word' : 'words'}</span>
        <span role={status === 'error' ? 'alert' : undefined} className={cx('flex items-center gap-1.5', status === 'error' && 'font-semibold text-warn')}>
          {status === 'saved' && <Icon name="check" size={15} strokeWidth={2.2} />}
          {STATUS[status]}
        </span>
      </footer>
    </section>
  )
}
