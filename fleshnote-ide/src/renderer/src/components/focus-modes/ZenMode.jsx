import React, { useState, useEffect, useRef, useMemo } from 'react';

function createRng(seed) {
    let s = seed | 0;
    return () => {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function generateTreePalette(seed) {
    const rng = createRng(seed);
    const leafHue = Math.floor(rng() * 360);
    const leafShades = [];
    for (let i = 0; i < 5; i++) {
        const h = (leafHue + Math.floor(rng() * 40 - 20) + 360) % 360;
        const s = 30 + Math.floor(rng() * 35);
        const l = 28 + Math.floor(rng() * 22);
        leafShades.push(`hsl(${h}, ${s}%, ${l}%)`);
    }
    const barkBase = Math.floor(rng() * 40) + 10;
    const barkShades = [];
    for (let i = 0; i < 3; i++) {
        const h = barkBase + Math.floor(rng() * 20 - 10);
        const s = 20 + Math.floor(rng() * 30);
        const l = 14 + i * 8 + Math.floor(rng() * 6);
        barkShades.push(`hsl(${h}, ${s}%, ${l}%)`);
    }
    const blossomHue = Math.floor(rng() * 360);
    const blossomShades = [];
    for (let i = 0; i < 4; i++) {
        const h = (blossomHue + Math.floor(rng() * 30 - 15) + 360) % 360;
        const s = 55 + Math.floor(rng() * 30);
        const l = 72 + Math.floor(rng() * 16);
        blossomShades.push(`hsl(${h}, ${s}%, ${l}%)`);
    }
    const centerH = (blossomHue + 40) % 360;
    const flowerShape = Math.floor(rng() * 4);
    return { leafShades, barkShades, blossomShades, blossomCenter: `hsl(${centerH}, 70%, 82%)`, flowerShape };
}

function generateTree(seed, options = {}) {
    const rng = createRng(seed);
    const {
        baseX = 0, baseY = 0, angle = -Math.PI / 2,
        length = 70, thickness = 9, maxDepth = 5, lean = 0,
    } = options;

    const branches = [];
    const leaves = [];
    const blossoms = [];

    function grow(x, y, ang, len, thick, depth) {
        if (depth > maxDepth || thick < 0.4) return;

        const endX = x + Math.cos(ang) * len;
        const endY = y + Math.sin(ang) * len;
        const perp = ang + Math.PI / 2;
        const w1 = (rng() - 0.5) * len * 0.35;
        const w2 = (rng() - 0.5) * len * 0.35;
        const cx1 = x + Math.cos(ang) * len * 0.33 + Math.cos(perp) * w1;
        const cy1 = y + Math.sin(ang) * len * 0.33 + Math.sin(perp) * w1;
        const cx2 = x + Math.cos(ang) * len * 0.66 + Math.cos(perp) * w2;
        const cy2 = y + Math.sin(ang) * len * 0.66 + Math.sin(perp) * w2;

        branches.push({ x1: x, y1: y, x2: endX, y2: endY, cx1, cy1, cx2, cy2, thickness: thick, depth });

        const isTerminal = depth >= maxDepth - 1;
        if (isTerminal) {
            const n = 4 + Math.floor(rng() * 5);
            for (let i = 0; i < n; i++) {
                const finalX = endX + (rng() - 0.5) * 18;
                const finalY = endY + (rng() - 0.5) * 16;
                leaves.push({
                    originX: endX, originY: endY,
                    finalX, finalY,
                    rx: 4 + rng() * 5, ry: 3 + rng() * 3,
                    rotation: rng() * 360, shade: Math.floor(rng() * 5), depth,
                    stagger: rng(),
                });
            }
            if (rng() > 0.25) {
                blossoms.push({
                    x: endX + (rng() - 0.5) * 6, y: endY + (rng() - 0.5) * 6,
                    size: 3 + rng() * 3.5, petalCount: 5,
                    shade: Math.floor(rng() * 4), rotation: rng() * 72, depth,
                });
            }
        }

        const nChildren = depth < 1 ? 2 : depth < 3 ? (rng() > 0.25 ? 2 : 3) : (rng() > 0.4 ? 2 : 1);
        const spread = 0.55 + rng() * 0.2;
        for (let i = 0; i < nChildren; i++) {
            const frac = nChildren === 1 ? 0 : (i / (nChildren - 1)) * 2 - 1;
            const childAng = ang + frac * spread * 0.5 + (rng() - 0.5) * 0.25 + lean * 0.05;
            grow(endX, endY, childAng, len * (0.68 + rng() * 0.14), thick * (0.6 + rng() * 0.1), depth + 1);
        }
    }

    grow(baseX, baseY, angle + lean * 0.15, length, thickness, 0);

    leaves.sort((a, b) => a.stagger - b.stagger);

    const bandSize = 0.82 / (maxDepth + 1);
    const totalLeaves = leaves.length;
    leaves.forEach((l, i) => {
        const parentBranchEnd = l.depth * bandSize + bandSize;
        const leafWindow = 0.90 - parentBranchEnd;
        const t = i / Math.max(totalLeaves - 1, 1);
        l.threshold = parentBranchEnd + t * t * Math.max(leafWindow, 0.05);
        l.settleEnd = l.threshold + 0.08;
    });

    return { branches, leaves, blossoms, maxDepth };
}

function petalPath(cx, cy, size, petalIndex, totalPetals, baseRotation, shapeType = 0) {
    const ang = ((Math.PI * 2) / totalPetals) * petalIndex + (baseRotation * Math.PI) / 180;
    const tipX = cx + Math.cos(ang) * size;
    const tipY = cy + Math.sin(ang) * size;

    if (shapeType === 0) {
        const sp = 0.4;
        return `M ${cx} ${cy} Q ${cx + Math.cos(ang - sp) * size * 0.6} ${cy + Math.sin(ang - sp) * size * 0.6} ${tipX} ${tipY} Q ${cx + Math.cos(ang + sp) * size * 0.6} ${cy + Math.sin(ang + sp) * size * 0.6} ${cx} ${cy}`;
    } else if (shapeType === 1) {
        const sp = 0.15;
        return `M ${cx} ${cy} L ${cx + Math.cos(ang - sp) * size * 0.4} ${cy + Math.sin(ang - sp) * size * 0.4} L ${tipX} ${tipY} L ${cx + Math.cos(ang + sp) * size * 0.4} ${cy + Math.sin(ang + sp) * size * 0.4} Z`;
    } else if (shapeType === 2) {
        const sp = 0.8;
        return `M ${cx} ${cy} C ${cx + Math.cos(ang - sp) * size * 0.8} ${cy + Math.sin(ang - sp) * size * 0.8}, ${cx + Math.cos(ang - sp) * size * 1.2} ${cy + Math.sin(ang - sp) * size * 1.2}, ${tipX} ${tipY} C ${cx + Math.cos(ang + sp) * size * 1.2} ${cy + Math.sin(ang + sp) * size * 1.2}, ${cx + Math.cos(ang + sp) * size * 0.8} ${cy + Math.sin(ang + sp) * size * 0.8}, ${cx} ${cy}`;
    } else {
        const sp = 0.6;
        const midLen = size * 0.7;
        const midX = cx + Math.cos(ang) * midLen;
        const midY = cy + Math.sin(ang) * midLen;
        return `M ${cx} ${cy} C ${cx + Math.cos(ang - sp) * size * 0.8} ${cy + Math.sin(ang - sp) * size * 0.8}, ${tipX + Math.cos(ang - Math.PI / 2) * size * 0.3} ${tipY + Math.sin(ang - Math.PI / 2) * size * 0.3}, ${midX} ${midY} C ${tipX + Math.cos(ang + Math.PI / 2) * size * 0.3} ${tipY + Math.sin(ang + Math.PI / 2) * size * 0.3}, ${cx + Math.cos(ang + sp) * size * 0.8} ${cy + Math.sin(ang + sp) * size * 0.8}, ${cx} ${cy}`;
    }
}

function BonsaiTree({ tree, progress, mirror = false, palette, width = 450, height = 700 }) {
    const maxD = tree.maxDepth;

    const getBranchDraw = (depth) => {
        const bandSize = 0.82 / (maxD + 1);
        const start = depth * bandSize;
        const end = start + bandSize;
        return Math.max(0, Math.min(1, (progress - start) / (end - start)));
    };

    return (
        <svg width={width} height={height} viewBox="-225 -660 450 700"
            style={{ transform: mirror ? "scaleX(-1)" : "none", overflow: "visible" }}>

            {tree.branches.map((b, i) => {
                const dp = getBranchDraw(b.depth);
                if (dp <= 0) return null;
                return (
                    <path key={`b-${i}`}
                        d={`M ${b.x1} ${b.y1} C ${b.cx1} ${b.cy1} ${b.cx2} ${b.cy2} ${b.x2} ${b.y2}`}
                        fill="none"
                        stroke={palette.barkShades[Math.min(palette.barkShades.length - 1, Math.floor((b.depth / 5) * palette.barkShades.length))]}
                        strokeWidth={b.thickness} strokeLinecap="round"
                        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - dp}
                        style={{ transition: "stroke-dashoffset 0.7s ease-out" }} />
                );
            })}

            {tree.leaves.map((l, i) => {
                const visible = progress >= l.threshold;
                if (!visible) return null;

                const settleT = Math.min(1, Math.max(0, (progress - l.threshold) / (l.settleEnd - l.threshold)));
                const eased = settleT * settleT * (3 - 2 * settleT);
                const cx = l.originX + (l.finalX - l.originX) * eased;
                const cy = l.originY + (l.finalY - l.originY) * eased;

                return (
                    <ellipse key={`l-${i}`} cx={cx} cy={cy} rx={l.rx} ry={l.ry}
                        transform={`rotate(${l.rotation} ${cx} ${cy})`}
                        fill={palette.leafShades[l.shade % palette.leafShades.length]}
                        opacity={0.85}
                        style={{ transition: "cx 0.5s ease-out, cy 0.5s ease-out" }} />
                );
            })}

            {tree.blossoms.map((bl, i) => {
                const show = progress >= 0.92;
                return (
                    <g key={`bl-${i}`} style={{
                        opacity: show ? 1 : 0,
                        transform: show ? "scale(1)" : "scale(0)",
                        transformOrigin: `${bl.x}px ${bl.y}px`,
                        transition: "opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        transitionDelay: `${i * 0.08}s`,
                    }}>
                        {Array.from({ length: bl.petalCount }).map((_, pi) => (
                            <path key={pi}
                                d={petalPath(bl.x, bl.y, bl.size, pi, bl.petalCount, bl.rotation, palette.flowerShape)}
                                fill={palette.blossomShades[(bl.shade + pi) % palette.blossomShades.length]}
                                opacity={0.9} />
                        ))}
                        <circle cx={bl.x} cy={bl.y} r={bl.size * 0.22} fill={palette.blossomCenter} />
                    </g>
                );
            })}

            <ellipse cx={0} cy={20} rx={64} ry={12} fill="#4a3328" />
            <rect x={-58} y={4} width={116} height={20} rx={4} fill="#5c4033" />
            <ellipse cx={0} cy={4} rx={58} ry={10} fill="#6b4f3e" />
        </svg>
    );
}

function FallingPetal({ startX, startY, delay, duration, side, color }) {
    const size = 4 + Math.random() * 4;
    const rotation = Math.random() * 360;
    return (
        <div style={{
            position: "absolute",
            left: side === "left" ? `${startX}px` : "auto",
            right: side === "right" ? `${startX}px` : "auto",
            top: `${startY}px`, width: `${size}px`, height: `${size * 0.7}px`,
            backgroundColor: color, borderRadius: "50% 0 50% 0",
            opacity: 0, transform: `rotate(${rotation}deg)`,
            animation: `petalFall ${duration}s ease-in-out ${delay}s forwards`,
            pointerEvents: "none", zIndex: 5,
        }} />
    );
}

export default function ZenMode({ currentWords = 0, currentChars = 0, startWordCount = 0, targetWordCount = 50 }) {
    const [petals, setPetals] = useState([]);
    const [seeds] = useState(() => [Math.floor(Math.random() * 100000), Math.floor(Math.random() * 100000)]);
    const [paletteSeed] = useState(() => Math.floor(Math.random() * 100000));
    const petalIdRef = useRef(0);
    const keyPressCounterRef = useRef(0);

    const goal = Math.max(1, targetWordCount - startWordCount);
    const wordCount = Math.max(0, currentWords - startWordCount);

    const palette = useMemo(() => generateTreePalette(paletteSeed), [paletteSeed]);

    const progress = Math.min(1, wordCount / goal);
    const isComplete = wordCount >= goal;

    /* Scale tree size dynamically based on the word count goal */
    /* 50 words -> small bonsai, 1000 words -> massive tree spreading over screen */
    const depthScale = goal < 100 ? 5 : goal < 300 ? 6 : goal < 800 ? 7 : 8;
    const lengthScale = 60 + Math.min(160, (goal / 1000) * 160);
    const thickScale = 8 + Math.min(12, (goal / 1000) * 12);

    const leftTree = useMemo(() => generateTree(seeds[0], { lean: 0.5, length: lengthScale, maxDepth: depthScale, thickness: thickScale }), [seeds, lengthScale, depthScale, thickScale]);
    const rightTree = useMemo(() => generateTree(seeds[1], { lean: -0.5, length: lengthScale * 0.95, maxDepth: depthScale, thickness: thickScale }), [seeds, lengthScale, depthScale, thickScale]);

    const momentumRef = useRef(0);

    useEffect(() => {
        if (!isComplete) return;

        const spawnPetal = () => {
            const side = Math.random() > 0.5 ? "left" : "right";
            setPetals(prev => [...prev.slice(-25), {
                id: petalIdRef.current++, startX: 40 + Math.random() * 160, startY: 80 + Math.random() * 200,
                delay: 0, duration: 4 + Math.random() * 4, side,
                color: palette.blossomShades[Math.floor(Math.random() * palette.blossomShades.length)],
            }]);
        };

        const handleKeyDown = (e) => {
            if (e.repeat) return;
            // Build up momentum on backspace, enter, delete, or typing single characters
            if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Delete') {
                momentumRef.current = Math.min(130, momentumRef.current + (100 / 10)); // Build up over 10 strokes
            }
        };

        const editorDom = document.querySelector('.editor-area');
        if (editorDom) {
            editorDom.addEventListener('keydown', handleKeyDown);
        }

        const interval = setInterval(() => {
            if (momentumRef.current > 0) {
                // Decay at 1% per 100ms
                momentumRef.current = Math.max(0, momentumRef.current - 1);

                // If user is actively typing (over 100% threshold), spawn petals organically
                if (momentumRef.current >= 100 && Math.random() < 0.1) {
                    spawnPetal();
                }
            }
        }, 100);

        return () => {
            if (editorDom) {
                editorDom.removeEventListener('keydown', handleKeyDown);
            }
            clearInterval(interval);
        };
    }, [isComplete, palette]);

    return (
        <>
            <style>{keyframes}</style>

            {/* Opaque box layered behind the actual editor text, but above the tree */}
            <div style={styles.textOpaqueBackdrop} />

            <div style={styles.container}>
                <div style={styles.bgTexture} />
                <div style={styles.treeLeft}>
                    <BonsaiTree tree={leftTree} progress={progress} palette={palette} />
                </div>
                <div style={styles.treeRight}>
                    <BonsaiTree tree={rightTree} progress={progress} mirror palette={palette} />
                </div>
                {petals.map(p => <FallingPetal key={p.id} {...p} />)}
            </div>
        </>
    );
}

const keyframes = `
  @keyframes petalFall {
    0% { opacity: 0.9; transform: translateY(0) translateX(0) rotate(0deg); }
    25% { opacity: 0.8; transform: translateY(80px) translateX(20px) rotate(90deg); }
    50% { opacity: 0.6; transform: translateY(200px) translateX(-15px) rotate(200deg); }
    75% { opacity: 0.3; transform: translateY(350px) translateX(25px) rotate(310deg); }
    100% { opacity: 0; transform: translateY(520px) translateX(5px) rotate(400deg); }
  }
  @keyframes subtlePulse { 0%, 100% { opacity: 0.03; } 50% { opacity: 0.06; } }
  
  /* Re-ordering the stacking context so trees stay in back, layer box in middle, text on top */
  .panel-middle {
    position: relative !important;
  }
  .editor-toolbar, .editor-format-toolbar {
    position: relative !important;
    z-index: 5 !important;
    background-color: transparent !important; /* Optionally making toolbars blend nicely if desired, but we leave the solid line for now */
  }
  .panel-middle > div[style*="flex: 1"] {
    position: relative !important;
    z-index: 4 !important;
  }
  .editor-area {
    background-color: transparent !important; 
  }
`;

const styles = {
    container: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" },
    bgTexture: { position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 50%, rgba(90,70,50,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(90,70,50,0.08) 0%, transparent 60%)", animation: "subtlePulse 8s ease-in-out infinite", zIndex: 0 },
    treeLeft: { position: "absolute", left: -30, bottom: -10, opacity: 0.95, mixBlendMode: 'multiply', height: '100%', display: 'flex', alignItems: 'flex-end', pointerEvents: 'none', zIndex: 1 },
    treeRight: { position: "absolute", right: -30, bottom: -10, opacity: 0.95, mixBlendMode: 'multiply', height: '100%', display: 'flex', alignItems: 'flex-end', pointerEvents: 'none', zIndex: 1 },
    textOpaqueBackdrop: { position: "absolute", inset: "0 15% 0 15%", backgroundColor: "var(--bg-deep)", opacity: 0.85, zIndex: 2, pointerEvents: "none", boxShadow: "0 0 60px 40px var(--bg-deep)" },
};
