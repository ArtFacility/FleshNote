import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";

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
    Save: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
};

export default function FleshNotePlannerDesktop({ projectPath, chapters, activeChapter }) {
    // Data
    const [settings, setSettings] = useState({ theme: "", cursor_pct: 0, shadow_visible: 0 });
    const [blocks, setBlocks] = useState([]);
    const [arcs, setArcs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Active states
    const [activeLayer, setActiveLayer] = useState("surface");

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

    const railGeom = useMemo(() => {
        const left = 100; // Increased padding so Start block stays on screen
        const right = Math.max(left + 200, (containerWidth * zoomMultiplier) - 100); // Padding for End block
        return { left, width: right - left, right };
    }, [containerWidth, zoomMultiplier]);

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
            label: "New Beat",
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
            name: "New Arc",
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

    // Global mouse handlers (Workspace dragging)
    const onMouseMove = useCallback((e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Calculate coordinate relative to planner-content (vital for scrolling to right works properly)
        const mouseX = (e.clientX - rect.left) + containerRef.current.scrollLeft;
        const mouseY = (e.clientY - rect.top) + containerRef.current.scrollTop;

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
            if (target) apiSaveBlock(target);
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
    }, [draggingBlockId, resizingArc, blocks, arcs, isCanvasPanning]);

    useEffect(() => {
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    // Filter lists
    const visibleBlocks = blocks.filter(
        (b) => b.layer === activeLayer || settings.shadow_visible
    );
    const visibleArcs = arcs.filter(
        (a) => a.layer === activeLayer || settings.shadow_visible
    );

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

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>Loading planner...</div>;

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
                        Surface Layer
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
                        Shadow Layer
                    </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <button
                        onClick={toggleLayerVisibility}
                        title={settings.shadow_visible ? "Hide inactive layer" : "Show inactive layer"}
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
                        <Icons.Plus /> Add Block
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
                        <Icons.Plus /> Add Arc
                    </button>

                    <div style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "0 12px", borderLeft: "1px solid var(--border-subtle)", marginLeft: "8px"
                    }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-tertiary)" }}>ZOOM</span>
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
                    placeholder="What is the central theme of this story?"
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
                ref={containerRef}
                onMouseDown={(e) => {
                    // Only initiate panning if clicking directly on the canvas background
                    if (e.target === e.currentTarget || e.target.id === 'planner-bg') {
                        setIsCanvasPanning(true);
                        setPanStart({ x: e.clientX, scrollLeft: containerRef.current.scrollLeft });
                    }
                }}
                onMouseMove={(e) => {
                    if (isCanvasPanning) {
                        const dx = e.clientX - panStart.x;
                        containerRef.current.scrollLeft = panStart.scrollLeft - dx;
                    }
                }}
                onMouseLeave={() => setIsCanvasPanning(false)}
                style={{
                    flex: 1,
                    position: "relative",
                    overflowX: "auto",
                    overflowY: "hidden",
                    display: "flex", // Ensure it behaves block-level stretching
                    cursor: isCanvasPanning ? "grabbing" : "grab"
                }}
            >
                <div id="planner-bg" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, minWidth: `${Math.max(800, railGeom.right + 100)}px` }}>
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

                    {/* Render Timeline Arcs */}
                    {visibleArcs.map((a) => {
                        const isInactive = a.layer !== activeLayer;
                        const x1 = railGeom.left + (a.start_pct / 100) * railGeom.width;
                        const x2 = railGeom.left + (a.end_pct / 100) * railGeom.width;
                        const w = Math.max(0, x2 - x1);
                        const myIndex = visibleArcs.filter(va => va.layer === a.layer).findIndex(va => va.id === a.id);
                        const yOffset = ARC_TOP + (myIndex * 60) + 12; // Added 12px margin from timeline

                        return (
                            <div
                                key={a.id}
                                title={a.description || "Click to add description"} /* Hover to reveal description */
                                onClick={() => {
                                    if (isInactive) return;
                                    const newDesc = prompt("Enter Arc Description:", a.description || "");
                                    if (newDesc !== null) updateArcProps(a.id, { description: newDesc });
                                }}
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
                                    maxLength={24}
                                    style={{
                                        position: "absolute",
                                        top: "-22px",
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

                                {/* Delete arc button */}
                                <button
                                    onClick={() => deleteArc(a.id)}
                                    style={{
                                        position: "absolute",
                                        top: "-24px",
                                        right: "0px",
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--text-tertiary)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <Icons.X />
                                </button>

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
                                                        <option key={k} value={k}>{currentTypes[k].label}</option>
                                                    ))}
                                                </select>
                                                {!isInactive && (
                                                    <button
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onClick={(e) => deleteBlock(e, b.id)}
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

                    {/* "You Are Here" Indicator based on chapters progress */}
                    {chapters && chapters.length > 0 && activeChapter && (() => {
                        const activeIndex = chapters.findIndex(c => c.id === activeChapter.id);
                        const pctProgress = activeIndex >= 0 ? ((activeIndex + 1) / chapters.length) * 100 : 0;
                        const indicatorX = railGeom.left + (pctProgress / 100) * railGeom.width;

                        return (
                            <div style={{
                                position: "absolute",
                                left: indicatorX,
                                top: RAIL_Y - 14,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                transform: "translateX(-50%)",
                                pointerEvents: "none", // Let clicks pass through to blocks/arcs
                                zIndex: 1, // Stay behind blocks
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
                                    height: "80px", // Drops down past the rail a bit
                                    background: "var(--accent-green)",
                                    opacity: 0.3
                                }} />
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
