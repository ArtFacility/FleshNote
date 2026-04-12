import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import EntityInspectorPanel from "./ide-panels/EntityInspectorPanel";
import TwistInspectorPanel from "./ide-panels/TwistInspectorPanel";
import CharacterInspectorPanel from "./ide-panels/CharacterInspectorPanel";
import LocationInspectorPanel from "./ide-panels/LocationInspectorPanel";
import QuickNoteInspectorPanel from "./ide-panels/QuickNoteInspectorPanel";
import AnnotationInspectorPanel from "./ide-panels/AnnotationInspectorPanel";
import NameGeneratorModal from "./NameGeneratorModal";
import LocationNameGeneratorModal from "./LocationNameGeneratorModal";

// ─── THEME CONSTANTS ────────────────────────────────────────────────────────
const T = {
    amber: "var(--accent-amber)",
    amberDim: "var(--accent-amber-dim)",
    bg0: "var(--bg-deep)",
    bg1: "var(--bg-surface)",
    bg2: "var(--bg-elevated)",
    bg3: "var(--border-subtle)",
    text: "var(--text-primary)",
    textDim: "var(--text-secondary)",
    mono: "var(--font-mono)",
    serif: "var(--font-serif)",
    sans: "var(--font-sans)",
};

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icons = {
    User: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    MapPin: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
    UsersGroup: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    Gem: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="6 3 18 3 22 11 12 21 2 11 6 3" /></svg>,
    Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
    Merge: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 6 4-4 4 4" /><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22" /><path d="m20 22-5-5" /></svg>,
    X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    Twist: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h5l3-3 4 6 3-3h5"/></svg>,
    CheckCircle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    // Quicknote: handwritten feather icon
    Feather: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>,
    // Annotation: footnote document with shortened lines
    Annotation: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="11" y2="17"/></svg>,
    Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    Wand: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2"></path><path d="M15 16v-2"></path><path d="M8 9h2"></path><path d="M20 9h2"></path><path d="M17.8 11.8L19 13"></path><path d="M15 9h.01"></path><path d="M17.8 6.2L19 5"></path><path d="m3 21 9-9"></path><path d="M12.2 6.2 11 5"></path></svg>,
};

function EntityTypeIcon({ type }) {
    switch (type) {
        case "character": return <Icons.User />;
        case "location": return <Icons.MapPin />;
        case "group": return <Icons.UsersGroup />;
        case "twist": return <Icons.Twist />;
        case "quicknote":
        case "quick_note": return <Icons.Feather />;
        case "annotation": return <Icons.Annotation />;
        case "todo": return <Icons.CheckCircle />;
        default: return <Icons.Gem />;
    }
}

function getEntityColor(type) {
    switch (type) {
        case "character": return "var(--entity-character)";
        case "location": return "var(--entity-location)";
        case "group": return "var(--entity-item)";
        case "twist": return "var(--accent-purple)";
        case "quicknote":
        case "quick_note": return "var(--entity-quicknote)";
        case "annotation": return "var(--accent-annotation)";
        case "todo": return "var(--accent-green)";
        default: return "var(--entity-item)";
    }
}

function charStatusColor(status) {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s.includes('activ') || s.includes('alive')) return 'var(--accent-green)';
    if (s.includes('dead') || s.includes('deceas')) return 'var(--accent-red)';
    if (s.includes('missing') || s.includes('unknown')) return 'var(--text-secondary)';
    return 'var(--accent-amber)';
}

// ─── TAB BAR ────────────────────────────────────────────────────────────────
function TabBar({ tabs, activeTab, onChange }) {
    return (
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.bg3}`, gap: 0, overflowX: 'auto', flexShrink: 0 }}>
            {tabs.map(tab => {
                const active = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        style={{
                            padding: '12px 20px',
                            background: active ? T.bg2 : 'transparent',
                            border: 'none',
                            borderBottom: active ? `2px solid ${T.amber}` : '2px solid transparent',
                            color: active ? T.amber : T.textDim,
                            fontFamily: T.mono, fontSize: 12,
                            cursor: 'pointer', transition: 'all 0.2s',
                            letterSpacing: '0.04em', borderRadius: 0,
                            outline: 'none', whiteSpace: 'nowrap',
                        }}
                    >
                        {tab.icon && <span style={{ marginRight: 7, opacity: 0.6, verticalAlign: 'middle' }}>{tab.icon}</span>}
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

// ─── DARK CHECKBOX ──────────────────────────────────────────────────────────
function Checkbox({ checked, onToggle }) {
    return (
        <div
            onClick={e => { e.stopPropagation(); onToggle(); }}
            style={{
                width: 13, height: 13, flexShrink: 0,
                border: `1px solid ${checked ? T.amber : T.bg3}`,
                background: checked ? T.amber : T.bg2,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            {checked && (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke={T.bg0} strokeWidth="2.5">
                    <polyline points="2 6 5 9 10 3" />
                </svg>
            )}
        </div>
    );
}

function entityTypeToDbCode(type) {
    switch (type) {
        case 'character': return 'char';
        case 'location': return 'loc';
        case 'group': return 'group';
        default: return 'item';
    }
}

// ─── ENTITY CARD (grid view) ─────────────────────────────────────────────────
function EntityCard({ entity, color, selected, inspecting, onClick, onCheckbox, mentionCount, onMentionClick, iconSrc }) {
    const { t } = useTranslation();
    return (
        <div
            onClick={onClick}
            style={{
                position: 'relative',
                background: selected ? T.amberDim : (inspecting ? T.bg2 : T.bg1),
                border: `1px solid ${inspecting ? T.amber : T.bg3}`,
                borderTop: `2px solid ${color}`,
                padding: '12px',
                cursor: 'pointer',
                transition: 'background 0.15s',
                display: 'flex', flexDirection: 'column', gap: 4,
                minHeight: 80,
            }}
            onMouseEnter={e => { if (!selected && !inspecting) e.currentTarget.style.background = T.bg2; }}
            onMouseLeave={e => { if (!selected && !inspecting) e.currentTarget.style.background = T.bg1; }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                {iconSrc ? (
                    <img src={iconSrc} alt="" style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover' }} />
                ) : (
                    <span style={{ color, opacity: 0.85 }}><EntityTypeIcon type={entity.type} /></span>
                )}
                <Checkbox checked={selected} onToggle={onCheckbox} />
            </div>
            <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: T.text, wordBreak: 'break-word', lineHeight: 1.3 }}>
                {entity.name}
            </div>
            {entity.richChar?.status && (() => {
                const col = charStatusColor(entity.richChar.status);
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: col, textTransform: 'capitalize' }}>{entity.richChar.status}</span>
                    </div>
                );
            })()}
            {entity.richChar?.role && (
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: 'capitalize' }}>
                    {entity.richChar.role}
                </div>
            )}
            {entity.aliases?.length > 0 && (
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
                    {entity.aliases.slice(0, 2).join(', ')}
                    {entity.aliases.length > 2 && ` +${entity.aliases.length - 2}`}
                </div>
            )}
            {entity.category && !['character', 'location', 'group'].includes(entity.type) && (
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: 'capitalize' }}>
                    {entity.category}
                </div>
            )}
            {mentionCount > 0 && (
                <div
                    onClick={onMentionClick ? (e => { e.stopPropagation(); onMentionClick(); }) : undefined}
                    title={onMentionClick ? t('stats.emJumpToFirstAppearance', 'Jump to first appearance') : undefined}
                    style={{
                        position: 'absolute', bottom: 8, right: 10, fontFamily: T.mono, fontSize: 10,
                        color: T.textDim, cursor: onMentionClick ? 'pointer' : 'default',
                    }}
                >
                    {mentionCount}×
                </div>
            )}
        </div>
    );
}

// ─── LIST ROW (text-heavy items: notes, twists, todos) ───────────────────────
function ListRow({ entity, color, selected, inspecting, onClick, onCheckbox, children }) {
    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 20px',
                borderBottom: `1px solid ${T.bg3}40`,
                borderLeft: inspecting ? `2px solid ${T.amber}` : '2px solid transparent',
                background: selected ? T.amberDim : (inspecting ? T.bg2 : 'transparent'),
                cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!selected && !inspecting) e.currentTarget.style.background = T.bg2; }}
            onMouseLeave={e => { if (!selected && !inspecting) e.currentTarget.style.background = 'transparent'; }}
        >
            {onCheckbox && <Checkbox checked={selected} onToggle={onCheckbox} />}
            <span style={{ color, marginTop: 1, flexShrink: 0 }}><EntityTypeIcon type={entity.type} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        </div>
    );
}

// ─── CREATION CARD ──────────────────────────────────────────────────────────
function CreationCard({ tabType, loreCategories, onConfirm, onCancel, projectPath, projectConfig }) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [category, setCategory] = useState(loreCategories?.[0] || 'item');
    const [showNameGen, setShowNameGen] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && name.trim()) onConfirm(name.trim(), category);
        if (e.key === 'Escape') onCancel();
    };

    const isLore = tabType === 'lore';
    const placeholder = tabType === 'twists' ? t('stats.emTwistPlaceholder', 'Twist title...') : t('stats.emNamePlaceholder', 'Name...');
    const NEW_TITLE_MAP = {
        characters: t('stats.emNewCharacter', 'New Character'),
        locations: t('stats.emNewLocation', 'New Location'),
        groups: t('stats.emNewGroup', 'New Group'),
        lore: t('stats.emNewLoreEntity', 'New Lore Entity'),
        twists: t('stats.emNewTwist', 'New Twist'),
    };
    const headerTitle = NEW_TITLE_MAP[tabType] || `New ${tabType}`;

    return (
        <div style={{
            border: `1px solid ${T.amber}`, background: T.bg2,
            padding: '12px', marginBottom: 1,
        }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.amber, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                {headerTitle}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                    ref={inputRef}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    style={{
                        flex: 1, minWidth: 120, background: T.bg0, border: `1px solid ${T.bg3}`,
                        color: T.text, padding: '6px 10px', fontFamily: T.sans, fontSize: 13, outline: 'none',
                    }}
                />
                {isLore && (
                    <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        style={{
                            background: T.bg0, border: `1px solid ${T.bg3}`, color: T.text,
                            padding: '6px 8px', fontFamily: T.mono, fontSize: 11, outline: 'none', cursor: 'pointer',
                        }}
                    >
                        {(loreCategories?.length ? loreCategories : ['item', 'concept', 'creature', 'artifact', 'magic system', 'organization', 'document', 'technology']).map(cat => (
                            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                        ))}
                    </select>
                )}
                <button
                    onClick={() => name.trim() && onConfirm(name.trim(), category)}
                    disabled={!name.trim()}
                    style={{
                        background: name.trim() ? T.amber : T.bg3, border: 'none',
                        color: name.trim() ? T.bg0 : T.textDim,
                        padding: '6px 14px', fontFamily: T.mono, fontSize: 11, fontWeight: 600,
                        cursor: name.trim() ? 'pointer' : 'default',
                    }}
                >
                    {t('stats.emCreate', 'Create')}
                </button>
                <button
                    onClick={onCancel}
                    style={{
                        background: 'none', border: `1px solid ${T.bg3}`, color: T.textDim,
                        padding: '6px 10px', fontFamily: T.mono, fontSize: 11, cursor: 'pointer',
                    }}
                >
                    {t('stats.cancel', 'Cancel')}
                </button>
                {tabType === 'characters' && (
                    <button
                        onClick={() => setShowNameGen(true)}
                        style={{
                            background: 'none', border: `1px solid ${T.amber}`, color: T.amber,
                            padding: '6px 10px', fontFamily: T.mono, fontSize: 11, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                        title={t('namegen.generate_tooltip', 'Generate Name')}
                    >
                        <Icons.Wand />
                    </button>
                )}
                {tabType === 'locations' && (
                    <button
                        onClick={() => setShowNameGen(true)}
                        style={{
                            background: 'none', border: `1px solid ${T.amber}`, color: T.amber,
                            padding: '6px 10px', fontFamily: T.mono, fontSize: 11, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                        title={t('namegen.generate_tooltip', 'Generate Location Name')}
                    >
                        <Icons.Wand />
                    </button>
                )}
            </div>
            {showNameGen && tabType === 'characters' && (
                <NameGeneratorModal
                    projectPath={projectPath}
                    projectConfig={projectConfig}
                    onClose={() => setShowNameGen(false)}
                    onConfirm={(generatedName) => {
                        setName(generatedName)
                        setShowNameGen(false)
                        // Auto focus back
                        setTimeout(() => inputRef.current?.focus(), 100)
                    }}
                />
            )}
            {showNameGen && tabType === 'locations' && (
                <LocationNameGeneratorModal
                    projectPath={projectPath}
                    projectConfig={projectConfig}
                    onClose={() => setShowNameGen(false)}
                    onConfirm={({name: generatedName, description}) => {
                        // Directly trigger creation with the description
                        onConfirm(generatedName, category, description)
                        setShowNameGen(false)
                    }}
                />
            )}
        </div>
    );
}

// ─── LOCATION TREE VIEW ───────────────────────────────────────────────────────
function LocationTreeNode({ entity, childrenNodes, depth = 0, inspectedEntity, selectedIds, setInspectedEntity, toggleSelect, getMentions, firstAppearanceMap, onNavigate, onDropNode, defaultExpanded = true }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(defaultExpanded)
    const isInspected = inspectedEntity && String(inspectedEntity.id) === String(entity.id)
    const isSelected = selectedIds.has(`location-${entity.id}`)
    
    // Drag & Drop
    const [isDragOver, setIsDragOver] = useState(false)

    const handleDragStart = (e) => {
        // Stop collapsing/expanding when dragging
        e.stopPropagation()
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: entity.id, type: 'location' }))
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDragEnter = (e) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        setIsDragOver(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'))
            if (data && data.type === 'location' && String(data.id) !== String(entity.id)) {
                onDropNode(data.id, entity.id)
            }
        } catch(err) { console.error('Drop parse error', err) }
    }

    return (
        <div>
            <div
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => setInspectedEntity(entity)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: `8px 12px 8px ${12 + depth * 24}px`,
                    background: isDragOver ? T.amberDim : (isSelected ? T.amberDim : (isInspected ? T.bg2 : 'transparent')),
                    borderLeft: isInspected ? `2px solid ${T.amber}` : '2px solid transparent',
                    cursor: 'grab',
                    userSelect: 'none',
                    borderBottom: `1px solid ${T.bg3}40`
                }}
            >
                {childrenNodes?.length > 0 ? (
                    <div onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }} style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textDim }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }}>
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                ) : (
                    <div style={{ width: 14 }} />
                )}
                
                <Checkbox checked={isSelected} onToggle={() => toggleSelect(entity)} onClick={(e) => e.stopPropagation()} />
                <span style={{ color: getEntityColor('location') }}><EntityTypeIcon type="location" /></span>
                <span style={{ fontSize: 13, color: T.text, fontWeight: isInspected ? 600 : 400 }}>{entity.name}</span>
                {entity.region && <span style={{ fontSize: 11, color: T.textDim }}>— {entity.region}</span>}
                <div style={{ flex: 1 }} />
                
                {getMentions('location', entity.id) > 0 && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            const fa = firstAppearanceMap[`location-${entity.id}`]
                            if (fa) onNavigate?.(fa.chapter_id, fa.word_offset)
                        }}
                        style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono, cursor: 'pointer' }}
                        title={t('stats.emJumpToFirstAppearance', 'Jump to first appearance')}
                    >
                        {getMentions('location', entity.id)}×
                    </div>
                )}
            </div>
            {expanded && childrenNodes?.length > 0 && (
                <div>
                    {childrenNodes.map(child => (
                        <LocationTreeNode
                            key={child.entity.id}
                            entity={child.entity}
                            childrenNodes={child.children}
                            depth={depth + 1}
                            inspectedEntity={inspectedEntity}
                            selectedIds={selectedIds}
                            setInspectedEntity={setInspectedEntity}
                            toggleSelect={toggleSelect}
                            getMentions={getMentions}
                            firstAppearanceMap={firstAppearanceMap}
                            onNavigate={onNavigate}
                            onDropNode={onDropNode}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function LocationTreeView({ entities, inspectedEntity, selectedIds, setInspectedEntity, toggleSelect, getMentions, firstAppearanceMap, onNavigate, onDropNode }) {
    const rootNodes = []
    const map = new Map()
    entities.forEach(e => { map.set(String(e.id), { entity: e, children: [] }) })
    
    entities.forEach(e => {
        const node = map.get(String(e.id))
        if (e.parent_location_id && map.has(String(e.parent_location_id))) {
            map.get(String(e.parent_location_id)).children.push(node)
        } else {
            rootNodes.push(node)
        }
    })
    
    return (
        <div style={{ paddingBottom: 20 }}>
            {rootNodes.map(root => (
                <LocationTreeNode
                    key={root.entity.id}
                    entity={root.entity}
                    childrenNodes={root.children}
                    inspectedEntity={inspectedEntity}
                    selectedIds={selectedIds}
                    setInspectedEntity={setInspectedEntity}
                    toggleSelect={toggleSelect}
                    getMentions={getMentions}
                    firstAppearanceMap={firstAppearanceMap}
                    onNavigate={onNavigate}
                    onDropNode={onDropNode}
                />
            ))}
        </div>
    )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function EntityManager({ entities, characters, chapters, projectPath, projectConfig, onEntityUpdated, onConfigUpdate, onNavigate }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState("characters");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [inspectedEntity, setInspectedEntity] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showMergeConfirm, setShowMergeConfirm] = useState(false);
    const [mergeKeepId, setMergeKeepId] = useState(null);

    const [twists, setTwists] = useState([]);
    const [todos, setTodos] = useState([]);
    const [mentionsInfo, setMentionsInfo] = useState({});
    const [firstAppearanceMap, setFirstAppearanceMap] = useState({});

    // New feature state
    const [creatingInTab, setCreatingInTab] = useState(null);
    const [sortBy, setSortBy] = useState('name-asc');
    const [activeFilters, setActiveFilters] = useState(new Set());
    const [bulkStatus, setBulkStatus] = useState('');
    const [locationViewMode, setLocationViewMode] = useState('tree');
    const [entityIcons, setEntityIcons] = useState({});

    const loadEntityIcons = useCallback(async () => {
        if (!projectPath) return;
        try {
            const res = await window.api.getBulkEntityIcons({ project_path: projectPath });
            setEntityIcons(res?.icons || {});
        } catch { setEntityIcons({}); }
    }, [projectPath]);

    useEffect(() => { loadEntityIcons(); }, [loadEntityIcons]);

    const loadExtraData = useCallback(async () => {
        if (!projectPath) return;
        try {
            const [statsRes, twistsRes, todosRes] = await Promise.all([
                window.api.getStats(projectPath).catch(() => ({})),
                window.api.getTwistsForPlanner(projectPath).catch(() => ({ twists: [] })),
                window.api.getTodos(projectPath).catch(() => ({ todos: [] }))
            ]);
            setTwists(twistsRes.twists || []);
            setTodos(todosRes.todos || []);
            if (statsRes?.entity_mentions && Array.isArray(statsRes.entity_mentions)) {
                const countMap = {};
                const firstMap = {};
                statsRes.entity_mentions.forEach(m => {
                    const k = `${m.entity_type}-${m.entity_id}`;
                    countMap[k] = (countMap[k] || 0) + 1;
                    if (!firstMap[k]) firstMap[k] = { chapter_id: m.chapter_id, word_offset: m.word_offset };
                });
                setMentionsInfo(countMap);
                setFirstAppearanceMap(firstMap);
            }
        } catch (e) {
            console.error("Failed to load extra entity manager data:", e);
        }
    }, [projectPath]);

    useEffect(() => { loadExtraData(); }, [loadExtraData]);

    const getMentions = (type, id) => {
        if (!type || !id) return 0;
        return mentionsInfo[`${type}-${id}`] || 0;
    };

    const fullDataset = useMemo(() => {
        const enhancedTwists = twists.map(tw => ({ ...tw, type: "twist", name: tw.title }));
        return [...entities, ...enhancedTwists, ...todos];
    }, [entities, twists, todos]);

    const loreCats = useMemo(() => {
        const cats = new Set(['item', 'concept', 'creature', 'artifact', 'magic system', 'organization', 'document', 'technology']);
        fullDataset.filter(e => e.type === 'lore' || (!['character', 'location', 'group', 'quicknote', 'quick_note', 'twist', 'todo', 'annotation'].includes(e.type) && e.category)).forEach(e => { if (e.category) cats.add(e.category); });
        return [...cats].sort();
    }, [fullDataset]);

    const filterOptions = useMemo(() => {
        switch (activeTab) {
            case 'characters':
                return [...new Set(characters.map(c => c.status).filter(Boolean))].sort();
            case 'lore': {
                const lores = fullDataset.filter(e => !['character', 'location', 'group', 'quicknote', 'quick_note', 'twist', 'todo', 'annotation'].includes(e.type));
                return [...new Set(lores.map(e => e.category).filter(Boolean))].sort();
            }
            case 'groups':
                return [...new Set(fullDataset.filter(e => e.type === 'group').map(e => e.group_type).filter(Boolean))].sort();
            case 'twists':
                return ['planned', 'hinted', 'revealed'];
            case 'quicknotes':
                return ['quicknote', 'annotation'];
            default:
                return [];
        }
    }, [activeTab, characters, fullDataset]);

    const tabEntities = useMemo(() => {
        let result = [];
        switch (activeTab) {
            case "characters": {
                const charMap = new Map(characters.map(c => [String(c.id), c]));
                result = fullDataset.filter(e => e.type === "character").map(e => ({
                    ...e, richChar: charMap.get(String(e.id)) || {}
                }));
                break;
            }
            case "groups":
                result = fullDataset.filter(e => e.type === "group");
                break;
            case "locations":
                result = fullDataset.filter(e => e.type === "location");
                break;
            case "lore":
                result = fullDataset.filter(e => !["character", "location", "group", "quicknote", "quick_note", "twist", "todo", "annotation"].includes(e.type));
                break;
            case "twists":
                result = fullDataset.filter(e => e.type === "twist");
                break;
            case "quicknotes":
                result = fullDataset.filter(e => ["quicknote", "quick_note", "annotation"].includes(e.type));
                break;
            case "todos":
                result = fullDataset.filter(e => e.type === "todo");
                break;
            default:
                break;
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e =>
                (e.name || "").toLowerCase().includes(q) ||
                (e.aliases || []).some(a => (a || "").toLowerCase().includes(q)) ||
                (e.content || "").toLowerCase().includes(q)
            );
        }
        if (activeFilters.size > 0) {
            result = result.filter(e => {
                switch (activeTab) {
                    case 'characters': return activeFilters.has(e.richChar?.status || '');
                    case 'lore': return activeFilters.has(e.category || '');
                    case 'groups': return activeFilters.has(e.group_type || '');
                    case 'twists': return activeFilters.has(e.status || 'planned');
                    case 'quicknotes': return activeFilters.has(e.type);
                    default: return true;
                }
            });
        }
        switch (sortBy) {
            case 'name-desc':
                result.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
                break;
            case 'mentions-desc':
                result.sort((a, b) => (mentionsInfo[`${b.type}-${b.id}`] || 0) - (mentionsInfo[`${a.type}-${a.id}`] || 0) || (a.name || '').localeCompare(b.name || ''));
                break;
            case 'status':
                if (activeTab === 'characters') result.sort((a, b) => (a.richChar?.status || '').localeCompare(b.richChar?.status || '') || (a.name || '').localeCompare(b.name || ''));
                else result.sort((a, b) => (a.status || 'planned').localeCompare(b.status || 'planned') || (a.name || '').localeCompare(b.name || ''));
                break;
            default: // name-asc
                result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }
        return result;
    }, [fullDataset, characters, activeTab, searchQuery, activeFilters, sortBy, mentionsInfo]);

    const makeKey = (e) => `${e.type}-${e.id}`;
    const isSelected = (e) => selectedIds.has(makeKey(e));

    const toggleSelect = (e) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            const key = makeKey(e);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const selectedEntities = useMemo(() => tabEntities.filter(e => selectedIds.has(makeKey(e))), [tabEntities, selectedIds]);

    const canMerge = useMemo(() => {
        if (selectedEntities.length < 2) return false;
        const types = new Set(selectedEntities.map(e => e.type));
        return types.size === 1 && !["twist", "todo", "quicknote", "annotation"].includes(Array.from(types)[0]);
    }, [selectedEntities]);

    useEffect(() => {
        if (inspectedEntity) {
            let valid = false;
            if (activeTab === "characters" && inspectedEntity.type === "character") valid = true;
            else if (activeTab === "locations" && inspectedEntity.type === "location") valid = true;
            else if (activeTab === "groups" && inspectedEntity.type === "group") valid = true;
            else if (activeTab === "twists" && inspectedEntity.type === "twist") valid = true;
            else if (activeTab === "quicknotes" && ["quicknote", "quick_note", "annotation"].includes(inspectedEntity.type)) valid = true;
            else if (activeTab === "lore" && !["character", "location", "group", "twist", "quicknote", "quick_note", "todo", "annotation"].includes(inspectedEntity.type)) valid = true;
            if (!valid) setInspectedEntity(null);
        }
    }, [activeTab]);

    const handleInspectorUpdated = useCallback(() => {
        onEntityUpdated?.();
        loadExtraData();
        loadEntityIcons();
    }, [onEntityUpdated, loadExtraData, loadEntityIcons]);

    const handleCreate = useCallback(async (name, category, description = "") => {
        if (!name.trim()) return;
        try {
            let created = null;
            if (activeTab === 'characters') {
                const res = await window.api.createCharacter({ project_path: projectPath, name: name.trim() });
                created = { ...res.character, type: 'character', richChar: res.character };
            } else if (activeTab === 'locations') {
                const res = await window.api.createLocation({ 
                    project_path: projectPath, 
                    name: name.trim(),
                    description: description
                });
                created = { ...res.location, type: 'location' };
            } else if (activeTab === 'groups') {
                const res = await window.api.createGroup({ project_path: projectPath, name: name.trim() });
                created = { ...res.group, type: 'group' };
            } else if (activeTab === 'lore') {
                const res = await window.api.createLoreEntity({ project_path: projectPath, name: name.trim(), category: category || 'item' });
                created = { ...res.entity };
            } else if (activeTab === 'twists') {
                const res = await window.api.createTwist({ project_path: projectPath, title: name.trim() });
                created = { ...res.twist, type: 'twist', name: res.twist.title };
            }
            setCreatingInTab(null);
            if (created) {
                handleInspectorUpdated();
                setInspectedEntity(created);
            }
        } catch (e) {
            console.error('Failed to create entity:', e);
        }
    }, [activeTab, projectPath, handleInspectorUpdated]);
    const handleReparentLocation = async (draggedLocationId, targetParentId) => {
        // Prevent cyclic dependencies
        const isDescendant = (childId, possibleParentId) => {
            let current = entities.find(e => e.type === 'location' && String(e.id) === String(childId))
            while (current) {
                if (String(current.parent_location_id) === String(possibleParentId)) return true
                current = entities.find(e => e.type === 'location' && String(e.id) === String(current.parent_location_id))
            }
            return false
        }
        
        if (isDescendant(targetParentId, draggedLocationId)) {
            // Trying to drop a parent into its own child
            console.warn('Cannot reparent a location to its own descendant.')
            return
        }

        try {
            await window.api.updateLocation({
                project_path: projectPath,
                location_id: draggedLocationId,
                parent_location_id: targetParentId
            })
            onEntityUpdated?.()
        } catch (err) {
            console.error('Failed to reparent location', err)
        }
    }

    const handleBulkDelete = useCallback(async () => {
        const toDeleteEntities = [];
        const toDeleteTwists = [];
        const toDeleteQuicknotes = [];
        const toDeleteAnnotations = [];
        selectedEntities.forEach(e => {
            if (e.type === "twist") toDeleteTwists.push(e);
            else if (e.type === "quicknote" || e.type === "quick_note") toDeleteQuicknotes.push(e);
            else if (e.type === "annotation") toDeleteAnnotations.push(e);
            else if (e.type !== "todo") toDeleteEntities.push(e);
        });
        try {
            if (toDeleteEntities.length > 0) {
                await window.api.bulkDeleteEntities({ project_path: projectPath, entities: toDeleteEntities.map(x => ({ type: x.type, id: x.id })) });
                await window.api.updateStat({ project_path: projectPath, stat_key: "deleted_entities", increment_by: toDeleteEntities.length });
            }
            for (const tw of toDeleteTwists) await window.api.deleteTwist({ project_path: projectPath, twist_id: tw.id });
            for (const q of toDeleteQuicknotes) await window.api.deleteQuickNote({ project_path: projectPath, note_id: q.id });
            for (const a of toDeleteAnnotations) await window.api.deleteAnnotation({ project_path: projectPath, annotation_id: a.id });
            setSelectedIds(new Set());
            setInspectedEntity(null);
            setShowDeleteConfirm(false);
            handleInspectorUpdated();
        } catch (err) {
            console.error("Bulk delete failed:", err);
        }
    }, [selectedEntities, projectPath, handleInspectorUpdated]);

    const handleBulkStatusChange = useCallback(async () => {
        if (!bulkStatus) return;
        const chars = selectedEntities.filter(e => e.type === 'character');
        try {
            await Promise.all(chars.map(c => window.api.updateCharacter({ project_path: projectPath, character_id: c.id, status: bulkStatus })));
            setBulkStatus('');
            setSelectedIds(new Set());
            handleInspectorUpdated();
        } catch (err) {
            console.error('Bulk status change failed:', err);
        }
    }, [bulkStatus, selectedEntities, projectPath, handleInspectorUpdated]);

    const openMergeConfirm = () => {
        if (!canMerge) return;
        setMergeKeepId(selectedEntities[0]?.id || null);
        setShowMergeConfirm(true);
    };

    const handleMerge = useCallback(async () => {
        if (!mergeKeepId || selectedEntities.length < 2) return;
        const mergeType = selectedEntities[0].type;
        const mergeIds = selectedEntities.filter(e => e.id !== mergeKeepId).map(e => e.id);
        try {
            await window.api.mergeEntities({
                project_path: projectPath,
                entity_type: mergeType,
                keep_id: mergeKeepId,
                merge_ids: mergeIds,
            });
            setSelectedIds(new Set());
            setInspectedEntity(null);
            setShowMergeConfirm(false);
            setMergeKeepId(null);
            handleInspectorUpdated();
        } catch (err) {
            console.error("Merge failed:", err);
        }
    }, [selectedEntities, mergeKeepId, projectPath, handleInspectorUpdated]);

    const selectAllFiltered = () => {
        const selectable = tabEntities.filter(e => e.type !== "todo");
        setSelectedIds(new Set(selectable.map(makeKey)));
    };

    const TABS = [
        { id: 'characters', label: t('stats.tabCharacters', 'Characters'), icon: <Icons.User /> },
        { id: 'groups', label: t('stats.tabGroups', 'Groups'), icon: <Icons.UsersGroup /> },
        { id: 'locations', label: t('stats.tabLocations', 'Locations'), icon: <Icons.MapPin /> },
        { id: 'lore', label: t('stats.tabLore', 'Lore & Items'), icon: <Icons.Gem /> },
        { id: 'twists', label: t('stats.tabTwists', 'Twists'), icon: <Icons.Twist /> },
        { id: 'quicknotes', label: t('stats.tabQuickNotes', 'Notes'), icon: <Icons.Feather /> },
        { id: 'todos', label: t('stats.tabTODOs', 'TODOs'), icon: <Icons.CheckCircle /> },
    ];

    const isGridTab = ["characters", "locations", "groups", "lore"].includes(activeTab);

    const handleTabChange = (id) => {
        setActiveTab(id);
        setSelectedIds(new Set());
        setSearchQuery("");
        setInspectedEntity(null);
        setCreatingInTab(null);
        setActiveFilters(new Set());
        setSortBy('name-asc');
        setBulkStatus('');
    };

    return (
        <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>

            {/* ── Left: inspector panel (always visible) ───────── */}
            {activeTab !== "todos" && (
                <div style={{
                    width: 360, minWidth: 360,
                    borderInlineEnd: `1px solid ${T.bg3}`,
                    background: T.bg1,
                    display: "flex", flexDirection: "column",
                    overflow: "hidden",
                }}>
                    {!inspectedEntity ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
                            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textAlign: "center", lineHeight: 1.6 }}>
                                {t("stats.emNothingSelected", "Select an item to inspect")}
                            </span>
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.bg3}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                    {t("stats.entityInspector", "Inspector")}
                                </span>
                                <button
                                    onClick={() => setInspectedEntity(null)}
                                    style={{ background: "none", border: `1px solid ${T.bg3}`, color: T.textDim, width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                                >
                                    <Icons.X />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                                {inspectedEntity.type === 'character' ? (
                                    <CharacterInspectorPanel
                                        entity={inspectedEntity}
                                        characters={characters}
                                        projectPath={projectPath}
                                        projectConfig={projectConfig}
                                        chapters={chapters}
                                        onEntityUpdated={handleInspectorUpdated}
                                        onIconChanged={loadEntityIcons}
                                    />
                                ) : inspectedEntity.type === 'location' ? (
                                    <LocationInspectorPanel
                                        entity={inspectedEntity}
                                        entities={entities}
                                        characters={characters}
                                        projectPath={projectPath}
                                        projectConfig={projectConfig}
                                        chapters={chapters}
                                        onEntityUpdated={handleInspectorUpdated}
                                        onIconChanged={loadEntityIcons}
                                    />
                                ) : inspectedEntity.type === 'quicknote' || inspectedEntity.type === 'quick_note' ? (
                                    <QuickNoteInspectorPanel
                                        entity={inspectedEntity}
                                        projectPath={projectPath}
                                        onEntityUpdated={handleInspectorUpdated}
                                    />
                                ) : inspectedEntity.type === 'annotation' ? (
                                    <AnnotationInspectorPanel
                                        entity={inspectedEntity}
                                        projectPath={projectPath}
                                        onEntityUpdated={handleInspectorUpdated}
                                    />
                                ) : inspectedEntity.type === 'twist' ? (
                                    <TwistInspectorPanel
                                        twistId={inspectedEntity.id}
                                        projectPath={projectPath}
                                        characters={characters}
                                        chapters={chapters}
                                        onNavigateChapter={(ch) => onNavigate?.(ch.id, 0)}
                                        onTwistDeleted={() => { setInspectedEntity(null); handleInspectorUpdated(); }}
                                    />
                                ) : (
                                    <EntityInspectorPanel
                                        entity={inspectedEntity}
                                        characters={characters}
                                        entities={entities}
                                        chapters={chapters}
                                        projectPath={projectPath}
                                        projectConfig={projectConfig}
                                        onEntityUpdated={handleInspectorUpdated}
                                        onConfigUpdate={onConfigUpdate}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Right: main content ───────────────────────────── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                {/* Header with + New button and search */}
                <div style={{ padding: "10px 24px", borderBottom: `1px solid ${T.bg3}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {['characters', 'locations', 'groups', 'lore', 'twists'].includes(activeTab) && (
                            creatingInTab === activeTab ? (
                                <button onClick={() => setCreatingInTab(null)} style={{ background: "none", border: `1px solid ${T.bg3}`, color: T.textDim, padding: "6px 12px", fontFamily: T.mono, fontSize: 11, cursor: "pointer" }}>
                                    ✕ {t('stats.cancel', 'Cancel')}
                                </button>
                            ) : (
                                <button onClick={() => setCreatingInTab(activeTab)} style={{ background: T.amber, border: `1px solid ${T.amber}`, color: T.bg0, padding: "6px 14px", fontFamily: T.mono, fontSize: 11, fontWeight: 600, cursor: "pointer", display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Icons.Plus /> {t('stats.emNewBtn', 'New')}
                                </button>
                            )
                        )}
                    </div>
                    <input
                        type="text"
                        placeholder={t("stats.searchEntities", "Search...")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ background: T.bg2, border: `1px solid ${T.bg3}`, color: T.text, padding: "6px 12px", fontFamily: T.mono, fontSize: 12, width: 220, outline: "none" }}
                    />
                </div>

                <TabBar tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

                {/* Filter chips */}
                {filterOptions.length > 0 && (
                    <div style={{ padding: '6px 24px', borderBottom: `1px solid ${T.bg3}`, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginRight: 4 }}>{t('stats.emFilter', 'Filter:')}</span>
                        {filterOptions.map(opt => {
                            const active = activeFilters.has(opt);
                            let label = opt;
                            if (activeTab === 'quicknotes') label = opt === 'annotation' ? t('stats.typeAnnotationPlural', 'Annotations') : t('stats.typeQuickNotePlural', 'Quick Notes');
                            else label = opt.charAt(0).toUpperCase() + opt.slice(1);
                            let chipColor = active ? T.amber : T.textDim;
                            if (activeTab === 'characters') { const sc = charStatusColor(opt); if (sc) chipColor = active ? sc : T.textDim; }
                            if (activeTab === 'twists') { chipColor = active ? (opt === 'revealed' ? 'var(--accent-green)' : opt === 'hinted' ? T.amber : T.textDim) : T.textDim; }
                            if (activeTab === 'quicknotes') { chipColor = active ? (opt === 'annotation' ? 'var(--accent-annotation)' : 'var(--entity-quicknote)') : T.textDim; }
                            return (
                                <button
                                    key={opt}
                                    onClick={() => setActiveFilters(prev => {
                                        const next = new Set(prev);
                                        if (next.has(opt)) next.delete(opt); else next.add(opt);
                                        return next;
                                    })}
                                    style={{
                                        background: active ? `${T.amber}20` : 'none',
                                        border: `1px solid ${active ? chipColor : T.bg3}`,
                                        color: chipColor,
                                        padding: '2px 8px', fontFamily: T.mono, fontSize: 10,
                                        cursor: 'pointer', borderRadius: 0,
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                        {activeFilters.size > 0 && (
                            <button onClick={() => setActiveFilters(new Set())} style={{ background: 'none', border: 'none', color: T.textDim, fontFamily: T.mono, fontSize: 10, cursor: 'pointer', textDecoration: 'underline', marginLeft: 4 }}>
                                {t('stats.clearSelection', 'Clear')}
                            </button>
                        )}
                    </div>
                )}

                {/* Selection bar */}
                {selectedIds.size > 0 && (
                    <div style={{ padding: "8px 24px", borderBottom: `1px solid ${T.bg3}`, background: T.bg2, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.amber }}>{t('stats.nSelected', '{{count}} selected', { count: selectedIds.size })}</span>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{ background: "none", border: `1px solid var(--accent-red-dim)`, color: "var(--accent-red)", padding: "4px 10px", fontFamily: T.mono, fontSize: 10, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                        >
                            <Icons.Trash /> {t('stats.deleteSelected', 'Delete')}
                        </button>
                        {canMerge && (
                            <button
                                onClick={openMergeConfirm}
                                style={{ background: "none", border: `1px solid ${T.amber}`, color: T.amber, padding: "4px 10px", fontFamily: T.mono, fontSize: 10, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                            >
                                <Icons.Merge /> {t('stats.mergeSelected', 'Merge')}
                            </button>
                        )}
                        {activeTab === 'characters' && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginInlineStart: 'auto' }}>
                                <select
                                    value={bulkStatus}
                                    onChange={e => setBulkStatus(e.target.value)}
                                    style={{ background: T.bg2, border: `1px solid ${T.bg3}`, color: T.text, padding: '4px 8px', fontFamily: T.mono, fontSize: 10, outline: 'none', cursor: 'pointer' }}
                                >
                                    <option value="">{t('stats.emSetStatus', 'Set status...')}</option>
                                    <option value="active">{t('stats.emStatusActive', 'Active')}</option>
                                    <option value="deceased">{t('stats.emStatusDeceased', 'Deceased')}</option>
                                    <option value="missing">{t('stats.emStatusMissing', 'Missing')}</option>
                                    <option value="unknown">{t('stats.emStatusUnknown', 'Unknown')}</option>
                                </select>
                                <button
                                    onClick={handleBulkStatusChange}
                                    disabled={!bulkStatus}
                                    style={{ background: bulkStatus ? T.amber : T.bg3, border: 'none', color: bulkStatus ? T.bg0 : T.textDim, padding: '4px 10px', fontFamily: T.mono, fontSize: 10, cursor: bulkStatus ? 'pointer' : 'default' }}
                                >
                                    {t('stats.emApply', 'Apply')}
                                </button>
                            </div>
                        )}
                        <button onClick={() => setSelectedIds(new Set())} style={{ background: "none", border: "none", color: T.textDim, fontFamily: T.mono, fontSize: 10, cursor: "pointer", marginInlineStart: activeTab !== 'characters' ? 'auto' : undefined }}>
                            {t('stats.cancel', 'Cancel')}
                        </button>
                    </div>
                )}

                {/* Item count + sort bar */}
                {selectedIds.size === 0 && tabEntities.length > 0 && (
                    <div style={{ padding: "5px 24px", borderBottom: `1px solid ${T.bg3}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>{t('stats.emItemCount', '{{count}} items', { count: tabEntities.length })}</span>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                style={{ background: T.bg2, border: `1px solid ${T.bg3}`, color: T.textDim, padding: '2px 6px', fontFamily: T.mono, fontSize: 10, outline: 'none', cursor: 'pointer' }}
                            >
                                <option value="name-asc">{t('stats.emSortNameAsc', 'Name A→Z')}</option>
                                <option value="name-desc">{t('stats.emSortNameDesc', 'Name Z→A')}</option>
                                {isGridTab && <option value="mentions-desc">{t('stats.emSortMentions', 'Most Mentioned')}</option>}
                                {(activeTab === 'characters' || activeTab === 'twists') && <option value="status">{t('stats.emSortByStatus', 'By Status')}</option>}
                            </select>
                            {activeTab === 'locations' && (
                                <button onClick={() => setLocationViewMode(v => v === 'grid' ? 'tree' : 'grid')} style={{ background: "none", border: "none", color: T.textDim, fontFamily: T.mono, fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>
                                    {locationViewMode === 'grid' ? t('stats.viewTree', 'Tree View') : t('stats.viewGrid', 'Grid View')}
                                </button>
                            )}
                            {activeTab !== 'todos' && (
                                <button onClick={selectAllFiltered} style={{ background: "none", border: "none", color: T.textDim, fontFamily: T.mono, fontSize: 10, cursor: "pointer", textDecoration: "underline" }}>
                                    {t('stats.selectAll', 'Select All')}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Content area */}
                <div style={{ flex: 1, overflowY: "auto", background: T.bg1 }}>
                    {/* Inline creation card */}
                    {creatingInTab === activeTab && (
                        <CreationCard
                            tabType={activeTab}
                            loreCategories={loreCats}
                            onConfirm={handleCreate}
                            onCancel={() => setCreatingInTab(null)}
                            projectPath={projectPath}
                            projectConfig={projectConfig}
                        />
                    )}

                    {tabEntities.length === 0 && creatingInTab !== activeTab ? (
                        <div style={{ padding: 60, textAlign: "center", color: T.textDim, fontFamily: T.mono, fontSize: 12 }}>
                            {t("stats.noData", "No items found for this view.")}
                        </div>

                    ) : isGridTab ? (
                        activeTab === 'locations' && locationViewMode === 'tree' ? (
                            <LocationTreeView
                                entities={tabEntities}
                                inspectedEntity={inspectedEntity}
                                selectedIds={selectedIds}
                                setInspectedEntity={setInspectedEntity}
                                toggleSelect={toggleSelect}
                                getMentions={getMentions}
                                firstAppearanceMap={firstAppearanceMap}
                                onNavigate={onNavigate}
                                onDropNode={handleReparentLocation}
                            />
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 1, padding: 1, background: T.bg3 }}>
                                {tabEntities.map(ent => {
                                    const key = makeKey(ent);
                                const inspecting = inspectedEntity && inspectedEntity.type === ent.type && String(inspectedEntity.id) === String(ent.id);
                                return (
                                    <EntityCard
                                        key={key}
                                        entity={ent}
                                        color={getEntityColor(ent.type)}
                                        selected={isSelected(ent)}
                                        inspecting={inspecting}
                                        onClick={() => setInspectedEntity(ent)}
                                        onCheckbox={() => toggleSelect(ent)}
                                        mentionCount={getMentions(ent.type, ent.id)}
                                        onMentionClick={() => {
                                            const fa = firstAppearanceMap[`${ent.type}-${ent.id}`];
                                            if (fa) onNavigate?.(fa.chapter_id, fa.word_offset);
                                        }}
                                        iconSrc={entityIcons[`${entityTypeToDbCode(ent.type)}:${ent.id}`] ? `fleshnote-asset://load/${projectPath.replace(/\\/g, '/')}/${entityIcons[`${entityTypeToDbCode(ent.type)}:${ent.id}`]}` : null}
                                    />
                                );
                            })}
                        </div>
                        )

                    ) : activeTab === "twists" ? (
                        <div>
                            {tabEntities.map(ent => {
                                const key = makeKey(ent);
                                const selected = isSelected(ent);
                                const inspecting = inspectedEntity && String(inspectedEntity.id) === String(ent.id);
                                return (
                                    <ListRow
                                        key={key}
                                        entity={ent}
                                        color={getEntityColor(ent.type)}
                                        selected={selected}
                                        inspecting={inspecting}
                                        onClick={() => setInspectedEntity(ent)}
                                        onCheckbox={() => toggleSelect(ent)}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{ent.name}</div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                                            <span style={{ fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase', color: ent.status === 'revealed' ? 'var(--accent-green)' : (ent.status === 'hinted' ? T.amber : T.textDim) }}>
                                                {ent.status || 'planned'}
                                            </span>
                                            {ent.twist_type && (
                                                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: 'capitalize' }}>· {ent.twist_type}</span>
                                            )}
                                        </div>
                                    </ListRow>
                                );
                            })}
                        </div>

                    ) : activeTab === "quicknotes" ? (
                        <div>
                            {tabEntities.map(ent => {
                                const key = makeKey(ent);
                                const selected = isSelected(ent);
                                const inspecting = inspectedEntity && inspectedEntity.type === ent.type && String(inspectedEntity.id) === String(ent.id);
                                const isAnnotation = ent.type === "annotation";
                                return (
                                    <ListRow
                                        key={key}
                                        entity={ent}
                                        color={getEntityColor(ent.type)}
                                        selected={selected}
                                        inspecting={inspecting}
                                        onClick={() => setInspectedEntity(ent)}
                                        onCheckbox={() => toggleSelect(ent)}
                                    >
                                        <div style={{ fontSize: 12, color: T.text, wordBreak: 'break-word', lineHeight: 1.5 }}>
                                            {ent.content || ent.name}
                                        </div>
                                        <div style={{ fontFamily: T.mono, fontSize: 10, marginTop: 3, color: isAnnotation ? 'var(--accent-annotation)' : 'var(--entity-quicknote)' }}>
                                            {isAnnotation ? t('stats.typeAnnotation', 'footnote annotation') : (() => {
                                                const NOTE_TYPE_COLORS = { Note: 'var(--accent-amber)', Fix: 'var(--accent-red)', Suggestion: 'var(--accent-blue)', Idea: '#4ade80' }
                                                const nt = ent.note_type || 'Note'
                                                return <span style={{ color: NOTE_TYPE_COLORS[nt] || 'var(--entity-quicknote)' }}>{nt}</span>
                                            })()}
                                        </div>
                                    </ListRow>
                                );
                            })}
                        </div>

                    ) : activeTab === "todos" ? (
                        <div>
                            {tabEntities.map(ent => (
                                <ListRow
                                    key={makeKey(ent)}
                                    entity={ent}
                                    color={getEntityColor(ent.type)}
                                    selected={false}
                                    inspecting={false}
                                    onClick={() => onNavigate?.(ent.chapter_id, ent.word_offset)}
                                    onCheckbox={null}
                                >
                                    <div style={{ fontSize: 12, color: T.text, wordBreak: 'break-word', lineHeight: 1.5 }}>{ent.content || ent.name}</div>
                                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 3 }}>
                                        Ch.{ent.chapter_number} — {ent.chapter_title}
                                    </div>
                                </ListRow>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* ── Merge Confirmation ───────────────────────────── */}
            {showMergeConfirm && (
                <div className="popup-overlay" onClick={() => setShowMergeConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", boxShadow: "0 12px 48px rgba(0,0,0,0.6)", width: 440, padding: "24px" }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: T.amber, marginBottom: 14 }}>{t("stats.mergeConfirmTitle", "Merge Entities?")}</div>
                        <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5, marginBottom: 16 }}>
                            {t("stats.confirmMerge", "Aliases and data from the other entities will be absorbed into the primary. The rest will be deleted.")}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                                {t("stats.mergeKeepLabel", "Keep as primary:")}
                            </div>
                            <select value={mergeKeepId || ""} onChange={(e) => setMergeKeepId(parseInt(e.target.value))} style={{ width: "100%", background: T.bg2, border: `1px solid ${T.bg3}`, color: T.text, padding: "8px 12px", fontFamily: T.mono, fontSize: 12, outline: "none", cursor: "pointer" }}>
                                {selectedEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: 16, background: T.bg2, border: `1px solid ${T.bg3}`, padding: 12 }}>
                            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: "uppercase", marginBottom: 8 }}>
                                {t("stats.willBeAbsorbed", "Will be absorbed & deleted:")}
                            </div>
                            {selectedEntities.filter(e => e.id !== mergeKeepId).map(e => (
                                <div key={makeKey(e)} style={{ fontSize: 12, color: "var(--accent-red)", padding: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
                                    <Icons.Trash /> {e.name}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button onClick={() => setShowMergeConfirm(false)} style={{ background: "none", border: `1px solid ${T.bg3}`, color: T.text, padding: "8px 16px", fontFamily: T.mono, fontSize: 12, cursor: "pointer" }}>{t('stats.cancel', 'Cancel')}</button>
                            <button onClick={handleMerge} style={{ background: T.amber, border: `1px solid ${T.amber}`, color: T.bg0, padding: "8px 16px", fontFamily: T.mono, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t('stats.confirmMergeBtn', 'Merge')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation ──────────────────────────── */}
            {showDeleteConfirm && (
                <div className="popup-overlay" onClick={() => setShowDeleteConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="popup-panel" onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", boxShadow: "0 12px 48px rgba(0,0,0,0.6)", width: 400, padding: "24px" }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--accent-red)", marginBottom: 14 }}>{t("stats.deleteConfirmTitle", "Delete Items?")}</div>
                        <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5, marginBottom: 20 }}>
                            {t("stats.confirmBulkDelete", "This will permanently delete {{count}} items. Mentions in text will lose their links.", { count: selectedIds.size })}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button onClick={() => setShowDeleteConfirm(false)} style={{ background: "none", border: `1px solid ${T.bg3}`, color: T.text, padding: "8px 16px", fontFamily: T.mono, fontSize: 12, cursor: "pointer" }}>{t('stats.cancel', 'Cancel')}</button>
                            <button onClick={handleBulkDelete} style={{ background: "var(--accent-red)", border: "1px solid var(--accent-red)", color: T.bg0, padding: "8px 16px", fontFamily: T.mono, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t('stats.confirmDelete', 'Delete')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
