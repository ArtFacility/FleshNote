import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import EntityInspectorPanel from "./EntityInspectorPanel";

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
};

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icons = {
    User: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    MapPin: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
    UsersGroup: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    Gem: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="6 3 18 3 22 11 12 21 2 11 6 3" /></svg>,
    Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
    Merge: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 6 4-4 4 4" /><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22" /><path d="m20 22-5-5" /></svg>,
    X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
};

function EntityTypeIcon({ type }) {
    switch (type) {
        case "character": return <Icons.User />;
        case "location": return <Icons.MapPin />;
        case "group": return <Icons.UsersGroup />;
        default: return <Icons.Gem />;
    }
}

function getEntityColor(type) {
    switch (type) {
        case "character": return "var(--entity-character)";
        case "location": return "var(--entity-location)";
        case "group": return "var(--entity-item)";
        default: return "var(--entity-item)";
    }
}

export default function EntityManager({ entities, characters, chapters, projectPath, projectConfig, onEntityUpdated, onConfigUpdate }) {
    const { t } = useTranslation();
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [inspectedEntity, setInspectedEntity] = useState(null);
    const [filterCategory, setFilterCategory] = useState("all");
    const [sortBy, setSortBy] = useState("name");
    const [searchQuery, setSearchQuery] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showMergeConfirm, setShowMergeConfirm] = useState(false);
    const [mergeKeepId, setMergeKeepId] = useState(null);

    // Build category list
    const categories = useMemo(() => {
        const cats = new Set();
        if (projectConfig?.lore_categories) {
            const confCats = Array.isArray(projectConfig.lore_categories)
                ? projectConfig.lore_categories
                : (typeof projectConfig.lore_categories === "string" ? JSON.parse(projectConfig.lore_categories) : []);
            confCats.forEach(c => cats.add(c.toLowerCase().trim()));
        }
        entities.forEach(e => {
            if (e.type !== "character" && e.type !== "location" && e.type !== "group" && e.type !== "quicknote" && e.type !== "quick_note" && e.category) {
                cats.add(e.category.toLowerCase().trim());
            }
        });
        return ["all", "character", "location", "group", ...Array.from(cats).sort()];
    }, [entities, projectConfig]);

    // Filter, search, sort
    const filteredEntities = useMemo(() => {
        let result = entities.filter(e => e.type !== "quick_note" && e.type !== "quicknote");

        if (filterCategory !== "all") {
            if (["character", "location", "group"].includes(filterCategory)) {
                result = result.filter(e => e.type === filterCategory);
            } else {
                result = result.filter(e =>
                    e.type !== "character" && e.type !== "location" && e.type !== "group" &&
                    (e.category || "").toLowerCase() === filterCategory
                );
            }
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e =>
                (e.name || "").toLowerCase().includes(q) ||
                (e.aliases || []).some(a => (a || "").toLowerCase().includes(q))
            );
        }

        result.sort((a, b) => {
            if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
            if (sortBy === "type") return (a.type || "").localeCompare(b.type || "") || (a.name || "").localeCompare(b.name || "");
            if (sortBy === "updated") return (b.updated_at || "").localeCompare(a.updated_at || "");
            return 0;
        });

        return result;
    }, [entities, filterCategory, searchQuery, sortBy]);

    // Selection helpers
    const makeKey = (e) => `${e.type}-${e.id}`;
    const isSelected = (e) => selectedIds.has(makeKey(e));

    const toggleSelect = (e) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            const key = makeKey(e);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const selectedEntities = useMemo(() => {
        return filteredEntities.filter(e => selectedIds.has(makeKey(e)));
    }, [filteredEntities, selectedIds]);

    const canMerge = useMemo(() => {
        if (selectedEntities.length < 2) return false;
        const types = new Set(selectedEntities.map(e => e.type));
        return types.size === 1;
    }, [selectedEntities]);

    // Clear inspected entity if it gets deleted
    useEffect(() => {
        if (inspectedEntity) {
            const still = entities.find(e => e.type === inspectedEntity.type && String(e.id) === String(inspectedEntity.id));
            if (!still) setInspectedEntity(null);
        }
    }, [entities, inspectedEntity]);

    // Bulk delete
    const handleBulkDelete = useCallback(async () => {
        const toDelete = selectedEntities.map(e => ({ type: e.type, id: e.id }));
        try {
            await window.api.bulkDeleteEntities({ project_path: projectPath, entities: toDelete });
            await window.api.updateStat({ project_path: projectPath, stat_key: "deleted_entities", increment_by: toDelete.length });
            setSelectedIds(new Set());
            setInspectedEntity(null);
            setShowDeleteConfirm(false);
            onEntityUpdated?.();
        } catch (err) {
            console.error("Bulk delete failed:", err);
        }
    }, [selectedEntities, projectPath, onEntityUpdated]);

    // Merge
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
            onEntityUpdated?.();
        } catch (err) {
            console.error("Merge failed:", err);
        }
    }, [selectedEntities, mergeKeepId, projectPath, onEntityUpdated]);

    // Refresh handler for inspector panel edits
    const handleInspectorUpdated = useCallback(() => {
        onEntityUpdated?.();
    }, [onEntityUpdated]);

    const selectAllFiltered = () => {
        setSelectedIds(new Set(filteredEntities.map(makeKey)));
    };

    const keepEntity = mergeKeepId ? selectedEntities.find(e => e.id === mergeKeepId) : null;

    return (
        <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
            {/* Left Inspector Panel */}
            {inspectedEntity && (
                <div style={{
                    width: 340, minWidth: 340,
                    borderInlineEnd: `1px solid ${T.bg3}`,
                    overflowY: "auto",
                    background: T.bg1,
                    display: "flex",
                    flexDirection: "column",
                }}>
                    <div style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${T.bg3}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            {t("stats.entityInspector", "Inspector")}
                        </span>
                        <button
                            onClick={() => setInspectedEntity(null)}
                            style={{
                                background: "none", border: `1px solid ${T.bg3}`, color: T.textDim,
                                width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                padding: 0,
                            }}
                            title={t("stats.closeInspector", "Close")}
                        >
                            <Icons.X />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                        <EntityInspectorPanel
                            entity={inspectedEntity}
                            characters={characters}
                            entities={entities}
                            activeChapter={null}
                            projectPath={projectPath}
                            projectConfig={projectConfig}
                            chapters={chapters}
                            onEntityUpdated={handleInspectorUpdated}
                            onConfigUpdate={onConfigUpdate}
                        />
                    </div>
                </div>
            )}

            {/* Right Main Content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Toolbar */}
                <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.bg3}`, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
                        <div>
                            <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.text, margin: 0, fontWeight: "normal" }}>
                                {t("stats.entityManager", "Entity Manager")}
                            </h3>
                            <p style={{ color: T.textDim, fontSize: 12, marginTop: 4, fontFamily: T.mono }}>
                                {t("stats.entityManagerDesc", "Manage, merge, and bulk-delete entities.")}
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                                type="text"
                                placeholder={t("stats.searchEntities", "Search entities...")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    background: T.bg2, border: `1px solid ${T.bg3}`, color: T.text,
                                    padding: "8px 12px", fontFamily: T.mono, fontSize: 12, width: 200, outline: "none",
                                }}
                            />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                style={{
                                    background: T.bg2, border: `1px solid ${T.bg3}`, color: T.text,
                                    padding: "8px 12px", fontFamily: T.mono, fontSize: 11, outline: "none", cursor: "pointer",
                                }}
                            >
                                <option value="name">{t("stats.sortByName", "Name")}</option>
                                <option value="type">{t("stats.sortByType", "Type")}</option>
                                <option value="updated">{t("stats.sortByUpdated", "Updated")}</option>
                            </select>
                        </div>
                    </div>

                    {/* Category filter chips */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {categories.map(c => (
                            <button
                                key={c}
                                onClick={() => setFilterCategory(c)}
                                style={{
                                    background: filterCategory === c ? T.amber : T.bg2,
                                    color: filterCategory === c ? T.bg0 : T.text,
                                    border: `1px solid ${filterCategory === c ? T.amber : T.bg3}`,
                                    padding: "5px 10px",
                                    fontFamily: T.mono,
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    cursor: "pointer",
                                    outline: "none",
                                }}
                            >
                                {c === "all" ? t("stats.all", "All") : c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Action bar (shown when selection > 0) */}
                {selectedIds.size > 0 && (
                    <div style={{
                        padding: "10px 24px",
                        borderBottom: `1px solid ${T.bg3}`,
                        background: T.bg2,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                    }}>
                        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.amber }}>
                            {t("stats.nSelected", "{{count}} selected", { count: selectedIds.size })}
                        </span>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{
                                background: "none", border: `1px solid var(--accent-red-dim)`, color: "var(--accent-red)",
                                padding: "6px 12px", fontFamily: T.mono, fontSize: 10, textTransform: "uppercase",
                                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                            }}
                        >
                            <Icons.Trash /> {t("stats.deleteSelected", "Delete")}
                        </button>
                        <button
                            onClick={openMergeConfirm}
                            disabled={!canMerge}
                            style={{
                                background: "none",
                                border: `1px solid ${canMerge ? T.amber : T.bg3}`,
                                color: canMerge ? T.amber : T.textDim,
                                padding: "6px 12px", fontFamily: T.mono, fontSize: 10, textTransform: "uppercase",
                                cursor: canMerge ? "pointer" : "not-allowed",
                                display: "flex", alignItems: "center", gap: 6,
                                opacity: canMerge ? 1 : 0.5,
                            }}
                            title={!canMerge ? t("stats.mergeRequiresSameType", "Select 2+ entities of the same type") : ""}
                        >
                            <Icons.Merge /> {t("stats.mergeSelected", "Merge")}
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            style={{
                                background: "none", border: `1px solid ${T.bg3}`, color: T.textDim,
                                padding: "6px 12px", fontFamily: T.mono, fontSize: 10, textTransform: "uppercase",
                                cursor: "pointer", marginInlineStart: "auto",
                            }}
                        >
                            {t("stats.clearSelection", "Clear")}
                        </button>
                    </div>
                )}

                {/* Select all bar */}
                {selectedIds.size === 0 && filteredEntities.length > 0 && (
                    <div style={{
                        padding: "8px 24px",
                        borderBottom: `1px solid ${T.bg3}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}>
                        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
                            {filteredEntities.length} {t("stats.entitiesShown", "entities")}
                        </span>
                        <button
                            onClick={selectAllFiltered}
                            style={{
                                background: "none", border: "none", color: T.textDim,
                                fontFamily: T.mono, fontSize: 10, cursor: "pointer", textDecoration: "underline",
                            }}
                        >
                            {t("stats.selectAll", "Select all")}
                        </button>
                    </div>
                )}

                {/* Entity list */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                    {filteredEntities.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: T.textDim, fontFamily: T.mono, fontSize: 11 }}>
                            {t("stats.noEntitiesMatch", "No entities match the current filters.")}
                        </div>
                    ) : (
                        filteredEntities.map(ent => {
                            const key = makeKey(ent);
                            const selected = isSelected(ent);
                            const inspecting = inspectedEntity && inspectedEntity.type === ent.type && String(inspectedEntity.id) === String(ent.id);
                            return (
                                <div
                                    key={key}
                                    onClick={() => setInspectedEntity(ent)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "10px 24px",
                                        background: selected ? T.amberDim : (inspecting ? T.bg2 : "transparent"),
                                        borderBottom: `1px solid ${T.bg3}40`,
                                        borderInlineStart: inspecting ? `2px solid ${T.amber}` : "2px solid transparent",
                                        cursor: "pointer",
                                        transition: "background 0.15s",
                                    }}
                                    onMouseEnter={(e) => { if (!selected && !inspecting) e.currentTarget.style.background = T.bg2; }}
                                    onMouseLeave={(e) => { if (!selected && !inspecting) e.currentTarget.style.background = "transparent"; }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={(e) => { e.stopPropagation(); toggleSelect(ent); }}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ accentColor: T.amber, cursor: "pointer", flexShrink: 0 }}
                                    />
                                    <div style={{ color: getEntityColor(ent.type), flexShrink: 0, display: "flex", alignItems: "center" }}>
                                        <EntityTypeIcon type={ent.type} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 13, fontWeight: 600, color: T.text,
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                        }}>
                                            {ent.name}
                                        </div>
                                        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: "uppercase", marginTop: 2 }}>
                                            {ent.type === "lore" || (ent.type !== "character" && ent.type !== "location" && ent.type !== "group")
                                                ? (ent.category || "lore")
                                                : ent.type
                                            }
                                            {ent.aliases?.length > 0 && ` \u2022 ${ent.aliases.length} ${t("stats.aliasCount", "aliases")}`}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Delete Confirmation Popup */}
            {showDeleteConfirm && (
                <div
                    className="popup-overlay"
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                    <div
                        className="popup-panel"
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", boxShadow: "0 12px 48px rgba(0,0,0,0.6)", width: 400, padding: "24px" }}
                    >
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--accent-red)", marginBottom: 14 }}>
                            {t("stats.deleteConfirmTitle", "Delete Entities?")}
                        </div>
                        <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5, marginBottom: 20 }}>
                            {t("stats.confirmBulkDelete", "This will permanently delete {{count}} entities. Mentions in text will lose their links.", { count: selectedIds.size })}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    background: "none", border: `1px solid ${T.bg3}`, color: T.text,
                                    padding: "8px 16px", fontFamily: T.mono, fontSize: 12, cursor: "pointer",
                                }}
                            >
                                {t("stats.cancel", "Cancel")}
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                style={{
                                    background: "var(--accent-red)", border: "1px solid var(--accent-red)", color: T.bg0,
                                    padding: "8px 16px", fontFamily: T.mono, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                }}
                            >
                                {t("stats.confirmDelete", "Delete")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Merge Confirmation Popup */}
            {showMergeConfirm && (
                <div
                    className="popup-overlay"
                    onClick={() => setShowMergeConfirm(false)}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                    <div
                        className="popup-panel"
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: "var(--bg-base)", border: "1px solid var(--border-default)", boxShadow: "0 12px 48px rgba(0,0,0,0.6)", width: 440, padding: "24px" }}
                    >
                        <div style={{ fontSize: 16, fontWeight: 600, color: T.amber, marginBottom: 14 }}>
                            {t("stats.mergeConfirmTitle", "Merge Entities?")}
                        </div>
                        <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5, marginBottom: 16 }}>
                            {t("stats.confirmMerge", "Aliases and data from the other entities will be absorbed into the primary. The rest will be deleted.")}
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                                {t("stats.mergeKeepLabel", "Keep as primary:")}
                            </div>
                            <select
                                value={mergeKeepId || ""}
                                onChange={(e) => setMergeKeepId(parseInt(e.target.value))}
                                style={{
                                    width: "100%",
                                    background: T.bg2, border: `1px solid ${T.bg3}`, color: T.text,
                                    padding: "8px 12px", fontFamily: T.mono, fontSize: 12, outline: "none", cursor: "pointer",
                                }}
                            >
                                {selectedEntities.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
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
                            <button
                                onClick={() => setShowMergeConfirm(false)}
                                style={{
                                    background: "none", border: `1px solid ${T.bg3}`, color: T.text,
                                    padding: "8px 16px", fontFamily: T.mono, fontSize: 12, cursor: "pointer",
                                }}
                            >
                                {t("stats.cancel", "Cancel")}
                            </button>
                            <button
                                onClick={handleMerge}
                                style={{
                                    background: T.amber, border: `1px solid ${T.amber}`, color: T.bg0,
                                    padding: "8px 16px", fontFamily: T.mono, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                }}
                            >
                                {t("stats.confirmMergeBtn", "Merge")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

