import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/popups.css';

const SPRINT_MODES = [
  {
    id: 'momentum',
    category: 'rewarding',
    nameKey: 'focus.modeMomentum',
    nameFallback: 'Momentum',
    descKey: 'focus.modeMomentumDesc',
    descFallback: 'Type faster to fill a bar and release magical runes.',
  },
  {
    id: 'combo',
    category: 'rewarding',
    nameKey: 'focus.modeCombo',
    nameFallback: 'Combo',
    descKey: 'focus.modeComboDesc',
    descFallback: 'Build a combo multiplier. Deleting too much breaks it.',
  },
  {
    id: 'zen',
    category: 'rewarding',
    nameKey: 'focus.modeZen',
    nameFallback: 'Zen',
    descKey: 'focus.modeZenDesc',
    descFallback: 'Grow a beautiful tree as you approach your word goal.',
  },
  {
    id: 'kamikaze',
    category: 'punishing',
    nameKey: 'focus.modeKamikaze',
    nameFallback: 'Kamikaze',
    descKey: 'focus.modeKamikazeDesc',
    descFallback: 'Words start deleting if you stop typing for 1 minute.',
  },
  {
    id: 'hemingway',
    category: 'punishing',
    nameKey: 'focus.modeHemingway',
    nameFallback: 'Hemingway',
    descKey: 'focus.modeHemingwayDesc',
    descFallback: 'Backspace and Delete keys are disabled. Write forward only.',
  },
  {
    id: 'fog',
    category: 'punishing',
    nameKey: 'focus.modeFog',
    nameFallback: 'Fog',
    descKey: 'focus.modeFogDesc',
    descFallback: 'Characters disappear outside your immediate typing radius.',
  },
];

export default function FocusSelectorPopup({ onSelectMode, onClose }) {
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState(null); // set after picking a sprint mode
  const [wordGoal, setWordGoal] = useState(400);

  const handleGoalChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setWordGoal(isNaN(val) ? 0 : val);
  };

  // Step 2: word count confirmation screen
  if (selectedMode) {
    const mode = SPRINT_MODES.find(m => m.id === selectedMode);
    return (
      <div className="popup-overlay" onClick={onClose}>
        <div
          className="popup-panel focus-selector-modal"
          onClick={(e) => e.stopPropagation()}
          style={{ width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column' }}
        >
          <div className="popup-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px', fontSize: '14px', letterSpacing: '0' }}>
            <span>{t(mode.nameKey, mode.nameFallback)}</span>
            <button className="popup-close" onClick={onClose} title={t('common.close', 'Close')}>×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 4px 4px' }}>
            <div style={{ fontSize: '11px', color: 'var(--accent-amber)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
              </svg>
              {t('focus.sprintWarning', 'Warning: You cannot exit a Sprint Mode until you type your word goal.')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('focus.wordGoal', 'Word Goal')}
              </label>
              <input
                type="number"
                value={wordGoal}
                onChange={handleGoalChange}
                autoFocus
                className="popup-search-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: '20px', margin: 0, textAlign: 'center' }}
                min="1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && wordGoal > 0) onSelectMode({ type: selectedMode, goal: wordGoal });
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedMode(null)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12
                }}
              >
                {t('ide.back', 'Back')}
              </button>
              <button
                onClick={() => onSelectMode({ type: selectedMode, goal: wordGoal })}
                disabled={!wordGoal || wordGoal < 1}
                style={{
                  padding: '8px 20px',
                  background: 'var(--accent-amber)',
                  color: 'var(--bg-deep)',
                  border: 'none',
                  cursor: wordGoal > 0 ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 'bold',
                  opacity: wordGoal > 0 ? 1 : 0.5
                }}
              >
                {t('focus.startSprint', 'Start Sprint')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: mode selection (no word goal input here)
  const rewarding = SPRINT_MODES.filter(m => m.category === 'rewarding');
  const punishing = SPRINT_MODES.filter(m => m.category === 'punishing');

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel focus-selector-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '560px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
      >
        <div className="popup-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px', fontSize: '14px', letterSpacing: '0' }}>
          <span>{t('focus.selectMode', 'Select Focus Mode')}</span>
          <button className="popup-close" onClick={onClose} title={t('common.close', 'Close')}>×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>

          {/* Normal Mode */}
          <div className="focus-category">
            <h3 className="focus-category-title">{t('focus.categoryNormal', 'Standard Focus')}</h3>
            <div className="focus-modes-grid">
              <button
                className="focus-mode-btn active-mode-btn"
                onClick={() => onSelectMode({ type: 'normal', goal: null })}
              >
                <div className="focus-mode-name">{t('focus.modeNormal', 'Normal Mode')}</div>
                <div className="focus-mode-desc">
                  {t('focus.modeNormalDesc', 'Hides sidebars, toolbars, and removes entity colors from text for pure writing focus.')}
                </div>
              </button>
            </div>
          </div>

          <hr className="focus-divider" />

          {/* Sprint Modes */}
          <div className="focus-category">
            <h3 className="focus-category-title" style={{ marginBottom: '16px' }}>{t('focus.categorySprints', 'Sprint Modes')}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '13px', color: 'var(--accent-green)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('focus.subcatRewarding', 'Rewarding')}
                </h4>
                <div className="focus-modes-grid">
                  {rewarding.map(mode => (
                    <button
                      key={mode.id}
                      className="focus-mode-btn active-mode-btn"
                      onClick={() => setSelectedMode(mode.id)}
                    >
                      <div className="focus-mode-name">{t(mode.nameKey, mode.nameFallback)}</div>
                      <div className="focus-mode-desc">{t(mode.descKey, mode.descFallback)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', color: 'var(--accent-red)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('focus.subcatPunishing', 'Punishing')}
                </h4>
                <div className="focus-modes-grid">
                  {punishing.map(mode => (
                    <button
                      key={mode.id}
                      className="focus-mode-btn active-mode-btn"
                      onClick={() => setSelectedMode(mode.id)}
                    >
                      <div className="focus-mode-name">{t(mode.nameKey, mode.nameFallback)}</div>
                      <div className="focus-mode-desc">{t(mode.descKey, mode.descFallback)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
