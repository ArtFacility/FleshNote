import React from 'react'
import { useTranslation } from 'react-i18next'

export default function CustomCalendarPlanner() {
    const { t } = useTranslation()

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                width: '100%',
                backgroundColor: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                flexDirection: 'column',
                gap: '24px'
            }}
        >
            <h1
                style={{
                    fontSize: '48px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-amber)',
                    textTransform: 'uppercase',
                    letterSpacing: '4px',
                    textAlign: 'center',
                    margin: 0
                }}
            >
                COMING SOON
            </h1>
            <p
                style={{
                    maxWidth: '500px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6',
                    fontSize: '14px'
                }}
            >
                {t(
                    'calendar.comingSoon',
                    'The custom world time planner is currently under development. Soon you will be able to define custom months, seasons, and epochs for your world.'
                )}
            </p>
        </div>
    )
}
