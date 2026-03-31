import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

// ── Inline SVG Icons ─────────────────────────────────────────────────────────
const Icons = {
    Eye: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
    ),
    AlertTriangle: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    ),
    Edit: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    Check: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
    X: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    FileText: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    ),
    User: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    ),
    Plus: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    ),
    Trash: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
}

// ── Density Sparkline ─────────────────────────────────────────────────────────
function DensitySparkline({ foreshadowings, revealGlobal, totalWords }) {
    if (!totalWords || totalWords === 0) return null

    return (
        <div className="twist-density-bar">
            <div className="twist-density-track">
                {foreshadowings.map((fs, i) => {
                    const pct = (fs.global_word_offset / totalWords) * 100
                    return (
                        <div
                            key={i}
                            className="twist-density-dot foreshadow"
                            style={{ left: `${pct}%` }}
                            title={`Ch.${fs.chapter_number}: "${fs.selected_text?.substring(0, 30)}..." (word ${fs.global_word_offset?.toLocaleString()})`}
                        />
                    )
                })}
                {revealGlobal != null && (
                    <div
                        className="twist-density-dot reveal"
                        style={{ left: `${(revealGlobal / totalWords) * 100}%` }}
                        title={`Reveal (word ${revealGlobal?.toLocaleString()})`}
                    />
                )}
            </div>
        </div>
    )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function TwistInspectorPanel({
    twistId,
    projectPath,
    characters,
    chapters,
    onNavigateChapter,
    onTwistDeleted
}) {
    const { t } = useTranslation()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [editFields, setEditFields] = useState({})
    const [saving, setSaving] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Character autocomplete
    const [showCharDropdown, setShowCharDropdown] = useState(false)
    const [charSearch, setCharSearch] = useState('')
    const charInputRef = useRef(null)

    // Load twist detail
    const loadDetail = useCallback(async () => {
        if (!projectPath || !twistId) return
        setLoading(true)
        try {
            const result = await window.api.getTwistDetail({
                project_path: projectPath,
                twist_id: twistId
            })
            setData(result)
        } catch (err) {
            console.error('Failed to load twist detail:', err)
        }
        setLoading(false)
    }, [projectPath, twistId])

    useEffect(() => {
        loadDetail()
    }, [loadDetail])

    // Enter edit mode
    const enterEdit = () => {
        if (!data?.twist) return
        setEditFields({
            title: data.twist.title || '',
            description: data.twist.description || '',
            twist_type: data.twist.twist_type || '',
            status: data.twist.status || 'planned',
            notes: data.twist.notes || '',
        })
        setEditing(true)
    }

    const cancelEdit = () => {
        setEditing(false)
        setEditFields({})
    }

    const saveEdit = async () => {
        if (!data?.twist) return
        setSaving(true)
        try {
            await window.api.updateTwist({
                project_path: projectPath,
                twist_id: twistId,
                ...editFields
            })
            await loadDetail()
            setEditing(false)
        } catch (err) {
            console.error('Failed to save twist:', err)
        }
        setSaving(false)
    }

    // Add character who knows
    const addCharacter = async (charId) => {
        if (!data?.twist) return
        const current = data.twist.characters_who_know || []
        if (current.includes(charId)) return
        try {
            await window.api.updateTwist({
                project_path: projectPath,
                twist_id: twistId,
                characters_who_know: [...current, charId]
            })
            await loadDetail()
        } catch (err) {
            console.error('Failed to add character:', err)
        }
        setShowCharDropdown(false)
        setCharSearch('')
    }

    const removeCharacter = async (charId) => {
        if (!data?.twist) return
        const current = data.twist.characters_who_know || []
        try {
            await window.api.updateTwist({
                project_path: projectPath,
                twist_id: twistId,
                characters_who_know: current.filter(id => id !== charId)
            })
            await loadDetail()
        } catch (err) {
            console.error('Failed to remove character:', err)
        }
    }

    // Navigate to foreshadow's chapter
    const goToForeshadow = (fs) => {
        const ch = chapters.find(c => c.id === fs.chapter_id)
        if (ch) onNavigateChapter?.(ch)
    }

    // Delete entire twist
    const handleDeleteTwist = async () => {
        setShowDeleteConfirm(false)
        try {
            await window.api.deleteTwist({ project_path: projectPath, twist_id: twistId })
            onTwistDeleted?.()
        } catch (err) {
            console.error('Failed to delete twist:', err)
        }
    }

    const statusColor = (status) => {
        switch (status) {
            case 'planned': return 'var(--text-tertiary)'
            case 'hinted': return 'var(--accent-amber)'
            case 'revealed': return 'var(--accent-green)'
            default: return 'var(--text-tertiary)'
        }
    }

    const warningColor = (type) => {
        switch (type) {
            case 'danger': return 'var(--accent-red)'
            case 'warning': return 'var(--accent-amber)'
            case 'info': return 'var(--accent-purple)'
            default: return 'var(--text-tertiary)'
        }
    }

    if (loading) {
        return (
            <div className="twist-inspector" style={{ padding: 20, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {t('twist.loading', 'Loading twist...')}
            </div>
        )
    }

    if (!data?.twist) {
        return (
            <div className="twist-inspector" style={{ padding: 20, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {t('twist.notFound', 'Twist not found.')}
            </div>
        )
    }

    const { twist, foreshadowings, stats, warnings } = data
    const knownChars = (twist.characters_who_know || [])
        .map(id => characters.find(c => c.id === id))
        .filter(Boolean)

    const filteredChars = characters.filter(c =>
        !twist.characters_who_know?.includes(c.id) &&
        c.name.toLowerCase().includes(charSearch.toLowerCase())
    )

    return (
        <div className="twist-inspector">

            {/* ── Warnings ────────────────────────────────── */}
            {warnings && warnings.length > 0 && (
                <div className="twist-warnings">
                    {warnings.map((w, i) => (
                        <div key={i} className="twist-warning-item" style={{ borderColor: warningColor(w.type) }}>
                            <span style={{ color: warningColor(w.type) }}><Icons.AlertTriangle /></span>
                            <span>{t(`twist.warning_${w.key}`, {
                                count: stats.foreshadow_count,
                                words: stats.distance_first_to_reveal ? stats.distance_first_to_reveal.toLocaleString() : '',
                                gap: stats.max_gap ? stats.max_gap.toLocaleString() : '',
                                defaultValue: w.message
                            })}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Header ──────────────────────────────────── */}
            <div className="twist-header">
                <div className="twist-header-top">
                    {editing ? (
                        <input
                            className="twist-title-input"
                            value={editFields.title}
                            onChange={(e) => setEditFields(f => ({ ...f, title: e.target.value }))}
                        />
                    ) : (
                        <div className="twist-title">{twist.title}</div>
                    )}
                    <div className="twist-header-actions">
                        {editing ? (
                            <>
                                <button className="twist-icon-btn" onClick={saveEdit} disabled={saving} title="Save">
                                    <Icons.Check />
                                </button>
                                <button className="twist-icon-btn" onClick={cancelEdit} title="Cancel">
                                    <Icons.X />
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="twist-icon-btn" onClick={enterEdit} title="Edit">
                                    <Icons.Edit />
                                </button>
                                <button className="twist-icon-btn danger" onClick={() => setShowDeleteConfirm(true)} title={t('twist.deleteTwist', 'Delete Twist')} style={{ color: 'var(--accent-red)' }}>
                                    <Icons.Trash />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="twist-badges">
                    {editing ? (
                        <>
                            <select
                                className="twist-badge-select"
                                value={editFields.status}
                                onChange={(e) => setEditFields(f => ({ ...f, status: e.target.value }))}
                            >
                                <option value="planned">{t('twist.planned', 'Planned')}</option>
                                <option value="hinted">{t('twist.hinted', 'Hinted')}</option>
                                <option value="revealed">{t('twist.revealed', 'Revealed')}</option>
                            </select>
                            <select
                                className="twist-badge-select"
                                value={editFields.twist_type}
                                onChange={(e) => setEditFields(f => ({ ...f, twist_type: e.target.value }))}
                            >
                                <option value="">{t('twist.noType', 'No type')}</option>
                                <option value="identity">{t('twist.identity', 'Identity')}</option>
                                <option value="motive">{t('twist.motive', 'Motive')}</option>
                                <option value="event">{t('twist.event', 'Event')}</option>
                                <option value="ability">{t('twist.ability', 'Ability')}</option>
                                <option value="relationship">{t('twist.relationship', 'Relationship')}</option>
                            </select>
                        </>
                    ) : (
                        <>
                            <span className="twist-badge status" style={{ color: statusColor(twist.status) }}>
                                {twist.status || 'planned'}
                            </span>
                            {twist.twist_type && (
                                <span className="twist-badge type">{twist.twist_type}</span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Stats Row ───────────────────────────────── */}
            <div className="twist-stats-row">
                <div className="twist-stat">
                    <div className="twist-stat-value">{stats.foreshadow_count}</div>
                    <div className="twist-stat-label">{t('twist.foreshadows', 'Foreshadows')}</div>
                </div>
                <div className="twist-stat">
                    <div className="twist-stat-value">
                        {stats.distance_first_to_reveal != null
                            ? `${stats.distance_first_to_reveal.toLocaleString()}w`
                            : '—'}
                    </div>
                    <div className="twist-stat-label">{t('twist.distanceToReveal', 'Distance to Reveal')}</div>
                </div>
                <div className="twist-stat">
                    <div className="twist-stat-value">
                        {stats.max_gap > 0 ? `${stats.max_gap.toLocaleString()}w` : '—'}
                    </div>
                    <div className="twist-stat-label">{t('twist.maxGap', 'Max Gap')}</div>
                </div>
            </div>

            {/* ── Density Sparkline ───────────────────────── */}
            <DensitySparkline
                foreshadowings={foreshadowings}
                revealGlobal={stats.reveal_global_offset}
                totalWords={stats.total_manuscript_words}
            />

            {/* ── Description ─────────────────────────────── */}
            <div className="twist-section">
                <div className="twist-section-label">{t('twist.description', 'Description')}</div>
                {editing ? (
                    <textarea
                        className="twist-textarea"
                        value={editFields.description}
                        onChange={(e) => setEditFields(f => ({ ...f, description: e.target.value }))}
                        rows={3}
                        placeholder={t('twist.descriptionPlaceholder', 'What is this twist about?')}
                    />
                ) : (
                    <div className="twist-section-content">
                        {twist.description || <span className="twist-empty">{t('twist.noDescription', 'No description')}</span>}
                    </div>
                )}
            </div>

            {/* ── Characters Who Know ──────────────────────── */}
            <div className="twist-section">
                <div className="twist-section-label">
                    <Icons.User /> {t('twist.charactersWhoKnow', 'Characters Who Know')}
                </div>
                <div className="twist-char-chips">
                    {knownChars.length === 0 && (
                        <span className="twist-empty">{t('twist.noCharacters', 'None yet')}</span>
                    )}
                    {knownChars.map(c => (
                        <span key={c.id} className="twist-char-chip">
                            {c.name}
                            <button className="twist-char-chip-remove" onClick={() => removeCharacter(c.id)}>×</button>
                        </span>
                    ))}
                    <button
                        className="twist-char-add-btn"
                        onClick={() => {
                            setShowCharDropdown(!showCharDropdown)
                            setTimeout(() => charInputRef.current?.focus(), 50)
                        }}
                    >
                        <Icons.Plus />
                    </button>
                </div>
                {showCharDropdown && (
                    <div className="twist-char-dropdown">
                        <input
                            ref={charInputRef}
                            className="twist-char-search"
                            value={charSearch}
                            onChange={(e) => setCharSearch(e.target.value)}
                            placeholder={t('twist.searchCharacter', 'Search character...')}
                        />
                        <div className="twist-char-list">
                            {filteredChars.length === 0 ? (
                                <div className="twist-char-list-empty">{t('twist.noMatchingChars', 'No matching characters')}</div>
                            ) : (
                                filteredChars.slice(0, 8).map(c => (
                                    <button key={c.id} className="twist-char-option" onClick={() => addCharacter(c.id)}>
                                        {c.name}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Notes ───────────────────────────────────── */}
            <div className="twist-section">
                <div className="twist-section-label">{t('twist.notes', 'Notes')}</div>
                {editing ? (
                    <textarea
                        className="twist-textarea"
                        value={editFields.notes}
                        onChange={(e) => setEditFields(f => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        placeholder={t('twist.notesPlaceholder', 'Author notes...')}
                    />
                ) : (
                    <div className="twist-section-content">
                        {twist.notes || <span className="twist-empty">{t('twist.noNotes', 'No notes')}</span>}
                    </div>
                )}
            </div>

            {/* ── Foreshadow List ─────────────────────────── */}
            <div className="twist-section">
                <div className="twist-section-label">
                    <Icons.FileText /> {t('twist.foreshadowList', 'Foreshadow Markers')} ({foreshadowings.length})
                </div>
                {foreshadowings.length === 0 ? (
                    <div className="twist-empty">{t('twist.noForeshadows', 'No foreshadowing markers yet.')}</div>
                ) : (
                    <div className="twist-foreshadow-list">
                        {foreshadowings.map((fs) => (
                            <button
                                key={fs.id}
                                className="twist-foreshadow-item"
                                onClick={() => goToForeshadow(fs)}
                                title={t('twist.goToChapter', 'Go to chapter')}
                            >
                                <div className="twist-fs-chapter">
                                    Ch.{fs.chapter_number}: {fs.chapter_title}
                                </div>
                                <div className="twist-fs-text">
                                    "{fs.selected_text?.length > 60
                                        ? fs.selected_text.substring(0, 60) + '...'
                                        : fs.selected_text}"
                                </div>
                                <div className="twist-fs-offset">
                                    {t('twist.wordOffset', 'word')} {fs.word_offset?.toLocaleString()}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Delete Confirmation Modal ───────────── */}
            {showDeleteConfirm && (
                <div
                    className="popup-overlay"
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ zIndex: 9999 }}
                >
                    <div
                        className="popup-panel"
                        onClick={(e) => e.stopPropagation()}
                        style={{ position: 'relative', width: 400, transform: 'translateY(0)' }}
                    >
                        <div className="popup-header">
                            <span style={{ color: 'var(--accent-red)' }}>
                                {t('twist.deleteTwist', 'Delete Twist')}
                            </span>
                            <button className="popup-close" onClick={() => setShowDeleteConfirm(false)}>
                                &times;
                            </button>
                        </div>
                        <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: 1.6 }}>
                            {t('twist.confirmDelete', 'Are you sure you want to delete this twist? All markers will be removed from your chapters.')}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
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
                                {t('twist.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleDeleteTwist}
                                style={{
                                    padding: '8px 16px',
                                    background: 'var(--accent-red)',
                                    color: 'var(--bg-deep)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 12,
                                    fontWeight: 'bold'
                                }}
                            >
                                {t('twist.confirmDeleteBtn', 'Delete Twist')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
