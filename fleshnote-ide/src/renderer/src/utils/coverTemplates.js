import { newShape, newText, normalizeCover } from './coverRender.js'

const DEFAULT_BLURB = 'Add your back-cover synopsis here. Describe the central conflict, the stakes, and what draws the reader into this world.'

function tintHex(hex, amt) {
  const clean = (hex || '#2c3d5c').replace('#', '')
  if (clean.length !== 6) return '#141c2b'
  const n = parseInt(clean, 16)
  const clamp = (v) => Math.max(0, Math.min(255, v))
  const r = clamp(((n >> 16) & 255) + amt)
  const g = clamp(((n >> 8) & 255) + amt)
  const b = clamp((n & 255) + amt)
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

export const COVER_TEMPLATES = [
  {
    id: 'classic-framed',
    name: 'Classic Framed',
    desc: 'Double-rule frame, ornate divider, and balanced back-cover blurb.',
    build: ({ title, author, color, pack }) => {
      const bg = color || '#2c3d5c'
      const bg2 = tintHex(bg, -38)
      const f = pack ? 'cormorant' : 'serif'
      return {
        front: {
          bg, bgType: 'radial', bg2, vignette: 0.28,
          layers: [
            newShape('double-frame', { w: 0.86, h: 0.9, stroke: '#f3ead8', strokeWidth: 0.003, opacity: 0.48 }),
            newText({ text: title, y: 0.3, w: 0.76, size: 0.13, lineHeight: 1.05, font: f, bold: true, color: '#f3ead8' }),
            newShape('line', { y: 0.54, w: 0.42, stroke: '#d4a052', lineStyle: 'ornate', opacity: 0.85 }),
            ...(author ? [newText({ text: author, y: 0.83, w: 0.74, size: 0.048, font: f, upper: true, spacing: 0.15, color: '#f3ead8' })] : []),
          ],
        },
        spine: {
          bg, bgType: 'solid',
          layers: [
            newText({ text: title, x: 0.4, w: 0.6, size: 0.42, font: f, color: '#f3ead8' }),
            ...(author ? [newText({ text: author, x: 0.86, w: 0.24, size: 0.3, font: f, upper: true, spacing: 0.08, color: '#d4a052' })] : []),
          ],
        },
        back: {
          bg, bgType: 'radial', bg2, vignette: 0.28,
          layers: [
            newShape('double-frame', { w: 0.86, h: 0.9, stroke: '#f3ead8', strokeWidth: 0.0025, opacity: 0.3 }),
            newShape('line', { y: 0.2, w: 0.3, stroke: '#d4a052', lineStyle: 'ornate', opacity: 0.8 }),
            newText({ text: DEFAULT_BLURB, y: 0.45, w: 0.68, size: 0.038, lineHeight: 1.45, font: f, align: 'center', color: '#f3ead8', opacity: 0.9 }),
            newShape('line', { y: 0.74, w: 0.2, stroke: '#f3ead8', lineStyle: 'solid', opacity: 0.35 }),
            ...(author ? [newText({ text: author, y: 0.82, w: 0.6, size: 0.036, font: f, upper: true, spacing: 0.12, color: '#d4a052' })] : []),
          ],
        },
      }
    },
  },
  {
    id: 'grimoire',
    name: 'Dark Grimoire',
    desc: 'Obsidian gradient, gold corner flourishes, and celestial crest.',
    build: ({ title, author, pack }) => {
      const f = pack ? 'cinzel' : 'serif'
      const gold = '#d4a052'
      const cream = '#f3ead8'
      return {
        front: {
          bg: '#1c1824', bgType: 'linear', bg2: '#0b090f', bgAngle: 180, vignette: 0.45,
          layers: [
            newShape('corners', { w: 0.88, h: 0.91, stroke: gold, strokeWidth: 0.004, opacity: 0.75 }),
            newShape('crescent', { y: 0.19, w: 0.13, h: 0.09, fill: gold, stroke: 'none', opacity: 0.9 }),
            newShape('star', { x: 0.54, y: 0.19, w: 0.055, h: 0.04, fill: cream, stroke: 'none', opacity: 0.9 }),
            newText({ text: title, y: 0.41, w: 0.78, size: 0.11, lineHeight: 1.08, font: f, upper: true, spacing: 0.08, bold: true, color: cream }),
            newShape('line', { y: 0.6, w: 0.46, stroke: gold, lineStyle: 'ornate', opacity: 0.85 }),
            ...(author ? [newText({ text: author, y: 0.83, w: 0.74, size: 0.044, font: f, upper: true, spacing: 0.18, color: gold })] : []),
          ],
        },
        spine: {
          bg: '#131019', bgType: 'solid',
          layers: [
            newShape('star', { x: 0.1, w: 0.03, h: 0.36, fill: gold, stroke: 'none' }),
            newText({ text: title, x: 0.5, w: 0.62, size: 0.4, font: f, upper: true, spacing: 0.06, color: cream }),
          ],
        },
        back: {
          bg: '#1c1824', bgType: 'linear', bg2: '#0b090f', bgAngle: 180, vignette: 0.45,
          layers: [
            newShape('corners', { w: 0.88, h: 0.91, stroke: gold, strokeWidth: 0.0035, opacity: 0.55 }),
            newShape('diamond', { y: 0.2, w: 0.06, h: 0.045, fill: 'none', stroke: gold, strokeWidth: 0.004 }),
            newText({ text: DEFAULT_BLURB, y: 0.47, w: 0.66, size: 0.037, lineHeight: 1.48, font: 'serif', color: cream, opacity: 0.9 }),
            newShape('star', { y: 0.8, w: 0.07, h: 0.05, fill: gold, stroke: 'none', opacity: 0.75 }),
          ],
        },
      }
    },
  },
  {
    id: 'minimal-band',
    name: 'Minimalist Band',
    desc: 'Bold geometric band across the lower third with crisp sans typography.',
    build: ({ title, author, color, pack }) => {
      const bg = color || '#203142'
      const band = '#f2eadc'
      const ink = '#161b22'
      const f = pack ? 'oswald' : 'sans'
      return {
        front: {
          bg, bgType: 'solid', vignette: 0.15,
          layers: [
            newShape('rect', { y: 0.78, w: 1.04, h: 0.24, fill: band, stroke: 'none' }),
            newShape('line', { y: 0.12, w: 0.82, stroke: band, lineStyle: 'solid', strokeWidth: 0.003, opacity: 0.5 }),
            newText({ text: title, y: 0.34, w: 0.82, size: 0.125, lineHeight: 1.0, font: f, bold: true, upper: true, spacing: 0.04, color: band }),
            ...(author ? [newText({ text: author, y: 0.78, w: 0.8, size: 0.048, font: f, upper: true, spacing: 0.16, color: ink, bold: true })] : []),
          ],
        },
        spine: {
          bg, bgType: 'solid',
          layers: [
            newShape('rect', { x: 0.86, w: 0.28, h: 1.1, fill: band, stroke: 'none' }),
            newText({ text: title, x: 0.38, w: 0.58, size: 0.42, font: f, upper: true, bold: true, color: band }),
          ],
        },
        back: {
          bg, bgType: 'solid', vignette: 0.15,
          layers: [
            newShape('rect', { y: 0.78, w: 1.04, h: 0.24, fill: band, stroke: 'none' }),
            newText({ text: DEFAULT_BLURB, y: 0.36, w: 0.74, size: 0.039, lineHeight: 1.45, font: 'sans', align: 'left', color: band, opacity: 0.92 }),
            ...(author ? [newText({ text: author, y: 0.78, w: 0.74, size: 0.04, font: f, upper: true, spacing: 0.14, align: 'left', color: ink })] : []),
          ],
        },
      }
    },
  },
  {
    id: 'editorial-bold',
    name: 'Editorial Type',
    desc: 'High-contrast stacked display type framed by hairline rules.',
    build: ({ title, author, pack }) => {
      const f = pack ? 'bebas' : 'sans'
      const sub = pack ? 'cormorant' : 'serif'
      const bg = '#15181f'
      const fg = '#f5f1e8'
      const accent = '#e08b4f'
      return {
        front: {
          bg, bgType: 'linear', bg2: '#0d0f14', bgAngle: 160, vignette: 0.2,
          layers: [
            newShape('line', { y: 0.17, w: 0.84, stroke: fg, lineStyle: 'solid', strokeWidth: 0.003, opacity: 0.65 }),
            newText({ text: title, y: 0.37, w: 0.84, size: 0.16, lineHeight: 0.94, font: f, upper: true, spacing: 0.03, bold: true, color: fg }),
            newShape('line', { y: 0.58, w: 0.84, stroke: accent, lineStyle: 'solid', strokeWidth: 0.005 }),
            newText({ text: 'A NOVEL', y: 0.635, w: 0.7, size: 0.036, font: sub, upper: true, spacing: 0.28, color: accent }),
            ...(author ? [newText({ text: author, y: 0.87, w: 0.8, size: 0.046, font: sub, italic: true, color: fg, opacity: 0.92 })] : []),
          ],
        },
        spine: {
          bg: '#12151b', bgType: 'solid',
          layers: [
            newText({ text: title, x: 0.44, w: 0.64, size: 0.46, font: f, upper: true, color: fg }),
            ...(author ? [newText({ text: author, x: 0.88, w: 0.2, size: 0.28, font: sub, italic: true, color: accent })] : []),
          ],
        },
        back: {
          bg, bgType: 'linear', bg2: '#0d0f14', bgAngle: 160, vignette: 0.2,
          layers: [
            newShape('line', { y: 0.17, w: 0.8, stroke: accent, lineStyle: 'solid', strokeWidth: 0.004 }),
            newText({ text: DEFAULT_BLURB, y: 0.42, w: 0.74, size: 0.04, lineHeight: 1.5, font: sub, align: 'left', color: fg, opacity: 0.92 }),
            newShape('line', { y: 0.78, w: 0.8, stroke: fg, lineStyle: 'solid', strokeWidth: 0.0025, opacity: 0.4 }),
          ],
        },
      }
    },
  },
  {
    id: 'split-horizon',
    name: 'Split Horizon',
    desc: 'Two-tone split panel with a diamond medallion bridging the horizon.',
    build: ({ title, author, color, pack }) => {
      const topCol = color || '#2d4b5a'
      const botCol = '#141920'
      const gold = '#e3b568'
      const cream = '#f6efe2'
      const f = pack ? 'playfair' : 'serif'
      return {
        front: {
          bg: botCol, bgType: 'solid',
          layers: [
            newShape('rect', { y: 0.23, w: 1.06, h: 0.48, fill: topCol, stroke: 'none' }),
            newShape('line', { y: 0.47, w: 1.04, stroke: gold, lineStyle: 'solid', strokeWidth: 0.004 }),
            newShape('diamond', { y: 0.47, w: 0.16, h: 0.11, fill: botCol, stroke: gold, strokeWidth: 0.005 }),
            newText({ text: title, y: 0.24, w: 0.82, size: 0.12, lineHeight: 1.08, font: f, bold: true, color: cream }),
            ...(author ? [newText({ text: author, y: 0.76, w: 0.76, size: 0.05, font: f, upper: true, spacing: 0.16, color: gold })] : []),
          ],
        },
        spine: {
          bg: botCol, bgType: 'solid',
          layers: [
            newShape('rect', { x: 0.23, w: 0.48, h: 1.1, fill: topCol, stroke: 'none' }),
            newText({ text: title, x: 0.5, w: 0.64, size: 0.4, font: f, color: cream }),
          ],
        },
        back: {
          bg: botCol, bgType: 'solid',
          layers: [
            newShape('rect', { y: 0.14, w: 1.06, h: 0.3, fill: topCol, stroke: 'none' }),
            newShape('line', { y: 0.29, w: 1.04, stroke: gold, lineStyle: 'solid', strokeWidth: 0.004 }),
            newShape('diamond', { y: 0.29, w: 0.11, h: 0.075, fill: botCol, stroke: gold, strokeWidth: 0.004 }),
            newText({ text: DEFAULT_BLURB, y: 0.56, w: 0.72, size: 0.038, lineHeight: 1.48, font: f, color: cream, opacity: 0.9 }),
          ],
        },
      }
    },
  },
  {
    id: 'romantic-crest',
    name: 'Romantic Crest',
    desc: 'Warm radial glow, soft rounded border, circular crest, and italic serif.',
    build: ({ title, author, pack }) => {
      const f = pack ? 'playfair' : 'serif'
      const cream = '#f7ecdf'
      const rose = '#e0b49c'
      return {
        front: {
          bg: '#4a2130', bgType: 'radial', bg2: '#1f0c14', vignette: 0.35,
          layers: [
            newShape('rect', { w: 0.86, h: 0.9, fill: 'none', stroke: rose, strokeWidth: 0.003, radius: 0.04, opacity: 0.55 }),
            newShape('circle', { y: 0.21, w: 0.18, h: 0.12, fill: 'none', stroke: rose, strokeWidth: 0.0035, opacity: 0.8 }),
            newShape('star', { y: 0.21, w: 0.09, h: 0.06, fill: rose, stroke: 'none', opacity: 0.9 }),
            newText({ text: title, y: 0.45, w: 0.76, size: 0.12, lineHeight: 1.1, font: f, italic: true, bold: true, color: cream }),
            newShape('line', { y: 0.64, w: 0.38, stroke: rose, lineStyle: 'double', opacity: 0.75 }),
            ...(author ? [newText({ text: author, y: 0.82, w: 0.74, size: 0.045, font: f, upper: true, spacing: 0.18, color: rose })] : []),
          ],
        },
        spine: {
          bg: '#321420', bgType: 'solid',
          layers: [
            newText({ text: title, x: 0.42, w: 0.62, size: 0.42, font: f, italic: true, color: cream }),
            ...(author ? [newText({ text: author, x: 0.86, w: 0.22, size: 0.28, font: f, upper: true, color: rose })] : []),
          ],
        },
        back: {
          bg: '#4a2130', bgType: 'radial', bg2: '#1f0c14', vignette: 0.35,
          layers: [
            newShape('rect', { w: 0.86, h: 0.9, fill: 'none', stroke: rose, strokeWidth: 0.0025, radius: 0.04, opacity: 0.4 }),
            newShape('star', { y: 0.2, w: 0.08, h: 0.055, fill: rose, stroke: 'none', opacity: 0.85 }),
            newText({ text: DEFAULT_BLURB, y: 0.46, w: 0.68, size: 0.038, lineHeight: 1.48, font: f, color: cream, opacity: 0.9 }),
            ...(author ? [newText({ text: author, y: 0.81, w: 0.6, size: 0.038, font: f, italic: true, color: rose })] : []),
          ],
        },
      }
    },
  },
]

export function applyCoverTemplate(templateId, { title, author, color, currentCover = null, keepImages = true, packInstalled = false } = {}) {
  const tpl = COVER_TEMPLATES.find((t) => t.id === templateId) || COVER_TEMPLATES[0]
  const built = tpl.build({
    title: title || 'Untitled',
    author: author || '',
    color: color || '#2c3d5c',
    pack: Boolean(packInstalled),
  })
  const faces = {}
  for (const name of ['front', 'spine', 'back']) {
    const prev = currentCover?.faces?.[name]
    const nextFace = { ...built[name] }
    if (keepImages && prev?.image) {
      nextFace.image = prev.image
      nextFace.fit = prev.fit || 'fill'
      nextFace.imageOpacity = prev.imageOpacity ?? 1
      nextFace.imageScale = prev.imageScale ?? 1
      nextFace.imageX = prev.imageX ?? 0.5
      nextFace.imageY = prev.imageY ?? 0.5
    }
    faces[name] = nextFace
  }
  return normalizeCover({
    version: 2,
    fonts: currentCover?.fonts || {},
    faces,
    render: currentCover?.render || { front: null, spine: null, back: null },
  }, color)
}
