import React, { useState, useMemo, useRef, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Computes smooth cubic Bezier path string through an array of {x, y} points.
 */
function getSmoothCurvePath(pts) {
  if (!pts || pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`

  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 5
    const cp1y = p1.y + (p2.y - p0.y) / 5
    const cp2x = p2.x - (p3.x - p1.x) / 5
    const cp2y = p2.y - (p3.y - p1.y) / 5

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

/**
 * Linearly interpolates tension for a given pct from curve_points.
 */
function interpolateTension(points, pct) {
  if (!points || points.length === 0) return 0.5
  if (pct <= points[0].pct) return points[0].tension
  if (pct >= points[points.length - 1].pct) return points[points.length - 1].tension

  for (let i = 0; i < points.length - 1; i++) {
    if (pct >= points[i].pct && pct <= points[i + 1].pct) {
      const t = (pct - points[i].pct) / (points[i + 1].pct - points[i].pct || 1)
      return points[i].tension + t * (points[i + 1].tension - points[i].tension)
    }
  }
  return 0.5
}

export default function NarrativeCurveView({
  framework,
  height = 220,
  showHelpingMarkers = true,
  onToggleHelpingMarkers = null,
  interactive = true,
  compact = false,
  internalCurve = null,
  characterLabel = '',
  stakesLabelOverride = null
}) {
  const { t } = useTranslation()
  const containerRef = useRef(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradientId = `curveGradient-${uid}`
  const glowId = `glow-${uid}`
  const [containerWidth, setContainerWidth] = useState(800)
  const [activeMarker, setActiveMarker] = useState(null)
  const [internalShowMarkers, setInternalShowMarkers] = useState(true)

  const isMarkersVisible = onToggleHelpingMarkers ? showHelpingMarkers : internalShowMarkers
  const toggleMarkers = onToggleHelpingMarkers || (() => setInternalShowMarkers((prev) => !prev))

  // Dynamically track real container width to prevent SVG aspect ratio squishing
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      if (entries[0]) {
        const w = entries[0].contentRect.width
        if (w > 0) setContainerWidth(w)
      }
    })
    ro.observe(containerRef.current)
    const initialWidth = containerRef.current.clientWidth
    if (initialWidth > 0) setContainerWidth(initialWidth)
    return () => ro.disconnect()
  }, [])

  const width = Math.max(300, containerWidth - (compact ? 16 : 32))

  const hasInternal = Array.isArray(internalCurve) && internalCurve.length > 0

  // Wider left pad when the character-state axis captions are present
  const padX = hasInternal
    ? Math.max(46, Math.min(58, width * 0.055))
    : Math.max(20, Math.min(36, width * 0.045))
  const padTop = 22
  const padBottom = 46
  const graphH = Math.max(60, height - padTop - padBottom)

  const curvePoints = framework?.curve_points || [
    { pct: 0, tension: 0.2 },
    { pct: 50, tension: 0.5 },
    { pct: 100, tension: 0.2 }
  ]

  const screenPoints = useMemo(() => {
    return curvePoints.map((pt) => ({
      x: padX + (pt.pct / 100) * (width - 2 * padX),
      y: padTop + (1 - Math.max(0, Math.min(1, pt.tension))) * graphH
    }))
  }, [curvePoints, graphH, width, padX])

  const curvePath = useMemo(() => getSmoothCurvePath(screenPoints), [screenPoints])

  const internalScreenPoints = useMemo(() => {
    if (!hasInternal) return []
    return internalCurve.map((pt) => ({
      x: padX + (pt.pct / 100) * (width - 2 * padX),
      y: padTop + (1 - Math.max(0, Math.min(1, pt.state))) * graphH
    }))
  }, [internalCurve, hasInternal, graphH, width, padX])

  const internalPath = useMemo(
    () => (internalScreenPoints.length ? getSmoothCurvePath(internalScreenPoints) : ''),
    [internalScreenPoints]
  )

  const areaPath = useMemo(() => {
    if (screenPoints.length === 0) return ''
    const firstX = screenPoints[0].x
    const lastX = screenPoints[screenPoints.length - 1].x
    const bottomY = padTop + graphH
    return `${curvePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
  }, [curvePath, screenPoints, graphH])

  const craftMarkersWithPos = useMemo(() => {
    const markers = framework?.craft_markers || []
    return markers.map((m) => {
      const tension = interpolateTension(curvePoints, m.pct)
      const x = padX + (m.pct / 100) * (width - 2 * padX)
      const y = padTop + (1 - tension) * graphH
      return { ...m, x, y }
    })
  }, [framework, curvePoints, graphH, width, padX])

  const arcs = framework?.arcs || []

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        background: compact ? 'transparent' : 'var(--bg-base, #111114)',
        border: compact ? 'none' : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        borderRadius: 0,
        padding: compact ? '4px 8px' : '16px',
        userSelect: 'none'
      }}
    >
      {/* Top Header: Title & Helping Markers Toggle (omitted in compact mode) */}
      {!compact && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--text-tertiary, #888)'
              }}
            >
              {t('narrativeCurve.pacingGraph', 'Dramatic Intensity Curve')}
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                background: 'rgba(217, 119, 6, 0.12)',
                color: 'var(--accent-amber, #d97706)',
                borderRadius: 0,
                fontFamily: 'var(--font-mono, monospace)'
              }}
            >
              {framework?.name || 'Structure'}
            </span>
          </div>

          {/* Toggle Helping Markers */}
          <button
            type="button"
            onClick={toggleMarkers}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: isMarkersVisible ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
              border: isMarkersVisible
                ? '1px solid var(--accent-amber, #d97706)'
                : '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
              color: isMarkersVisible ? 'var(--accent-amber, #d97706)' : 'var(--text-secondary, #aaa)',
              borderRadius: 0,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              transition: 'all 0.2s ease'
            }}
          >
            <span
              style={{
                fontFamily: "'NotoSansOldHungarian', var(--font-mono, monospace)",
                fontSize: '13px',
                lineHeight: 1
              }}
            >
              𐲀
            </span>
            <span>{t('narrativeCurve.helpingMarkers', 'Craft Annotations')}</span>
            <span
              style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: 0,
                backgroundColor: isMarkersVisible ? 'var(--accent-amber, #d97706)' : 'var(--border-default, #444)',
                boxShadow: isMarkersVisible ? '0 0 6px var(--accent-amber, #d97706)' : 'none'
              }}
            />
          </button>
        </div>
      )}

      {/* Curve legend: two-layer semantics */}
      {hasInternal && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '6px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '10px',
            flexWrap: 'wrap'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '14px',
                height: '2px',
                background: 'var(--accent-amber, #d97706)'
              }}
            />
            <span style={{ color: 'var(--accent-amber, #d97706)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {stakesLabelOverride || t('narrativeCurve.legendStakes', 'Stakes & Tension')}
            </span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '14px',
                height: '0',
                borderTop: '2px dashed var(--accent-blue, #5c8ec4)'
              }}
            />
            <span style={{ color: 'var(--accent-blue, #5c8ec4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {characterLabel
                ? t('narrativeCurve.legendCharacterNamed', '{{name}} — Character State', { name: characterLabel })
                : t('narrativeCurve.legendCharacter', 'Character State')}
            </span>
          </span>
        </div>
      )}

      {/* SVG Canvas with 1:1 pixel coordinate matching */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            {/* Gradient for area fill under curve */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-amber, #d97706)" stopOpacity="0.28" />
              <stop offset="60%" stopColor="var(--accent-amber, #d97706)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--accent-amber, #d97706)" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing filter for nodes */}
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Y-axis captions: color-coded semantics for both layers */}
          {hasInternal && (
            <g
              fill="var(--text-tertiary, #888)"
              fontSize="8"
              fontFamily="var(--font-mono, monospace)"
              textAnchor="end"
              style={{ textTransform: 'uppercase' }}
            >
              <text x={padX - 7} y={padTop + 8} fill="var(--accent-amber, #d97706)">
                {t('narrativeCurve.axisPeak', 'PEAK')}
              </text>
              <text x={padX - 7} y={padTop + 18} fill="var(--accent-blue, #5c8ec4)">
                {t('narrativeCurve.axisTriumph', 'TRIUMPH')}
              </text>
              <text x={padX - 7} y={padTop + graphH - 2} fill="var(--accent-amber, #d97706)">
                {t('narrativeCurve.axisStasis', 'STASIS')}
              </text>
              <text x={padX - 7} y={padTop + graphH - 12} fill="var(--accent-blue, #5c8ec4)">
                {t('narrativeCurve.axisDespair', 'DESPAIR')}
              </text>
              <line
                x1={padX}
                y1={padTop}
                x2={padX}
                y2={padTop + graphH}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
              />
            </g>
          )}

          {/* Grid lines (horizontal tension guides) */}
          {[0.25, 0.5, 0.75, 1.0].map((level) => {
            const y = padTop + (1 - level) * graphH
            return (
              <line
                key={level}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4,4"
              />
            )
          })}

          {/* Act Divider vertical regions */}
          {arcs.map((arc, aIdx) => {
            const startX = padX + (arc.start_pct / 100) * (width - 2 * padX)
            const endX = padX + (arc.end_pct / 100) * (width - 2 * padX)
            const arcW = endX - startX
            const bottomY = padTop + graphH

            return (
              <g key={aIdx}>
                {/* Vertical act divider */}
                {arc.start_pct > 0 && (
                  <line
                    x1={startX}
                    y1={padTop}
                    x2={startX}
                    y2={bottomY}
                    stroke="rgba(255,255,255,0.12)"
                    strokeDasharray="2,3"
                  />
                )}
                {/* Bottom Act Ribbon Strip */}
                <rect
                  x={startX + 1}
                  y={bottomY + 6}
                  width={Math.max(1, arcW - 2)}
                  height="16"
                  fill={arc.color || '#5c8ec4'}
                  fillOpacity="0.18"
                  stroke={arc.color || '#5c8ec4'}
                  strokeWidth="1"
                  strokeOpacity="0.4"
                  rx="2"
                />
                {arcW > 38 && (
                  <text
                    x={startX + arcW / 2}
                    y={bottomY + 18}
                    textAnchor="middle"
                    fill={arc.color || '#ccc'}
                    fontSize="9.5"
                    fontFamily="var(--font-mono, monospace)"
                    fontWeight="600"
                  >
                    {arcW < 70 ? (arc.name || '').replace(/Phase\s|Act\s/i, '') : arc.name}
                  </text>
                )}
              </g>
            )
          })}

          {/* Area under the curve */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Internal character-state line (blue, dashed — Layer 3 arc overlay) */}
          {hasInternal && internalPath && (
            <path
              d={internalPath}
              fill="none"
              stroke="var(--accent-blue, #5c8ec4)"
              strokeWidth="2"
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          )}

          {/* Primary animated tension curve path */}
          <path
            d={curvePath}
            fill="none"
            stroke="var(--accent-amber, #d97706)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
          />

          {/* Percentage milestones axis */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const x = padX + (pct / 100) * (width - 2 * padX)
            const y = padTop + graphH + 32
            return (
              <text
                key={pct}
                x={x}
                y={y}
                textAnchor="middle"
                fill="var(--text-tertiary, #666)"
                fontSize="9"
                fontFamily="var(--font-mono, monospace)"
              >
                {pct}%
              </text>
            )
          })}

          {/* Old Hungarian Rovás Craft Markers (True Circular Scaled) */}
          {isMarkersVisible &&
            craftMarkersWithPos.map((marker, mIdx) => {
              const isSelected = activeMarker?.title === marker.title

              return (
                <g
                  key={mIdx}
                  transform={`translate(${marker.x}, ${marker.y})`}
                  style={{ cursor: interactive ? 'pointer' : 'default' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (interactive) {
                      setActiveMarker(isSelected ? null : marker)
                    }
                  }}
                >
                  {/* Outer circle */}
                  <circle
                    r={isSelected ? '13' : '11'}
                    fill="var(--bg-deep, #0c0c0e)"
                    stroke={isSelected ? '#fff' : 'var(--accent-amber, #d97706)'}
                    strokeWidth={isSelected ? '2' : '1.5'}
                    filter={`url(#${glowId})`}
                    style={{ transition: 'all 0.2s ease' }}
                  />
                  {/* Rovás glyph letter */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isSelected ? '#fff' : 'var(--accent-amber, #d97706)'}
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="'NotoSansOldHungarian', var(--font-mono, monospace)"
                    style={{ pointerEvents: 'none' }}
                  >
                    {marker.rune}
                  </text>
                </g>
              )
            })}
        </svg>

        {/* Floating Craft Explainer Popover Card (Safely clamped inside card boundaries) */}
        {activeMarker && (() => {
          const popoverWidth = Math.min(340, width - 24)
          const halfPop = popoverWidth / 2
          const clampedX = Math.max(halfPop + 12, Math.min(width - halfPop - 12, activeMarker.x))
          const isTopHalf = activeMarker.y > height / 2

          return (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                left: `${clampedX}px`,
                top: isTopHalf ? '8px' : 'auto',
                bottom: isTopHalf ? 'auto' : '44px',
                transform: 'translateX(-50%)',
                width: `${popoverWidth}px`,
                maxWidth: 'calc(100% - 24px)',
                backgroundColor: 'var(--bg-elevated, #1c1c22)',
                border: '1px solid var(--accent-amber, #d97706)',
                borderRadius: 0,
                padding: '12px 14px',
                boxShadow: '0 8px 28px rgba(0,0,0,0.85)',
                zIndex: 50,
                animation: 'fadeIn 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontFamily: "'NotoSansOldHungarian', var(--font-mono, monospace)",
                      fontSize: '18px',
                      color: 'var(--accent-amber, #d97706)',
                      lineHeight: 1
                    }}
                  >
                    {activeMarker.rune}
                  </span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary, #eee)' }}>
                    {activeMarker.title}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMarker(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary, #888)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                    padding: '2px 4px'
                  }}
                >
                  &times;
                </button>
              </div>

              <div
                style={{
                  display: 'inline-block',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--accent-amber, #d97706)',
                  backgroundColor: 'rgba(217, 119, 6, 0.12)',
                  padding: '2px 6px',
                  borderRadius: 0,
                  marginBottom: '6px'
                }}
              >
                {activeMarker.concept} ({activeMarker.pct}%)
              </div>

              <p
                style={{
                  fontSize: '11.5px',
                  lineHeight: 1.45,
                  color: 'var(--text-secondary, #bbb)',
                  margin: 0
                }}
              >
                {activeMarker.craft_notes}
              </p>
            </div>
          )
        })()}
      </div>

      {/* Tension / Pacing Footnote Guide */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '4px',
          paddingTop: '6px',
          borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.05))',
          fontSize: '10px',
          color: 'var(--text-tertiary, #777)',
          fontFamily: 'var(--font-mono, monospace)'
        }}
      >
        <span>0% Stasis</span>
        <span>50% Fulcrum</span>
        <span>100% Climax & Resolution</span>
      </div>
    </div>
  )
}
