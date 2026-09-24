import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout } from '../layouts/PublicLayout'
import { HomePage } from '../pages/HomePage'
import { CoursesPage } from '../pages/CoursesPage'
import { AboutPage } from '../pages/AboutPage'
import { AuthPlaceholderPage } from '../pages/AuthPlaceholderPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<AuthPlaceholderPage mode="login" />} />
        <Route path="/register" element={<AuthPlaceholderPage mode="register" />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  )
}
