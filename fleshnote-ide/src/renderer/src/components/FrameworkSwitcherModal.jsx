import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NarrativeCurveView from './NarrativeCurveView'
import { applyFrameworkVariant } from '../utils/frameworkStack'

export default function FrameworkSwitcherModal({
  projectPath,
  projectConfig = null,
  currentFrameworkId = null,
  existingBlockCount = 0,
  onClose,
  onApplied
}) {
  const { t } = useTranslation()
  const [frameworks, setFrameworks] = useState([])
  const [emotionalArcs, setEmotionalArcs] = useState([])
  const [selectedId, setSelectedId] = useState(currentFrameworkId || 'three_act')
  const [variantId, setVariantId] = useState('')
  const [wipeMode, setWipeMode] = useState('wipe') // 'wipe' | 'overlay'
  const [showHelpingMarkers, setShowHelpingMarkers] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    if (window.api?.getPlannerFrameworks) {
      window.api
        .getPlannerFrameworks()
        .then((res) => {
          if (isMounted && res.status === 'ok' && res.frameworks) {
            setFrameworks(res.frameworks)
            setEmotionalArcs(res.arcs || [])
            if (!currentFrameworkId && res.frameworks.length > 0) {
              setSelectedId(res.frameworks[0].id)
            }
          }
        })
        .catch((err) => {
          if (isMounted) setError(err.message || 'Failed to load frameworks')
        })
        .finally(() => {
          if (isMounted) setLoading(false)
        })
    }
    return () => {
      isMounted = false
    }
  }, [currentFrameworkId])

  const selectedFramework = frameworks.find((f) => f.id === selectedId) || frameworks[0]
  const frameworkVariants = selectedFramework?.variants || []

  // Reset flavor to the framework default whenever the selection changes
  useEffect(() => {
    setVariantId((selectedFramework?.variants || [])[0]?.id || '')
  }, [selectedId])

  const displayFramework = useMemo(
    () => applyFrameworkVariant(selectedFramework, variantId),
    [selectedFramework, variantId]
  )

  // Stored project config drives the blue character-state line in the preview
  const storedArc = useMemo(
    () => emotionalArcs.find((a) => a.id === projectConfig?.emotional_arc) || null,
    [emotionalArcs, projectConfig]
  )

  const handleApply = async () => {
    if (!selectedFramework) return
    setSubmitting(true)
    setError(null)
    try {
      const wipeExisting = wipeMode === 'wipe'
      const res = await window.api.applyPlannerFramework({
        project_path: projectPath,
        framework_id: selectedFramework.id,
        variant_id: variantId || null,
        wipe_existing: wipeExisting
      })
      if (res.status === 'ok') {
        if (onApplied) onApplied(res)
        onClose()
      } else {
        setError(res.error || 'Failed to apply framework')
      }
    } catch (err) {
      console.error('Failed to apply framework:', err)
      setError(err.message || 'Error applying framework')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="popup-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(6px)',
        padding: '24px'
      }}
    >
      <div
        className="popup-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '1100px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-base, #111115)',
          border: '1px solid var(--border-default, rgba(255, 255, 255, 0.14))',
          borderRadius: 0,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 28px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'var(--bg-elevated, #16161b)'
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '11px',
                color: 'var(--accent-amber, #d97706)',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: '4px'
              }}
            >
              {t('frameworkSwitcher.badge', 'PLOT ARCHITECT // NARRATIVE FRAMEWORKS')}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '19px',
                fontWeight: '600',
                color: 'var(--text-primary, #eee)',
                fontFamily: 'var(--font-sans, sans-serif)'
              }}
            >
              {t('frameworkSwitcher.title', 'Narrative Framework Switcher')}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary, #888)',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '6px 10px',
              borderRadius: 0,
              transition: 'all 0.15s'
            }}
            title={t('common.close', 'Close')}
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div
            style={{
              padding: '60px',
              textAlign: 'center',
              color: 'var(--text-secondary, #aaa)',
              fontFamily: 'var(--font-mono, monospace)'
            }}
          >
            {t('frameworkSwitcher.loading', 'Loading narrative frameworks...')}
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: '420px' }}>
            {/* Left Sidebar: Framework Selection List */}
            <div
              style={{
                width: '260px',
                minWidth: '240px',
                flexShrink: 0,
                borderRight: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                overflowY: 'auto',
                padding: '14px'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--text-tertiary, #777)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '10px',
                  paddingLeft: '4px'
                }}
              >
                {t('frameworkSwitcher.availableCatalog', 'Framework Catalog')} ({frameworks.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {frameworks.map((fw) => {
                  const isSelected = fw.id === selectedId
                  return (
                    <div
                      key={fw.id}
                      onClick={() => setSelectedId(fw.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 0,
                        border: isSelected
                          ? '1px solid var(--accent-amber, #d97706)'
                          : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                        backgroundColor: isSelected
                          ? 'rgba(217, 119, 6, 0.12)'
                          : 'var(--bg-elevated, #16161b)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '3px'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: isSelected ? 'var(--accent-amber, #d97706)' : 'var(--text-primary, #ddd)'
                          }}
                        >
                          {fw.name}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono, monospace)',
                            padding: '2px 5px',
                            borderRadius: 0,
                            backgroundColor: isSelected
                              ? 'rgba(217, 119, 6, 0.25)'
                              : 'rgba(255, 255, 255, 0.06)',
                            color: isSelected ? 'var(--accent-amber, #d97706)' : 'var(--text-tertiary, #888)'
                          }}
                        >
                          {fw.beats?.length || 0} beats
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-tertiary, #888)',
                          fontStyle: 'italic',
                          lineHeight: '1.25'
                        }}
                      >
                        {fw.subtitle}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Panel: Framework Details, Dynamic Tension Curve, Beats, & Apply Mode */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                overflowY: 'auto',
                padding: '18px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {selectedFramework && (
                <>
                  {/* Title & Description */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: '0 0 4px 0',
                            fontSize: '17px',
                            fontWeight: '600',
                            color: 'var(--text-primary, #fff)'
                          }}
                        >
                          {selectedFramework.name}
                        </h3>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--accent-amber, #d97706)',
                            fontFamily: 'var(--font-mono, monospace)',
                            marginBottom: '6px'
                          }}
                        >
                          {selectedFramework.subtitle} &bull; {selectedFramework.acts?.length || 3} Acts
                        </div>
                      </div>

                      {/* Helping Markers Toggle */}
                      <button
                        type="button"
                        onClick={() => setShowHelpingMarkers(!showHelpingMarkers)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: showHelpingMarkers
                            ? 'rgba(217, 119, 6, 0.15)'
                            : 'rgba(255, 255, 255, 0.05)',
                          border: showHelpingMarkers
                            ? '1px solid var(--accent-amber, #d97706)'
                            : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                          borderRadius: 0,
                          padding: '5px 10px',
                          color: showHelpingMarkers
                            ? 'var(--accent-amber, #d97706)'
                            : 'var(--text-tertiary, #888)',
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontFamily: 'NotoSansOldHungarian, var(--font-mono)' }}>𐳍</span>
                        <span>{showHelpingMarkers ? t('narrativeCurve.hideMarkers', 'Hide Rovás Notes') : t('narrativeCurve.showMarkers', 'Show Rovás Notes')}</span>
                      </button>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '12.5px',
                        lineHeight: '1.45',
                        color: 'var(--text-secondary, #bbb)'
                      }}
                    >
                      {selectedFramework.description}
                    </p>
                  </div>

                  {/* Structure Flavor variant chips */}
                  {frameworkVariants.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '10px',
                          color: 'var(--text-tertiary, #888)',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          marginBottom: '6px'
                        }}
                      >
                        {t('architect.flavorTitle', 'STRUCTURE FLAVOR')}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {frameworkVariants.map((v) => {
                          const isSel = v.id === variantId
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setVariantId(v.id)}
                              title={v.description}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: isSel ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                                border: isSel
                                  ? '1px solid var(--accent-amber, #d97706)'
                                  : '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                                color: isSel ? 'var(--accent-amber, #d97706)' : 'var(--text-secondary, #999)',
                                borderRadius: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '11px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {v.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tension Curve Visualizer */}
                  <div
                    style={{
                      border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                      borderRadius: 0,
                      overflow: 'hidden',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 12px',
                        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '11px',
                        color: 'var(--text-tertiary, #888)'
                      }}
                    >
                      <span>{t('narrativeCurve.tensionPreview', 'Dynamic Tension Curve & Rovás Craft Inflection Points')}</span>
                      <span style={{ color: 'var(--accent-blue, #60a5fa)' }}>
                        {selectedFramework.curve_points?.length || 0} control nodes
                      </span>
                    </div>
                    <div style={{ padding: '6px 8px' }}>
                      <NarrativeCurveView
                        framework={displayFramework}
                        height={190}
                        showHelpingMarkers={showHelpingMarkers}
                        onToggleHelpingMarkers={() => setShowHelpingMarkers(!showHelpingMarkers)}
                        interactive={true}
                        compact={true}
                        internalCurve={storedArc?.internal_curve}
                        characterLabel={projectConfig?.framework_protagonist || ''}
                      />
                    </div>
                  </div>

                  {/* Beat Progression Overview */}
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '11px',
                        color: 'var(--text-tertiary, #888)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '8px'
                      }}
                    >
                      {t('frameworkSwitcher.beatProgression', 'Beat Progression')} ({selectedFramework.beats?.length || 0})
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                        gap: '8px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        paddingRight: '6px'
                      }}
                    >
                      {selectedFramework.beats?.map((beat, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: 'var(--bg-elevated, #16161b)',
                            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                            borderRadius: 0
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '2px'
                            }}
                          >
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: 'var(--text-primary, #ddd)'
                              }}
                            >
                              {idx + 1}. {beat.label}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                fontFamily: 'var(--font-mono, monospace)',
                                color: 'var(--accent-amber, #d97706)'
                              }}
                            >
                              {Math.round(beat.pct * 100)}%
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-tertiary, #888)',
                              lineHeight: '1.3'
                            }}
                          >
                            {beat.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Application Mode (Wipe vs Overlay) */}
                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                      paddingTop: '16px'
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '11px',
                        color: 'var(--accent-amber, #d97706)',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        marginBottom: '8px'
                      }}
                    >
                      {t('frameworkSwitcher.applyMode', 'Application Strategy')}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div
                        onClick={() => setWipeMode('wipe')}
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          borderRadius: 0,
                          border: wipeMode === 'wipe'
                            ? '1px solid var(--accent-red, #e11d48)'
                            : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                          backgroundColor: wipeMode === 'wipe'
                            ? 'rgba(225, 29, 72, 0.1)'
                            : 'var(--bg-elevated, #16161b)',
                          cursor: 'pointer'
                        }}
                      >
                        <div
                          style={{
                            fontWeight: '600',
                            fontSize: '13px',
                            color: wipeMode === 'wipe' ? 'var(--accent-red, #e11d48)' : 'var(--text-primary, #ddd)',
                            marginBottom: '4px'
                          }}
                        >
                          {t('frameworkSwitcher.wipeTitle', 'Wipe and Replace (Clean Slate)')}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-tertiary, #888)',
                            lineHeight: '1.4'
                          }}
                        >
                          {t(
                            'frameworkSwitcher.wipeDesc',
                            'Replaces existing planner blocks and tension arcs with the selected framework beats and tension curve. (Existing manuscript chapters are preserved).'
                          )}
                        </div>
                        {existingBlockCount > 0 && wipeMode === 'wipe' && (
                          <div
                            style={{
                              marginTop: '6px',
                              fontSize: '11px',
                              color: 'var(--accent-red, #e11d48)',
                              fontFamily: 'var(--font-mono, monospace)'
                            }}
                          >
                            &bull; {existingBlockCount} {t('frameworkSwitcher.blocksWillBeReplaced', 'existing block(s) will be replaced.')}
                          </div>
                        )}
                      </div>

                      <div
                        onClick={() => setWipeMode('overlay')}
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          borderRadius: 0,
                          border: wipeMode === 'overlay'
                            ? '1px solid var(--accent-blue, #3b82f6)'
                            : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                          backgroundColor: wipeMode === 'overlay'
                            ? 'rgba(59, 130, 246, 0.1)'
                            : 'var(--bg-elevated, #16161b)',
                          cursor: 'pointer'
                        }}
                      >
                        <div
                          style={{
                            fontWeight: '600',
                            fontSize: '13px',
                            color: wipeMode === 'overlay' ? 'var(--accent-blue, #60a5fa)' : 'var(--text-primary, #ddd)',
                            marginBottom: '4px'
                          }}
                        >
                          {t('frameworkSwitcher.overlayTitle', 'Keep Existing (Overlay Beats)')}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-tertiary, #888)',
                            lineHeight: '1.4'
                          }}
                        >
                          {t(
                            'frameworkSwitcher.overlayDesc',
                            'Appends the framework beat blocks without deleting your current planner blocks or custom narrative arcs.'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'rgba(225, 29, 72, 0.15)',
                    border: '1px solid var(--accent-red, #e11d48)',
                    borderRadius: 0,
                    color: 'var(--accent-red, #e11d48)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono, monospace)'
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 28px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'var(--bg-elevated, #16161b)'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              color: 'var(--text-secondary, #ccc)',
              borderRadius: 0,
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono, monospace)'
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={submitting || !selectedFramework}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 22px',
              backgroundColor: 'var(--accent-amber, #d97706)',
              border: 'none',
              color: '#111',
              fontWeight: '600',
              borderRadius: 0,
              fontSize: '12px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-mono, monospace)',
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting
              ? t('frameworkSwitcher.applying', 'Applying Framework...')
              : t('frameworkSwitcher.applyButton', 'Apply Framework')}
          </button>
        </div>
      </div>
    </div>
  )
}
