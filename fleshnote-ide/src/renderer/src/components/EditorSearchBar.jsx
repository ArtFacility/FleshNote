import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export default function EditorSearchBar({ editor, initialMode, onClose }) {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [showReplace, setShowReplace] = useState(initialMode === 'replace')
  const [resultsCount, setResultsCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const searchInputRef = useRef(null)
  const replaceInputRef = useRef(null)

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Sync search term to TipTap
  useEffect(() => {
    if (editor) {
      if (searchTerm) {
        editor.commands.setSearchTerm(searchTerm)
      } else {
        editor.commands.clearSearch()
      }
    }
  }, [searchTerm, editor])

  // Track result count/index from editor storage
  useEffect(() => {
    if (!editor) return
    const handler = () => {
      if (editor.storage.searchAndReplace) {
        setResultsCount(editor.storage.searchAndReplace.results.length)
        setCurrentIndex(editor.storage.searchAndReplace.currentIndex)
      }
    }
    editor.on('transaction', handler)
    // Also fire immediately to catch current state
    handler()
    return () => {
      editor.off('transaction', handler)
    }
  }, [editor, searchTerm])

  // Auto-scroll to active search result
  useEffect(() => {
    setTimeout(() => {
      const activeEl = document.querySelector('.search-result-active')
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 50)
  }, [currentIndex])

  const handleClose = () => {
    editor?.commands.clearSearch()
    setSearchTerm('')
    setReplaceTerm('')
    onClose()
  }

  const handleReplaceCurrent = () => {
    if (!editor || resultsCount === 0) return
    editor.commands.replaceCurrent(replaceTerm)
  }

  const handleReplaceAll = () => {
    if (!editor || resultsCount === 0) return
    editor.commands.replaceAll(replaceTerm)
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        editor?.commands.previousSearchResult()
      } else {
        editor?.commands.nextSearchResult()
      }
    }
    if (e.key === 'Escape') {
      handleClose()
    }
    // Ctrl+H toggles replace from search input
    if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      setShowReplace(prev => !prev)
    }
  }

  const handleReplaceKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handleReplaceAll()
      } else {
        handleReplaceCurrent()
      }
    }
    if (e.key === 'Escape') {
      handleClose()
    }
  }

  const btnStyle = { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }
  const inputStyle = {
    background: 'var(--bg-deep)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    padding: '4px 8px',
    borderRadius: '2px',
    outline: 'none',
    width: '160px',
    fontSize: '12px'
  }

  return (
    <div className="search-overlay" style={{
      position: 'absolute',
      top: '20px',
      right: '40px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '2px',
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      zIndex: 100,
      fontFamily: 'var(--font-mono)'
    }}>
      {/* Search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => setShowReplace(prev => !prev)}
          title={t('editor.toggleReplace', 'Toggle Replace (Ctrl+H)')}
          style={{ ...btnStyle, fontSize: '10px', width: '18px', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {showReplace
              ? <polyline points="6 9 12 15 18 9" />
              : <polyline points="9 18 15 12 9 6" />
            }
          </svg>
        </button>

        <input
          ref={searchInputRef}
          type="text"
          placeholder={t('editor.search', 'Search...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          style={inputStyle}
        />

        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', minWidth: '40px', textAlign: 'center' }}>
          {resultsCount > 0 ? `${currentIndex + 1} / ${resultsCount}` : '0 / 0'}
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => editor?.commands.previousSearchResult()}
            title={t('editor.previousSearchResult', 'Previous (Shift+Enter)')}
            style={btnStyle}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </button>
          <button
            onClick={() => editor?.commands.nextSearchResult()}
            title={t('editor.nextSearchResult', 'Next (Enter)')}
            style={btnStyle}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button
            onClick={handleClose}
            title={t('editor.closeSearch', 'Close (Esc)')}
            style={{ ...btnStyle, marginLeft: '4px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '26px' }}>
          <input
            ref={replaceInputRef}
            type="text"
            placeholder={t('editor.replacePlaceholder', 'Replace...')}
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            style={inputStyle}
          />

          <button
            onClick={handleReplaceCurrent}
            disabled={resultsCount === 0}
            title={t('editor.replaceCurrent', 'Replace (Enter)')}
            style={{ ...btnStyle, fontSize: '11px', opacity: resultsCount === 0 ? 0.4 : 1 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <button
            onClick={handleReplaceAll}
            disabled={resultsCount === 0}
            title={t('editor.replaceAll', 'Replace All (Shift+Enter)')}
            style={{ ...btnStyle, fontSize: '11px', opacity: resultsCount === 0 ? 0.4 : 1 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
