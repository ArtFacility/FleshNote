import React from 'react'

/*
 * The abstract, genderless figure in the Character Forge.
 *
 * Each body part is clickable and can carry one "mark": a rough polygon hint
 * (a scar, a beard, a stump, a cigar…). Marks are deliberately crude and
 * unnamed in the UI. They are prompts for the writer's imagination, not a
 * character design.
 *
 * Limbs are drawn once in left-side coordinates and mirrored for the right
 * side, so left and right share the same shapes and marks. Body shapes have a
 * solid fill and are layered legs → arms → torso → head, so overlaps at the
 * hips, shoulders and neck stay hidden.
 */

export const FIGURE_PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR']

export const MARK_POOLS = {
  head: ['scar', 'beard', 'patch', 'horns', 'hat', 'cigar', 'crown', 'mask', 'bun', 'longHair', 'earrings', 'flower', 'bow'],
  torso: ['slash', 'sash', 'wound', 'medal', 'cape', 'chevrons', 'straps', 'necklace', 'skirt', 'laces', 'brooch'],
  arm: ['stump', 'hook', 'blade', 'bandage', 'shield', 'bands', 'claw', 'bracelets', 'fan', 'purse'],
  leg: ['stump', 'peg', 'bandage', 'chain', 'boot', 'scar', 'heels', 'garter']
}

export const poolFor = (part) =>
  part.startsWith('arm') ? MARK_POOLS.arm : part.startsWith('leg') ? MARK_POOLS.leg : MARK_POOLS[part]

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

/** Next mark for a part: anything but the current one, with "none" in the draw so marks can be cleared. */
export function nextMark(part, current) {
  const options = [...poolFor(part), null].filter((m) => m !== (current || null))
  return pickRandom(options)
}

/** A fresh set of 1–3 marks on distinct parts. */
export function rollMarks() {
  const parts = [...FIGURE_PARTS].sort(() => Math.random() - 0.5)
  const count = 1 + Math.floor(Math.random() * 3)
  const marks = {}
  for (const part of parts.slice(0, count)) marks[part] = pickRandom(poolFor(part))
  return marks
}

// ── Base anatomy ───────────────────────────────────────────────────────────

const HEAD = { cx: 110, cy: 50, rx: 25, ry: 29 }

// Torso outline including the neck; the head is drawn over the neck's top.
// Shoulders and hips are about the same width, so the shape reads as neither.
const TORSO =
  'M103,72 L102,88 C93,90 83,94 78,102 C72,112 73,140 77,168 C80,184 78,206 76,232 ' +
  'L144,232 C142,206 140,184 143,168 C147,140 148,112 142,102 C137,94 127,90 118,88 L117,72 Z'

// Arms are drawn at the old, wider shoulder line and shifted in by ARM_SHIFT.
const ARM_SHIFT = 'translate(9 0)'
const ARM = 'M70,101 C58,104 51,114 49,128 L37,210 C36,218 47,221 49,213 L61,146 C63,136 65,126 67,118 Z'
const ARM_STUMP = 'M70,101 C58,104 51,114 49,128 L44,160 L50,156 L54,164 L58,156 L61,146 C63,136 65,126 67,118 Z'
const HAND = { cx: 42, cy: 222, rx: 6.5, ry: 9 }

const LEG = 'M80,232 C80,262 82,290 84,318 L104,318 C104,290 106,262 108,232 Z'
const LEG_STUMP = 'M80,232 C80,250 81,262 82,272 L88,267 L93,276 L99,268 L105,273 C106,260 107,246 108,232 Z'
const FOOT = 'M82,318 L105,318 L108,328 L77,328 Z'

const ARM_REPLACES = new Set(['stump', 'hook'])
const LEG_REPLACES = new Set(['stump', 'peg'])

// ── Marks (rough polygons in the figure's 220×340 space) ───────────────────

const HEAD_MARKS = {
  scar: (
    <>
      <polygon points="95,29 99,28 106,44 103,46 109,61 105,62 99,47 101,45" />
      <line x1="96" y1="38" x2="104" y2="35" />
      <line x1="100" y1="50" x2="108" y2="47" />
    </>
  ),
  beard: <polygon points="87,58 96,66 104,63 116,63 124,66 133,58 131,75 121,91 110,95 99,91 89,75" />,
  patch: (
    <>
      <polygon points="112,39 126,37 127,49 115,52" />
      <polyline points="86,34 112,41" className="figure-mark-line" />
      <polyline points="127,42 135,47" className="figure-mark-line" />
    </>
  ),
  horns: (
    <>
      <polygon points="92,29 79,3 99,23" />
      <polygon points="128,29 141,3 121,23" />
    </>
  ),
  hat: <polygon points="77,31 143,30 136,24 127,24 124,3 96,4 93,24 84,25" />,
  cigar: (
    <>
      <polygon points="117,65 141,61 142,67 118,70" />
      <circle cx="144" cy="64" r="2.6" className="figure-mark-ember" />
      <polyline points="146,58 150,51 146,45 151,38" className="figure-mark-line" />
    </>
  ),
  crown: <polygon points="87,25 91,6 100,18 110,1 120,18 129,6 133,25" />,
  mask: <polygon points="85,39 135,37 134,51 117,49 110,53 103,49 86,52" />,
  earrings: (
    <>
      <polygon points="84,54 87,54 89,62 85,67 81,62" />
      <polygon points="133,54 136,54 139,62 135,67 131,62" />
    </>
  ),
  flower: (
    <>
      <polygon points="130,16 134,23 142,22 138,29 143,35 135,35 131,42 127,35 119,35 123,29 119,22 127,23" />
      <circle cx="131" cy="29" r="2.6" className="figure-mark-ember" />
    </>
  ),
  bow: (
    <>
      <polygon points="110,19 94,8 92,30" />
      <polygon points="110,19 126,8 128,30" />
      <polygon points="106,15 114,15 114,23 106,23" />
    </>
  )
}

// Drawn behind the whole figure.
const HEAD_BACK_MARKS = {
  bun: <polygon points="110,3 120,6 124,15 121,25 110,28 99,25 96,15 100,6" />,
  longHair: <polygon points="85,42 83,27 94,15 110,11 126,15 137,27 135,42 142,92 130,108 122,98 98,98 90,108 78,92" />
}

const TORSO_MARKS = {
  slash: (
    <>
      <polygon points="81,119 85,116 133,180 129,183" />
      <line x1="92" y1="137" x2="99" y2="131" />
      <line x1="107" y1="157" x2="114" y2="151" />
      <line x1="120" y1="174" x2="127" y2="168" />
    </>
  ),
  sash: <polygon points="78,106 89,100 141,214 129,221" />,
  wound: <polygon points="99,150 112,143 123,152 118,167 104,169 95,160" className="figure-mark-dark" />,
  medal: (
    <>
      <polyline points="126,104 130,118 134,104" className="figure-mark-line" />
      <polygon points="130,118 133,125 140,125 134,130 137,137 130,133 123,137 126,130 120,125 127,125" />
    </>
  ),
  chevrons: (
    <>
      <polyline points="90,128 110,140 130,128" className="figure-mark-line wide" />
      <polyline points="91,142 110,154 129,142" className="figure-mark-line wide" />
      <polyline points="92,156 110,168 128,156" className="figure-mark-line wide" />
    </>
  ),
  straps: (
    <>
      <polygon points="84,102 90,101 97,176 90,177" />
      <polygon points="136,102 130,101 123,176 130,177" />
      <polygon points="88,170 132,170 128,186 92,186" />
    </>
  ),
  necklace: (
    <>
      <polyline points="100,88 103,102 110,107 117,102 120,88" className="figure-mark-line" />
      <polygon points="110,107 115,114 110,123 105,114" />
    </>
  ),
  skirt: <polygon points="78,198 142,198 162,284 136,291 110,283 84,291 58,284" />,
  laces: (
    <>
      <polyline points="101,140 119,148 101,156 119,164 101,172 119,180 101,188" className="figure-mark-line" />
      <line x1="99" y1="138" x2="99" y2="190" />
      <line x1="121" y1="138" x2="121" y2="190" />
    </>
  ),
  brooch: <polygon points="91,110 99,107 106,112 104,121 95,123 89,117" />
}

// Drawn behind the body.
const TORSO_BACK_MARKS = {
  cape: <polygon points="76,100 144,100 170,298 150,290 128,302 96,292 70,302 50,296" className="ghost" />
}

const ARM_MARKS = {
  hook: <path d="M51,162 L51,184 C51,198 35,198 35,186" className="figure-mark-line wide" fill="none" />,
  blade: (
    <>
      <polygon points="39,229 46,229 44,302 41,302" />
      <line x1="33" y1="229" x2="53" y2="229" className="figure-mark-line wide" />
    </>
  ),
  bandage: <polyline points="42,170 58,176 41,182 56,188 40,194 55,200" className="figure-mark-line" fill="none" />,
  shield: <polygon points="17,150 40,145 45,176 31,197 15,179" />,
  bands: (
    <>
      <polygon points="49,123 65,127 64,132 48,128" />
      <polygon points="47,135 63,139 62,144 46,140" />
    </>
  ),
  claw: (
    <>
      <polygon points="36,228 31,245 40,232" />
      <polygon points="42,231 41,249 46,232" />
      <polygon points="48,228 53,244 50,226" />
    </>
  ),
  bracelets: (
    <>
      <polygon points="37,193 53,196 52,200 36,197" />
      <polygon points="36,201 52,204 51,208 35,205" />
    </>
  ),
  fan: (
    <>
      <polygon points="42,228 18,244 24,258 36,265 50,264 60,254" />
      <polyline points="24,258 42,228 36,265" className="figure-mark-line" />
      <polyline points="50,264 42,228" className="figure-mark-line" />
    </>
  ),
  purse: (
    <>
      <polyline points="38,226 31,246" className="figure-mark-line" />
      <polyline points="47,226 54,246" className="figure-mark-line" />
      <polygon points="26,245 59,245 62,270 23,270" />
    </>
  )
}

const LEG_MARKS = {
  peg: <polygon points="89,274 99,274 97,327 91,327" />,
  bandage: <polyline points="84,280 104,285 84,291 104,296 85,302 103,307" className="figure-mark-line" fill="none" />,
  chain: (
    <>
      <circle cx="87" cy="312" r="3.4" fill="none" />
      <circle cx="95" cy="315" r="3.4" fill="none" />
      <circle cx="103" cy="312" r="3.4" fill="none" />
      <polyline points="106,314 116,322 122,333" className="figure-mark-line" fill="none" />
    </>
  ),
  boot: <polygon points="79,298 106,296 109,330 69,332 72,316" />,
  scar: (
    <>
      <polygon points="87,246 91,244 101,266 97,268" />
      <line x1="89" y1="256" x2="97" y2="252" />
    </>
  ),
  heels: (
    <>
      <polygon points="77,323 86,323 84,339 80,339" />
      <polygon points="100,318 110,322 108,328 98,326" />
    </>
  ),
  garter: (
    <>
      <polygon points="81,250 107,247 107,254 81,257" />
      <polygon points="94,252 88,246 88,258" />
      <polygon points="94,252 100,246 100,258" />
    </>
  )
}

const MIRROR = 'translate(220 0) scale(-1 1)'

function Part({ part, title, onSelect, children, hit }) {
  return (
    <g
      className="figure-part"
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={() => onSelect(part)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(part)
        }
      }}
    >
      <title>{title}</title>
      {children}
      {hit}
    </g>
  )
}

function Arm({ mark }) {
  const replaced = ARM_REPLACES.has(mark)
  return (
    <>
      <path className="figure-shape" d={replaced ? ARM_STUMP : ARM} />
      {replaced ? null : <ellipse className="figure-shape" {...HAND} />}
      {mark && ARM_MARKS[mark] ? (
        <g className="figure-mark" key={mark}>
          {ARM_MARKS[mark]}
        </g>
      ) : null}
    </>
  )
}

function Leg({ mark }) {
  const replaced = LEG_REPLACES.has(mark)
  return (
    <>
      <path className="figure-shape" d={replaced ? LEG_STUMP : LEG} />
      {replaced ? null : <path className="figure-shape" d={FOOT} />}
      {mark && LEG_MARKS[mark] ? (
        <g className="figure-mark" key={mark}>
          {LEG_MARKS[mark]}
        </g>
      ) : null}
    </>
  )
}

export default function CharacterFigure({ marks = {}, onPartClick, hint }) {
  const select = (part) => onPartClick && onPartClick(part)
  const limbHit = (d) => <path className="figure-hit" d={d} />

  return (
    <svg className="character-figure" width="220" height="340" viewBox="0 0 220 340" fill="none">
      {marks.head && HEAD_BACK_MARKS[marks.head] ? (
        <Part part="head" title={hint} onSelect={select}>
          <g className="figure-mark behind" key={marks.head}>
            {HEAD_BACK_MARKS[marks.head]}
          </g>
        </Part>
      ) : null}
      {marks.torso && TORSO_BACK_MARKS[marks.torso] ? (
        <Part part="torso" title={hint} onSelect={select}>
          <g className="figure-mark behind" key={marks.torso}>
            {TORSO_BACK_MARKS[marks.torso]}
          </g>
        </Part>
      ) : null}

      <Part part="legL" title={hint} onSelect={select} hit={limbHit(LEG + ' ' + FOOT)}>
        <Leg mark={marks.legL} />
      </Part>
      <g transform={MIRROR}>
        <Part part="legR" title={hint} onSelect={select} hit={limbHit(LEG + ' ' + FOOT)}>
          <Leg mark={marks.legR} />
        </Part>
      </g>

      <g transform={ARM_SHIFT}>
        <Part part="armL" title={hint} onSelect={select} hit={limbHit(ARM)}>
          <Arm mark={marks.armL} />
        </Part>
      </g>
      <g transform={`${MIRROR} ${ARM_SHIFT}`}>
        <Part part="armR" title={hint} onSelect={select} hit={limbHit(ARM)}>
          <Arm mark={marks.armR} />
        </Part>
      </g>

      <Part part="torso" title={hint} onSelect={select} hit={limbHit(TORSO)}>
        <path className="figure-shape" d={TORSO} />
        {marks.torso && TORSO_MARKS[marks.torso] ? (
          <g className="figure-mark" key={marks.torso}>
            {TORSO_MARKS[marks.torso]}
          </g>
        ) : null}
      </Part>


      <Part part="head" title={hint} onSelect={select} hit={<ellipse className="figure-hit" {...HEAD} />}>
        <ellipse className="figure-shape" {...HEAD} />
        {marks.head && HEAD_MARKS[marks.head] ? (
          <g className="figure-mark" key={marks.head}>
            {HEAD_MARKS[marks.head]}
          </g>
        ) : null}
      </Part>
    </svg>
  )
}
