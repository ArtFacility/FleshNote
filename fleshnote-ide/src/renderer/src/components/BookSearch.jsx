import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function BookSearch({ projectPath, onClose, onNavigate, onBookChanged }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [error, setError] = useState('')
  const [replacedWith, setReplacedWith] = useState({})
  const searchInputRef = useRef(null)
  const requestSeqRef = useRef(0)

  const groupedResults = useMemo(() => {
    const groups = []
    for (const result of results) {
      let group = groups.find(g => String(g.chapterId) === String(result.chapter_id))
      if (!group) {
        group = {
          chapterId: result.chapter_id,
          chapterNumber: result.chapter_number,
          chapterTitle: result.chapter_title,
          results: []
        }
        groups.push(group)
      }
      group.results.push(result)
    }
    return groups
  }, [results])

  const runSearch = async (termOverride) => {
    const term = (termOverride ?? query).trim()
    if (!term) return
    const seq = ++requestSeqRef.current
    setLoading(true)
    setError('')
    try {
      const response = await window.api.bookSearch({
        project_path: projectPath,
        query: term
      })
      if (seq !== requestSeqRef.current) return
      if (response?.error) throw new Error(response.error)
      setResults(response?.results || [])
      setTruncated(Boolean(response?.truncated))
      setReplacedWith({})
      setSearchedQuery(term)
      setSearched(true)
    } catch (err) {
      if (seq !== requestSeqRef.current) return
      setError(String(err?.message || err))
    } finally {
      if (seq === requestSeqRef.current) setLoading(false)
    }
  }

  const refresh = () => {
    setReplacedWith({})
    runSearch(searchedQuery)
  }

  const replaceAll = async () => {
    if (!searched || results.length === 0 || replacing) return
    setReplacing(true)
    setError('')
    try {
      const response = await window.api.bookReplace({
        project_path: projectPath,
        query: searchedQuery,
        replacement,
        match_ids: results.map(r => r.id)
      })
      if (response?.error) throw new Error(response.error)
      setReplacedWith(Object.fromEntries(results.map(r => [r.id, replacement])))
      onBookChanged?.()
    } catch (err) {
      setError(String(err?.message || err))
    } finally {
      setReplacing(false)
    }
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      runSearch()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleReplaceKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      replaceAll()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const btnStyle = { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }
  const inputStyle = {
    background: 'var(--bg-deep)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    padding: '5px 8px',
    borderRadius: '2px',
    outline: 'none',
    width: '190px',
    fontSize: '12px'
  }

  return (
    <div className="book-search-page">
      <div className="book-search-window">
        <div className="book-search-window-row">
          <button
            onClick={() => setShowReplace(prev => !prev)}
            title={t('editor.toggleReplace', 'Toggle Replace (Ctrl+H)')}
            style={{ ...btnStyle, fontSize: '10px', width: '18px', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {showReplace
                ? <polyline points="6 9 12 15 18 9" />
                : <polyline points="9 18 15 12 9 6" />}
            </svg>
          </button>
          <input
            ref={searchInputRef}
            autoFocus
            type="text"
            placeholder={t('bookSearch.findPlaceholder', 'Find across book...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={inputStyle}
          />
          <button
            className="book-search-action"
            onClick={() => runSearch()}
            disabled={loading || !query.trim()}
            title={t('bookSearch.find', 'Find all (Enter)')}
          >
            {t('bookSearch.find', 'Find all')}
          </button>
          <div className="book-search-count">{searched ? `${results.length}` : '—'}</div>
          <button onClick={onClose} title={t('editor.closeSearch', 'Close (Esc)')} style={btnStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {showReplace && (
          <div className="book-search-window-row book-search-replace-row">
            <input
              type="text"
              placeholder={t('editor.replacePlaceholder', 'Replace...')}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              style={inputStyle}
            />
            <button
              className="book-search-action"
              onClick={replaceAll}
              disabled={!searched || results.length === 0 || replacing}
              title={t('bookSearch.replaceAll', 'Replace all matches across the book')}
            >
              {replacing
                ? t('bookSearch.replacing', 'Replacing...')
                : t('editor.replaceAll', 'Replace all')}
            </button>
            {Object.keys(replacedWith).length > 0 && (
              <span className="book-search-replaced-note">
                {t('bookSearch.replacedNote', 'Replaced in this view — refresh to re-search')}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="book-search-results">
        <div className="book-search-results-header">
          <div className="book-search-results-title">
            {t('bookSearch.resultsTitle', 'Search results')}
            {searched && (
              <span className="book-search-count-label">
                {t('bookSearch.resultCount', '{{count}} matches in {{chapters}} chapters', {
                  count: results.length,
                  chapters: groupedResults.length
                })}
              </span>
            )}
            {truncated && (
              <span className="book-search-truncated">
                {t('bookSearch.truncated', 'Showing first {{count}} matches', { count: results.length })}
              </span>
            )}
          </div>
          <div className="book-search-results-actions">
            <button className="book-search-action" onClick={refresh} disabled={!searched || loading}>
              {loading ? t('bookSearch.searching', 'Searching...') : t('bookSearch.refresh', 'Refresh')}
            </button>
            <button className="book-search-action" onClick={onClose}>
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>

        {error && <div className="book-search-error">{error}</div>}

        {!searched ? (
          <div className="book-search-empty">
            {t('bookSearch.initialHint', 'Enter a word or phrase above to search every chapter of this book.')}
          </div>
        ) : loading ? (
          <div className="book-search-empty">{t('bookSearch.searching', 'Searching...')}</div>
        ) : results.length === 0 ? (
          <div className="book-search-empty">{t('bookSearch.noResults', 'No matches found.')}</div>
        ) : (
          <div className="book-search-results-list">
            {groupedResults.map(group => (
              <section key={group.chapterId} className="book-search-group">
                <div className="book-search-group-header">
                  <span className="book-search-chapter">
                    {t('bookSearch.chapter', 'Chapter {{number}}', { number: group.chapterNumber })}
                  </span>
                  <span className="book-search-chapter-title">{group.chapterTitle}</span>
                  <span className="book-search-count-label">{group.results.length}</span>
                </div>
                {group.results.map(result => {
                  const wasReplaced = Object.prototype.hasOwnProperty.call(replacedWith, result.id)
                  return (
                    <button
                      key={result.id}
                      className="book-search-result"
                      title={t('bookSearch.openResult', 'Open in editor')}
                      onClick={() => onNavigate?.({
                        chapterId: result.chapter_id,
                        wordOffset: result.word_offset,
                        charOffset: result.char_offset,
                        match: result.match
                      })}
                    >
                      <span className="book-search-context">
                        {result.before && <>…{result.before} </>}
                        {wasReplaced ? (
                          <>
                            <s className="book-search-old">{result.match}</s>
                            <span className="book-search-new">{replacedWith[result.id] || '∅'}</span>
                          </>
                        ) : (
                          <mark className="book-search-highlight">{result.match}</mark>
                        )}
                        {result.after && <> {result.after}…</>}
                      </span>
                    </button>
                  )
                })}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
