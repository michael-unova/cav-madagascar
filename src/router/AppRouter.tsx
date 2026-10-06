import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout } from '../layouts/PublicLayout'
import { PublicOnlyRoute, ProtectedRoute } from '../features/auth'
import { AdminRoute } from '../features/admin'
import { HomePage } from '../pages/HomePage'
import { CoursesPage } from '../pages/CoursesPage'
import { CourseDetailsPage } from '../pages/CourseDetailsPage'
import { AboutPage } from '../pages/AboutPage'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { DashboardPage } from '../pages/DashboardPage'
import { AdminLoginPage } from '../pages/AdminLoginPage'
import { AdminDashboardPage } from '../pages/AdminDashboardPage'
import { AdminCoursesPage } from '../pages/AdminCoursesPage'
import { AdminSubjectsPage } from '../pages/AdminSubjectsPage'
import { AdminUnauthorizedPage } from '../pages/AdminUnauthorizedPage'
import { AdminCurriculumPage } from '../pages/AdminCurriculumPage'
import { AdminContentPage } from '../pages/AdminContentPage'
import { AdminPaymentsPage } from '../pages/AdminPaymentsPage'
import { AdminQuestionsPage } from '../pages/AdminQuestionsPage'
import { AdminPsychotechnicalPage } from '../pages/AdminPsychotechnicalPage'
import { PsychotechnicalTestPage } from '../pages/PsychotechnicalTestPage'
import { AdminAnalyticsPage } from '../pages/AdminAnalyticsPage'
import { AdminUsersPage } from '../pages/AdminUsersPage'
import { EnrollmentPage } from '../pages/EnrollmentPage'
import { CourseLearningPage } from '../pages/CourseLearningPage'
import { PracticePage } from '../pages/PracticePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AccountSuspendedPage } from '../pages/AccountSuspendedPage'
import { LibraryPage } from '../pages/LibraryPage'
import { ResultsPage } from '../pages/ResultsPage'

export default function AppRouter() {
  return <Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/courses/:slug" element={<CourseDetailsPage />} />
      <Route path="/courses/:slug/enroll" element={<EnrollmentPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
      </Route>
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/courses" element={<AdminCoursesPage />} />
        <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
        <Route path="/admin/curriculum" element={<AdminCurriculumPage />} />
        <Route path="/admin/content" element={<AdminContentPage />} />
        <Route path="/admin/payments" element={<AdminPaymentsPage />} />
        <Route path="/admin/questions" element={<AdminQuestionsPage />} />
        <Route path="/admin/psychotechnical" element={<AdminPsychotechnicalPage />} />
        <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
      </Route>
      <Route path="/admin/unauthorized" element={<AdminUnauthorizedPage />} />
      <Route path="/account-suspended" element={<AccountSuspendedPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/courses/:courseRef/learn" element={<CourseLearningPage />} />
        <Route path="/practice/:setId" element={<PracticePage />} />
        <Route path="/psychotechnical/:testId" element={<PsychotechnicalTestPage />} />
      </Route>
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Route>
  </Routes>
}
