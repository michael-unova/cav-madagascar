import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-ext-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/manrope/latin-ext-700.css'
import '@fontsource/manrope/latin-800.css'
import '@fontsource/manrope/latin-ext-800.css'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-ext-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-ext-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/dm-sans/latin-ext-600.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/dm-sans/latin-ext-700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ConfirmHost } from './components/ConfirmDialog'
import { AuthProvider } from './features/auth/AuthContext'
import { NotificationSoundProvider } from './features/sound'
import './index.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <NotificationSoundProvider>
        <App />
      <ConfirmHost />
      </NotificationSoundProvider>
    </AuthProvider>
  </StrictMode>,
)
