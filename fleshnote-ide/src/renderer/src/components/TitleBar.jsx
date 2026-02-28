import { useTranslation } from 'react-i18next'
import changelogData from '../changelog.json'
import ideIcon from '../assets/ide_icon.svg'

const Icons = {
    Feather: () => (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
            <line x1="16" y1="8" x2="2" y2="22" />
            <line x1="17.5" y1="15" x2="9" y2="15" />
        </svg>
    ),
    X: () => (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Maximize: () => (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
    )
}

export default function TitleBar({ projectName }) {
    const { t } = useTranslation()

    return (
        <div className="ide-titlebar">
            <div className="ide-titlebar-logo" style={{ direction: 'ltr' }}>
                <img src={ideIcon} alt="FleshNote Logo" style={{ width: 14, height: 16, objectFit: 'contain' }} />
                FLESHNOTE <span>v{changelogData.currentVersion}</span>
            </div>
            <div className="ide-titlebar-project">{projectName || ''}</div>
            <div className="ide-titlebar-actions">
                <button
                    className="ide-titlebar-btn"
                    onClick={() => window.api?.minimizeWindow?.()}
                    title={t('ide.minimize', 'Minimize')}
                >
                    <span style={{ width: 10, height: 1, background: 'currentColor', display: 'block' }} />
                </button>
                <button
                    className="ide-titlebar-btn"
                    onClick={() => window.api?.maximizeWindow?.()}
                    title={t('ide.maximize', 'Maximize')}
                >
                    <Icons.Maximize />
                </button>
                <button
                    className="ide-titlebar-btn"
                    onClick={() => window.api?.closeWindow?.()}
                    title={t('ide.close', 'Close')}
                >
                    <Icons.X />
                </button>
            </div>
        </div>
    )
}
