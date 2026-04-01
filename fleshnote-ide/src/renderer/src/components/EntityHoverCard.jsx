import { useState, useEffect, useRef } from 'react'

/**
 * EntityHoverCard — Floating tooltip shown when hovering over entity/twist links in the editor.
 *
 * Props:
 *   data           { entityType, entityId } | { twistType, twistId } | null
 *   position       { x, y }  — fixed screen coords (rect.left, rect.bottom + 4)
 *   entities       Entity[]  — full entity list from FleshNoteIDE state
 *   projectPath    string
 *   effectiveWorldTime  string — resolved world time at cursor (including time overrides)
 *
 * Enriched details per type:
 *   character  → icon + age at scene time (via api:calculateAge)
 *   location   → icon + current weather (via entity.current_weather field)
 *   lore/item  → icon + category + classification
 *   quicknote  → note type chip + content (no duplicate name)
 *   annotation → content only (no duplicate name)
 *   twist      → title + description + foreshadow count
 *   foreshadow → twist title + description (the payoff this hints at)
 */

// ── Tiny in-memory cache for enriched data (lives as long as component tree does) ──
const iconCache  = new Map()  // projectPath → { 'char:id': path, 'loc:id': path, … }
const ageCache   = new Map()  // `${birth_date}|${world_time}|${projectPath}` → result
const twistCache = new Map()  // `${projectPath}|${twistId}` → result

/**
 * Call this whenever entities are mutated (icon change, rename, delete, etc.)
 * so the next hover re-fetches fresh data instead of showing a stale/broken icon.
 * Twist cache is kept — twist edits go through a separate inspector refresh.
 */
export function clearEntityHoverCaches() {
  iconCache.clear()
  ageCache.clear()
}

const NOTE_TYPE_COLORS = {
  Note:       'var(--accent-amber)',
  Fix:        'var(--accent-red)',
  Suggestion: 'var(--accent-blue)',
  Idea:       '#4ade80',
}

// Map entity type → prefix used in the bulk-icon map
const ICON_PREFIX = { character: 'char', location: 'loc', lore: 'lore', item: 'lore' }

export default function EntityHoverCard({ data, position, entities, projectPath, effectiveWorldTime }) {
  const [enriched, setEnriched] = useState(null)
  const abortRef = useRef(false)

  useEffect(() => {
    if (!data) { setEnriched(null); return }
    abortRef.current = false
    setEnriched(null)

    const load = async () => {
      // ── Twist / Foreshadow ──────────────────────────────────────────────
      if (data.twistType) {
        const cKey = `${projectPath}|${data.twistId}`
        let result = twistCache.get(cKey)
        if (!result) {
          try {
            result = await window.api.getTwistDetail({ project_path: projectPath, twist_id: data.twistId })
            if (result) twistCache.set(cKey, result)
          } catch { result = null }
        }
        if (!abortRef.current) setEnriched({ kind: 'twist', result })
        return
      }

      // ── Entity links ─────────────────────────────────────────────────────
      const entity = entities.find(
        e => String(e.id) === String(data.entityId) && e.type === data.entityType
      )
      if (!entity) { setEnriched({ kind: 'unknown' }); return }

      // Load bulk icon map (cached per projectPath)
      let iconMap = iconCache.get(projectPath)
      if (!iconMap) {
        try {
          const res = await window.api.getBulkEntityIcons({ project_path: projectPath })
          iconMap = res?.icons || {}
          iconCache.set(projectPath, iconMap)
        } catch { iconMap = {} }
      }
      if (abortRef.current) return

      const prefix = ICON_PREFIX[data.entityType]
      const iconRelPath = prefix ? iconMap[`${prefix}:${data.entityId}`] : null
      const iconUrl = iconRelPath
        ? `fleshnote-asset://load/${projectPath.replace(/\\/g, '/')}/${iconRelPath}`
        : null

      // ── Character: calculate age ─────────────────────────────────────────
      if (data.entityType === 'character') {
        let age = null
        if (entity.birth_date && effectiveWorldTime && projectPath) {
          const aCacheKey = `${entity.birth_date}|${effectiveWorldTime}|${projectPath}`
          age = ageCache.get(aCacheKey)
          if (age === undefined) {
            try {
              age = await window.api.calculateAge({
                project_path: projectPath,
                birth_date: entity.birth_date,
                world_time: effectiveWorldTime,
              })
              ageCache.set(aCacheKey, age)
            } catch { age = null }
          }
        }
        if (!abortRef.current) setEnriched({ kind: 'character', entity, iconUrl, age })
        return
      }

      // ── No extra async needed for other types ────────────────────────────
      if (!abortRef.current) setEnriched({ kind: data.entityType, entity, iconUrl })
    }

    load()
    return () => { abortRef.current = true }
  }, [data?.entityType, data?.entityId, data?.twistType, data?.twistId, projectPath, effectiveWorldTime, entities])

  if (!data) return null

  // Render skeleton while loading
  if (!enriched) {
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div style={{ width: 80, height: 10, background: 'var(--border-subtle)', borderRadius: 2, opacity: 0.6 }} />
      </div>
    )
  }

  // ── Twist / Foreshadow ───────────────────────────────────────────────────
  if (enriched.kind === 'twist') {
    const { result } = enriched
    const twist = result?.twist
    const foreshadowCount = result?.stats?.foreshadow_count ?? result?.foreshadowings?.length ?? 0
    const isForeshadow = data.twistType === 'foreshadow'

    if (!twist) {
      return (
        <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
          <div className={`hover-card-type ${isForeshadow ? 'foreshadow' : 'twist'}`}>
            {isForeshadow ? 'Foreshadow' : 'Twist'}
          </div>
          <div className="hover-card-detail" style={{ opacity: 0.5 }}>Not found</div>
        </div>
      )
    }

    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className={`hover-card-type ${isForeshadow ? 'foreshadow' : 'twist'}`}>
          {isForeshadow ? '◈ Foreshadow hint for:' : '◆ Twist'}
        </div>
        <div className="hover-card-name">{twist.title}</div>
        {twist.description && (
          <div className="hover-card-detail" style={{ marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>
            {twist.description.length > 120 ? twist.description.slice(0, 120) + '…' : twist.description}
          </div>
        )}
        {!isForeshadow && foreshadowCount > 0 && (
          <div className="hover-card-detail" style={{ marginTop: 6, color: 'var(--accent-purple)' }}>
            ◈ {foreshadowCount} foreshadow{foreshadowCount !== 1 ? 's' : ''} planted
          </div>
        )}
        {twist.status && (
          <div className="hover-card-detail" style={{ marginTop: 4, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 9 }}>
            {twist.status}
          </div>
        )}
        <div className="hover-card-hint">Click to inspect</div>
      </div>
    )
  }

  // ── Unknown entity ───────────────────────────────────────────────────────
  if (enriched.kind === 'unknown') {
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className="hover-card-detail" style={{ opacity: 0.5 }}>Entity not found</div>
      </div>
    )
  }

  const { entity, iconUrl } = enriched

  // ── QuickNote ────────────────────────────────────────────────────────────
  if (enriched.kind === 'quicknote') {
    const nt = entity.note_type || 'Note'
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className="hover-card-type quicknote" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Quick Note</span>
          <span style={{ color: NOTE_TYPE_COLORS[nt] || 'var(--accent-amber)', fontWeight: 700 }}>{nt}</span>
        </div>
        <div className="hover-card-name">{entity.name}</div>
        {entity.content && (
          <div className="hover-card-detail" style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', marginTop: 4, lineHeight: 1.5 }}>
            {entity.content.length > 200 ? entity.content.slice(0, 200) + '…' : entity.content}
          </div>
        )}
        <div className="hover-card-hint">Click to view/edit</div>
      </div>
    )
  }

  // ── Annotation ───────────────────────────────────────────────────────────
  if (enriched.kind === 'annotation') {
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className="hover-card-type annotation">Annotation</div>
        <div className="hover-card-name">{entity.name}</div>
        {entity.content && (
          <div
            className="hover-card-detail"
            style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', marginTop: 6, color: 'var(--accent-annotation)', lineHeight: 1.5 }}
          >
            {entity.content.length > 200 ? entity.content.slice(0, 200) + '…' : entity.content}
          </div>
        )}
        <div className="hover-card-hint">Click to view/edit</div>
      </div>
    )
  }

  // ── Character ────────────────────────────────────────────────────────────
  if (enriched.kind === 'character') {
    const { age } = enriched
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className="hover-card-type character">Character</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 3, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)' }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div className="hover-card-name" style={{ marginBottom: 2 }}>{entity.name}</div>
            {entity.role && <div className="hover-card-detail">{entity.role}</div>}
            {age?.calculated && (
              <div className="hover-card-detail" style={{ color: 'var(--accent-amber)', marginTop: 3 }}>
                Age: {age.age_text}
              </div>
            )}
          </div>
        </div>
        {entity.status && (
          <div className="hover-card-detail" style={{ marginTop: 2 }}>{entity.status}</div>
        )}
        <div className="hover-card-hint">Click to inspect</div>
      </div>
    )
  }

  // ── Location ─────────────────────────────────────────────────────────────
  if (enriched.kind === 'location') {
    const weather = entity.current_weather || entity.weather
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className="hover-card-type location">Location</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 3, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)' }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div className="hover-card-name" style={{ marginBottom: 2 }}>{entity.name}</div>
            {entity.category && <div className="hover-card-detail">{entity.category}</div>}
          </div>
        </div>
        {weather && (
          <div className="hover-card-detail" style={{ marginTop: 4, color: 'var(--accent-blue)' }}>
            ☁ {weather}
          </div>
        )}
        <div className="hover-card-hint">Click to inspect</div>
      </div>
    )
  }

  // ── Lore / Item ──────────────────────────────────────────────────────────
  if (enriched.kind === 'lore' || enriched.kind === 'item') {
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className={`hover-card-type ${enriched.kind}`}>
          {enriched.kind === 'item' ? 'Item' : 'Lore'}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
          {iconUrl && (
            <img
              src={iconUrl}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 3, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)' }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div className="hover-card-name" style={{ marginBottom: 2 }}>{entity.name}</div>
            {entity.category && <div className="hover-card-detail">{entity.category}</div>}
          </div>
        </div>
        {entity.classification && (
          <div className="hover-card-detail" style={{ marginTop: 2, color: 'var(--accent-purple)' }}>
            {entity.classification}
          </div>
        )}
        <div className="hover-card-hint">Click to inspect</div>
      </div>
    )
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  return (
    <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
      <div className={`hover-card-type ${data.entityType}`}>{data.entityType}</div>
      <div className="hover-card-name">{entity.name}</div>
      {entity.category && <div className="hover-card-detail">{entity.category}</div>}
      <div className="hover-card-hint">Click to inspect</div>
    </div>
  )
}
