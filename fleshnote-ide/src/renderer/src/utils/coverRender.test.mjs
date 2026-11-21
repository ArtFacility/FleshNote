import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SHAPE_DEFS,
  defaultCover,
  drawFace,
  drawSpine,
  fontString,
  layoutShape,
  newShape,
  newText,
  normalizeCover,
  resolveFontSpec,
} from './coverRender.js'
import { COVER_TEMPLATES, applyCoverTemplate } from './coverTemplates.js'

function mockCtx() {
  const calls = []
  return {
    calls,
    font: '',
    letterSpacing: '0px',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    textBaseline: '',
    textAlign: '',
    lineJoin: '',
    lineCap: '',
    save() { calls.push('save') },
    restore() { calls.push('restore') },
    beginPath() {},
    closePath() {},
    rect() {},
    clip() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    ellipse() {},
    translate() {},
    rotate() {},
    scale() {},
    fill() { calls.push('fill') },
    stroke() { calls.push('stroke') },
    fillRect() { calls.push('fillRect') },
    fillText(txt) { calls.push(`fillText:${txt}`) },
    measureText(s) { return { width: s.length * 8 } },
    createLinearGradient() { return { addColorStop() {} } },
    createRadialGradient() { return { addColorStop() {} } },
  }
}

test('defaultCover produces v2 faces with layers including frame, divider, title, author', () => {
  const c = defaultCover('A Pale Light', 'J. Doe', '#1e2a3a')
  assert.equal(c.version, 2)
  assert.equal(c.faces.front.bg, '#1e2a3a')
  assert.equal(c.faces.front.layers[0].type, 'shape')
  assert.equal(c.faces.front.layers[0].shape, 'double-frame')
  assert.equal(c.faces.front.layers[1].type, 'text')
  assert.equal(c.faces.front.layers[1].text, 'A Pale Light')
  assert.equal(c.faces.front.layers[2].shape, 'line')
  assert.equal(c.faces.front.layers[3].text, 'J. Doe')
})

test('normalizeCover upgrades v1 texts into v2 layers', () => {
  const v1 = {
    version: 1,
    faces: {
      front: { bg: '#111111', fit: 'fit', texts: [{ id: 't1', text: 'Legacy', x: 0.4, y: 0.5 }] },
      spine: { bg: '#111111', texts: [] },
      back: { bg: '#111111', texts: [] },
    },
  }
  const v2 = normalizeCover(v1)
  assert.equal(v2.version, 2)
  assert.equal(v2.faces.front.fit, 'fit')
  assert.equal(v2.faces.front.layers.length, 1)
  assert.equal(v2.faces.front.layers[0].type, 'text')
  assert.equal(v2.faces.front.layers[0].text, 'Legacy')
  assert.equal(v2.faces.front.layers[0].lineHeight, 1.2)
  assert.equal(v2.faces.front.layers[0].visible, true)
})

test('all SHAPE_DEFS draw cleanly and hidden layers are skipped', () => {
  const layers = SHAPE_DEFS.map((s) => newShape(s.id))
  layers.push(newText({ text: 'Hidden', visible: false }))
  layers.push(newText({ text: 'Visible', shadow: 0.5, rotation: 15 }))
  const face = {
    bg: '#102030',
    bgType: 'linear',
    bg2: '#05080d',
    bgAngle: 120,
    vignette: 0.4,
    layers,
  }
  const ctx = mockCtx()
  drawFace(ctx, face, 800, 1200, null)
  assert.ok(ctx.calls.includes('fillText:Visible'))
  assert.ok(!ctx.calls.includes('fillText:Hidden'))

  const spineCtx = mockCtx()
  drawSpine(spineCtx, face, 80, 1200, null)
  assert.ok(spineCtx.calls.includes('fillText:Visible'))
})

test('layoutShape enforces minimum hit box height on divider lines', () => {
  const line = newShape('line', { h: 0.002 })
  const { box } = layoutShape(line, 400, 600)
  assert.ok(box.h >= 12)
})

test('resolveFontSpec and fontString handle built-in, pack, and custom fonts', () => {
  const custom = { cf_1234567890ab: { id: 'cf_1234567890ab', label: 'My Serif', path: 'assets/cover/font_1234567890ab.ttf' } }
  assert.ok(fontString({ font: 'cinzel', bold: true, italic: true }, 40, custom).includes('700 40px "fn-pack-cinzel"'))
  assert.ok(fontString({ font: 'runes', bold: true, italic: true }, 40, custom).startsWith('400 40px'))
  assert.ok(fontString({ font: 'cf_1234567890ab', bold: true, italic: true }, 40, custom).includes('italic 700 40px "fn-custom-cf_1234567890ab"'))
  assert.equal(resolveFontSpec('unknown', custom).label, 'Crimson Pro')

  const norm = normalizeCover({ version: 2, fonts: custom, faces: { front: {}, spine: {}, back: {} } })
  assert.equal(norm.fonts.cf_1234567890ab.label, 'My Serif')
})

test('all COVER_TEMPLATES apply cleanly, preserve fonts/images, and draw without errors', () => {
  const prev = {
    version: 2,
    fonts: { cf_1: { id: 'cf_1', label: 'Custom', path: 'assets/cover/font_1234567890ab.ttf' } },
    faces: {
      front: { bg: '#000000', image: 'assets/cover/img_1234567890ab.png', fit: 'fit', imageOpacity: 0.7, layers: [] },
      spine: { bg: '#000000', image: null, layers: [] },
      back: { bg: '#000000', image: null, layers: [] },
    },
  }
  for (const tpl of COVER_TEMPLATES) {
    const out = applyCoverTemplate(tpl.id, {
      title: 'The Winter Gate',
      author: 'A. Writer',
      color: '#2c3d5c',
      currentCover: prev,
      keepImages: true,
      packInstalled: true,
    })
    assert.equal(out.version, 2)
    assert.equal(out.fonts.cf_1.label, 'Custom')
    assert.equal(out.faces.front.image, 'assets/cover/img_1234567890ab.png')
    assert.equal(out.faces.front.fit, 'fit')
    assert.ok(out.faces.front.layers.length >= 2)
    assert.ok(out.faces.back.layers.length >= 2)
    const ctx = mockCtx()
    drawFace(ctx, out.faces.front, 600, 960, null, out.fonts)
    drawSpine(ctx, out.faces.spine, 80, 960, null, out.fonts)
    drawFace(ctx, out.faces.back, 600, 960, null, out.fonts)
    assert.ok(ctx.calls.some((c) => c.startsWith('fillText:')))
  }
})
