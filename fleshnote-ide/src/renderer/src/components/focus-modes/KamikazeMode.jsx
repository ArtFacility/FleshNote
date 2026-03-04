import React, { useEffect, useState, useRef } from 'react';
import '../../styles/editor.css';

export default function KamikazeMode({ editor }) {
    const [idleTime, setIdleTime] = useState(0);
    const [particles, setParticles] = useState([]);
    const idleTimerRef = useRef(null);
    const particleIdRef = useRef(0);
    const lastInteractionRef = useRef(Date.now());

    // 60 seconds total: 50s quiet, 5s countdown, then boom
    const IDLE_LIMIT = 60;
    const COUNTDOWN_START = 55;

    const resetIdle = () => {
        lastInteractionRef.current = Date.now();
        setIdleTime(0);
    };

    const spawnExplosion = (x, y, text) => {
        const newParticles = text.split('').map((char) => {
            const angle = Math.random() * Math.PI * 2;
            const velocity = 50 + Math.random() * 150;
            return {
                id: particleIdRef.current++,
                char,
                x,
                y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity - 100, // Upward bias
                rotation: Math.random() * 360,
                color: ['#ff4444', '#ff8844', '#ffdd44'][Math.floor(Math.random() * 3)],
                life: 1.0,
            };
        });
        setParticles(prev => [...prev.slice(-100), ...newParticles]);
    };

    const deleteLastWord = () => {
        if (!editor || editor.isEmpty) return;

        // Find the last word boundaries
        const state = editor.state;
        const text = state.doc.textContent;
        if (!text) return;

        // Simple regex to find the last chunk of non-whitespace characters
        const match = text.match(/([^\s]+)\s*$/);
        if (!match) {
            // If just whitespace or something weird, delete 1 char
            const pos = state.doc.content.size - 1;
            editor.commands.deleteRange({ from: pos - 1, to: pos });
            return;
        }

        const wordToDelete = match[1];
        const wordLength = match[0].length;

        // This is a naive deletion from the end of the document.
        // It assumes the editor cursor is near the end, or we just want to eat the document from the bottom up.
        const endPos = state.doc.content.size - 1; // 1 before the very end
        const startPos = Math.max(0, endPos - wordLength);

        // Try to get coordinates for the explosion
        let coords = { left: window.innerWidth / 2, top: window.innerHeight / 2 };
        try {
            // Tiptap coordinate resolution
            const view = editor.view;
            coords = view.coordsAtPos(endPos);
        } catch (e) { /* ignore */ }

        // Execute deletion
        editor.commands.deleteRange({ from: startPos, to: endPos });

        // Spawn VFX
        spawnExplosion(coords.left, coords.top, wordToDelete);
    };

    useEffect(() => {
        if (!editor) return;

        const handleInteraction = (e) => {
            // Reset on valid typing keys
            if (e.type === 'keydown' && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter')) {
                resetIdle();
            } else if (e.type === 'mousedown') {
                resetIdle();
            }
        };

        const editorDom = document.querySelector('.editor-area');
        if (editorDom) {
            editorDom.addEventListener('keydown', handleInteraction);
            editorDom.addEventListener('mousedown', handleInteraction);
        }

        idleTimerRef.current = setInterval(() => {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - lastInteractionRef.current) / 1000);
            setIdleTime(elapsedSeconds);

            if (elapsedSeconds >= IDLE_LIMIT) {
                // Time's up, delete a word
                deleteLastWord();
                // We don't reset idle time, we let it keep punishing every second until they type.
                lastInteractionRef.current = now - (IDLE_LIMIT * 1000) + 1000; // Fake it so it triggers again next second
            }
        }, 1000);

        // Physics loop for particles
        let animationFrame;
        let lastTime = performance.now();
        const updateParticles = (time) => {
            const dt = (time - lastTime) / 1000;
            lastTime = time;

            setParticles(currentParticles => {
                if (currentParticles.length === 0) return currentParticles;
                const updated = currentParticles.map(p => ({
                    ...p,
                    x: p.x + p.vx * dt,
                    y: p.y + p.vy * dt,
                    vy: p.vy + 400 * dt, // Gravity
                    rotation: p.rotation + 200 * dt,
                    life: p.life - dt * 1.5
                })).filter(p => p.life > 0);
                return updated;
            });
            animationFrame = requestAnimationFrame(updateParticles);
        };
        animationFrame = requestAnimationFrame(updateParticles);

        return () => {
            if (editorDom) {
                editorDom.removeEventListener('keydown', handleInteraction);
                editorDom.removeEventListener('mousedown', handleInteraction);
            }
            clearInterval(idleTimerRef.current);
            cancelAnimationFrame(animationFrame);
        };
    }, [editor]);

    const isCountingDown = idleTime >= COUNTDOWN_START && idleTime < IDLE_LIMIT;
    const timeLeft = IDLE_LIMIT - idleTime;

    return (
        <div style={styles.container}>
            {/* Visual Warning overlay */}
            {idleTime >= COUNTDOWN_START && (
                <div style={{
                    ...styles.vignette,
                    opacity: isCountingDown ? (1 - (timeLeft / 10)) * 0.8 : 0.9,
                    animation: isCountingDown ? 'kamikazePulse 1s ease-in-out infinite' : 'none',
                    backgroundColor: isCountingDown ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 0, 0, 0.3)'
                }} />
            )}

            {/* Huge Countdown Text */}
            {isCountingDown && (
                <div style={styles.countdown}>
                    {timeLeft}
                </div>
            )}

            {/* Explosive Particles */}
            {particles.map(p => (
                <div key={p.id} style={{
                    position: 'fixed', // Fixed so it coordinates globally with coordsAtPos
                    left: p.x,
                    top: p.y,
                    transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.life})`,
                    color: p.color,
                    fontWeight: 'bold',
                    fontSize: '24px',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    opacity: p.life,
                    textShadow: '0 0 8px rgba(255,0,0,0.8)'
                }}>
                    {p.char}
                </div>
            ))}

            <style>{`
                @keyframes kamikazePulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.6; }
                }
                @keyframes kamikazeShake {
                    0%, 100% { transform: translate(-50%, -50%); }
                    25% { transform: translate(calc(-50% - 4px), calc(-50% + 4px)); }
                    50% { transform: translate(calc(-50% + 4px), calc(-50% - 4px)); }
                    75% { transform: translate(calc(-50% - 4px), calc(-50% - 4px)); }
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
    vignette: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        transition: 'opacity 1s linear, background-color 1s linear',
        boxShadow: 'inset 0 0 150px rgba(255, 0, 0, 0.8)',
        zIndex: 1
    },
    countdown: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '25vw',
        fontWeight: '900',
        color: 'rgba(255, 68, 68, 0.15)',
        fontFamily: 'monospace',
        zIndex: 2,
        animation: 'kamikazeShake 0.1s infinite',
        WebkitTextStroke: '2px rgba(255, 0, 0, 0.4)'
    }
};
