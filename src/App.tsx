import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout/PublicLayout'
import { AppLayout } from './layouts/AppLayout/AppLayout'
import { LandingPage } from './pages/LandingPage/LandingPage'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { RegisterPage } from './pages/RegisterPage/RegisterPage'
import { ProfilePage } from './pages/ProfilePage/ProfilePage'
import { NotFoundPage } from './pages/NotFoundPage/NotFoundPage'
import { DashboardRedirect } from './pages/dashboards/DashboardRedirect'
import { StudentDashboardPage } from './pages/dashboards/StudentDashboardPage'
import { TeacherDashboardPage } from './pages/dashboards/TeacherDashboardPage'
import { AdminDashboardPage } from './pages/dashboards/AdminDashboardPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { PublicOnlyRoute } from './features/auth/PublicOnlyRoute'
import { paths } from './routes/paths'

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path={paths.home} element={<LandingPage />} />
        <Route
          path={paths.login}
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path={paths.register}
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        path={paths.dashboard}
        element={
          <ProtectedRoute>
            <DashboardRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path={paths.dashboardStudent}
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <AppLayout>
              <StudentDashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={paths.dashboardTeacher}
        element={
          <ProtectedRoute allowedRoles={['teacher']}>
            <AppLayout>
              <TeacherDashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={paths.dashboardAdmin}
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AppLayout>
              <AdminDashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path={paths.profile}
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProfilePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
