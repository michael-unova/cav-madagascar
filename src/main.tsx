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
