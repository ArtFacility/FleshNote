import React, { useEffect, useRef } from 'react'

/** A textarea that grows to fit its content instead of scrolling or clipping. */
export default function AutoTextarea({ value, onChange, className, ...rest }) {
  const ref = useRef(null)
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(fit, [value])

  // Wrapping changes when the width changes or a web font finishes loading.
  useEffect(() => {
    window.addEventListener('resize', fit)
    document.fonts?.ready.then(fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  )
}
