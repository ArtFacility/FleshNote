import { useTranslation } from 'react-i18next'

export default function DuplicateEntityPopup({ selectedText, match, position, onClose, onForceCreate }) {
    const { t } = useTranslation()

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div
                className="popup-panel"
                onClick={(e) => e.stopPropagation()}
                style={{
                    insetInlineStart: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '400px'
                }}
            >
                <div className="popup-header">
                    <span style={{ fontSize: '16px', fontWeight: '600' }}>
                        {match?.type === 'location' ? t('editor.duplicateExactTitleLoc', 'Duplicate Location') :
                            match?.type === 'lore' ? t('editor.duplicateExactTitleLore', 'Duplicate Lore Item') :
                                t('editor.duplicateExactTitle', 'Duplicate Character')}
                    </span>
                </div>
                <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: '1.5', marginTop: '14px', marginBottom: '20px', fontSize: '14px' }}>
                    {t('editor.duplicateExactMsgAny', 'You already have an entry named "{{name}}". Are you sure you want to make a new one?', { name: match?.name || selectedText })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="entity-edit-btn" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={onClose}>
                        {t('editor.cancel', 'Cancel')}
                    </button>
                    <button
                        className="entity-edit-btn save"
                        style={{ backgroundColor: 'var(--accent-red)', borderColor: 'var(--accent-red)', color: 'var(--bg-deep)', padding: '8px 16px', fontSize: '14px' }}
                        onClick={() => onForceCreate()}
                    >
                        {t('editor.createAnyway', 'Create Anyway')}
                    </button>
                </div>
            </div>
        </div>
    )
}
