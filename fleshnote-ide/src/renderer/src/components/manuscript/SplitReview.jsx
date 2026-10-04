import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SCENE_BREAK,
  joinWithPrevious,
  looksLikeTitle,
  moveSplit,
  removeFlagged,
  removeSplit,
  renameSplit,
  renderInline,
  splitAt,
  useFirstParagraphAsTitle
} from '../../utils/manuscriptSplits'

const DRAG_TYPE = 'application/x-fleshnote-split'

/**
 * Two-pane review of proposed chapters: the chapter list on the left (rename,
 * drag to reorder, remove), the selected chapter's text on the right, where a
 * click between two paragraphs starts a new chapter.
 */
export default function SplitReview({ splits, selected, onSelect, onChange }) {
  const { t } = useTranslation()
  const [dragFrom, setDragFrom] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const index = Math.min(Math.max(selected, 0), splits.length - 1)
  const current = splits[index]
  const flagged = splits.filter((s) => s.flag).length

  const change = (next, nextSelected = index) => {
    onChange(next)
    onSelect(Math.min(Math.max(nextSelected, 0), next.length - 1))
  }

  const flagLabel = (flag) =>
    flag === 'front'
      ? t('manuscript.flagFront', 'front matter')
      : flag === 'back'
        ? t('manuscript.flagBack', 'back matter')
        : flag === 'empty'
        ? t('manuscript.flagEmpty', 'empty')
        : null

  return (
    <div className="ms-review">
      <aside className="ms-list" aria-label={t('manuscript.chapterList', 'Chapters')}>
        {flagged > 0 ? (
          <div className="ms-banner">
            <span>
              {t('manuscript.flaggedNotice', '{{count}} sections look like front matter or empty headings (a title page, a table of contents).', {
                count: flagged
              })}
            </span>
            <button type="button" className="ms-text-btn" onClick={() => change(removeFlagged(splits), 0)}>
              {t('manuscript.removeFlagged', 'Remove them')}
            </button>
          </div>
        ) : null}

        <ol className="ms-list-items">
          {splits.map((s, i) => (
            <li
              key={s.id}
              className={[
                'ms-list-row',
                i === index ? 'is-selected' : '',
                s.flag ? 'is-flagged' : '',
                dragOver === i && dragFrom !== null && dragFrom !== i ? (dragFrom < i ? 'drop-below' : 'drop-above') : ''
              ].join(' ')}
              draggable
              tabIndex={0}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => {
                if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                  e.preventDefault()
                  const to = e.key === 'ArrowUp' ? i - 1 : i + 1
                  if (to >= 0 && to < splits.length) change(moveSplit(splits, i, to), to)
                } else if (e.key === 'ArrowUp' && i > 0) {
                  e.preventDefault()
                  onSelect(i - 1)
                } else if (e.key === 'ArrowDown' && i < splits.length - 1) {
                  e.preventDefault()
                  onSelect(i + 1)
                }
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, String(i))
                e.dataTransfer.effectAllowed = 'move'
                setDragFrom(i)
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
                e.preventDefault()
                setDragOver(i)
              }}
              onDragEnd={() => {
                setDragFrom(null)
                setDragOver(null)
              }}
              onDrop={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
                e.preventDefault()
                e.stopPropagation()
                const from = Number(e.dataTransfer.getData(DRAG_TYPE))
                setDragFrom(null)
                setDragOver(null)
                if (!Number.isNaN(from)) change(moveSplit(splits, from, i), i)
              }}
              title={t('manuscript.dragHint', 'Drag to reorder (or Alt + ↑/↓)')}
            >
              <span className="ms-list-num">{i + 1}</span>
              <span className="ms-list-title" dir="auto">{s.title || t('manuscript.untitled', 'Untitled chapter')}</span>
              <span className="ms-list-meta">
                {flagLabel(s.flag) ? <span className="ms-flag">{flagLabel(s.flag)}</span> : null}
                {s.word_count.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      </aside>

      {current ? (
        <section className="ms-pane">
          <header className="ms-pane-header">
            <input
              className="ms-title-input"
              dir="auto"
              value={current.title}
              onChange={(e) => onChange(renameSplit(splits, index, e.target.value))}
              placeholder={t('manuscript.untitled', 'Untitled chapter')}
              aria-label={t('manuscript.chapterTitle', 'Chapter title')}
            />
            <div className="ms-pane-meta">
              <span>
                {t('manuscript.chapterMeta', 'Chapter {{n}} · {{words}} words', {
                  n: index + 1,
                  words: current.word_count.toLocaleString()
                })}
                {current.source ? ` · ${current.source}` : ''}
              </span>
              <span className="ms-pane-actions">
                <button
                  type="button"
                  className="ms-text-btn"
                  disabled={index === 0}
                  onClick={() => change(joinWithPrevious(splits, index), index - 1)}
                >
                  {t('manuscript.joinPrevious', 'Join with previous')}
                </button>
                <button
                  type="button"
                  className="ms-text-btn danger"
                  disabled={splits.length <= 1}
                  onClick={() => change(removeSplit(splits, index), index)}
                >
                  {t('manuscript.removeChapter', 'Remove')}
                </button>
              </span>
            </div>
          </header>

          {/* Manuscript text keeps its own direction (dir="auto"), whatever the interface language. */}
          <div className="ms-text" key={current.id}>
            {current.paragraphs.length === 0 ? (
              <p className="ms-empty">{t('manuscript.noText', 'This chapter has no text.')}</p>
            ) : null}
            {current.paragraphs.map((p, pi) => (
              <React.Fragment key={pi}>
                {pi > 0 ? (
                  <div className="ms-gap">
                    <button
                      type="button"
                      className="ms-gap-btn"
                      onClick={() => change(splitAt(splits, index, pi, t('manuscript.untitled', 'Untitled chapter')), index + 1)}
                    >
                      {t('manuscript.splitHere', 'Start a new chapter here')}
                    </button>
                  </div>
                ) : null}
                <div className={`ms-para-wrap ${pi === 0 && looksLikeTitle(p) ? 'can-title' : ''}`}>
                  {p === SCENE_BREAK ? (
                    <p className="ms-break">* * *</p>
                  ) : p.startsWith('### ') ? (
                    <h4 className="ms-subheading" dir="auto">{renderInline(p.slice(4))}</h4>
                  ) : (
                    <p className="ms-para" dir="auto">{renderInline(p)}</p>
                  )}
                  {pi === 0 && looksLikeTitle(p) ? (
                    <button
                      type="button"
                      className="ms-text-btn ms-use-title"
                      onClick={() => onChange(useFirstParagraphAsTitle(splits, index))}
                    >
                      {t('manuscript.useAsTitle', 'Use as title')}
                    </button>
                  ) : null}
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
