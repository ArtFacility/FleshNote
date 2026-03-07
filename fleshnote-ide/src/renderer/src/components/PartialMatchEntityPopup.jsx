import { useTranslation } from 'react-i18next'

export default function PartialMatchEntityPopup({ selectedText, match, position, onClose, onForceCreate, onAddAlias, onJustLink }) {
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
                    width: '440px'
                }}
            >
                <div className="popup-header">
                    <span style={{ fontSize: '16px', fontWeight: '600' }}>
                        {match?.type === 'location' ? t('editor.duplicatePartialTitleLoc', 'Similar Location Found') :
                            match?.type === 'lore' ? t('editor.duplicatePartialTitleLore', 'Similar Lore Item Found') :
                                t('editor.duplicatePartialTitle', 'Similar Character Found')}
                    </span>
                </div>
                <div className="popup-subtitle" style={{ whiteSpace: 'normal', lineHeight: '1.5', marginTop: '14px', marginBottom: '20px', fontSize: '14px' }}>
                    {t('editor.duplicatePartialMsgAny', '"{{matchName}}" already exists in your database. Is "{{newName}}" an alias of this entry, or a new entry?', { matchName: match?.name, newName: selectedText })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="entity-edit-btn save" style={{ padding: '10px 16px', fontSize: '14px', justifyContent: 'center' }} onClick={() => onAddAlias()}>
                        {t('editor.addAliasOption', 'Add alias to {{name}}', { name: match?.name })}
                    </button>
                    <button className="entity-edit-btn" style={{ padding: '10px 16px', fontSize: '14px', justifyContent: 'center' }} onClick={() => onJustLink()}>
                        {t('editor.justLinkOption', 'Just link to {{name}}', { name: match?.name })}
                    </button>
                    <button className="entity-edit-btn" style={{ borderColor: 'var(--border-subtle)', padding: '10px 16px', fontSize: '14px', justifyContent: 'center' }} onClick={() => onForceCreate()}>
                        {t('editor.newEntryOption', 'New entry')}
                    </button>
                </div>
            </div>
        </div>
    )
}
