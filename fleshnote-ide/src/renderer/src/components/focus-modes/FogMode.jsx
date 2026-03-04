import React, { useEffect, useState, useRef } from 'react';
import '../../styles/editor.css';

export default function FogMode({ editor }) {
    const [fogLevel, setFogLevel] = useState(0); // 0 = clear, 100 = full fog
    const [runes, setRunes] = useState([]);
    const fogTrackerRef = useRef(0);
    const lastInteractionRef = useRef(Date.now());
    const runeIdRef = useRef(0);

    const FOG_MAX = 100;
    const FOG_IDLE_DELAY = 4000; // Wait 4s before fog starts creeping in
    const HEAL_AMOUNT_PER_KEY = 10; // Clear much faster per keystroke

    useEffect(() => {
        if (!editor) return;

        const handleInteraction = (e) => {
            if (e.type === 'keydown' && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter')) {
                lastInteractionRef.current = Date.now();

                // Heal the fog directly on keypress
                fogTrackerRef.current = Math.max(0, fogTrackerRef.current - HEAL_AMOUNT_PER_KEY);
                setFogLevel(fogTrackerRef.current);
            } else if (e.type === 'mousedown') {
                lastInteractionRef.current = Date.now();
            }
        };

        const editorDom = document.querySelector('.editor-area');
        if (editorDom) {
            editorDom.addEventListener('keydown', handleInteraction);
            editorDom.addEventListener('mousedown', handleInteraction);
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceInteraction = now - lastInteractionRef.current;

            if (timeSinceInteraction > FOG_IDLE_DELAY) {
                // Increase fog by 1% per 100ms (slower creep)
                fogTrackerRef.current = Math.min(FOG_MAX, fogTrackerRef.current + 1);
                setFogLevel(fogTrackerRef.current);

                // Spawn runes sporadically if fog is high
                if (fogTrackerRef.current > 20 && Math.random() < (fogTrackerRef.current / 400)) {
                    spawnRune();
                }
            }
        }, 100);

        return () => {
            if (editorDom) {
                editorDom.removeEventListener('keydown', handleInteraction);
                editorDom.removeEventListener('mousedown', handleInteraction);
            }
            clearInterval(interval);
        };
    }, [editor]);

    // Automatically remove old runes
    useEffect(() => {
        const cleanup = setInterval(() => {
            setRunes(prev => prev.filter(r => Date.now() - r.spawnTime < 8000));
        }, 1000);
        return () => clearInterval(cleanup);
    }, []);

    const spawnRune = () => {
        const runeChars = ['𐳀', '𐳁', '𐳂', '𐳃', '𐳄', '𐳅', '𐳆', '𐳇', '𐳈', '𐳉', '𐳊', '𐳋', '𐳌', '𐳍'];
        setRunes(prev => [...prev.slice(-30), {
            id: runeIdRef.current++,
            char: runeChars[Math.floor(Math.random() * runeChars.length)],
            x: 5 + Math.random() * 90, // Percentage width
            // Target the upper part where the fog is heavily present
            y: -10 + Math.random() * Math.max(20, fogTrackerRef.current * 0.9),
            spawnTime: Date.now(),
            size: 1.5 + Math.random() * 4
        }]);
    };

    return (
        <div style={styles.container}>
            {/* The Creeping Fog Mask */}
            <div style={{
                ...styles.fogLayer,
                // Dark background base (Pitch Black)
                backgroundColor: `rgba(0, 0, 0, ${(fogLevel / 100) * 0.98})`,
                // Less aggressive blur
                backdropFilter: `blur(${fogLevel * 0.08}px)`,
                // Creeping gradient mask: fades out at bottom so newest text remains clear
                WebkitMaskImage: `linear-gradient(to bottom, black 0%, black ${Math.max(0, fogLevel - 30)}%, transparent ${Math.min(100, Math.max(10, fogLevel + 10))}%, transparent 100%)`,
                maskImage: `linear-gradient(to bottom, black 0%, black ${Math.max(0, fogLevel - 30)}%, transparent ${Math.min(100, Math.max(10, fogLevel + 10))}%, transparent 100%)`
            }} />

            {/* Runic Corruption */}
            {runes.map(r => (
                <div key={r.id} style={{
                    position: 'absolute',
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    color: 'rgba(212, 196, 168, 0.25)', // FleshNote text color, faded
                    fontFamily: '"Noto Sans Old Hungarian", sans-serif',
                    fontSize: `${r.size}rem`,
                    fontWeight: 'bold',
                    opacity: fogLevel / 100, // Only visible as fog deepens
                    transition: 'opacity 0.2s linear',
                    pointerEvents: 'none',
                    animation: 'floatRune 8s infinite alternate ease-in-out'
                }}>
                    {r.char}
                </div>
            ))}

            <style>{`
                @keyframes floatRune {
                    0% { transform: translateY(0px) rotate(-10deg); opacity: 0; }
                    20% { opacity: var(--max-opacity, 0.7); }
                    80% { opacity: var(--max-opacity, 0.7); }
                    100% { transform: translateY(-30px) rotate(10deg); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

const styles = {
    container: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden'
    },
    fogLayer: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        transition: 'box-shadow 0.1s linear, backdrop-filter 0.1s linear',
        zIndex: 1
    }
};
