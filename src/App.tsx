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
import { paths } from './routes/paths'

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path={paths.home} element={<LandingPage />} />
        <Route path={paths.login} element={<LoginPage />} />
        <Route path={paths.register} element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path={paths.dashboard} element={<DashboardRedirect />} />
      <Route
        path={paths.dashboardStudent}
        element={
          <AppLayout role="student">
            <StudentDashboardPage />
          </AppLayout>
        }
      />
      <Route
        path={paths.dashboardTeacher}
        element={
          <AppLayout role="teacher">
            <TeacherDashboardPage />
          </AppLayout>
        }
      />
      <Route
        path={paths.dashboardAdmin}
        element={
          <AppLayout role="admin">
            <AdminDashboardPage />
          </AppLayout>
        }
      />
      <Route
        path={paths.profile}
        element={
          <AppLayout role="student">
            <ProfilePage />
          </AppLayout>
        }
      />
    </Routes>
  )
}

export default App
