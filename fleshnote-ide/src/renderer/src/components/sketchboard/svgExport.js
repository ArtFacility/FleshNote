/*
 * The board as a standalone SVG picture: what is drawn, without handles,
 * ports or selection, with the app's colours and fonts written out so it
 * looks the same outside FleshNote.
 */

const HANDLES = [
  '.sk-port',
  '.sk-edge-handles',
  '.sk-resize',
  '.sk-selection-box',
  '.sk-marquee',
  '.sk-ghost-shape',
  '.sk-wire'
]

/** var(--x) and var(--x, fallback) replaced by their current values. */
function resolveVars(text) {
  const root = getComputedStyle(document.documentElement)
  return text.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (m, name, fallback) => {
    const v = root.getPropertyValue(name).trim()
    return v || (fallback ? fallback.trim() : m)
  })
}

/** The page's sketchboard style rules, so labels and states keep their look. */
function boardRules() {
  const out = []
  for (const sheet of document.styleSheets) {
    let rules
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const r of rules || []) if (r.cssText?.includes('.sk-')) out.push(r.cssText)
  }
  return out.join('\n')
}

/** A standalone SVG document of the board drawn in `svgEl`, or null when it is empty. */
export function boardSvg(svgEl) {
  const content = svgEl.querySelector(':scope > g[transform]')
  if (!content) return null
  const box = content.getBBox()
  if (!box.width || !box.height) return null
  const pad = 40
  const clone = content.cloneNode(true)
  clone.removeAttribute('transform')
  clone.querySelectorAll(HANDLES.join(',')).forEach((el) => el.remove())
  const x = Math.floor(box.x - pad)
  const y = Math.floor(box.y - pad)
  const w = Math.ceil(box.width + pad * 2)
  const h = Math.ceil(box.height + pad * 2)
  const font = getComputedStyle(document.body).fontFamily
  const body = new XMLSerializer().serializeToString(clone)
  return resolveVars(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">` +
      `<style>svg { font-family: ${font}; }\n${boardRules()}</style>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--bg-deep)"/>` +
      body +
      '</svg>'
  )
}
