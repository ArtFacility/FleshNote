// Drawing for the book cover (v2). The cover editor draws its faces with these
// functions and saves the front and spine with the same code, so the bookshelf,
// the export window and the EPUB cover look exactly like the editor.
//
// A face is { bg, bgType, bg2, bgAngle, image, fit, imageOpacity, imageScale,
// imageX, imageY, vignette, layers[] }. Layer positions are fractions of the
// face (x, y = centre of the box, w = width) and size/strokeWidth are fractions
// of the face's shorter side, so a cover keeps its layout across trim sizes and
// spine widths. The spine is laid out lying on its side (long edge horizontal)
// and turned 90° clockwise when drawn on the book.

export const COVER_FONTS = {
  serif: { label: 'Crimson Pro', family: '"Crimson Pro", Georgia, serif', bold: 500, boldSupport: true, italicSupport: true },
  sans: { label: 'Inter', family: 'Inter, Arial, sans-serif', bold: 700, boldSupport: true, italicSupport: true },
  mono: { label: 'JetBrains Mono', family: '"JetBrains Mono", monospace', bold: 700, boldSupport: true, italicSupport: true },
  runes: { label: 'Rovás (Old Hungarian)', family: '"Noto Sans Old Hungarian", NotoOldHungarian', bold: 400, boldSupport: false, italicSupport: false },
}

export const FONT_PACK_FONTS = {
  cinzel: { id: 'cinzel', label: 'Cinzel', category: 'Fantasy / Classical', family: '"fn-pack-cinzel", "Crimson Pro", serif', bold: 700, boldSupport: true, italicSupport: false },
  cormorant: { id: 'cormorant', label: 'Cormorant Garamond', category: 'Literary Serif', family: '"fn-pack-cormorant", "Crimson Pro", serif', bold: 700, boldSupport: true, italicSupport: true },
  playfair: { id: 'playfair', label: 'Playfair Display', category: 'Editorial / Romance', family: '"fn-pack-playfair", "Crimson Pro", serif', bold: 700, boldSupport: true, italicSupport: true },
  unifraktur: { id: 'unifraktur', label: 'UnifrakturMaguntia', category: 'Gothic / Dark', family: '"fn-pack-unifraktur", "Crimson Pro", serif', bold: 400, boldSupport: false, italicSupport: false },
  oswald: { id: 'oswald', label: 'Oswald', category: 'Thriller / Condensed', family: '"fn-pack-oswald", Inter, sans-serif', bold: 700, boldSupport: true, italicSupport: false },
  bebas: { id: 'bebas', label: 'Bebas Neue', category: 'Bold Display', family: '"fn-pack-bebas", Inter, sans-serif', bold: 400, boldSupport: false, italicSupport: false },
  caveat: { id: 'caveat', label: 'Caveat', category: 'Handwritten', family: '"fn-pack-caveat", Inter, sans-serif', bold: 700, boldSupport: true, italicSupport: false },
  abril: { id: 'abril', label: 'Abril Fatface', category: 'Modern Fiction', family: '"fn-pack-abril", "Crimson Pro", serif', bold: 400, boldSupport: false, italicSupport: false },
}

export const FACE_NAMES = ['back', 'spine', 'front']
export const MAX_LAYERS = 40

export const SHAPE_DEFS = [
  { id: 'rect', label: 'Rectangle', defaults: { w: 0.6, h: 0.22, fill: '#d4a052', stroke: 'none', strokeWidth: 0.004, radius: 0 } },
  { id: 'double-frame', label: 'Frame', defaults: { w: 0.86, h: 0.9, fill: 'none', stroke: '#f3ead8', strokeWidth: 0.003, radius: 0 } },
  { id: 'line', label: 'Divider', defaults: { w: 0.55, h: 0.03, fill: 'none', stroke: '#f3ead8', strokeWidth: 0.004, lineStyle: 'ornate' } },
  { id: 'circle', label: 'Circle', defaults: { w: 0.35, h: 0.24, fill: '#d4a052', stroke: 'none', strokeWidth: 0.004 } },
  { id: 'diamond', label: 'Diamond', defaults: { w: 0.24, h: 0.22, fill: '#d4a052', stroke: 'none', strokeWidth: 0.004 } },
  { id: 'triangle', label: 'Triangle', defaults: { w: 0.28, h: 0.2, fill: '#d4a052', stroke: 'none', strokeWidth: 0.004 } },
  { id: 'star', label: 'Star', defaults: { w: 0.16, h: 0.11, fill: '#f3ead8', stroke: 'none', strokeWidth: 0.003 } },
  { id: 'crescent', label: 'Crescent', defaults: { w: 0.18, h: 0.13, fill: '#f3ead8', stroke: 'none', strokeWidth: 0.003 } },
  { id: 'corners', label: 'Corners', defaults: { w: 0.86, h: 0.9, fill: 'none', stroke: '#f3ead8', strokeWidth: 0.004 } },
]

export const newId = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0')

export function newText(overrides = {}) {
  return {
    id: newId(),
    type: 'text',
    text: 'Text',
    x: 0.5,
    y: 0.5,
    w: 0.7,
    size: 0.07,
    font: 'serif',
    bold: false,
    italic: false,
    upper: false,
    spacing: 0,
    lineHeight: 1.2,
    align: 'center',
    color: '#f3ead8',
    shadow: 0,
    shadowColor: '#000000',
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    ...overrides,
  }
}

export function newShape(shape = 'rect', overrides = {}) {
  const def = SHAPE_DEFS.find((s) => s.id === shape) || SHAPE_DEFS[0]
  return {
    id: newId(),
    type: 'shape',
    shape: def.id,
    x: 0.5,
    y: 0.5,
    w: 0.5,
    h: 0.25,
    fill: '#d4a052',
    stroke: '#f3ead8',
    strokeWidth: 0.004,
    radius: 0,
    lineStyle: 'solid',
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    ...def.defaults,
    ...overrides,
  }
}

function normalizeFace(raw, fallbackColor = '#2c3d5c') {
  const f = raw && typeof raw === 'object' ? raw : {}
  const rawLayers = Array.isArray(f.layers)
    ? f.layers
    : Array.isArray(f.texts)
      ? f.texts.map((t) => ({ type: 'text', ...t }))
      : []
  const layers = rawLayers.slice(0, MAX_LAYERS).map((item) => (
    item?.type === 'shape' ? newShape(item.shape, item) : newText(item || {})
  ))
  return {
    bg: f.bg || fallbackColor,
    bgType: ['solid', 'linear', 'radial'].includes(f.bgType) ? f.bgType : 'solid',
    bg2: f.bg2 || '#141c2b',
    bgAngle: Number.isFinite(f.bgAngle) ? f.bgAngle : 180,
    image: f.image || null,
    fit: f.fit === 'fit' ? 'fit' : 'fill',
    imageOpacity: Number.isFinite(f.imageOpacity) ? f.imageOpacity : 1,
    imageScale: Number.isFinite(f.imageScale) ? f.imageScale : 1,
    imageX: Number.isFinite(f.imageX) ? f.imageX : 0.5,
    imageY: Number.isFinite(f.imageY) ? f.imageY : 0.5,
    vignette: Number.isFinite(f.vignette) ? f.vignette : 0,
    layers,
  }
}

/** Upgrades any v1 or partial cover document into the v2 shape. */
export function normalizeCover(doc, fallbackColor = '#2c3d5c') {
  if (!doc || typeof doc !== 'object' || !doc.faces) return null
  const fonts = {}
  if (doc.fonts && typeof doc.fonts === 'object') {
    for (const [id, entry] of Object.entries(doc.fonts)) {
      if (entry && typeof entry.path === 'string') {
        fonts[id] = { id, label: String(entry.label || id), path: entry.path }
      }
    }
  }
  return {
    version: 2,
    fonts,
    faces: {
      front: normalizeFace(doc.faces.front, fallbackColor),
      spine: normalizeFace(doc.faces.spine, fallbackColor),
      back: normalizeFace(doc.faces.back, fallbackColor),
    },
    render: {
      front: doc.render?.front || null,
      spine: doc.render?.spine || null,
      back: doc.render?.back || null,
    },
  }
}

/** A first cover: framed title, divider, and author on the front and spine. */
export function defaultCover(title, author, color) {
  const bg = color || '#2c3d5c'
  const face = (layers) => normalizeFace({ bg, layers }, bg)
  return {
    version: 2,
    fonts: {},
    faces: {
      front: face([
        newShape('double-frame', { opacity: 0.45 }),
        newText({ text: title || 'Untitled', y: 0.3, w: 0.78, size: 0.125, lineHeight: 1.05, bold: true }),
        newShape('line', { y: 0.54, w: 0.44, opacity: 0.75, lineStyle: 'ornate' }),
        ...(author ? [newText({ text: author, y: 0.83, w: 0.76, size: 0.048, upper: true, spacing: 0.14 })] : []),
      ]),
      spine: face([
        newText({ text: title || 'Untitled', x: 0.4, w: 0.6, size: 0.42 }),
        ...(author ? [newText({ text: author, x: 0.86, w: 0.24, size: 0.3, upper: true, spacing: 0.08 })] : []),
      ]),
      back: face([
        newShape('double-frame', { opacity: 0.3 }),
      ]),
    },
    render: { front: null, spine: null, back: null },
  }
}

export function resolveFontSpec(fontKey, customFonts = {}) {
  if (COVER_FONTS[fontKey]) return COVER_FONTS[fontKey]
  if (FONT_PACK_FONTS[fontKey]) return FONT_PACK_FONTS[fontKey]
  const custom = customFonts?.[fontKey]
  if (custom) {
    return {
      label: custom.label || fontKey,
      family: `"fn-custom-${fontKey}", "Crimson Pro", serif`,
      bold: 700,
      boldSupport: true,
      italicSupport: true,
      isCustom: true,
      path: custom.path,
    }
  }
  return COVER_FONTS.serif
}

export function fontString(t, px, customFonts = {}) {
  const f = resolveFontSpec(t.font, customFonts)
  const italic = t.italic && f.italicSupport !== false ? 'italic ' : ''
  const weight = t.bold && f.boldSupport !== false ? f.bold : 400
  return `${italic}${weight} ${px}px ${f.family}`
}

const loadedFontCache = new Map()

export function invalidatePackFontCache() {
  for (const key of loadedFontCache.keys()) {
    if (key.startsWith('pack:')) loadedFontCache.delete(key)
  }
}

function decodeBase64Bytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function ensureDynamicFont(fontKey, customEntry, projectPath) {
  const isPack = Boolean(FONT_PACK_FONTS[fontKey])
  const cacheKey = isPack ? `pack:${fontKey}` : `custom:${fontKey}:${customEntry?.path || ''}`
  if (loadedFontCache.has(cacheKey)) return loadedFontCache.get(cacheKey)

  const task = (async () => {
    if (!window.api?.coverReadFont) return false
    const res = await window.api.coverReadFont({
      project_path: projectPath,
      font_id: fontKey,
      path: customEntry?.path || null,
    })
    if (!res?.installed || !res.faces?.length) {
      loadedFontCache.delete(cacheKey)
      return false
    }
    const familyName = isPack ? `fn-pack-${fontKey}` : `fn-custom-${fontKey}`
    await Promise.all(res.faces.map(async (face) => {
      const bytes = decodeBase64Bytes(face.data)
      const ff = new FontFace(familyName, bytes, {
        style: face.style || 'normal',
        weight: String(face.weight || 400),
      })
      const loaded = await ff.load()
      document.fonts.add(loaded)
    }))
    return true
  })().catch((e) => {
    loadedFontCache.delete(cacheKey)
    console.error('cover font could not be loaded:', fontKey, e)
    return false
  })

  loadedFontCache.set(cacheKey, task)
  return task
}

/**
 * Ensures every font the cover uses (built-in, font-pack, or custom) is loaded.
 * Returns { missingPackFonts: string[] } for any pack font not installed locally.
 */
export async function loadCoverFonts(cover, projectPath = '') {
  const customFonts = cover?.fonts || {}
  const usedKeys = new Set(Object.keys(customFonts))
  const wantedCssFonts = new Set()

  for (const face of Object.values(cover?.faces || {})) {
    for (const layer of face.layers || []) {
      if (layer.type !== 'shape') {
        usedKeys.add(layer.font || 'serif')
        wantedCssFonts.add(fontString(layer, 40, customFonts))
      }
    }
  }

  const missingPackFonts = []
  await Promise.all([...usedKeys].map(async (key) => {
    if (FONT_PACK_FONTS[key]) {
      const ok = await ensureDynamicFont(key, null, projectPath)
      if (!ok) missingPackFonts.push(key)
    } else if (customFonts[key]) {
      await ensureDynamicFont(key, customFonts[key], projectPath)
    }
  }))

  await Promise.all([...wantedCssFonts].map((f) => document.fonts.load(f).catch(() => null)))
  return { missingPackFonts }
}

/** Lines and box of a text layer on a face of W x H pixels. */
export function layoutText(ctx, t, W, H, customFonts = {}) {
  const px = Math.max(1, t.size * Math.min(W, H))
  ctx.font = fontString(t, px, customFonts)
  ctx.letterSpacing = `${(t.spacing || 0) * px}px`
  const maxW = Math.max(4, t.w * W)
  const text = t.upper ? (t.text || '').toUpperCase() : (t.text || '')
  const lines = []
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/).filter((s) => s.length)
    let line = ''
    for (const word of words) {
      const next = line + word
      if (line.trim() && ctx.measureText(next.trimEnd()).width > maxW) {
        lines.push(line.trimEnd())
        line = word.trimStart()
      } else {
        line = next
      }
    }
    lines.push(line.trimEnd())
  }
  const lineH = px * (t.lineHeight || 1.2)
  const h = Math.max(lineH, lines.length * lineH)
  return { px, lines, lineH, box: { x: t.x * W - maxW / 2, y: t.y * H - h / 2, w: maxW, h } }
}

/** Bounding box of a shape layer on a face of W x H pixels. */
export function layoutShape(s, W, H) {
  const bw = Math.max(4, s.w * W)
  const bh = s.shape === 'line'
    ? Math.max(12, s.h * H)
    : Math.max(4, s.h * H)
  return { box: { x: s.x * W - bw / 2, y: s.y * H - bh / 2, w: bw, h: bh } }
}

export function layoutLayer(ctx, layer, W, H, customFonts = {}) {
  return layer.type === 'shape' ? layoutShape(layer, W, H) : layoutText(ctx, layer, W, H, customFonts)
}

function hexToRgba(hex, alpha) {
  const clean = (hex || '#000000').replace('#', '')
  const n = parseInt(clean.length === 6 ? clean : '000000', 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawBackground(ctx, face, W, H) {
  const c1 = face.bg || '#2c3d5c'
  const c2 = face.bg2 || '#141c2b'
  if (face.bgType === 'linear') {
    const rad = (((face.bgAngle ?? 180) - 90) * Math.PI) / 180
    const len = Math.abs(W * Math.cos(rad)) / 2 + Math.abs(H * Math.sin(rad)) / 2
    const cx = W / 2
    const cy = H / 2
    const dx = Math.cos(rad) * len
    const dy = Math.sin(rad) * len
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
    grad.addColorStop(0, c1)
    grad.addColorStop(1, c2)
    ctx.fillStyle = grad
  } else if (face.bgType === 'radial') {
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.55)
    grad.addColorStop(0, c1)
    grad.addColorStop(1, c2)
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = c1
  }
  ctx.fillRect(0, 0, W, H)
}

function drawImage(ctx, img, W, H, face) {
  const ir = img.width / img.height
  const fr = W / H
  let w, h
  if ((face.fit === 'fit') === (ir > fr)) { w = W; h = W / ir } else { h = H; w = H * ir }
  const scale = face.imageScale ?? 1
  w *= scale
  h *= scale
  const panX = (0.5 - (face.imageX ?? 0.5)) * Math.max(w * 0.6, W * 0.5)
  const panY = (0.5 - (face.imageY ?? 0.5)) * Math.max(h * 0.6, H * 0.5)
  ctx.save()
  ctx.globalAlpha = face.imageOpacity ?? 1
  ctx.drawImage(img, (W - w) / 2 + panX, (H - h) / 2 + panY, w, h)
  ctx.restore()
}

function drawVignette(ctx, W, H, strength) {
  if (!strength || strength <= 0) return
  const r = Math.hypot(W, H) * 0.65
  const grad = ctx.createRadialGradient(W / 2, H / 2, r * 0.25, W / 2, H / 2, r)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, strength * 0.85)})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
}

function traceRoundedRect(ctx, x, y, w, h, r) {
  const cr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (cr <= 0) {
    ctx.rect(x, y, w, h)
    return
  }
  ctx.moveTo(x + cr, y)
  ctx.arcTo(x + w, y, x + w, y + h, cr)
  ctx.arcTo(x + w, y + h, x, y + h, cr)
  ctx.arcTo(x, y + h, x, y, cr)
  ctx.arcTo(x, y, x + w, y, cr)
  ctx.closePath()
}

function paintPath(ctx, s, sw) {
  if (s.fill && s.fill !== 'none') {
    ctx.fillStyle = s.fill
    ctx.fill()
  }
  if (s.stroke && s.stroke !== 'none' && sw > 0) {
    ctx.strokeStyle = s.stroke
    ctx.lineWidth = sw
    ctx.stroke()
  }
}

function drawShape(ctx, s, W, H) {
  const bw = Math.max(2, s.w * W)
  const bh = Math.max(2, s.h * H)
  const sw = s.stroke && s.stroke !== 'none' && (s.strokeWidth ?? 0.004) > 0
    ? Math.max(0.75, (s.strokeWidth ?? 0.004) * Math.min(W, H))
    : 0
  const hw = bw / 2
  const hh = bh / 2

  ctx.save()
  ctx.translate(s.x * W, s.y * H)
  if (s.rotation) ctx.rotate((s.rotation * Math.PI) / 180)
  ctx.globalAlpha = s.opacity ?? 1
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'butt'

  switch (s.shape) {
    case 'rect': {
      const r = Math.min(bw, bh) * (s.radius || 0)
      traceRoundedRect(ctx, -hw, -hh, bw, bh, r)
      paintPath(ctx, s, sw)
      break
    }
    case 'double-frame': {
      traceRoundedRect(ctx, -hw, -hh, bw, bh, 0)
      paintPath(ctx, s, sw)
      if (s.stroke && s.stroke !== 'none' && sw > 0) {
        const inset = Math.max(sw * 2.6, Math.min(bw, bh) * 0.032)
        if (bw > inset * 2.5 && bh > inset * 2.5) {
          traceRoundedRect(ctx, -hw + inset, -hh + inset, bw - inset * 2, bh - inset * 2, 0)
          ctx.strokeStyle = s.stroke
          ctx.lineWidth = Math.max(0.6, sw * 0.65)
          ctx.stroke()
        }
      }
      break
    }
    case 'circle': {
      ctx.beginPath()
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2)
      paintPath(ctx, s, sw)
      break
    }
    case 'diamond': {
      ctx.beginPath()
      ctx.moveTo(0, -hh)
      ctx.lineTo(hw, 0)
      ctx.lineTo(0, hh)
      ctx.lineTo(-hw, 0)
      ctx.closePath()
      paintPath(ctx, s, sw)
      break
    }
    case 'triangle': {
      ctx.beginPath()
      ctx.moveTo(0, -hh)
      ctx.lineTo(hw, hh)
      ctx.lineTo(-hw, hh)
      ctx.closePath()
      paintPath(ctx, s, sw)
      break
    }
    case 'star': {
      // 4-point celestial star
      const ix = hw * 0.22
      const iy = hh * 0.22
      ctx.beginPath()
      ctx.moveTo(0, -hh)
      ctx.lineTo(ix, -iy)
      ctx.lineTo(hw, 0)
      ctx.lineTo(ix, iy)
      ctx.lineTo(0, hh)
      ctx.lineTo(-ix, iy)
      ctx.lineTo(-hw, 0)
      ctx.lineTo(-ix, -iy)
      ctx.closePath()
      paintPath(ctx, s, sw)
      break
    }
    case 'crescent': {
      const r = Math.min(hw, hh)
      ctx.save()
      ctx.scale(hw / r, hh / r)
      ctx.beginPath()
      ctx.arc(0, 0, r, -Math.PI * 0.42, Math.PI * 0.42, true)
      ctx.arc(r * 0.42, 0, r * 0.8, Math.PI * 0.36, -Math.PI * 0.36, false)
      ctx.closePath()
      paintPath(ctx, s, sw / Math.max(hw / r, hh / r))
      ctx.restore()
      break
    }
    case 'corners': {
      const col = s.stroke && s.stroke !== 'none' ? s.stroke : (s.fill !== 'none' ? s.fill : '#f3ead8')
      const lw = Math.max(1, sw || Math.min(W, H) * 0.004)
      const leg = Math.min(bw, bh) * 0.16
      const inner = leg * 0.42
      ctx.strokeStyle = col
      ctx.lineWidth = lw
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.save()
        ctx.scale(sx, sy)
        ctx.beginPath()
        ctx.moveTo(-hw, -hh + leg)
        ctx.lineTo(-hw, -hh)
        ctx.lineTo(-hw + leg, -hh)
        ctx.moveTo(-hw + lw * 2.2, -hh + inner + lw * 1.4)
        ctx.lineTo(-hw + lw * 2.2, -hh + lw * 2.2)
        ctx.lineTo(-hw + inner + lw * 1.4, -hh + lw * 2.2)
        ctx.stroke()
        ctx.restore()
      }
      break
    }
    case 'line': {
      const col = s.stroke && s.stroke !== 'none' ? s.stroke : (s.fill !== 'none' ? s.fill : '#f3ead8')
      const lw = Math.max(1, sw || Math.min(W, H) * 0.004)
      ctx.strokeStyle = col
      ctx.fillStyle = col
      ctx.lineWidth = lw
      if (s.lineStyle === 'double') {
        const gap = Math.max(1.5, lw * 1.6)
        ctx.beginPath()
        ctx.moveTo(-hw, -gap)
        ctx.lineTo(hw, -gap)
        ctx.moveTo(-hw, gap)
        ctx.lineTo(hw, gap)
        ctx.stroke()
      } else if (s.lineStyle === 'ornate') {
        const pip = Math.max(3.5, lw * 2.4)
        const gap = pip * 2
        if (bw > gap * 2.5) {
          ctx.beginPath()
          ctx.moveTo(-hw, 0)
          ctx.lineTo(-gap, 0)
          ctx.moveTo(gap, 0)
          ctx.lineTo(hw, 0)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.moveTo(0, -pip)
        ctx.lineTo(pip, 0)
        ctx.lineTo(0, pip)
        ctx.lineTo(-pip, 0)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(-hw, 0)
        ctx.lineTo(hw, 0)
        ctx.stroke()
      }
      break
    }
    default:
      break
  }
  ctx.restore()
}

function drawTextLayer(ctx, t, W, H, customFonts = {}) {
  if (!t.text) return
  const { px, lines, lineH, box } = layoutText(ctx, t, W, H, customFonts)
  const cx = t.x * W
  const cy = t.y * H
  ctx.save()
  ctx.translate(cx, cy)
  if (t.rotation) ctx.rotate((t.rotation * Math.PI) / 180)
  ctx.globalAlpha = t.opacity ?? 1
  if ((t.shadow || 0) > 0) {
    ctx.shadowColor = hexToRgba(t.shadowColor || '#000000', Math.min(0.95, t.shadow * 0.9))
    ctx.shadowBlur = Math.max(1, px * 0.25 * t.shadow)
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = Math.max(0.5, px * 0.06 * t.shadow)
  }
  ctx.fillStyle = t.color || '#f3ead8'
  ctx.textBaseline = 'middle'
  ctx.textAlign = t.align || 'center'
  const localX = t.align === 'left' ? -box.w / 2 : t.align === 'right' ? box.w / 2 : 0
  lines.forEach((line, i) => ctx.fillText(line, localX, -box.h / 2 + lineH * (i + 0.5)))
  ctx.restore()
}

/** Draws one face into ctx, filling a W x H area at the origin. */
export function drawFace(ctx, face, W, H, images, customFonts = {}) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  ctx.clip()
  drawBackground(ctx, face, W, H)
  const img = face.image && images?.get(face.image)
  if (img) drawImage(ctx, img, W, H, face)
  drawVignette(ctx, W, H, face.vignette)
  for (const layer of face.layers || []) {
    if (layer.visible === false) continue
    if (layer.type === 'shape') drawShape(ctx, layer, W, H)
    else drawTextLayer(ctx, layer, W, H, customFonts)
  }
  ctx.restore()
}

/** Draws the spine (laid out lying down) upright into a spineW x bookH area. */
export function drawSpine(ctx, face, spineW, bookH, images, customFonts = {}) {
  ctx.save()
  ctx.translate(spineW, 0)
  ctx.rotate(Math.PI / 2)
  drawFace(ctx, face, bookH, spineW, images, customFonts)
  ctx.restore()
}

/** Loads the cover's images (as bitmaps, so a canvas they are drawn on can be saved). */
export async function loadCoverImages(cover, projectPath, cache = new Map()) {
  const paths = new Set(Object.values(cover?.faces || {}).map((f) => f.image).filter(Boolean))
  await Promise.all([...paths].filter((p) => !cache.has(p)).map(async (p) => {
    try {
      const res = await window.api.coverReadImage({ project_path: projectPath, path: p })
      if (res) cache.set(p, await createImageBitmap(new Blob([res.data], { type: res.mime })))
    } catch (e) {
      console.error('cover image could not be loaded:', p, e)
    }
  }))
  return cache
}

/** PNG data URLs of front, spine, and back (300 DPI) for saving. */
export function renderCoverPngs(cover, trim, spineIn, images) {
  const scale = Math.max(300, 1600 / trim.w)
  const W = Math.round(trim.w * scale)
  const H = Math.round(trim.h * scale)
  const customFonts = cover.fonts || {}

  const front = document.createElement('canvas')
  front.width = W
  front.height = H
  drawFace(front.getContext('2d'), cover.faces.front, W, H, images, customFonts)

  const spine = document.createElement('canvas')
  spine.width = Math.max(8, Math.round(spineIn * scale))
  spine.height = H
  drawSpine(spine.getContext('2d'), cover.faces.spine, spine.width, H, images, customFonts)

  const back = document.createElement('canvas')
  back.width = W
  back.height = H
  drawFace(back.getContext('2d'), cover.faces.back, W, H, images, customFonts)

  return {
    front: front.toDataURL('image/png'),
    spine: spine.toDataURL('image/png'),
    back: back.toDataURL('image/png'),
  }
}

/**
 * Full print-ready wrap (back | spine | front) at 300 DPI with 0.125" outer bleed.
 * Returns { png, widthIn, heightIn }.
 */
export function renderPrintWrapPng(cover, trim, spineIn, images, bleedIn = 0.125, dpi = 300) {
  const bleedPx = Math.round(bleedIn * dpi)
  const faceW = Math.round(trim.w * dpi)
  const faceH = Math.round(trim.h * dpi)
  const spineW = Math.max(8, Math.round(spineIn * dpi))
  const totalW = bleedPx * 2 + faceW * 2 + spineW
  const totalH = bleedPx * 2 + faceH
  const customFonts = cover.fonts || {}

  const canvas = document.createElement('canvas')
  canvas.width = totalW
  canvas.height = totalH
  const ctx = canvas.getContext('2d')

  // Extend each face's background into its adjacent bleed margin
  ctx.save()
  drawBackground(ctx, cover.faces.back, bleedPx + faceW, totalH)
  ctx.restore()

  ctx.save()
  ctx.translate(bleedPx + faceW, 0)
  drawBackground(ctx, cover.faces.spine, spineW, totalH)
  ctx.restore()

  ctx.save()
  ctx.translate(bleedPx + faceW + spineW, 0)
  drawBackground(ctx, cover.faces.front, faceW + bleedPx, totalH)
  ctx.restore()

  // Draw exact trim faces inside the bleed frame
  ctx.save()
  ctx.translate(bleedPx, bleedPx)
  drawFace(ctx, cover.faces.back, faceW, faceH, images, customFonts)
  ctx.restore()

  ctx.save()
  ctx.translate(bleedPx + faceW, bleedPx)
  drawSpine(ctx, cover.faces.spine, spineW, faceH, images, customFonts)
  ctx.restore()

  ctx.save()
  ctx.translate(bleedPx + faceW + spineW, bleedPx)
  drawFace(ctx, cover.faces.front, faceW, faceH, images, customFonts)
  ctx.restore()

  return {
    png: canvas.toDataURL('image/png'),
    widthIn: bleedIn * 2 + trim.w * 2 + spineIn,
    heightIn: bleedIn * 2 + trim.h,
  }
}

export function assetUrl(projectPath, rel) {
  return rel ? `fleshnote-asset://load/${projectPath.replace(/\\/g, '/')}/${rel}` : null
}
