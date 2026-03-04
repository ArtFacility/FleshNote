import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/popups.css';

export default function FocusSelectorPopup({ onSelectMode, onClose }) {
    const { t } = useTranslation();
    const [wordGoal, setWordGoal] = useState(400);

    const handleGoalChange = (e) => {
        const val = parseInt(e.target.value, 10);
        setWordGoal(isNaN(val) ? 0 : val);
    };

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div
                className="popup-panel focus-selector-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ width: '560px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            >
                <div className="popup-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px', fontSize: '14px', letterSpacing: '0' }}>
                    <span>{t('focus.selectMode', 'Select Focus Mode')}</span>
                    <button className="popup-close" onClick={onClose} title={t('common.close', 'Close')}>
                        ×
                    </button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>

                    {/* Normal Mode Section */}
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

                    {/* Sprints Section */}
                    <div className="focus-category">
                        <div className="focus-category-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 className="focus-category-title" style={{ margin: 0 }}>{t('focus.categorySprints', 'Sprint Modes')}</h3>
                            <div className="word-goal-input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('focus.wordGoal', 'Word Goal:')}</label>
                                <input
                                    type="number"
                                    value={wordGoal}
                                    onChange={handleGoalChange}
                                    className="popup-search-input"
                                    style={{ width: '80px', padding: '4px 8px', fontSize: '14px', margin: 0, textAlign: 'center' }}
                                    min="1"
                                />
                            </div>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--accent-amber)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                            {t('focus.sprintWarning', 'Warning: You cannot exit a Sprint Mode until you type your word goal.')}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            {/* Rewarding Sprints */}
                            <div>
                                <h4 style={{ fontSize: '13px', color: 'var(--accent-green)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {t('focus.subcatRewarding', 'Rewarding')}
                                </h4>
                                <div className="focus-modes-grid">
                                    <button
                                        className="focus-mode-btn active-mode-btn"
                                        onClick={() => onSelectMode({ type: 'momentum', goal: wordGoal })}
                                    >
                                        <div className="focus-mode-name">{t('focus.modeMomentum', 'Momentum')}</div>
                                        <div className="focus-mode-desc">{t('focus.modeMomentumDesc', 'Type faster to fill a bar and release magical runes.')}</div>
                                    </button>

                                    <button
                                        className="focus-mode-btn active-mode-btn"
                                        onClick={() => onSelectMode({ type: 'combo', goal: wordGoal })}
                                    >
                                        <div className="focus-mode-name">{t('focus.modeCombo', 'Combo')}</div>
                                        <div className="focus-mode-desc">{t('focus.modeComboDesc', 'Build a combo multiplier. Deleting too much breaks it.')}</div>
                                    </button>

                                    <button
                                        className="focus-mode-btn active-mode-btn"
                                        onClick={() => onSelectMode({ type: 'zen', goal: wordGoal })}
                                    >
                                        <div className="focus-mode-name">{t('focus.modeZen', 'Zen')}</div>
                                        <div className="focus-mode-desc">{t('focus.modeZenDesc', 'Grow a beautiful tree as you approach your word goal.')}</div>
                                    </button>
                                </div>
                            </div>

                            {/* Punishing Sprints */}
                            <div>
                                <h4 style={{ fontSize: '13px', color: 'var(--accent-red)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {t('focus.subcatPunishing', 'Punishing')}
                                </h4>
                                <div className="focus-modes-grid">
                                    <button
                                        className="focus-mode-btn active-mode-btn"
                                        onClick={() => onSelectMode({ type: 'kamikaze', goal: wordGoal })}
                                    >
                                        <div className="focus-mode-name">{t('focus.modeKamikaze', 'Kamikaze')}</div>
                                        <div className="focus-mode-desc">{t('focus.modeKamikazeDesc', 'Words start deleting if you stop typing for 1 minute.')}</div>
                                    </button>

                                    <button
                                        className="focus-mode-btn active-mode-btn"
                                        onClick={() => onSelectMode({ type: 'hemingway', goal: wordGoal })}
                                    >
                                        <div className="focus-mode-name">{t('focus.modeHemingway', 'Hemingway')}</div>
                                        <div className="focus-mode-desc">{t('focus.modeHemingwayDesc', 'Backspace and Delete keys are disabled. Write forward only.')}</div>
                                    </button>

                                    <button
                                        className="focus-mode-btn active-mode-btn"
                                        onClick={() => onSelectMode({ type: 'fog', goal: wordGoal })}
                                    >
                                        <div className="focus-mode-name">{t('focus.modeFog', 'Fog')}</div>
                                        <div className="focus-mode-desc">{t('focus.modeFogDesc', 'Characters disappear outside your immediate typing radius.')}</div>
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
