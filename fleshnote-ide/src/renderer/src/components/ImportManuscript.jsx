import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const Icons = {
  Upload: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  X: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Split: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  marginBottom: '12px',
  boxSizing: 'border-box'
}

const labelStyle = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '6px'
}

export default function ImportManuscript({ projectPath, splits, setSplits, onCancel, onConfirm, loading }) {
  const { t } = useTranslation()
  const [importFile, setImportFile] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  
  // Edit split state
  const [editingIndex, setEditingIndex] = useState(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const contentRef = useRef(null)

  const handleSelectFile = async () => {
    const filePath = await window.api.openFile([
      { name: 'Manuscripts', extensions: ['txt', 'md', 'docx'] },
      { name: 'All Files', extensions: ['*'] }
    ])
    if (filePath) {
      setImportFile(filePath)
      setImportLoading(true)
      try {
        const result = await window.api.importSplitPreview({
          project_path: projectPath,
          file_path: filePath
        })
        const newSplits = result.splits || []
        setSplits((prev) => [...prev, ...newSplits])
      } catch (err) {
        console.error('Split preview failed:', err)
        alert('Failed to parse file: ' + err.message)
      } finally {
        setImportLoading(false)
      }
    }
  }

  const mergeSplit = (index) => {
    if (index <= 0 || index >= splits.length) return
    setSplits((prev) => {
      const newSplits = [...prev]
      const merged = {
        title: newSplits[index - 1].title,
        content: newSplits[index - 1].content + '\n\n' + newSplits[index].content,
        preview: newSplits[index - 1].preview,
        word_count: newSplits[index - 1].word_count + newSplits[index].word_count
      }
      newSplits.splice(index - 1, 2, merged)
      return newSplits
    })
  }

  const renameSplit = (index, newTitle) => {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, title: newTitle } : s)))
  }

  const openEdit = (index) => {
    setEditingIndex(index)
    setEditTitle(splits[index].title)
    setEditContent(splits[index].content)
  }

  const saveEdit = () => {
    if (editingIndex === null) return
    setSplits(prev => prev.map((s, i) => i === editingIndex ? {
      ...s,
      title: editTitle,
      content: editContent,
      preview: editContent.substring(0, 150) + '...',
      word_count: editContent.trim() ? editContent.trim().split(/\s+/).length : 0
    } : s))
    setEditingIndex(null)
  }

  const splitAtCursor = () => {
    if (!contentRef.current || editingIndex === null) return
    const cursor = contentRef.current.selectionStart
    if (cursor === undefined) return
    
    const textBefore = editContent.substring(0, cursor)
    const textAfter = editContent.substring(cursor)
    
    // Attempt extracting a title from textAfter if we wanted to, but simple generic title is fine.
    // The user can rename it right in the UI.
    const s1 = {
      title: editTitle,
      content: textBefore,
      preview: textBefore.substring(0, 150) + '...',
      word_count: textBefore.trim() ? textBefore.trim().split(/\s+/).length : 0
    }
    const s2 = {
      title: "Split Part 2",
      content: textAfter,
      preview: textAfter.substring(0, 150) + '...',
      word_count: textAfter.trim() ? textAfter.trim().split(/\s+/).length : 0
    }
    
    setSplits(prev => {
      const arr = [...prev]
      arr.splice(editingIndex, 1, s1, s2)
      return arr
    })
    setEditingIndex(null)
  }

  if (editingIndex !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
           <h3 className="setup-title" style={{ margin: 0 }}>{t('setup.editChapterData', 'Edit Chapter Data')}</h3>
           <button onClick={() => setEditingIndex(null)} className="setup-remove-btn" style={{ position: 'relative', top: 0, right: 0 }}>
             <Icons.X />
           </button>
        </div>
        
        <label style={labelStyle}>{t('setup.chapterTitle', 'Chapter Title')}</label>
        <input 
          style={inputStyle} 
          value={editTitle} 
          onChange={e => setEditTitle(e.target.value)} 
        />
        
        <label style={{...labelStyle, marginTop: 12, display: 'flex', justifyContent: 'space-between'}}>
          <span>{t('setup.chapterContent', 'Chapter Content')}</span>
          <span style={{ color: 'var(--text-tertiary)', textTransform: 'none' }}>
            {editContent.trim() ? editContent.trim().split(/\s+/).length : 0} words
          </span>
        </label>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 8, lineHeight: 1.4 }}>
          {t('setup.splitInstructions', 'Tip: You can edit the text to recover accidentally removed titles. To split this chapter into two, place your cursor where you want to split and click "Split at Cursor".')}
        </div>
        
        <textarea
          ref={contentRef}
          style={{ ...inputStyle, flex: 1, resize: 'none', fontSize: 13, lineHeight: '1.6', padding: '16px', minHeight: '300px' }}
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
        />

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button className="setup-btn secondary" onClick={() => setEditingIndex(null)}>
            {t('setup.cancel', 'Cancel')}
          </button>
          <button className="setup-btn secondary" onClick={splitAtCursor} title={t('setup.splitAtCursorTitle', 'Split text into two chapters at cursor position')}>
            <Icons.Split /> {t('setup.splitAtCursor', 'Split at Cursor')}
          </button>
          <div style={{ flex: 1 }} />
          <button className="setup-btn primary" onClick={saveEdit}>
            {t('setup.saveChanges', 'Save Changes')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <h2 className="setup-title">{t('setup.importManuscriptTitle', 'Import Manuscript')}</h2>
      <p className="setup-subtitle">
        {t('setup.importManuscriptSubtitle', "Select your manuscript file. We'll attempt to split it into chapters automatically.")}
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          className="setup-btn secondary"
          onClick={handleSelectFile}
          style={{ flex: 1 }}
        >
          <Icons.Upload /> {t('setup.selectFile', 'Select File (.txt, .md, .docx)')}
        </button>
      </div>

      {importFile && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginBottom: 16,
            padding: '8px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {importFile}
        </div>
      )}

      {importLoading && (
        <div
          style={{
            textAlign: 'center',
            padding: 32,
            color: 'var(--accent-amber)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12
          }}
        >
          {t('setup.analyzingFile', 'Analyzing file and detecting chapters...')}
        </div>
      )}

      {splits.length > 0 && !importLoading && (
        <>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              marginBottom: 12
            }}
          >
            {t('setup.foundChapters', 'Found {{count}} chapters · {{words}} words total', {
              count: splits.length,
              words: splits.reduce((s, c) => s + c.word_count, 0).toLocaleString()
            })}
          </div>

          <div className="setup-splits-list">
            {splits.map((split, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="setup-split-action">
                    <button className="setup-split-btn" onClick={() => mergeSplit(i)}>
                      {t('setup.mergePrevious', 'Merge with previous')}
                    </button>
                  </div>
                )}
                <div className="setup-split-item">
                  <div className="setup-split-header" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="setup-split-title-input"
                      value={split.title}
                      onChange={(e) => renameSplit(i, e.target.value)}
                    />
                    <span className="setup-split-words">
                      {t('setup.wordsUnit', '{{count}} words', { count: split.word_count.toLocaleString() })}
                    </span>
                    <button 
                      className="setup-btn secondary" 
                      style={{ padding: '4px 8px', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => openEdit(i)}
                      title={t('setup.editChapter', 'Edit Content & Splits')}
                    >
                      <Icons.Edit /> {t('setup.edit', 'Edit')}
                    </button>
                  </div>
                  <div className="setup-split-preview">{split.preview}...</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <button
          className="setup-btn secondary"
          onClick={onCancel}
        >
          {t('setup.cancel', 'Cancel')}
        </button>

        {splits.length > 0 && (
          <button
            className="setup-btn primary"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? t('setup.importing', 'Importing...') : t('setup.confirmChapters', 'Confirm {{count}} Chapters', { count: splits.length })}
          </button>
        )}
      </div>
    </div>
  )
}
