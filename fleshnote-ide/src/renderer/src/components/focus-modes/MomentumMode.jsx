import React, { useEffect, useRef, useState } from 'react'
import '../../styles/editor.css' // Ensure momentum styles are imported if needed here, but they are already in editor.css

export default function MomentumMode({ editor }) {
    const momentumRef = useRef(0)
    const [momentum, setMomentum] = useState(0)
    const [particles, setParticles] = useState([])

    useEffect(() => {
        if (!editor) return

        const spawnParticle = () => {
            const runes = ['𐳀', '𐳁', '𐳂', '𐳃', '𐳄', '𐳅', '𐳆', '𐳇', '𐳈', '𐳉', '𐳊', '𐳋', '𐳌', '𐳍']
            const p = {
                id: Date.now() + Math.random(),
                char: runes[Math.floor(Math.random() * runes.length)],
                left: Math.random() * 90 + 5,
                top: Math.random() * 80 + 10,
                color: ['var(--accent-amber)', 'var(--accent-green)', 'var(--accent-blue)'][Math.floor(Math.random() * 3)]
            }
            setParticles(prev => [...prev.slice(-15), p])
            setTimeout(() => {
                setParticles(prev => prev.filter(x => x.id !== p.id))
            }, 2000)
        }

        const handleKeyDown = (e) => {
            if (e.repeat) return
            if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Delete') {
                // Allow invisible overfill up to 130 (3 seconds buffer)
                momentumRef.current = Math.min(130, momentumRef.current + (100 / 15))
                setMomentum(Math.min(100, momentumRef.current))
            }
        }

        const editorDom = document.querySelector('.editor-area')
        if (editorDom) {
            editorDom.addEventListener('keydown', handleKeyDown)
        }

        const interval = setInterval(() => {
            if (momentumRef.current > 0) {
                // Decay at 100% over 10 seconds -> 10% per second -> 1% per 100ms
                momentumRef.current = Math.max(0, momentumRef.current - 1)
                setMomentum(Math.min(100, momentumRef.current))

                if (momentumRef.current >= 100 && Math.random() < 0.2) {
                    spawnParticle()
                }
            }
        }, 100)

        return () => {
            if (editorDom) {
                editorDom.removeEventListener('keydown', handleKeyDown)
            }
            clearInterval(interval)
        }
    }, [editor])

    return (
        <>
            {/* Momentum Bar Overlay */}
            <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--bg-elevated)', overflow: 'hidden', zIndex: 10 }}>
                <div style={{
                    height: '100%',
                    width: `${momentum}%`,
                    background: momentum === 100
                        ? 'linear-gradient(90deg, var(--accent-amber), var(--accent-green))'
                        : 'linear-gradient(90deg, var(--bg-hover), var(--accent-blue))',
                    transition: 'width 0.1s linear, background 0.5s ease',
                    boxShadow: momentum === 100 ? '0 0 8px var(--accent-green)' : 'none'
                }} />
            </div>

            {/* Momentum Particles */}
            {particles.map(p => (
                <div key={p.id} className="momentum-particle" style={{
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    color: p.color
                }}>
                    {p.char}
                </div>
            ))}
        </>
    )
}
