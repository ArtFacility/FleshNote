// Line icons for the sketchboard's toolbars (16px, currentColor, square caps: hard edges).
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter'
}
const I = (children) => (
  <svg {...base} aria-hidden="true">
    {children}
  </svg>
)

export const Icon = {
  select: I(<path d="M3 2 L3 13 L6.2 10 L8.4 14.5 L10.2 13.6 L8 9.2 L12.3 9.2 Z" />),
  hand: I(
    <path d="M5 8 V3.5 a1 1 0 0 1 2 0 V7 M7 7 V2.5 a1 1 0 0 1 2 0 V7 M9 7 V3.5 a1 1 0 0 1 2 0 V8 M11 8 V5.5 a1 1 0 0 1 2 0 V10 c0 2.5 -2 4.5 -4.5 4.5 S4 13 3 11 L2 8.5 a1 1 0 0 1 1.8 -0.9 L5 9.5" />
  ),
  card: I(<rect x="2" y="4" width="12" height="8" />),
  diamond: I(<path d="M8 2 L14 8 L8 14 L2 8 Z" />),
  ellipse: I(<ellipse cx="8" cy="8" rx="6" ry="4.5" />),
  hex: I(<path d="M4.5 3 H11.5 L14.5 8 L11.5 13 H4.5 L1.5 8 Z" />),
  text: I(<path d="M3 3.5 H13 M8 3.5 V13 M6 13 H10" />),
  frame: I(
    <>
      <path d="M2 5 V2 H5 M11 2 H14 V5 M14 11 V14 H11 M5 14 H2 V11" />
      <path d="M4.5 4.5 H9" strokeWidth="1" />
    </>
  ),
  straight: I(<path d="M2.5 13.5 L13.5 2.5" />),
  curved: I(<path d="M2.5 13.5 C 3 5, 13 11, 13.5 2.5" />),
  elbow: I(<path d="M2.5 13.5 V8 H13.5 V2.5" />),
  trash: I(
    <path d="M3 4.5 H13 M6 4.5 V2.5 H10 V4.5 M4.5 4.5 L5.2 14 H10.8 L11.5 4.5 M7 7 V11.5 M9 7 V11.5" />
  ),
  link: I(
    <path d="M6.5 9.5 L9.5 6.5 M7 4.5 L8.5 3 a2.5 2.5 0 0 1 3.5 3.5 L10.5 8 M9 11.5 L7.5 13 a2.5 2.5 0 0 1 -3.5 -3.5 L5.5 8" />
  ),
  unlink: I(
    <path d="M7 4.5 L8.5 3 a2.5 2.5 0 0 1 3.5 3.5 L10.5 8 M9 11.5 L7.5 13 a2.5 2.5 0 0 1 -3.5 -3.5 L5.5 8 M2.5 2.5 L13.5 13.5" />
  ),
  fit: I(<path d="M2 6 V2 H6 M10 2 H14 V6 M14 10 V14 H10 M6 14 H2 V10" />),
  plus: I(<path d="M8 3 V13 M3 8 H13" />),
  minus: I(<path d="M3 8 H13" />),
  undo: I(<path d="M5.5 3 L2.5 6 L5.5 9 M2.5 6 H10 a3.5 3.5 0 0 1 0 7 H6" />),
  redo: I(<path d="M10.5 3 L13.5 6 L10.5 9 M13.5 6 H6 a3.5 3.5 0 0 0 0 7 H10" />),
  help: I(
    <>
      <path d="M6 6 a2 2 0 1 1 3 1.7 C8.3 8.2 8 8.6 8 9.5" />
      <path d="M8 12 V12.5" strokeWidth="1.8" />
    </>
  ),
  panel: I(
    <>
      <rect x="2" y="2.5" width="12" height="11" />
      <path d="M10 2.5 V13.5" />
    </>
  ),
  swap: I(<path d="M3 5.5 H13 M10.5 3 L13 5.5 L10.5 8 M13 10.5 H3 M5.5 8 L3 10.5 L5.5 13" />),
  close: I(<path d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5" />),
  alignLeft: I(<path d="M2.5 2 V14 M5 4.5 H13 V7.5 H5 Z M5 9.5 H10 V12.5 H5 Z" />),
  alignHCenter: I(<path d="M8 2 V14 M3.5 4.5 H12.5 V7.5 H3.5 Z M5.5 9.5 H10.5 V12.5 H5.5 Z" />),
  alignRight: I(<path d="M13.5 2 V14 M3 4.5 H11 V7.5 H3 Z M6 9.5 H11 V12.5 H6 Z" />),
  alignTop: I(<path d="M2 2.5 H14 M4.5 5 V13 H7.5 V5 Z M9.5 5 V10 H12.5 V5 Z" />),
  alignVCenter: I(<path d="M2 8 H14 M4.5 3.5 V12.5 H7.5 V3.5 Z M9.5 5.5 V10.5 H12.5 V5.5 Z" />),
  alignBottom: I(<path d="M2 13.5 H14 M4.5 3 V11 H7.5 V3 Z M9.5 6 V11 H12.5 V6 Z" />),
  spaceH: I(<path d="M2 2 V14 M14 2 V14 M6 5 H10 V11 H6 Z" />),
  spaceV: I(<path d="M2 2 H14 M2 14 H14 M5 6 H11 V10 H5 Z" />),
  download: I(<path d="M8 2.5 V10.5 M4.5 7 L8 10.5 L11.5 7 M2.5 13.5 H13.5" />),
  book: I(
    <>
      <path d="M2.5 3 H7 L8 4 L9 3 H13.5 V13 H9 L8 14 L7 13 H2.5 Z" />
      <path d="M8 4 V14" />
    </>
  ),
  clock: I(
    <>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M8 5 V8 H10.5" />
    </>
  ),
  prev: I(<path d="M10 3 L5 8 L10 13" />),
  next: I(<path d="M6 3 L11 8 L6 13" />),
  eye: I(
    <>
      <path d="M1.5 8 L5 4.5 H11 L14.5 8 L11 11.5 H5 Z" />
      <rect x="6.75" y="6.75" width="2.5" height="2.5" />
    </>
  ),
  appearHere: I(<path d="M3 13 V3 M3 8 H13 M10 5 L13 8 L10 11" />),
  endHere: I(<path d="M13 13 V3 M3 8 H13 M6 5 L3 8 L6 11" />),
  tag: I(
    <>
      <path d="M2.5 2.5 H8 L13.5 8 L8 13.5 L2.5 8 Z" />
      <path d="M5.5 5.5 H5.6" strokeWidth="1.8" />
    </>
  ),
  dashSolid: I(<path d="M2 8 H14" />),
  dashDashed: I(<path d="M2 8 H14" strokeDasharray="3.5 2" />),
  dashDotted: I(<path d="M2 8 H14" strokeDasharray="1 2.2" />)
}

/** A connection-end marker drawn pointing right, for the marker buttons. */
export function MarkerIcon({ kind, flip = false }) {
  const tip = flip ? 3 : 13
  const d = flip ? 1 : -1
  return (
    <svg {...base} aria-hidden="true">
      <path d={`M${flip ? 13 : 3} 8 H${tip}`} />
      {kind === 'arrow' && (
        <path d={`M${tip} 8 L${tip + d * 5} 5 L${tip + d * 5} 11 Z`} fill="currentColor" />
      )}
      {kind === 'bar' && <path d={`M${tip + d * 2} 4.5 V11.5`} />}
      {kind === 'dot' && <circle cx={tip + d * 2} cy="8" r="2.2" fill="currentColor" />}
      {kind === 'diamond' && (
        <path
          d={`M${tip} 8 L${tip + d * 3.5} 5.5 L${tip + d * 7} 8 L${tip + d * 3.5} 10.5 Z`}
          fill="currentColor"
        />
      )}
    </svg>
  )
}
