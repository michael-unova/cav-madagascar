import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ClipboardEvent, ChangeEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { getFirebaseStorage } from '../lib/firebase/storage'

type Props = {
  value: string
  onChange: (html: string) => void
  storageFolder?: string
  /** Open directly in the dedicated editing workspace when launched from lesson management. */
  initialExpanded?: boolean
  lessonTitle?: string
  onExitExpanded?: () => void
  onSave?: () => void | Promise<void>
  isSaving?: boolean
  canSave?: boolean
}

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'DIV', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE',
  'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'SUB', 'SUP',
  'A', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'IMG', 'FIGURE', 'FIGCAPTION', 'IFRAME',
  // Native MathML is rendered by modern browsers and keeps equations semantic/editable via data-latex.
  'MATH', 'MROW', 'MI', 'MN', 'MO', 'MTEXT', 'MSQRT', 'MROOT', 'MFRAC', 'MSUP', 'MSUB', 'MSUBSUP',
  'MUNDER', 'MOVER', 'MUNDEROVER', 'MTABLE', 'MTR', 'MTD', 'MFENCED', 'MSTYLE', 'MSPACE',
])

const ALLOWED_ATTRIBUTES = new Set([
  'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'contenteditable',
  'colspan', 'rowspan', 'class', 'style', 'data-latex', 'data-equation-display', 'data-page-break',
  'display', 'mathvariant', 'stretchy', 'fence', 'separator', 'columnalign', 'rowalign', 'largeop',
  'accent', 'lspace', 'rspace', 'minsize', 'maxsize', 'xmlns', 'open', 'close',
])

function isSafeUrl(value: string, allowImage = false) {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./')) return true
  try {
    const url = new URL(trimmed, window.location.origin)
    const allowed = allowImage ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:']
    return allowed.includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * A small dependency-free LaTeX -> MathML renderer for the common school-level
 * expressions used in CAV lessons. MathML is rendered natively by current browsers.
 * The original LaTeX remains in data-latex for later editing/conversion.
 */
function latexToMathML(input: string): string {
  const source = input.trim()
  if (!source) return '<math display="inline"><mtext></mtext></math>'
  const greek: Record<string, string> = {
    alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', varepsilon:'ϵ', zeta:'ζ', eta:'η', theta:'θ', vartheta:'ϑ',
    iota:'ι', kappa:'κ', lambda:'λ', mu:'μ', nu:'ν', xi:'ξ', pi:'π', varpi:'ϖ', rho:'ρ', sigma:'σ', varsigma:'ς', tau:'τ',
    upsilon:'υ', phi:'φ', varphi:'ϕ', chi:'χ', psi:'ψ', omega:'ω', Gamma:'Γ', Delta:'Δ', Theta:'Θ', Lambda:'Λ', Xi:'Ξ',
    Pi:'Π', Sigma:'Σ', Upsilon:'Υ', Phi:'Φ', Psi:'Ψ', Omega:'Ω',
  }
  const symbols: Record<string, string> = {
    cdot:'⋅', times:'×', div:'÷', pm:'±', mp:'∓', leq:'≤', le:'≤', geq:'≥', ge:'≥', neq:'≠', ne:'≠', approx:'≈',
    equiv:'≡', in:'∈', notin:'∉', subset:'⊂', subseteq:'⊆', supset:'⊃', cup:'∪', cap:'∩', to:'→', rightarrow:'→',
    leftarrow:'←', leftrightarrow:'↔', implies:'⇒', infinity:'∞', partial:'∂', nabla:'∇', forall:'∀', exists:'∃',
    emptyset:'∅', ell:'ℓ', ldots:'…', cdots:'⋯', therefore:'∴', angle:'∠', degree:'°',
  }
  let i = 0
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const skip = () => { while (/\s/.test(source[i] || '') && i < source.length) i++ }
  const group = (): string => {
    skip()
    if (source[i] === '{') { i++; const value = expression(true); if (source[i] === '}') i++; return `<mrow>${value}</mrow>` }
    return atom()
  }
  const expression = (stopAtBrace = false): string => {
    const nodes: Array<{ base: string; sub?: string; sup?: string }> = []
    while (i < source.length) {
      skip()
      const ch = source[i]
      if (!ch || (stopAtBrace && ch === '}')) break
      if (ch === '^' || ch === '_') {
        i++
        const script = group()
        const last = nodes[nodes.length - 1]
        if (!last) { nodes.push({ base: `<mtext>${ch}</mtext>` }); continue }
        if (ch === '^') last.sup = script; else last.sub = script
        continue
      }
      nodes.push({ base: atom() })
    }
    return nodes.map(n => n.sub && n.sup ? `<msubsup>${n.base}${n.sub}${n.sup}</msubsup>` : n.sub ? `<msub>${n.base}${n.sub}</msub>` : n.sup ? `<msup>${n.base}${n.sup}</msup>` : n.base).join('')
  }
  const atom = (): string => {
    skip()
    const ch = source[i]
    if (!ch) return ''
    if (ch === '{') return group()
    if (ch === '}') return ''
    if (ch === '\\') {
      i++
      const match = source.slice(i).match(/^[A-Za-z]+/)
      if (!match) { const literal = source[i++] || ''; return `<mo>${esc(literal)}</mo>` }
      const command = match[0]; i += command.length
      if (command === 'left' || command === 'right' || command === 'displaystyle' || command === 'limits' || command === 'quad' || command === 'qquad') {
        if (command === 'quad' || command === 'qquad') return '<mspace width="1em" />'
        return ''
      }
      if (command === 'frac' || command === 'dfrac' || command === 'tfrac') return `<mfrac>${group()}${group()}</mfrac>`
      if (command === 'sqrt') {
        skip()
        if (source[i] === '[') { i++; const degree = expressionUntilSquareBracket(); if (source[i] === ']') i++; return `<mroot>${group()}<mrow>${degree}</mrow></mroot>` }
        return `<msqrt>${group()}</msqrt>`
      }
      if (command === 'text' || command === 'textrm' || command === 'textnormal') {
        const content = group().replace(/^<mrow>|<\/mrow>$/g, '').replace(/<[^>]+>/g, '')
        return `<mtext>${esc(content)}</mtext>`
      }
      if (command === 'mathrm' || command === 'mathbf' || command === 'mathit' || command === 'mathbb' || command === 'mathcal') {
        const variant = command === 'mathrm' ? 'normal' : command === 'mathbf' ? 'bold' : command === 'mathbb' ? 'double-struck' : command === 'mathcal' ? 'script' : 'italic'
        return `<mstyle mathvariant="${variant}">${group()}</mstyle>`
      }
      if (command === 'overline' || command === 'bar' || command === 'hat' || command === 'widehat' || command === 'vec' || command === 'overrightarrow') {
        const mark = command === 'vec' || command === 'overrightarrow' ? '→' : command === 'hat' || command === 'widehat' ? 'ˆ' : '¯'
        return `<mover accent="true">${group()}<mo>${mark}</mo></mover>`
      }
      if (command === 'underline') return `<munder accent="true">${group()}<mo>_</mo></munder>`
      if (command === 'begin') {
        const envMarkup = group().replace(/<[^>]+>/g, '').replace(/[{}]/g, '').trim()
        if (['matrix','pmatrix','bmatrix','Bmatrix','vmatrix','Vmatrix'].includes(envMarkup)) {
          const endToken = `\\end{${envMarkup}}`
          const end = source.indexOf(endToken, i)
          if (end >= 0) {
            const matrixSource = source.slice(i, end); i = end + endToken.length
            const rows = matrixSource.split(/\\\\/)
            const table = rows.map(row => `<mtr>${row.split('&').map(cell => `<mtd><mrow>${latexToMathML(cell).replace(/^<math[^>]*>|<\/math>$/g, '')}</mrow></mtd>`).join('')}</mtr>`).join('')
            const matrix = `<mtable columnalign="center">${table}</mtable>`
            if (envMarkup === 'pmatrix') return `<mfenced open="(" close=")">${matrix}</mfenced>`
            if (envMarkup === 'bmatrix') return `<mfenced open="[" close="]">${matrix}</mfenced>`
            if (envMarkup === 'Bmatrix') return `<mfenced open="{" close="}">${matrix}</mfenced>`
            if (envMarkup === 'vmatrix') return `<mfenced open="|" close="|">${matrix}</mfenced>`
            if (envMarkup === 'Vmatrix') return `<mfenced open="‖" close="‖">${matrix}</mfenced>`
            return matrix
          }
        }
        return `<mtext>${esc(`\\begin{${envMarkup}}`)}</mtext>`
      }
      if (command === 'operatorname') return `<mi mathvariant="normal">${esc(group().replace(/<[^>]+>/g, ''))}</mi>`
      if (command === 'sum') return '<mo largeop="true">∑</mo>'
      if (command === 'prod') return '<mo largeop="true">∏</mo>'
      if (command === 'int') return '<mo largeop="true">∫</mo>'
      if (command === 'lim') return '<mi mathvariant="normal">lim</mi>'
      if (command === 'sin' || command === 'cos' || command === 'tan' || command === 'log' || command === 'ln' || command === 'max' || command === 'min') return `<mi mathvariant="normal">${command}</mi>`
      if (greek[command]) return `<mi>${greek[command]}</mi>`
      if (symbols[command]) return `<mo>${symbols[command]}</mo>`
      if (command === ',') return '<mspace width="0.2em" />'
      if (command === ';') return '<mspace width="0.4em" />'
      if (command === '!') return '<mspace width="-0.15em" />'
      return `<mi>${esc(command)}</mi>`
    }
    if (/[0-9]/.test(ch)) {
      const number = source.slice(i).match(/^\d+(?:[.,]\d+)?/)
      if (number) { i += number[0].length; return `<mn>${number[0]}</mn>` }
    }
    if (/[A-Za-z]/.test(ch)) { i++; return `<mi>${ch}</mi>` }
    i++
    if ('=+-*/<>|(),.:;[]'.includes(ch)) return `<mo>${esc(ch)}</mo>`
    if (ch === '&') return '<mo>⁢</mo>'
    return `<mo>${esc(ch)}</mo>`
  }
  const expressionUntilSquareBracket = (): string => {
    const start = i
    let depth = 0
    while (i < source.length) {
      if (source[i] === '{') depth++
      if (source[i] === '}') depth--
      if (source[i] === ']' && depth === 0) break
      i++
    }
    const part = source.slice(start, i)
    return latexToMathML(part).replace(/^<math[^>]*>|<\/math>$/g, '')
  }
  const body = expression()
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline"><mrow>${body || '<mtext></mtext>'}</mrow></math>`
}

export function sanitizeLessonHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // Word frequently stores font-family, font-size and other formatting in CSS classes.
  // Convert the safe declarations to inline styles before removing Word's <style> blocks.
  doc.querySelectorAll('style').forEach(styleNode => {
    const css = styleNode.textContent ?? ''
    for (const match of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
      const selectors = match[1].split(',').map(selector => selector.trim()).filter(Boolean)
      const declarations = match[2]
        .split(';')
        .map(part => part.trim())
        .filter(part => /^(font-family|font-size|font-weight|font-style|text-decoration|color|background-color|text-align|line-height|margin|padding|vertical-align)\s*:/i.test(part))
        .join('; ')
      if (!declarations) continue
      selectors.forEach(selector => {
        try { doc.querySelectorAll<HTMLElement>(selector).forEach(element => { element.style.cssText = `${element.style.cssText}; ${declarations}` }) } catch { /* Ignore unsupported Word selectors. */ }
      })
    }
    styleNode.remove()
  })
  doc.querySelectorAll('script,object,embed,base,meta,link,form,input,button,textarea,select,video,audio,source').forEach(el => el.remove())

  // Render saved LaTeX equation nodes into native MathML for both the editor and student reader.
  doc.querySelectorAll<HTMLElement>('.lesson-equation-source[data-latex]').forEach(equation => {
    const latex = equation.getAttribute('data-latex') || ''
    equation.setAttribute('contenteditable', 'false')
    equation.innerHTML = latexToMathML(latex)
  })

  doc.body.querySelectorAll<HTMLElement>('*').forEach(el => {
    if (!ALLOWED_TAGS.has(el.tagName.toUpperCase())) {
      el.replaceWith(...Array.from(el.childNodes))
      return
    }

    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      const value = attr.value
      if (!ALLOWED_ATTRIBUTES.has(name) || name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name)
        continue
      }
      if (name === 'href' && !isSafeUrl(value)) el.removeAttribute(attr.name)
      if (name === 'src' && !isSafeUrl(value, true)) {
        const isSafeDataImage = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)
        if (!isSafeDataImage) el.removeAttribute(attr.name)
      }
      if (name === 'src' && el.tagName === 'IFRAME') {
        try {
          const iframeUrl = new URL(value, window.location.origin)
          if (iframeUrl.protocol !== 'https:' || iframeUrl.hostname !== 'player.vimeo.com' || !/^\/video\/\d+(?:\?.*)?$/.test(iframeUrl.pathname + iframeUrl.search)) el.removeAttribute(attr.name)
        } catch { el.removeAttribute(attr.name) }
      }
      if (name === 'target' && !['_blank', '_self'].includes(value.toLowerCase())) el.removeAttribute(attr.name)
      if (name === 'style') {
        const safe = value
          .replace(/expression\s*\([^)]*\)/gi, '')
          .replace(/url\s*\([^)]*\)/gi, '')
          .replace(/@import[^;]*;?/gi, '')
          .replace(/behavior\s*:/gi, '')
          .replace(/-moz-binding\s*:/gi, '')
        el.setAttribute('style', safe)
      }
    }
    if (el.tagName === 'A' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer')
  })
  return doc.body.innerHTML
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; extension: string } | null {
  const match = dataUrl.match(/^data:([^;,]+)(?:;base64)?,(.*)$/i)
  if (!match) return null
  const mime = match[1]
  const data = match[2]
  try {
    const bytes = dataUrl.includes(';base64') ? atob(data) : decodeURIComponent(data)
    const buffer = new Uint8Array(bytes.length)
    for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index)
    const extension = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'bin'
    return { blob: new Blob([buffer], { type: mime }), extension }
  } catch {
    return null
  }
}

async function uploadPastedImage(blob: Blob, extension: string, storageFolder: string) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `${storageFolder.replace(/^\/+|\/+$/g, '')}/images/${id}.${extension}`
  const target = storageRef(getFirebaseStorage(), path)
  await uploadBytes(target, blob, { contentType: blob.type })
  return getDownloadURL(target)
}



type WordRunStyle = {
  text: string
  color?: string
  highlight?: string
  fontSize?: string
  fontFamily?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  superscript?: boolean
  subscript?: boolean
}

function wordAttr(element: Element, name: string) {
  return element.getAttribute(`w:${name}`) || element.getAttribute(name) || ''
}

function readWordRunStyles(xml: string): WordRunStyle[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const runs = [...doc.getElementsByTagName('w:r')]
  const styles: WordRunStyle[] = []
  for (const run of runs) {
    const texts = [...run.getElementsByTagName('w:t')].map(node => node.textContent ?? '').join('')
    if (!texts) continue
    const rPr = run.getElementsByTagName('w:rPr')[0]
    const style: WordRunStyle = { text: texts }
    if (rPr) {
      const color = rPr.getElementsByTagName('w:color')[0]
      const highlight = rPr.getElementsByTagName('w:highlight')[0]
      const size = rPr.getElementsByTagName('w:sz')[0]
      const fonts = rPr.getElementsByTagName('w:rFonts')[0]
      const vert = rPr.getElementsByTagName('w:vertAlign')[0]
      if (color) {
        const value = wordAttr(color, 'val')
        if (value && value.toLowerCase() !== 'auto') style.color = /^([0-9a-f]{6}|[0-9a-f]{3})$/i.test(value) ? `#${value}` : undefined
      }
      if (highlight) {
        const value = wordAttr(highlight, 'val')
        const map: Record<string,string> = { yellow:'#fff59d', green:'#c8e6c9', cyan:'#b2ebf2', magenta:'#f8bbd0', blue:'#bbdefb', red:'#ffcdd2', darkYellow:'#ffe082', gray:'#e0e0e0', lightGray:'#eeeeee', black:'#000000', white:'#ffffff' }
        if (value) style.highlight = map[value] || undefined
      }
      if (size) {
        const halfPoints = Number(wordAttr(size, 'val'))
        if (Number.isFinite(halfPoints) && halfPoints > 0) style.fontSize = `${halfPoints / 2}pt`
      }
      if (fonts) style.fontFamily = wordAttr(fonts, 'ascii') || wordAttr(fonts, 'hAnsi') || wordAttr(fonts, 'cs') || undefined
      if (rPr.getElementsByTagName('w:b').length) style.bold = wordAttr(rPr.getElementsByTagName('w:b')[0], 'val') !== '0' && wordAttr(rPr.getElementsByTagName('w:b')[0], 'val') !== 'false'
      if (rPr.getElementsByTagName('w:i').length) style.italic = wordAttr(rPr.getElementsByTagName('w:i')[0], 'val') !== '0' && wordAttr(rPr.getElementsByTagName('w:i')[0], 'val') !== 'false'
      if (rPr.getElementsByTagName('w:u').length) style.underline = wordAttr(rPr.getElementsByTagName('w:u')[0], 'val') !== 'none'
      if (rPr.getElementsByTagName('w:strike').length) style.strike = wordAttr(rPr.getElementsByTagName('w:strike')[0], 'val') !== '0'
      if (vert) {
        const value = wordAttr(vert, 'val')
        style.superscript = value === 'superscript'
        style.subscript = value === 'subscript'
      }
    }
    styles.push(style)
  }
  return styles
}

function applyWordRunStyles(html: string, runStyles: WordRunStyle[]) {
  if (!runStyles.length) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.textContent) textNodes.push(node as Text)
  }

  let runIndex = 0
  let runOffset = 0
  let sourceCursor = 0
  const sourceText = runStyles.map(r => r.text).join('')

  const wrap = (text: string, style: WordRunStyle) => {
    const span = doc.createElement('span')
    span.textContent = text
    const css: string[] = []
    if (style.color) css.push(`color:${style.color}`)
    if (style.highlight) css.push(`background-color:${style.highlight}`)
    if (style.fontSize) css.push(`font-size:${style.fontSize}`)
    if (style.fontFamily) css.push(`font-family:${style.fontFamily.replace(/["']/g, '')}`)
    if (style.bold) css.push('font-weight:700')
    if (style.italic) css.push('font-style:italic')
    const decorations = [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean)
    if (decorations.length) css.push(`text-decoration:${decorations.join(' ')}`)
    if (css.length) span.setAttribute('style', css.join(';'))
    if (style.superscript) span.setAttribute('style', `${span.getAttribute('style') || ''};vertical-align:super;font-size:.75em`)
    if (style.subscript) span.setAttribute('style', `${span.getAttribute('style') || ''};vertical-align:sub;font-size:.75em`)
    return span
  }

  for (const textNode of textNodes) {
    const value = textNode.textContent ?? ''
    if (!value.trim()) continue
    const fragment = doc.createDocumentFragment()
    let local = 0
    while (local < value.length && runIndex < runStyles.length) {
      const run = runStyles[runIndex]
      const remaining = run.text.length - runOffset
      const chunk = value.slice(local, local + remaining)
      if (!chunk) { runIndex += 1; runOffset = 0; continue }
      const expected = run.text.slice(runOffset, runOffset + chunk.length)
      if (expected !== chunk) {
        const next = sourceText.indexOf(value.slice(local), sourceCursor)
        if (next >= 0) sourceCursor = next
        if (sourceText.slice(sourceCursor, sourceCursor + chunk.length) !== chunk) {
          fragment.appendChild(doc.createTextNode(chunk))
          local += chunk.length
          sourceCursor += chunk.length
          continue
        }
      }
      fragment.appendChild(wrap(chunk, run))
      local += chunk.length
      runOffset += chunk.length
      sourceCursor += chunk.length
      if (runOffset >= run.text.length) { runIndex += 1; runOffset = 0 }
    }
    if (local < value.length) fragment.appendChild(doc.createTextNode(value.slice(local)))
    textNode.parentNode?.replaceChild(fragment, textNode)
  }
  return doc.body.innerHTML
}

async function readZipEntry(arrayBuffer: ArrayBuffer, wantedPath: string): Promise<string | null> {
  const bytes = new Uint8Array(arrayBuffer)
  const view = new DataView(arrayBuffer)
  const decoder = new TextDecoder()
  const readU16 = (offset: number) => view.getUint16(offset, true)
  const readU32 = (offset: number) => view.getUint32(offset, true)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (readU32(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  const centralSize = readU32(eocd + 12)
  const centralOffset = readU32(eocd + 16)
  let offset = centralOffset
  const end = centralOffset + centralSize
  while (offset < end && readU32(offset) === 0x02014b50) {
    const method = readU16(offset + 10)
    const compressedSize = readU32(offset + 20)
    const nameLength = readU16(offset + 28)
    const extraLength = readU16(offset + 30)
    const commentLength = readU16(offset + 32)
    const localOffset = readU32(offset + 42)
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength))
    if (name === wantedPath) {
      const localNameLength = readU16(localOffset + 26)
      const localExtraLength = readU16(localOffset + 28)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const compressed = bytes.slice(start, start + compressedSize)
      let data: Uint8Array
      if (method === 0) data = compressed
      else if (method === 8 && 'DecompressionStream' in window) {
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
        data = new Uint8Array(await new Response(stream).arrayBuffer())
      } else return null
      return decoder.decode(data)
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  return null
}

function prepareImportedWordHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // Keep Word's document structure intact. Do not invent captions or wrappers
  // around imported images: a Word import should visually follow the source as
  // closely as the browser/A4 renderer allows.
  doc.querySelectorAll<HTMLImageElement>('img').forEach(image => {
    image.style.maxWidth = '100%'
    image.style.height = image.style.height || 'auto'
    image.removeAttribute('border')
  })

  // Mammoth preserves table structure (including colspan/rowspan), but does not
  // preserve Word's table borders. Give imported tables a stable CAV table style
  // while keeping all cells editable. Existing inline cell styles are retained.
  doc.querySelectorAll<HTMLTableElement>('table').forEach(table => {
    table.classList.add('lesson-word-table')
    table.style.borderCollapse = table.style.borderCollapse || 'collapse'
    table.style.width = table.style.width || '100%'
    table.querySelectorAll<HTMLTableCellElement>('th,td').forEach(cell => {
      cell.style.border = cell.style.border || '1px solid #d9e2eb'
      cell.style.padding = cell.style.padding || '8px 10px'
      cell.style.verticalAlign = cell.style.verticalAlign || 'top'
    })
  })

  // Word page-break markers can arrive as explicit break elements. Keep them
  // as semantic CAV markers instead of flattening them into ordinary text.
  doc.querySelectorAll<HTMLElement>('[style*="page-break-before"], [style*="page-break-after"]').forEach(el => {
    if (/page-break-before\s*:\s*(always|page)/i.test(el.getAttribute('style') || '')) {
      const marker = doc.createElement('div')
      marker.className = 'lesson-word-page-break'
      marker.setAttribute('contenteditable', 'false')
      el.parentNode?.insertBefore(marker, el)
    }
  })

  return doc.body.innerHTML
}

function wrapImagesWithCaptions(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const images = [...doc.body.querySelectorAll('img')]
  images.forEach((image, index) => {
    if (image.closest('figure')) return
    const figure = doc.createElement('figure')
    figure.className = 'lesson-figure'
    const caption = doc.createElement('figcaption')
    const alt = (image.getAttribute('alt') ?? '').trim()
    const label = alt && !/^illustration|image importée/i.test(alt) ? alt : 'Ajouter une légende…'
    caption.textContent = `Figure ${index + 1}. ${label}`
    figure.appendChild(image.cloneNode(true))
    figure.appendChild(caption)
    image.replaceWith(figure)
  })
  return doc.body.innerHTML
}

function renumberFigureCaptions(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('figure').forEach((figure, index) => {
    const caption = figure.querySelector('figcaption')
    if (!caption) return
    const text = (caption.textContent ?? '').trim()
    const withoutNumber = text.replace(/^Figure\s+\d+\.\s*/i, '')
    caption.textContent = `Figure ${index + 1}. ${withoutNumber || 'Ajouter une légende…'}`
  })
}

export function RichLessonEditor({ value, onChange, storageFolder, initialExpanded = false, lessonTitle, onExitExpanded, onSave, isSaving = false, canSave = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [activeRibbonTab, setActiveRibbonTab] = useState<'home' | 'insert' | 'layout' | 'view'>('home')
  const [zoom, setZoom] = useState(100)
  const [pasteStatus, setPasteStatus] = useState('')
  const [pageCount, setPageCount] = useState(1)
  const [isExpanded, setIsExpanded] = useState(initialExpanded)
  const [equationLatex, setEquationLatex] = useState('\\frac{a}{b}')
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'equation'>('properties')
  const [outlineSearch, setOutlineSearch] = useState('')
  const [vimeoDialogOpen, setVimeoDialogOpen] = useState(false)
  const [vimeoUrl, setVimeoUrl] = useState('')
  const [vimeoTitle, setVimeoTitle] = useState('')
  const [vimeoError, setVimeoError] = useState('')
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [imageRect, setImageRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startWidth: number; direction: 'nw' | 'ne' | 'sw' | 'se' } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== sanitizeLessonHtml(value)) ref.current.innerHTML = sanitizeLessonHtml(value)
  }, [value])

  function rememberSelection() {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && ref.current?.contains(selection.anchorNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  function restoreSelection() {
    if (!selectionRef.current) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(selectionRef.current)
  }

  function emit() {
    onChange(sanitizeLessonHtml(ref.current?.innerHTML ?? ''))
    requestAnimationFrame(() => {
      if (ref.current) setPageCount(Math.max(1, Math.ceil(ref.current.scrollHeight / 1122)))
    })
  }

  function refreshImageRect() {
    if (!selectedImage || !ref.current || !containerRef.current || !ref.current.contains(selectedImage)) {
      setImageRect(null)
      return
    }
    const imageBox = selectedImage.getBoundingClientRect()
    const containerBox = containerRef.current.getBoundingClientRect()
    setImageRect({ left: imageBox.left - containerBox.left, top: imageBox.top - containerBox.top, width: imageBox.width, height: imageBox.height })
  }

  // The toolbar is pinned with CSS `position: sticky`. The only JavaScript involved is
  // measuring the sticky application header so the toolbar docks right below it.
  useEffect(() => {
    const editor = containerRef.current
    if (!editor) return
    const topbar = document.querySelector<HTMLElement>('.topbar')
    const syncOffset = () => {
      const position = topbar ? window.getComputedStyle(topbar).position : ''
      const offset = topbar && (position === 'sticky' || position === 'fixed') ? Math.round(topbar.getBoundingClientRect().height) : 0
      editor.style.setProperty('--lesson-toolbar-top', `${offset}px`)
    }
    syncOffset()
    window.addEventListener('resize', syncOffset)
    const observer = topbar ? new ResizeObserver(syncOffset) : null
    if (topbar && observer) observer.observe(topbar)
    return () => {
      window.removeEventListener('resize', syncOffset)
      observer?.disconnect()
    }
  }, [])

  useEffect(() => {
    const updatePages = () => {
      if (!ref.current) return
      setPageCount(Math.max(1, Math.ceil(ref.current.scrollHeight / 1122)))
    }
    updatePages()
    const observer = new ResizeObserver(updatePages)
    if (ref.current) observer.observe(ref.current)
    refreshImageRect()
    const handle = () => refreshImageRect()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
      observer.disconnect()
    }
  }, [selectedImage, value])

  // Pressing a toolbar button must not move focus away from the editor or collapse the selection.
  function keepEditorSelection(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('select')) return
    event.preventDefault()
  }

  function command(cmd: string, arg?: string) {
    ref.current?.focus({ preventScroll: true })
    restoreSelection()
    document.execCommand(cmd, false, arg)
    emit()
    rememberSelection()
  }

  function applyInlineStyle(property: 'fontFamily' | 'fontSize' | 'color' | 'backgroundColor', value: string) {
    ref.current?.focus({ preventScroll: true })
    restoreSelection()
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setPasteStatus('Sélectionnez d’abord le texte à mettre en forme.')
      return
    }
    const range = selection.getRangeAt(0)
    const span = document.createElement('span')
    span.style[property] = value
    try {
      span.appendChild(range.extractContents())
      range.insertNode(span)
      selection.removeAllRanges()
      const nextRange = document.createRange()
      nextRange.selectNodeContents(span)
      selection.addRange(nextRange)
      selectionRef.current = nextRange.cloneRange()
      emit()
    } catch {
      setPasteStatus('Impossible d’appliquer ce format à la sélection.')
    }
  }

  function insertEquation() {
    const latex = equationLatex.trim()
    if (!latex) return
    ref.current?.focus({ preventScroll: true })
    restoreSelection()
    const escaped = latex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const html = `<span class="lesson-equation-source" data-latex="${escaped}" contenteditable="false">${latexToMathML(latex)}</span>&nbsp;`
    document.execCommand('insertHTML', false, sanitizeLessonHtml(html))
    emit()
    setPasteStatus('')
  }

  function insertPageBreak() {
    ref.current?.focus({ preventScroll: true })
    restoreSelection()
    const marker = '<div class="lesson-word-page-break" contenteditable="false" data-page-break="true"><span>Saut de page</span></div><p class="lesson-page-break-continuation"><br></p>'
    document.execCommand('insertHTML', false, marker)
    requestAnimationFrame(() => {
      const editor = ref.current
      const breaks = editor?.querySelectorAll<HTMLElement>('.lesson-word-page-break')
      const pageBreak = breaks?.item((breaks.length || 1) - 1)
      if (editor && pageBreak) {
        const editorRect = editor.getBoundingClientRect()
        const top = pageBreak.getBoundingClientRect().top - editorRect.top + editor.scrollTop
        const pageHeight = 1122 // A4 height at 96 CSS px/in, used by the visible page guides.
        const contentInset = 46
        const nextPageContentTop = (Math.floor(Math.max(0, top - contentInset) / pageHeight) + 1) * pageHeight + contentInset
        pageBreak.style.height = `${Math.max(48, nextPageContentTop - top)}px`
        pageBreak.setAttribute('contenteditable', 'false')
      }
      emit()
      setPasteStatus('')
    })
  }

  function insertTable() {
    const rows = Math.max(1, Math.min(8, Number(window.prompt('Nombre de lignes', '3')) || 3))
    const cols = Math.max(1, Math.min(8, Number(window.prompt('Nombre de colonnes', '3')) || 3))
    const html = `<table class="lesson-word-table"><tbody>${Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => '<td><p>&nbsp;</p></td>').join('')}</tr>`).join('')}</tbody></table><p><br></p>`
    ref.current?.focus({ preventScroll: true })
    restoreSelection()
    document.execCommand('insertHTML', false, sanitizeLessonHtml(html))
    emit()
  }

  function selectImage(image: HTMLImageElement) {
    setSelectedImage(image)
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNode(image)
    selection?.removeAllRanges()
    selection?.addRange(range)
    selectionRef.current = range.cloneRange()
    requestAnimationFrame(refreshImageRect)
  }

  function updateSelectedImage(mutator: (image: HTMLImageElement) => void) {
    if (!selectedImage || !ref.current?.contains(selectedImage)) return
    mutator(selectedImage)
    emit()
    requestAnimationFrame(refreshImageRect)
  }

  function setImageWidth(width: string) {
    updateSelectedImage(image => {
      image.style.width = width
      image.style.height = 'auto'
      image.removeAttribute('height')
    })
  }

  function setImageAlignment(alignment: 'left' | 'center' | 'right') {
    updateSelectedImage(image => {
      const parent = image.parentElement
      if (parent && ['P', 'DIV'].includes(parent.tagName)) {
        parent.style.textAlign = alignment
      } else {
        image.style.display = 'block'
        image.style.marginLeft = alignment === 'left' ? '0' : 'auto'
        image.style.marginRight = alignment === 'right' ? '0' : 'auto'
      }
    })
  }

  function removeSelectedImage() {
    const figure = selectedImage?.closest('figure')
    if (figure) figure.remove()
    else selectedImage?.remove()
    setSelectedImage(null)
    setImageRect(null)
    if (ref.current) renumberFigureCaptions(ref.current)
    emit()
  }

  async function insertImageFile(file: File) {
    if (!storageFolder) {
      setPasteStatus('Le stockage des images n’est pas configuré.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setPasteStatus('Veuillez sélectionner une image.')
      return
    }
    setPasteStatus('Importation de l’image…')
    try {
      restoreSelection()
      const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || file.name.split('.').pop() || 'bin'
      const url = await uploadPastedImage(file, extension, storageFolder)
      ref.current?.focus()
      restoreSelection()
      document.execCommand('insertHTML', false, wrapImagesWithCaptions(`<p><img src="${url}" alt="Illustration" style="max-width:100%;height:auto;width:100%;"></p>`))
      if (ref.current) renumberFigureCaptions(ref.current)
      emit()
      setPasteStatus('Image ajoutée. Cliquez dessus pour la redimensionner ou la déplacer.')
    } catch (error) {
      console.error(error)
      setPasteStatus('Impossible d’importer cette image.')
    }
  }

  async function pasteFromWord(e: ClipboardEvent<HTMLDivElement>) {
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    const imageFiles = [...e.clipboardData.items]
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((file): file is File => Boolean(file))

    if (!html && imageFiles.length === 0) return
    e.preventDefault()

    const selection = window.getSelection()
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
    setPasteStatus('Importation de la mise en forme et des images…')

    try {
      let pastedHtml = html
      if (pastedHtml) {
        const parsed = new DOMParser().parseFromString(pastedHtml, 'text/html')
        const images = [...parsed.images]
        for (const image of images) {
          const source = image.getAttribute('src') ?? ''
          const decoded = dataUrlToBlob(source)
          if (!decoded || !storageFolder) continue
          image.setAttribute('src', await uploadPastedImage(decoded.blob, decoded.extension, storageFolder))
        }
        pastedHtml = parsed.body.innerHTML
      }

      if (imageFiles.length && storageFolder) {
        const urls = await Promise.all(imageFiles.map(file => uploadPastedImage(file, file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'bin', storageFolder)))
        pastedHtml += urls.map(url => `<p><img src="${url}" alt="Image importée depuis Word"></p>`).join('')
      }

      const safe = sanitizeLessonHtml(prepareImportedWordHtml(pastedHtml || text))
      ref.current?.focus()
      if (range) {
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      document.execCommand('insertHTML', false, safe)
      if (ref.current) renumberFigureCaptions(ref.current)
      onChange(sanitizeLessonHtml(ref.current?.innerHTML ?? ''))
      setPasteStatus('Contenu Word importé avec succès.')
    } catch (error) {
      console.error(error)
      const safeText = sanitizeLessonHtml(text)
      ref.current?.focus()
      document.execCommand('insertText', false, safeText)
      onChange(sanitizeLessonHtml(ref.current?.innerHTML ?? ''))
      setPasteStatus('Le texte a été importé, mais une ou plusieurs images n’ont pas pu être importées.')
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  async function importDocx(file: File) {
    setPasteStatus('Importation du document Word…')
    try {
      const arrayBuffer = await file.arrayBuffer()
      // Mammoth is a relatively large DOCX parser; load it only when an editor
      // actually imports a Word document, not during ordinary page startup.
      const { default: mammoth } = await import('mammoth/mammoth.browser')
      const result = await mammoth.convertToHtml({ arrayBuffer }, {
        convertImage: mammoth.images.imgElement((async (image: any) => {
          // Read as base64 first. This is the most reliable browser path for DOCX
          // embedded images and guarantees Mammoth receives a real image source.
          const base64 = await image.read('base64')
          const dataUrl = `data:${image.contentType};base64,${base64}`
          const extension = image.contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin'

          // CAV normally persists the image in Firebase Storage. If Storage is
          // temporarily unavailable, keep the data URL so the image remains
          // visible during the import instead of silently disappearing.
          try {
            if (storageFolder) {
              const response = await fetch(dataUrl)
              const blob = await response.blob()
              return { src: await uploadPastedImage(blob, extension, storageFolder) }
            }
          } catch (uploadError) {
            console.warn('Word image upload failed; keeping the inline image.', uploadError)
          }

          return { src: dataUrl }
        }) as any) as any
      })
      const wordXml = await readZipEntry(arrayBuffer, 'word/document.xml')
      const runStyles = wordXml ? readWordRunStyles(wordXml) : []
      const styled = applyWordRunStyles(result.value, runStyles)
      const prepared = prepareImportedWordHtml(styled)
      const imported = sanitizeLessonHtml(prepared)
      if (!imported.trim()) throw new Error('Document vide')
      onChange(imported)
      if (ref.current) { ref.current.innerHTML = imported; renumberFigureCaptions(ref.current) }
      setMode('edit')
      const importWarnings = Array.isArray((result as unknown as { messages?: unknown[] }).messages) ? (result as unknown as { messages?: unknown[] }).messages?.length ?? 0 : 0
      const wordEquationCount = wordXml ? (wordXml.match(/<m:oMath(?:Para)?\b/g) || []).length : 0
      const warningParts = []
      if (importWarnings) warningParts.push(`${importWarnings} avertissement(s) de conversion`)
      if (wordEquationCount) warningParts.push(`${wordEquationCount} structure(s) d’équation Word détectée(s), conversion mathématique non garantie`)
      setPasteStatus(warningParts.length ? `Document importé avec ${warningParts.join(' · ')}. Vérifiez le résultat et conservez le fichier Word original.` : 'Document Word importé. Vérifiez l’aperçu et conservez le fichier source original.')
    } catch (error) {
      console.error(error)
      setPasteStatus('Impossible d’importer ce document Word.')
    }
  }

  function extractVimeoEmbedUrl(rawUrl: string) {
    const value = rawUrl.trim()
    if (!value) return null
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:') return null
      if (url.hostname === 'player.vimeo.com') {
        const match = url.pathname.match(/^\/video\/(\d+)$/)
        return match ? `https://player.vimeo.com/video/${match[1]}${url.search}` : null
      }
      if (url.hostname === 'vimeo.com' || url.hostname === 'www.vimeo.com') {
        const match = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/)
        return match ? `https://player.vimeo.com/video/${match[1]}${url.search}` : null
      }
      return null
    } catch { return null }
  }

  function openVimeoDialog() {
    rememberSelection()
    setVimeoUrl('')
    setVimeoTitle('')
    setVimeoError('')
    setVimeoDialogOpen(true)
  }

  function insertVimeoVideo() {
    const embedUrl = extractVimeoEmbedUrl(vimeoUrl)
    if (!embedUrl) {
      setVimeoError('URL Vimeo invalide. Utilisez par exemple https://vimeo.com/123456789')
      return
    }
    const title = vimeoTitle.trim() || 'Vidéo de la leçon'
    restoreSelection()
    ref.current?.focus()
    const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;')
    const playerUrl = new URL(embedUrl)
    // Keep Vimeo's required privacy/hash parameters intact, while presenting a cleaner CAV player.
    // Vimeo may override some of these options from the video's own embed settings/plan.
    playerUrl.searchParams.set('title', '0')
    playerUrl.searchParams.set('byline', '0')
    playerUrl.searchParams.set('portrait', '0')
    playerUrl.searchParams.set('badge', '0')
    playerUrl.searchParams.set('vimeo_logo', '0')
    playerUrl.searchParams.set('controls', '1')
    playerUrl.searchParams.set('fullscreen', '1')
    playerUrl.searchParams.set('pip', '1')
    playerUrl.searchParams.set('playsinline', '1')
    const html = `<figure class=\"lesson-video\" contenteditable=\"false\"><div class=\"lesson-video-frame\"><iframe src=\"${playerUrl.toString()}\" title=\"${safeTitle}\" loading=\"lazy\" frameborder=\"0\" allow=\"autoplay; fullscreen; picture-in-picture; clipboard-write\" allowfullscreen></iframe></div><figcaption>${safeTitle}</figcaption></figure><p><br></p>`
    document.execCommand('insertHTML', false, sanitizeLessonHtml(html))
    emit()
    setVimeoDialogOpen(false)
    setPasteStatus('Vidéo Vimeo ajoutée à la leçon.')
  }

  function insertMediaBlock() {
    const url = window.prompt('URL du document')
    if (!url) return
    ref.current?.focus()
    restoreSelection()
    const html = `<p><a href=\"${url}\">Ouvrir le document</a></p>`
    document.execCommand('insertHTML', false, sanitizeLessonHtml(html))
    emit()
  }

  function startImageResize(event: ReactPointerEvent<HTMLButtonElement>, direction: 'nw' | 'ne' | 'sw' | 'se') {
    if (!selectedImage) return
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = { startX: event.clientX, startWidth: selectedImage.getBoundingClientRect().width, direction }
    const onMove = (move: PointerEvent) => {
      const state = resizeRef.current
      if (!state || !selectedImage) return
      const sign = state.direction.endsWith('e') ? 1 : -1
      const nextWidth = Math.max(80, state.startWidth + (move.clientX - state.startX) * sign)
      selectedImage.style.width = `${nextWidth}px`
      selectedImage.style.height = 'auto'
      refreshImageRect()
    }
    const onUp = () => {
      resizeRef.current = null
      emit()
      refreshImageRect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function handleEditorClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (target instanceof HTMLImageElement) selectImage(target)
    else setSelectedImage(null)
    rememberSelection()
  }

  const handleEditorMouseUp = () => rememberSelection()
  const handleEditorKeyUp = () => rememberSelection()

  const handleImageInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (file) await insertImageFile(file)
  }

  return <div ref={containerRef} className={isExpanded ? "lesson-editor-pro lesson-editor-expanded" : "lesson-editor-pro"}>
    <div className="lesson-editor-header lesson-editor-header-minimal">
      <div className="lesson-editor-page-status">
        {isExpanded && <div className="lesson-editor-workspace-title"><span className="lesson-editor-brand-mark" aria-hidden="true">C</span><div><strong>{lessonTitle || 'Éditeur de leçon'}</strong><span>Édition du contenu · Format A4</span></div></div>}
        {!isExpanded && <strong>Format A4</strong>}
        <span>{pageCount} page{pageCount > 1 ? 's' : ''}</span>
      </div>
      <div className="lesson-editor-source">
        <input ref={fileInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={e => { const file=e.target.files?.[0]; if(file) void importDocx(file); e.currentTarget.value='' }} />
        <button type="button" className="lesson-import-button" onClick={() => fileInputRef.current?.click()}>📄 Importer un document Word</button>
        {isExpanded && onSave && <button type="button" className="lesson-workspace-save" disabled={isSaving || !canSave} onClick={() => void onSave()}>{isSaving ? 'Enregistrement…' : 'Enregistrer'}</button>}
        <button type="button" className="lesson-expand-button" onClick={() => { if (isExpanded && onExitExpanded) onExitExpanded(); else setIsExpanded(value => !value) }} aria-pressed={isExpanded} title={isExpanded ? "Quitter l’éditeur" : "Agrandir l’éditeur"}>{isExpanded && onExitExpanded ? '← Quitter l’éditeur' : isExpanded ? '↙ Réduire' : '⛶ Plein écran'}</button>
      </div>
    </div>


    <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={handleImageInput} />

    {selectedImage && imageRect && mode === 'edit' && (
      <div className="lesson-image-selection" style={{ left: imageRect.left, top: imageRect.top, width: imageRect.width, height: imageRect.height }} aria-hidden="true">
        {(['nw', 'ne', 'sw', 'se'] as const).map(direction => (
          <button key={direction} type="button" className={`lesson-image-handle handle-${direction}`} aria-label={`Redimensionner ${direction}`} onPointerDown={event => startImageResize(event, direction)} />
        ))}
      </div>
    )}

    <div className="lesson-ribbon-tabs" role="tablist" aria-label="Onglets de l’éditeur" onMouseDown={keepEditorSelection}>
      <button type="button" role="tab" aria-selected={activeRibbonTab === 'home'} className={activeRibbonTab === 'home' ? 'active' : ''} onClick={() => setActiveRibbonTab('home')}>Accueil</button>
      <button type="button" role="tab" aria-selected={activeRibbonTab === 'insert'} className={activeRibbonTab === 'insert' ? 'active' : ''} onClick={() => setActiveRibbonTab('insert')}>Insérer</button>
      <button type="button" role="tab" aria-selected={activeRibbonTab === 'layout'} className={activeRibbonTab === 'layout' ? 'active' : ''} onClick={() => setActiveRibbonTab('layout')}>Mise en page</button>
      <button type="button" role="tab" aria-selected={activeRibbonTab === 'view'} className={activeRibbonTab === 'view' ? 'active' : ''} onClick={() => setActiveRibbonTab('view')}>Affichage</button>
      <span className="ribbon-saved">● Brouillon local de l’éditeur</span>
    </div>
    {activeRibbonTab === 'home' && <div className="lesson-editor-toolbar" role="toolbar" aria-label="Outils de mise en forme" onMouseDown={keepEditorSelection}>
      <div className="ribbon-group ribbon-fonts"><label className="sr-only" htmlFor="lesson-font-family">Police</label><select id="lesson-font-family" defaultValue="Times New Roman" onChange={e => applyInlineStyle('fontFamily', e.target.value)} aria-label="Police"><option>Times New Roman</option><option>Arial</option><option>Calibri</option><option>Georgia</option><option>Verdana</option><option>Courier New</option></select><label className="sr-only" htmlFor="lesson-font-size">Taille</label><select id="lesson-font-size" defaultValue="12pt" onChange={e => applyInlineStyle('fontSize', e.target.value)} aria-label="Taille de police"><option>8pt</option><option>9pt</option><option>10pt</option><option>11pt</option><option>12pt</option><option>14pt</option><option>16pt</option><option>18pt</option><option>20pt</option><option>24pt</option><option>28pt</option><option>36pt</option><option>48pt</option></select></div>
      <div className="ribbon-group"><button type="button" onClick={() => command('bold')} title="Gras"><strong>B</strong></button><button type="button" onClick={() => command('italic')} title="Italique"><em>I</em></button><button type="button" onClick={() => command('underline')} title="Souligné"><u>U</u></button><button type="button" onClick={() => command('strikeThrough')} title="Barré"><s>S</s></button><button type="button" onClick={() => command('subscript')} title="Indice">x₂</button><button type="button" onClick={() => command('superscript')} title="Exposant">x²</button><label className="ribbon-color" title="Couleur du texte">A<input type="color" defaultValue="#173f65" aria-label="Couleur du texte" onChange={e => applyInlineStyle('color', e.target.value)} /></label><label className="ribbon-color highlight-color" title="Surlignage">▰<input type="color" defaultValue="#fff176" aria-label="Surlignage" onChange={e => applyInlineStyle('backgroundColor', e.target.value)} /></label></div>
      <div className="ribbon-group"><select defaultValue="p" onChange={e => command('formatBlock', e.target.value)} aria-label="Style de paragraphe"><option value="p">Normal</option><option value="h1">Titre 1</option><option value="h2">Titre 2</option><option value="h3">Titre 3</option><option value="blockquote">Citation</option></select><button type="button" onClick={() => command('insertUnorderedList')} title="Liste à puces">• Liste</button><button type="button" onClick={() => command('insertOrderedList')} title="Liste numérotée">1. Liste</button><button type="button" onClick={() => command('justifyLeft')} title="Aligner à gauche">☰</button><button type="button" onClick={() => command('justifyCenter')} title="Centrer">≡</button><button type="button" onClick={() => command('justifyRight')} title="Aligner à droite">☷</button></div>
      <div className="ribbon-group ribbon-insert"><button type="button" onClick={insertTable} title="Insérer un tableau">▦ Tableau</button><button type="button" onClick={() => { rememberSelection(); imageInputRef.current?.click() }}>▧ Image</button><button type="button" onClick={openVimeoDialog}>▶ Vidéo</button><button type="button" onClick={() => { const url = window.prompt('URL du lien'); if (url) command('createLink', url) }}>↗ Lien</button><button type="button" onClick={() => { setRightPanelTab('equation'); setPasteStatus('') }}>π Équation</button><button type="button" onClick={() => command('removeFormat')}>Effacer</button></div>
      <button type="button" className="toolbar-preview internal-preview" onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}>{mode === 'edit' ? '◉ Aperçu étudiant' : '← Modifier'}</button>
    </div>}
    {activeRibbonTab === 'insert' && <div className="lesson-editor-toolbar lesson-insert-ribbon" role="toolbar" aria-label="Outils d’insertion" onMouseDown={keepEditorSelection}>
      <div className="ribbon-group ribbon-insert">
        <button type="button" onClick={insertTable} title="Créer un tableau dans la leçon">▦ Tableau</button>
        <button type="button" onClick={() => { rememberSelection(); imageInputRef.current?.click() }} title="Choisir une image sur votre ordinateur">▧ Image depuis l’ordinateur</button>
        <button type="button" onClick={openVimeoDialog} title="Insérer une vidéo">▶ Vidéo</button>
        <button type="button" onClick={() => { rememberSelection(); const url = window.prompt('Adresse du lien (URL)'); if (url) command('createLink', url) }}>↗ Lien</button>
        <button type="button" onClick={() => { setRightPanelTab('equation'); setPasteStatus('') }}>π Équation</button>
        <button type="button" onClick={() => { rememberSelection(); const symbol = window.prompt('Symbole à insérer', '∞'); if (symbol) command('insertText', symbol) }}>Ω Symbole</button>
        <button type="button" onClick={insertPageBreak} title="Insérer un saut de page explicite">↵ Saut de page</button>
      </div>
    </div>}
    {activeRibbonTab === 'layout' && <div className="lesson-editor-toolbar lesson-layout-ribbon" role="toolbar" aria-label="Mise en page">
      <div className="ribbon-group layout-paper-group"><div className="layout-control-label">Format du papier</div><span className="layout-value">A4 <span>210 × 297 mm</span></span></div>
      <div className="ribbon-group layout-margins-group"><div className="layout-control-label">Marges</div><span className="layout-value layout-margin-value">Standard <span>20 mm</span></span></div>
      <div className="ribbon-group layout-page-break-group"><button type="button" onClick={insertPageBreak}><span aria-hidden="true">↵</span> Insérer un saut de page</button></div>
    </div>}
    {activeRibbonTab === 'view' && <div className="lesson-editor-toolbar lesson-view-ribbon" role="toolbar" aria-label="Affichage">
      <div className="ribbon-group"><strong>Zoom</strong><button type="button" onClick={() => setZoom(v => Math.max(50, v - 10))}>−</button><span>{zoom}%</span><button type="button" onClick={() => setZoom(v => Math.min(150, v + 10))}>+</button><button type="button" onClick={() => setZoom(100)}>Réinitialiser</button></div>
      <div className="ribbon-group"><button type="button" onClick={() => setRightPanelTab(v => v === 'properties' ? 'equation' : 'properties')}>Basculer le panneau de droite</button></div>
      <span className="ribbon-help">Le zoom modifie l’échelle visuelle du document.</span>
    </div>}

    {selectedImage && mode === 'edit' && (
      <div className="lesson-image-tools" role="toolbar" aria-label="Outils de l’image">
        <strong>Image</strong><span>Taille</span>
        <button type="button" onClick={() => setImageWidth('25%')}>25%</button><button type="button" onClick={() => setImageWidth('50%')}>50%</button><button type="button" onClick={() => setImageWidth('75%')}>75%</button><button type="button" onClick={() => setImageWidth('100%')}>Pleine largeur</button>
        <span>Position</span><button type="button" onClick={() => setImageAlignment('left')}>Gauche</button><button type="button" onClick={() => setImageAlignment('center')}>Centrer</button><button type="button" onClick={() => setImageAlignment('right')}>Droite</button>
        <button type="button" className="image-delete-button" onClick={removeSelectedImage}>Supprimer</button>
      </div>
    )}

    <div className="lesson-editor-workspace">
      <aside className="lesson-outline-panel" aria-label="Plan de la leçon"><div className="lesson-panel-heading"><strong>Plan de la leçon</strong><span>{pageCount} p.</span></div><input value={outlineSearch} onChange={e => setOutlineSearch(e.target.value)} placeholder="Rechercher une section…" aria-label="Rechercher une section" /><nav>{(() => { const doc = new DOMParser().parseFromString(value || '', 'text/html'); const headings = [...doc.body.querySelectorAll('h1,h2,h3')].map((h, i) => ({ text: (h.textContent || '').trim() || `Section ${i + 1}`, level: Number(h.tagName.slice(1)), index: i })); const filtered = headings.filter(h => h.text.toLowerCase().includes(outlineSearch.toLowerCase())); return filtered.length ? filtered.map(h => <button key={`${h.index}-${h.text}`} type="button" className={`outline-item outline-level-${h.level}`} onClick={() => { const editor = ref.current; const target = editor?.querySelectorAll('h1,h2,h3').item(h.index); target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (target && editor) { const range = document.createRange(); range.selectNodeContents(target); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); rememberSelection(); editor.focus(); } }}>{h.level === 1 ? '▾ ' : '· '}{h.text}</button>) : <p className="outline-empty">Ajoutez des titres pour créer le plan automatiquement.</p> })()}</nav></aside>
      <main className="lesson-editor-canvas" style={{ "--lesson-zoom": zoom / 100 } as CSSProperties}>{mode === 'edit' ? <div ref={ref} className="lesson-editor-surface lesson-document a4-document" contentEditable suppressContentEditableWarning onInput={() => { setSelectedImage(null); emit() }} onPaste={(event) => void pasteFromWord(event)} onClick={handleEditorClick} onMouseUp={handleEditorMouseUp} onKeyUp={handleEditorKeyUp} onKeyDown={(event) => { if ((event.key === 'Backspace' || event.key === 'Delete') && selectedImage) { event.preventDefault(); removeSelectedImage(); } }} data-placeholder="Commencez à écrire votre cours…" /> : <div className="lesson-preview lesson-editor-surface lesson-document a4-document" dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(value) }} />}</main>
      <aside className="lesson-properties-panel" aria-label="Propriétés de la leçon"><div className="lesson-properties-tabs"><button type="button" className={rightPanelTab === 'properties' ? 'active' : ''} onClick={() => setRightPanelTab('properties')}>Propriétés</button><button type="button" className={rightPanelTab === 'equation' ? 'active' : ''} onClick={() => setRightPanelTab('equation')}>Équation</button></div>{rightPanelTab === 'properties' ? <div className="lesson-properties-body"><strong>Texte</strong><label>Police<select defaultValue="Times New Roman" onChange={e => applyInlineStyle('fontFamily', e.target.value)}><option>Times New Roman</option><option>Arial</option><option>Calibri</option><option>Georgia</option><option>Verdana</option></select></label><label>Taille<select defaultValue="12pt" onChange={e => applyInlineStyle('fontSize', e.target.value)}>{['8pt','9pt','10pt','11pt','12pt','14pt','16pt','18pt','20pt','24pt','28pt','36pt','48pt'].map(size => <option key={size}>{size}</option>)}</select></label><label>Couleur du texte<input type="color" defaultValue="#173f65" onChange={e => applyInlineStyle('color', e.target.value)} /></label><label>Surlignage<input type="color" defaultValue="#fff176" onChange={e => applyInlineStyle('backgroundColor', e.target.value)} /></label><div className="lesson-property-buttons"><button type="button" onClick={() => command('bold')}><b>B</b></button><button type="button" onClick={() => command('italic')}><i>I</i></button><button type="button" onClick={() => command('underline')}><u>U</u></button><button type="button" onClick={() => command('subscript')}>x₂</button><button type="button" onClick={() => command('superscript')}>x²</button></div><strong>Paragraphe</strong><div className="lesson-property-buttons"><button type="button" onClick={() => command('justifyLeft')}>Gauche</button><button type="button" onClick={() => command('justifyCenter')}>Centre</button><button type="button" onClick={() => command('justifyRight')}>Droite</button></div><p className="lesson-properties-note">Les réglages s’appliquent au texte sélectionné. Les marges du document suivent le format A4.</p></div> : <div className="lesson-properties-body lesson-equation-panel"><strong>Éditeur d’équation</strong><div className="equation-template-grid">{[{label:'Fraction',latex:'\\frac{a}{b}'},{label:'Racine',latex:'\\sqrt{x}'},{label:'Puissance',latex:'x^{2}'},{label:'Somme',latex:'\\sum_{i=1}^{n} x_i'},{label:'Intégrale',latex:'\\int_a^b f(x)\,dx'},{label:'Matrice',latex:'\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}'}].map(item => <button key={item.label} type="button" onClick={() => setEquationLatex(item.latex)}><span>{item.label === 'Fraction' ? 'a⁄b' : item.label === 'Racine' ? '√x' : item.label === 'Puissance' ? 'x²' : item.label === 'Somme' ? '∑' : item.label === 'Intégrale' ? '∫' : '[a b]'}</span>{item.label}</button>)}</div><label>Code LaTeX<textarea value={equationLatex} onChange={e => setEquationLatex(e.target.value)} rows={4} spellCheck={false} /></label><div className="equation-source-preview" aria-label="Aperçu mathématique" dangerouslySetInnerHTML={{ __html: latexToMathML(equationLatex) }} /><button type="button" className="equation-insert-button" onClick={insertEquation}>Insérer dans la leçon</button></div>}</aside>
    </div>

    <div className="lesson-add-tools">
      <span>Insérer dans le cours</span>
      <button type="button" onClick={() => { rememberSelection(); imageInputRef.current?.click() }}>+ Image depuis l’ordinateur</button>
      <button type="button" onClick={openVimeoDialog}>+ Vidéo Vimeo</button>
      <button type="button" onClick={() => insertMediaBlock()}>+ Document</button>
    </div>
    {pasteStatus && <p className="lesson-editor-status" role="status">{pasteStatus}</p>}

    {vimeoDialogOpen && <div className="lesson-vimeo-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setVimeoDialogOpen(false) }}>
      <div className="lesson-vimeo-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-vimeo-title">
        <div className="lesson-vimeo-modal-head"><div><span className="eyebrow">VIDÉO DANS LA LEÇON</span><h3 id="lesson-vimeo-title">Insérer une vidéo Vimeo</h3></div><button type="button" className="lesson-vimeo-close" onClick={() => setVimeoDialogOpen(false)} aria-label="Fermer">×</button></div>
        <p className="page-description">La vidéo sera intégrée directement dans votre document A4, entre vos textes et vos illustrations.</p>
        <label>URL Vimeo<input autoFocus value={vimeoUrl} onChange={event => { setVimeoUrl(event.target.value); setVimeoError('') }} placeholder="https://vimeo.com/123456789" /></label>
        <label>Titre de la vidéo <span>(facultatif)</span><input value={vimeoTitle} onChange={event => setVimeoTitle(event.target.value)} placeholder="Ex. La Constitution malgache" /></label>
        {vimeoError && <div className="lesson-vimeo-error">{vimeoError}</div>}
        <div className="lesson-vimeo-modal-actions"><button type="button" className="outline" onClick={() => setVimeoDialogOpen(false)}>Annuler</button><button type="button" className="primary" onClick={insertVimeoVideo}>Insérer la vidéo</button></div>
      </div>
    </div>}
  </div>
}
