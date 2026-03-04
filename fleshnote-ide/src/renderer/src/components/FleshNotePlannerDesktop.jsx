import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

/* ─── constants ─── */
const RAIL_Y = 240; // Shifted down so the text input doesn't overlap the top lane
const BLOCK_W = 134;
const BLOCK_H = 52;

// Block lanes: 3 lanes ABOVE the rail
const LANE_Y = [RAIL_Y - 72, RAIL_Y - 136, RAIL_Y - 200];

// Arc area BELOW rail
const ARC_TOP = RAIL_Y + 30;

const PRESET_COLORS = [
    "#d4a052", "#c45c5c", "#5c8ec4", "#5c9e6e", "#8b6ec4", "#e11d48",
    "#0891b2", "#ca8a04", "#db2777", "#4f46e5", "#059669", "#ea580c",
];

const BLOCK_TYPES = {
    beat: { label: "Beat", defaultColor: "var(--accent-amber)" },
    reveal: { label: "Reveal", defaultColor: "var(--accent-purple)" },
    twist: { label: "Twist", defaultColor: "var(--accent-red)" },
    climax: { label: "Climax", defaultColor: "var(--accent-blue)" },
};

const SHADOW_BLOCK_TYPES = {
    development: { label: "Development", defaultColor: "var(--accent-purple)" },
    change: { label: "Change", defaultColor: "var(--accent-red)" },
    move: { label: "Move", defaultColor: "var(--accent-blue)" },
};

/* ─── generate IDs ─── */
function uuid() {
    return Math.random().toString(36).substr(2, 9);
}

// ─── SVG Icons ───
const Icons = {
    Plus: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    X: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    Eye: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
    EyeOff: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
    Save: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>,
    ChevronUp: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>,
    ChevronDown: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>,
};

export default function FleshNotePlannerDesktop({ projectPath, chapters, activeChapter }) {
    const { t } = useTranslation();
    // Data
    const [settings, setSettings] = useState({ theme: "", cursor_pct: 0, shadow_visible: 0 });
    const [blocks, setBlocks] = useState([]);
    const [arcs, setArcs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Active states
    const [activeLayer, setActiveLayer] = useState("surface");
    const [colorPickerArcId, setColorPickerArcId] = useState(null);
    const [hoveredBlockId, setHoveredBlockId] = useState(null);

    // Dragging states
    const [draggingBlockId, setDraggingBlockId] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizingArc, setResizingArc] = useState(null); // { id, handle: 'start'|'end' }

    // Canvas panning states
    const [isCanvasPanning, setIsCanvasPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, scrollLeft: 0 });

    const [zoomMultiplier, setZoomMultiplier] = useState(1.5);
    const [containerWidth, setContainerWidth] = useState(800);

    const containerRef = useRef(null);
    const canvasRef = useRef(null);

    const railGeom = useMemo(() => {
        const basePadding = 100;
        const railWidth = Math.max(200, (containerWidth * zoomMultiplier) - basePadding * 2);
        const contentWidth = railWidth + basePadding * 2;

        // Center the rail when content is narrower than the container
        let left = basePadding;
        if (contentWidth < containerWidth) {
            left = (containerWidth - railWidth) / 2;
        }

        return { left, width: railWidth, right: left + railWidth };
    }, [containerWidth, zoomMultiplier]);

    // Chapter span ranges (proportional to target_word_count)
    const chapterSpans = useMemo(() => {
        if (!chapters || chapters.length === 0) return [];
        const totalTarget = chapters.reduce((sum, c) => sum + (c.target_word_count || 1), 0);
        const spans = [];
        let cursor = 0;
        for (const ch of chapters) {
            const span = ((ch.target_word_count || 1) / totalTarget) * 100;
            spans.push({ id: ch.id, chapter_number: ch.chapter_number, title: ch.title, startPct: cursor, endPct: cursor + span, status: ch.status });
            cursor += span;
        }
        return spans;
    }, [chapters]);

    useEffect(() => {
        if (!containerRef.current) return;
        const updateWidth = (w) => {
            setContainerWidth(w);
        };
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) updateWidth(entries[0].contentRect.width);
        });
        observer.observe(containerRef.current);
        updateWidth(containerRef.current.getBoundingClientRect().width);
        return () => observer.disconnect();
    }, [loading]); // Crucial fix: initialize observer after loading completes

    // Theme autosave
    const themeSaveTimeout = useRef(null);

    // Load from backend
    useEffect(() => {
        if (!projectPath) return;
        const fetchPlanner = async () => {
            try {
                const res = await window.api.loadPlanner(projectPath);
                if (res.status === "ok") {
                    setSettings(res.settings || { theme: "", cursor_pct: 0, shadow_visible: 0 });
                    setBlocks(res.blocks || []);
                    setArcs(res.arcs || []);
                }
            } catch (err) {
                console.error("Failed to load planner data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPlanner();
    }, [projectPath]);

    // Persist modifications wrapper
    const apiSaveBlock = async (b) => {
        try { await window.api.savePlannerBlock({ ...b, project_path: projectPath }); } catch (e) { console.error(e); }
    };
    const apiSaveArc = async (a) => {
        try { await window.api.savePlannerArc({ ...a, project_path: projectPath }); } catch (e) { console.error(e); }
    };
    const apiDeleteBlock = async (id) => {
        try { await window.api.deletePlannerBlock({ id, project_path: projectPath }); } catch (e) { console.error(e); }
    };
    const apiDeleteArc = async (id) => {
        try { await window.api.deletePlannerArc({ id, project_path: projectPath }); } catch (e) { console.error(e); }
    };
    const apiUpdateSettings = async (updates) => {
        try { await window.api.updatePlannerSettings({ ...updates, project_path: projectPath }); } catch (e) { console.error(e); }
    };

    // Debounced Savers
    const saveBlockTimeout = useRef({});
    const debouncedSaveBlock = (b) => {
        if (saveBlockTimeout.current[b.id]) clearTimeout(saveBlockTimeout.current[b.id]);
        saveBlockTimeout.current[b.id] = setTimeout(() => {
            apiSaveBlock(b);
        }, 500);
    };

    const saveArcTimeout = useRef({});
    const debouncedSaveArc = (a) => {
        if (saveArcTimeout.current[a.id]) clearTimeout(saveArcTimeout.current[a.id]);
        saveArcTimeout.current[a.id] = setTimeout(() => {
            apiSaveArc(a);
        }, 500);
    };

    // Auto-assign chapter_id based on block pct position within chapter spans
    useEffect(() => {
        if (chapterSpans.length === 0 || blocks.length === 0) return;
        let anyChanged = false;
        const updated = blocks.map(b => {
            const span = chapterSpans.find(s => b.pct >= s.startPct && b.pct < s.endPct)
                || chapterSpans[chapterSpans.length - 1]; // pct=100 edge case
            if (span && b.chapter_id !== span.id) {
                anyChanged = true;
                const newBlock = { ...b, chapter_id: span.id, chapter_status: span.status };
                debouncedSaveBlock(newBlock);
                return newBlock;
            }
            return b;
        });
        if (anyChanged) setBlocks(updated);
    }, [chapterSpans]);

    /* ─── Handlers ─── */
    const handleThemeChange = (val) => {
        setSettings(prev => ({ ...prev, theme: val }));
        if (themeSaveTimeout.current) clearTimeout(themeSaveTimeout.current);
        themeSaveTimeout.current = setTimeout(() => {
            apiUpdateSettings({ theme: val });
        }, 1000);
    };

    const toggleLayerVisibility = () => {
        const nextVal = settings.shadow_visible ? 0 : 1;
        setSettings(prev => ({ ...prev, shadow_visible: nextVal }));
        apiUpdateSettings({ shadow_visible: nextVal });
    };

    // Blocks
    const addBlock = () => {
        const newB = {
            id: "b_" + uuid(),
            layer: activeLayer,
            block_type: "beat",
            label: t('ide.newBeat', "New Beat"),
            pct: 50,
            lane: 0,
        };
        setBlocks((prev) => [...prev, newB]);
        apiSaveBlock(newB);
    };

    const startDragBlock = (e, id) => {
        e.stopPropagation();
        const blockRect = e.currentTarget.getBoundingClientRect();

        // Save distance from mouse to block center (crucial for accurate placement regardless of width)
        const blockCenterX = blockRect.left + blockRect.width / 2;
        const offsetXFromCenter = e.clientX - blockCenterX;
        const offsetY = e.clientY - blockRect.top;

        setDraggingBlockId(id);
        setDragOffset({ x: offsetXFromCenter, y: offsetY });
    };

    const updateBlockProps = (id, props) => {
        setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...props } : b)));
        const target = blocks.find(b => b.id === id);
        if (target) debouncedSaveBlock({ ...target, ...props });
    };

    const deleteBlock = (e, id) => {
        e.stopPropagation();
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        apiDeleteBlock(id);
    };

    // Arcs
    const addArc = () => {
        const newA = {
            id: "a_" + uuid(),
            layer: activeLayer,
            name: t('ide.newArc', "New Arc"),
            description: "",
            color: PRESET_COLORS[arcs.length % PRESET_COLORS.length],
            start_pct: 10,
            end_pct: 90,
        };
        setArcs((prev) => [...prev, newA]);
        apiSaveArc(newA);
    };

    const startResizeArc = (e, id, handle) => {
        e.stopPropagation();
        setResizingArc({ id, handle });
    };

    const updateArcProps = (id, props) => {
        setArcs((prev) => prev.map((a) => (a.id === id ? { ...a, ...props } : a)));
        const target = arcs.find(a => a.id === id);
        if (target) debouncedSaveArc({ ...target, ...props });
    };

    const deleteArc = (id) => {
        setArcs((prev) => prev.filter((a) => a.id !== id));
        apiDeleteArc(id);
    };

    const reorderArc = (id, direction) => {
        setArcs((prev) => {
            const layerArcs = prev.filter(a => a.layer === activeLayer);
            const otherArcs = prev.filter(a => a.layer !== activeLayer);
            const idx = layerArcs.findIndex(a => a.id === id);
            if (idx < 0) return prev;
            const swapIdx = idx + direction;
            if (swapIdx < 0 || swapIdx >= layerArcs.length) return prev;
            const reordered = [...layerArcs];
            [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
            // Persist sort_order for swapped arcs
            reordered.forEach((a, i) => {
                const updated = { ...a, sort_order: i };
                debouncedSaveArc(updated);
            });
            return [...otherArcs, ...reordered.map((a, i) => ({ ...a, sort_order: i }))];
        });
    };

    // Global mouse handlers (Workspace dragging)
    const onMouseMove = useCallback((e) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        // Calculate coordinate relative to planner-content (vital for scrolling to right works properly)
        const mouseX = (e.clientX - rect.left) + canvasRef.current.scrollLeft;
        const mouseY = (e.clientY - rect.top) + canvasRef.current.scrollTop;

        if (draggingBlockId) {
            // Because dragOffset.x is relative to the center, blockCenter perfectly aligns no matter the compressed width
            let blockCenter = mouseX - dragOffset.x;

            let pct = ((blockCenter - railGeom.left) / railGeom.width) * 100;
            pct = Math.max(0, Math.min(100, pct));

            let nearestLane = 0;
            let minD = Infinity;
            LANE_Y.forEach((ly, idx) => {
                const d = Math.abs(mouseY - (ly + BLOCK_H / 2));
                if (d < minD) {
                    minD = d;
                    nearestLane = idx;
                }
            });

            setBlocks((prev) =>
                prev.map((b) => (b.id === draggingBlockId ? { ...b, pct, lane: nearestLane } : b))
            );
        }

        if (resizingArc) {
            let pct = ((mouseX - railGeom.left) / railGeom.width) * 100;
            pct = Math.max(0, Math.min(100, pct));

            setArcs((prev) =>
                prev.map((a) => {
                    if (a.id !== resizingArc.id) return a;
                    let { start_pct, end_pct } = a;
                    if (resizingArc.handle === "start") {
                        start_pct = Math.min(pct, end_pct - 2);
                    } else {
                        end_pct = Math.max(pct, start_pct + 2);
                    }
                    return { ...a, start_pct, end_pct };
                })
            );
        }
    }, [draggingBlockId, dragOffset, resizingArc, railGeom]);

    const onMouseUp = useCallback(() => {
        if (draggingBlockId) {
            const target = blocks.find(b => b.id === draggingBlockId);
            if (target) {
                // Auto-assign chapter based on where block was dropped
                const span = chapterSpans.find(s => target.pct >= s.startPct && target.pct < s.endPct)
                    || (chapterSpans.length > 0 ? chapterSpans[chapterSpans.length - 1] : null);
                if (span && target.chapter_id !== span.id) {
                    const updated = { ...target, chapter_id: span.id, chapter_status: span.status };
                    setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b));
                    apiSaveBlock(updated);
                } else {
                    apiSaveBlock(target);
                }
            }
            setDraggingBlockId(null);
        }
        if (resizingArc) {
            const target = arcs.find(a => a.id === resizingArc.id);
            if (target) apiSaveArc(target);
            setResizingArc(null);
        }
        if (isCanvasPanning) {
            setIsCanvasPanning(false);
        }
    }, [draggingBlockId, resizingArc, blocks, arcs, isCanvasPanning, chapterSpans]);

    useEffect(() => {
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    // Scroll-wheel zoom (non-passive for preventDefault)
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const direction = e.deltaY < 0 ? 1 : -1;
                setZoomMultiplier(prev =>
                    Math.round(Math.max(0.5, Math.min(5.0, prev + 0.1 * direction)) * 10) / 10
                );
            }
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [loading]); // Re-attach after loading completes and canvasRef mounts

    // Filter lists
    const visibleBlocks = blocks.filter(
        (b) => b.layer === activeLayer || settings.shadow_visible
    );
    const visibleArcs = arcs
        .filter((a) => a.layer === activeLayer || settings.shadow_visible)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Compute UI geometry (compress close blocks)
    const COMPRESSED_W = 24;
    const blockGeom = useMemo(() => {
        const geom = {};
        const lanes = [0, 1, 2];

        const xs = visibleBlocks.map(b => ({
            ...b,
            center: railGeom.left + (b.pct / 100) * railGeom.width
        }));

        lanes.forEach(lane => {
            const laneBlocks = xs.filter(b => b.lane === lane).sort((a, b) => a.pct - b.pct);
            for (let i = 0; i < laneBlocks.length; i++) {
                const current = laneBlocks[i];
                let isCompressed = false;

                if (i > 0) {
                    const prev = laneBlocks[i - 1];
                    if (current.center - prev.center < BLOCK_W + 12) isCompressed = true;
                }
                if (i < laneBlocks.length - 1) {
                    const next = laneBlocks[i + 1];
                    if (next.center - current.center < BLOCK_W + 12) isCompressed = true;
                }

                geom[current.id] = {
                    center: current.center,
                    isCompressed
                };
            }
        });
        return geom;
    }, [visibleBlocks, railGeom]);

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t('ide.loadingPlanner', 'Loading planner...')}</div>;

    return (
        <div
            ref={containerRef}
            style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                height: "100%",
                backgroundColor: "var(--bg-deep)",
                fontFamily: "var(--font-sans)",
                userSelect: "none",
                position: "relative",
            }}
        >
            {/* HEADER SECTION */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "24px 40px 0",
                }}
            >
                <div style={{ display: "flex", gap: "20px" }}>
                    <button
                        onClick={() => setActiveLayer("surface")}
                        style={{
                            background: "none",
                            border: "none",
                            color: activeLayer === "surface" ? "var(--text-primary)" : "var(--text-tertiary)",
                            fontFamily: "var(--font-mono)",
                            fontSize: "13px",
                            fontWeight: activeLayer === "surface" ? 600 : 400,
                            cursor: "pointer",
                            transition: "color 0.2s",
                        }}
                    >
                        {t('ide.surfaceLayer', 'Surface Layer')}
                    </button>
                    <button
                        onClick={() => setActiveLayer("shadow")}
                        style={{
                            background: "none",
                            border: "none",
                            color: activeLayer === "shadow" ? "var(--accent-purple)" : "var(--text-tertiary)",
                            fontFamily: "var(--font-mono)",
                            fontSize: "13px",
                            fontWeight: activeLayer === "shadow" ? 600 : 400,
                            cursor: "pointer",
                            transition: "color 0.2s",
                        }}
                    >
                        {t('ide.shadowLayer', 'Shadow Layer')}
                    </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <button
                        onClick={toggleLayerVisibility}
                        title={settings.shadow_visible ? t('ide.hideInactiveLayer', 'Hide inactive layer') : t('ide.showInactiveLayer', 'Show inactive layer')}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "28px",
                            height: "28px",
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border-subtle)",
                            cursor: "pointer",
                            color: settings.shadow_visible ? "var(--accent-amber)" : "var(--text-tertiary)",
                        }}
                    >
                        {settings.shadow_visible ? <Icons.Eye /> : <Icons.EyeOff />}
                    </button>

                    <button
                        onClick={addBlock}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 14px",
                            backgroundColor: "var(--bg-elevated)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-default)",
                            cursor: "pointer",
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            textTransform: "uppercase",
                        }}
                    >
                        <Icons.Plus /> {t('ide.addBlock', 'Add Block')}
                    </button>

                    <button
                        onClick={addArc}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 14px",
                            backgroundColor: "var(--bg-elevated)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-default)",
                            cursor: "pointer",
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            textTransform: "uppercase",
                        }}
                    >
                        <Icons.Plus /> {t('ide.addArc', 'Add Arc')}
                    </button>

                    <div style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "0 12px", borderLeft: "1px solid var(--border-subtle)", marginLeft: "8px"
                    }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>{t('ide.zoom', 'ZOOM')}</span>
                        <input
                            type="range"
                            min="0.5" max="5.0" step="0.1"
                            value={zoomMultiplier}
                            onChange={(e) => setZoomMultiplier(parseFloat(e.target.value))}
                            style={{ width: "80px", cursor: "pointer", accentColor: "var(--accent-amber)" }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ padding: "16px 40px", width: "100%", maxWidth: "800px" }}>
                <input
                    value={settings.theme || ""}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    placeholder={t('ide.themePlaceholder', 'What is the central theme of this story?')}
                    maxLength={120}
                    style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid var(--border-subtle)",
                        padding: "8px 0",
                        color: activeLayer === "shadow" ? "var(--accent-purple)" : "var(--text-primary)",
                        fontFamily: "var(--font-serif)",
                        fontSize: "18px",
                        fontStyle: "italic",
                        outline: "none",
                    }}
                />
            </div>

            {/* PLANNER CANVAS */}
            <div
                ref={canvasRef}
                onMouseDown={(e) => {
                    // Only initiate panning if clicking directly on the canvas background
                    if (e.target === e.currentTarget || e.target.id === 'planner-bg') {
                        setIsCanvasPanning(true);
                        setPanStart({ x: e.clientX, scrollLeft: canvasRef.current.scrollLeft });
                    }
                }}
                onMouseMove={(e) => {
                    if (isCanvasPanning) {
                        const dx = e.clientX - panStart.x;
                        canvasRef.current.scrollLeft = panStart.scrollLeft - dx;
                    }
                }}
                onMouseLeave={() => setIsCanvasPanning(false)}
                style={{
                    flex: 1,
                    position: "relative",
                    overflowX: "auto",
                    overflowY: "auto",
                    display: "flex", // Ensure it behaves block-level stretching
                    cursor: isCanvasPanning ? "grabbing" : "grab"
                }}
            >
                <div id="planner-bg" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, minWidth: `${Math.max(800, railGeom.right + 100)}px`, minHeight: `${Math.max(400, ARC_TOP + (visibleArcs.length * 72) + 80)}px` }}>
                    {/* Visual Lane Background Rails */}
                    {LANE_Y.map((y, idx) => (
                        <div
                            key={`lane-${idx}`}
                            style={{
                                position: "absolute",
                                left: railGeom.left,
                                top: y,
                                width: railGeom.width,
                                height: BLOCK_H,
                                background: "rgba(255, 255, 255, 0.015)",
                                borderTop: "1px dashed var(--border-subtle)",
                                borderBottom: "1px dashed var(--border-subtle)",
                                pointerEvents: "none"
                            }}
                        />
                    ))}

                    {/* Main Rail Line */}
                    <div
                        style={{
                            position: "absolute",
                            top: RAIL_Y + 12,
                            left: railGeom.left,
                            width: railGeom.width,
                            height: "2px",
                            background: "var(--border-default)",
                        }}
                    />

                    {/* Timeline Percentage Markers */}
                    {[0, 25, 50, 75, 100].map((pct) => {
                        const mx = railGeom.left + (pct / 100) * railGeom.width;
                        return (
                            <div key={`tick-${pct}`} style={{ position: "absolute", left: mx, top: RAIL_Y + 6, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", transform: "translateX(-50%)" }}>
                                <div style={{ width: "1px", height: "14px", background: "var(--border-subtle)" }} />
                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--text-tertiary)", marginTop: "2px", opacity: 0.6 }}>{pct}%</span>
                            </div>
                        );
                    })}

                    {/* Render Timeline Arcs */}
                    {visibleArcs.map((a) => {
                        const isInactive = a.layer !== activeLayer;
                        const x1 = railGeom.left + (a.start_pct / 100) * railGeom.width;
                        const x2 = railGeom.left + (a.end_pct / 100) * railGeom.width;
                        const w = Math.max(0, x2 - x1);
                        const myIndex = visibleArcs.filter(va => va.layer === a.layer).findIndex(va => va.id === a.id);
                        const yOffset = ARC_TOP + (myIndex * 72) + 12;

                        return (
                            <div
                                key={a.id}
                                style={{
                                    position: "absolute",
                                    left: x1,
                                    top: yOffset,
                                    width: w,
                                    opacity: isInactive ? 0.25 : 1,
                                    pointerEvents: isInactive ? "none" : "auto",
                                }}
                            >
                                {/* Arc Title Input */}
                                <input
                                    value={a.name}
                                    onChange={(e) => updateArcProps(a.id, { name: e.target.value })}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    maxLength={24}
                                    style={{
                                        position: "absolute",
                                        top: "-34px",
                                        left: "10px",
                                        background: "transparent",
                                        color: a.color,
                                        border: "none",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        outline: "none",
                                        width: Math.max(w - 20, 60),
                                    }}
                                />

                                {/* Arc Description Input */}
                                <input
                                    value={a.description || ""}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 80) {
                                            updateArcProps(a.id, { description: e.target.value });
                                        }
                                    }}
                                    placeholder={t('ide.addDescription', "Add description...")}
                                    maxLength={80}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        position: "absolute",
                                        top: "-18px",
                                        left: "10px",
                                        background: "transparent",
                                        color: "var(--text-tertiary)",
                                        border: "none",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: "9px",
                                        letterSpacing: "0.5px",
                                        outline: "none",
                                        width: Math.max(w - 20, 60),
                                        opacity: a.description ? 0.8 : 0.4,
                                        transition: "opacity 0.15s ease",
                                    }}
                                    onFocus={(e) => { e.target.style.opacity = "1"; e.target.style.color = "var(--text-secondary)"; }}
                                    onBlur={(e) => {
                                        e.target.style.opacity = a.description ? "0.8" : "0.4";
                                        e.target.style.color = "var(--text-tertiary)";
                                    }}
                                />

                                {/* Arc Color Swatch + Delete */}
                                <div style={{ position: "absolute", top: "-36px", right: "0px", display: "flex", alignItems: "center", gap: "4px" }}>
                                    {/* Color swatch */}
                                    <div style={{ position: "relative" }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setColorPickerArcId(colorPickerArcId === a.id ? null : a.id); }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            style={{
                                                width: "14px",
                                                height: "14px",
                                                background: a.color,
                                                border: "2px solid var(--border-default)",
                                                cursor: "pointer",
                                                padding: 0,
                                            }}
                                        />
                                        {colorPickerArcId === a.id && (
                                            <div
                                                onMouseDown={(e) => e.stopPropagation()}
                                                style={{
                                                    position: "absolute",
                                                    top: "20px",
                                                    right: 0,
                                                    display: "grid",
                                                    gridTemplateColumns: "repeat(4, 1fr)",
                                                    gap: "4px",
                                                    padding: "8px",
                                                    background: "var(--bg-elevated)",
                                                    border: "1px solid var(--border-default)",
                                                    zIndex: 50,
                                                }}
                                            >
                                                {PRESET_COLORS.map((c) => (
                                                    <button
                                                        key={c}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateArcProps(a.id, { color: c });
                                                            setColorPickerArcId(null);
                                                        }}
                                                        style={{
                                                            width: "18px",
                                                            height: "18px",
                                                            background: c,
                                                            border: c === a.color ? "2px solid var(--text-primary)" : "1px solid var(--border-subtle)",
                                                            cursor: "pointer",
                                                            padding: 0,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* Reorder */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); reorderArc(a.id, -1); }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        title={t('ide.moveUp', "Move up")}
                                        style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: "0 1px" }}
                                    >
                                        <Icons.ChevronUp />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); reorderArc(a.id, 1); }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        title={t('ide.moveDown', "Move down")}
                                        style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: "0 1px" }}
                                    >
                                        <Icons.ChevronDown />
                                    </button>
                                    {/* Delete */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteArc(a.id); }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        title={t('ide.deleteArc', "Delete arc")}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            color: "var(--text-tertiary)",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <Icons.X />
                                    </button>
                                </div>

                                {/* Vertical Drop Lines for Arcs */}
                                <div style={{ position: "absolute", left: 0, top: -(yOffset - RAIL_Y - 12), width: 1, height: yOffset - RAIL_Y - 12, background: a.color, opacity: 0.3 }} />
                                <div style={{ position: "absolute", right: 0, top: -(yOffset - RAIL_Y - 12), width: 1, height: yOffset - RAIL_Y - 12, background: a.color, opacity: 0.3 }} />

                                {/* Arc Bar */}
                                <div
                                    style={{
                                        width: "100%",
                                        height: "6px",
                                        backgroundColor: a.color,
                                        borderRadius: "3px",
                                        position: "relative",
                                    }}
                                >
                                    <div
                                        onMouseDown={(e) => startResizeArc(e, a.id, "start")}
                                        style={{
                                            position: "absolute",
                                            left: "-6px",
                                            top: "-4px",
                                            width: "12px",
                                            height: "14px",
                                            backgroundColor: "var(--bg-elevated)",
                                            border: `2px solid ${a.color}`,
                                            cursor: "ew-resize",
                                        }}
                                    />
                                    <div
                                        onMouseDown={(e) => startResizeArc(e, a.id, "end")}
                                        style={{
                                            position: "absolute",
                                            right: "-6px",
                                            top: "-4px",
                                            width: "12px",
                                            height: "14px",
                                            backgroundColor: "var(--bg-elevated)",
                                            border: `2px solid ${a.color}`,
                                            cursor: "ew-resize",
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}

                    {/* Render Blocks */}
                    {visibleBlocks.map((b) => {
                        const isInactive = b.layer !== activeLayer;
                        const isDragging = draggingBlockId === b.id;

                        const geom = blockGeom[b.id] || { center: railGeom.left + (b.pct / 100) * railGeom.width, isCompressed: false };
                        const isCompressed = geom.isCompressed;
                        const currentW = isCompressed ? COMPRESSED_W : BLOCK_W;

                        // the x is the top-left of the actual dom box
                        const x = geom.center - currentW / 2;
                        const y = LANE_Y[b.lane];

                        const currentTypes = b.layer === "shadow" ? SHADOW_BLOCK_TYPES : BLOCK_TYPES;
                        const typeDef = currentTypes[b.block_type] || currentTypes[Object.keys(currentTypes)[0]];

                        const accent = isInactive
                            ? "var(--text-tertiary)"
                            : typeDef.defaultColor;

                        return (
                            <React.Fragment key={b.id}>
                                <div
                                    style={{
                                        position: "absolute",
                                        left: geom.center,
                                        top: y + BLOCK_H,
                                        width: "2px",
                                        height: Math.max(0, RAIL_Y + 12 - (y + BLOCK_H)),
                                        background: isInactive ? "var(--border-subtle)" : accent,
                                        opacity: 0.3,
                                    }}
                                />

                                <div
                                    onMouseDown={(e) => {
                                        if (!isInactive) startDragBlock(e, b.id);
                                    }}
                                    onMouseEnter={() => setHoveredBlockId(b.id)}
                                    onMouseLeave={() => setHoveredBlockId(null)}
                                    style={{
                                        position: "absolute",
                                        left: x,
                                        top: y,
                                        width: currentW,
                                        height: BLOCK_H,
                                        backgroundColor: isInactive ? "var(--bg-base)" : "var(--bg-surface)",
                                        border: `1px solid ${isInactive ? "var(--border-subtle)" : "var(--border-default)"}`,
                                        borderTop: `3px solid ${accent}`,
                                        boxShadow: isDragging ? "0 8px 16px rgba(0,0,0,0.6)" : "none",
                                        cursor: isInactive ? "default" : (isDragging ? "grabbing" : "grab"),
                                        display: "flex",
                                        flexDirection: "column",
                                        padding: isCompressed ? "0" : "6px 8px",
                                        zIndex: isDragging ? 20 : 10,
                                        opacity: isInactive ? 0.3 : 1,
                                        overflow: "hidden", // Hide contents if squished
                                        transition: isDragging ? "none" : "width 0.2s ease, left 0.2s ease", // Smooth compression
                                    }}
                                >
                                    {!isCompressed && (
                                        <>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <select
                                                    value={b.block_type}
                                                    onChange={(e) => updateBlockProps(b.id, { block_type: e.target.value })}
                                                    disabled={isInactive}
                                                    style={{
                                                        background: "var(--bg-elevated)",
                                                        border: "none",
                                                        color: accent,
                                                        fontSize: "9px",
                                                        fontFamily: "var(--font-mono)",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "1px",
                                                        outline: "none",
                                                        cursor: "pointer",
                                                        padding: "2px",
                                                    }}
                                                >
                                                    {Object.keys(currentTypes).map((k) => (
                                                        <option key={k} value={k}>{t(`ide.blockType_${k}`, currentTypes[k].label)}</option>
                                                    ))}
                                                </select>
                                                {!isInactive && (
                                                    <button
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onClick={(e) => deleteBlock(e, b.id)}
                                                        title={t('ide.deleteBlock', "Delete Block")}
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            color: "var(--text-tertiary)",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        <Icons.X />
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                value={b.label}
                                                onChange={(e) => updateBlockProps(b.id, { label: e.target.value })}
                                                disabled={isInactive}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    borderBottom: "1px solid transparent",
                                                    color: "var(--text-primary)",
                                                    fontFamily: "var(--font-sans)",
                                                    fontSize: "12px",
                                                    marginTop: "6px",
                                                    outline: "none",
                                                }}
                                            />
                                        </>
                                    )}

                                    {/* Hover Info Card */}
                                    {hoveredBlockId === b.id && !isDragging && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                bottom: isCompressed ? "unset" : "-52px",
                                                top: isCompressed ? "-60px" : "unset",
                                                left: "50%",
                                                transform: "translateX(-50%)",
                                                background: "var(--bg-elevated)",
                                                border: "1px solid var(--border-default)",
                                                padding: "6px 10px",
                                                zIndex: 30,
                                                whiteSpace: "nowrap",
                                                pointerEvents: "none",
                                            }}
                                        >
                                            {isCompressed && (
                                                <div style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--text-primary)", marginBottom: "2px" }}>{b.label}</div>
                                            )}
                                            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                                {typeDef.label} · {Math.round(b.pct)}%{b.chapter_id ? ` · Ch.${(chapters.find(c => c.id === b.chapter_id) || {}).chapter_number || '?'}` : ''}
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </React.Fragment>
                        );
                    })}

                    {/* Fixed Start / End Blocks */}
                    <div style={{
                        position: "absolute", left: railGeom.left - BLOCK_W / 2, top: LANE_Y[0], width: BLOCK_W, height: BLOCK_H,
                        backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", borderTop: "3px solid var(--text-tertiary)",
                        display: "flex", flexDirection: "column", padding: "6px 8px", zIndex: 10, opacity: 0.8
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>Event</span>
                        </div>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-primary)", marginTop: "6px" }}>Start</span>
                        <div style={{ position: "absolute", left: BLOCK_W / 2, top: BLOCK_H, width: "2px", height: Math.max(0, RAIL_Y + 12 - (LANE_Y[0] + BLOCK_H)), background: "var(--text-tertiary)", opacity: 0.3 }} />
                    </div>

                    <div style={{
                        position: "absolute", left: railGeom.right - BLOCK_W / 2, top: LANE_Y[0], width: BLOCK_W, height: BLOCK_H,
                        backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", borderTop: "3px solid var(--text-tertiary)",
                        display: "flex", flexDirection: "column", padding: "6px 8px", zIndex: 10, opacity: 0.8
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>Event</span>
                        </div>
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-primary)", marginTop: "6px" }}>End</span>
                        <div style={{ position: "absolute", left: BLOCK_W / 2, top: BLOCK_H, width: "2px", height: Math.max(0, RAIL_Y + 12 - (LANE_Y[0] + BLOCK_H)), background: "var(--text-tertiary)", opacity: 0.3 }} />
                    </div>

                    {/* Chapter Spans & "You Are Here" Indicator */}
                    {chapterSpans.length > 0 && (() => {
                        const activeSpan = activeChapter ? chapterSpans.find(s => s.id === activeChapter.id) : null;

                        return (
                            <>
                                {/* Chapter boundary dividers on the rail */}
                                {chapterSpans.slice(1).map((s) => {
                                    const divX = railGeom.left + (s.startPct / 100) * railGeom.width;
                                    return (
                                        <div key={`ch-div-${s.id}`} style={{ position: "absolute", left: divX, top: RAIL_Y + 6, pointerEvents: "none", transform: "translateX(-0.5px)" }}>
                                            <div style={{ width: "1px", height: "14px", background: "var(--text-tertiary)", opacity: 0.3 }} />
                                        </div>
                                    );
                                })}

                                {/* Active chapter highlight bar */}
                                {activeSpan && (() => {
                                    const hlLeft = railGeom.left + (activeSpan.startPct / 100) * railGeom.width;
                                    const hlWidth = ((activeSpan.endPct - activeSpan.startPct) / 100) * railGeom.width;
                                    const midX = hlLeft + hlWidth / 2;

                                    return (
                                        <>
                                            {/* Thick highlight bar on the rail */}
                                            <div style={{
                                                position: "absolute",
                                                top: RAIL_Y + 8,
                                                left: hlLeft,
                                                width: hlWidth,
                                                height: "10px",
                                                background: "var(--accent-green)",
                                                opacity: 0.15,
                                                pointerEvents: "none",
                                            }} />
                                            {/* Active bar top edge */}
                                            <div style={{
                                                position: "absolute",
                                                top: RAIL_Y + 8,
                                                left: hlLeft,
                                                width: hlWidth,
                                                height: "10px",
                                                border: "1px solid var(--accent-green)",
                                                opacity: 0.3,
                                                pointerEvents: "none",
                                                boxSizing: "border-box",
                                            }} />
                                            {/* Chapter label inside highlight */}
                                            <div style={{
                                                position: "absolute",
                                                top: RAIL_Y + 22,
                                                left: hlLeft,
                                                width: hlWidth,
                                                pointerEvents: "none",
                                                textAlign: "center",
                                                overflow: "hidden",
                                            }}>
                                                <span style={{
                                                    fontFamily: "var(--font-mono)",
                                                    fontSize: "8px",
                                                    color: "var(--accent-green)",
                                                    opacity: 0.6,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.5px",
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    Ch.{activeSpan.chapter_number}
                                                </span>
                                            </div>

                                            {/* "You Are Here" indicator at chapter midpoint */}
                                            <div style={{
                                                position: "absolute",
                                                left: midX,
                                                top: RAIL_Y - 14,
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                transform: "translateX(-50%)",
                                                pointerEvents: "none",
                                                zIndex: 1,
                                            }}>
                                                <div style={{
                                                    width: "0",
                                                    height: "0",
                                                    borderLeft: "6px solid transparent",
                                                    borderRight: "6px solid transparent",
                                                    borderTop: "8px solid var(--accent-green)",
                                                    marginBottom: "2px"
                                                }} />
                                                <div style={{
                                                    fontFamily: "var(--font-mono)",
                                                    fontSize: "9px",
                                                    color: "var(--accent-green)",
                                                    fontWeight: "bold",
                                                    textTransform: "uppercase",
                                                    letterSpacing: "1px",
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    You Are Here
                                                </div>
                                                <div style={{
                                                    width: "2px",
                                                    height: "80px",
                                                    background: "var(--accent-green)",
                                                    opacity: 0.3
                                                }} />
                                            </div>
                                        </>
                                    );
                                })()}
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
