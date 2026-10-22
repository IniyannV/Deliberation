/*
 * The notebook stores formatted text as HTML. Before it's shown, and when
 * something is pasted in, it's rebuilt from an allowlist: only these tags,
 * and no attributes except `data-align`, so a paste from elsewhere can't
 * bring in scripts, links, images or odd styling.
 *
 * The server's CSP refuses inline `style` attributes, so nothing here uses
 * them: highlights are <mark> and alignment is `data-align` (index.css
 * styles both). Pasted text that carries styles has them converted.
 */

const TAGS = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'MARK', 'SPAN'])
const RENAME = { STRONG: 'B', EM: 'I', STRIKE: 'S', DIV: 'P', SPAN: 'MARK' }
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'HEAD', 'TITLE', 'META', 'LINK', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO'])
const ALIGN = new Set(['left', 'center', 'right'])
const BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'BLOCKQUOTE'])
// The CSP would refuse (and log) inline styles while parsing, so they're parsed as
// `data-style` instead and read from the attribute text.
const parse = (html) => new DOMParser().parseFromString(`<body>${(html ?? '').replace(/(<[^>]*?\s)style\s*=/gi, '$1data-style=')}</body>`, 'text/html')
const styleOf = (el, prop) => new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(el.getAttribute('data-style') ?? '')?.[1].trim()
const visibleColor = (bg) => !!bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)
const highlighted = (el) => el.tagName === 'MARK' || visibleColor(styleOf(el, 'background-color'))

function clean(node) {
  const out = document.createDocumentFragment()
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.append(document.createTextNode(child.textContent))
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE || DROP.has(child.tagName)) continue
    const inner = clean(child)
    const tag = RENAME[child.tagName] ?? child.tagName
    // Unknown wrappers, and spans that aren't highlights (spans become marks), keep their text and lose the wrapper.
    if (!TAGS.has(child.tagName) || (tag === 'MARK' && !highlighted(child))) {
      out.append(inner)
      continue
    }
    const el = document.createElement(tag)
    const align = styleOf(child, 'text-align') || child.getAttribute('align') || child.getAttribute('data-align')
    if (ALIGN.has(align) && align !== 'left' && /^(P|H[1-3]|LI|BLOCKQUOTE)$/.test(tag)) el.setAttribute('data-align', align)
    if (/^[BIUS]$/.test(tag) && highlighted(child)) {
      // Highlighting bold (or italic…) text puts the colour on that tag; keep it as a highlight inside.
      const mark = document.createElement('mark')
      mark.append(inner)
      el.append(mark)
    } else {
      el.append(inner)
    }
    out.append(el)
  }
  return out
}

/** Safe, tidy HTML for the notebook. */
export function sanitize(html) {
  const doc = parse(html)
  const box = document.createElement('div')
  box.append(clean(doc.body))
  // Loose text at the top level (an editor's first line, say) goes in a paragraph like the rest.
  let para = null
  for (const node of [...box.childNodes]) {
    if (node.nodeType === Node.ELEMENT_NODE && BLOCKS.has(node.tagName)) {
      para = null
      continue
    }
    if (!para) {
      para = document.createElement('p')
      node.before(para)
    }
    para.append(node)
  }
  for (const el of box.querySelectorAll('p:empty, h1:empty, h2:empty, h3:empty')) el.remove()
  return box.innerHTML
}

/** Plain text of a note, for its preview and word count. */
export function plainText(html) {
  const doc = parse(html)
  for (const el of doc.body.querySelectorAll('p, div, li, h1, h2, h3, blockquote, br')) el.append(' ')
  return doc.body.textContent.replace(/\s+/g, ' ').trim()
}

const BLOCK_SELECTOR = 'p, h1, h2, h3, li, blockquote'

/** Highlight the selected text: each selected run of text goes in a <mark>. */
export function highlight(root, range) {
  if (range.collapsed) return
  const scope = range.commonAncestorContainer
  const walker = document.createTreeWalker(scope.nodeType === Node.TEXT_NODE ? scope.parentNode : scope, NodeFilter.SHOW_TEXT)
  const texts = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (range.intersectsNode(n) && root.contains(n) && !n.parentElement.closest('mark')) texts.push(n)
  }
  let first = null
  let last = null
  for (let n of texts) {
    const start = n === range.startContainer ? range.startOffset : 0
    const end = n === range.endContainer ? range.endOffset : n.length
    if (start >= end) continue
    if (end < n.length) n.splitText(end)
    if (start > 0) n = n.splitText(start)
    const mark = document.createElement('mark')
    n.replaceWith(mark)
    mark.append(n)
    first ??= mark
    last = mark
  }
  if (first) select(first, last)
}

/** Remove highlights the selection touches. */
export function unhighlight(root, range) {
  for (const mark of root.querySelectorAll('mark')) {
    if (range.intersectsNode(mark)) mark.replaceWith(...mark.childNodes)
  }
}

/** The paragraphs, headings and list items the selection covers. */
export function blocksIn(root, range) {
  const near = (node) => (node.nodeType === Node.TEXT_NODE ? node.parentElement : node)?.closest(BLOCK_SELECTOR)
  const all = [...root.querySelectorAll(BLOCK_SELECTOR)].filter((b) => range.intersectsNode(b) && !b.querySelector(BLOCK_SELECTOR))
  const start = near(range.startContainer)
  return all.length ? all : start && root.contains(start) ? [start] : []
}

/** Align the selected blocks: 'left', 'center' or 'right'. */
export function align(root, range, value) {
  for (const b of blocksIn(root, range)) {
    if (value === 'left') b.removeAttribute('data-align')
    else b.setAttribute('data-align', value)
  }
}

function select(first, last) {
  const r = document.createRange()
  r.setStartBefore(first)
  r.setEndAfter(last)
  const sel = document.getSelection()
  sel.removeAllRanges()
  sel.addRange(r)
}
