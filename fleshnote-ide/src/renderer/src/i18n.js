import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Custom IPC backend plugin to load locales from the main process
const ipcBackend = {
    type: 'backend',
    read: async (language, namespace, callback) => {
        try {
            const translations = await window.api.loadTranslations(language)
            callback(null, translations)
        } catch (error) {
            callback(error, null)
        }
    }
}

i18n
    .use(ipcBackend)
    .use(initReactI18next)
    .init({
        lng: 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false // React already escapes by default
        }
    })

export default i18n
