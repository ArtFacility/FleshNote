import React from 'react'
import { useTranslation } from 'react-i18next'

export default function NewProjectChoiceModal({ onSelect, onClose }) {
  const { t } = useTranslation()

  return (
    <div
      className="popup-overlay"
      onClick={onClose}
      style={{
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)'
      }}
    >
      <div
        className="popup-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '600px',
          maxWidth: '92vw',
          backgroundColor: 'var(--bg-base, #121216)',
          border: '1px solid var(--border-default, rgba(255, 255, 255, 0.16))',
          borderRadius: 0,
          padding: '30px 34px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '11px',
                color: 'var(--accent-amber, #d97706)',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span
                style={{
                  fontFamily: "'Noto Sans Old Hungarian', 'NotoOldHungarian', var(--font-mono, monospace)",
                  fontSize: '14px',
                  color: 'var(--accent-amber, #d97706)',
                  lineHeight: 1
                }}
              >
                𐳌𐳖𐳉𐳤𐳙𐳛𐳦𐳉
              </span>
              <span>// {t('choiceModal.badge', 'PROJECT INITIALIZATION')}</span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: 'var(--text-primary, #eee)',
                fontFamily: 'var(--font-sans, sans-serif)'
              }}
            >
              {t('choiceModal.question', 'Do you have a concrete plan for your story?')}
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
              padding: '2px 6px'
            }}
          >
            &times;
          </button>
        </div>

        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary, #aaa)',
            lineHeight: 1.5,
            marginTop: 0,
            marginBottom: '26px'
          }}
        >
          {t(
            'choiceModal.subtitle',
            'Select whether you want to quickly configure a project with existing ideas or use our guided framework planner to architect your plot beats.'
          )}
        </p>

        {/* The Two Choice Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Choice 1: Fast-track / Standard */}
          <div
            onClick={() => onSelect('quick')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              padding: '20px 22px',
              backgroundColor: 'var(--bg-elevated, #1a1a22)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-secondary, #888)'
              e.currentTarget.style.backgroundColor = 'var(--bg-surface, #22222c)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle, rgba(255, 255, 255, 0.1))'
              e.currentTarget.style.backgroundColor = 'var(--bg-elevated, #1a1a22)'
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <span
                style={{
                  fontFamily: "'Noto Sans Old Hungarian', 'NotoOldHungarian', var(--font-mono, monospace)",
                  fontSize: '22px',
                  color: 'var(--text-primary, #eee)',
                  lineHeight: 1
                }}
              >
                𐳌
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <strong style={{ fontSize: '14.5px', color: 'var(--text-primary, #eee)' }}>
                  {t('choiceModal.quickTitle', 'Yes, I have a concrete plan')}
                </strong>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: '2px 6px',
                    borderRadius: 0,
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-secondary, #aaa)',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t('choiceModal.quickBadge', 'Fast-Track')}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #999)', lineHeight: 1.4 }}>
                {t(
                  'choiceModal.quickDesc',
                  'Standard questionnaire: set up your metadata, worldbuilding modules, and dive straight into writing.'
                )}
              </div>
            </div>
          </div>

          {/* Choice 2: Story Architect & Plot Frameworks */}
          <div
            onClick={() => onSelect('architect')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              padding: '20px 22px',
              backgroundColor: 'rgba(217, 119, 6, 0.06)',
              border: '1px solid rgba(217, 119, 6, 0.35)',
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-amber, #d97706)'
              e.currentTarget.style.backgroundColor = 'rgba(217, 119, 6, 0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(217, 119, 6, 0.35)'
              e.currentTarget.style.backgroundColor = 'rgba(217, 119, 6, 0.06)'
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 0,
                backgroundColor: 'rgba(217, 119, 6, 0.15)',
                border: '1px solid var(--accent-amber, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <span
                style={{
                  fontFamily: "'Noto Sans Old Hungarian', 'NotoOldHungarian', var(--font-mono, monospace)",
                  fontSize: '22px',
                  color: 'var(--accent-amber, #d97706)',
                  lineHeight: 1
                }}
              >
                𐲦
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <strong style={{ fontSize: '14.5px', color: 'var(--accent-amber, #d97706)' }}>
                  {t('choiceModal.architectTitle', "I don't know my story yet / Help me architect")}
                </strong>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: '2px 6px',
                    borderRadius: 0,
                    border: '1px solid rgba(217, 119, 6, 0.3)',
                    backgroundColor: 'rgba(217, 119, 6, 0.15)',
                    color: 'var(--accent-amber, #d97706)',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t('choiceModal.architectBadge', 'Framework Suite')}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #bbb)', lineHeight: 1.4 }}>
                {t(
                  'choiceModal.architectDesc',
                  'Discover structural frameworks with the Story Compass, explore dynamic tension curves and craft notes, and scaffold beats.'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer cancel button */}
        <div style={{ marginTop: '26px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
              color: 'var(--text-secondary, #aaa)',
              borderRadius: 0,
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.5px'
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
