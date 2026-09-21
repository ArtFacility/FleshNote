import { useTranslation } from 'react-i18next'
import ideIcon from '../../assets/ide_icon.svg'
import AnimatedWordmark from './AnimatedWordmark'
import changelogData from '../../changelog.json'

const Icons = {
  Folder: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Book: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  Phone: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  Eye: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Stack: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  Gear: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Info: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
}

export default function HomeRail({
  section,
  onSection,
  onCreate,
  onTutorial,
  onPhone,
  onSettings,
  onAbout,
  onChangelog,
  workspacePath,
}) {
  const { t } = useTranslation()

  return (
    <aside className="picker-rail">
      <div className="picker-rail-brand">
        <img
          src={ideIcon}
          width={Math.round(28 * 357 / 417)}
          height={28}
          alt=""
          aria-hidden="true"
        />
        <AnimatedWordmark />
      </div>

      <nav className="picker-nav">
        <div className="picker-nav-label">{t('picker.navWorkspace', 'Workspace')}</div>
        <button
          type="button"
          className={`picker-nav-item ${section === 'projects' ? 'active' : ''}`}
          onClick={() => onSection('projects')}
        >
          <Icons.Folder />
          {t('picker.navProjects', 'Projects')}
        </button>
        <button type="button" className="picker-nav-item" onClick={onCreate} disabled={!workspacePath}>
          <Icons.Plus />
          {t('picker.navCreate', 'Create new')}
        </button>
        <button type="button" className="picker-nav-item" onClick={onTutorial}>
          <Icons.Book />
          {t('picker.navTutorial', 'Tutorial')}
        </button>
        <button type="button" className="picker-nav-item" onClick={onPhone} disabled={!workspacePath}>
          <Icons.Phone />
          {t('picker.navPhone', 'From phone')}
        </button>

        <div className="picker-nav-label">{t('picker.navReview', 'Review')}</div>
        <button
          type="button"
          className={`picker-nav-item ${section === 'reviewer' ? 'active' : ''}`}
          onClick={() => onSection('reviewer')}
        >
          <Icons.Eye />
          {t('picker.navReviewer', 'Reviewer mode')}
        </button>
        <button
          type="button"
          className={`picker-nav-item ${section === 'collect' ? 'active' : ''}`}
          onClick={() => onSection('collect')}
        >
          <Icons.Stack />
          {t('picker.navCollect', 'Collect reviews')}
        </button>

        <div className="picker-nav-label">{t('picker.navApp', 'App')}</div>
        <button type="button" className="picker-nav-item" onClick={onSettings}>
          <Icons.Gear />
          {t('picker.settingsTitle', 'Settings')}
        </button>
        <button type="button" className="picker-nav-item" onClick={onAbout}>
          <Icons.Info />
          {t('picker.about', 'About')}
        </button>
      </nav>

      <div className="picker-rail-foot">
        <button type="button" className="picker-version-btn" onClick={onChangelog}>
          <span style={{ fontWeight: 700 }}>v{changelogData.currentVersion}</span>
          <span style={{ opacity: 0.7 }}>—</span>
          <span>{t('picker.whatsNew', "What's New?")}</span>
        </button>
      </div>
    </aside>
  )
}
