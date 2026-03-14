import React, { useState, useEffect } from 'react'

export default function KarolyEasterEgg({ onComplete }) {
  const [active, setActive] = useState(true)

  useEffect(() => {
    // Open the video after a short delay or immediately? 
    // The user said "pop up and spin around ... then have it open"
    const timer = setTimeout(() => {
      window.open('https://www.youtube.com/watch?v=npltXMBZb-o', '_blank')
      if (onComplete) onComplete()
      setActive(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!active) return null

  return (
    <div className="karoly-easter-egg-overlay">
      <div className="karoly-container">
        {[...Array(12)].map((_, i) => (
          <div 
            key={i} 
            className="karoly-text" 
            style={{ 
              '--delay': `${i * 0.2}s`,
              '--rotation': `${i * 30}deg`,
              '--color': `hsl(${i * 30}, 100%, 50%)`
            }}
          >
            GET KÁROLY-ED
          </div>
        ))}
      </div>
      <style>{`
        .karoly-easter-egg-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          overflow: hidden;
          pointer-events: none;
        }

        .karoly-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .karoly-text {
          position: absolute;
          font-size: 5rem;
          font-weight: 900;
          color: var(--color);
          text-shadow: 0 0 20px var(--color), 0 0 40px var(--color);
          animation: karoly-spin 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          animation-delay: var(--delay);
          white-space: nowrap;
          transform-origin: center;
          filter: drop-shadow(0 0 10px white);
        }

        @keyframes karoly-spin {
          0% {
            transform: rotate(var(--rotation)) translate(0px) rotate(0deg) scale(0);
            opacity: 0;
            filter: hue-rotate(0deg) blur(10px);
          }
          20% {
            opacity: 1;
            filter: blur(0px);
          }
          50% {
            transform: rotate(calc(var(--rotation) + 360deg)) translate(300px) rotate(-360deg) scale(2);
            opacity: 1;
            filter: hue-rotate(180deg);
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: rotate(calc(var(--rotation) + 720deg)) translate(600px) rotate(-720deg) scale(4);
            opacity: 0;
            filter: hue-rotate(360deg) blur(20px);
          }
        }
      `}</style>
    </div>
  )
}
