// Drawing for the book cover (alpha). The cover editor draws its faces with these
// functions and saves the front and spine with the same code, so the bookshelf,
// the export window and the EPUB cover look exactly like the editor.
//
// A face is { bg, image, fit, texts[] }. Text positions are fractions of the face
// (x, y = the centre of the text box, w = its width) and size is a fraction of
// the face's shorter side, so a cover keeps its layout across trim sizes and
// spine widths. The spine is laid out lying on its side (long edge horizontal)
// and turned 90° clockwise when drawn on the book.

export const COVER_FONTS = {
  serif: { label: 'Crimson Pro', family: '"Crimson Pro", Georgia, serif', bold: 500 },
  sans: { label: 'Inter', family: 'Inter, Arial, sans-serif', bold: 700 },
  mono: { label: 'JetBrains Mono', family: '"JetBrains Mono", monospace', bold: 700 },
  runes: { label: 'Rovás (Old Hungarian)', family: '"Noto Sans Old Hungarian", NotoOldHungarian', bold: 400 },
}

export const FACE_NAMES = ['back', 'spine', 'front']

const newId = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0')

export function newText(overrides = {}) {
  return {
    id: newId(), text: 'Text', x: 0.5, y: 0.5, w: 0.7, size: 0.07, font: 'serif',
    bold: false, italic: false, upper: false, spacing: 0, align: 'center', color: '#f3ead8',
    ...overrides,
  }
}

/** A first cover: title and author on the front and spine, in the book's colour. */
export function defaultCover(title, author, color) {
  const face = (texts) => ({ bg: color, image: null, fit: 'fill', texts })
  return {
    version: 1,
    faces: {
      front: face([
        newText({ text: title || 'Untitled', y: 0.3, w: 0.84, size: 0.13, bold: true }),
        ...(author ? [newText({ text: author, y: 0.84, w: 0.8, size: 0.05, upper: true, spacing: 0.14 })] : []),
      ]),
      spine: face([
        newText({ text: title || 'Untitled', x: 0.4, w: 0.6, size: 0.42 }),
        ...(author ? [newText({ text: author, x: 0.86, w: 0.24, size: 0.3, upper: true, spacing: 0.08 })] : []),
      ]),
      back: face([]),
    },
    render: { front: null, spine: null },
  }
}

export function fontString(t, px) {
  const f = COVER_FONTS[t.font] || COVER_FONTS.serif
  return `${t.italic ? 'italic ' : ''}${t.bold ? f.bold : 400} ${px}px ${f.family}`
}

/** Makes sure every font the cover uses is loaded before drawing. */
export async function loadCoverFonts(cover) {
  const wanted = new Set()
  for (const face of Object.values(cover?.faces || {})) {
    for (const t of face.texts || []) wanted.add(fontString(t, 40))
  }
  await Promise.all([...wanted].map((f) => document.fonts.load(f).catch(() => null)))
}

/** Lines and box of a text field on a face of W x H pixels. */
export function layoutText(ctx, t, W, H) {
  const px = Math.max(1, t.size * Math.min(W, H))
  ctx.font = fontString(t, px)
  ctx.letterSpacing = `${(t.spacing || 0) * px}px`
  const maxW = Math.max(4, t.w * W)
  const text = t.upper ? t.text.toUpperCase() : t.text
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
  const lineH = px * 1.2
  const h = Math.max(lineH, lines.length * lineH)
  return { px, lines, lineH, box: { x: t.x * W - maxW / 2, y: t.y * H - h / 2, w: maxW, h } }
}

function drawImage(ctx, img, W, H, fit) {
  const ir = img.width / img.height
  const fr = W / H
  let w, h
  if ((fit === 'fit') === (ir > fr)) { w = W; h = W / ir } else { h = H; w = H * ir }
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
}

/** Draws one face into ctx, filling a W x H area at the origin. */
export function drawFace(ctx, face, W, H, images) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  ctx.clip()
  ctx.fillStyle = face.bg || '#2c3d5c'
  ctx.fillRect(0, 0, W, H)
  const img = face.image && images?.get(face.image)
  if (img) drawImage(ctx, img, W, H, face.fit)
  for (const t of face.texts || []) {
    if (!t.text) continue
    const { lines, lineH, box } = layoutText(ctx, t, W, H)
    ctx.fillStyle = t.color || '#f3ead8'
    ctx.textBaseline = 'middle'
    ctx.textAlign = t.align || 'center'
    const x = t.align === 'left' ? box.x : t.align === 'right' ? box.x + box.w : box.x + box.w / 2
    lines.forEach((line, i) => ctx.fillText(line, x, box.y + lineH * (i + 0.5)))
  }
  ctx.restore()
}

/** Draws the spine (laid out lying down) upright into a spineW x bookH area. */
export function drawSpine(ctx, face, spineW, bookH, images) {
  ctx.save()
  ctx.translate(spineW, 0)
  ctx.rotate(Math.PI / 2)
  drawFace(ctx, face, bookH, spineW, images)
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

/** PNG data URLs of the front (1600 px wide) and the spine, for saving. */
export function renderCoverPngs(cover, trim, spineIn, images) {
  const scale = 1600 / trim.w
  const W = Math.round(trim.w * scale)
  const H = Math.round(trim.h * scale)
  const front = document.createElement('canvas')
  front.width = W
  front.height = H
  drawFace(front.getContext('2d'), cover.faces.front, W, H, images)
  const spine = document.createElement('canvas')
  spine.width = Math.max(8, Math.round(spineIn * scale))
  spine.height = H
  drawSpine(spine.getContext('2d'), cover.faces.spine, spine.width, H, images)
  return { front: front.toDataURL('image/png'), spine: spine.toDataURL('image/png') }
}

export function assetUrl(projectPath, rel) {
  return rel ? `fleshnote-asset://load/${projectPath.replace(/\\/g, '/')}/${rel}` : null
}
