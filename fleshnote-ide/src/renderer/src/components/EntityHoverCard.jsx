import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { parseWorldDate, dateToLinear } from '../utils/calendarUtils'


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

import { iconCache, ageCache, twistCache, weatherCache } from '../utils/hoverCache'

const NOTE_TYPE_COLORS = {
  Note:       'var(--accent-amber)',
  Fix:        'var(--accent-red)',
  Suggestion: 'var(--accent-blue)',
  Idea:       '#4ade80',
}

// Map entity type → prefix used in the bulk-icon map
const ICON_PREFIX = { character: 'char', location: 'loc', lore: 'lore', item: 'lore' }

export default function EntityHoverCard({ data, position, entities, projectPath, effectiveWorldTime, calConfig }) {
  const { t } = useTranslation()
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
        ? `fleshnote-asset://load/${projectPath.replace(/\\/g, '/')}/${iconRelPath}?v=${Date.now()}`
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

      // ── Location: resolve weather at scene time ─────────────────────────
      if (data.entityType === 'location') {
        let activeWeather = null
        if (effectiveWorldTime && projectPath) {
          // Resolve time once
          const linearNow = (() => {
            const parsed = parseWorldDate(effectiveWorldTime, calConfig)
            return parsed ? dateToLinear(parsed.year, parsed.month, parsed.day, calConfig) : null
          })()

          // Walk up the parent chain to find inherited weather
          const statesLookup = {} 
          let currId = data.entityId
          let depth = 0
          while (currId && depth < 5) {
            const cacheKey = `${projectPath}|${currId}`
            let states = weatherCache.get(cacheKey)
            if (!states) {
              try {
                const res = await window.api.getWeatherStates({ project_path: projectPath, location_id: currId })
                states = res?.weather_states || []
                weatherCache.set(cacheKey, states)
              } catch { states = [] }
            }
            statesLookup[currId] = states
            
            // Linearize and sort
            const withLinear = (states || [])
              .map(s => {
                const p = parseWorldDate(s.world_time, calConfig)
                return { ...s, _linear: p ? dateToLinear(p.year, p.month, p.day, calConfig) : null }
              })
              .filter(s => s._linear !== null)
              .sort((a, b) => b._linear - a._linear)
            
            // Find most recent past state
            if (linearNow !== null) {
              const match = withLinear.find(s => s._linear <= linearNow)
              if (match) {
                const daysAgo = linearNow - match._linear
                activeWeather = { ...match, inherited: depth > 0, daysAgo, sourceLocation: entities.find(e => String(e.id) === String(currId))?.name }
                break
              }
            }

            const currEntity = entities.find(e => String(e.id) === String(currId))
            currId = currEntity?.parent_location_id
            depth++
          }
        }
        if (!abortRef.current) setEnriched({ kind: 'location', entity, iconUrl, activeWeather })
        return
      }

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
            {isForeshadow ? t('hover.foreshadowHint', 'Foreshadow') : t('hover.twist', 'Twist')}
          </div>
          <div className="hover-card-detail" style={{ opacity: 0.5 }}>{t('hover.entityNotFound', 'Not found')}</div>
        </div>
      )
    }

    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
          <div className={`hover-card-type ${isForeshadow ? 'foreshadow' : 'twist'}`}>
            {isForeshadow ? t('hover.foreshadowHint', '◈ Foreshadow hint for:') : t('hover.twist', '◆ Twist')}
          </div>

        <div className="hover-card-name">{twist.title}</div>
        {twist.description && (
          <div className="hover-card-detail" style={{ marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>
            {twist.description.length > 120 ? twist.description.slice(0, 120) + '…' : twist.description}
          </div>
        )}
        {!isForeshadow && foreshadowCount > 0 && (
          <div className="hover-card-detail" style={{ marginTop: 6, color: 'var(--accent-purple)' }}>
            ◈ {foreshadowCount} {t('hover.foreshadowCount', 'foreshadow(s)')} {t('hover.foreshadowPlanted', 'planted')}
          </div>
        )}

        {twist.status && (
          <div className="hover-card-detail" style={{ marginTop: 4, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 9 }}>
            {twist.status}
          </div>
        )}
        <div className="hover-card-hint">{t('hover.clickInspect', 'Click to inspect')}</div>

      </div>
    )
  }

  // ── Unknown entity ───────────────────────────────────────────────────────
  if (enriched.kind === 'unknown') {
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className="hover-card-detail" style={{ opacity: 0.5 }}>{t('hover.entityNotFound', 'Entity not found')}</div>
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
          <span>{t('hover.quickNote', 'Quick Note')}</span>
          <span style={{ color: NOTE_TYPE_COLORS[nt] || 'var(--accent-amber)', fontWeight: 700 }}>{t(`hover.noteType.${nt.toLowerCase()}`, nt)}</span>
        </div>

        {entity.content && (
          <div className="hover-card-detail" style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', marginTop: 4, lineHeight: 1.5 }}>
            {entity.content.length > 200 ? entity.content.slice(0, 200) + '…' : entity.content}
          </div>
        )}
        <div className="hover-card-hint">{t('hover.clickEdit', 'Click to view/edit')}</div>

      </div>
    )
  }

  // ── Annotation ───────────────────────────────────────────────────────────
  if (enriched.kind === 'annotation') {
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className="hover-card-type annotation">{t('hover.annotation', 'Annotation')}</div>

        {entity.content && (
          <div
            className="hover-card-detail"
            style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', marginTop: 6, color: 'var(--accent-annotation)', lineHeight: 1.5 }}
          >
            {entity.content.length > 200 ? entity.content.slice(0, 200) + '…' : entity.content}
          </div>
        )}
        <div className="hover-card-hint">{t('hover.clickEdit', 'Click to view/edit')}</div>

      </div>
    )
  }

  // ── Character ────────────────────────────────────────────────────────────
  if (enriched.kind === 'character') {
    const { age } = enriched
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className="hover-card-type character">{t('hover.character', 'Character')}</div>

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
                {t('hover.age', 'Age')}: {age.age_text}
              </div>
            )}

          </div>
        </div>
        {entity.status && (
          <div className="hover-card-detail" style={{ marginTop: 2 }}>{entity.status}</div>
        )}
        <div className="hover-card-hint">{t('hover.clickInspect', 'Click to inspect')}</div>

      </div>
    )
  }

  // ── Location ─────────────────────────────────────────────────────────────
  if (enriched.kind === 'location') {
    const { activeWeather } = enriched
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className="hover-card-type location">{t('hover.location', 'Location')}</div>

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
            {entity.region && <div className="hover-card-detail">{entity.region}</div>}
          </div>
        </div>
        {activeWeather ? (
          <div className="hover-card-detail" style={{ marginTop: 4, color: 'var(--accent-blue)', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13 }}>☁ {activeWeather.weather || t('hover.clearWeather', 'Clear')}</span>
            {activeWeather.inherited && (
              <span style={{ fontSize: 9, opacity: 0.6, fontStyle: 'italic' }}>
                {t('hover.inheritedFrom', 'Inherited from')}: {activeWeather.sourceLocation}
              </span>
            )}
          </div>
        ) : (
           <div className="hover-card-detail" style={{ marginTop: 4, color: 'var(--text-tertiary)', fontSize: 10, fontStyle: 'italic' }}>
             {t('hover.noActiveWeather', 'No active weather data')}
           </div>
        )}
        <div className="hover-card-hint">{t('hover.clickInspect', 'Click to inspect')}</div>

      </div>
    )
  }

  // ── Lore / Item ──────────────────────────────────────────────────────────
  if (enriched.kind === 'lore' || enriched.kind === 'item') {
    return (
      <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
        <div className={`hover-card-type ${enriched.kind}`}>
          {enriched.kind === 'item' ? t('hover.item', 'Item') : t('hover.lore', 'Lore')}
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
        <div className="hover-card-hint">{t('hover.clickInspect', 'Click to inspect')}</div>

      </div>
    )
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  return (
    <div className="entity-hover-card" style={{ left: position.x, top: position.y }}>
      <div className={`hover-card-type ${data.entityType}`}>{data.entityType}</div>
      <div className="hover-card-name">{entity.name}</div>
      {entity.category && <div className="hover-card-detail">{entity.category}</div>}
      <div className="hover-card-hint">{t('hover.clickInspect', 'Click to inspect')}</div>

    </div>
  )
}
