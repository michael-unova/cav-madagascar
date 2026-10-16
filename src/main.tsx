import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
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
