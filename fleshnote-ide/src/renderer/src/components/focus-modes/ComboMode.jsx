import React, { useEffect, useState, useRef } from 'react'
import '../../styles/editor.css'

const THRESHOLDS = [
    { count: 10, text: 'GOOD' },
    { count: 25, text: 'GREAT' },
    { count: 50, text: 'AMAZING' },
    { count: 100, text: 'FLAWLESS' },
    { count: 200, text: 'HOLY SH*T!' },
    { count: 500, text: 'LEGENDARY!' },
    { count: 800, text: 'TRULY NOVEL!' },
    { count: 1000, text: 'GODLIKE!' },
    { count: 1300, text: 'UNSTOPPABLE!' }
]

export default function ComboMode({ editor }) {
    const [comboCount, setComboCount] = useState(0)
    const [opacity, setOpacity] = useState(1)
    const [deleteCount, setDeleteCount] = useState(0)
    const [activeThreshold, setActiveThreshold] = useState(null)
    const [particles, setParticles] = useState([])

    const lastTypeTimeRef = useRef(Date.now())
    const animationFrameRef = useRef(null)
    const currentWordRef = useRef('')

    useEffect(() => {
        if (!editor) return

        const triggerParticles = () => {
            const newParticles = Array.from({ length: 15 }).map((_, i) => ({
                id: Date.now() + i,
                angle: Math.random() * Math.PI * 2,
                speed: Math.random() * 4 + 2,
                color: ['var(--accent-amber)', 'var(--accent-red)', 'var(--accent-green)'][Math.floor(Math.random() * 3)]
            }))
            setParticles(newParticles)
            setTimeout(() => setParticles([]), 1000)
        }

        const handleKeyDown = (e) => {
            // Prevent holding a key down from generating hundreds of keystrokes instantly
            if (e.repeat) return

            // Deletions allowance (max 3)
            if (e.key === 'Backspace' || e.key === 'Delete') {
                currentWordRef.current = currentWordRef.current.slice(0, -1)
                setDeleteCount(prev => {
                    const newCount = prev + 1
                    if (newCount > 3) {
                        setComboCount(0)
                        setActiveThreshold(null)
                        currentWordRef.current = ''
                        return 0
                    }
                    return newCount
                })
                return
            }

            // Spam prevention heuristic
            if (e.key === ' ' || e.key === 'Enter' || e.key === '.' || e.key === ',' || e.key === '?' || e.key === '!') {
                const word = currentWordRef.current.trim()
                if (word.length > 0) {
                    const vowels = (word.match(/[aeiouyáéíóöőúüűąęA-Z]/gi) || []).length
                    const consonants = word.replace(/[^a-zA-Záéíóöőúüűąę]/gi, '').length - vowels

                    // Break combo if too many consecutive consonants (e.g. keyboard mashing 'asdfg')
                    if ((consonants > 4 && vowels === 0) || (vowels > 0 && consonants / vowels > 5)) {
                        setComboCount(0)
                        setActiveThreshold(null)
                        currentWordRef.current = ''
                        return // Skip incrementing
                    }
                }
                currentWordRef.current = ''
            } else if (e.key.length === 1) {
                if (/[a-zA-Záéíóöőúüűąę]/.test(e.key)) {
                    currentWordRef.current += e.key
                    const word = currentWordRef.current

                    // In-progress spam checks:
                    // 1. 6+ consonants in a row
                    // 2. 8+ letters long but NO vowels
                    const consecutiveConsonants = /[^aeiouyáéíóöőúüűąę\s]{6,}/i.test(word)
                    const vowelsCount = (word.match(/[aeiouyáéíóöőúüűąę]/gi) || []).length

                    if (consecutiveConsonants || (word.length >= 8 && vowelsCount === 0)) {
                        setComboCount(0)
                        setActiveThreshold(null)
                        currentWordRef.current = ''
                        return // Break instant
                    }
                }
            }

            // Valid keystrokes increase combo and reset timer & delete count
            if (e.key.length === 1 || e.key === 'Enter') {
                setComboCount(prev => {
                    const next = prev + 1

                    // Check for threshold
                    const threshold = THRESHOLDS.find(t => t.count === next)
                    if (threshold) {
                        setActiveThreshold(threshold.text)
                        triggerParticles()
                    } else { // Keep threshold text visible for a bit or update it logic
                        // Alternatively, find the highest threshold we surpassed
                        const highest = [...THRESHOLDS].reverse().find(t => next >= t.count)
                        if (highest) setActiveThreshold(highest.text)
                        else setActiveThreshold(null) // Clear if no threshold is met
                    }

                    return next
                })
                setDeleteCount(0)
                lastTypeTimeRef.current = Date.now()
                setOpacity(1)
            }
        }

        const editorDom = document.querySelector('.editor-area')
        if (editorDom) {
            editorDom.addEventListener('keydown', handleKeyDown)
        }

        // Animation loop for fading the combo text
        const checkIdle = () => {
            if (comboCount > 0) {
                const idleTime = Date.now() - lastTypeTimeRef.current
                const maxIdleTime = 5000 // 5 seconds

                if (idleTime > maxIdleTime) {
                    // Combo broken due to timeout
                    setComboCount(0)
                    setOpacity(0)
                    setActiveThreshold(null)
                } else {
                    // Fade out based on time remaining (wait 2 seconds before fading begins)
                    const fadeStartTime = 2000
                    if (idleTime > fadeStartTime) {
                        const timeLeft = maxIdleTime - idleTime
                        const totalFadeTime = maxIdleTime - fadeStartTime
                        setOpacity(timeLeft / totalFadeTime)
                    } else {
                        setOpacity(1)
                    }
                }
            }
            animationFrameRef.current = requestAnimationFrame(checkIdle)
        }

        animationFrameRef.current = requestAnimationFrame(checkIdle)

        return () => {
            if (editorDom) {
                editorDom.removeEventListener('keydown', handleKeyDown)
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [editor, comboCount])

    if (comboCount < 5) return null // Only show combo when it gets going

    return (
        <div style={{
            position: 'absolute',
            top: '15%',
            right: '15%',
            pointerEvents: 'none',
            opacity: opacity,
            transition: 'opacity 0.1s linear, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            userSelect: 'none',
            transform: `rotate(35deg) scale(${Math.min(1 + comboCount * 0.002, 1.5)})`, // Rotate 35deg so it doesn't clip as hard, scale
            transformOrigin: 'center center'
        }}>
            {activeThreshold && (
                <div style={{
                    fontSize: '32px',
                    fontWeight: '900',
                    color: 'var(--accent-red)',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    marginBottom: '-15px',
                    textShadow: '0 0 15px rgba(239, 68, 68, 0.6)',
                    animation: 'comboPopup 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                    {activeThreshold}
                </div>
            )}
            <div style={{
                fontSize: '84px',
                fontWeight: '900',
                color: 'transparent',
                WebkitTextStroke: '3px var(--accent-amber)',
                textShadow: '0 0 25px rgba(251, 191, 36, 0.5)',
                fontFamily: 'var(--font-inter)',
                letterSpacing: '-4px',
            }}>
                {comboCount}
            </div>

            {/* Particle System for Thresholds */}
            {particles.map(p => (
                <div key={p.id} style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: p.color,
                    boxShadow: `0 0 10px ${p.color}`,
                    // We can use a CSS variable to animate them outwards
                    animation: 'burstOut 0.8s ease-out forwards',
                    '--angle': `${p.angle}rad`,
                    '--speed': `${p.speed * 20}px`
                }} />
            ))}

            <style>{`
        @keyframes comboPopup {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes burstOut {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + cos(var(--angle)) * var(--speed)), calc(-50% + sin(var(--angle)) * var(--speed))) scale(0);
            opacity: 0;
          }
        }
      `}</style>
        </div>
    )
}
