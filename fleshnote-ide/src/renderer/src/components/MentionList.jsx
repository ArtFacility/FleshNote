import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useState,
} from 'react'
import { useTranslation } from 'react-i18next'

const Icons = {
    User: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    MapPin: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    ),
    Gem: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3h12l4 6-10 13L2 9z" />
            <path d="M2 9h20" />
            <path d="M12 22L6 3" />
            <path d="M12 22l6-19" />
        </svg>
    )
}

export default forwardRef((props, ref) => {
    const { t } = useTranslation()
    const [selectedIndex, setSelectedIndex] = useState(0)

    const selectItem = index => {
        const item = props.items[index]

        if (item) {
            props.command({ id: item.id, type: item.type, label: item.name })
        }
    }

    const upHandler = () => {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
    }

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length)
    }

    const enterHandler = () => {
        selectItem(selectedIndex)
    }

    const getTypeLabel = (type) => {
        switch (type) {
            case 'character': return t('extractor.typeCharacter', 'Character')
            case 'location': return t('extractor.typeLocation', 'Location')
            case 'lore': return t('extractor.typeLore', 'Lore')
            default: return type
        }
    }

    useEffect(() => setSelectedIndex(0), [props.items])

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (event.key === 'ArrowUp') {
                upHandler()
                return true
            }

            if (event.key === 'ArrowDown') {
                downHandler()
                return true
            }

            if (event.key === 'Enter') {
                event.preventDefault()
                event.stopPropagation()
                enterHandler()
                return true
            }

            return false
        },
    }))

    return (
        <div className="mention-popup" style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '2px',
            padding: '4px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
            maxHeight: '250px',
            overflowY: 'auto',
            minWidth: '200px',
            fontFamily: 'var(--font-sans)'
        }}>
            {props.items.length ? (
                props.items.map((item, index) => (
                    <button
                        className={`mention-item ${index === selectedIndex ? 'is-selected' : ''}`}
                        key={index}
                        onClick={() => selectItem(index)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            background: index === selectedIndex ? 'var(--bg-hover)' : 'transparent',
                            color: 'var(--text-primary)',
                            textAlign: 'left',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        <span style={{ color: `var(--entity-${item.type})` }}>
                            {item.type === 'character' ? <Icons.User /> : item.type === 'location' ? <Icons.MapPin /> : <Icons.Gem />}
                        </span>
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: 'auto', textTransform: 'uppercase' }}>
                            {getTypeLabel(item.type)}
                        </span>
                    </button>
                ))
            ) : (
                <div style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                    {t('mention.noResult', 'No result')}
                </div>
            )}
        </div>
    )
})
