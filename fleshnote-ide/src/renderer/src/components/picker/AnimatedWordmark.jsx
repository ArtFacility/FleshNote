import { useState, useEffect } from 'react'

const TITLE_CHARS = [
  { rovas: '𐳌', latin: 'F', word: 0 },
  { rovas: '𐳖', latin: 'L', word: 0 },
  { rovas: '𐳉', latin: 'E', word: 0 },
  { rovas: '𐳤', latin: 'SH', word: 0 },
  { rovas: '𐳙', latin: 'N', word: 1 },
  { rovas: '𐳛', latin: 'O', word: 1 },
  { rovas: '𐳦', latin: 'T', word: 1 },
  { rovas: '𐳉', latin: 'E', word: 1 },
]

function useTitleAnimation(count, startDelay = 700, stagger = 140) {
  const [phases, setPhases] = useState(Array(count).fill('rovás'))

  useEffect(() => {
    const timers = []
    TITLE_CHARS.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setPhases(p => { const n = [...p]; n[i] = 'exit'; return n })
      }, startDelay + i * stagger))
      timers.push(setTimeout(() => {
        setPhases(p => { const n = [...p]; n[i] = 'latin'; return n })
      }, startDelay + i * stagger + 160))
    })
    return () => { timers.forEach(clearTimeout) }
  }, [count, startDelay, stagger])

  return phases
}

export default function AnimatedWordmark() {
  const phases = useTitleAnimation(TITLE_CHARS.length)
  const word0 = TITLE_CHARS.filter(c => c.word === 0)
  const word1 = TITLE_CHARS.filter(c => c.word === 1)

  const renderChar = (char, absIdx) => {
    const phase = phases[absIdx]
    const isLatin = phase === 'latin'
    const isExit = phase === 'exit'
    const className = [
      'picker-wordmark-char',
      isLatin ? 'picker-wordmark-latin' : 'picker-wordmark-rovas rune-font',
      isExit ? 'picker-wordmark-exit' : '',
    ].filter(Boolean).join(' ')

    return (
      <span
        key={absIdx}
        className={className}
        lang={isLatin ? undefined : 'hu-Hung'}
        style={{
          transition: isExit
            ? 'opacity 0.12s ease-in, transform 0.12s ease-in'
            : 'opacity 0.18s ease-out, transform 0.18s ease-out, color 0s',
          letterSpacing: isLatin && char.latin === 'SH' ? '-0.02em' : undefined,
        }}
      >
        {isLatin ? char.latin : char.rovas}
      </span>
    )
  }

  return (
    <h1 className="picker-wordmark" aria-label="FleshNote">
      <span className="picker-wordmark-word">
        {word0.map((char, i) => renderChar(char, i))}
      </span>
      <span className="picker-wordmark-word">
        {word1.map((char, i) => renderChar(char, i + 4))}
      </span>
    </h1>
  )
}
