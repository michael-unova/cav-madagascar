import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useAuth } from "./features/auth";
import { updateUserProfile } from "./features/auth";
import {
  RichLessonEditor,
  sanitizeLessonHtml,
} from "./components/RichLessonEditor";
import {
  getAuthErrorMessage,
  loginUser,
  loginWithGoogle,
  logoutUser,
  registerUser,
  resetPassword,
} from "./features/auth";
import {
  listPublishedCourses,
  listPublishedCourseSubjects,
  listPublishedCourseGroups,
} from "./features/courses";
import {
  createCourse,
  deleteCourse,
  listAdminCourses,
  updateCourse,
  syncPublishedCourseSubjectLinks,
  createCourseGroup,
  listAdminCourseGroups,
  updateCourseGroup,
  deleteCourseGroup,
  createSubject,
  deleteSubject,
  getSubjectDependencies,
  listAdminSubjects,
  updateSubject,
  listAdminUsers,
} from "./features/admin/adminRepository";
import {
  attachSubject,
  deleteCourseSubject,
  listCourseSubjects,
  listCourseSubjectsBySubjectId,
  listContentBlocks,
  listSubjectContentNodes,
  listSharedContentNodes,
  getStudentLessonContent,
  countPublishedCourseLessons,
  createSharedContentBlock,
  createSharedContentNode,
  deleteSharedContentNode,
  updateSharedContentBlock,
  updateSharedContentNode,
} from "./features/curriculum";
import {
  getEnrollment,
  listMyEnrollments,
  listPendingPayments,
  listAllPayments,
  reviewPayment,
  submitPayment,
} from "./features/enrollment";
import {
  createQuestion,
  createQuestionSet,
  deleteQuestion,
  deleteQuestionSet,
  listAdminQuestionSets,
  listAdminQuestions,
  listPublishedQuestionsForLesson,
  listMyPracticeAttempts,
  updateQuestion,
  updateQuestionSetStatus,
} from "./features/questions";
import { getCourseProgressSummary, getNodeProgress, listMyProgress, saveNodeProgress } from "./features/progress";
import { createContactMessage } from "./features/contact";
// Keep secondary screens out of the initial bundle. They are downloaded only
// when the user opens the corresponding page.
const AdminMessagesPage = lazy(() => import("./pages/AdminMessagesPage").then((module) => ({ default: module.AdminMessagesPage })));
const AdminBroadcastsPage = lazy(() => import("./pages/AdminBroadcastsPage").then((module) => ({ default: module.AdminBroadcastsPage })));
const AdminLessonQuestionsPage = lazy(() => import("./pages/AdminLessonQuestionsPage").then((module) => ({ default: module.AdminLessonQuestionsPage })));
const AdminPsychotechnicalPage = lazy(() => import("./pages/AdminPsychotechnicalPage").then((module) => ({ default: module.AdminPsychotechnicalPage })));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage").then((module) => ({ default: module.AdminAnalyticsPage })));
const AdminBillingPage = lazy(() => import("./pages/AdminBillingPage").then((module) => ({ default: module.AdminBillingPage })));
const LibraryPage = lazy(() => import("./pages/LibraryPage").then((module) => ({ default: module.LibraryPage })));
const AdminLibraryPage = lazy(() => import("./pages/AdminLibraryPage").then((module) => ({ default: module.AdminLibraryPage })));
const AuthActionPage = lazy(() => import("./pages/AuthActionPage").then((module) => ({ default: module.AuthActionPage })));
import { SoundSettingsCard } from "./features/sound";
import { markNotificationRead, subscribeMyNotifications, subscribeUnreadLessonCommentCount } from "./features/lessonComments";
import type { Enrollment, Payment } from "./types/enrollment";
import type { Course, CourseCardColor, CourseGroup, CourseSubject } from "./types/course";
import { courseIllustration } from "./components/CourseIllustration";
import { LegacyPlatformNotice } from "./components/LegacyPlatformNotice";
import { ContentProtection } from "./components/ContentProtection";
import { SessionReplacedNotice } from "./components/SessionReplacedNotice";
import type {
  ContentBlock,
  ContentNode,
  ContentNodeType,
  ContentNumberingStyle,
} from "./types/content";
import type { Subject } from "./types/subject";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "./lib/firebase/storage";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where, writeBatch } from "firebase/firestore";
import { getFirebaseFirestore } from "./lib/firebase/firestore";
import type { LessonComment, LessonCommentCategory } from "./types/lessonComment";
import type { LessonNotification } from "./features/lessonComments/lessonCommentRepository";
import { buildQuestionStatuses, collectCommentThreadIds, createLessonComment, deleteLessonComment, deleteLessonCommentThread, subscribeLessonComments, subscribeLessonCommentLoves, toggleLessonCommentLove, updateLessonComment, replyToLessonComment } from "./features/lessonComments";
import type {
  PracticeAttempt,
  Question,
  QuestionOption,
  QuestionSet,
  QuestionType,
} from "./types/question";
import { confirmAction } from "./components/ConfirmDialog";
import { ContentEditIcon, EyeIcon, PencilIcon } from "./components/ActionIcons";
import { sortAlphabetically, sortNewestFirst } from "./features/admin/userSorting";
import { isRecentVisit, markVisit } from "./lib/recentVisit";
import { callableErrorMessage } from "./lib/firebase/callableError";

type Role = "visitor" | "student" | "admin" | "teacher";

// Menu items are real links (/?page=<id>) so "Open in new tab" works. A plain click keeps the
// in-app navigation; Ctrl/Cmd/Shift/middle-click and the right-click menu use the link.
const NAV_PAGE_PARAM = "page";
const navPageHref = (id: string) => `/?${NAV_PAGE_PARAM}=${encodeURIComponent(id)}`;
function onNavLinkClick(event: ReactMouseEvent<HTMLAnchorElement>, go: () => void) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  go();
}
// Pages that can be opened directly from a link, per role.
const STUDENT_LINK_PAGES = ["dashboard", "concours", "catalog", "results", "library", "profile"];
const ADMIN_LINK_PAGES = ["overview", "courses", "subjects", "enrollments", "users", "studentQuestions", "broadcasts", "library", "psychotechnical", "stats", "messages", "billing", "profile"];
type StudentPage =
  | "dashboard"
  | "concours"
  | "catalog"
  | "course"
  | "practice"
  | "results"
  | "profile"
  | "library"
  | "enroll";
type AdminPage =
  | "overview"
  | "courses"
  | "subjects"
  | "content"
  | "questions"
  | "enrollments"
  | "users"
  | "stats"
  | "messages"
  | "broadcasts"
  | "studentQuestions"
  | "lessonPreview"
  | "psychotechnical"
  | "library"
  | "profile"
  | "billing";

type CavHistoryState = {
  __cavHistory: true;
  index: number;
  role: Role;
  publicPage: string;
  studentPage: StudentPage;
  adminPage: AdminPage;
  selectedCourseId: string | null;
  notificationLessonId: string | null;
  notificationCommentId: string | null;
  selectedAdminSubjectId: string | null;
  selectedAdminNodeId: string | null;
  adminPreviewCourseId: string | null;
  adminPreviewCommentId: string | null;
};

type CourseView = Course & {
  category: string;
  students: number;
  lessons: number;
  progress: number;
  color: string;
  subjects: CourseSubject[];
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function isEnrollmentCurrentlyActive(enrollment?: Enrollment | null) {
  if (!enrollment || enrollment.status !== "active") return false;
  return !enrollment.expiresAt || enrollment.expiresAt.getTime() > Date.now();
}

const COURSE_COLORS: CourseCardColor[] = ["blue", "purple", "green", "orange", "red", "teal", "indigo", "pink", "amber", "cyan", "slate", "rose"];

const DEFAULT_UNGROUPED_COURSE_GRADIENT = "linear-gradient(135deg, #173b68, #28577f)";

const courseCoverGradients: Record<CourseCardColor, string> = {
  blue: "linear-gradient(135deg, #1769d2, #3d8df5)",
  purple: "linear-gradient(135deg, #6f42c1, #9b6de3)",
  green: "linear-gradient(135deg, #16855d, #35b982)",
  orange: "linear-gradient(135deg, #d97706, #f59e0b)",
  red: "linear-gradient(135deg, #c63d4f, #ef6b78)",
  teal: "linear-gradient(135deg, #087f8c, #20b8aa)",
  indigo: "linear-gradient(135deg, #4338ca, #6366f1)",
  pink: "linear-gradient(135deg, #be185d, #ec4899)",
  amber: "linear-gradient(135deg, #b45309, #f59e0b)",
  cyan: "linear-gradient(135deg, #0e7490, #06b6d4)",
  slate: "linear-gradient(135deg, #334155, #64748b)",
  rose: "linear-gradient(135deg, #be123c, #fb7185)",
};

function courseCoverStyle(color: CourseCardColor): React.CSSProperties {
  return { background: courseCoverGradients[color] };
}

function courseColorHex(color: CourseCardColor): string {
  const colors: Record<CourseCardColor, string> = { blue: "#2f80ed", purple: "#7c4dce", green: "#24a36f", orange: "#e78b12", red: "#d94b61", teal: "#16a6a0", indigo: "#5b5bd6", pink: "#d94b9b", amber: "#d99519", cyan: "#159fba", slate: "#64748b", rose: "#e15a73" };
  return colors[color];
}

async function loadCourseViews(
  source: "public" | "admin",
): Promise<CourseView[]> {
  const sourceCourses =
    source === "admin"
      ? await listAdminCourses()
      : await listPublishedCourses();
  if (source === "admin") await syncPublishedCourseSubjectLinks();
  return Promise.all(
    sourceCourses.map(async (course) => {
      try {
        const subjects =
          source === "admin"
            ? await listCourseSubjects(course.id, false)
            : await listPublishedCourseSubjects(course.id);
        let lessons = 0;
        try {
          lessons = source === "public"
            ? await countPublishedCourseLessons(course.id, subjects)
            : (await Promise.all(
                subjects.map((subject) => listSubjectContentNodes(subject.subjectId, false)),
              )).reduce((total, subjectNodes) => {
                const children = subjectNodes.filter((node) => Boolean(node.parentId));
                return total + (children.length ? children.length : subjectNodes.filter((node) => node.type !== "topic").length);
              }, 0);
        } catch (error) {
          console.warn(`Impossible de compter les leçons du concours ${course.id}`, error);
        }
        return {
          ...course,
          category: "Préparation aux concours",
          students: 0,
          lessons,
          progress: 0,
          color: course.cardColor,
          subjects,
        };
      } catch (error) {
        console.warn(`Impossible de charger le contenu du concours ${course.id}`, error);
        return {
          ...course,
          category: "Préparation aux concours",
          students: 0,
          lessons: 0,
          progress: 0,
          color: course.cardColor,
          subjects: [],
        };
      }
    }),
  );
}

async function loadPublishedCourses(): Promise<CourseView[]> {
  return loadCourseViews("public");
}

async function loadAdminCourses(): Promise<CourseView[]> {
  return loadCourseViews("admin");
}

function GoogleLogo() {
  return (
    <svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.15c1.85-1.7 2.9-4.2 2.9-7.42z"/>
      <path fill="#34A853" d="M12 22c2.65 0 4.87-.88 6.5-2.38l-3.15-2.45c-.87.58-1.98.93-3.35.93-2.57 0-4.75-1.74-5.52-4.07H3.23v2.52A9.82 9.82 0 0 0 12 22z"/>
      <path fill="#FBBC05" d="M6.48 14.03A5.99 5.99 0 0 1 6.17 12c0-.7.12-1.38.31-2.03V7.45H3.23A10 10 0 0 0 2 12c0 1.61.39 3.13 1.23 4.55l3.25-2.52z"/>
      <path fill="#EA4335" d="M12 5.91c1.45 0 2.75.5 3.77 1.48l2.82-2.82C16.86 2.98 14.64 2 12 2a9.82 9.82 0 0 0-8.77 5.45l3.25 2.52C7.25 7.65 9.43 5.91 12 5.91z"/>
    </svg>
  );
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/><path d="M8 11h8M8 15h5"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>,
    headphones: <><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="2" y="13" width="4" height="7" rx="2"/><rect x="18" y="13" width="4" height="7" rx="2"/><path d="M18 20a6 6 0 0 1-6 2h-1"/></>,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
        <path d="M4 5.5v16" />
        <path d="M8 7h8M8 11h8" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        <path d="m4 7 6-4 6 5 6-6" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V22h-2.4v-.2a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.46 17a1.7 1.7 0 0 0-1.56-1.03H6.7v-2.4h.2A1.7 1.7 0 0 0 8.46 12a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06A1.7 1.7 0 0 0 11.97 7.3V7h2.4v.2a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06A1.7 1.7 0 0 0 19.4 12a1.7 1.7 0 0 0 1.56 1.03h.2v2.4h-.2A1.7 1.7 0 0 0 19.4 15z" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="8" height="6" rx="1" />
        <rect x="14" y="3" width="7" height="10" rx="1" />
        <rect x="3" y="12" width="8" height="9" rx="1" />
        <rect x="14" y="16" width="7" height="5" rx="1" />
      </>
    ),
    graduation: (
      <>
        <path d="m2 9 10-5 10 5-10 5L2 9Z" />
        <path d="M6 11v5c3.5 2.5 8.5 2.5 12 0v-5M22 9v6" />
      </>
    ),
    bookOpen: (
      <>
        <path d="M12 6.5C9.5 4.5 6 4 3 5v14c3-.8 6.5-.3 9 1.5 2.5-1.8 6-2.3 9-1.5V5c-3-1-6.5-.5-9 1.5Z" />
        <path d="M12 7v13.5" />
      </>
    ),
    clipboardCheck: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4.5V3h6v1.5M8 12l2.5 2.5L16 9" />
      </>
    ),
    contact: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20v-1.5A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5V20M17 5.5a3.5 3.5 0 0 1 0 6.8M18 15h1a3 3 0 0 1 3 3v2" />
      </>
    ),
    question: (
      <>
        <path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-5 2 1.5-4A7.5 7.5 0 1 1 21 11.5Z" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.6 1.2-1.6 2.6M12 16.5h.01" />
      </>
    ),
    megaphone: (
      <>
        <path d="m3 11 14-6v14L3 13v-2Z" />
        <path d="M7 14l2 6h4l-2.5-4.5M20 9l2-2M20 15l2 2" />
      </>
    ),
    library: (
      <>
        <path d="M3 6 7 3l4 3v15H3V6ZM13 5l4-2 4 2v16h-8V5Z" />
        <path d="M5.5 9h3M5.5 13h3M15.5 8h3M15.5 12h3" />
      </>
    ),
    brain: (
      <>
        <path d="M12 5.5a4 4 0 0 0-7-2.5 4.5 4.5 0 0 0-1 7.5 4 4 0 0 0 2 6.5A4 4 0 0 0 12 20V5.5Z" />
        <path d="M12 5.5a4 4 0 0 1 7-2.5 4.5 4.5 0 0 1 1 7.5 4 4 0 0 1-2 6.5A4 4 0 0 1 12 20M7 7l2 2m-3 4 3-1m8-5-2 2m3 4-3-1" />
      </>
    ),
    cloud: <path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11-1.5A4.8 4.8 0 0 0 7 18Z" />,
    sliders: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
        <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
      </>
    ),
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    play: <path d="m9 6 10 6-10 6z" />,
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? paths.grid}
    </svg>
  );
}

function Logo() {
  return (
    <button className="brand-logo" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="CAV Madagascar">
      <img src="/assets/cav-logo.webp" alt="CAV Madagascar" />
    </button>
  );
}


function PublicFooter() {
  return (
    <footer className="public-footer cav-public-footer">
      <div className="cav-footer-brand">
        <Logo />
        <span>© 2026 CAV Madagascar. Préparation aux concours.</span>
      </div>
      <div className="cav-footer-contact">
        <a className="cav-footer-facebook" href="https://web.facebook.com/profile.php?id=100065575115845" target="_blank" rel="noreferrer" aria-label="Suivre CAV Madagascar sur Facebook">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.4 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.2v3.2H10V21h3.4z"/></svg>
          <span>Nous suivre sur Facebook</span><span className="cav-footer-external" aria-hidden="true">↗</span>
        </a>
        <div className="cav-footer-address">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5a7 7 0 0 0-7 7c0 5.1 7 12 7 12s7-6.9 7-12a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
          <span className="cav-footer-address-lines">IVB 33 Ter Ambatomitsangana<br />En Face Look's 3e etage.</span>
        </div>
        <a className="cav-footer-privacy" href="/privacy-policy">Politique de confidentialité</a>
      </div>
    </footer>
  );
}

function PublicNavbar({ go, active }: { go: (p: string) => void; active?: "home" | "catalog" | "how" | "about" | "contact" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = (page: string) => {
    setMobileMenuOpen(false);
    go(page);
  };

  return (
    <header className={`public-nav public-logged-out-nav${mobileMenuOpen ? " mobile-menu-open" : ""}`}>
      <Logo />
      <button
        className="public-mobile-menu-toggle"
        type="button"
        aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={mobileMenuOpen}
        aria-controls="public-mobile-navigation"
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span /><span /><span />
      </button>
      <nav id="public-mobile-navigation" aria-label="Navigation principale">
        <button className={active === "home" ? "active" : ""} onClick={() => navigate("home")}>Accueil</button>
        <button className={active === "catalog" ? "active" : ""} onClick={() => navigate("catalog")}>Concours</button>
        <button className={active === "how" ? "active" : ""} onClick={() => navigate("how")}>Comment ça marche</button>
        <button className={active === "about" ? "active" : ""} onClick={() => navigate("about")}>À propos</button>
        <button className={active === "contact" ? "active" : ""} onClick={() => navigate("contact")}>Contact</button>
        <div className="public-mobile-menu-actions">
          <button className="link-button" onClick={() => navigate("login")}>Se connecter</button>
          <button className="primary" onClick={() => navigate("register")}>Créer un compte</button>
        </div>
      </nav>
      <div className="public-actions">
        <button className="link-button" onClick={() => navigate("login")}>Se connecter</button>
        <button className="primary" onClick={() => navigate("register")}>Créer un compte</button>
      </div>
    </header>
  );
}

function PublicHome({
  go,
  courses,
  loading,
}: {
  go: (p: string) => void;
  courses: CourseView[];
  loading: boolean;
}) {
  return (
    <div className="public-shell">
      <PublicNavbar go={go} active="home" />
      <main>
        <LegacyPlatformNotice />
        <section className="landing-hero cav-responsive-landing-hero">
          <div className="landing-copy">
            <span className="pill blue-pill">PRÉPARATION AUX CONCOURS</span>
            <h1>
              Préparez votre concours avec <em>CAV.</em>
            </h1>
            <p>
              Une plateforme pensée pour vous accompagner de la première leçon
              jusqu'au jour du concours, avec des cours structurés, des
              entraînements et un suivi de progression.
            </p>
            <div className="landing-actions">
              <button className="primary" onClick={() => go("catalog")}>
                Découvrir les concours <Icon name="arrow" />
              </button>
              <button className="outline" onClick={() => go("how")}>
                Comment ça marche
              </button>
            </div>
            <div className="trust-row">
              <span>✓ Cours structurés</span>
              <span>✓ Entraînements</span>
              <span>✓ Progression suivie</span>
            </div>
          </div>
          <div className="hero-visual cav-responsive-hero-visual">
            <img
              className="cav-responsive-student-photo"
              src="/assets/cav-home-student.webp"
              alt="Une étudiante malgache concentrée sur ses révisions"
              fetchPriority="high"
            />
            <div className="cav-responsive-preparation-pill" aria-live="polite">
              <span className="cav-responsive-pill-icon" aria-hidden="true"><Icon name="book" /></span>
              <span>{loading ? "Préparations disponibles" : `${courses.length} préparation${courses.length > 1 ? "s" : ""} disponible${courses.length > 1 ? "s" : ""}`}</span>
            </div>
          </div>
        </section>
        <section className="landing-section">
          <div className="landing-section-head">
            <div>
              <div className="eyebrow">NOS PRÉPARATIONS</div>
              <h2>Choisissez votre concours</h2>
              <p>
                Des parcours organisés par concours, avec des matières et
                contenus adaptés à chaque préparation.
              </p>
            </div>
            <button className="link-button" onClick={() => go("catalog")}>
              Voir tous les concours →
            </button>
          </div>
          {courses.length ? (
            <div className="course-grid">
              {courses.slice(0, 3).map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  onOpen={() => go(`preview:${c.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="panel empty-state">
              <h3>Aucune préparation publiée pour le moment.</h3>
              <p>
                Les préparations publiées par l'administration apparaîtront ici.
              </p>
            </div>
          )}
        </section>
        <section className="products-showcase">
          <div className="products-copy">
            <div className="eyebrow">NOS PRODUITS</div>
            <h2>Des contenus complets <span>pour votre réussite</span></h2>
            <p>
              CAV propose une pédagogie innovante, des supports de cours riches et diversifiés
              ainsi que des exercices-types de concours (QCM, dissertation...).
            </p>
            <div className="products-grid">
              <article className="product-card product-video">
                <div className="product-icon"><Icon name="play" /></div>
                <div><h3>Des leçons vidéo/audio</h3><p>Des cours accessibles et structurés pour apprendre à votre rythme.</p></div>
              </article>
              <article className="product-card product-notes">
                <div className="product-icon"><Icon name="file" /></div>
                <div><h3>Des supports de cours écrits</h3><p>Des ressources claires pour réviser et approfondir chaque notion.</p></div>
              </article>
              <article className="product-card product-subjects">
                <div className="product-icon"><Icon name="file" /></div>
                <div><h3>Des sujets types traités</h3><p>QCM, dissertations et exercices pour vous entraîner dans les conditions du concours.</p></div>
              </article>
              <article className="product-card product-library">
                <div className="product-icon"><Icon name="book" /></div>
                <div><h3>Une bibliothèque virtuelle</h3><p>Un espace de ressources pour compléter votre préparation.</p></div>
              </article>
            </div>
          </div>
          <div className="products-visual">
            <div className="products-image-wrap">
              <img src="/assets/cav-learning.webp" alt="Apprenant en train de travailler sur une préparation CAV Madagascar" loading="lazy" decoding="async" />
              <div className="products-badge"><Icon name="play" /><span>Apprendre efficacement<br /><strong>où que vous soyez</strong></span></div>
            </div>
          </div>
        </section>
        <section className="feature-band">
          <div>
            <div className="eyebrow">UNE PRÉPARATION STRUCTURÉE</div>
            <h2>Tout ce dont vous avez besoin pour progresser.</h2>
          </div>
          <div className="feature-grid">
            <div>
              <Icon name="book" />
              <h3>Cours riches</h3>
              <p>
                Texte, vidéo, images et ressources organisés dans chaque leçon.
              </p>
            </div>
            <div>
              <Icon name="check" />
              <h3>Entraînez-vous</h3>
              <p>Questions et exercices pour vérifier vos connaissances.</p>
            </div>
            <div>
              <Icon name="chart" />
              <h3>Suivez vos progrès</h3>
              <p>Visualisez votre progression et vos résultats.</p>
            </div>
          </div>
        </section>
        <section className="landing-cta">
          <div>
            <div className="eyebrow">COMMENCEZ AUJOURD'HUI</div>
            <h2>Votre prochaine étape commence ici.</h2>
            <p>Découvrez les préparations disponibles sur CAV Madagascar.</p>
          </div>
          <button className="primary" onClick={() => go("catalog")}>
            Voir les concours <Icon name="arrow" />
          </button>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function AuthPage({
  mode,
  go,
}: {
  mode: "login" | "register";
  go: (p: string) => void;
}) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (user) go("dashboard");
  }, [user, go]);

  function clearMessages() {
    setError("");
    setNotice("");
  }

  async function submit() {
    clearMessages();
    if (
      !email.trim() ||
      !password ||
      (mode === "register" && (!firstName.trim() || !lastName.trim() || !phone.trim()))
    ) {
      setError("Veuillez renseigner tous les champs obligatoires.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "login") {
        await loginUser(email, password);
      } else {
        await registerUser(
          `${firstName.trim()} ${lastName.trim()}`,
          email,
          password,
          phone,
        );
      }
      go("dashboard");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    clearMessages();
    setGoogleSubmitting(true);
    try {
      const signedIn = await loginWithGoogle();
      // null = popup was blocked and the page is redirecting to Google.
      if (signedIn) go("dashboard");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function sendResetLink() {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Saisissez votre adresse e-mail pour recevoir le lien.");
      return;
    }
    setResetting(true);
    try {
      await resetPassword(email);
      setNotice("Si un compte correspond à cette adresse, un e-mail de réinitialisation vient d’être envoyé. Pensez à vérifier vos courriers indésirables.");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-brand" aria-label="CAV Madagascar">
        <div className="auth-brand-logo">
          <Logo />
        </div>
        <div className="auth-brand-content">
          <span className="auth-brand-eyebrow">COURS D'APPUI VIRTUEL</span>
          <h2>Préparez votre concours avec méthode.</h2>
          <p>
            Retrouvez vos cours, entraînements et votre progression dans un seul espace,
            pensé pour votre réussite.
          </p>
          <div className="auth-benefits">
            <div><span>✓</span> Cours structurés et accessibles</div>
            <div><span>✓</span> Entraînements pour progresser</div>
            <div><span>✓</span> Suivi de votre préparation</div>
          </div>
        </div>
        <div className="auth-brand-orb auth-brand-orb-one" />
        <div className="auth-brand-orb auth-brand-orb-two" />
        <p className="auth-brand-footer">CAV Madagascar · Votre préparation, partout avec vous.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-single-brand">
          <button className="auth-single-logo" onClick={() => go("home")} aria-label="Retour à l'accueil">
            <Logo />
          </button>
        </div>
        <div className="auth-panel-inner auth-modern-card">
          <button className="back auth-back" onClick={() => go("home")}>
            ← Retour à l'accueil
          </button>

          {showForgot && mode === "login" ? (
            <>
              <div className="auth-heading">
                <span className="eyebrow">MOT DE PASSE</span>
                <h1>Réinitialisez votre mot de passe.</h1>
                <p>Entrez votre adresse e-mail et nous vous enverrons un lien sécurisé.</p>
              </div>

              {error && <div className="form-error auth-message" role="alert">{error}</div>}
              {notice && <div className="form-success auth-message" role="status">{notice}</div>}

              <label>
                Adresse e-mail
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  autoFocus
                />
              </label>

              <button className="primary full auth-submit" disabled={resetting} onClick={() => void sendResetLink()}>
                {resetting ? "Envoi en cours..." : "Envoyer le lien"}
                <Icon name="arrow" />
              </button>

              <button className="auth-secondary-link" onClick={() => { clearMessages(); setShowForgot(false); }}>
                ← Retour à la connexion
              </button>
            </>
          ) : (
            <>
              <div className="auth-heading">
                <span className="eyebrow">{mode === "login" ? "ESPACE ÉTUDIANT" : "INSCRIPTION"}</span>
                <h1>{mode === "login" ? "Bienvenue sur CAV." : "Créez votre compte."}</h1>
                <p>
                  {mode === "login"
                    ? "Connectez-vous pour retrouver vos préparations et votre progression."
                    : "Rejoignez CAV Madagascar et commencez votre préparation."}
                </p>
              </div>

              {error && <div className="form-error auth-message" role="alert">{error}</div>}
              {notice && <div className="form-success auth-message" role="status">{notice}</div>}

              <button className="google-button" disabled={googleSubmitting || submitting} onClick={() => void continueWithGoogle()}>
                <GoogleLogo />
                <span>{googleSubmitting ? "Connexion avec Google..." : "Continuer avec Google"}</span>
              </button>

              <div className="auth-divider"><span>ou</span></div>

              <form
                className="auth-credentials-form"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  if (!submitting && !googleSubmitting) void submit();
                }}
              >
              {mode === "register" && (
                <div className="auth-two">
                  <label>
                    Prénom
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Votre prénom"
                      autoComplete="given-name"
                    />
                  </label>
                  <label>
                    Nom
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Votre nom"
                      autoComplete="family-name"
                    />
                  </label>
                </div>
              )}

              {mode === "register" ? (
                <div className="auth-two auth-contact-two">
                  <label>
                    Téléphone
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+261 ..."
                      autoComplete="tel"
                    />
                  </label>
                  <label>
                    Adresse e-mail
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      autoComplete="email"
                    />
                  </label>
                </div>
              ) : (
                <label>
                  Adresse e-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    autoComplete="email"
                  />
                </label>
              )}

              <label>
                Mot de passe
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </label>

              {mode === "login" && (
                <div className="forgot auth-forgot">
                  <button type="button" onClick={() => { clearMessages(); setShowForgot(true); }}>Mot de passe oublié ?</button>
                </div>
              )}

              <button type="submit" className="primary full auth-submit" disabled={submitting || googleSubmitting}>
                {submitting
                  ? mode === "login" ? "Connexion..." : "Création..."
                  : mode === "login" ? "Se connecter" : "Créer mon compte"}
                <Icon name="arrow" />
              </button>
              </form>

              <div className="auth-switch">
                {mode === "login" ? (
                  <>Vous n'avez pas encore de compte ? <button onClick={() => go("register")}>Créer un compte</button></>
                ) : (
                  <>Vous avez déjà un compte ? <button onClick={() => go("login")}>Se connecter</button></>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function PublicCatalog({
  go,
  courses,
  groups,
}: {
  go: (p: string) => void;
  courses: CourseView[];
  groups: CourseGroup[];
}) {
  const [tab, setTab] = useState<"groups" | "all">(groups.length ? "groups" : "all");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("fr-FR");
  const searchedCourses = courses.filter(course => !normalizedSearch || course.title.toLocaleLowerCase("fr-FR").includes(normalizedSearch));
  useEffect(() => {
    if (!groups.length && tab === "groups") setTab("all");
  }, [groups.length, tab]);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const visibleCourses = selectedGroupId ? searchedCourses.filter((course) => course.groupId === selectedGroupId) : searchedCourses;
  return (
    <div className="public-shell">
      <PublicNavbar go={go} active="catalog" />
      <div className="page public-page">
        <div className="page-title">
          <div>
            <div className="eyebrow">CATALOGUE</div>
            <h1>Préparations aux concours</h1>
            <p>
              Découvrez les parcours disponibles et choisissez celui qui
              correspond à votre objectif.
            </p>
          </div>
        </div>
        <div className="catalog-toolbar"><div className="catalog-search"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un concours…" aria-label="Rechercher un concours" /><span>{normalizedSearch ? `${searchedCourses.length} résultat${searchedCourses.length > 1 ? "s" : ""}` : `${courses.length} concours`}</span></div><div className="catalog-tabs"><button className={tab === "groups" && !normalizedSearch ? "active" : ""} onClick={() => { setTab("groups"); setSelectedGroupId(null); }}>Groupements</button><button className={tab === "all" || Boolean(normalizedSearch) ? "active" : ""} onClick={() => { setTab("all"); setSelectedGroupId(null); }}>Tous les concours</button></div></div>
        {selectedGroup ? (
          <div><button className="back-link catalog-back-button" onClick={() => setSelectedGroupId(null)}>← Tous les groupements</button><div className="group-hero" style={courseCoverStyle(selectedGroup.cardColor)}><div><span>GROUPEMENT</span><h2>{selectedGroup.title}</h2><p>{selectedGroup.description}</p></div><strong>{visibleCourses.length} concours</strong></div><div className="course-grid">{visibleCourses.map((c) => <article className="course-card catalog-card" key={c.id}><div className={`course-cover ${c.color}`} style={courseCoverStyle(selectedGroup.cardColor)}><span>{c.category}</span><b>{c.title}</b><div className="cover-icon"><Icon name="book" /></div></div><div className="card-body"><h3>{c.title}</h3><p>{c.lessons} leçons · préparation structurée</p><div className="catalog-price"><strong>{formatPrice(c.price)} Ar</strong><span>accès complet</span></div><button className="primary full" onClick={() => go(`preview:${c.id}`)}>Voir la préparation <Icon name="arrow" /></button></div></article>)}</div></div>
        ) : tab === "groups" && !normalizedSearch ? (
          groups.length ? <div className="course-grid">{groups.map((group) => { const children = courses.filter((course) => course.groupId === group.id); return <article className="course-card catalog-card group-card" key={group.id} onClick={() => setSelectedGroupId(group.id)}><div className={`course-cover ${group.cardColor}`} style={courseCoverStyle(group.cardColor)}><span>GROUPEMENT</span><b>{group.title}</b><div className="cover-icon"><Icon name="grid" /></div></div><div className="card-body"><h3>{group.title}</h3><p>{group.description || "Découvrez les concours de ce groupement."}</p><div className="group-child-list">{children.slice(0, 4).map((child) => <span key={child.id}>{child.title}</span>)}{children.length > 4 && <span>+ {children.length - 4} autres</span>}</div><button className="primary full">Voir les concours <Icon name="arrow" /></button></div></article>})}</div> : <div className="panel empty-state"><h3>Aucun groupement publié.</h3><p>Consultez tous les concours pour trouver directement votre préparation.</p></div>
        ) : (
          visibleCourses.length ? <div className="course-grid">{visibleCourses.map((c) => <article className="course-card catalog-card" key={c.id}><div className={`course-cover ${c.color}`} style={{ background: DEFAULT_UNGROUPED_COURSE_GRADIENT }}><span>{c.category}</span><b>{c.title}</b><div className="cover-icon"><Icon name="book" /></div></div><div className="card-body"><h3>{c.title}</h3><p>{c.lessons} leçons · préparation structurée</p><div className="catalog-price"><strong>{formatPrice(c.price)} Ar</strong><span>accès complet</span></div><button className="primary full" onClick={() => go(`preview:${c.id}`)}>Voir la préparation <Icon name="arrow" /></button></div></article>)}</div> : <div className="panel empty-state"><h3>Aucune préparation publiée pour le moment.</h3><p>Les prochaines préparations apparaîtront ici.</p></div>
        )}
      </div>
    </div>
  );
}

function StudentCatalog({
  courses,
  groups,
  myEnrollments,
  setCourse,
}: {
  courses: CourseView[];
  groups: CourseGroup[];
  myEnrollments: Enrollment[];
  setCourse: (courseId: string, page: StudentPage) => void;
}) {
  const [tab, setTab] = useState<"groups" | "all">(groups.length ? "groups" : "all");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState(() => {
    const stored = localStorage.getItem("cav_student_catalog_search") ?? "";
    localStorage.removeItem("cav_student_catalog_search");
    return stored;
  });
  const normalizedSearch = search.trim().toLocaleLowerCase("fr-FR");
  const searchedCourses = courses.filter(course => !normalizedSearch || course.title.toLocaleLowerCase("fr-FR").includes(normalizedSearch));
  useEffect(() => {
    if (!groups.length && tab === "groups") setTab("all");
  }, [groups.length, tab]);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const visibleCourses = selectedGroupId ? searchedCourses.filter((course) => course.groupId === selectedGroupId) : searchedCourses;
  return <div className="page"><div className="page-title"><div><div className="eyebrow">CATALOGUE</div><h1>Choisissez votre préparation</h1><p>Consultez les groupements ou recherchez directement votre concours.</p></div></div><div className="catalog-toolbar"><div className="catalog-search"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un concours…" aria-label="Rechercher un concours" /><span>{normalizedSearch ? `${searchedCourses.length} résultat${searchedCourses.length > 1 ? "s" : ""}` : `${courses.length} concours`}</span></div><div className="catalog-tabs"><button className={tab === "groups" && !normalizedSearch ? "active" : ""} onClick={() => { setTab("groups"); setSelectedGroupId(null); }}>Groupements</button><button className={tab === "all" || Boolean(normalizedSearch) ? "active" : ""} onClick={() => { setTab("all"); setSelectedGroupId(null); }}>Tous les concours</button></div></div>{selectedGroup ? <div><button className="back-link catalog-back-button" onClick={() => setSelectedGroupId(null)}>← Tous les groupements</button><div className="group-hero" style={courseCoverStyle(selectedGroup.cardColor)}><div><span>GROUPEMENT</span><h2>{selectedGroup.title}</h2><p>{selectedGroup.description}</p></div><strong>{visibleCourses.length} concours</strong></div><div className="course-grid">{visibleCourses.map((c) => { const enrollment = myEnrollments.find((item) => item.courseId === c.id); const isActive = isEnrollmentCurrentlyActive(enrollment); return <CourseCard key={c.id} course={c} enrolled={isActive} groupLabel={selectedGroup.title} groupColor={selectedGroup.cardColor} onOpen={() => setCourse(c.id, isActive ? "course" : "enroll")} />; })}</div></div> : tab === "groups" && !normalizedSearch ? (groups.length ? <div className="course-grid">{groups.map((group) => { const children = courses.filter((course) => course.groupId === group.id); return <article className="course-card catalog-card group-card" key={group.id} onClick={() => setSelectedGroupId(group.id)}><div className={`course-cover ${group.cardColor}`} style={courseCoverStyle(group.cardColor)}><span>GROUPEMENT</span><b>{group.title}</b><div className="cover-icon"><Icon name="grid" /></div></div><div className="card-body"><h3>{group.title}</h3><p>{group.description || "Découvrez les concours de ce groupement."}</p><div className="group-child-list">{children.slice(0, 4).map((child) => <span key={child.id}>{child.title}</span>)}{children.length > 4 && <span>+ {children.length - 4} autres</span>}</div><button className="primary full">Voir les concours <Icon name="arrow" /></button></div></article>})}</div> : <div className="panel empty-state">Aucun groupement disponible.</div>) : (visibleCourses.length ? <div className="course-grid">{visibleCourses.map((c) => { const enrollment = myEnrollments.find((item) => item.courseId === c.id); const isActive = isEnrollmentCurrentlyActive(enrollment); const parent = groups.find((group) => group.id === c.groupId); return <CourseCard key={c.id} course={c} enrolled={isActive} groupLabel={parent?.title} groupColor={parent?.cardColor} onOpen={() => setCourse(c.id, isActive ? "course" : "enroll")} />})}</div> : <div className="panel empty-state">Aucune préparation publiée.</div>)}</div>;
}

function PublicPreview({
  go,
  course,
}: {
  go: (p: string) => void;
  course: CourseView;
}) {
  return (
    <div className="public-shell">
      <PublicNavbar go={go} active="catalog" />
      <div className="page public-page">
        <div className="preview-hero">
          <div>
            <div className="eyebrow">PRÉPARATION</div>
            <h1>{course.title}</h1>
            <p>
              {course.description || "Préparation publiée par CAV Madagascar."}
            </p>
          </div>
          <div className="price-box">
            <strong>{formatPrice(course.price)} Ar</strong>
            <button
              className="primary"
              onClick={() => go(`enroll:${course.id}`)}
            >
              S'inscrire <Icon name="arrow" />
            </button>
          </div>
        </div>
        <div className="preview-content">
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">PROGRAMME</div>
                <h2>Matières de la préparation</h2>
              </div>
            </div>
            {course.subjects.length ? (
              course.subjects.map((subject, i) => (
                <div className="preview-subject" key={subject.id}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{subject.title}</strong>
                    <small>
                      {subject.description ||
                        "Contenu publié dans cette préparation."}
                    </small>
                  </div>
                  <b>›</b>
                </div>
              ))
            ) : (
              <div className="empty-state">
                Aucune matière publiée pour cette préparation.
              </div>
            )}
          </div>
          <div className="panel">
            <div className="eyebrow">CE QUI EST INCLUS</div>
            <h2>Votre préparation</h2>
            <div className="metric">
              <span>Cours publiés</span>
              <b>✓</b>
            </div>
            <div className="metric">
              <span>Vidéos et illustrations</span>
              <b>✓</b>
            </div>
            <div className="metric">
              <span>Entraînements publiés</span>
              <b>✓</b>
            </div>
            <div className="metric">
              <span>Suivi de progression</span>
              <b>✓</b>
            </div>
            <button
              className="primary full"
              onClick={() => go(`enroll:${course.id}`)}
            >
              Commencer l'inscription
            </button>
          </div>
        </div>
      </div>
      <div className="preview-mobile-bar">
        <div>
          <small>Prix</small>
          <strong>{formatPrice(course.price)} Ar</strong>
        </div>
        <button
          className="primary"
          onClick={() => go(`enroll:${course.id}`)}
        >
          S'inscrire <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}

function AboutPage({ go }: { go: (p: string) => void }) {
  return (
    <div className="public-shell">
      <PublicNavbar go={go} active="about" />
      <main className="about-page">
        <section className="about-hero">
          <div>
            <div className="eyebrow">À PROPOS DE CAV MADAGASCAR</div>
            <h1>La formation en ligne au service de l'accessibilité et de la réussite.</h1>
            <p>Pionnière de la formation en ligne à Madagascar, CAV Madagascar met le numérique au service de l'éducation pour permettre à chacun d'apprendre où qu'il se trouve.</p>
          </div>
          <div className="about-year"><strong>2021</strong><span>Création de CAV Madagascar</span></div>
        </section>

        <section className="about-story about-section-grid">
          <div className="about-section-heading"><div className="eyebrow">NOTRE HISTOIRE</div><h2>Une ambition née du numérique.</h2></div>
          <div className="about-text-stack">
            <p>Créé en 2021, CAV Madagascar est une plateforme qui propose des formations 100% en ligne dans les domaines des cours préparatoires aux concours administratifs et des formations professionnelles modulaires.</p>
            <p>Face au développement et à la vulgarisation des nouvelles technologies, CAV Madagascar a pour vocation de mettre ces outils au service de l'éducation. À travers le numérique, l'établissement propose une solution de formation qui répond aux contraintes de distance et de disponibilité des apprenants.</p>
            <p>Sa raison d'être est de permettre à toute personne, où qu'elle se trouve et quelles que soient ses contraintes de disponibilité, d'avoir accès à une formation adéquate et de qualité.</p>
          </div>
        </section>

        <section className="about-formations">
          <div className="center-title about-title"><div className="eyebrow">NOS FORMATIONS</div><h2>Deux façons d'apprendre, une même exigence.</h2><p>CAV Madagascar propose deux types de formation pour répondre aux objectifs académiques et professionnels de ses apprenants.</p></div>
          <div className="about-formation-grid">
            <article><div className="about-number">01</div><div><h3>Cours pour les concours</h3><p>Des cours préparatoires pour les divers concours administratifs à Madagascar afin d'accompagner les candidats vers la réussite.</p></div></article>
            <article><div className="about-number">02</div><div><h3>Formations modulaires</h3><p>Des formations à vocation professionnelle destinées à stimuler le développement personnel et professionnel de chacun.</p></div></article>
          </div>
        </section>

        <section className="about-missions">
          <div className="about-section-heading"><div className="eyebrow">NOS MISSIONS</div><h2>Mettre la technologie au service de la connaissance.</h2></div>
          <div className="mission-grid">
            {[
              "Favoriser l'accès à la connaissance et à la compétence à travers les outils des nouvelles technologies.",
              "Mettre en œuvre des formations adaptées aux besoins du marché.",
              "Vulgariser l'usage du numérique et de l'innovation.",
              "Rechercher et proposer perpétuellement des techniques de formation innovantes afin de rendre les formations de plus en plus efficaces.",
              "Contribuer au développement de la Grande Île en proposant des formations de qualité dans des domaines variés.",
            ].map((mission, index) => <article key={mission}><span>{String(index + 1).padStart(2, "0")}</span><p>{mission}</p></article>)}
          </div>
        </section>

        <section className="about-vision">
          <div className="eyebrow">NOTRE VISION</div>
          <h2>Faire de la formation en ligne un levier pour le développement de Madagascar.</h2>
          <p>La vision de CAV Madagascar est d'être l'acteur incontournable de la formation en ligne à Madagascar et de mettre celle-ci au service de toute la population, afin d'en faire un levier pour le développement du pays.</p>
          <button className="primary" onClick={() => go("contact")}>Parlons avec CAV <Icon name="arrow" /></button>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function ContactPage({ go }: { go: (p: string) => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !subject || !message.trim()) {
      setError("Veuillez renseigner tous les champs obligatoires.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Veuillez renseigner une adresse e-mail valide.");
      return;
    }
    setSubmitting(true);
    try {
      await createContactMessage({
        firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(),
        phone: phone.trim(), subject, message: message.trim(),
      });
      setSubmitted(true);
      setFirstName(""); setLastName(""); setEmail(""); setPhone(""); setSubject(""); setMessage("");
    } catch (err) {
      console.error(err);
      setError("Impossible d'envoyer votre message pour le moment. Veuillez réessayer.");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="public-shell">
      <PublicNavbar go={go} active="contact" />
      <main className="contact-page">
        <section className="contact-hero contact-hero-v1">
          <div className="contact-hero-copy">
            <div className="eyebrow">CONTACTEZ-NOUS</div>
            <h1>Une question ? Parlons-en.</h1>
            <p>Besoin d'informations sur une formation, une inscription ou simplement envie d'échanger avec CAV Madagascar ? Notre équipe est à votre écoute.</p>
            <div className="contact-benefits" aria-label="Notre engagement">
              <div className="contact-benefit"><span className="contact-benefit-icon" aria-hidden="true"><Icon name="message" /></span><span><strong>Réponse rapide</strong><small>Nous vous répondons dans les plus brefs délais.</small></span></div>
              <div className="contact-benefit"><span className="contact-benefit-icon" aria-hidden="true"><Icon name="users" /></span><span><strong>Une équipe dédiée</strong><small>À l'écoute des étudiants partout à Madagascar.</small></span></div>
              <div className="contact-benefit"><span className="contact-benefit-icon" aria-hidden="true"><Icon name="heart" /></span><span><strong>Toujours à vos côtés</strong><small>Pour vous accompagner dans votre préparation.</small></span></div>
            </div>
          </div>
          <div className="contact-brand-panel" aria-label="CAV Madagascar, à votre écoute">
            <div className="contact-brand-orbit contact-brand-orbit-one" aria-hidden="true"></div>
            <div className="contact-brand-orbit contact-brand-orbit-two" aria-hidden="true"></div>
            <div className="contact-brand-dots" aria-hidden="true"></div>
            <div className="contact-brand-mark"><span>CAV</span><small>COURS D’APPUI VIRTUEL<br />MADAGASCAR</small></div>
            <div className="contact-brand-divider" aria-hidden="true"></div>
            <strong>À votre écoute</strong>
            <span className="contact-brand-caption">Votre réussite, notre priorité.</span>
          </div>
        </section>
        <section className="contact-grid">
          <div className="contact-form-card">
            <div className="eyebrow">VOTRE MESSAGE</div><h2>Écrivez-nous</h2>
            {submitted && <div className="contact-success"><span>✓</span><div><strong>Votre message a bien été envoyé.</strong><p>Merci pour votre message. L'équipe CAV pourra le consulter et vous répondre.</p></div></div>}
            {error && <div className="form-error" role="alert">{error}</div>}
            {!submitted && <form onSubmit={submit} noValidate>
              <div className="contact-two"><label>Prénom *<input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Votre prénom" /></label><label>Nom *<input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Votre nom" /></label></div>
              <label>Adresse e-mail *<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Votre adresse e-mail" /></label>
              <label>Téléphone <span className="optional-label">(obligatoire)</span><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+261 ..." /></label>
              <label>Objet *<select value={subject} onChange={e=>setSubject(e.target.value)}><option value="">Sélectionnez un sujet</option><option>Informations sur une formation</option><option>Question sur un concours</option><option>Inscription et paiement</option><option>Problème technique</option><option>Autre</option></select></label>
              <label>Votre message *<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={6} placeholder="Écrivez votre message ici..."></textarea></label>
              <div className="contact-submit-row"><span>Votre message sera transmis à l'administration de CAV Madagascar.</span><button className="primary" type="submit" disabled={submitting}>{submitting ? "Envoi..." : "Envoyer le message"} <Icon name="arrow" /></button></div>
            </form>}
            {submitted && <button className="primary" onClick={()=>setSubmitted(false)}>Envoyer un autre message</button>}
          </div>
          <aside className="contact-info-card">
            <div className="eyebrow">CAV MADAGASCAR</div><h2>Nos coordonnées</h2><p>Vous pouvez également nous joindre directement par téléphone, e-mail ou nous rendre visite à Antananarivo.</p>
            <div className="contact-detail"><div className="contact-detail-icon">⌂</div><div><small>ADRESSE</small><strong>IVB 33 Ter Ambatomitsangana</strong><span>En Face Look's 3e etage.</span></div></div>
            <div className="contact-detail"><div className="contact-detail-icon">@</div><div><small>EMAIL</small><a href="mailto:Service@cav.mg">Service@cav.mg</a></div></div>
            <div className="contact-detail"><div className="contact-detail-icon">☎</div><div><small>TÉLÉPHONE</small><a href="tel:+261347020222">+261 34 70 202 22</a><a href="tel:+261345320222">+261 34 53 202 22</a></div></div>
            <div className="contact-note"><strong>Une question sur un concours ?</strong><span>Consultez d'abord notre catalogue pour découvrir les préparations disponibles.</span><button className="link-button" onClick={() => go("catalog")}>Voir les concours →</button></div>
          </aside>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
function HowItWorks({ go }: { go: (p: string) => void }) {
  return (
    <div className="public-shell">
      <PublicNavbar go={go} active="how" />
      <div className="page public-page how-page">
        <div className="center-title">
          <div className="eyebrow">COMMENT ÇA MARCHE</div>
          <h1>De la découverte à votre préparation.</h1>
          <p>
            Un parcours simple, pensé pour que vous sachiez toujours quelle est
            la prochaine étape.
          </p>
        </div>
        <div className="how-steps">
          {[
            [
              "01",
              "Choisissez votre concours",
              "Découvrez le catalogue et consultez le programme de chaque préparation.",
            ],
            [
              "02",
              "Créez votre compte",
              "Créez votre espace étudiant pour pouvoir vous inscrire à une préparation.",
            ],
            [
              "03",
              "Effectuez le paiement",
              "Choisissez le moyen de paiement proposé et conservez votre référence de transaction.",
            ],
            [
              "04",
              "Attendez la validation",
              "L’administration vérifie le paiement puis active votre accès.",
            ],
            [
              "05",
              "Commencez à apprendre",
              "Retrouvez vos cours, entraînements et votre progression dans votre espace.",
            ],
          ].map((x) => (
            <div key={x[0]}>
              <span>{x[0]}</span>
              <h3>{x[1]}</h3>
              <p>{x[2]}</p>
            </div>
          ))}
        </div>
        <div className="landing-cta">
          <div>
            <h2>Prêt à commencer ?</h2>
            <p>Découvrez les concours disponibles.</p>
          </div>
          <button className="primary" onClick={() => go("catalog")}>
            Voir les concours <Icon name="arrow" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  role,
  page,
  setPage,
}: {
  role: Role;
  page: string;
  setPage: (p: any) => void;
}) {
  const [notificationCounts, setNotificationCounts] = useState({ messages: 0, enrollments: 0, users: 0, studentQuestions: 0 });
  const adminNotificationsEnabled = role === "admin" || role === "teacher";

  useEffect(() => {
    if (!adminNotificationsEnabled) return;
    const db = getFirebaseFirestore();
    const unsubs: Array<() => void> = [];

    if (role === "admin" || role === "teacher") {
      const unreadMessagesQuery = query(collection(db, "contactMessages"), where("status", "==", "unread"));
      unsubs.push(onSnapshot(unreadMessagesQuery, (snapshot) => {
        setNotificationCounts((current) => ({ ...current, messages: snapshot.size }));
      }, (error) => console.error("Messages notification listener failed:", error)));
    }

    unsubs.push(subscribeUnreadLessonCommentCount((count) => {
      setNotificationCounts((current) => ({ ...current, studentQuestions: count }));
    }, (error) => console.error("Lesson questions notification listener failed:", error)));

    if (role === "admin" || role === "teacher") {
      const pendingPaymentsQuery = query(collection(db, "payments"), where("status", "==", "pending"));
      unsubs.push(onSnapshot(pendingPaymentsQuery, (snapshot) => {
        setNotificationCounts((current) => ({ ...current, enrollments: snapshot.size }));
      }, (error) => console.error("Payment notification listener failed:", error)));

      const usersSeenKey = "cav_admin_users_seen_at";
      const storedSeenAt = Number(localStorage.getItem(usersSeenKey) || "");
      const initialSeenAt = Number.isFinite(storedSeenAt) && storedSeenAt > 0 ? storedSeenAt : Date.now();
      if (!storedSeenAt) localStorage.setItem(usersSeenKey, String(initialSeenAt));

      // Only listen for users created since the last visit to user management.
      // This avoids downloading every user document just to compute a badge count.
      const usersQuery = query(
        collection(db, "users"),
        where("createdAt", ">", Timestamp.fromMillis(initialSeenAt)),
      );
      unsubs.push(onSnapshot(usersQuery, (snapshot) => {
        if (page === "users") {
          localStorage.setItem(usersSeenKey, String(Date.now()));
          setNotificationCounts((current) => ({ ...current, users: 0 }));
          return;
        }
        setNotificationCounts((current) => ({ ...current, users: snapshot.size }));
      }, (error) => console.error("User notification listener failed:", error)));
    }

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [adminNotificationsEnabled, page]);

  const markUsersSeen = () => {
    localStorage.setItem("cav_admin_users_seen_at", String(Date.now()));
    setNotificationCounts((current) => ({ ...current, users: 0 }));
  };

  const student = [
    ["dashboard", "Tableau de bord", "dashboard"],
    ["concours", "Mes concours", "graduation"],
    ["catalog", "Catalogue", "library"],
    ["results", "Résultats", "chart"],
    ["library", "Librairie", "bookOpen"],
  ];
  const admin = [
    ["overview", "Vue d’ensemble", "dashboard"],
    ["courses", "Concours", "graduation"],
    ["subjects", "Matières", "bookOpen"],
    ["enrollments", "Inscriptions", "clipboardCheck"],
    ["users", "Utilisateurs", "contact"],
    ["studentQuestions", "Questions étudiants", "question"],
    ["broadcasts", "Annonces", "megaphone"],
    ["library", "Librairie", "library"],
    ["psychotechnical", "Tests psychotechniques", "brain"],
    ["stats", "Statistiques", "chart"],
    ["messages", "Messages", "mail"], ["billing", "Facturation Google Cloud", "cloud"], ["profile", "Paramètres", "sliders"],
  ];
  const items = role === "student" ? student : role === "teacher" ? admin.filter(([id]) => id !== "stats") : admin;
  const badgeFor = (id: string) => id === "messages" ? notificationCounts.messages : id === "enrollments" ? notificationCounts.enrollments : id === "users" ? notificationCounts.users : id === "studentQuestions" ? notificationCounts.studentQuestions : 0;

  return (
    <aside className="sidebar">
      <Logo />
      <div className="side-role">
        {role === "student" ? "ESPACE ÉTUDIANT" : role === "teacher" ? "GESTIONNAIRE DE CONTENU" : "ADMINISTRATION"}
      </div>
      <nav>
        {items.map(([id, label, icon]) => {
          const badge = badgeFor(id);
          return (
            <a
              key={id}
              href={navPageHref(id)}
              aria-current={page === id ? "page" : undefined}
              className={`nav-item nav-icon-${icon} ${page === id ? "active" : ""}`.trim()}
              onClick={(event) => onNavLinkClick(event, () => {
                if (id === "users") markUsersSeen();
                setPage(id);
              })}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {badge > 0 && <span className="nav-badge" aria-label={`${badge} nouveau${id === "messages" ? " message" : id === "studentQuestions" ? " question étudiant" : id === "users" ? " utilisateur" : " inscription"}${badge > 1 ? "s" : ""}`}>{badge > 99 ? "99+" : badge}</span>}
            </a>
          );
        })}
      </nav>

    </aside>
  );
}
function MobileNav({
  role,
  page,
  setPage,
}: {
  role: Role;
  page: string;
  setPage: (p: any) => void;
}) {
  const student = [
    ["dashboard", "Accueil", "dashboard"],
    ["concours", "Mes concours", "graduation"],
    ["catalog", "Catalogue", "library"],
    ["results", "Résultats", "chart"],
    ["library", "Librairie", "bookOpen"],
  ];
  const admin = [
    ["overview", "Vue d’ensemble", "dashboard"],
    ["courses", "Concours", "graduation"],
    ["subjects", "Matières", "bookOpen"],
    ["enrollments", "Inscriptions", "clipboardCheck"],
    ["users", "Utilisateurs", "contact"],
    ["studentQuestions", "Questions étudiants", "question"],
    ["broadcasts", "Annonces", "megaphone"],
    ["library", "Librairie", "library"],
    ["psychotechnical", "Tests psychotechniques", "brain"],
    ["stats", "Statistiques", "chart"],
    ["messages", "Messages", "mail"],
    ["billing", "Facturation Google Cloud", "cloud"],
    ["profile", "Paramètres", "sliders"],
  ];
  const items = role === "student" ? student : role === "teacher" ? admin.filter(([id]) => id !== "stats") : admin;
  return (
    <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
      {items.map(([id, label, icon]) => (
        <a
          key={id}
          href={navPageHref(id)}
          aria-current={page === id ? "page" : undefined}
          className={page === id ? "is-active" : ""}
          onClick={(event) => onNavLinkClick(event, () => setPage(id))}
        >
          <Icon name={icon} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
function Topbar({
  role,
  displayName,
  initials,
  photoURL,
  userId,
  onLogout,
  onNotificationOpen,
  onNavigate,
  currentPage,
}: {
  role: Role;
  displayName: string;
  initials: string;
  photoURL?: string;
  userId?: string;
  onLogout: () => void;
  onNotificationOpen?: (notification: LessonNotification) => void;
  onNavigate?: (page: StudentPage) => void;
  currentPage?: StudentPage;
}) {
  const label =
    role === "student"
      ? "Étudiant"
      : role === "admin"
        ? "Administrateur"
        : "Gestionnaire de contenu";
  const [notifications, setNotifications] = useState<LessonNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [broadcastDetail, setBroadcastDetail] = useState<LessonNotification | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    if (role !== "student" || !userId) { setNotifications([]); return; }
    return subscribeMyNotifications(userId, setNotifications, error => console.error("Notification listener failed:", error));
  }, [role, userId]);
  async function openNotification(item: LessonNotification) {
    // Remove it from the unread list immediately so the bell badge reflects
    // the user's action without waiting for the Firestore snapshot round-trip.
    setNotifications(current => current.filter(notification => notification.id !== item.id));
    setOpen(false);

    try {
      await markNotificationRead(item.id);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // If persistence fails, restore the notification so it remains visible
      // and can be retried rather than silently losing it from the UI.
      setNotifications(current => {
        if (current.some(notification => notification.id === item.id)) return current;
        return [...current, item].sort((a, b) =>
          (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
      });
      return;
    }

    if (item.type === "broadcast") { setBroadcastDetail(item); return; }
    onNotificationOpen?.(item);
  }
  const useMobileNotificationModal = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const notificationOverlay = open ? (
    <div className="top-notification-backdrop" role="presentation" onClick={() => setOpen(false)}><section className="top-notification-panel" role="dialog" aria-modal="true" aria-labelledby="student-notifications-title" onClick={event => event.stopPropagation()}><div className="top-notification-head"><div><strong id="student-notifications-title">Notifications</strong><small>{notifications.length ? `${notifications.length} non lue${notifications.length > 1 ? "s" : ""}` : "Vous êtes à jour"}</small></div><button type="button" className="top-notification-close" aria-label="Fermer les notifications" onClick={() => setOpen(false)}>×</button></div>{notifications.length === 0 ? <div className="top-notification-empty"><span aria-hidden="true">✓</span><strong>Aucune nouvelle notification</strong><p>Nous vous informerons ici des nouveautés concernant vos cours.</p></div> : <>{notifications.length > 1 && <div className="top-notification-actions"><button type="button" onClick={async () => { const current = [...notifications]; try { await Promise.all(current.map(item => markNotificationRead(item.id))); setNotifications(items => items.filter(item => !current.some(readItem => readItem.id === item.id))); } catch (error) { console.error("Failed to mark all notifications as read:", error); }}}>Tout marquer comme lu</button></div>}<div className="top-notification-list">{notifications.map(item => <button type="button" key={item.id} className="top-notification-item" onClick={() => void openNotification(item)}><span className="top-notification-unread-dot" aria-hidden="true"/><span className="top-notification-copy"><strong>{item.type === "broadcast" ? `CAV Madagascar · ${item.title ?? "Annonce"}` : item.message}</strong>{item.type === "broadcast" && <small>{item.message}</small>}<small>{item.createdAt ? item.createdAt.toDate().toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "À l’instant"}</small></span></button>)}</div></>}</section></div>
  ) : null;
  return (
    <div className={`topbar ${role === "student" ? "student-topbar" : ""}`}>
      <div className="mobile-logo"><Logo /></div>
      {role === "student" ? (
        <>
          <div className="desktop-student-brand"><Logo /></div>
          <nav className="student-topnav" aria-label="Navigation étudiant">
            {[
              ["dashboard", "Accueil", "grid"],
              ["concours", "Concours", "book"],
              ["catalog", "Catalogue", "file"],
              ["results", "Résultats", "chart"],
              ["library", "Bibliothèque", "book"],
            ].map(([id, text, icon]) => (
              <a key={id} href={navPageHref(id)} aria-current={currentPage === id ? "page" : undefined} className={`student-topnav-item ${currentPage === id ? "is-active" : ""}`} onClick={(event) => onNavLinkClick(event, () => onNavigate?.(id as StudentPage))}>
                <Icon name={icon} /> <span>{text}</span>
              </a>
            ))}
          </nav>
          <form className="student-top-search" onSubmit={(event) => { event.preventDefault(); const value = searchQuery.trim(); if (value) localStorage.setItem("cav_student_catalog_search", value); onNavigate?.("catalog"); }}><button type="submit" aria-label="Rechercher"><Icon name="search" /></button><input aria-label="Rechercher" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Rechercher un concours, une matière..." /></form>
        </>
      ) : <div className="top-role"><span>{label.toUpperCase()}</span></div>}
      <div className="top-actions">
        <span className="status-dot" /> Connecté
        {role === "student" && <div className="top-notification-wrap"><button type="button" className="top-notification-button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen(value => !value)}>🔔{notifications.length > 0 && <span>{notifications.length > 99 ? "99+" : notifications.length}</span>}</button>{open && (useMobileNotificationModal ? createPortal(notificationOverlay, document.body) : notificationOverlay)} {broadcastDetail && <div className="broadcast-detail-backdrop" role="presentation" onClick={() => setBroadcastDetail(null)}><div className="broadcast-detail-modal" role="dialog" aria-modal="true" aria-labelledby="broadcast-detail-title" onClick={event => event.stopPropagation()}><div className="broadcast-detail-brand"><div className="broadcast-preview-icon">CAV</div><div><strong>CAV Madagascar</strong><small>Annonce officielle</small></div><button type="button" className="link-button" onClick={() => setBroadcastDetail(null)}>Fermer</button></div><p className="eyebrow">{broadcastDetail.category ?? "ANNONCE"}</p><h2 id="broadcast-detail-title">{broadcastDetail.title ?? "Annonce CAV"}</h2><div className="broadcast-detail-message">{broadcastDetail.message}</div><button className="primary full" type="button" onClick={() => setBroadcastDetail(null)}>Compris</button></div></div>}</div>}
        {role === "student" && onNavigate ? (
          <button type="button" className={`top-profile-button ${currentPage === "profile" ? "is-active" : ""}`} aria-label="Ouvrir les paramètres" title="Paramètres" onClick={() => onNavigate("profile")}>
            {photoURL ? <img src={photoURL} alt="" className="avatar-image" /> : <div className="avatar">{initials}</div>}
          </button>
        ) : (photoURL ? <img src={photoURL} alt="" className="avatar-image" /> : <div className="avatar">{initials}</div>)}
        <strong>{displayName}</strong>
        <button className="link-button top-logout" onClick={onLogout} type="button" aria-label="Se déconnecter">Se déconnecter</button>
      </div>
    </div>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <div style={{ width: `${value}%` }} />
    </div>
  );
}
function CourseCard({
  course,
  onOpen,
  admin = false,
  onEdit,
  onPublish,
  onDelete,
  deleting = false,
  enrolled = false,
  groupLabel,
  groupColor,
}: {
  course: CourseView;
  onOpen: () => void;
  admin?: boolean;
  onEdit?: () => void;
  onPublish?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  enrolled?: boolean;
  groupLabel?: string;
  groupColor?: CourseCardColor;
}) {
  const displayColor: CourseCardColor = groupColor ?? "blue";
  const displayStyle = groupColor
    ? courseCoverStyle(groupColor)
    : { background: DEFAULT_UNGROUPED_COURSE_GRADIENT };
  if (!admin) {
    const illustration = courseIllustration(course);
    return (
      <article className={`modern-course-card ${enrolled ? "is-enrolled" : ""}`}>
        <div className="modern-course-image">
          <img src={illustration} alt="" />
          <div className="modern-course-image-overlay" />
          {groupLabel && <span className={`modern-group-badge ${displayColor}`}><Icon name="grid" /> {groupLabel}</span>}
          <span className={`modern-status-badge ${enrolled ? "success" : "neutral"}`}>
            <Icon name={enrolled ? "check" : "book"} /> {enrolled ? "Inscrit" : "Non inscrit"}
          </span>
        </div>
        <div className="modern-course-content">
          <div className="modern-course-kicker">PRÉPARATION AUX CONCOURS</div>
          <div className="modern-course-title-row">
            <div>
              <h3>{course.title}</h3>
              <div className="modern-course-meta">
                <span><Icon name="book" /> {course.subjects.length} {course.subjects.length === 1 ? "matière" : "matières"}</span>
                <span><Icon name="chart" /> Préparation structurée</span>
              </div>
            </div>
            {enrolled && <strong className="modern-progress-value">65%</strong>}
          </div>
          {enrolled && <Progress value={65} />}
          {!enrolled && (
            <div className="modern-price-row">
              <strong>{formatPrice(course.price)} Ar</strong>
            </div>
          )}
          <div className="modern-course-benefits">
            <span><Icon name="play" /> Vidéos de cours</span>
            <span><Icon name="file" /> Supports</span>
            <span><Icon name="check" /> Exercices et sujets types</span>
          </div>
          <button className="modern-course-action" onClick={onOpen}>
            {enrolled ? "Continuer ma préparation" : "Voir et s'inscrire"} <Icon name="arrow" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="course-card">
      <div className={`course-cover ${displayColor}`} style={displayStyle}>
        <span>{course.category}</span>
        <b>{course.title}</b>
        <div className="cover-icon"><Icon name="book" /></div>
      </div>
      <div className="card-body">
        <div className="eyebrow">
          {course.status === "published" ? "PUBLIÉ" : "BROUILLON"}
        </div>
        <h3>{course.title}</h3>
        <p>{course.subjects.length} {course.subjects.length === 1 ? "matière" : "matières"} · {course.accessDurationDays} jours · {course.status}</p>
        <Progress value={100} />
        <div className="card-footer">
          <span>{course.subjects.length} {course.subjects.length === 1 ? "matière" : "matières"}</span>
          <div className="card-footer-actions">
            {(onEdit || onPublish || onDelete) && (
              <details className="course-actions-menu">
                <summary aria-label="Autres actions" title="Autres actions">•••</summary>
                <div className="course-actions-popover" role="menu">
                  {onEdit && <button type="button" role="menuitem" onClick={onEdit}>Modifier les informations</button>}
                  {onPublish && <button type="button" role="menuitem" onClick={onPublish}>{course.status === "published" ? "Dépublier" : "Publier"}</button>}
                  {onDelete && <button type="button" role="menuitem" className="danger" disabled={deleting} onClick={onDelete}>{deleting ? "Suppression..." : "Supprimer"}</button>}
                </div>
              </details>
            )}
            <button className="text-button" onClick={onOpen}>Gérer <Icon name="arrow" /></button>
          </div>
        </div>
      </div>
    </article>
  );
}

function StudentDashboard({
  setPage,
  openCourse,
  courses,
  displayName,
}: {
  setPage: (p: StudentPage) => void;
  openCourse: (courseId: string) => void;
  courses: CourseView[];
  displayName: string;
}) {
  return (
    <div className="page">
      <div className="hero hero-welcome">
        <div>
          <div className="eyebrow">ESPACE ÉTUDIANT</div>
          <h1>
            Bonjour, {displayName.split(/\s+/)[0]}
            <span>.</span>
          </h1>
          <p>
            Continuez votre préparation et avancez vers votre prochain concours.
          </p>
        </div>
        <button className="primary" onClick={() => setPage("catalog")}>
          Explorer les concours <Icon name="arrow" />
        </button>
      </div>
      <section>
        <div className="section-head">
          <div>
            <div className="eyebrow">MA PRÉPARATION</div>
            <h2>Mes concours</h2>
          </div>
          <button className="link-button" onClick={() => setPage("concours")}>
            Voir tout <Icon name="arrow" />
          </button>
        </div>
        {courses.length ? (
          <div className="course-grid dashboard-course-grid">
            {courses.slice(0, 2).map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                enrolled
                onOpen={() => openCourse(c.id)}
              />
            ))}
          </div>
        ) : (
          <div className="panel empty-state">
            <h3>Aucune inscription active.</h3>
            <p>
              Vos préparations apparaîtront ici après validation de votre
              paiement.
            </p>
            <button className="primary" onClick={() => setPage("catalog")}>
              Découvrir les concours
            </button>
          </div>
        )}
      </section>
      <section>
        <div className="section-head">
          <div>
            <div className="eyebrow">ACTIVITÉ RÉCENTE</div>
            <h2>Continuez là où vous vous êtes arrêté</h2>
          </div>
        </div>
        <div className="continue-card">
          <div className="lesson-icon">
            <Icon name="play" />
          </div>
          <div className="continue-copy">
            <span>
              {courses.length
                ? "Une préparation active"
                : "Aucune préparation active"}
            </span>
            <h3>
              {courses.length
                ? "Reprenez votre dernière leçon"
                : "Commencez par choisir une préparation"}
            </h3>
            <p>
              {courses.length
                ? "Votre progression réelle sera affichée ici."
                : "Aucune progression à afficher pour le moment."}
            </p>
          </div>
          <button
            className="primary small"
            onClick={() => {
              if (courses.length) openCourse(courses[0].id);
              else setPage("catalog");
            }}
          >
            {courses.length ? "Continuer" : "Découvrir"} <Icon name="arrow" />
          </button>
        </div>
      </section>
      <section>
        <div className="section-head">
          <div>
            <div className="eyebrow">DERNIÈRES ACTIVITÉS</div>
            <h2>Votre progression</h2>
          </div>
        </div>
        <div className="panel empty-state">
          {courses.length
            ? "Les activités seront affichées à partir de vos données de progression."
            : "Aucune activité enregistrée."}
        </div>
      </section>
    </div>
  );
}

async function listContentNodesSafe(courseSubjectId: string): Promise<ContentNode[]> {
  try {
    const { listContentNodes } = await import("./features/curriculum");
    return await listContentNodes(courseSubjectId, true);
  } catch {
    return [];
  }
}

function CoursePage({
  setPage,
  onBack,
  course,
  userId,
  practice,
  initialLessonId,
  initialCommentId,
}: {
  setPage: (p: StudentPage) => void;
  onBack?: () => void;
  course?: CourseView;
  userId?: string;
  practice: () => void;
  initialLessonId?: string | null;
  initialCommentId?: string | null;
}) {
  const [subjects, setSubjects] = useState<CourseSubject[]>([]);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [progress, setProgress] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [lessonQuestions, setLessonQuestions] = useState<Question[]>([]);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState("");
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [lessonComments, setLessonComments] = useState<LessonComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<string | null>(null);
  const [commentLoveState, setCommentLoveState] = useState<Record<string, { count: number; loved: boolean }>>({});
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentCategory, setCommentCategory] = useState<LessonCommentCategory>("course");
  const { profile: studentProfile } = useAuth();
  const commentStatuses = useMemo(() => buildQuestionStatuses(lessonComments), [lessonComments]);
  // Technical reports that the team marked as treated disappear for everyone except their author.
  const visibleLessonComments = useMemo(() => {
    const hidden = new Set<string>();
    for (const root of lessonComments) {
      if (root.parentCommentId || root.category !== "technical" || root.userId === userId) continue;
      if (commentStatuses[root.id]?.status === "treated") collectCommentThreadIds(root.id, lessonComments).forEach(id => hidden.add(id));
    }
    return hidden.size ? lessonComments.filter(comment => !hidden.has(comment.id)) : lessonComments;
  }, [lessonComments, commentStatuses, userId]);

  // Local curriculum views participate in browser history too. This makes
  // browser Back/Forward and native mobile swipe gestures behave like the
  // in-app navigation without changing the URL or interfering with app-level history.
  const pushCourseViewHistory = (subjectId: string, nodeId: string = "") => {
    const currentState = window.history.state && typeof window.history.state === "object"
      ? window.history.state as Record<string, unknown>
      : {};
    window.history.pushState(
      { ...currentState, __cavCourseView: true, subjectId, nodeId, courseId: course?.id ?? null },
      "",
      window.location.href,
    );
  };

  const leaveCourseView = (fallback: () => void) => {
    const state = window.history.state as { __cavCourseView?: boolean; courseId?: string | null } | null;
    if (state?.__cavCourseView && (!state.courseId || state.courseId === course?.id)) {
      window.history.back();
      return;
    }
    fallback();
  };

  useEffect(() => {
    const onCourseViewPopState = (event: PopStateEvent) => {
      const state = event.state as { __cavCourseView?: boolean; subjectId?: string; nodeId?: string; courseId?: string | null } | null;
      if (state?.__cavCourseView && (!state.courseId || state.courseId === course?.id)) {
        setSelectedSubjectId(state.subjectId ?? "");
        setSelectedNodeId(state.nodeId ?? "");
      } else {
        // Returning to the app-level history entry means leaving this local view.
        setSelectedSubjectId("");
        setSelectedNodeId("");
      }
    };
    window.addEventListener("popstate", onCourseViewPopState);
    return () => window.removeEventListener("popstate", onCourseViewPopState);
  }, [course?.id]);

  useEffect(() => {
    if (!initialLessonId || !course || !nodes.length || selectedNodeId === initialLessonId) return;
    const target = nodes.find(node => node.id === initialLessonId);
    if (target) void openLesson(target);
  }, [initialLessonId, nodes, course]);

  useEffect(() => {
    if (!initialCommentId || !selectedNodeId || selectedNodeId !== initialLessonId || lessonComments.length === 0) return;
    const target = lessonComments.find(comment => comment.id === initialCommentId);
    setCommentsOpen(true);
    setFocusedCommentId(target ? initialCommentId : null);
    const timer = window.setTimeout(() => {
      const commentElement = document.getElementById(`student-lesson-comment-${initialCommentId}`);
      if (commentElement) {
        commentElement.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        document.querySelector(".lesson-comments-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 180);
    const clearTimer = window.setTimeout(() => setFocusedCommentId(null), 4200);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearTimer);
    };
  }, [initialCommentId, initialLessonId, selectedNodeId, lessonComments]);

  useEffect(() => {
    if (!course || !userId) return;
    setSelectedNodeId("");
    setSelectedSubjectId("");
    setBlocks([]);
    setLessonQuestions([]);
    setLessonComments([]);
    setCommentText("");
    setEditingCommentId(null);
    setEditingCommentText("");
    setOpenCommentMenuId(null);
    setEmojiPickerTarget(null);
    setLessonError("");
    setLessonCompleted(false);
    void Promise.all([
      listCourseSubjects(course.id, true),
      getCourseProgressSummary(userId, course.id),
    ])
      .then(([s, p]) => {
        setSubjects(s);
        setProgress(p.percent);
        return Promise.all(
          s.map(async (x) => {
            // Load the reusable Matière metadata and legacy course-linked lessons
            // in parallel so the illustration does not add a serial network wait.
            const [canonical, legacy] = await Promise.all([
              listSubjectContentNodes(x.subjectId, true).catch(() => [] as ContentNode[]),
              listContentNodesSafe(x.id).catch(() => [] as ContentNode[]),
            ]);
            const merged = new Map<string, ContentNode>();
            [...legacy, ...canonical].forEach((node) => merged.set(node.id, node));
            const canonicalByKey = new Map(canonical.filter(node => node.sharedKey).map(node => [node.sharedKey!, node]));
            const canonicalTopics = canonical.filter(node => node.type === "topic");
            return Array.from(merged.values()).map((node) => {
              if (node.type !== "topic") return { ...node, courseSubjectId: x.id };
              const source = (node.sharedKey ? canonicalByKey.get(node.sharedKey) : undefined)
                ?? canonicalTopics.find(topic => topic.title.trim().toLowerCase() === node.title.trim().toLowerCase());
              return {
                ...node,
                description: node.description ?? source?.description,
                imageUrl: node.imageUrl ?? source?.imageUrl,
                imagePosition: node.imagePosition ?? source?.imagePosition,
                courseSubjectId: x.id,
              };
            });
          }),
        );
      })
      .then((groups) => setNodes(groups.flat()))
      .catch((error) => {
        console.error(error);
        setLessonError("Impossible de charger le programme de cette préparation.");
      });
  }, [course, userId]);

  useEffect(() => {
    if (!selectedNodeId || !userId) {
      setLessonComments([]);
      return;
    }
    return subscribeLessonComments(selectedNodeId, course?.id ?? "", setLessonComments, (error) => {
      console.error(error);
      setLessonError("Impossible de charger vos questions sur cette leçon.");
    });
  }, [selectedNodeId, userId]);

  useEffect(() => {
    setCommentLoveState({});
    if (!userId || lessonComments.length === 0) return;
    const unsubscribers = lessonComments.map(comment => subscribeLessonCommentLoves(comment.id, userId, state => {
      setCommentLoveState(current => ({ ...current, [comment.id]: state }));
    }, error => console.error(error)));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [lessonComments, userId]);

  async function submitLessonComment() {
    if (!course || !userId || !selectedNode || !selectedSubjectId || !commentText.trim()) return;
    setCommentSaving(true);
    setLessonError("");
    try {
      const subject = subjects.find(item => item.id === selectedSubjectId);
      const topic = selectedNode.parentId ? nodes.find(item => item.id === selectedNode.parentId) : undefined;
      await createLessonComment({
        userId,
        studentName: String(studentProfile?.displayName ?? "Étudiant").trim() || "Étudiant",
        authorPhotoURL: String(studentProfile?.photoURL ?? "").trim() || null,
        authorRole: "student",
        category: commentCategory,
        parentCommentId: null,
        courseId: course.id,
        courseTitle: course.title,
        subjectId: subject?.subjectId ?? selectedSubjectId,
        subjectTitle: subject?.title ?? "Matière",
        topicId: topic?.id ?? null,
        topicTitle: topic?.title ?? null,
        lessonId: selectedNode.id,
        lessonTitle: selectedNode.title,
        content: commentText.trim(),
      });
      setCommentText("");
      setCommentCategory("course");
    } catch (error) {
      console.error(error);
      setLessonError("Impossible de publier votre question.");
    } finally {
      setCommentSaving(false);
    }
  }

  async function submitCommentReply(parent: LessonComment) {
    if (!course || !userId || !replyText.trim()) return;
    setCommentSaving(true);
    setLessonError("");
    try {
      await replyToLessonComment({
        parent,
        content: replyText.trim(),
        userId,
        authorName: String(studentProfile?.displayName ?? "Étudiant").trim() || "Étudiant",
        authorPhotoURL: String(studentProfile?.photoURL ?? "").trim() || null,
        authorRole: "student",
      });
      setReplyText("");
      setReplyingToId(null);
    } catch (error) {
      console.error(error);
      setLessonError("Impossible d’envoyer votre réponse.");
    } finally {
      setCommentSaving(false);
    }
  }

  async function saveEditedLessonComment(commentId: string) {
    if (!editingCommentText.trim()) return;
    setCommentSaving(true);
    setLessonError("");
    try {
      await updateLessonComment(commentId, editingCommentText);
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch (error) {
      console.error(error);
      setLessonError("Impossible de modifier votre question.");
    } finally {
      setCommentSaving(false);
    }
  }

  async function removeLessonComment(commentId: string) {
    if (!(await confirmAction({ title: "Supprimer cette question ?", description: "Cette question sera supprimée définitivement." }))) return;
    setLessonError("");
    try {
      await deleteLessonComment(commentId);
    } catch (error) {
      console.error(error);
      setLessonError("Impossible de supprimer votre question.");
    }
  }

  async function toggleCommentLove(comment: LessonComment) {
    if (!userId) return;
    const previous = commentLoveState[comment.id] ?? { count: 0, loved: false };
    const nextLoved = !previous.loved;
    setCommentLoveState(current => ({
      ...current,
      [comment.id]: { count: Math.max(0, previous.count + (nextLoved ? 1 : -1)), loved: nextLoved },
    }));
    try {
      await toggleLessonCommentLove(comment.id, userId, previous.loved);
    } catch (error) {
      console.error(error);
      setCommentLoveState(current => ({ ...current, [comment.id]: previous }));
      setLessonError("Impossible de mettre à jour la réaction.");
    }
  }

  const commentEmojis = ["👍", "❤️", "😂", "😊", "👏", "🎉", "😮", "😢", "🙏", "💡", "🔥", "✅"];

  function commentInitials(name: string) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("") || "ET";
  }

  function commentAvatar(comment: LessonComment) {
    const photo = comment.authorPhotoURL || (comment.userId === userId ? String(studentProfile?.photoURL ?? "") : "");
    if (photo) return <img src={photo} alt="" className="lesson-comment-avatar-image" />;
    return <span>{commentInitials(comment.studentName)}</span>;
  }

  function insertCommentEmoji(target: string, emoji: string) {
    if (target === "new") setCommentText(value => `${value}${emoji}`);
    else if (target.startsWith("reply:")) setReplyText(value => `${value}${emoji}`);
    setEmojiPickerTarget(null);
  }

  function renderEmojiPicker(target: string) {
    if (emojiPickerTarget !== target) return null;
    return <div className="lesson-comment-emoji-picker" role="dialog" aria-label="Choisir un emoji">
      {commentEmojis.map(emoji => <button key={emoji} type="button" onClick={() => insertCommentEmoji(target, emoji)}>{emoji}</button>)}
    </div>;
  }

  function renderCommentThread(comment: LessonComment, depth = 0, renderedIds = new Set<string>()): ReactNode {
    if (renderedIds.has(comment.id)) return null;
    renderedIds.add(comment.id);

    const replies = lessonComments
      .filter(item => item.parentCommentId === comment.id)
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    const isOwner = comment.userId === userId;

    return (
      <div className={depth > 0 ? "lesson-comment-reply-item" : "lesson-comment-thread"} key={comment.id}>
        <article id={`student-lesson-comment-${comment.id}`} className={`lesson-comment-card compact ${focusedCommentId === comment.id ? "student-comment-highlight" : ""}`}> 
          {editingCommentId === comment.id ? (
            <div className="lesson-comment-edit">
              <textarea value={editingCommentText} onChange={event => setEditingCommentText(event.target.value)} rows={3} maxLength={3000} />
              <div className="lesson-comment-edit-footer"><span>{editingCommentText.length}/3000</span><div className="lesson-comment-actions">
                <button type="button" className="primary" disabled={commentSaving || !editingCommentText.trim()} onClick={() => void saveEditedLessonComment(comment.id)}>Enregistrer</button>
                <button type="button" className="outline" onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }}>Annuler</button>
              </div></div>
            </div>
          ) : (
            <>
              <header className="lesson-comment-head">
                <div className="lesson-comment-author">
                  <span className={comment.authorRole === "manager" ? "lesson-comment-avatar manager" : "lesson-comment-avatar"} aria-hidden="true">{commentAvatar(comment)}</span>
                  <div className="lesson-comment-author-copy">
                    <div className="lesson-comment-author-line"><strong>{comment.studentName}</strong>{comment.authorRole === "manager" && <span className="lesson-comment-role">CAV</span>}{depth === 0 && comment.category === "technical" && <span className="lesson-comment-category is-technical">Problème technique</span>}{depth === 0 && comment.category === "technical" && commentStatuses[comment.id]?.status === "treated" && <span className="lesson-comment-category is-resolved">✓ Résolu</span>}</div>
                    <span>{comment.createdAt ? comment.createdAt.toDate().toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "À l’instant"}</span>
                  </div>
                </div>
                {isOwner && <div className="lesson-comment-menu-wrap">
                  <button type="button" className="lesson-comment-menu-trigger" aria-label="Options du commentaire" aria-expanded={openCommentMenuId === comment.id} onClick={() => { setOpenCommentMenuId(value => value === comment.id ? null : comment.id); setEmojiPickerTarget(null); }}>⋯</button>
                  {openCommentMenuId === comment.id && <div className="lesson-comment-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); setOpenCommentMenuId(null); }}>✎ <span>Modifier</span></button>
                    <button type="button" role="menuitem" className="danger" onClick={() => { setOpenCommentMenuId(null); void removeLessonComment(comment.id); }}>⌫ <span>Supprimer</span></button>
                  </div>}
                </div>}
              </header>
              <div className="lesson-comment-body">{comment.content}</div>
              {depth === 0 && comment.category === "technical" && isOwner && commentStatuses[comment.id]?.status === "treated" && <p className="lesson-comment-resolved-note">Ce problème a été traité par l’équipe CAV. Il n’est plus visible par les autres étudiants.</p>}
              <div className="lesson-comment-actions comment-actions">
                <button type="button" className={`lesson-comment-action lesson-comment-love ${commentLoveState[comment.id]?.loved ? "is-loved" : ""}`} aria-label={commentLoveState[comment.id]?.loved ? "Retirer l’amour" : "Aimer ce commentaire"} aria-pressed={commentLoveState[comment.id]?.loved ?? false} onClick={() => void toggleCommentLove(comment)}>
                  <span aria-hidden="true">{commentLoveState[comment.id]?.loved ? "♥" : "♡"}</span>
                  {(commentLoveState[comment.id]?.count ?? 0) > 0 && <b>{commentLoveState[comment.id]?.count}</b>}
                </button>
                <button type="button" className="lesson-comment-action" onClick={() => { setReplyingToId(comment.id); setCommentsOpen(true); setOpenCommentMenuId(null); }}><span aria-hidden="true">↩</span> Répondre</button>
              </div>
            </>
          )}
          {replyingToId === comment.id && (
            <div className="lesson-comment-reply-composer">
              <div className="lesson-comment-reply-row">
                <span className="lesson-comment-avatar">{studentProfile?.photoURL ? <img src={String(studentProfile.photoURL)} alt="" className="lesson-comment-avatar-image" /> : commentInitials(String(studentProfile?.displayName ?? "Étudiant"))}</span>
                <textarea value={replyText} onChange={event => setReplyText(event.target.value)} rows={2} maxLength={3000} placeholder={`Répondre à ${comment.studentName}...`} />
              </div>
              <div className="lesson-comment-reply-tools">
                <div className="lesson-comment-emoji-wrap"><button type="button" className="lesson-comment-tool" aria-label="Ajouter un emoji" onClick={() => { setEmojiPickerTarget(value => value === `reply:${comment.id}` ? null : `reply:${comment.id}`); setOpenCommentMenuId(null); }}>☺</button>{renderEmojiPicker(`reply:${comment.id}`)}</div>
                <div className="lesson-comment-edit-footer"><span>{replyText.length}/3000</span><div className="lesson-comment-actions">
                  <button type="button" className="primary" disabled={commentSaving || !replyText.trim()} onClick={() => void submitCommentReply(comment)}>{commentSaving ? "Envoi..." : "Répondre"}</button>
                  <button type="button" className="outline" onClick={() => { setReplyingToId(null); setReplyText(""); setEmojiPickerTarget(null); }}>Annuler</button>
                </div></div>
              </div>
            </div>
          )}
        </article>
        {replies.length > 0 && <div className="lesson-comment-replies">{replies.map(reply => renderCommentThread(reply, depth + 1, renderedIds))}</div>}
      </div>
    );
  }

  async function openLesson(node: ContentNode) {
    if (!course) return;
    if (selectedNodeId !== node.id) pushCourseViewHistory(selectedSubjectId, node.id);
    setSelectedNodeId(node.id);
    setBlocks([]);
    setLessonQuestions([]);
    setLessonError("");
    setLessonCompleted(false);
    setLessonLoading(true);
    try {
      // The reading experience must not wait for secondary data such as questions.
      const [nodeBlocks, nodeProgress] = await Promise.all([
        getStudentLessonContent(course.id, node.id),
        userId ? getNodeProgress(userId, course.id, node.id) : Promise.resolve(null),
      ]);
      setBlocks(nodeBlocks);
      setLessonCompleted(Boolean(nodeProgress?.completed));
      setLessonLoading(false);

      // Load assessment content after the lesson is already visible.
      void listPublishedQuestionsForLesson(node.id)
        .then(setLessonQuestions)
        .catch((error) => {
          console.error(error);
          setLessonQuestions([]);
        });
    } catch (error) {
      console.error(error);
      setLessonError(
        "Impossible de charger cette leçon. Vérifiez que la leçon et son contenu sont bien publiés, puis réessayez.",
      );
      setLessonLoading(false);
    }
  }

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const topics = nodes.filter((node) => node.type === "topic").sort((a, b) => a.order - b.order);
  const lessons = nodes.filter((node) => node.type !== "topic").sort((a, b) => a.order - b.order);
  const topicForLesson = (lesson: ContentNode) => topics.find((topic) => topic.id === lesson.parentId);
  const totalLessons = lessons.length;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  // Keep chapter navigation in the same order students see in the subject outline:
  // topics first (by topic order), then each topic's lessons (by lesson order),
  // followed by lessons that are not attached to a topic.
  const navigationLessons = (() => {
    if (!selectedNode) return [] as ContentNode[];
    const subjectNodes = nodes.filter((node) => node.courseSubjectId === selectedNode.courseSubjectId);
    const subjectTopics = subjectNodes.filter((node) => node.type === "topic").sort((a, b) => a.order - b.order);
    const subjectLessons = subjectNodes.filter((node) => node.type !== "topic");
    const ordered: ContentNode[] = subjectTopics.flatMap((topic) =>
      subjectLessons.filter((lesson) => lesson.parentId === topic.id).sort((a, b) => a.order - b.order),
    );
    ordered.push(...subjectLessons
      .filter((lesson) => !lesson.parentId || !subjectTopics.some((topic) => topic.id === lesson.parentId))
      .sort((a, b) => a.order - b.order));
    return ordered;
  })();
  const currentLessonIndex = navigationLessons.findIndex((lesson) => lesson.id === selectedNodeId);
  const navigateLesson = (lesson: ContentNode) => {
    setCommentText("");
    setReplyText("");
    setReplyingToId(null);
    setEditingCommentId(null);
    setEditingCommentText("");
    setCommentsOpen(false);
    setOpenCommentMenuId(null);
    setEmojiPickerTarget(null);
    setLessonComments([]);
    void openLesson(lesson);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!course)
    return (
      <div className="page">
        <div className="panel empty-state">Aucune préparation sélectionnée.</div>
      </div>
    );

  if (selectedNode)
    return (
      <div className="page">
        <button
          className="back"
          onClick={() => {
            setSelectedNodeId("");
            setBlocks([]);
            setLessonQuestions([]);
            setLessonComments([]);
            setCommentText("");
            setEditingCommentId(null);
            setEditingCommentText("");
            setLessonError("");
            setLessonCompleted(false);
          }}
        >
          ← Retour aux leçons
        </button>
        <div className="page-title">
          <div>
            <div className="eyebrow">{(topicForLesson(selectedNode)?.title ?? course.title).toUpperCase()}</div>
            <h1>{selectedNode.title}</h1>
            {selectedNode.description && <p>{selectedNode.description}</p>}
          </div>
          <span className={`status ${selectedNode.status === "published" ? "published" : "draft"}`}>
            {selectedNode.status === "published" ? "Publié" : "Brouillon"}
          </span>
        </div>
        {lessonError && <div className="form-error" role="alert">{lessonError}</div>}
        {lessonLoading ? (
          <div className="panel lesson-loading-state" role="status" aria-live="polite">
            <div className="lesson-loading-spinner" aria-hidden="true" />
            <div className="lesson-loading-copy">
              <strong>Chargement de la leçon</strong>
              <span>Préparation de votre contenu pédagogique...</span>
            </div>
            <div className="lesson-loading-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : blocks.length ? (
          blocks[0].type === "text" ? (
            <LessonContentReader html={String(blocks[0].content.html ?? blocks[0].content.text ?? "")} />
          ) : (
            <div className="lesson-content">
              {blocks.map((block) => (
                <div className="panel" key={block.id} style={{ marginBottom: 16 }}>
                  {block.type === "video" && block.media?.url ? (
                    <video controls width="100%" src={block.media.url} />
                  ) : block.type === "image" && block.media?.url ? (
                    <img src={block.media.url} alt="Illustration de la leçon" style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} />
                  ) : block.type === "file" && block.media?.url ? (
                    <a className="text-link" href={block.media.url} target="_blank" rel="noreferrer">Ouvrir le document</a>
                  ) : (
                    <div className="lesson-preview" dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(String(block.content.html ?? block.content.text ?? "")) }} />
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="panel empty-state">
            <h3>Cette leçon ne contient pas encore de contenu publié.</h3>
            <p>Le contenu sera disponible dès que son contenu pédagogique sera publié.</p>
          </div>
        )}
        {!lessonLoading && navigationLessons.length > 1 && currentLessonIndex >= 0 && (
          <nav className="lesson-chapter-navigation" aria-label="Navigation entre les chapitres">
            <button
              type="button"
              className="lesson-chapter-arrow lesson-chapter-previous"
              disabled={currentLessonIndex === 0}
              onClick={() => navigateLesson(navigationLessons[currentLessonIndex - 1])}
              aria-label="Aller au chapitre précédent"
              title={currentLessonIndex === 0 ? "Vous êtes au premier chapitre" : `Précédent : ${navigationLessons[currentLessonIndex - 1].title}`}
            ><span aria-hidden="true">←</span><span className="lesson-chapter-arrow-label">Précédent</span></button>
            <span className="lesson-chapter-position">Chapitre {currentLessonIndex + 1} sur {navigationLessons.length}</span>
            <button
              type="button"
              className="lesson-chapter-arrow lesson-chapter-next"
              disabled={currentLessonIndex === navigationLessons.length - 1}
              onClick={() => navigateLesson(navigationLessons[currentLessonIndex + 1])}
              aria-label="Aller au chapitre suivant"
              title={currentLessonIndex === navigationLessons.length - 1 ? "Vous êtes au dernier chapitre" : `Suivant : ${navigationLessons[currentLessonIndex + 1].title}`}
            ><span className="lesson-chapter-arrow-label">Suivant</span><span aria-hidden="true">→</span></button>
          </nav>
        )}
        {!lessonLoading && <>
        {lessonQuestions.length > 0 && (
          <LessonQuestionForm
            questions={lessonQuestions}
            lessonId={selectedNode.id}
            courseId={course.id}
            userId={userId}
          />
        )}
        <section className="lesson-comments-section">
          <div className="lesson-comments-compact-bar">
            <div className="lesson-comments-label">
              <span className="lesson-comments-icon">💬</span>
              <div><strong>Discussion</strong><small>{visibleLessonComments.length ? `${visibleLessonComments.length} commentaire${visibleLessonComments.length === 1 ? "" : "s"}` : "Posez une question sur cette leçon"}</small></div>
            </div>
            <div className="lesson-comments-actions">
              <button type="button" className="lesson-comments-toggle secondary" onClick={() => setCommentsOpen(value => !value)}>{commentsOpen ? "Fermer" : "Voir la discussion"}{visibleLessonComments.length > 0 && <span>{visibleLessonComments.length}</span>}</button>
              <button type="button" className="lesson-comments-toggle" onClick={() => { setCommentsOpen(true); setReplyingToId(null); window.setTimeout(() => document.getElementById("lesson-comment-composer")?.focus(), 0) }}>✏️ Commenter</button>
            </div>
          </div>
          {commentsOpen && <>
            <button type="button" className="lesson-comments-backdrop" aria-label="Fermer les commentaires" onClick={() => setCommentsOpen(false)} />
            <div className="lesson-comments-panel">
              <div className="lesson-comments-panel-head">
                <div><strong>Commentaires</strong><span>{visibleLessonComments.length ? `${visibleLessonComments.length} contribution${visibleLessonComments.length === 1 ? "" : "s"}` : "Soyez le premier à commenter"}</span></div>
                <button type="button" className="lesson-comments-close" aria-label="Fermer" onClick={() => setCommentsOpen(false)}>×</button>
              </div>
              <div className="lesson-comment-composer">
                <div className="lesson-comment-category-picker" role="radiogroup" aria-label="Type de commentaire">
                  <button type="button" role="radio" aria-checked={commentCategory === "course"} className={commentCategory === "course" ? "active is-course" : ""} onClick={() => setCommentCategory("course")}>📘 Question de cours</button>
                  <button type="button" role="radio" aria-checked={commentCategory === "technical"} className={commentCategory === "technical" ? "active is-technical" : ""} onClick={() => setCommentCategory("technical")}>🛠️ Problème technique</button>
                </div>
                <div className="lesson-comment-composer-row">
                  <span className="lesson-comment-avatar">{studentProfile?.photoURL ? <img src={String(studentProfile.photoURL)} alt="" className="lesson-comment-avatar-image" /> : commentInitials(String(studentProfile?.displayName ?? "Étudiant"))}</span>
                  <textarea id="lesson-comment-composer" value={commentText} onChange={event => setCommentText(event.target.value)} rows={3} maxLength={3000} placeholder={commentCategory === "technical" ? "Décrivez le problème rencontré (vidéo, document, affichage...)" : "Écrivez votre question sur le cours..."} aria-label="Votre question sur cette leçon" />
                </div>
                <div className="lesson-comment-compose-actions">
                  <div className="lesson-comment-tools"><div className="lesson-comment-emoji-wrap"><button type="button" className="lesson-comment-tool" aria-label="Ajouter un emoji" onClick={() => { setEmojiPickerTarget(value => value === "new" ? null : "new"); setOpenCommentMenuId(null); }}>☺</button>{renderEmojiPicker("new")}</div></div>
                  <span>{commentText.length}/3000</span><button type="button" className="primary" disabled={commentSaving || !commentText.trim()} onClick={() => void submitLessonComment()}>{commentSaving ? "Publication..." : "Publier"}</button>
                </div>
              </div>
              <div className="lesson-comments-list">
                {visibleLessonComments.length === 0 ? <p className="page-description">Aucun commentaire pour le moment.</p> : (() => {
                  const renderedIds = new Set<string>();
                  const roots = visibleLessonComments.filter(comment => !comment.parentCommentId);
                  const orphanReplies = visibleLessonComments.filter(comment => comment.parentCommentId && !visibleLessonComments.some(parent => parent.id === comment.parentCommentId));
                  return [...roots, ...orphanReplies].map(comment => renderCommentThread(comment, 0, renderedIds));
                })()}
              </div>
            </div>
          </>}
        </section>
        <div className="panel lesson-completion-card" style={{ marginTop: 24 }}>
          <div className="eyebrow">VOTRE PROGRESSION</div>
          <h2>{lessonCompleted ? "Leçon terminée" : "Avez-vous terminé cette leçon ?"}</h2>
          <p>{lessonCompleted ? "Votre progression a été enregistrée." : "Marquez cette leçon comme terminée pour mettre à jour votre progression."}</p>
          <button
            className={lessonCompleted ? "outline" : "primary"}
            disabled={progressSaving}
            onClick={async () => {
              if (!userId || !course || !selectedNode) return;
              const next = !lessonCompleted;
              setProgressSaving(true);
              setLessonError("");
              try {
                await saveNodeProgress({
                  userId,
                  courseId: course.id,
                  courseSubjectId: selectedNode.courseSubjectId ?? subjects[0]?.id ?? "",
                  nodeId: selectedNode.id,
                  blockId: blocks[0]?.id,
                  completed: next,
                });
                setLessonCompleted(next);
                const summary = await getCourseProgressSummary(userId, course.id);
                setProgress(summary.percent);
              } catch (error) {
                console.error(error);
                setLessonError("Impossible d’enregistrer votre progression.");
              } finally {
                setProgressSaving(false);
              }
            }}
          >
            {progressSaving ? "Enregistrement..." : lessonCompleted ? "Marquer comme non terminé" : "Marquer comme terminé"}
          </button>
        </div>
        </>}
      </div>
    );

  return (
    <div className="page">
      <button className="back" onClick={() => onBack ? onBack() : setPage("dashboard")}>← Retour</button>
      <div className="course-hero">
        <div>
          <span className="pill">{course.title}</span>
          <h1>Préparation complète</h1>
          <p>{course.description}</p>
          <div className="course-meta">
            <span>{totalLessons} leçon{totalLessons === 1 ? "" : "s"}</span>
            <span>{subjects.length} matière{subjects.length === 1 ? "" : "s"}</span>
            <span>{progress}% progression</span>
          </div>
        </div>
        <div className="ring" style={{ "--progress": `${progress}%` } as React.CSSProperties}><b>{progress}%</b><span>progression</span></div>
      </div>
      <div className="lesson-layout">
        <main>
          <div className="section-head">
            <div>
              <div className="eyebrow">PARCOURS</div>
              <h2>Votre programme</h2>
              <p className="page-description">Retrouvez vos matières, thèmes et leçons publiés.</p>
            </div>
          </div>
          {selectedSubject ? (
            <div className="student-subject-detail">
              <button className="back" onClick={() => leaveCourseView(() => { setSelectedNodeId(""); setSelectedSubjectId(""); })}>← Retour aux matières</button>
              <div className="student-subject-detail-head">
                <div>
                  <div className="eyebrow">MATIÈRE</div>
                  <h2>{selectedSubject.title}</h2>
                  {selectedSubject.description && <p>{selectedSubject.description}</p>}
                </div>
                <span className="status published">{nodes.filter((node) => node.courseSubjectId === selectedSubject.id && node.type !== "topic").length} leçon{nodes.filter((node) => node.courseSubjectId === selectedSubject.id && node.type !== "topic").length === 1 ? "" : "s"}</span>
              </div>
              {(() => {
                const subjectNodes = nodes.filter((node) => node.courseSubjectId === selectedSubject.id);
                const subjectTopics = subjectNodes.filter((node) => node.type === "topic").sort((a, b) => a.order - b.order);
                const subjectLessons = subjectNodes.filter((node) => node.type !== "topic").sort((a, b) => a.order - b.order);
                const subjectTopicIds = new Set(subjectLessons.map((lesson) => lesson.parentId).filter(Boolean));
                const subjectVisibleTopics = subjectTopics.filter((topic) => subjectTopicIds.has(topic.id));
                const subjectOrphanLessons = subjectLessons.filter((lesson) => !lesson.parentId || !subjectTopics.some((topic) => topic.id === lesson.parentId));
                return (
                  <>
                    {subjectVisibleTopics.map((topic, topicIndex) => {
                      const topicLessons = subjectLessons.filter((lesson) => lesson.parentId === topic.id);
                      return (
                        <section className="student-topic student-topic-detail" key={topic.id}>
                          <div className={`student-topic-visual ${topic.imageUrl ? "has-image" : ""}`}>
                            {topic.imageUrl && <img className="student-topic-visual-image" src={topic.imageUrl} alt="" loading="lazy" decoding="async" style={{ objectPosition: topic.imagePosition ?? "center" }} />}
                            {topic.imageUrl && <div className="student-topic-visual-overlay" aria-hidden="true" />}
                            <div className="student-topic-visual-copy"><div className="eyebrow">THÈME {topicIndex + 1}</div><h3>{topic.title}</h3>{topic.description && <p>{topic.description}</p>}<span className="topic-lesson-count">📖 {topicLessons.length} leçon{topicLessons.length === 1 ? "" : "s"}</span></div>
                          </div>
                          <div className="student-topic-title"><span>{topicIndex + 1}</span><strong>Leçons</strong><small>{topicLessons.length} leçon{topicLessons.length === 1 ? "" : "s"}</small></div>
                          <div className="student-lesson-list">
                            {topicLessons.map((lesson, index) => (
                              <button className="lesson-row" key={lesson.id} onClick={() => void openLesson(lesson)}>
                                <div className="lesson-number">{String.fromCharCode(97 + index)})</div>
                                <div><strong>{lesson.title}</strong><span>Leçon · Lecture A4</span></div>
                                <span className="lesson-head-btn">Lire →</span>
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                    {subjectOrphanLessons.length > 0 && (
                      <section className="student-topic student-topic-detail">
                        <div className="student-topic-title"><span>•</span><strong>Leçons</strong><small>{subjectOrphanLessons.length} leçon{subjectOrphanLessons.length === 1 ? "" : "s"}</small></div>
                        <div className="student-lesson-list">
                          {subjectOrphanLessons.map((lesson, index) => (
                            <button className="lesson-row" key={lesson.id} onClick={() => void openLesson(lesson)}>
                              <div className="lesson-number">{index + 1}</div>
                              <div><strong>{lesson.title}</strong><span>Leçon · Lecture A4</span></div>
                              <span className="lesson-head-btn">Lire →</span>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                    {!subjectVisibleTopics.length && !subjectOrphanLessons.length && (
                      <div className="panel empty-state"><p>Les thèmes et leçons publiés apparaîtront ici.</p></div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : subjects.length ? (
            <div className="student-subject-list">
              {subjects.map((subject) => {
                const subjectLessons = nodes.filter((node) => node.courseSubjectId === subject.id && node.type !== "topic");
                return (
                  <button className="student-subject-list-card" key={subject.id} onClick={() => { pushCourseViewHistory(subject.id); setSelectedNodeId(""); setSelectedSubjectId(subject.id); }}>
                    <div>
                      <div className="eyebrow">MATIÈRE</div>
                      <h3>{subject.title}</h3>
                      {subject.description && <p>{subject.description}</p>}
                    </div>
                    <div className="student-subject-list-meta"><span>{subjectLessons.length} leçon{subjectLessons.length === 1 ? "" : "s"}</span><b>→</b></div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="panel empty-state">
              <h3>Aucune matière publiée</h3>
              <p>Cette préparation ne contient pas encore de matière publiée.</p>
            </div>
          )}
        </main>
        <aside className="practice-card">
          <div className="eyebrow">ENTRAÎNEMENT</div>
          <h3>Testez vos connaissances</h3>
          <p>Les entraînements publiés pour cette préparation apparaîtront ici.</p>
          <button className="primary full" disabled={!subjects.length} onClick={practice}>Commencer un entraînement <Icon name="arrow" /></button>
        </aside>
      </div>
    </div>
  );
}
function Practice({
  setPage,
  onBack,
  course,
}: {
  setPage: (p: StudentPage) => void;
  onBack?: () => void;
  course?: CourseView;
}) {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [important, setImportant] = useState<QuestionSet[]>([]);
  const [activeId, setActiveId] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<{
    earned: number;
    total: number;
    percentage: number;
    pending: number;
  } | null>(null);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!course) return;
    (async () => {
      const { httpsCallable } = await import("firebase/functions");
      const { getFirebaseFunctions } = await import("./lib/firebase/functions");
      const getStudentPracticeSets = httpsCallable<
        { courseId: string },
        { sets: QuestionSet[] }
      >(getFirebaseFunctions(), "getStudentPracticeSets");
      const response = await getStudentPracticeSets({ courseId: course.id });
      const nextSets = response.data.sets.filter(item =>
        ["practice", "exercise", "quiz"].includes(item.type),
      );
      const nextImportant = response.data.sets.filter(item =>
        item.type === "important_questions",
      );
      setSets(nextSets);
      setImportant(nextImportant);
      setActiveId(nextSets[0]?.id ?? "");
    })()
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les évaluations.",
        ),
      );
  }, [course]);
  const active = sets.find((item) => item.id === activeId);
  function setAnswer(questionId: string, value: unknown) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }
  async function submit() {
    if (!active || saving) return;
    setSaving(true);
    setError("");
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getFirebaseFunctions } = await import("./lib/firebase/functions");
      const submitPractice = httpsCallable<
        { setId: string; answers: { questionId: string; answer: unknown }[] },
        {
          earnedPoints: number;
          totalPoints: number;
          percentage: number;
          pendingManualCount: number;
          results: Record<string, boolean>;
        }
      >(getFirebaseFunctions(), "submitPractice");
      const response = await submitPractice({
        setId: active.id,
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
      });
      setScore({
        earned: response.data.earnedPoints,
        total: response.data.totalPoints,
        percentage: response.data.percentage,
        pending: response.data.pendingManualCount,
      });
      setResults(response.data.results);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Impossible d’enregistrer le résultat.");
    } finally {
      setSaving(false);
    }
  }
  if (!course)
    return (
      <div className="page narrow">
        <div className="panel empty-state">
          Aucune préparation sélectionnée.
        </div>
      </div>
    );
  return (
    <div className="page narrow">
      <button className="back" onClick={() => onBack ? onBack() : setPage("course")}>
        ← Retour au parcours
      </button>
      <div className="page-title">
        <div>
          <div className="eyebrow">ÉVALUATIONS</div>
          <h1>Entraînements & quiz</h1>
          <p>Les évaluations de toutes les Matières de cette préparation.</p>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="practice-tabs">
        {sets.map((item) => (
          <button
            key={item.id}
            className={activeId === item.id ? "active" : ""}
            onClick={() => {
              setActiveId(item.id);
              setSubmitted(false);
              setAnswers({});
              setScore(null);
              setResults({});
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
      {active && !submitted && (
        <div className="panel">
          <div className="eyebrow">
            {active.type === "quiz"
              ? "QUIZ"
              : active.type === "exercise"
                ? "EXERCICE"
                : "ENTRAÎNEMENT"}
          </div>
          <h2>{active.title}</h2>
          <p>{active.description}</p>
          {active.questions.map((q, index) => (
            <div className="practice-question" key={q.id}>
              <strong>
                {index + 1}.{" "}
                {String(
                  q.questionContent.text ??
                    q.questionContent.html ??
                    "Question",
                )}
              </strong>
              {q.type === "multiple_choice" && (
                <div className="quiz-options">
                  {(q.options ?? []).map((o) => (
                    <button
                      key={o.id}
                      className={answers[q.id] === o.id ? "selected" : ""}
                      onClick={() => setAnswer(q.id, o.id)}
                    >
                      {o.label}. {o.text}
                    </button>
                  ))}
                </div>
              )}
              {q.type === "multiple_select" && (
                <div className="quiz-options">
                  {(q.options ?? []).map((o) => {
                    const current = Array.isArray(answers[q.id])
                      ? (answers[q.id] as unknown[])
                      : [];
                    const selected = current.includes(o.id);
                    return (
                      <label className="practice-option" key={o.id}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) =>
                            setAnswer(
                              q.id,
                              e.target.checked
                                ? [...current, o.id]
                                : current.filter((v) => v !== o.id),
                            )
                          }
                        />
                        <span>
                          {o.label}. {o.text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {q.type === "true_false" && (
                <div className="quiz-options">
                  <button
                    className={answers[q.id] === true ? "selected" : ""}
                    onClick={() => setAnswer(q.id, true)}
                  >
                    Vrai
                  </button>
                  <button
                    className={answers[q.id] === false ? "selected" : ""}
                    onClick={() => setAnswer(q.id, false)}
                  >
                    Faux
                  </button>
                </div>
              )}
              {q.type === "short_answer" && (
                <input
                  className="fake-input"
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Votre réponse"
                />
              )}
              {q.type === "numeric" && (
                <input
                  className="fake-input"
                  type="number"
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Votre réponse"
                />
              )}
              {q.type === "written" && (
                <textarea
                  className="fake-textarea"
                  rows={5}
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Votre réponse"
                />
              )}
            </div>
          ))}
          <button
            className="primary"
            disabled={saving || !Object.keys(answers).length}
            onClick={() => void submit()}
          >
            {saving ? "Correction..." : "Terminer et voir le résultat"}
          </button>
        </div>
      )}
      {submitted && active && (
        <div className="panel result-card">
          <div className="eyebrow">RÉSULTAT</div>
          {active.settings?.showScore !== false && (
            <>
              <h1>{score?.percentage ?? 0}%</h1>
              <p>
                {score?.earned ?? 0} / {score?.total ?? 0} point(s)
              </p>
              {active.settings?.passingScore !== undefined && (
                <p>
                  {(score?.percentage ?? 0) >= active.settings.passingScore
                    ? "Réussi"
                    : "À revoir"}{" "}
                  · seuil {active.settings.passingScore}%
                </p>
              )}
            </>
          )}
          {active.settings?.showCorrections !== false &&
            active.questions.map(
              (q) =>
                q.type !== "written" && (
                  <p key={q.id}>
                    <strong>
                      {results[q.id] ? "✓ Correct" : "✗ Incorrect"}
                    </strong>
                    {active.settings?.showExplanations !== false &&
                    q.explanation
                      ? ` — ${q.explanation}`
                      : ""}
                  </p>
                ),
            )}
          <div className="editor-actions">
            <button
              className="primary"
              onClick={() => {
                if (active.settings?.allowRetry !== false) {
                  setSubmitted(false);
                  setAnswers({});
                  setResults({});
                  setScore(null);
                }
              }}
            >
              Recommencer
            </button>
            <button className="outline" onClick={() => setPage("course")}>
              Retour au cours
            </button>
          </div>
        </div>
      )}
      {important.length > 0 && (
        <div className="panel" style={{ marginTop: 24 }}>
          <div className="eyebrow">RÉVISION</div>
          <h2>Questions importantes</h2>
          {important.map((item) => (
            <div key={item.id} style={{ marginTop: 18 }}>
              <h3>{item.title}</h3>
              {item.questions.map((q, i) => (
                <p key={q.id}>
                  <strong>{i + 1}. </strong>
                  {String(
                    q.questionContent.text ??
                      q.questionContent.html ??
                      "Question",
                  )}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
      {!sets.length && !important.length && (
        <div className="panel empty-state">
          <h3>Aucune évaluation publiée.</h3>
          <p>
            Les quiz et exercices publiés par le gestionnaire de contenu
            apparaîtront ici.
          </p>
        </div>
      )}
    </div>
  );
}
function EnrollmentFlow({
  setPage,
  onBack,
  course,
  userId,
}: {
  setPage: (p: StudentPage) => void;
  onBack?: () => void;
  course?: CourseView;
  userId?: string;
}) {
  const [step, setStep] = useState<"course" | "payment" | "pending">("course");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState<
    "mvola" | "orange_money" | "airtel_money"
  >("mvola");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<Enrollment | null>(null);
  useEffect(() => {
    if (!userId || !course) return;
    void getEnrollment(userId, course.id)
      .then(setExisting)
      .catch(() => undefined);
  }, [userId, course]);
  if (!course || !userId)
    return (
      <div className="page narrow">
        <div className="panel empty-state">
          Cette préparation n'est plus disponible.
        </div>
      </div>
    );
  const existingActive = isEnrollmentCurrentlyActive(existing);
  if (existingActive)
    return (
      <div className="page narrow">
        <div className="pending-card">
          <div className="pending-icon">✓</div>
          <div className="eyebrow">ACCÈS ACTIVÉ</div>
          <h1>Vous êtes déjà inscrit.</h1>
          <p>Votre accès à <strong>{course.title}</strong> est actif{existing?.expiresAt ? <> pour <strong>{Math.max(0, Math.ceil((existing.expiresAt.getTime() - Date.now()) / 86400000))} jour(s) restant(s)</strong></> : ''}.</p>
          {existing?.expiresAt && <div className="catalog-access-status"><span>Expiration</span><strong>{existing.expiresAt.toLocaleDateString("fr-FR", { dateStyle: "long" })}</strong></div>}
          <button className="primary" onClick={() => setPage("course")}>
            Accéder à ma préparation <Icon name="arrow" />
          </button>
        </div>
      </div>
    );
  async function sendPayment() {
    const currentUserId = userId;
    const currentCourse = course;
    if (!currentUserId || !currentCourse || !reference.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      await submitPayment({
        userId: currentUserId,
        courseId: currentCourse.id,
        amount: currentCourse.price,
        reference: reference.trim(),
        method,
      });
      setStep("pending");
    } catch (err) {
      console.error(err);
      setError(
        "Impossible d’enregistrer votre demande. Vérifiez votre connexion et réessayez.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  if (step === "course")
    return (
      <div className="page">
        <button className="back" onClick={() => onBack ? onBack() : setPage("catalog")}>
          ← Retour au catalogue
        </button>
        <div className="enroll-hero">
          <div>
            <span className="pill enroll-status-pill">INSCRIPTION</span>
            <h1>{course.title}</h1>
            <p>{course.description}</p>
          </div>
          <div className="price-box">
            <span>Accès à la préparation</span>
            <strong>{formatPrice(course.price)} Ar</strong>
          </div>
        </div>
        <div className="enroll-grid">
          <div className="panel about-course-panel">
            <div className="eyebrow">À PROPOS DU CONCOURS</div>
            <h2>À propos du concours</h2>
            <div className="course-about-content">
              <p>{course.description}</p>
            </div>
          </div>
          <div className="panel payment-choice">
            <div className="eyebrow">INSCRIPTION</div>
            <h2>Prêt à commencer ?</h2>
            <p>
              Après votre paiement, indiquez la référence de la transaction.
              L'administration vérifiera le paiement avant d'activer votre
              accès.
            </p>
            <button className="primary full" onClick={() => setStep("payment")}>
              Continuer vers le paiement <Icon name="arrow" />
            </button>
            <small>
              Votre inscription sera d'abord en attente de validation.
            </small>
          </div>
        </div>
      </div>
    );
  if (step === "payment")
    return (
      <div className="page narrow">
        <button className="back" onClick={() => setStep("course")}>
          ← Retour
        </button>
        <div className="payment-page">
          <div className="stepper">
            <span className="done">1</span>
            <i></i>
            <span className="active">2</span>
            <i></i>
            <span>3</span>
          </div>
          <div className="eyebrow">ÉTAPE 2 · PAIEMENT</div>
          <h1>Effectuez votre paiement</h1>
          <p>
            Payez le montant de <strong>{formatPrice(course.price)} Ar</strong> avec l'un des moyens disponibles, puis saisissez la référence de transaction.
          </p>
          <div className="payment-methods">
            {(
              [
                ["mvola", "MVola"],
                ["orange_money", "Orange Money"],
                ["airtel_money", "Airtel Money"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={`pay-method ${method === value ? "selected" : ""}`}
                onClick={() => setMethod(value)}
              >
                <strong>{label}</strong>
                <span>Mobile Money</span>
                <b>{formatPrice(course.price)} Ar</b>
              </button>
            ))}
          </div>
          <div className="payment-instructions">
            <div className="qr-demo">QR</div>
            <div>
              <strong>Instructions de paiement</strong>
              <p>
                Utilisez le numéro de paiement indiqué par CAV Madagascar,
                effectuez le paiement, puis conservez votre référence de
                transaction.
              </p>
              <small>
                La référence doit correspondre au paiement effectué.
              </small>
            </div>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <label className="payment-label">Référence de transaction</label>
          <input
            className="payment-input"
            placeholder="Ex. MV-2026-000184"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <button
            className="primary full"
            disabled={!reference.trim() || submitting}
            onClick={() => void sendPayment()}
          >
            {submitting
              ? "Enregistrement..."
              : "Envoyer ma demande d’inscription"}{" "}
            <Icon name="arrow" />
          </button>
          <div className="secure-note">
            🔒 Votre demande sera enregistrée avec le statut{" "}
            <strong>En attente</strong> jusqu'à vérification par
            l'administration.
          </div>
        </div>
      </div>
    );
  return (
    <div className="page narrow">
      <div className="pending-card">
        <div className="pending-icon">✓</div>
        <div className="eyebrow">DEMANDE ENREGISTRÉE</div>
        <h1>Votre inscription est en attente.</h1>
        <p>
          Votre référence <strong>{reference}</strong> a bien été envoyée. L'administration va vérifier le paiement avant d’activer votre accès à cette préparation.
        </p>
        <div className="status-timeline">
          <div className="active">
            <span>✓</span>
            <div>
              <strong>Demande envoyée</strong>
              <small>Votre référence a été enregistrée.</small>
            </div>
          </div>
          <div>
            <span>2</span>
            <div>
              <strong>Vérification du paiement</strong>
              <small>En attente de validation par l'administration.</small>
            </div>
          </div>
          <div>
            <span>3</span>
            <div>
              <strong>Accès activé</strong>
              <small>Vous aurez accès après validation.</small>
            </div>
          </div>
        </div>
        <button className="primary" onClick={() => setPage("dashboard")}>
          Retour au tableau de bord <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}

function AdminOverview({
  setPage,
  courses,
}: {
  setPage: (p: AdminPage) => void;
  courses: CourseView[];
}) {
  const [pending, setPending] = useState<Payment[]>([]);
  useEffect(() => {
    void listPendingPayments().then(setPending).catch(console.error);
  }, []);
  const publishedCount = courses.filter(
    (course) => course.status === "published",
  ).length;
  return (
    <div className="page">
      <div className="hero">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>
            Vue d’ensemble<span>.</span>
          </h1>
          <p>
            Pilotez les concours, contenus, inscriptions et résultats depuis un
            seul espace.
          </p>
        </div>
        <button className="primary" onClick={() => setPage("courses")}>
          <Icon name="plus" /> Nouveau concours
        </button>
      </div>
      <div className="stat-grid">
        {[
          [String(publishedCount), "Concours publiés", "Données Firestore"],
          [String(pending.length), "Paiements en attente", "À vérifier"],
          ["—", "Étudiants actifs", "Données utilisateur"],
          ["—", "Résultats", "Données d’entraînement"],
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <span>{s[1]}</span>
            <strong>{s[0]}</strong>
            <small>{s[2]}</small>
          </div>
        ))}
      </div>
      <div className="admin-columns">
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">CONTENU</div>
              <h2>Concours récents</h2>
            </div>
            <button className="link-button" onClick={() => setPage("courses")}>
              Tout voir →
            </button>
          </div>
          {courses.length ? (
            courses.map((c) => (
              <div className="admin-course admin-course-compact" key={c.id}>
                <div className="admin-course-copy">
                  <strong>{c.title}</strong>
                  <span>{c.subjects.length} {c.subjects.length === 1 ? "matière" : "matières"}</span>
                </div>
                <span
                  className={`status ${c.status === "published" ? "published" : "draft"}`}
                >
                  {c.status === "published" ? "Publié" : "Brouillon"}
                </span>
              </div>
            ))
          ) : (
            <div className="empty-state">Aucun concours enregistré.</div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">À TRAITER</div>
              <h2>Inscriptions</h2>
            </div>
            <button
              className="link-button"
              onClick={() => setPage("enrollments")}
            >
              Voir tout →
            </button>
          </div>
          {pending.length ? (
            pending.slice(0, 5).map((p) => (
              <div className="admin-course" key={p.id}>
                <div className="avatar">ET</div>
                <div>
                  <strong>{p.reference}</strong>
                  <span>
                    {formatPrice(p.amount)} Ar · {p.method}
                  </span>
                </div>
                <span className="status pending">À vérifier</span>
              </div>
            ))
          ) : (
            <div className="admin-payments-empty">
              <div className="admin-empty-icon"><Icon name="check" /></div>
              <strong>Aucune inscription à traiter</strong>
              <p>Tous les paiements soumis ont été vérifiés. Les nouvelles demandes apparaîtront ici.</p>
              <span className="admin-clear-status"><i /> Tout est à jour</span>
            </div>
          )}
          <div className="admin-quick-actions">
            <div className="admin-quick-actions-title">Accès rapides</div>
            <button onClick={() => setPage("enrollments")}><span className="admin-quick-icon blue"><Icon name="file" /></span><span><strong>Gérer les inscriptions</strong><small>Consulter les demandes et paiements</small></span><b>→</b></button>
            <button onClick={() => setPage("users")}><span className="admin-quick-icon violet"><Icon name="users" /></span><span><strong>Voir les utilisateurs</strong><small>Suivre les comptes étudiants</small></span><b>→</b></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminSubjects({
  userId,
  onOpenSubject,
}: {
  userId: string;
  onOpenSubject: (subjectId: string) => void;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [matricule, setMatricule] = useState("");
  const [niveau, setNiveau] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [subjectSearch, setSubjectSearch] = useState("");

  async function refresh() {
    setSubjects(await listAdminSubjects());
  }
  useEffect(() => {
    void refresh().catch((error) =>
      setError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les matières.",
      ),
    );
  }, []);

  const normalizeSubjectSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const subjectSearchTerms = normalizeSubjectSearch(subjectSearch).split(" ").filter(Boolean);
  const visibleSubjects = subjectSearchTerms.length
    ? subjects.filter((subject) => {
        const haystack = normalizeSubjectSearch([subject.name, subject.matricule, subject.niveau, subject.description, subject.status === "published" ? "publie" : "brouillon"].filter(Boolean).join(" "));
        return subjectSearchTerms.every((term) => haystack.includes(term));
      })
    : subjects;

  function reset() {
    setEditingId(null);
    setName("");
    setMatricule("");
    setNiveau("");
    setDescription("");
    setShowCreate(false);
  }
  function edit(subject: Subject) {
    setEditingId(subject.id);
    setName(subject.name);
    setMatricule(subject.matricule);
    setNiveau(subject.niveau);
    setDescription(subject.description);
    setShowCreate(true);
  }

  async function save() {
    if (!name.trim() || !matricule.trim() || !niveau.trim()) {
      setError("Le nom, le matricule et le niveau de la matière sont obligatoires.");
      return;
    }
    const normalizedMatricule = matricule.trim().toUpperCase();
    const duplicate = subjects.some((item) => item.id !== editingId && item.matricule.trim().toUpperCase() === normalizedMatricule);
    if (duplicate) {
      setError(`Le matricule « ${normalizedMatricule} » est déjà utilisé.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId)
        await updateSubject(
          editingId,
          { name: name.trim(), matricule: normalizedMatricule, niveau: niveau.trim(), description: description.trim() },
          userId,
        );
      else
        await createSubject({
          name: name.trim(),
          matricule: normalizedMatricule,
          niveau: niveau.trim(),
          description: description.trim(),
          userId,
        });
      reset();
      await refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer la matière.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggle(subject: Subject) {
    try {
      await updateSubject(
        subject.id,
        { status: subject.status === "published" ? "draft" : "published" },
        userId,
      );
      await refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Impossible de modifier le statut.",
      );
    }
  }

  async function remove(subject: Subject) {
    if (removingId) return;
    document.querySelectorAll(".subject-card details.course-actions-menu[open]").forEach((menu) => menu.removeAttribute("open"));
    setError("");
    setRemovingId(subject.id);
    try {
      const deps = await getSubjectDependencies(subject.id);
      const parts = [
        deps.nodes ? `${deps.nodes} thème(s) et leçon(s)` : "",
        deps.blocks ? `${deps.blocks} contenu(s) de leçon` : "",
        deps.questions ? `${deps.questions} question(s)` : "",
        deps.questionSets ? `${deps.questionSets} évaluation(s)` : "",
      ].filter(Boolean);
      const hint = (
        <>
          {deps.courses.length ? <>Elle sera retirée de {deps.courses.length} concours : <strong>{deps.courses.map((course) => course.title).join(", ")}</strong>. </> : null}
          {parts.length ? <>Seront également supprimés : {parts.join(", ")}.</> : "Cette matière ne contient aucun contenu."}
        </>
      );
      const confirmed = await confirmAction({
        title: "Supprimer cette matière ?",
        description: <>La matière <strong>« {subject.name} »</strong> sera supprimée définitivement. Cette action est irréversible.</>,
        hint,
      });
      if (!confirmed) return;
      await deleteSubject(subject.id);
      if (editingId === subject.id) reset();
      await refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer la matière.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-title subject-page-header">
        <div>
          <div className="eyebrow">BIBLIOTHÈQUE PÉDAGOGIQUE</div>
          <h1>Matières</h1>
          <p>Chaque matière contient ses chapitres, leçons, quiz et exercices.</p>
        </div>
        <button className="primary" onClick={() => { reset(); setShowCreate(true); }}>
          <Icon name="plus" /> Ajouter une matière
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {showCreate && (
        <div className="panel compact-create-panel">
          <div className="create-head">
            <div>
              <div className="eyebrow">{editingId ? "MODIFICATION" : "NOUVELLE MATIÈRE"}</div>
              <h2>{editingId ? "Modifier la matière" : "Créer une matière"}</h2>
            </div>
          </div>
          <div className="form-grid">
            <label>Nom de la matière<input className="fake-input" value={name} onChange={e => setName(e.target.value)} placeholder="Mathématiques" autoFocus /></label>
            <label>Matricule / code<input className="fake-input" value={matricule} onChange={e => setMatricule(e.target.value)} placeholder="MAT-001" /></label>
            <label>Niveau<input className="fake-input" value={niveau} onChange={e => setNiveau(e.target.value)} placeholder="Niveau II" /></label>
            <label className="wide">Description <span className="optional-label">(facultative)</span><textarea className="fake-textarea short" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Courte description de la matière" /></label>
          </div>
          <div className="association-note">
            <strong>Identification unique.</strong> Le matricule distingue les matières qui portent le même nom à des niveaux différents.
          </div>
          <div className="editor-actions">
            <button className="primary" disabled={saving} onClick={() => void save()}>{saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Créer la matière"}</button>
            <button className="outline" onClick={reset}>Annuler</button>
          </div>
        </div>
      )}
      <div className="section-head course-admin-head">
        <div><div className="eyebrow">VOTRE BIBLIOTHÈQUE</div><h2>{subjects.length ? (subjectSearchTerms.length ? `${visibleSubjects.length} résultat${visibleSubjects.length > 1 ? "s" : ""} sur ${subjects.length} matière${subjects.length > 1 ? "s" : ""}` : `${subjects.length} matière${subjects.length > 1 ? "s" : ""}`) : "Aucune matière"}</h2></div>
      </div>
      {subjects.length > 0 && (
        <div className="catalog-toolbar subject-search-toolbar" role="search">
          <div className="catalog-search">
            <Icon name="search" />
            <input type="search" value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setSubjectSearch(""); }} placeholder="Rechercher une matière, un code ou un niveau…" aria-label="Rechercher une matière" />
            {subjectSearch && <button type="button" className="subject-search-clear" aria-label="Effacer la recherche" onClick={() => setSubjectSearch("")}>×</button>}
          </div>
        </div>
      )}
      {subjects.length && !visibleSubjects.length ? (
        <div className="panel empty-state"><h3>Aucune matière trouvée.</h3><p>Aucun résultat pour « {subjectSearch.trim()} ». Vérifiez l’orthographe ou essayez un autre mot-clé.</p><button type="button" className="outline" onClick={() => setSubjectSearch("")}>Effacer la recherche</button></div>
      ) : subjects.length ? (
        <div className="subject-card-list">
          {visibleSubjects.map(subject => (
            <article className="panel subject-card" key={subject.id}>
              <div className="subject-card-main">
                <div className="subject-icon"><Icon name="book" /></div>
                <div><div className="subject-card-title-row"><h3>{subject.name}</h3><span className={`status ${subject.status === "published" ? "published" : "draft"}`}>{subject.status === "published" ? "Publié" : "Brouillon"}</span></div><div className="subject-meta"><span>{subject.matricule || "Sans matricule"}</span><span>{subject.niveau || "Niveau non renseigné"}</span></div><p>{subject.description || "Aucune description."}</p></div>
              </div>
              <div className="subject-card-actions">
                <button className="primary small-btn" onClick={() => onOpenSubject(subject.id)}>Ouvrir <Icon name="arrow" /></button>
                <details className="course-actions-menu"><summary aria-label="Autres actions" title="Autres actions">•••</summary><div className="course-actions-popover" role="menu">
                  <button type="button" role="menuitem" onClick={() => edit(subject)}>Modifier</button>
                  <button type="button" role="menuitem" onClick={() => void toggle(subject)}>{subject.status === "published" ? "Dépublier" : "Publier"}</button>
                  <button type="button" role="menuitem" className="danger" disabled={removingId === subject.id} onClick={() => void remove(subject)}>{removingId === subject.id ? "Suppression…" : "Supprimer"}</button>
                </div></details>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel empty-state"><h3>Votre bibliothèque est vide.</h3><p>Créez votre première matière pour commencer à organiser les cours.</p><button className="primary" onClick={() => setShowCreate(true)}><Icon name="plus" /> Ajouter une matière</button></div>
      )}
    </div>
  );
}

function AdminCourses({
  courses,
  userId,
  groups,
  onGroupsChanged,
  coursesLoading,
}: {
  courses: CourseView[];
  userId: string;
  groups: CourseGroup[];
  onGroupsChanged: () => Promise<void>;
  coursesLoading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [accessDurationDays, setAccessDurationDays] = useState("30");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseEditorOpen, setCourseEditorOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [courseSubjects, setCourseSubjects] = useState<CourseSubject[]>([]);
  const [subjectToAdd, setSubjectToAdd] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupEditingId, setGroupEditingId] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupColor, setGroupColor] = useState<CourseCardColor>("blue");
  const [selectedGroupCourseIds, setSelectedGroupCourseIds] = useState<string[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);

  function resetGroupForm() {
    setShowGroupForm(false);
    setGroupEditingId(null);
    setGroupTitle("");
    setGroupDescription("");
    setGroupColor("blue");
    setSelectedGroupCourseIds([]);
  }
  function editGroup(group: CourseGroup) {
    setShowGroupForm(true);
    setGroupEditingId(group.id);
    setGroupTitle(group.title);
    setGroupDescription(group.description);
    setGroupColor(group.cardColor);
    setSelectedGroupCourseIds(courses.filter((course) => course.groupId === group.id).map((course) => course.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveGroup() {
    if (!groupTitle.trim()) return;
    setGroupSaving(true);
    setError("");
    try {
      let groupId = groupEditingId;
      if (groupId) {
        await updateCourseGroup(groupId, { title: groupTitle, description: groupDescription, cardColor: groupColor }, userId);
      } else {
        groupId = await createCourseGroup({ title: groupTitle, description: groupDescription, cardColor: groupColor, userId });
      }
      const currentGroupCourseIds = courses.filter((course) => course.groupId === groupId).map((course) => course.id);
      const toUnassign = currentGroupCourseIds.filter((id) => !selectedGroupCourseIds.includes(id));
      const toAssign = selectedGroupCourseIds.filter((id) => !currentGroupCourseIds.includes(id));
      await Promise.all([
        ...toUnassign.map((id) => updateCourse(id, { groupId: null }, userId)),
        ...toAssign.map((id) => updateCourse(id, { groupId }, userId)),
      ]);
      resetGroupForm();
      await onGroupsChanged();
    } catch (e) {
      console.error(e);
      setError("Impossible d’enregistrer le groupement.");
    } finally {
      setGroupSaving(false);
    }
  }
  async function removeGroup(group: CourseGroup) {
    if (!(await confirmAction({ title: "Supprimer ce groupement ?", description: <>Le groupement <strong>« {group.title} »</strong> sera supprimé définitivement.</>, hint: "Les concours resteront disponibles." }))) return;
    try {
      await Promise.all(courses.filter((course) => course.groupId === group.id).map((course) => updateCourse(course.id, { groupId: null }, userId)));
      await deleteCourseGroup(group.id);
      await onGroupsChanged();
    } catch (e) {
      console.error(e);
      setError("Impossible de supprimer le groupement.");
    }
  }

  function resetForm() {
    setTitle("");
    setSlug("");
    setDescription("");
    setPrice("");
    setAccessDurationDays("30");
    setThumbnailUrl("");
    setThumbnailFile(null);
    setThumbnailPreview("");
    setRemoveThumbnail(false);
    setEditingId(null);
    setCourseEditorOpen(false);
    setCourseSubjects([]);
    setSelectedSubjectIds([]);
    setSubjectToAdd("");
  }
  async function openCreateCourse() {
    resetForm();
    setCourseEditorOpen(true);
    setShowGroupForm(false);
    setError("");
    try {
      setAvailableSubjects(await listAdminSubjects());
    } catch (error) {
      console.error(error);
      setError("Impossible de charger les matières.");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function editCourse(course: CourseView) {
    setEditingId(course.id);
    setCourseEditorOpen(true);
    setTitle(course.title);
    setSlug(course.slug);
    setDescription(course.description);
    setPrice(String(course.price));
    setAccessDurationDays(String(course.accessDurationDays ?? 30));
    setThumbnailUrl(course.thumbnailUrl ?? "");
    setThumbnailFile(null);
    setThumbnailPreview(course.thumbnailUrl ?? "");
    setRemoveThumbnail(false);
    setError("");
    const existingCourseSubjects = await listCourseSubjects(course.id, false);
    setCourseSubjects(existingCourseSubjects);
    setSelectedSubjectIds(existingCourseSubjects.map((item) => item.subjectId));
    setAvailableSubjects(await listAdminSubjects());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function uploadCourseThumbnail(courseId: string, file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Le fichier doit être une image.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("L’image ne doit pas dépasser 5 Mo.");
    }

    const extension =
      file.type === "image/webp"
        ? "webp"
        : file.type === "image/png"
          ? "png"
          : "jpg";
    const target = storageRef(
      getFirebaseStorage(),
      `courses/${courseId}/thumbnails/thumbnail.${extension}`,
    );

    await uploadBytes(target, file, {
      contentType: file.type,
      cacheControl: "public,max-age=31536000,immutable",
    });
    return getDownloadURL(target);
  }

  async function save() {
    setError("");
    if (!title.trim()) {
      setError("Le nom du concours est obligatoire.");
      return;
    }
    if (!description.trim()) {
      setError("La présentation du concours est obligatoire.");
      return;
    }
    const generatedSlug = slug.trim() || title.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    setSaving(true);
    try {
      const payload = { title: title.trim(), slug: generatedSlug, description: description.trim(), price: Number(price || 0), accessDurationDays: Math.max(1, Math.floor(Number(accessDurationDays) || 30)), cardColor: "blue" as CourseCardColor };
      if (editingId) {
        let nextThumbnail = thumbnailUrl;
        if (removeThumbnail) nextThumbnail = "";
        if (thumbnailFile) nextThumbnail = await uploadCourseThumbnail(editingId, thumbnailFile);
        await updateCourse(editingId, { ...payload, thumbnailUrl: nextThumbnail || null }, userId);
        await onGroupsChanged();
        resetForm();
        return;
      } else {
        const courseId = await createCourse({ ...payload, userId });
        if (thumbnailFile) {
          const uploadedUrl = await uploadCourseThumbnail(courseId, thumbnailFile);
          await updateCourse(courseId, { thumbnailUrl: uploadedUrl }, userId);
        }
        for (const [order, subjectId] of selectedSubjectIds.entries()) {
          const subject = availableSubjects.find((item) => item.id === subjectId);
          if (!subject) continue;
          await attachSubject({
            courseId,
            subjectId: subject.id,
            title: subject.name,
            matricule: subject.matricule,
            niveau: subject.niveau,
            description: subject.description,
            order,
            userId,
          });
        }
        await onGroupsChanged();
        resetForm();
        return;
      }
    } catch (e) {
      console.error(e);
      setError(
        editingId
          ? "Impossible de modifier le concours."
          : "Impossible de créer le concours.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function togglePublish(course: CourseView) {
    setError("");
    try {
      await updateCourse(
        course.id,
        { status: course.status === "published" ? "draft" : "published" },
        userId,
      );
      await onGroupsChanged();
    } catch (e) {
      console.error(e);
      setError("Impossible de modifier le statut du concours.");
    }
  }
  async function remove(course: CourseView) {
    if (deletingId) return;
    if (!(await confirmAction({ title: "Supprimer ce concours ?", description: <>Le concours <strong>« {course.title} »</strong> sera supprimé définitivement. Cette action est irréversible.</> }))) return;
    setError("");
    setDeletingId(course.id);
    try {
      await deleteCourse(course.id);
      if (editingId === course.id) resetForm();
      await onGroupsChanged();
    } catch (e) {
      console.error(e);
      setError(
        "Impossible de supprimer le concours. Vérifiez qu’il n’est pas encore utilisé.",
      );
    } finally {
      setDeletingId(null);
    }
  }
  async function addSubject() {
    if (!subjectToAdd) return;
    const subject = availableSubjects.find((item) => item.id === subjectToAdd);
    if (!subject) return;
    if (selectedSubjectIds.includes(subject.id)) {
      setError("Cette matière est déjà sélectionnée pour ce concours.");
      return;
    }
    try {
      if (editingId) {
        await attachSubject({
          courseId: editingId,
          subjectId: subject.id,
          title: subject.name,
          matricule: subject.matricule,
          niveau: subject.niveau,
          description: subject.description,
          order: courseSubjects.length,
          userId,
        });
        setCourseSubjects(await listCourseSubjects(editingId, false));
      }
      setSelectedSubjectIds((current) => [...current, subject.id]);
      setSubjectToAdd("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossible d’ajouter la matière.");
    }
  }
  function removeSelectedSubject(subjectId: string) {
    setSelectedSubjectIds((current) => current.filter((id) => id !== subjectId));
  }
  async function removeCourseSubject(item: CourseSubject) {
    if (
      !editingId ||
      !(await confirmAction({ title: "Retirer cette matière du concours ?", description: <>La matière <strong>« {item.title} »</strong> ne fera plus partie de ce concours.</>, confirmLabel: "Retirer" }))
    )
      return;
    try {
      await deleteCourseSubject(item.id);
      setSelectedSubjectIds((current) => current.filter((id) => id !== item.subjectId));
      setCourseSubjects(await listCourseSubjects(editingId, false));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Impossible de retirer la matière.",
      );
    }
  }
  if (courseEditorOpen) {
    return (
      <>
        {coursesLoading ? <LightweightLoader label="Mise à jour des concours…" /> : null}
        <div className="page course-editor-page">
        <button className="back course-editor-back" type="button" onClick={resetForm}>← Retour aux concours</button>
        <div className="course-editor-shell">
      <div className="create-course-demo panel">
        <div className="course-editor-intro">
          <div>
            <span className="pill blue-pill">{editingId ? "MODIFICATION" : "CRÉATION"}</span>
            <h2>{editingId ? "Modifier le concours" : "Créer un concours"}</h2>
            <p>Les matières sont créées dans leur bibliothèque puis réutilisées ici.</p>
          </div>
          <span className="status draft">Brouillon</span>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-grid">
          <div>
            <label>
              Nom du concours
              <input
                className="fake-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Inspecteur de police"
              />
            </label>
          </div>
          <div className="wide">
            <label>
              À propos du concours <span className="required-label">*</span>
              <textarea
                className="fake-textarea short"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Présentez le concours, son objectif, le public concerné et ce que la préparation couvre…"
              />
              <span className="form-help">Ce texte sera affiché aux étudiants dans la section « À propos du concours ».</span>
            </label>
          </div>
          <div>
            <label>
              Prix (MGA)
              <input
                className="fake-input"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
          </div>
          <div>
            <label>
              Durée d’accès
              <div className="input-with-suffix"><input className="fake-input" type="number" min="1" value={accessDurationDays} onChange={e => setAccessDurationDays(e.target.value)} /><span>jours</span></div>
            </label>
            <span className="form-help">Après cette durée, l’étudiant devra renouveler son accès.</span>
          </div>
          <div className="concours-image-field wide">
            <div>
              <strong>Image du concours <span className="optional-label">(facultative)</span></strong>
              <p className="form-help">Cette image sera affichée sur les cartes du concours. Sans image, CAV utilise le visuel neutre par défaut.</p>
            </div>
            {thumbnailPreview ? (
              <div className="concours-image-preview">
                <img src={thumbnailPreview} alt="Aperçu de l’image du concours" />
                <div>
                  <span>{thumbnailFile ? "Nouvelle image sélectionnée" : "Image actuelle"}</span>
                  <div className="image-preview-actions">
                    <label className="outline image-change-button">Remplacer<input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0] ?? null; if (!file) return; setThumbnailFile(file); setThumbnailPreview(URL.createObjectURL(file)); setRemoveThumbnail(false); }} /></label>
                    <button type="button" className="outline danger-outline" onClick={() => { setThumbnailFile(null); setThumbnailPreview(""); setThumbnailUrl(""); setRemoveThumbnail(true); }}>Supprimer</button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="concours-image-drop">
                <input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0] ?? null; if (!file) return; setThumbnailFile(file); setThumbnailPreview(URL.createObjectURL(file)); setRemoveThumbnail(false); }} />
                <span>Ajouter une image</span>
                <small>JPG, PNG ou WebP · 5 Mo maximum</small>
              </label>
            )}
          </div>
        </div>
        <div className="association-note">
          <strong>Réutilisation des Matières.</strong> Sélectionnez une matière existante par son nom, matricule et niveau. Une même matière peut être utilisée par plusieurs concours sans dupliquer son contenu.
        </div>
        <div className="editor-actions">
          <button
            className="primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving
              ? "Enregistrement..."
              : editingId
                ? "Enregistrer les modifications"
                : "Enregistrer le concours"}
          </button>
          {editingId && (
            <button className="outline" disabled={saving} onClick={resetForm}>
              Annuler
            </button>
          )}
        </div>
      </div>
      <section className="panel course-editor-subjects" style={{ marginBottom: 0 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">PROGRAMME</div>
            <h2>Matières de ce concours</h2>
            <p>Choisissez les matières existantes. Le matricule et le niveau permettent de distinguer les intitulés identiques.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="wide">Ajouter une matière
            <select className="fake-input" value={subjectToAdd} onChange={(e) => setSubjectToAdd(e.target.value)}>
              <option value="">Sélectionner une matière</option>
              {availableSubjects
                .filter((subject) => subject.status === "published" && !selectedSubjectIds.includes(subject.id))
                .map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} · {subject.matricule || "sans code"} · {subject.niveau || "niveau non renseigné"}
                  </option>
                ))}
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="primary" type="button" onClick={() => void addSubject()} disabled={!subjectToAdd}>Ajouter</button>
          </div>
        </div>
        <div className="selected-subject-list" style={{ marginTop: 18 }}>
          {selectedSubjectIds.length ? selectedSubjectIds.map((subjectId, index) => {
            const subject = availableSubjects.find((item) => item.id === subjectId);
            if (!subject) return null;
            const linked = courseSubjects.find((item) => item.subjectId === subjectId);
            return (
              <div className="selected-subject-row" key={subjectId}>
                <div>
                  <strong>{index + 1}. {subject.name}</strong>
                  <span>{subject.matricule || "Sans matricule"} · {subject.niveau || "Niveau non renseigné"}</span>
                </div>
                {editingId && linked ? (
                  <button className="outline small-btn" type="button" onClick={() => void removeCourseSubject(linked)}>Retirer</button>
                ) : (
                  <button className="outline small-btn" type="button" onClick={() => removeSelectedSubject(subjectId)}>Retirer</button>
                )}
              </div>
            );
          }) : (
            <div className="empty-state compact">Aucune matière sélectionnée pour le moment.</div>
          )}
        </div>
      </section>

        </div>
      </div>
      </>
    );
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <div className="eyebrow">CATALOGUE</div>
          <h1>Concours</h1>
          <p>Créez un concours, puis choisissez les matières qui composent sa préparation.</p>
        </div>
      </div>
      <div className="admin-list-actions" style={{ marginBottom: 18 }}>
        <button className="primary" onClick={() => void openCreateCourse()}>+ Créer un concours</button>
        <button className="outline" onClick={() => setShowGroupForm(true)}>+ Créer un groupement</button>
      </div>
      {showGroupForm && (
        <div className="create-course-demo panel">
          <div className="create-head"><div><span className="pill blue-pill">GROUPEMENT</span><h2>{groupEditingId ? "Modifier le groupement" : "Créer un groupement"}</h2><p>Regroupez des concours existants sans dupliquer leur contenu.</p></div></div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-grid">
            <label>Nom du groupement<input className="fake-input" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Engineering" /></label>
            <label>Couleur de la carte<div className="course-color-picker" role="radiogroup" aria-label="Couleur du groupement">{COURSE_COLORS.map((color) => <button key={color} type="button" className={`course-color-swatch ${color}${groupColor === color ? " selected" : ""}`} aria-label={`Choisir la couleur ${color}`} aria-pressed={groupColor === color} onClick={() => setGroupColor(color)} />)}</div></label>
            <label className="wide">Description<textarea className="fake-textarea short" value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} rows={3} placeholder="Regroupement des concours d’ingénierie." /></label>
          </div>
          <div className="section-head" style={{ marginTop: 22 }}><div><div className="eyebrow">CONCOURS À INCLURE</div><h2>Sélectionnez les concours</h2><p>Un concours peut appartenir à un seul groupement.</p></div></div>
          <div className="admin-list">{courses.map((course) => <label key={course.id} className="admin-course" style={{ cursor: "pointer" }}><div><strong>{course.title}</strong><span>{course.description || "Aucune description."}{course.groupId && course.groupId !== groupEditingId ? " · Déjà dans un autre groupement" : ""}</span></div><input type="checkbox" checked={selectedGroupCourseIds.includes(course.id)} disabled={Boolean(course.groupId && course.groupId !== groupEditingId)} onChange={(e) => setSelectedGroupCourseIds((current) => e.target.checked ? [...current, course.id] : current.filter((id) => id !== course.id))} /></label>)}</div>
          <div className="editor-actions"><button className="primary" disabled={groupSaving || !groupTitle.trim()} onClick={() => void saveGroup()}>{groupSaving ? "Enregistrement..." : groupEditingId ? "Enregistrer le groupement" : "Créer le groupement"}</button><button className="outline" disabled={groupSaving} onClick={resetGroupForm}>Annuler</button></div>
        </div>
      )}
      {(groups.length > 0 || courses.some((course) => !course.groupId)) && (
        <section className="admin-concours-board">
          <div className="section-head admin-board-head"><div><div className="eyebrow">VOTRE CATALOGUE</div><h2>Concours</h2><p>La couleur d’un concours est héritée automatiquement de son groupement.</p></div></div>
          {groups.map((group) => {
            const children = courses.filter((course) => course.groupId === group.id);
            return <section className="admin-group-section" key={group.id}>
              <div className="admin-group-header" style={{ borderTopColor: courseColorHex(group.cardColor) }}>
                <div className="admin-group-title"><span className={`admin-group-icon ${group.cardColor}`}><Icon name="grid" /></span><div><div className="eyebrow">GROUPEMENT</div><h3>{group.title}</h3><p>{children.length} concours · {group.description || "Regroupement de concours."}</p></div></div>
                <div className="admin-group-actions"><button className="outline" onClick={() => editGroup(group)}>Modifier</button><button className="outline danger-outline" onClick={() => void removeGroup(group)}>Supprimer</button></div>
              </div>
              {children.length ? <div className="course-grid admin-group-grid">{children.map((c) => <CourseCard key={c.id} course={c} admin onOpen={() => void editCourse(c)} onEdit={() => void editCourse(c)} onPublish={() => void togglePublish(c)} onDelete={() => void remove(c)} deleting={deletingId === c.id} groupLabel={group.title} groupColor={group.cardColor} />)}</div> : <div className="admin-group-empty">Aucun concours associé à ce groupement.</div>}
            </section>;
          })}
          {courses.some((course) => !course.groupId) && <section className="admin-ungrouped-section"><div className="admin-ungrouped-head"><div><div className="eyebrow">CONCOURS INDÉPENDANTS</div><h3>Concours sans groupement</h3><p>Ces concours utilisent automatiquement le bleu CAV.</p></div></div><div className="course-grid admin-group-grid">{courses.filter((c) => !c.groupId).map((c) => <CourseCard key={c.id} course={c} admin onOpen={() => void editCourse(c)} onEdit={() => void editCourse(c)} onPublish={() => void togglePublish(c)} onDelete={() => void remove(c)} deleting={deletingId === c.id} />)}</div></section>}
        </section>
      )}
    </div>
  );
}
function SubjectWorkspace({ subjectId, initialNodeId = "", onBack }: { subjectId: string; initialNodeId?: string; onBack: () => void }) {
  const [tab, setTab] = useState<"content" | "assessments">("content");
  return (
    <div className="subject-workspace-shell">
      <button className="back subject-workspace-back" onClick={onBack}>← Retour aux matières</button>
      <div className="subject-workspace-tabs">
        <button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>Chapitres & leçons</button>
        <button className={tab === "assessments" ? "active" : ""} onClick={() => setTab("assessments")}>Quiz & exercices</button>
      </div>
      {tab === "content" ? <ContentAdmin initialSubjectId={subjectId} initialNodeId={initialNodeId} initialPreview={Boolean(initialNodeId)} onBack={onBack} /> : <QuestionAdmin initialSubjectId={subjectId} onBack={onBack} />}
    </div>
  );
}

function ContentAdmin({ initialSubjectId = "", initialNodeId = "", initialPreview = false, onBack }: { initialSubjectId?: string; initialNodeId?: string; initialPreview?: boolean; onBack?: () => void }) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [associations, setAssociations] = useState<CourseSubject[]>([]);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [nodeId, setNodeId] = useState("");
  const [initialNodeApplied, setInitialNodeApplied] = useState(false);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [nodeTitle, setNodeTitle] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [nodeImageUrl, setNodeImageUrl] = useState("");
  const [nodeImageFile, setNodeImageFile] = useState<File | null>(null);
  const [nodeImagePreview, setNodeImagePreview] = useState("");
  const [nodeImagePosition, setNodeImagePosition] = useState<NonNullable<ContentNode["imagePosition"]>>("center");
  const [, setNodeType] = useState<ContentNodeType>("topic");
  const [parentId, setParentId] = useState("");
  const [blockHtml, setBlockHtml] = useState("");
  const [editingNodeKey, setEditingNodeKey] = useState<string | null>(null);
  const [editingBlockKey, setEditingBlockKey] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionBank, setQuestionBank] = useState<Question[]>([]);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questionOptions, setQuestionOptions] = useState<QuestionOption[]>([
    { id: "a", label: "A", text: "" }, { id: "b", label: "B", text: "" },
    { id: "c", label: "C", text: "" }, { id: "d", label: "D", text: "" },
  ]);
  const [questionCorrect, setQuestionCorrect] = useState("a");
  const [questionExplanation, setQuestionExplanation] = useState("");
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [openNodeMenuId, setOpenNodeMenuId] = useState<string | null>(null);
  const [pendingNodeDeletion, setPendingNodeDeletion] = useState<ContentNode | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  function formatNodeNumber(index: number, style: ContentNumberingStyle = "alpha", parentIndex?: number) {
    const n = index + 1;
    if (style === "alpha") return `${n <= 26 ? String.fromCharCode(96 + n) : n})`;
    if (style === "roman") {
      const vals: [number,string][] = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
      let rest=n, roman=""; for (const [value,symbol] of vals) while(rest>=value){roman+=symbol;rest-=value;} return `${roman}.`;
    }
    if (style === "hierarchical") return `${(parentIndex ?? 0) + 1}.${n}`;
    return `${n}.`;
  }

  async function changeSiblingNumbering(siblings: ContentNode[], style: ContentNumberingStyle) {
    if (!user || !siblings.length) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await Promise.all(siblings.filter(item => item.sharedKey).map(item => updateSharedContentNode(item.sharedKey!, { numberingStyle: style }, user.uid)));
      await refreshSubjectData(subjectId);
      setMessage("Style de numérotation enregistré.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’enregistrer la numérotation."); }
    finally { setSaving(false); }
  }

  async function reorderSiblings(siblings: ContentNode[], draggedId: string, targetId: string) {
    if (!user || draggedId === targetId) return;
    const ordered = [...siblings].sort((a,b)=>a.order-b.order);
    const from = ordered.findIndex(item=>item.id===draggedId), to = ordered.findIndex(item=>item.id===targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from,1); ordered.splice(to,0,moved);
    setNodes(current => current.map(item => { const idx=ordered.findIndex(entry=>entry.id===item.id); return idx<0?item:{...item,order:idx}; }));
    setSaving(true); setError(""); setMessage("");
    try {
      await Promise.all(ordered.map((item,index)=>item.sharedKey ? updateSharedContentNode(item.sharedKey,{order:index},user.uid) : Promise.resolve()));
      await refreshSubjectData(subjectId); setMessage("Ordre du programme mis à jour.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de réorganiser le programme."); await refreshSubjectData(subjectId); }
    finally { setSaving(false); setDraggedNodeId(null); }
  }

  async function refreshSubjectData(id = subjectId) {
    if (!id) { setAssociations([]); setNodes([]); setNodeId(""); return; }
    const [items, sharedNodes] = await Promise.all([listCourseSubjectsBySubjectId(id), listSharedContentNodes(id)]);
    setAssociations(items); setNodes(sharedNodes);
    if (nodeId && !sharedNodes.some(item => item.id === nodeId)) { setNodeId(""); setBlocks([]); }
  }
  async function refreshBlocks(id = nodeId) {
    if (!id) { setBlocks([]); return; }
    const nextBlocks = await listContentBlocks(id, false);
    setBlocks(nextBlocks);
    setBlockHtml(String(nextBlocks[0]?.content.html ?? nextBlocks[0]?.content.text ?? ""));
    setEditingBlockKey(nextBlocks[0]?.sharedKey ?? null);
  }
  async function refreshQuestions(id = nodeId) {
    if (!subjectId || !id) { setQuestions([]); setQuestionBank([]); return; }
    const all = await listAdminQuestions(subjectId);
    setQuestions(all.filter(question => question.contentNodeId === id));
    setQuestionBank(all.filter(question => question.status === "published" && question.contentNodeId !== id));
  }
  async function attachExistingQuestion(question: Question) {
    if (!selectedNode || !question.id) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await updateQuestion(question.id, { contentNodeId: selectedNode.id });
      await refreshQuestions(selectedNode.id);
      setMessage("Question associée à cette leçon.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’associer la question."); }
    finally { setSaving(false); }
  }
  useEffect(() => { void listAdminSubjects().then(setSubjects).catch(console.error); }, []);
  useEffect(() => { void refreshSubjectData().catch(e => setError(e instanceof Error ? e.message : "Impossible de charger la matière.")); }, [subjectId]);
  useEffect(() => { void refreshBlocks().catch(e => setError(e instanceof Error ? e.message : "Impossible de charger le contenu.")); }, [nodeId]);
  useEffect(() => { void refreshQuestions().catch(e => setError(e instanceof Error ? e.message : "Impossible de charger les questions.")); }, [nodeId, subjectId]);
  useEffect(() => {
    if (initialSubjectId) {
      setSubjectId(initialSubjectId);
      setInitialNodeApplied(false);
    }
  }, [initialSubjectId]);
  useEffect(() => {
    if (!initialNodeId || initialNodeApplied || !nodes.length) return;
    const target = nodes.find(item => item.id === initialNodeId);
    if (!target) return;
    selectNode(target);
    setPreview(initialPreview);
    setInitialNodeApplied(true);
  }, [initialNodeId, initialNodeApplied, initialPreview, nodes]);

  const selectedNode = nodes.find(item => item.id === nodeId);
  const rootNodes = nodes.filter(item => !item.parentId).sort((a,b) => a.order - b.order);
  const childNodes = selectedNode ? nodes.filter(item => item.parentId === selectedNode.id).sort((a,b) => a.order - b.order) : [];
  const selectedTopic = selectedNode && !selectedNode.parentId ? selectedNode : selectedNode ? nodes.find(item => item.id === selectedNode.parentId) : undefined;

  function resetNode() {
    setEditingNodeKey(null);
    setNodeTitle("");
    setNodeDescription("");
    setNodeImageUrl("");
    setNodeImageFile(null);
    setNodeImagePreview("");
    setNodeImagePosition("center");
    setNodeType("topic");
    setParentId("");
    setShowNodeForm(false);
  }

  function editNodeDetails(node: ContentNode) {
    setOpenNodeMenuId(null);
    setNodeId(node.id);
    setNodeTitle(node.title);
    setNodeDescription(node.description ?? "");
    setNodeImageUrl(node.imageUrl ?? "");
    setNodeImageFile(null);
    setNodeImagePreview(node.imageUrl ?? "");
    setNodeImagePosition(node.imagePosition ?? "center");
    setEditingNodeKey(node.sharedKey ?? null);
    setParentId(node.parentId ?? "");
    setNodeType(node.type);
    setShowNodeForm(true);
    if (node.parentId) setExpandedTopics(current => ({ ...current, [node.parentId!]: true }));
  }

  async function removeNodePermanently(node: ContentNode) {
    const isTopic = !node.parentId;
    const children = isTopic ? nodes.filter(item => item.parentId === node.id) : [];
    setSaving(true); setError(""); setMessage(""); setOpenNodeMenuId(null);
    try {
      for (const child of children) {
        if (child.sharedKey) await deleteSharedContentNode(child.sharedKey);
      }
      if (node.sharedKey) await deleteSharedContentNode(node.sharedKey);
      await refreshSubjectData(subjectId);
      if (children.some(child => child.id === nodeId) || node.id === nodeId) {
        setNodeId(""); setShowNodeForm(false); resetBlock();
      }
      setMessage(isTopic ? "Thème et leçons supprimés définitivement." : "Leçon supprimée définitivement.");
      setPendingNodeDeletion(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de supprimer cet élément.");
      setPendingNodeDeletion(null);
    } finally { setSaving(false); }
  }

  function handleNodeImageChange(file: File | null) {
    setError("");
    if (!file) {
      setNodeImageFile(null);
      setNodeImagePreview(nodeImageUrl);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError("Utilisez une image JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("L’image ne doit pas dépasser 8 Mo.");
      return;
    }
    setNodeImageFile(file);
    setNodeImagePreview(URL.createObjectURL(file));
  }

  async function compressTopicImage(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const maxWidth = 1600;
    const maxHeight = 900;
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Impossible de préparer l’image.");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob) throw new Error("Impossible de compresser l’image.");
    return blob;
  }

  async function uploadTopicImage(file: File, key: string) {
    const optimized = await compressTopicImage(file);
    const target = storageRef(getFirebaseStorage(), `content-topics/${subjectId}/${key}.webp`);
    await uploadBytes(target, optimized, { contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable" });
    return getDownloadURL(target);
  }
  function resetBlock() { setEditingBlockKey(null); setBlockHtml(""); }
  function resetQuestion() {
    setQuestionText(""); setQuestionOptions([{id:"a",label:"A",text:""},{id:"b",label:"B",text:""},{id:"c",label:"C",text:""},{id:"d",label:"D",text:""}]);
    setQuestionCorrect("a"); setQuestionExplanation("");
  }
  function selectNode(node: ContentNode) {
    setOpenNodeMenuId(null);
    setShowQuestionBank(false); setNodeId(node.id); setEditingNodeKey(node.sharedKey ?? null); setNodeTitle(node.title); setNodeDescription(node.description ?? ""); setNodeImageUrl(node.imageUrl ?? ""); setNodeImageFile(null); setNodeImagePreview(node.imageUrl ?? ""); setNodeImagePosition(node.imagePosition ?? "center"); setNodeType(node.type); setParentId(node.parentId ?? ""); setEditingBlockKey(null); setBlockHtml(""); setPreview(false);
    if (node.parentId) setExpandedTopics(current => ({...current, [node.parentId!]: true}));
  }
  function openTopic(node: ContentNode) {
    setExpandedTopics(current => ({...current, [node.id]: !current[node.id]}));
    selectNode(node);
  }
  async function saveNode() {
    if (!user || !subjectId || !nodeTitle.trim()) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const type: ContentNodeType = parentId ? "chapter" : "topic";
      let key = editingNodeKey;
      if (editingNodeKey) {
        await updateSharedContentNode(editingNodeKey, { title: nodeTitle.trim(), description: nodeDescription.trim(), type, ...(parentId ? {} : { imagePosition: nodeImagePosition, status: "published" }) }, user.uid);
      } else {
        const parent = parentId ? nodes.find(item => item.id === parentId) : undefined;
        const created = await createSharedContentNode({ subjectId, parentSharedKey: parent?.sharedKey, type, title: nodeTitle.trim(), description: nodeDescription.trim(), order: nodes.filter(item => (parentId ? item.parentId === parentId : !item.parentId)).length, numberingStyle: nodes.find(item => (parentId ? item.parentId === parentId : !item.parentId))?.numberingStyle ?? (parentId ? "alpha" : "numeric"), userId: user.uid, imagePosition: parentId ? undefined : nodeImagePosition });
        if (!parentId) await updateSharedContentNode(created.sharedKey, { status: "published" }, user.uid);
        key = created.sharedKey;
        setNodeId(created.nodeIds[0] ?? "");
        if (parentId) setExpandedTopics(current => ({...current, [parentId]: true}));
      }
      if (!parentId && key && nodeImageFile) {
        const imageUrl = await uploadTopicImage(nodeImageFile, key);
        await updateSharedContentNode(key, { imageUrl, imagePosition: nodeImagePosition }, user.uid);
      }
      await refreshSubjectData(subjectId); resetNode(); setMessage(editingNodeKey ? (parentId ? "Leçon modifiée." : "Thème modifié.") : parentId ? "Leçon créée." : "Thème créé.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’enregistrer la structure."); }
    finally { setSaving(false); }
  }
  async function saveLesson() {
    if (!user || !selectedNode?.sharedKey || !blockHtml.trim()) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const content = { html: sanitizeLessonHtml(blockHtml.trim()) };
      if (editingBlockKey) await updateSharedContentBlock(editingBlockKey, { type:"text", content }, user.uid);
      else await createSharedContentBlock({ nodeSharedKey:selectedNode.sharedKey, type:"text", order:0, content, userId:user.uid });
      resetBlock(); await refreshBlocks(); setMessage("Leçon enregistrée en brouillon.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d’enregistrer la leçon."); }
    finally { setSaving(false); }
  }
  async function saveQuestion() {
    if (!user || !subjectId || !selectedNode || !selectedNode.parentId || !questionText.trim()) return;
    if (questionOptions.some(option => !option.text.trim())) { setError("Complétez les quatre propositions."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      await createQuestion({ subjectId, contentNodeId:selectedNode.id, type:"multiple_choice", questionContent:{text:questionText.trim()}, options:questionOptions, correctAnswer:questionCorrect, explanation:questionExplanation.trim() || undefined, difficulty:"medium", points:1, userId:user.uid });
      resetQuestion(); setShowQuestionForm(false); await refreshQuestions(); setMessage("Question ajoutée à cette leçon.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de créer la question."); }
    finally { setSaving(false); }
  }
  async function createLessonQuiz() {
    if (!user || !selectedNode || questions.length === 0) return;
    setSaving(true); setError("");
    try {
      await createQuestionSet({ title:`Quiz - ${selectedNode.title}`, description:`Quiz lié à la leçon « ${selectedNode.title} ».`, subjectId, questionIds:questions.map(q=>q.id), type:"quiz", settings:{showScore:true,showCorrections:true,showExplanations:true,showPoints:true,allowRetry:true,passingScore:70}, userId:user.uid });
      setMessage("Quiz créé en brouillon avec les questions de la leçon.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de créer le quiz."); }
    finally { setSaving(false); }
  }
  async function publishLesson() {
    if (!user || !selectedNode?.sharedKey) return;
    try {
      await updateSharedContentNode(selectedNode.sharedKey,{status:"published"},user.uid);
      for (const block of blocks) if (block.sharedKey) await updateSharedContentBlock(block.sharedKey,{status:"published"},user.uid);
      for (const question of questions) await updateQuestion(question.id,{status:"published"});
      await refreshSubjectData(subjectId); await refreshBlocks(); await refreshQuestions(); setMessage("Leçon publiée avec son contenu et ses questions.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de publier la leçon."); }
  }
  async function unpublishLesson() {
    if (!user || !selectedNode?.sharedKey) return;
    try {
      await updateSharedContentNode(selectedNode.sharedKey,{status:"draft"},user.uid);
      for (const block of blocks) if (block.sharedKey) await updateSharedContentBlock(block.sharedKey,{status:"draft"},user.uid);
      await refreshSubjectData(subjectId); await refreshBlocks(); setMessage("Leçon dépubliée.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de dépublier la leçon."); }
  }
  async function removeQuestion(question: Question) {
    if (!(await confirmAction({ title: "Supprimer cette question ?", description: "Cette question sera supprimée définitivement. Cette action est irréversible." }))) return;
    try { await deleteQuestion(question.id); await refreshQuestions(); setMessage("Question supprimée."); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de supprimer la question."); }
  }
  return <div className="page">
    {onBack && <button className="back" onClick={onBack}>← Retour à la matière</button>}
    <div className="page-title"><div><div className="eyebrow">ÉDITEUR PÉDAGOGIQUE</div><h1>{subjects.find(item=>item.id===subjectId)?.name || "Contenu de la matière"}</h1><p>Une matière, des thèmes, des leçons. Tout le contenu se crée au même endroit.</p></div></div>
    {error && <div className="form-error">{error}</div>}{message && <div className="form-success">{message}</div>}
    <div className="content-layout rich-layout">
      <div className="outline-panel"><div className="panel-head"><div><h3>Programme</h3><p style={{color:"var(--color-muted)",fontSize:".9rem"}}>Thèmes et leçons</p></div></div>
        {!initialSubjectId && <select className="fake-input" value={subjectId} onChange={e=>{setSubjectId(e.target.value);setNodeId("");}}><option value="">Sélectionner une matière</option>{subjects.map(subject=><option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>}
        {subjectId && <>
          <div className="association-note" style={{marginTop:16}}><strong>{associations.length} concours utilisent cette matière.</strong></div>
          <button className="outline small-btn" style={{marginTop:12,width:"100%"}} onClick={()=>{setNodeId("");setEditingNodeKey(null);setNodeTitle("");setNodeDescription("");setNodeImageUrl("");setNodeImageFile(null);setNodeImagePreview("");setNodeImagePosition("center");setParentId("");setNodeType("topic");setShowNodeForm(true);}}>+ Nouveau thème</button>
          <div className="curriculum-numbering-control"><label htmlFor="topic-numbering-style">Numérotation des thèmes</label><select id="topic-numbering-style" className="fake-input" value={rootNodes[0]?.numberingStyle ?? "numeric"} onChange={e=>void changeSiblingNumbering(rootNodes,e.target.value as ContentNumberingStyle)}><option value="numeric">1, 2, 3…</option><option value="alpha">a), b), c)…</option><option value="roman">I, II, III…</option><option value="hierarchical">1.1, 1.2…</option></select></div>
          <div className="content-tree-simple">
            {rootNodes.map((topic,index)=>{const lessons=nodes.filter(n=>n.parentId===topic.id).sort((a,b)=>a.order-b.order);const open=expandedTopics[topic.id] ?? false;return <div key={topic.id} className="content-tree-topic" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(draggedNodeId)void reorderSiblings(rootNodes,draggedNodeId,topic.id);}}>
              <div draggable onDragStart={()=>setDraggedNodeId(topic.id)} onDragEnd={()=>setDraggedNodeId(null)} className={`tree-item tree-item-with-menu curriculum-draggable ${nodeId===topic.id?"active":""}`}><button className="tree-item-main" onClick={()=>openTopic(topic)}><span>{formatNodeNumber(index,rootNodes[0]?.numberingStyle ?? "numeric")}</span><div><strong>{topic.title}</strong><small>{lessons.length} leçon{lessons.length!==1?"s":""}</small></div></button><button type="button" className="node-menu-trigger" aria-label={`Options du thème ${topic.title}`} aria-expanded={openNodeMenuId===topic.id} onClick={e=>{e.stopPropagation();setOpenNodeMenuId(openNodeMenuId===topic.id?null:topic.id);}}>•••</button>{openNodeMenuId===topic.id && <div className="node-action-menu"><button onClick={()=>editNodeDetails(topic)}>Modifier</button><button className="danger-action" onClick={()=>{setOpenNodeMenuId(null);setPendingNodeDeletion(topic);}}>Supprimer définitivement</button></div>}</div>
              {open && <div className="content-tree-lessons"><div className="curriculum-numbering-control lesson-numbering-control"><label>Numérotation des leçons</label><select className="fake-input" value={lessons[0]?.numberingStyle ?? "alpha"} onChange={e=>void changeSiblingNumbering(lessons,e.target.value as ContentNumberingStyle)}><option value="alpha">a), b), c)…</option><option value="numeric">1, 2, 3…</option><option value="roman">I, II, III…</option><option value="hierarchical">{index+1}.1, {index+1}.2…</option></select></div>{lessons.map((lesson,i)=><div key={lesson.id} draggable onDragStart={()=>setDraggedNodeId(lesson.id)} onDragEnd={()=>setDraggedNodeId(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(draggedNodeId)void reorderSiblings(lessons,draggedNodeId,lesson.id);}} className={`tree-item tree-item-with-menu lesson-tree-item curriculum-draggable ${nodeId===lesson.id?"active":""}`}><button className="tree-item-main" onClick={()=>selectNode(lesson)}><span>{formatNodeNumber(i,lessons[0]?.numberingStyle ?? "alpha",index)}</span><div><strong>{lesson.title}</strong><small>{lesson.status === "published" ? "Publié" : "Brouillon"}</small></div></button><button type="button" className="node-menu-trigger" aria-label={`Options de la leçon ${lesson.title}`} aria-expanded={openNodeMenuId===lesson.id} onClick={e=>{e.stopPropagation();setOpenNodeMenuId(openNodeMenuId===lesson.id?null:lesson.id);}}>•••</button>{openNodeMenuId===lesson.id && <div className="node-action-menu"><button onClick={()=>editNodeDetails(lesson)}>Modifier</button><button className="danger-action" onClick={()=>{setOpenNodeMenuId(null);setPendingNodeDeletion(lesson);}}>Supprimer définitivement</button></div>}</div>)}<button className="tree-add-lesson" onClick={()=>{setEditingNodeKey(null);setNodeTitle("");setNodeDescription("");setNodeImageUrl("");setNodeImageFile(null);setNodeImagePreview("");setNodeImagePosition("center");setParentId(topic.id);setNodeId(topic.id);setNodeType("chapter");setShowNodeForm(true);}}>+ Ajouter une leçon</button></div>}
            </div>})}
          </div>
        </>}
      </div>
      <div className="editor panel">
        {showNodeForm && <div className="compact-create-form"><div className="lesson-workspace-head"><div><span className="pill">{editingNodeKey ? (parentId ? "MODIFIER LA LEÇON" : "MODIFIER LE THÈME") : parentId ? "NOUVELLE LEÇON" : "NOUVEAU THÈME"}</span><h2>{editingNodeKey ? (parentId ? "Modifier la leçon" : "Modifier le thème") : parentId ? "Ajouter une leçon" : "Créer un thème"}</h2></div></div><div className="form-grid"><label>Titre<input className="fake-input" autoFocus value={nodeTitle} onChange={e=>setNodeTitle(e.target.value)} placeholder={parentId ? "Ex. Divisibilité" : "Ex. Théorie des nombres"} /></label><label>Description <span className="optional-label">(facultative)</span><input className="fake-input" value={nodeDescription} onChange={e=>setNodeDescription(e.target.value)} placeholder="Une courte description" /></label></div>{!parentId && <div className="topic-illustration-editor"><div><label>Illustration du thème <span className="optional-label">(facultative)</span></label><label className="topic-upload-box"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>handleNodeImageChange(e.target.files?.[0] ?? null)} /><span>☁️ Cliquez pour ajouter une image</span><small>JPG, PNG ou WebP · recommandé : 1600 × 900 px<br/>Carré, paysage ou portrait acceptés · 8 Mo max.</small></label></div><div className="topic-image-settings">{nodeImagePreview ? <div className="topic-image-preview" style={{backgroundImage:`url(${nodeImagePreview})`,backgroundPosition:nodeImagePosition}} /> : <div className="topic-image-preview topic-image-preview-empty">Aperçu</div>}<label>Position de l’image<select className="fake-input" value={nodeImagePosition} onChange={e=>setNodeImagePosition(e.target.value as NonNullable<ContentNode["imagePosition"]>)}><option value="center">Centre</option><option value="top">Haut</option><option value="bottom">Bas</option><option value="left">Gauche</option><option value="right">Droite</option></select></label></div></div>}<div className="editor-actions"><button className="primary" disabled={saving || !nodeTitle.trim()} onClick={()=>void saveNode()}>{saving ? "Enregistrement..." : editingNodeKey ? "Enregistrer" : "Créer"}</button><button className="outline" onClick={resetNode}>Annuler</button></div></div>}
        {!subjectId ? <div className="empty-state"><h3>Sélectionnez une matière</h3><p>Commencez ensuite par créer un thème.</p></div> : showNodeForm ? null : !selectedNode ? <div className="empty-state"><h3>Votre matière est prête.</h3><p>Créez un thème à gauche, puis ajoutez ses leçons.</p></div> : selectedNode.parentId ? <>
          <div className="lesson-workspace-head"><div><span className="pill">LEÇON</span><h2>{selectedNode.title}</h2><small>{selectedTopic?.title} · {selectedNode.status === "published" ? "Publié" : "Brouillon"}</small></div><div className="lesson-workspace-actions"><button className="outline small-btn lesson-head-btn lesson-head-title" onClick={()=>editNodeDetails(selectedNode)}><PencilIcon />Modifier le titre</button><button className={`small-btn lesson-head-btn lesson-head-content${preview ? " is-edit" : ""}`} onClick={()=>{ if (preview) setEditingBlockKey(blocks[0]?.sharedKey ?? null); setPreview(!preview); }}>{preview ? <><ContentEditIcon />Éditer le contenu</> : <><EyeIcon />Aperçu</>}</button>{selectedNode.status === "published" ? <button className="outline small-btn lesson-head-btn" onClick={()=>void unpublishLesson()}>Dépublier</button> : <button className="primary small-btn lesson-head-btn" onClick={()=>void publishLesson()}>Publier</button>}</div></div>
          {preview ? <LessonContentReader html={String(blockHtml || blocks[0]?.content.html || "")} /> : <>
            <RichLessonEditor value={blockHtml || String(blocks[0]?.content.html ?? "")} onChange={setBlockHtml} storageFolder={`content-subjects/${subjectId}/${selectedNode.id}`} initialExpanded lessonTitle={selectedNode.title} onExitExpanded={()=>setPreview(true)} onSave={saveLesson} isSaving={saving} canSave={Boolean(blockHtml.trim())} />
            <div className="lesson-save-bar"><button className="primary" disabled={saving || !blockHtml.trim()} onClick={()=>void saveLesson()}>{saving?"Enregistrement...":"Enregistrer"}</button><span>Le brouillon peut être enregistré à tout moment. L’aperçu n’est pas une publication.</span></div>
            <div className="lesson-questions-section"><div className="section-head"><div><div className="eyebrow">QUESTIONS DE LA LEÇON</div><h3>{questions.length} question{questions.length!==1?"s":""}</h3></div><div className="admin-list-actions"><button className="outline small-btn" onClick={()=>setShowQuestionForm(v=>!v)}>{showQuestionForm?"Fermer":"+ Question"}</button>{questionBank.length>0 && <button className="outline small-btn" onClick={()=>setShowQuestionBank(v=>!v)}>{showQuestionBank?"Fermer la banque":"Ajouter depuis la banque"}</button>}{questions.length>0 && <button className="primary small-btn" disabled={saving} onClick={()=>void createLessonQuiz()}>Créer le quiz</button>}</div></div>
              {showQuestionBank && questionBank.length>0 && <div className="question-bank-inline"><div><strong>Questions déjà créées pour cette matière</strong><p>Sélectionnez une question publiée pour l'associer à cette leçon.</p></div><div className="lesson-question-bank-list">{questionBank.map(question=><div className="lesson-question-row" key={question.id}><div><strong>{String(question.questionContent.text ?? "Question")}</strong><small>Publié · {question.points} point{question.points===1?"":"s"}</small></div><button className="primary small-btn" disabled={saving} onClick={()=>void attachExistingQuestion(question)}>Ajouter</button></div>)}</div></div>}
              {showQuestionForm && <div className="question-inline-form"><label>Question<textarea className="fake-textarea short" rows={3} value={questionText} onChange={e=>setQuestionText(e.target.value)} placeholder="Écrivez la question..." /></label><div className="question-inline-options">{questionOptions.map(option=><div key={option.id}><input className="fake-input" value={option.text} onChange={e=>setQuestionOptions(current=>current.map(item=>item.id===option.id?{...item,text:e.target.value}:item))} placeholder={`Proposition ${option.label}`} /><label className="radio-inline"><input type="radio" name="lesson-correct" checked={questionCorrect===option.id} onChange={()=>setQuestionCorrect(option.id)} /> Bonne réponse</label></div>)}</div><label>Explication <span className="optional-label">(facultative)</span><textarea className="fake-textarea short" rows={2} value={questionExplanation} onChange={e=>setQuestionExplanation(e.target.value)} /></label><div className="editor-actions"><button className="primary" disabled={saving} onClick={()=>void saveQuestion()}>Ajouter la question</button></div></div>}
              {questions.length>0 ? <div className="lesson-question-list">{questions.map((question,index)=><div className="lesson-question-row" key={question.id}><div><strong>{index+1}. {String(question.questionContent.text ?? "Question")}</strong><small>{question.status === "published" ? "Publié" : "Brouillon"}</small></div><button className="outline small-btn" onClick={()=>void removeQuestion(question)}>Supprimer</button></div>)}</div> : <div className="empty-state">Ajoutez les questions directement à cette leçon. Elles seront publiées avec la leçon.</div>}
            </div>
          </>}
        </> : <>
          <div className="lesson-workspace-head"><div><span className="pill">THÈME</span><h2>{selectedNode.title}</h2><small>{childNodes.length} leçon{childNodes.length!==1?"s":""}</small></div><button className="primary small-btn" onClick={()=>{setEditingNodeKey(null);setNodeTitle("");setNodeDescription("");setParentId(selectedNode.id);setNodeId(selectedNode.id);setNodeType("chapter");setShowNodeForm(true);}}>+ Ajouter une leçon</button></div>
          <div className="topic-lesson-grid">{childNodes.length?childNodes.map((lesson,index)=><button className="topic-lesson-card" key={lesson.id} onClick={()=>selectNode(lesson)}><span>{formatNodeNumber(index,childNodes[0]?.numberingStyle ?? "alpha",rootNodes.findIndex(item=>item.id===selectedNode.id))}</span><strong>{lesson.title}</strong><small>{lesson.status === "published" ? "Publié" : "Brouillon"}</small></button>):<div className="empty-state">Ce thème ne contient encore aucune leçon.</div>}</div>
        </>}
        {(selectedNode && !selectedNode.parentId) && <div className="editor-actions"><button className="outline" onClick={()=>{setNodeTitle(selectedNode.title);setNodeDescription(selectedNode.description??"");setNodeImageUrl(selectedNode.imageUrl??"");setNodeImageFile(null);setNodeImagePreview(selectedNode.imageUrl??"");setNodeImagePosition(selectedNode.imagePosition??"center");setEditingNodeKey(selectedNode.sharedKey??null);setParentId("");setNodeType("topic");setShowNodeForm(true);}}>Modifier le thème</button></div>}
      </div>
    </div>
    {pendingNodeDeletion && <div className="cav-confirm-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget && !saving)setPendingNodeDeletion(null);}}>
      <section className="cav-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cav-delete-title" aria-describedby="cav-delete-description">
        <div className="cav-confirm-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5m0 3h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        <span className="cav-confirm-eyebrow">CONFIRMATION REQUISE</span>
        <h2 id="cav-delete-title">Supprimer {pendingNodeDeletion.parentId ? "cette leçon" : "ce thème"} ?</h2>
        <p id="cav-delete-description">{pendingNodeDeletion.parentId ? <>La leçon <strong>« {pendingNodeDeletion.title} »</strong> sera supprimée définitivement.</> : <>Le thème <strong>« {pendingNodeDeletion.title} »</strong> ainsi que toutes ses leçons seront supprimés définitivement.</>} Cette action est irréversible.</p>
        <div className="cav-confirm-actions"><button type="button" className="cav-confirm-cancel" disabled={saving} onClick={()=>setPendingNodeDeletion(null)}>Annuler</button><button type="button" className="cav-confirm-delete" disabled={saving} onClick={()=>{if(pendingNodeDeletion)void removeNodePermanently(pendingNodeDeletion);}}><span aria-hidden="true">{saving ? "…" : "⌫"}</span>{saving ? "Suppression…" : "Supprimer définitivement"}</button></div>
      </section>
    </div>}
  </div>;
}

function LessonContentReader({ html }: { html: string }) {
  const pageRef = useRef<HTMLDivElement>(null)
  // On phones, tell students when a table is wider than the screen so they know to swipe it sideways.
  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const update = () => {
      root.querySelectorAll('.lesson-table-hint').forEach(node => node.remove())
      root.querySelectorAll('table').forEach(table => {
        if (table.scrollWidth > table.clientWidth + 2) {
          const hint = document.createElement('p')
          hint.className = 'lesson-table-hint'
          hint.textContent = 'Faites glisser le tableau vers la gauche pour voir la suite →'
          table.parentNode?.insertBefore(hint, table)
        }
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('resize', update); root.querySelectorAll('.lesson-table-hint').forEach(node => node.remove()) }
  }, [html])
  return (
    <article className="lesson-reader-preview lesson-content-reader">
      <div className="lesson-reader-toolbar">
        <div className="lesson-reader-toolbar-main">
          <span className="lesson-reader-badge">📖 Cours</span>
          <strong>Lecture</strong>
        </div>
        <span className="lesson-reader-hint">Contenu adapté à votre écran</span>
      </div>
      <div className="lesson-reader-page">
        <div ref={pageRef} className="lesson-reader-page-inner" dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(html) }} />
      </div>
    </article>
  )
}

function LessonQuestionForm({ questions, lessonId, courseId, userId }: { questions: Question[]; lessonId: string; courseId: string; userId?: string }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ earnedPoints: number; totalPoints: number; percentage: number; pendingManualCount: number; results: Record<string, boolean> } | null>(null);
  const [error, setError] = useState("");

  function setAnswer(questionId: string, answer: unknown) {
    setAnswers(current => ({ ...current, [questionId]: answer }));
  }

  async function submit() {
    if (saving || !userId || !questions.length) return;
    setSaving(true);
    setError("");
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getFirebaseFunctions } = await import("./lib/firebase/functions");
      const submitLessonQuestions = httpsCallable<{ lessonId: string; courseId: string; answers: { questionId: string; answer: unknown }[] }, { earnedPoints: number; totalPoints: number; percentage: number; pendingManualCount: number; results: Record<string, boolean> }>(getFirebaseFunctions(), "submitLessonQuestions");
      const response = await submitLessonQuestions({
        lessonId,
        courseId,
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
      });
      setResult(response.data);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer vos réponses.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="panel lesson-questions-student" style={{ marginTop: 24 }}>
    <div className="section-head">
      <div><div className="eyebrow">QUESTIONS DE LA LEÇON</div><h2>Vérifiez vos connaissances</h2><p className="page-description">Répondez aux questions puis validez pour enregistrer votre résultat.</p></div>
      <span className="status published">{questions.length} question{questions.length === 1 ? "" : "s"}</span>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!submitted ? <div className="student-question-list">
      {questions.map((question, index) => <article className="student-question-card" key={question.id}>
        <strong>{index + 1}. {String(question.questionContent.text ?? question.questionContent.html ?? "Question")}</strong>
        {(question.type === "multiple_choice" || question.type === "multiple_select") && <div className="student-question-options">
          {(question.options ?? []).map(option => question.type === "multiple_choice" ? <button type="button" key={option.id} className={answers[question.id] === option.id ? "selected" : ""} onClick={() => setAnswer(question.id, option.id)}><span>{option.label}</span>{option.text}</button> : <label key={option.id} className="practice-option"><input type="checkbox" checked={Array.isArray(answers[question.id]) && (answers[question.id] as unknown[]).includes(option.id)} onChange={e => { const current = Array.isArray(answers[question.id]) ? answers[question.id] as unknown[] : []; setAnswer(question.id, e.target.checked ? [...current, option.id] : current.filter(value => value !== option.id)); }} /><span>{option.label}. {option.text}</span></label>)}
        </div>}
        {question.type === "true_false" && <div className="student-question-options"><button type="button" className={answers[question.id] === true ? "selected" : ""} onClick={() => setAnswer(question.id, true)}>Vrai</button><button type="button" className={answers[question.id] === false ? "selected" : ""} onClick={() => setAnswer(question.id, false)}>Faux</button></div>}
        {question.type === "short_answer" && <input className="fake-input" value={String(answers[question.id] ?? "")} onChange={e => setAnswer(question.id, e.target.value)} placeholder="Votre réponse" />}
        {question.type === "numeric" && <input className="fake-input" type="number" value={String(answers[question.id] ?? "")} onChange={e => setAnswer(question.id, e.target.value)} placeholder="Votre réponse" />}
        {question.type === "written" && <textarea className="fake-textarea" rows={5} value={String(answers[question.id] ?? "")} onChange={e => setAnswer(question.id, e.target.value)} placeholder="Votre réponse" />}
      </article>)}
      <div className="editor-actions"><button className="primary" disabled={saving || questions.some(question => answers[question.id] === undefined || answers[question.id] === "" || (Array.isArray(answers[question.id]) && !(answers[question.id] as unknown[]).length))} onClick={() => void submit()}>{saving ? "Correction..." : "Valider mes réponses"}</button></div>
    </div> : <div className="lesson-question-result">
      <div className="eyebrow">RÉSULTAT</div><h2>{result?.percentage ?? 0}%</h2><p>{result?.earnedPoints ?? 0} / {result?.totalPoints ?? 0} point{result?.totalPoints === 1 ? "" : "s"}</p>{Boolean(result?.pendingManualCount) && <p>Une réponse rédigée sera corrigée manuellement.</p>}
      <div className="student-question-list">{questions.map((question, index) => <div className="lesson-question-result-row" key={question.id}><strong>{index + 1}. {String(question.questionContent.text ?? "Question")}</strong><span>{result?.results[question.id] === true ? "✓ Correct" : result?.results[question.id] === false ? "✗ Incorrect" : "À corriger manuellement"}</span></div>)}</div>
    </div>}
  </section>;
}


function QuestionAdmin({ initialSubjectId = "", onBack }: { initialSubjectId?: string; onBack?: () => void }) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const subjectId = initialSubjectId;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [questionType, setQuestionType] = useState<QuestionType>("multiple_choice");
  const [text, setText] = useState("");
  const [options, setOptions] = useState<QuestionOption[]>([
    { id: "a", label: "A", text: "" },
    { id: "b", label: "B", text: "" },
    { id: "c", label: "C", text: "" },
    { id: "d", label: "D", text: "" },
  ]);
  const [correct, setCorrect] = useState<string | string[] | boolean>("a");
  const [shortAnswer, setShortAnswer] = useState("");
  const [points, setPoints] = useState("1");
  const [explanation, setExplanation] = useState("");
  const [setType, setSetType] = useState<"quiz" | "exercise">("quiz");
  const [setTitle, setSetTitle] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh(id = subjectId) {
    if (!id) { setQuestions([]); setSets([]); return; }
    const [q, s] = await Promise.all([listAdminQuestions(id), listAdminQuestionSets(id)]);
    setQuestions(q); setSets(s);
  }

  useEffect(() => { void listAdminSubjects().then(setSubjects).catch(console.error); }, []);
  useEffect(() => { void refresh().catch((e) => setError(e instanceof Error ? e.message : "Impossible de charger les évaluations.")); }, [subjectId]);

  const published = questions.filter(q => q.status === "published");
  const subjectName = subjects.find(s => s.id === subjectId)?.name ?? "Matière";

  function resetQuestion() {
    setText("");
    setOptions([
      { id: "a", label: "A", text: "" },
      { id: "b", label: "B", text: "" },
      { id: "c", label: "C", text: "" },
      { id: "d", label: "D", text: "" },
    ]);
    setCorrect("a"); setShortAnswer(""); setPoints("1"); setExplanation("");
  }

  function buildCorrect(): unknown {
    if (questionType === "true_false") return correct === true;
    if (questionType === "multiple_select") return Array.isArray(correct) ? correct : [];
    if (questionType === "multiple_choice") return String(correct);
    if (questionType === "numeric") return Number(shortAnswer);
    if (questionType === "short_answer") return shortAnswer.trim();
    return undefined;
  }

  async function saveQuestion() {
    setError(""); setMessage("");
    if (!user || !subjectId || !text.trim()) { setError("Écrivez la question avant de l'enregistrer."); return; }
    if ((questionType === "multiple_choice" || questionType === "multiple_select") && options.some(o => !o.text.trim())) {
      setError("Complétez toutes les propositions."); return;
    }
    if ((questionType === "short_answer" || questionType === "numeric") && !shortAnswer.trim()) {
      setError("Indiquez la bonne réponse."); return;
    }
    setSaving(true);
    try {
      await createQuestion({
        subjectId,
        type: questionType,
        questionContent: { text: text.trim() },
        ...(questionType === "multiple_choice" || questionType === "multiple_select" ? { options } : {}),
        ...(questionType !== "written" ? { correctAnswer: buildCorrect() } : {}),
        explanation: explanation.trim() || undefined,
        difficulty: "medium",
        points: Math.max(1, Number(points) || 1),
        userId: user.uid,
      });
      resetQuestion(); setShowQuestionForm(false); setMessage("Question créée en brouillon."); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de créer la question."); }
    finally { setSaving(false); }
  }

  async function toggleQuestion(question: Question) {
    try { await updateQuestion(question.id, { status: question.status === "published" ? "draft" : "published" }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de modifier la question."); }
  }

  async function removeQuestion(question: Question) {
    if (!(await confirmAction({ title: "Supprimer cette question ?", description: "Cette question sera supprimée définitivement. Cette action est irréversible." }))) return;
    try { await deleteQuestion(question.id); setSelectedIds(ids => ids.filter(id => id !== question.id)); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de supprimer la question."); }
  }

  async function createEvaluation() {
    setError(""); setMessage("");
    if (!user || !subjectId || !setTitle.trim() || !selectedIds.length) { setError("Donnez un titre et sélectionnez au moins une question publiée."); return; }
    setSaving(true);
    try {
      await createQuestionSet({
        title: setTitle.trim(),
        description: setDescription.trim(),
        subjectId,
        questionIds: selectedIds,
        type: setType,
        settings: { showScore: true, showCorrections: true, showExplanations: true, showPoints: true, allowRetry: true, passingScore: 70 },
        userId: user.uid,
      });
      setSetTitle(""); setSetDescription(""); setSelectedIds([]); setShowEvaluationForm(false); setMessage("Évaluation créée en brouillon."); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de créer l'évaluation."); }
    finally { setSaving(false); }
  }

  async function toggleSet(item: QuestionSet) {
    try { await updateQuestionSetStatus(item.id, item.status === "published" ? "draft" : "published"); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de modifier l'évaluation."); }
  }

  async function removeSet(item: QuestionSet) {
    if (!(await confirmAction({ title: "Supprimer cette évaluation ?", description: <>L’évaluation <strong>« {item.title} »</strong> sera supprimée définitivement. Cette action est irréversible.</> }))) return;
    try { await deleteQuestionSet(item.id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible de supprimer l'évaluation."); }
  }

  return (
    <div className="page">
      {onBack && <button className="back" onClick={onBack}>← Retour à la matière</button>}
      <div className="page-title">
        <div>
          <div className="eyebrow">ÉVALUATIONS</div>
          <h1>Quiz & exercices</h1>
          <p>Créez des questions puis assemblez-les en quiz ou exercices.</p>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <section className="panel">
        <div className="section-head">
          <div><div className="eyebrow">1 · BANQUE DE QUESTIONS</div><h2>Questions de {subjectName}</h2><p>Créez autant de questions que nécessaire. Elles pourront être réutilisées dans plusieurs évaluations.</p></div>
          <button className="primary" onClick={() => { setShowQuestionForm(v => !v); setShowEvaluationForm(false); }}>{showQuestionForm ? "Fermer" : "+ Ajouter une question"}</button>
        </div>
        {showQuestionForm && (
          <div className="compact-create-panel">
            <div className="form-grid">
              <label>Type<select className="fake-input" value={questionType} onChange={e => { setQuestionType(e.target.value as QuestionType); setCorrect(e.target.value === "multiple_select" ? [] : e.target.value === "true_false" ? true : "a"); }}><option value="multiple_choice">QCM — une réponse</option><option value="multiple_select">QCM — plusieurs réponses</option><option value="true_false">Vrai / Faux</option><option value="short_answer">Réponse courte</option><option value="numeric">Réponse numérique</option><option value="written">Réponse rédigée</option></select></label>
              <label>Points<input className="fake-input" type="number" min="1" value={points} onChange={e => setPoints(e.target.value)} /></label>
            </div>
            <label>Question<textarea className="fake-textarea" rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Écrivez la question..." /></label>
            {(questionType === "multiple_choice" || questionType === "multiple_select") && <div className="question-options-editor"><strong>Propositions</strong>{options.map((o, index) => <div className="question-option-row" key={o.id}><input value={o.text} onChange={e => setOptions(cur => cur.map(x => x.id === o.id ? { ...x, text: e.target.value } : x))} placeholder={`Proposition ${o.label}`} /><label className="question-correct"><input type={questionType === "multiple_select" ? "checkbox" : "radio"} name="correct-option" checked={Array.isArray(correct) ? correct.includes(o.id) : correct === o.id} onChange={e => { if (questionType === "multiple_select") { const cur = Array.isArray(correct) ? correct : []; setCorrect(e.target.checked ? [...cur, o.id] : cur.filter(id => id !== o.id)); } else setCorrect(o.id); }} /> Bonne réponse</label>{index >= 4 && <button type="button" onClick={() => setOptions(cur => cur.filter(x => x.id !== o.id))}>Retirer</button>}</div>)}<button type="button" className="outline small-btn" onClick={() => setOptions(cur => [...cur, { id: `option-${cur.length + 1}`, label: String.fromCharCode(65 + cur.length), text: "" }])}>+ Ajouter une proposition</button></div>}
            {questionType === "true_false" && <label>Bonne réponse<select className="fake-input" value={String(correct)} onChange={e => setCorrect(e.target.value === "true")}><option value="true">Vrai</option><option value="false">Faux</option></select></label>}
            {(questionType === "short_answer" || questionType === "numeric") && <label>Bonne réponse<input className="fake-input" type={questionType === "numeric" ? "number" : "text"} value={shortAnswer} onChange={e => setShortAnswer(e.target.value)} /></label>}
            <label>Explication <span className="optional-label">(facultative)</span><textarea className="fake-textarea short" rows={2} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Explication affichée après la correction, si nécessaire." /></label>
            <div className="editor-actions"><button className="primary" disabled={saving} onClick={() => void saveQuestion()}>{saving ? "Enregistrement..." : "Créer la question"}</button><button className="outline" onClick={() => { resetQuestion(); setShowQuestionForm(false); }}>Annuler</button></div>
          </div>
        )}
        <div className="admin-list">
          {questions.map(q => <div className="admin-course" key={q.id}><div><strong>{String(q.questionContent.text ?? "Question")}</strong><span>{q.type} · {q.points} point(s)</span></div><div className="admin-list-actions"><span className={`status ${q.status === "published" ? "published" : "draft"}`}>{q.status === "published" ? "Publié" : "Brouillon"}</span><button className="outline small-btn" onClick={() => void toggleQuestion(q)}>{q.status === "published" ? "Dépublier" : "Publier"}</button><button className="outline small-btn danger-btn" onClick={() => void removeQuestion(q)}>Supprimer</button></div></div>)}
          {!questions.length && <div className="empty-state">Aucune question. Ajoutez votre première question.</div>}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div><div className="eyebrow">2 · ÉVALUATIONS</div><h2>Quiz & exercices</h2><p>Choisissez les questions publiées à utiliser.</p></div>
          <button className="primary" disabled={!published.length} onClick={() => { setShowEvaluationForm(v => !v); setShowQuestionForm(false); }}>{showEvaluationForm ? "Fermer" : "+ Créer une évaluation"}</button>
        </div>
        {showEvaluationForm && <div className="compact-create-panel"><div className="form-grid"><label>Type<select className="fake-input" value={setType} onChange={e => setSetType(e.target.value as "quiz" | "exercise")}><option value="quiz">Quiz</option><option value="exercise">Exercice</option></select></label><label>Titre<input className="fake-input" value={setTitle} onChange={e => setSetTitle(e.target.value)} placeholder={`${setType === "quiz" ? "Quiz" : "Exercice"} — ${subjectName}`} /></label></div><label>Description <span className="optional-label">(facultative)</span><textarea className="fake-textarea short" rows={2} value={setDescription} onChange={e => setSetDescription(e.target.value)} /></label><div className="practice-picker"><strong>Questions à inclure</strong>{published.map(q => <label className="practice-picker-row" key={q.id}><input type="checkbox" checked={selectedIds.includes(q.id)} onChange={() => setSelectedIds(cur => cur.includes(q.id) ? cur.filter(id => id !== q.id) : [...cur, q.id])} /><span>{String(q.questionContent.text ?? "Question")}</span></label>)}</div><div className="editor-actions"><button className="primary" disabled={saving || !selectedIds.length} onClick={() => void createEvaluation()}>{saving ? "Création..." : "Créer en brouillon"}</button><button className="outline" onClick={() => setShowEvaluationForm(false)}>Annuler</button></div></div>}
        <div className="admin-list">{sets.map(item => <div className="admin-course" key={item.id}><div><strong>{item.title}</strong><span>{item.type === "quiz" ? "Quiz" : item.type === "exercise" ? "Exercice" : item.type} · {item.questions.length} question(s)</span></div><div className="admin-list-actions"><span className={`status ${item.status === "published" ? "published" : "draft"}`}>{item.status === "published" ? "Publié" : "Brouillon"}</span><button className="outline small-btn" onClick={() => void toggleSet(item)}>{item.status === "published" ? "Dépublier" : "Publier"}</button><button className="outline small-btn danger-btn" onClick={() => void removeSet(item)}>Supprimer</button></div></div>)}{!sets.length && <div className="empty-state">Aucun quiz ou exercice créé.</div>}</div>
      </section>
    </div>
  );
}


type MaintenanceNotice = {
  enabled: boolean;
  title: string;
  message: string;
  updatedAt?: Timestamp;
};

function LightweightLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="cav-navigation-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="cav-navigation-loader-card">
        <span className="cav-navigation-spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function MaintenanceNoticeScreen({
  notice,
  onDismiss,
}: {
  notice: MaintenanceNotice;
  onDismiss: () => void;
}) {
  return (
    <div className="maintenance-overlay" role="dialog" aria-modal="true" aria-labelledby="maintenance-title">
      <div className="maintenance-backdrop" aria-hidden="true" />
      <section className="maintenance-card">
        <div className="maintenance-glow maintenance-glow-one" />
        <div className="maintenance-glow maintenance-glow-two" />
        <div className="maintenance-logo-wrap">
          <img src="/assets/cav-logo.webp" alt="CAV Madagascar" className="maintenance-logo" />
        </div>
        <div className="maintenance-illustration" aria-hidden="true">
          <div className="maintenance-orbit orbit-one" />
          <div className="maintenance-orbit orbit-two" />
          <div className="maintenance-laptop"><span>⚙</span></div>
          <div className="maintenance-gear gear-one">⚙</div>
          <div className="maintenance-gear gear-two">⚙</div>
          <div className="maintenance-cone">▲</div>
        </div>
        <span className="maintenance-kicker">CAV MADAGASCAR</span>
        <h1 id="maintenance-title">{notice.title || "Maintenance en cours"}</h1>
        <p className="maintenance-message">{notice.message || "CAV Madagascar est momentanément indisponible. Merci de patienter pendant notre intervention."}</p>
        <div className="maintenance-points">
          <div><span>✓</span><p>Notre équipe travaille pour améliorer votre expérience.</p></div>
          <div><span>◷</span><p>Votre compte et votre progression restent conservés.</p></div>
          <div><span>♥</span><p>Merci pour votre patience et votre compréhension.</p></div>
        </div>
        <button className="primary maintenance-button" type="button" onClick={onDismiss}>Compris <span>→</span></button>
      </section>
    </div>
  );
}

function ProfilePage({ role, displayName, userEmail }: { role: Role; displayName: string; userEmail: string }) {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(displayName);
  const [phone, setPhone] = useState(String(profile?.phone ?? ""));
  const [photoURL, setPhotoURL] = useState(String(profile?.photoURL ?? user?.photoURL ?? ""));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceTitle, setMaintenanceTitle] = useState("Maintenance en cours");
  const [maintenanceMessage, setMaintenanceMessage] = useState("CAV Madagascar est actuellement en maintenance. Notre équipe travaille pour améliorer votre expérience. Merci de patienter avec patience. Nous serons bientôt de nouveau disponibles.");
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  useEffect(() => {
    if (role !== "admin") return;
    return onSnapshot(doc(getFirebaseFirestore(), "systemSettings", "maintenance"), (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() as Partial<MaintenanceNotice> : {};
      setMaintenanceEnabled(data.enabled === true);
      setMaintenanceTitle(String(data.title ?? "Maintenance en cours"));
      setMaintenanceMessage(String(data.message ?? "CAV Madagascar est actuellement en maintenance. Notre équipe travaille pour améliorer votre expérience. Merci de patienter avec patience. Nous serons bientôt de nouveau disponibles."));
    }, (e) => console.error("Maintenance admin settings:", e));
  }, [role]);

  async function saveMaintenance() {
    if (role !== "admin" && role !== "teacher") return;
    setMaintenanceSaving(true); setError(""); setMessage("");
    try {
      await setDoc(doc(getFirebaseFirestore(), "systemSettings", "maintenance"), {
        enabled: maintenanceEnabled,
        title: maintenanceTitle.trim() || "Maintenance en cours",
        message: maintenanceMessage.trim() || "CAV Madagascar est momentanément indisponible. Merci de patienter.",
        updatedAt: new Date(),
        updatedBy: user?.uid ?? null,
      }, { merge: true });
      setMessage(maintenanceEnabled ? "Message de maintenance activé." : "Mode maintenance désactivé.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer le message de maintenance.");
    } finally { setMaintenanceSaving(false); }
  }

  useEffect(() => {
    setName(displayName);
    setPhone(String(profile?.phone ?? ""));
    setPhotoURL(String(profile?.photoURL ?? user?.photoURL ?? ""));
  }, [displayName, profile, user]);

  async function uploadPhoto(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) { setError("Veuillez choisir une image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("L'image doit faire moins de 5 Mo."); return; }
    setUploading(true); setError(""); setMessage("");
    try {
      const objectUrl = URL.createObjectURL(file);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = objectUrl;
      });
      const size = 512;
      const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossible de préparer l'image.");
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale; const height = image.height * scale;
      ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      URL.revokeObjectURL(objectUrl);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Impossible de compresser l'image.")), "image/webp", 0.84));
      const target = storageRef(getFirebaseStorage(), `users/${user.uid}/profile/avatar.webp`);
      await uploadBytes(target, blob, { contentType: "image/webp" });
      const url = await getDownloadURL(target);
      await updateUserProfile(user.uid, { photoURL: url });
      setPhotoURL(url); await refreshProfile(); setMessage("Photo de profil mise à jour.");
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible d'importer la photo."); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!user || !name.trim()) { setError("Le nom est obligatoire."); return; }
    if (!phone.trim() || !/^[+0-9][0-9 ()-]{7,20}$/.test(phone.trim())) { setError("Le numéro de téléphone est obligatoire et doit être valide."); return; }
    setSaving(true); setError(""); setMessage("");
    try { await updateUserProfile(user.uid, { displayName: name.trim(), phone: phone.trim() }); await refreshProfile(); setMessage("Profil enregistré."); }
    catch (e) { setError(e instanceof Error ? e.message : "Impossible d'enregistrer le profil."); }
    finally { setSaving(false); }
  }

  return <div className="page narrow">
    <div className="page-title"><div><div className="eyebrow">MON COMPTE</div><h1>Mon profil</h1><p>Gérez vos informations personnelles et votre photo de profil.</p></div></div>
    {error && <div className="form-error">{error}</div>}{message && <div className="form-success">{message}</div>}
    <div className="panel profile-settings-card">
      <div className="profile-settings-photo">
        {photoURL ? <img src={photoURL} alt="Photo de profil" className="avatar-image xl" /> : <div className="avatar xl">{displayName.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]?.toUpperCase()).join("") || "CA"}</div>}
        <div><strong>Photo de profil</strong><p>Image carrée, automatiquement optimisée.</p><label className="outline small-btn upload-button">{uploading ? "Importation..." : "Choisir une photo"}<input type="file" accept="image/*" hidden disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadPhoto(file); e.currentTarget.value = ""; }} /></label></div>
      </div>
      <div className="form-grid">
        <label>Nom complet<input className="fake-input" value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Email<input className="fake-input" value={userEmail} disabled /></label>
        <label>Téléphone <span className="optional-label">(obligatoire)</span><input className="fake-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+261 ..." /></label>
        <label>Rôle<input className="fake-input" value={role === "admin" ? "Administrateur" : role === "teacher" ? "Gestionnaire de contenu" : "Étudiant"} disabled /></label>
      </div>
      <div className="editor-actions"><button className="primary" disabled={saving} onClick={() => void save()}>{saving ? "Enregistrement..." : "Enregistrer"}</button></div>
    </div>
    <SoundSettingsCard audience={role === "admin" || role === "teacher" ? "manager" : "student"} />
    {(role === "admin" || role === "teacher") && (
      <section className="panel maintenance-admin-card">
        <div className="maintenance-admin-head">
          <div><div className="eyebrow">SERVICE</div><h2>Maintenance de CAV</h2><p>Affichez un message clair aux étudiants et aux visiteurs lorsque CAV est temporairement en maintenance.</p></div>
          <label className="maintenance-switch"><input type="checkbox" checked={maintenanceEnabled} onChange={e => setMaintenanceEnabled(e.target.checked)} /><span className="maintenance-switch-track"><span /></span><strong>{maintenanceEnabled ? "Activée" : "Désactivée"}</strong></label>
        </div>
        <div className="form-grid">
          <label>Titre du message<input className="fake-input" value={maintenanceTitle} onChange={e => setMaintenanceTitle(e.target.value)} placeholder="Maintenance en cours" /></label>
        </div>
        <label>Message <span className="optional-label">(modifiable)</span><textarea className="fake-textarea maintenance-message-input" rows={5} maxLength={1000} value={maintenanceMessage} onChange={e => setMaintenanceMessage(e.target.value)} /></label>
        <div className="maintenance-admin-preview"><div className="eyebrow">APERÇU</div><div className="maintenance-mini-preview"><img src="/assets/cav-logo.webp" alt="CAV Madagascar" /><strong>{maintenanceTitle || "Maintenance en cours"}</strong><p>{maintenanceMessage || "Votre message apparaîtra ici."}</p><span>Compris →</span></div></div>
        <div className="editor-actions"><button className="primary" disabled={maintenanceSaving} onClick={() => void saveMaintenance()}>{maintenanceSaving ? "Enregistrement..." : "Enregistrer les modifications"}</button></div>
      </section>
    )}
  </div>;
}

type StudentEnrollmentRecord = {
  key: string;
  enrollmentId: string;
  historyId?: string;
  courseId: string;
  title: string;
  state: "active" | "expired" | "revoked";
  enrolledAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
};

type AdminStudentRow = {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  status: "active" | "suspended";
  createdAt?: Date;
  courseNames: string[];
  courseIds: string[];
  courseHistoryNames: string[];
  enrollmentRecords: StudentEnrollmentRecord[];
  role: "student" | "content_manager";
};

function AdminUsers() {
  const db = getFirebaseFirestore();
  const { user: currentAdmin } = useAuth();
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [availableCourses, setAvailableCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [exporting, setExporting] = useState<"excel" | "word" | "pdf" | null>(null);
  const [selectedActiveStudent, setSelectedActiveStudent] = useState<AdminStudentRow | null>(null);
  const [selectedRoleStudent, setSelectedRoleStudent] = useState<AdminStudentRow | null>(null);
  const [roleDraft, setRoleDraft] = useState<"student" | "content_manager">("student");
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    let usersSnapshot: Array<{ id: string; data: Record<string, unknown> }> = [];
    let enrollmentsSnapshot: Array<Record<string, unknown>> = [];
    let historySnapshot: Array<Record<string, unknown>> = [];
    let coursesSnapshot: Array<{ id: string; title: string }> = [];
    let usersReady = false;
    let enrollmentsReady = false;
    let historyReady = false;
    let coursesReady = false;

    const rebuild = () => {
      if (!usersReady || !enrollmentsReady || !historyReady || !coursesReady) return;
      const courseMap = new Map(coursesSnapshot.map(course => [course.id, course.title]));
      setAvailableCourses(coursesSnapshot.slice().sort((a, b) => a.title.localeCompare(b.title, "fr", { sensitivity: "base" })));
      const courseIdsByUser = new Map<string, string[]>();
      const namesByUser = new Map<string, string[]>();
      const historyNamesByUser = new Map<string, string[]>();
      for (const enrollment of enrollmentsSnapshot) {
        if (String(enrollment.status ?? "") !== "active") continue;
        const expiresAt = enrollment.expiresAt && typeof enrollment.expiresAt === "object" && "toDate" in enrollment.expiresAt
          ? (enrollment.expiresAt as { toDate: () => Date }).toDate()
          : undefined;
        if (expiresAt && expiresAt.getTime() <= Date.now()) continue;
        const userId = String(enrollment.userId ?? "");
        const courseId = String(enrollment.courseId ?? "");
        const title = courseMap.get(courseId);
        if (!userId || !title) continue;
        const currentIds = courseIdsByUser.get(userId) ?? [];
        if (!currentIds.includes(courseId)) currentIds.push(courseId);
        courseIdsByUser.set(userId, currentIds);
        const current = namesByUser.get(userId) ?? [];
        if (!current.includes(title)) current.push(title);
        namesByUser.set(userId, current);
      }
      for (const enrollment of historySnapshot) {
        const userId = String(enrollment.userId ?? "");
        const courseId = String(enrollment.courseId ?? "");
        const title = courseMap.get(courseId);
        if (!userId || !title) continue;
        const current = historyNamesByUser.get(userId) ?? [];
        if (!current.includes(title)) current.push(title);
        historyNamesByUser.set(userId, current);
      }

      // One record per purchase, with its real current state (en cours / expiré / révoqué).
      const toDate = (value: unknown) => value && typeof value === "object" && "toDate" in value ? (value as { toDate: () => Date }).toDate() : undefined;
      const now = Date.now();
      const stateOf = (data: Record<string, unknown>): StudentEnrollmentRecord["state"] => {
        const status = String(data.status ?? "");
        if (status === "revoked") return "revoked";
        const expiresAt = toDate(data.expiresAt);
        if (status === "active" && !(expiresAt && expiresAt.getTime() <= now)) return "active";
        return "expired";
      };
      const enrollmentByDocId = new Map(enrollmentsSnapshot.map(item => [String(item.docId ?? ""), item]));
      const recordsByUser = new Map<string, StudentEnrollmentRecord[]>();
      const pushRecord = (userId: string, record: StudentEnrollmentRecord) => {
        const list = recordsByUser.get(userId) ?? [];
        list.push(record);
        recordsByUser.set(userId, list);
      };
      const coveredPaymentIds = new Set<string>();
      for (const entry of historySnapshot) {
        const userId = String(entry.userId ?? "");
        const courseId = String(entry.courseId ?? "");
        const title = courseMap.get(courseId);
        if (!userId || !courseId || !title) continue;
        const historyId = String(entry.docId ?? "");
        const enrollmentId = `${userId}_${courseId}`;
        const current = enrollmentByDocId.get(enrollmentId);
        const isCurrent = !!current && String(current.paymentId ?? "") === historyId;
        if (isCurrent) coveredPaymentIds.add(historyId);
        const source = isCurrent && current ? current : entry;
        const state = isCurrent && current ? stateOf(current) : String(entry.status ?? "") === "revoked" ? "revoked" : "expired";
        pushRecord(userId, { key: `h-${historyId}`, enrollmentId, historyId, courseId, title, state, enrolledAt: toDate(source.enrolledAt) ?? toDate(entry.enrolledAt), expiresAt: toDate(source.expiresAt) ?? toDate(entry.expiresAt), revokedAt: toDate(source.revokedAt) });
      }
      for (const entry of enrollmentsSnapshot) {
        const userId = String(entry.userId ?? "");
        const courseId = String(entry.courseId ?? "");
        const title = courseMap.get(courseId);
        if (!userId || !courseId || !title || String(entry.status ?? "") === "pending") continue;
        if (coveredPaymentIds.has(String(entry.paymentId ?? "")) && String(entry.paymentId ?? "")) continue;
        pushRecord(userId, { key: `e-${String(entry.docId ?? "")}`, enrollmentId: String(entry.docId ?? `${userId}_${courseId}`), courseId, title, state: stateOf(entry), enrolledAt: toDate(entry.enrolledAt), expiresAt: toDate(entry.expiresAt), revokedAt: toDate(entry.revokedAt) });
      }
      const rank = { active: 0, expired: 1, revoked: 1 } as const;
      for (const list of recordsByUser.values()) {
        list.sort((a, b) => rank[a.state] - rank[b.state] || (b.enrolledAt?.getTime() ?? 0) - (a.enrolledAt?.getTime() ?? 0));
      }

      const rows = usersSnapshot
        .filter(item => item.data.role === "student" || item.data.role === "content_manager")
        .map(item => ({
          uid: item.id,
          displayName: String(item.data.displayName ?? "Utilisateur"),
          email: String(item.data.email ?? ""),
          phone: String(item.data.phone ?? ""),
          status: item.data.status === "suspended" ? "suspended" as const : "active" as const,
          role: item.data.role === "content_manager" ? "content_manager" as const : "student" as const,
          createdAt: item.data.createdAt && typeof item.data.createdAt === "object" && "toDate" in item.data.createdAt
            ? (item.data.createdAt as { toDate: () => Date }).toDate()
            : undefined,
          courseNames: (namesByUser.get(item.id) ?? []).sort((a, b) => a.localeCompare(b, "fr")),
          courseIds: courseIdsByUser.get(item.id) ?? [],
          courseHistoryNames: (historyNamesByUser.get(item.id) ?? []).sort((a, b) => a.localeCompare(b, "fr")),
          enrollmentRecords: recordsByUser.get(item.id) ?? [],
        }));
      setUsers(sortNewestFirst(rows));
      setLoading(false);
    };

    const unsubUsers = onSnapshot(collection(db, "users"), snapshot => {
      usersSnapshot = snapshot.docs.map(item => ({ id: item.id, data: item.data() }));
      usersReady = true;
      rebuild();
    }, err => { console.error(err); setError("Impossible de charger les utilisateurs."); setLoading(false); });
    const unsubEnrollments = onSnapshot(collection(db, "enrollments"), snapshot => {
      enrollmentsSnapshot = snapshot.docs.map(item => ({ ...item.data(), docId: item.id }));
      enrollmentsReady = true;
      rebuild();
    }, err => { console.error(err); setError("Impossible de charger les inscriptions."); setLoading(false); });
    const unsubHistory = onSnapshot(collection(db, "enrollmentHistory"), snapshot => {
      historySnapshot = snapshot.docs.map(item => ({ ...item.data(), docId: item.id }));
      historyReady = true;
      rebuild();
    }, err => { console.error(err); historyReady = true; rebuild(); });
    const unsubCourses = onSnapshot(collection(db, "courses"), snapshot => {
      coursesSnapshot = snapshot.docs.map(item => ({ id: item.id, title: String(item.data().title ?? "Concours") }));
      coursesReady = true;
      rebuild();
    }, err => { console.error(err); setError("Impossible de charger les concours."); setLoading(false); });

    return () => { unsubUsers(); unsubEnrollments(); unsubHistory(); unsubCourses(); };
  }, [db]);

  // Centered "success" dialog (same component as the delete confirmation, which is known to render).
  function announceSuccess(title: string, description: string) {
    void confirmAction({ tone: "info", eyebrow: "SUCCÈS", title, description, confirmLabel: "Compris", cancelLabel: null });
  }

  async function toggleStatus(item: AdminStudentRow) {
    const suspending = item.status === "active";
    setProcessing(item.uid); setError("");
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getFirebaseFunctions } = await import("./lib/firebase/functions");
      const setUserStatus = httpsCallable<{ userId: string; status: "active" | "suspended" }, { success: boolean }>(getFirebaseFunctions(), "setUserStatus");
      await setUserStatus({ userId: item.uid, status: suspending ? "suspended" : "active" });
      announceSuccess(
        suspending ? "Compte suspendu" : "Compte réactivé",
        suspending
          ? `Le compte de ${item.displayName} a été suspendu avec succès. Cette personne ne peut plus se connecter.`
          : `Le compte de ${item.displayName} a été réactivé avec succès. Cette personne peut de nouveau se connecter.`,
      );
    } catch (e) {
      setError(callableErrorMessage(e, "Impossible de modifier le statut. Réessayez dans un instant."));
    } finally { setProcessing(null); }
  }

  async function deleteStudent(item: AdminStudentRow) {
    if (!(await confirmAction({ title: "Supprimer ce compte ?", description: <>Le compte de <strong>{item.displayName}</strong> sera supprimé définitivement, avec sa progression, ses notes et ses inscriptions. Cette action est irréversible. Pour simplement bloquer l’accès, utilisez plutôt « Suspendre ».</>, confirmLabel: "Supprimer le compte" }))) return;
    setProcessing(item.uid); setError("");
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getFirebaseFunctions } = await import("./lib/firebase/functions");
      const deleteUserAccount = httpsCallable<{ userId: string }, { success: boolean }>(getFirebaseFunctions(), "deleteUserAccount");
      await deleteUserAccount({ userId: item.uid });
      announceSuccess("Compte supprimé", `Le compte de ${item.displayName} a été supprimé définitivement.`);
    } catch (e) {
      setError(callableErrorMessage(e, "Impossible de supprimer ce compte. Réessayez dans un instant."));
    } finally { setProcessing(null); }
  }

  const filtered = users.filter(item => {
    const needle = search.trim().toLocaleLowerCase("fr-FR");
    const matchesSearch = !needle || [item.displayName, item.email, item.phone, ...item.courseNames, ...item.courseHistoryNames].some(value => value.toLocaleLowerCase("fr-FR").includes(needle));
    const matchesCourse = courseFilter === "all" || item.courseIds.includes(courseFilter);
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesCourse && matchesStatus;
  });

  function resetFilters() {
    setSearch("");
    setCourseFilter("all");
    setStatusFilter("all");
  }

  async function runExport(kind: "excel" | "word" | "pdf") {
    setExporting(kind); setError("");
    try {
      // Export formats are used only on demand; load their implementation when requested.
      const exports = await import("./lib/export/userExports");
      // The screen shows newest accounts first; exports are always alphabetical.
      const ordered = sortAlphabetically(filtered);
      if (kind === "excel") await exports.exportStudentsToExcel(ordered);
      if (kind === "word") await exports.exportStudentsToWord(ordered);
      if (kind === "pdf") await exports.exportStudentsToPdf(ordered);
    } catch (e) {
      console.error(e);
      setError("Impossible de générer l’export. Veuillez réessayer.");
    } finally { setExporting(null); }
  }

  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join("") || "U";
  const openRoleEditor = (item: AdminStudentRow) => {
    setSelectedRoleStudent(item);
    setRoleDraft(item.role);
    setError("");
  };

  async function saveUserRole() {
    if (!selectedRoleStudent || roleDraft === selectedRoleStudent.role) {
      setSelectedRoleStudent(null);
      return;
    }
    setSavingRole(true);
    setError("");
    try {
      const { httpsCallable } = await import("firebase/functions");
      const { getFirebaseFunctions } = await import("./lib/firebase/functions");
      const setUserRole = httpsCallable<{ userId: string; role: "student" | "content_manager" }, { success: boolean; role: "student" | "content_manager" }>(getFirebaseFunctions(), "setUserRole");
      await setUserRole({ userId: selectedRoleStudent.uid, role: roleDraft });
      setUsers(current => current.map(user => user.uid === selectedRoleStudent.uid ? { ...user, role: roleDraft } : user));
      const changedName = selectedRoleStudent.displayName;
      setSelectedRoleStudent(null);
      announceSuccess("Rôle modifié", `Le rôle de ${changedName} a été modifié avec succès.`);
    } catch (e) {
      console.error(e);
      setError(callableErrorMessage(e, "Impossible de modifier le rôle de ce compte. Réessayez dans un instant."));
    } finally {
      setSavingRole(false);
    }
  }
  const openActiveCourses = (item: AdminStudentRow) => setSelectedActiveStudent(item);

  async function revokeEnrollment(student: AdminStudentRow, record: StudentEnrollmentRecord) {
    const confirmed = await confirmAction({
      title: "Révoquer l’accès à ce concours ?",
      description: <><strong>{student.displayName}</strong> perdra immédiatement l’accès à <strong>« {record.title} »</strong>. L’historique est conservé et l’étudiant devra s’inscrire de nouveau pour y accéder.</>,
      confirmLabel: "Révoquer l’accès",
    });
    if (!confirmed) return;
    setRevokingKey(record.key); setError("");
    try {
      const batch = writeBatch(db);
      const patch = { status: "revoked", revokedAt: serverTimestamp(), revokedBy: currentAdmin?.uid ?? null };
      batch.update(doc(db, "enrollments", record.enrollmentId), patch);
      if (record.historyId) batch.update(doc(db, "enrollmentHistory", record.historyId), patch);
      await batch.commit();
      announceSuccess("Accès révoqué", `${student.displayName} n’a plus accès à « ${record.title} ». L’historique est conservé.`);
    } catch (e) {
      console.error(e);
      setError("Impossible de révoquer l’accès. Réessayez dans un instant.");
    } finally { setRevokingKey(null); }
  }

  return <div className="page">
    <div className="page-title">
      <div><div className="eyebrow">COMPTES</div><h1>Étudiants</h1><p>Consultez les étudiants, leurs coordonnées et leurs concours actifs.</p></div>
      <div className="users-export-wrap">
        <button className="primary export-main" onClick={() => void runExport("excel")} disabled={!!exporting || loading}>{exporting === "excel" ? "Exportation..." : "Exporter"} <Icon name="arrow" /></button>
        <div className="export-actions">
          <button className="outline small-btn" disabled={!!exporting || loading} onClick={() => void runExport("excel")}>Excel (.xlsx)</button>
          <button className="outline small-btn" disabled={!!exporting || loading} onClick={() => void runExport("word")}>Word (.docx)</button>
          <button className="outline small-btn" disabled={!!exporting || loading} onClick={() => void runExport("pdf")}>PDF (.pdf)</button>
        </div>
      </div>
    </div>
    {error && <div className="form-error">{error}</div>}
    <div className="users-filter-panel">
      <div className="users-filter-row">
        <label className="users-filter-search">Rechercher
          <input className="fake-input users-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, email, téléphone..." />
        </label>
        <label>Concours
          <select className="fake-input users-filter-control" value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
            <option value="all">Tous les concours</option>
            {availableCourses.map(course => <option value={course.id} key={course.id}>{course.title}</option>)}
          </select>
        </label>
        <label>Statut
          <select className="fake-input users-filter-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value as "all" | "active" | "suspended")}>
            <option value="all">Tous</option><option value="active">Actif</option><option value="suspended">Suspendu</option>
          </select>
        </label>
        <button type="button" className="outline small-btn users-reset-filters" onClick={resetFilters}>Réinitialiser</button>
      </div>
      <div className="users-filter-summary"><span>{filtered.length} étudiant{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""} sur {users.length}</span>{courseFilter !== "all" && <span className="users-active-filter">Concours : {availableCourses.find(course => course.id === courseFilter)?.title ?? "Sélectionné"}</span>}</div>
    </div>
    <div className="panel users-table-panel">
      {loading ? <div className="empty-state">Chargement...</div> : filtered.length === 0 ? <div className="empty-state">Aucun étudiant trouvé.</div> : <div className="users-table">
        <div className="users-table-head"><span>Étudiant</span><span>Email</span><span>Téléphone</span><span>Concours</span><span>Membre depuis</span><span>Statut</span><span>Actions</span></div>
        {filtered.map(item => <div className="users-table-row" key={item.uid}>
          <button type="button" className="user-identity user-identity-button" onClick={() => openRoleEditor(item)} aria-label={`Modifier le rôle de ${item.displayName}`}><div className="avatar">{initials(item.displayName)}</div><strong>{item.displayName}</strong></button>
          <div className="user-cell muted-cell">{item.email || "-"}</div>
          <div className="user-cell">{item.phone || <span className="missing-value">Non renseigné</span>}</div>
          <div className="user-courses-cell">
            {item.enrollmentRecords.length === 0 ? <span className="missing-value">Aucun concours</span> : (() => {
              const activeCount = item.enrollmentRecords.filter(record => record.state === "active").length;
              const pastCount = item.enrollmentRecords.length - activeCount;
              return <button type="button" className="user-courses-summary" onClick={() => openActiveCourses(item)} title="Voir et gérer les concours de cet étudiant">
                <span className={`courses-pill ${activeCount ? "courses-pill-active" : "courses-pill-muted"}`}>{activeCount} en cours</span>
                {pastCount > 0 && <span className="courses-pill courses-pill-muted">{pastCount} terminé{pastCount > 1 ? "s" : ""}</span>}
                <span className="courses-manage" aria-hidden="true">›</span>
              </button>;
            })()}
          </div>
          <div className="user-cell">{item.createdAt ? item.createdAt.toLocaleDateString("fr-FR") : "-"}</div>
          <span className={`status ${item.status === "active" ? "published" : "draft"}`}>{item.status === "active" ? "Actif" : "Suspendu"}</span>
          <div className="user-actions"><button className="outline small-btn" disabled={processing === item.uid} onClick={() => void toggleStatus(item)}>{item.status === "active" ? "Suspendre" : "Réactiver"}</button><button className="outline small-btn danger-btn" disabled={processing === item.uid} onClick={() => void deleteStudent(item)}>Supprimer</button></div>
        </div>)}
      </div>}
    </div>
    {selectedRoleStudent && <div className="student-history-backdrop" role="presentation" onClick={() => !savingRole && setSelectedRoleStudent(null)}>
      <div className="student-history-modal user-role-modal" role="dialog" aria-modal="true" aria-labelledby="user-role-title" onClick={event => event.stopPropagation()}>
        <div className="student-history-head">
          <div><div className="eyebrow">GESTION DU COMPTE</div><h2 id="user-role-title">{selectedRoleStudent.displayName}</h2><p>{selectedRoleStudent.email || "Adresse e-mail non renseignée"}</p></div>
          <button type="button" className="link-button" disabled={savingRole} onClick={() => setSelectedRoleStudent(null)}>Fermer</button>
        </div>
        <div className="user-role-form">
          <label htmlFor="user-role-select">Rôle du compte</label>
          <select id="user-role-select" className="fake-input users-filter-control" value={roleDraft} onChange={event => setRoleDraft(event.target.value as "student" | "content_manager")} disabled={savingRole}>
            <option value="student">Étudiant</option>
            <option value="content_manager">Gestionnaire de contenu</option>
          </select>
          <p className="user-role-help">Le gestionnaire de contenu peut gérer les contenus pédagogiques, mais ne peut pas administrer les comptes ni modifier les rôles.</p>
        </div>
        <div className="student-history-actions"><button type="button" className="outline small-btn" disabled={savingRole} onClick={() => setSelectedRoleStudent(null)}>Annuler</button><button type="button" className="primary" disabled={savingRole} onClick={() => void saveUserRole()}>{savingRole ? "Enregistrement..." : "Enregistrer"}</button></div>
      </div>
    </div>}
    {selectedActiveStudent && (() => {
      const student = users.find(user => user.uid === selectedActiveStudent.uid) ?? selectedActiveStudent;
      const current = student.enrollmentRecords.filter(record => record.state === "active");
      const past = student.enrollmentRecords.filter(record => record.state !== "active");
      const fmt = (date?: Date) => date ? date.toLocaleDateString("fr-FR") : "-";
      const renderRecord = (record: StudentEnrollmentRecord) => <div className="enrollment-record" key={record.key}>
        <div className="enrollment-record-main">
          <strong>{record.title}</strong>
          <small>{record.state === "revoked" ? `Inscrit le ${fmt(record.enrolledAt)} · Accès révoqué le ${fmt(record.revokedAt)}` : record.state === "expired" ? `Inscrit le ${fmt(record.enrolledAt)} · Expiré le ${fmt(record.expiresAt)}` : `Inscrit le ${fmt(record.enrolledAt)} · Expire le ${fmt(record.expiresAt)}`}</small>
        </div>
        <span className={`enrollment-state enrollment-state-${record.state}`}>{record.state === "active" ? "En cours" : record.state === "revoked" ? "Révoqué" : "Expiré"}</span>
        {record.state === "active" && <button type="button" className="outline small-btn danger-btn" disabled={revokingKey === record.key} onClick={() => void revokeEnrollment(student, record)}>{revokingKey === record.key ? "Révocation..." : "Révoquer l’accès"}</button>}
      </div>;
      return <div className="student-history-backdrop" role="presentation" onClick={() => setSelectedActiveStudent(null)}>
        <div className="student-history-modal enrollment-modal" role="dialog" aria-modal="true" aria-labelledby="student-active-title" onClick={event => event.stopPropagation()}>
          <div className="student-history-head">
            <div><div className="eyebrow">CONCOURS DE L’ÉTUDIANT</div><h2 id="student-active-title">{student.displayName}</h2><p>{current.length} en cours · {past.length} terminé{past.length > 1 ? "s" : ""}</p></div>
            <button type="button" className="link-button" onClick={() => setSelectedActiveStudent(null)}>Fermer</button>
          </div>
          <div className="enrollment-section"><h3>En cours ({current.length})</h3>{current.length === 0 ? <p className="missing-value">Aucun concours en cours.</p> : current.map(renderRecord)}</div>
          <div className="enrollment-section"><h3>Terminés · historique ({past.length})</h3>{past.length === 0 ? <p className="missing-value">Aucun concours terminé.</p> : past.map(renderRecord)}</div>
          <p className="user-role-help">Révoquer un accès termine le parcours de l’étudiant dans ce concours : il devra s’inscrire de nouveau. L’historique reste conservé.</p>
          <div className="student-history-actions"><button type="button" className="primary" onClick={() => setSelectedActiveStudent(null)}>Fermer</button></div>
        </div>
      </div>;
    })()}
  </div>;
}


function AdminEnrollmentPayments({ role }: { role: "super_admin" | "content_manager" }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<Array<{ uid: string; displayName: string }>>([]);
  const [coursesMap, setCoursesMap] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Payment | null>(null);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [historyFilter, setHistoryFilter] = useState<"all" | "verified" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<Payment | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    const [allPayments, adminUsers, adminCourses] = await Promise.all([
      listAllPayments(),
      listAdminUsers(),
      listAdminCourses(),
    ]);
    setPayments(allPayments);
    setUsers(adminUsers.map((u) => ({ uid: u.uid, displayName: u.displayName })));
    setCoursesMap(Object.fromEntries(adminCourses.map((c) => [c.id, c.title])));
  }

  useEffect(() => {
    void refresh().catch(() => setError("Impossible de charger les paiements."));
  }, []);

  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.uid, u.displayName])), [users]);
  const pending = payments.filter((p) => p.status === "pending");
  const history = payments.filter((p) => p.status !== "pending");
  const acceptedTotal = payments.filter((p) => p.status === "verified").reduce((sum, p) => sum + p.amount, 0);
  const acceptedCount = payments.filter((p) => p.status === "verified").length;
  const rejectedCount = payments.filter((p) => p.status === "rejected").length;
  const activeList = tab === "pending"
    ? pending
    : history.filter((p) => historyFilter === "all" || p.status === historyFilter);
  const filtered = activeList.filter((p) => {
    const q = search.trim().toLocaleLowerCase("fr-FR");
    if (!q) return true;
    return [p.reference, userMap[p.userId] ?? "", coursesMap[p.courseId] ?? "", p.method]
      .join(" ").toLocaleLowerCase("fr-FR").includes(q);
  });

  function methodLabel(method: Payment["method"]) {
    return method === "orange_money" ? "Orange Money" : method === "airtel_money" ? "Airtel Money" : "MVola";
  }
  function statusLabel(status: Payment["status"]) {
    return status === "verified" ? "Accepté" : status === "rejected" ? "Refusé" : "En attente";
  }
  function initials(name: string) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "ET";
  }

  async function validate(approved: boolean) {
    if (!selected) return;
    setProcessing(true);
    setError("");
    try {
      await reviewPayment({
        paymentId: selected.id,
        approved,
        rejectionReason: approved ? undefined : "Paiement rejeté par l’administration.",
      });
      const updated = { ...selected, status: approved ? "verified" as const : "rejected" as const };
      setSuccess(approved ? updated : null);
      setSelected(approved ? null : null);
      await refresh();
    } catch (e) {
      console.error(e);
      setError("Impossible de traiter ce paiement. Vérifiez vos droits puis réessayez.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="page payments-admin-page">
      <div className="page-title payment-page-header">
        <div>
          <div className="eyebrow">GESTION FINANCIÈRE</div>
          <h1>Inscriptions & paiements</h1>
          <p>Vérifiez les paiements, activez les inscriptions et gardez un historique clair des encaissements.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className={`payment-summary-grid ${role === "content_manager" ? "payment-summary-grid-manager" : ""}`}>
        {role === "super_admin" && <div className="payment-total-card">
          <div><span>Total encaissé</span><small>Paiements acceptés uniquement</small></div>
          <strong>{formatPrice(acceptedTotal)} <em>Ar</em></strong>
          <div className="payment-total-foot"><span>✓ {acceptedCount} paiement(s) accepté(s)</span><span>{rejectedCount} refusé(s)</span></div>
        </div>}
        <div className="payment-mini-card"><span>À vérifier</span><strong>{pending.length}</strong><small>Paiements en attente</small></div>
        <div className="payment-mini-card"><span>Historique</span><strong>{history.length}</strong><small>Paiements traités</small></div>
      </div>

      <div className="payment-workspace panel">
        <div className="payment-tabs">
          <button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>À vérifier {pending.length > 0 && <b>{pending.length}</b>}</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Historique</button>
        </div>

        <div className="payment-toolbar">
          <div className="payment-search"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un étudiant, une référence..." /></div>
          {tab === "history" && <div className="payment-filters">
            {([['all', 'Tous'], ['verified', 'Acceptés'], ['rejected', 'Refusés']] as const).map(([value, label]) => <button key={value} className={historyFilter === value ? "active" : ""} onClick={() => setHistoryFilter(value)}>{label}</button>)}
          </div>}
        </div>

        {filtered.length ? <div className="payment-list">
          {filtered.map((p) => {
            const student = userMap[p.userId] ?? "Étudiant";
            return <div className="payment-row" key={p.id}>
              <div className="avatar payment-avatar">{initials(student)}</div>
              <div className="payment-person"><strong>{student}</strong><span>{coursesMap[p.courseId] ?? "Concours"}</span></div>
              <div className="payment-reference"><strong>{p.reference}</strong><span>{methodLabel(p.method)}</span></div>
              <div className="payment-amount"><strong>{formatPrice(p.amount)} Ar</strong><span>{p.submittedAt ? p.submittedAt.toLocaleDateString("fr-FR") : "Date inconnue"}</span></div>
              <span className={`status ${p.status === "verified" ? "published" : p.status === "rejected" ? "draft" : "pending"}`}>{statusLabel(p.status)}</span>
              {p.status === "pending" ? <button className="outline small-btn" onClick={() => setSelected(p)}>Vérifier</button> : <button className="link-button payment-details-btn" onClick={() => setSelected(p)}>Détails</button>}
            </div>;
          })}
        </div> : <div className="payment-empty"><div className="payment-empty-icon">✓</div><h3>{tab === "pending" ? "Tout est à jour" : "Aucun paiement dans cet historique"}</h3><p>{tab === "pending" ? "Aucun paiement n’attend actuellement votre vérification." : "Les paiements traités apparaîtront ici automatiquement."}</p></div>}
      </div>

      {selected && <div className="review-modal">
        <div className="review-box payment-review-box">
          <button className="close" onClick={() => setSelected(null)}>×</button>
          <div className="eyebrow">{selected.status === "pending" ? "VALIDATION DE PAIEMENT" : "DÉTAILS DU PAIEMENT"}</div>
          <h2>{selected.status === "pending" ? "Confirmer l’acceptation" : "Détails du paiement"}</h2>
          <p className="review-intro">{selected.status === "pending" ? "Vérifiez les informations avant d’activer l’accès de l’étudiant." : "Informations enregistrées pour cette transaction."}</p>
          <div className="review-grid">
            <div><span>Étudiant</span><b>{userMap[selected.userId] ?? "Étudiant"}</b></div>
            <div><span>Concours</span><b>{coursesMap[selected.courseId] ?? selected.courseId}</b></div>
            <div><span>Montant</span><b>{formatPrice(selected.amount)} Ar</b></div>
            <div><span>Méthode</span><b>{methodLabel(selected.method)}</b></div>
            <div><span>Référence</span><b>{selected.reference}</b></div>
            <div><span>Statut</span><b className={selected.status === "verified" ? "success-text" : selected.status === "rejected" ? "warning" : "warning"}>{statusLabel(selected.status)}</b></div>
          </div>
          {selected.status === "pending" && <div className="review-note review-note-success"><strong>✓ Vérification manuelle</strong><p>En confirmant, vous indiquez avoir vérifié la référence de transaction et le montant reçu. L’accès au concours sera activé immédiatement.</p></div>}
          {selected.status !== "pending" && selected.verifiedAt && <div className="review-note"><strong>Traitement enregistré</strong><p>{selected.status === "verified" ? "Paiement accepté et inscription activée." : `Paiement refusé${selected.rejectionReason ? ` : ${selected.rejectionReason}` : "."}`} · {selected.verifiedAt.toLocaleString("fr-FR")}</p></div>}
          {selected.status === "pending" && <div className="review-actions">
            <button className="outline" disabled={processing} onClick={() => void validate(false)}>Refuser</button>
            <button className="primary" disabled={processing} onClick={() => void validate(true)}>{processing ? "Traitement..." : "✓ Confirmer et accepter"}</button>
          </div>}
        </div>
      </div>}

      {success && <div className="success-overlay">
        <div className="success-card">
          <div className="success-check">✓</div>
          <div className="eyebrow">PAIEMENT CONFIRMÉ</div>
          <h2>Paiement accepté</h2>
          <p>Le paiement a été accepté et l’accès de l’étudiant est maintenant actif.</p>
          <div className="success-details"><div><span>Référence vérifiée</span><strong>{success.reference}</strong></div><div><span>Montant encaissé</span><strong>{formatPrice(success.amount)} Ar</strong></div></div>
          <button className="primary full" onClick={() => setSuccess(null)}>Terminé <Icon name="check" /></button>
        </div>
      </div>}
    </div>
  );
}

function ResultsPage({ userId }: { userId: string }) {
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  useEffect(() => {
    void listMyPracticeAttempts(userId).then(setAttempts).catch(console.error);
  }, [userId]);
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <div className="eyebrow">ENTRAÎNEMENT</div>
          <h1>Mes résultats</h1>
          <p>Suivez vos performances au fil de votre préparation.</p>
        </div>
      </div>
      {attempts.length ? (
        <div className="result-overview">
          <div className="score-big">
            <span>Dernier score</span>
            <b>{attempts[0].percentage}%</b>
            <small>{attempts.length} tentative(s)</small>
          </div>
          <div className="panel">
            <h3>Derniers entraînements</h3>
            {attempts.slice(0, 8).map((a) => (
              <div className="metric" key={a.id}>
                <span>
                  {a.percentage}% · {a.earnedPoints}/{a.totalPoints}
                </span>
                <b>→</b>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel empty-state">Aucun résultat enregistré.</div>
      )}
    </div>
  );
}

function AdminLessonPreview({
  course,
  subjectId,
  lessonId,
  commentId,
  onBack,
}: {
  course?: CourseView;
  subjectId: string;
  lessonId: string;
  commentId: string;
  onBack: () => void;
}) {
  const { user, profile } = useAuth();
  const [subjects, setSubjects] = useState<CourseSubject[]>([]);
  const [nodes, setNodes] = useState<ContentNode[]>([]);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loveState, setLoveState] = useState<Record<string, { count: number; loved: boolean }>>({});
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const selectedNode = nodes.find(node => node.id === lessonId);
  const selectedSubject = subjects.find(subject => subject.subjectId === subjectId || subject.id === selectedNode?.courseSubjectId);
  const topic = selectedNode?.parentId ? nodes.find(node => node.id === selectedNode.parentId) : undefined;

  useEffect(() => {
    if (!course) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([listCourseSubjects(course.id, true), listSubjectContentNodes(subjectId, true)])
      .then(async ([courseSubjects, subjectNodes]) => {
        if (cancelled) return;
        setSubjects(courseSubjects);
        setNodes(subjectNodes);
        const target = subjectNodes.find(node => node.id === lessonId);
        if (!target) throw new Error("Leçon introuvable.");
        const lessonBlocks = await listContentBlocks(target.id, true);
        if (cancelled) return;
        setBlocks(lessonBlocks);
      })
      .catch(err => { console.error(err); if (!cancelled) setError("Impossible de charger cette leçon."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [course, subjectId, lessonId]);

  useEffect(() => {
    if (!course || !lessonId) return;
    return subscribeLessonComments(lessonId, course.id, setComments, err => { console.error(err); setError("Impossible de charger les commentaires de cette leçon."); });
  }, [course, lessonId]);

  useEffect(() => {
    setLoveState({});
    if (!user || comments.length === 0) return;
    const unsubscribers = comments.map(comment => subscribeLessonCommentLoves(comment.id, user.uid, state => {
      setLoveState(current => ({ ...current, [comment.id]: state }));
    }, err => console.error(err)));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [comments, user]);

  useEffect(() => {
    if (loading || !selectedNode) return;
    const timer = window.setTimeout(() => {
      document.getElementById("admin-lesson-comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (commentId) window.setTimeout(() => {
        const target = document.getElementById(`admin-lesson-comment-${commentId}`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        target?.classList.add("admin-comment-highlight");
        window.setTimeout(() => target?.classList.remove("admin-comment-highlight"), 3200);
      }, 180);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [loading, selectedNode, comments.length, commentId]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement | null)?.closest?.(".lesson-comment-menu-wrap")) setOpenMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenMenuId(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", closeOnEscape); };
  }, [openMenuId]);

  function initials(name: string) { return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("") || "É"; }

  async function saveEditedAdminComment(commentId: string) {
    const content = editingCommentText.trim();
    if (!content) return;
    setEditSaving(true);
    setError("");
    try {
      await updateLessonComment(commentId, content, "manager");
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch (err) {
      console.error(err);
      setError("Impossible de modifier cette réponse.");
    } finally {
      setEditSaving(false);
    }
  }

  async function removeAdminComment(comment: LessonComment) {
    const threadIds = collectCommentThreadIds(comment.id, comments);
    const replyCount = threadIds.length - 1;
    const isStudentQuestion = comment.authorRole !== "manager";
    const confirmed = await confirmAction({
      title: isStudentQuestion ? "Supprimer cette question ?" : "Supprimer cette réponse ?",
      description: isStudentQuestion ? <>La question de <strong>{comment.studentName}</strong> sera supprimée définitivement.</> : "Cette réponse sera supprimée définitivement.",
      hint: replyCount > 0 ? `${replyCount} réponse${replyCount > 1 ? "s" : ""} associée${replyCount > 1 ? "s" : ""} ser${replyCount > 1 ? "ont" : "a"} également supprimée${replyCount > 1 ? "s" : ""}.` : undefined,
    });
    if (!confirmed) return;
    setError("");
    try {
      await deleteLessonCommentThread(threadIds);
      if (editingCommentId && threadIds.includes(editingCommentId)) { setEditingCommentId(null); setEditingCommentText(""); }
      if (replyingToId && threadIds.includes(replyingToId)) { setReplyingToId(null); setReplyText(""); }
    } catch (err) {
      console.error(err);
      setError(isStudentQuestion ? "Impossible de supprimer cette question." : "Impossible de supprimer cette réponse.");
    }
  }

  async function submitAdminReply(parent: LessonComment) {
    if (!user?.uid || !profile || !replyText.trim()) return;
    setReplySaving(true);
    setError("");
    try {
      await replyToLessonComment({
        parent,
        content: replyText.trim(),
        userId: user.uid,
        authorName: String(profile.displayName ?? "Équipe CAV Madagascar").trim() || "Équipe CAV Madagascar",
        authorPhotoURL: String(profile.photoURL ?? user.photoURL ?? "").trim() || null,
        authorRole: "manager",
      });
      setReplyText("");
      setReplyingToId(null);
    } catch (err) {
      console.error(err);
      setError("Impossible d’envoyer la réponse.");
    } finally {
      setReplySaving(false);
    }
  }

  function renderComment(comment: LessonComment, depth = 0, seen = new Set<string>()): ReactNode {
    if (seen.has(comment.id)) return null;
    seen.add(comment.id);
    const replies = comments.filter(item => item.parentCommentId === comment.id).sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    const love = loveState[comment.id];
    const isOwnReply = comment.authorRole === "manager" && comment.userId === user?.uid;
    return <div key={comment.id} className={depth ? "lesson-comment-reply-item" : "lesson-comment-thread"} style={depth ? { marginLeft: Math.min(depth * 22, 80) } : undefined}>
      <article id={`admin-lesson-comment-${comment.id}`} className="lesson-comment-card compact">
        <header className="lesson-comment-head"><div className="lesson-comment-author"><span className={comment.authorRole === "manager" ? "lesson-comment-avatar manager" : "lesson-comment-avatar"} aria-hidden="true">{comment.authorPhotoURL ? <img src={comment.authorPhotoURL} alt="" className="lesson-comment-avatar-image" /> : initials(comment.studentName)}</span><div className="lesson-comment-author-copy"><div className="lesson-comment-author-line"><strong>{comment.studentName}</strong>{comment.authorRole === "manager" && <span className="lesson-comment-role">CAV</span>}{depth === 0 && comment.category === "technical" && <span className="lesson-comment-category is-technical">Problème technique</span>}</div><span>{comment.createdAt ? comment.createdAt.toDate().toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "À l’instant"}{comment.updatedAt && comment.createdAt && comment.updatedAt.toMillis() - comment.createdAt.toMillis() > 60000 && comment.authorRole === "manager" ? " · modifié" : ""}</span></div></div>
          {editingCommentId !== comment.id && <div className="lesson-comment-menu-wrap">
            <button type="button" className="lesson-comment-menu-trigger" aria-label="Options du commentaire" aria-haspopup="menu" aria-expanded={openMenuId === comment.id} onClick={() => setOpenMenuId(value => value === comment.id ? null : comment.id)}>⋯</button>
            {openMenuId === comment.id && <div className="lesson-comment-menu" role="menu">
              {isOwnReply && <button type="button" role="menuitem" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); setReplyingToId(null); setOpenMenuId(null); }}>✎ <span>Modifier</span></button>}
              <button type="button" role="menuitem" className="danger" onClick={() => { setOpenMenuId(null); void removeAdminComment(comment); }}>⌫ <span>Supprimer</span></button>
            </div>}
          </div>}
        </header>
        {editingCommentId === comment.id ? (
          <div className="lesson-comment-edit">
            <textarea value={editingCommentText} onChange={event => setEditingCommentText(event.target.value)} rows={3} maxLength={3000} aria-label="Modifier la réponse" autoFocus />
            <div className="lesson-comment-edit-footer"><span>{editingCommentText.length}/3000</span><div className="lesson-comment-actions">
              <button type="button" className="primary" disabled={editSaving || !editingCommentText.trim() || editingCommentText.trim() === comment.content} onClick={() => void saveEditedAdminComment(comment.id)}>{editSaving ? "Enregistrement..." : "Enregistrer"}</button>
              <button type="button" className="outline" disabled={editSaving} onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }}>Annuler</button>
            </div></div>
          </div>
        ) : <div className="lesson-comment-body">{comment.content}</div>}
        {editingCommentId !== comment.id && <div className="lesson-comment-actions comment-actions">
          <button type="button" className="lesson-comment-action" onClick={() => { setReplyingToId(comment.id); setReplyText(""); }}><span aria-hidden="true">↩</span> Répondre</button>
          <span className={`lesson-comment-action lesson-comment-love ${love?.loved ? "is-loved" : ""}`} aria-label="Réactions amour"><span aria-hidden="true">{love?.loved ? "♥" : "♡"}</span>{(love?.count ?? 0) > 0 && <b>{love.count}</b>}</span>
        </div>}
        {replyingToId === comment.id && (
          <div className="lesson-comment-reply-composer">
            <div className="lesson-comment-reply-row">
              <span className="lesson-comment-avatar manager">{profile?.photoURL || user?.photoURL ? <img src={String(profile?.photoURL ?? user?.photoURL)} alt="" className="lesson-comment-avatar-image" /> : initials(String(profile?.displayName ?? "Équipe CAV Madagascar"))}</span>
              <textarea value={replyText} onChange={event => setReplyText(event.target.value)} rows={2} maxLength={3000} placeholder={`Répondre à ${comment.studentName}...`} aria-label={`Répondre à ${comment.studentName}`} />
            </div>
            <div className="lesson-comment-reply-tools">
              <span className="lesson-comment-reply-hint">Réponse en tant que CAV Madagascar</span>
              <div className="lesson-comment-actions">
                <button type="button" className="outline" onClick={() => { setReplyingToId(null); setReplyText(""); }}>Annuler</button>
                <button type="button" className="primary" disabled={replySaving || !replyText.trim() || !user?.uid || !profile} onClick={() => void submitAdminReply(comment)}>{replySaving ? "Envoi..." : "Répondre"}</button>
              </div>
            </div>
          </div>
        )}
      </article>
      {replies.length > 0 && <div className="lesson-comment-replies">{replies.map(reply => renderComment(reply, depth + 1, seen))}</div>}
    </div>;
  }

  if (!course) return <div className="page"><div className="panel empty-state">Concours introuvable.</div></div>;
  return <div className="page admin-lesson-preview-page">
    <button className="back" type="button" onClick={onBack}>← Retour aux questions</button>
    <div className="page-title"><div><div className="eyebrow">APERÇU ÉTUDIANT · {course.title}</div><h1>{selectedNode?.title ?? "Leçon"}</h1><p>{selectedSubject?.title ?? "Matière"}{topic ? ` · ${topic.title}` : ""}</p></div><span className="status published">Lecture seule</span></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {loading ? <div className="panel empty-state">Chargement de la leçon...</div> : <>
      {blocks.length ? blocks.map(block => <div className="panel" key={block.id} style={{ marginBottom: 16 }}>{block.type === "video" && block.media?.url ? <video controls width="100%" src={block.media.url} /> : block.type === "image" && block.media?.url ? <img src={block.media.url} alt="Illustration de la leçon" style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} /> : block.type === "file" && block.media?.url ? <a className="text-link" href={block.media.url} target="_blank" rel="noreferrer">Ouvrir le document</a> : <div className="lesson-preview" dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(String(block.content.html ?? block.content.text ?? "")) }} />}</div>) : <div className="panel empty-state"><h3>Cette leçon ne contient pas de contenu publié.</h3></div>}
      <section id="admin-lesson-comments" className="lesson-comments-section admin-lesson-comments-preview"><div className="lesson-comments-compact-bar"><div className="lesson-comments-label"><span className="lesson-comments-icon">💬</span><div><strong>Commentaires</strong><small>{comments.length} contribution{comments.length === 1 ? "" : "s"}</small></div></div></div><div className="lesson-comments-panel"><div className="lesson-comments-panel-head"><div><strong>Discussion de la leçon</strong><span>Commentaire sélectionné automatiquement</span></div></div><div className="lesson-comments-list">{comments.length ? (() => { const seen = new Set<string>(); return comments.filter(comment => !comment.parentCommentId).map(comment => renderComment(comment, 0, seen)); })() : <p className="page-description">Aucun commentaire pour cette leçon.</p>}</div></div></section>
    </>}
  </div>;
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [publicPage, setPublicPage] = useState(() => new URLSearchParams(window.location.search).get("auth") === "login" ? "login" : "home");
  const [studentPage, setStudentPage] = useState<StudentPage>("dashboard");
  const [adminPage, setAdminPage] = useState<AdminPage>("overview");
  const [courses, setCourses] = useState<CourseView[]>([]);
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [initialDataReady, setInitialDataReady] = useState(false);
  const [maintenanceNotice, setMaintenanceNotice] = useState<MaintenanceNotice | null>(null);
  const [maintenanceDismissed, setMaintenanceDismissed] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [notificationLessonId, setNotificationLessonId] = useState<string | null>(null);
  const [notificationCommentId, setNotificationCommentId] = useState<string | null>(null);
  const [selectedAdminSubjectId, setSelectedAdminSubjectId] = useState<string | null>(null);
  const [selectedAdminNodeId, setSelectedAdminNodeId] = useState<string | null>(null);
  const [adminPreviewCourseId, setAdminPreviewCourseId] = useState<string | null>(null);
  const [adminPreviewCommentId, setAdminPreviewCommentId] = useState<string | null>(null);
  const [myEnrollments, setMyEnrollments] = useState<Enrollment[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [navigationLoading, setNavigationLoading] = useState(false);
  const historyIndexRef = useRef(0);
  const historyInitializedRef = useRef(false);
  // Branded loading screen on the first visit only; repeat visits (new tabs, reloads) get a small spinner.
  const [quietLoading] = useState(() => isRecentVisit());
  useEffect(() => { markVisit(); }, []);
  useEffect(() => { if (initialDataReady) markVisit(); }, [initialDataReady]);
  const role: Role = !user
    ? "visitor"
    : profile?.role === "super_admin"
      ? "admin"
      : profile?.role === "content_manager"
        ? "teacher"
        : "student";
  useEffect(() => {
    const ref = doc(getFirebaseFirestore(), "systemSettings", "maintenance");
    return onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) {
        setMaintenanceNotice(null);
        return;
      }
      const data = snapshot.data() as Partial<MaintenanceNotice>;
      setMaintenanceNotice({
        enabled: data.enabled === true,
        title: String(data.title ?? "Maintenance en cours"),
        message: String(data.message ?? "CAV Madagascar est momentanément indisponible. Merci de patienter pendant notre intervention."),
        updatedAt: data.updatedAt,
      });
      setMaintenanceDismissed(false);
    }, (error) => {
      console.error("Maintenance settings listener:", error);
      setMaintenanceNotice(null);
    });
  }, []);

  useEffect(() => {
    setMaintenanceDismissed(false);
  }, [maintenanceNotice?.updatedAt?.seconds, maintenanceNotice?.enabled]);

  useEffect(() => {
    let cancelled = false;
    setCoursesLoading(true);
    const loader =
      role === "admin" || role === "teacher"
        ? loadAdminCourses
        : loadPublishedCourses;
    const groupLoader =
      role === "admin" || role === "teacher"
        ? listAdminCourseGroups
        : listPublishedCourseGroups;
    Promise.all([loader(), groupLoader()])
      .then(([x, groups]) => {
        if (!cancelled) {
          setCourses(x);
          setCourseGroups(groups);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) {
          setCoursesLoading(false);
          setInitialDataReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);
  useEffect(() => {
    if (!user) {
      setMyEnrollments([]);
      setProgress([]);
      return;
    }
    void Promise.all([listMyEnrollments(user.uid), listMyProgress(user.uid)])
      .then(([e, p]) => {
        setMyEnrollments(e);
        setProgress(p);
      })
      .catch(console.error);
  }, [user]);

  const showNavigationLoader = useCallback(() => {
    setNavigationLoading(true);
    window.setTimeout(() => setNavigationLoading(false), 600);
  }, []);

  const currentHistorySnapshot = useCallback((): Omit<CavHistoryState, "__cavHistory" | "index"> => ({
    role,
    publicPage,
    studentPage,
    adminPage,
    selectedCourseId,
    notificationLessonId,
    notificationCommentId,
    selectedAdminSubjectId,
    selectedAdminNodeId,
    adminPreviewCourseId,
    adminPreviewCommentId,
  }), [
    role, publicPage, studentPage, adminPage, selectedCourseId,
    notificationLessonId, notificationCommentId, selectedAdminSubjectId,
    selectedAdminNodeId, adminPreviewCourseId, adminPreviewCommentId,
  ]);

  const pushHistoryState = useCallback((patch: Partial<Omit<CavHistoryState, "__cavHistory" | "index" | "role">> & { role?: Role } = {}) => {
    const next = { ...currentHistorySnapshot(), ...patch, role: patch.role ?? role };
    const currentState = window.history.state as Partial<CavHistoryState> | null;
    const index = Number(currentState?.index ?? 0) + 1;
    const state: CavHistoryState = { __cavHistory: true, index, ...next };
    window.history.pushState(state, "", window.location.href);
  }, [currentHistorySnapshot, role]);

  const replaceHistoryState = useCallback((patch: Partial<Omit<CavHistoryState, "__cavHistory" | "index" | "role">> & { role?: Role } = {}) => {
    const next = { ...currentHistorySnapshot(), ...patch, role: patch.role ?? role };
    const currentState = window.history.state as Partial<CavHistoryState> | null;
    const state: CavHistoryState = { __cavHistory: true, index: Number(currentState?.index ?? 0), ...next };
    window.history.replaceState(state, "", window.location.href);
  }, [currentHistorySnapshot, role]);

  const navigateStudentPage = useCallback((nextPage: StudentPage, patch: Partial<{ selectedCourseId: string | null; notificationLessonId: string | null; notificationCommentId: string | null }> = {}) => {
    if (nextPage === studentPage && patch.selectedCourseId === undefined && patch.notificationLessonId === undefined && patch.notificationCommentId === undefined) return;
    showNavigationLoader();
    if (patch.selectedCourseId !== undefined) setSelectedCourseId(patch.selectedCourseId);
    if (patch.notificationLessonId !== undefined) setNotificationLessonId(patch.notificationLessonId);
    if (patch.notificationCommentId !== undefined) setNotificationCommentId(patch.notificationCommentId);
    setStudentPage(nextPage);
    pushHistoryState({ studentPage: nextPage, ...patch });
  }, [studentPage, showNavigationLoader, pushHistoryState]);

  const navigateAdminPage = (nextPage: AdminPage, patch: Partial<{ selectedAdminSubjectId: string | null; selectedAdminNodeId: string | null; adminPreviewCourseId: string | null; adminPreviewCommentId: string | null }> = {}) => {
    // Analytics contains platform-wide financial and operational metrics; reserve it for super admins.
    if (nextPage === "stats" && role !== "admin") return;
    if (nextPage === adminPage && Object.keys(patch).length === 0) return;
    showNavigationLoader();
    if (patch.selectedAdminSubjectId !== undefined) setSelectedAdminSubjectId(patch.selectedAdminSubjectId);
    if (patch.selectedAdminNodeId !== undefined) setSelectedAdminNodeId(patch.selectedAdminNodeId);
    if (patch.adminPreviewCourseId !== undefined) setAdminPreviewCourseId(patch.adminPreviewCourseId);
    if (patch.adminPreviewCommentId !== undefined) setAdminPreviewCommentId(patch.adminPreviewCommentId);
    setAdminPage(nextPage);
    pushHistoryState({ adminPage: nextPage, ...patch });
  };

  const goBack = (fallback?: () => void) => {
    const state = window.history.state as Partial<CavHistoryState> | null;
    if (state?.__cavHistory && Number(state.index) > 0) {
      window.history.back();
      return;
    }
    fallback?.();
  };

  useEffect(() => {
    if (loading || historyInitializedRef.current) return;
    const existing = window.history.state as Partial<CavHistoryState> | null;
    if (existing?.__cavHistory && existing.role === role && typeof existing.index === "number") {
      historyIndexRef.current = existing.index;
      setPublicPage(existing.publicPage ?? "home");
      setStudentPage(existing.studentPage ?? "dashboard");
      setAdminPage(existing.adminPage ?? "overview");
      setSelectedCourseId(existing.selectedCourseId ?? null);
      setNotificationLessonId(existing.notificationLessonId ?? null);
      setNotificationCommentId(existing.notificationCommentId ?? null);
      setSelectedAdminSubjectId(existing.selectedAdminSubjectId ?? null);
      setSelectedAdminNodeId(existing.selectedAdminNodeId ?? null);
      setAdminPreviewCourseId(existing.adminPreviewCourseId ?? null);
      setAdminPreviewCommentId(existing.adminPreviewCommentId ?? null);
    } else {
      historyIndexRef.current = 0;
      replaceHistoryState();
    }
    historyInitializedRef.current = true;
  }, [loading, role]);

  // Opened from a menu link in a new tab (/?page=<id>): go to that page once signed in, then clean the URL.
  const deepLinkPageRef = useRef<string | null>(new URLSearchParams(window.location.search).get(NAV_PAGE_PARAM));
  useEffect(() => {
    const wanted = deepLinkPageRef.current;
    if (!wanted || loading || role === "visitor" || !historyInitializedRef.current) return;
    deepLinkPageRef.current = null;
    if (role === "student") {
      if (STUDENT_LINK_PAGES.includes(wanted)) { setStudentPage(wanted as StudentPage); replaceHistoryState({ studentPage: wanted as StudentPage }); }
    } else if (ADMIN_LINK_PAGES.includes(wanted) && !(wanted === "stats" && role !== "admin")) {
      setAdminPage(wanted as AdminPage);
      replaceHistoryState({ adminPage: wanted as AdminPage });
    }
    const cleaned = new URL(window.location.href);
    cleaned.searchParams.delete(NAV_PAGE_PARAM);
    window.history.replaceState(window.history.state, "", cleaned.pathname + cleaned.search + cleaned.hash);
  }, [loading, role, replaceHistoryState]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as Partial<CavHistoryState> | null;
      if (!state?.__cavHistory || state.role !== role) return;
      historyIndexRef.current = Number(state.index ?? 0);
      setPublicPage(state.publicPage ?? "home");
      setStudentPage(state.studentPage ?? "dashboard");
      setAdminPage(state.adminPage ?? "overview");
      setSelectedCourseId(state.selectedCourseId ?? null);
      setNotificationLessonId(state.notificationLessonId ?? null);
      setNotificationCommentId(state.notificationCommentId ?? null);
      setSelectedAdminSubjectId(state.selectedAdminSubjectId ?? null);
      setSelectedAdminNodeId(state.selectedAdminNodeId ?? null);
      setAdminPreviewCourseId(state.adminPreviewCourseId ?? null);
      setAdminPreviewCommentId(state.adminPreviewCommentId ?? null);
      showNavigationLoader();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [role]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const activeCourses = useMemo(
    () =>
      courses
        .map((c) => {
          const enrollment = myEnrollments.find(
            (e) => e.courseId === c.id && isEnrollmentCurrentlyActive(e),
          );
          if (!enrollment) return null;
          const completed = progress.filter(
            (p) => p.courseId === c.id && p.completed,
          ).length;
          return {
            ...c,
            progress: c.lessons ? Math.round((completed / c.lessons) * 100) : 0,
          };
        })
        .filter(Boolean) as CourseView[],
    [courses, myEnrollments, progress],
  );
  const enter = (p: string) => {
    if (p === "dashboard") {
      setPublicPage("home");
      setStudentPage("dashboard");
      setSelectedCourseId(null);
      setNotificationLessonId(null);
      replaceHistoryState({ role: "student", publicPage: "home", studentPage: "dashboard", selectedCourseId: null, notificationLessonId: null, notificationCommentId: null });
      return;
    }
    if (p === "admin") {
      setPublicPage("home");
      setAdminPage("overview");
      setSelectedAdminSubjectId(null);
      replaceHistoryState({ role: "admin", publicPage: "home", adminPage: "overview", selectedAdminSubjectId: null, selectedAdminNodeId: null });
      return;
    }
    if (p === "teacher") {
      setPublicPage("home");
      setAdminPage("content");
      replaceHistoryState({ role: "teacher", publicPage: "home", adminPage: "content" });
      return;
    }
    if (p.startsWith("preview:") || p.startsWith("enroll:")) {
      const courseId = p.split(":")[1] ?? null;
      setSelectedCourseId(courseId);
      setPublicPage(p);
      pushHistoryState({ publicPage: p, selectedCourseId: courseId });
      return;
    }
    if (p === publicPage) return;
    setPublicPage(p);
    pushHistoryState({ publicPage: p });
  };
  if ((loading || !initialDataReady) && quietLoading) return <LightweightLoader label="Chargement…" />;
  if (loading || !initialDataReady)
    return (
      <div className="loading-screen" role="status" aria-live="polite" aria-label="Chargement de votre espace">
        <div className="loading-screen-inner">
          <div className="loading-screen-logo-wrap">
            <img className="loading-screen-logo" src="/assets/cav-logo.webp" alt="CAV Madagascar" />
          </div>
          <p className="loading-screen-kicker">COURS D'APPUI VIRTUEL</p>
          <h1 className="loading-screen-title">Préparez votre réussite avec CAV.</h1>
          <p className="loading-screen-message">Préparation de votre espace…</p>
          <div className="loading-screen-progress" aria-hidden="true" />
          <span className="loading-screen-footer">CAV Madagascar · Préparation aux concours</span>
        </div>
      </div>
    );
  if (maintenanceNotice?.enabled && !maintenanceDismissed && role !== "admin" && role !== "teacher") {
    return <MaintenanceNoticeScreen notice={maintenanceNotice} onDismiss={() => setMaintenanceDismissed(true)} />;
  }

  if (role === "visitor") {
    if (publicPage === "home")
      return (
        <PublicHome go={enter} courses={courses} loading={coursesLoading} />
      );
    if (publicPage === "catalog")
      return <PublicCatalog go={enter} courses={courses} groups={courseGroups} />;
    if (publicPage.startsWith("preview:"))
      return selectedCourse ? (
        <PublicPreview go={enter} course={selectedCourse} />
      ) : (
        <PublicCatalog go={enter} courses={courses} groups={courseGroups} />
      );
    if (publicPage.startsWith("enroll:"))
      return <AuthPage mode="login" go={enter} />;
    if (publicPage === "how") return <HowItWorks go={enter} />;
    if (publicPage === "about") return <AboutPage go={enter} />;
    if (publicPage === "contact") return <ContactPage go={enter} />;
    if (publicPage === "login") return <AuthPage mode="login" go={enter} />;
    if (publicPage === "register")
      return <AuthPage mode="register" go={enter} />;
    return <PublicHome go={enter} courses={courses} loading={coursesLoading} />;
  }
  const displayName = String(
    profile?.displayName ?? user?.displayName ?? user?.email ?? "Utilisateur",
  );
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("") || "CA";
  const authenticatedTopbar = (
    <Topbar
      role={role}
      displayName={displayName}
      initials={initials}
      photoURL={String(profile?.photoURL ?? user?.photoURL ?? "")}
      userId={user?.uid}
      onNavigate={(nextPage) => navigateStudentPage(nextPage)}
      currentPage={role === "student" ? studentPage : undefined}
      onNotificationOpen={(notification) => {
        if (role === "student" && notification.courseId) {
          setSelectedCourseId(notification.courseId);
          setNotificationLessonId(notification.lessonId ?? null);
          navigateStudentPage("course", { selectedCourseId: notification.courseId, notificationLessonId: notification.lessonId ?? null, notificationCommentId: notification.commentId ?? null });
        }
      }}
      onLogout={() => {
        replaceHistoryState({ role: "visitor", publicPage: "home", studentPage: "dashboard", adminPage: "overview", selectedCourseId: null, notificationLessonId: null, notificationCommentId: null, selectedAdminSubjectId: null, selectedAdminNodeId: null });
        void logoutUser();
      }}
    />
  );
  const page = role === "student" ? studentPage : adminPage;
  const content =
    role === "student" ? (
      (() => {
        if (studentPage === "dashboard")
          return (
            <StudentDashboard
              setPage={(page) => navigateStudentPage(page)}
              openCourse={(courseId) => {
                navigateStudentPage("course", { selectedCourseId: courseId, notificationLessonId: null, notificationCommentId: null });
              }}
              courses={activeCourses}
              displayName={displayName}
            />
          );
        if (studentPage === "concours")
          return (
            <div className="page">
              <div className="page-title">
                <div>
                  <div className="eyebrow">MA PRÉPARATION</div>
                  <h1>Mes concours</h1>
                  <p>
                    Retrouvez les préparations auxquelles vous êtes inscrit.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => navigateStudentPage("catalog")}
                >
                  Découvrir les concours
                </button>
              </div>
              {activeCourses.length ? (
                <div className="course-grid">
                  {activeCourses.map((c) => (
                    <CourseCard
                      key={c.id}
                      course={c}
                      enrolled
                      onOpen={() => navigateStudentPage("course", { selectedCourseId: c.id, notificationLessonId: null, notificationCommentId: null })}
                    />
                  ))}
                </div>
              ) : (
                <div className="panel empty-state">
                  Aucune inscription active.
                </div>
              )}
            </div>
          );
        if (studentPage === "catalog")
          return (
            <StudentCatalog
              courses={courses}
              groups={courseGroups}
              myEnrollments={myEnrollments}
              setCourse={(courseId, nextPage) => navigateStudentPage(nextPage, { selectedCourseId: courseId, notificationLessonId: null, notificationCommentId: null })}
            />
          );
        if (studentPage === "library")
          return <LibraryPage />;
        if (studentPage === "enroll")
          return (
            <EnrollmentFlow
              setPage={navigateStudentPage}
              onBack={() => goBack(() => navigateStudentPage("catalog"))}
              course={selectedCourse}
              userId={user?.uid}
            />
          );
        if (studentPage === "course")
          return (
            <CoursePage
              setPage={navigateStudentPage}
              onBack={() => goBack(() => navigateStudentPage("dashboard"))}
              course={selectedCourse}
              userId={user?.uid}
              practice={() => navigateStudentPage("practice")}
              initialLessonId={notificationLessonId}
              initialCommentId={notificationCommentId}
            />
          );
        if (studentPage === "practice")
          return <Practice setPage={navigateStudentPage} onBack={() => goBack(() => navigateStudentPage("course"))} course={selectedCourse} />;
        if (studentPage === "results")
          return <ResultsPage userId={user!.uid} />;
        return <ProfilePage role="student" displayName={displayName} userEmail={user?.email ?? ""} />
      })()
    ) : adminPage === "overview" ? (
      <AdminOverview setPage={navigateAdminPage} courses={courses} />
    ) : adminPage === "courses" ? (
      <AdminCourses courses={courses} userId={user!.uid} groups={courseGroups} coursesLoading={coursesLoading} onGroupsChanged={async () => { setCoursesLoading(true); try { const [groups, refreshed] = await Promise.all([listAdminCourseGroups(), loadAdminCourses()]); setCourseGroups(groups); setCourses(refreshed); } finally { setCoursesLoading(false); } }} />
    ) : adminPage === "subjects" ? (
      <AdminSubjects userId={user!.uid} onOpenSubject={(id) => navigateAdminPage("content", { selectedAdminSubjectId: id })} />
    ) : adminPage === "content" ? (
      selectedAdminSubjectId ? <SubjectWorkspace subjectId={selectedAdminSubjectId} initialNodeId={selectedAdminNodeId ?? ""} onBack={() => goBack(() => navigateAdminPage("subjects", { selectedAdminNodeId: null }))} /> : <AdminSubjects userId={user!.uid} onOpenSubject={(id) => navigateAdminPage("content", { selectedAdminSubjectId: id })} />
    ) : adminPage === "questions" ? (
      <QuestionAdmin initialSubjectId={selectedAdminSubjectId ?? ""} />
    ) : adminPage === "enrollments" ? (
      <AdminEnrollmentPayments role={profile?.role === "content_manager" ? "content_manager" : "super_admin"} />
    ) : adminPage === "users" ? (
      <AdminUsers />
    ) : adminPage === "messages" ? (
      <AdminMessagesPage />
    ) : adminPage === "broadcasts" ? (
      <AdminBroadcastsPage />
    ) : adminPage === "studentQuestions" ? (
      <AdminLessonQuestionsPage onOpenLesson={(courseId, subjectId, lessonId, commentId) => navigateAdminPage("lessonPreview", { adminPreviewCourseId: courseId, selectedAdminSubjectId: subjectId, selectedAdminNodeId: lessonId, adminPreviewCommentId: commentId })} />
    ) : adminPage === "lessonPreview" ? (
      <AdminLessonPreview course={courses.find(courseItem => courseItem.id === adminPreviewCourseId)} subjectId={selectedAdminSubjectId ?? ""} lessonId={selectedAdminNodeId ?? ""} commentId={adminPreviewCommentId ?? ""} onBack={() => goBack(() => navigateAdminPage("studentQuestions"))} />
    ) : adminPage === "library" ? (
      <AdminLibraryPage onBack={() => goBack(() => navigateAdminPage("overview"))} />
    ) : adminPage === "psychotechnical" ? (
      <AdminPsychotechnicalPage onBack={() => goBack(() => navigateAdminPage("overview"))} />
    ) : adminPage === "stats" && role === "admin" ? (
      <AdminAnalyticsPage onBack={() => goBack(() => navigateAdminPage("overview"))} />
    ) : adminPage === "stats" ? (
      <AdminOverview setPage={navigateAdminPage} courses={courses} />
    ) : adminPage === "billing" ? (
      <AdminBillingPage />
    ) : adminPage === "profile" ? (
      <ProfilePage role={role} displayName={displayName} userEmail={user?.email ?? ""} />
    ) : (
      <div className="page">
        <div className="page-title">
          <div>
            <div className="eyebrow">ANALYTIQUE</div>
            <h1>Statistiques</h1>
            <p>
              Les statistiques seront affichées à partir des données réelles
              enregistrées.
            </p>
          </div>
        </div>
        <div className="panel empty-state">
          Aucune statistique calculée pour le moment.
        </div>
      </div>
    );
  return (
    <div className={`app ${role === "student" ? "student-app" : ""}`}>
      {role !== "student" && (
        <Sidebar
          role={role}
          page={page}
          setPage={navigateAdminPage}
        />
      )}
      <div className={`main ${role === "student" ? "student-main" : ""}`}>
        {authenticatedTopbar}
        <MobileNav
          role={role}
          page={page}
          setPage={(nextPage) => {
            if (role === "student") {
              navigateStudentPage(nextPage as StudentPage);
            } else {
              navigateAdminPage(nextPage as AdminPage);
            }
          }}
        />
        <ContentProtection>
          <Suspense fallback={<LightweightLoader label="Chargement de la page…" />}>
            {content}
          </Suspense>
        </ContentProtection>
      </div>
      {navigationLoading ? <LightweightLoader label="Chargement…" /> : null}
    </div>
  );
}


function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Politique de confidentialité | CAV Madagascar";
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", "Politique de confidentialité de CAV Madagascar, notamment concernant la connexion Google et les données personnelles.");
    return () => {
      document.title = "CAV Madagascar | Préparation aux concours";
    };
  }, []);

  return (
    <main className="privacy-page">
      <header className="privacy-header">
        <a className="privacy-brand" href="/" aria-label="Accueil CAV Madagascar">
          <img src="/assets/cav-logo.webp" alt="CAV Madagascar" />
          <span><strong>CAV Madagascar</strong><small>Cours d'Appui Virtuel</small></span>
        </a>
        <a className="privacy-home-link" href="/">Retour à l'accueil</a>
      </header>
      <article className="privacy-content">
        <div className="privacy-eyebrow">INFORMATIONS ET TRANSPARENCE</div>
        <h1>Politique de confidentialité</h1>
        <p className="privacy-updated">Dernière mise à jour : 16 octobre 2026</p>
        <p>CAV Madagascar est une plateforme de formation en ligne destinée notamment à la préparation aux concours. Cette politique explique quelles données personnelles sont traitées, pourquoi elles le sont, comment elles sont protégées et comment vous pouvez demander leur suppression.</p>

        <section><h2>1. Responsable et contact</h2>
          <p>Le service CAV Madagascar est accessible à l'adresse <a href="https://cav.mg">https://cav.mg</a>. Pour toute question relative à vos données personnelles, utilisez le formulaire de contact disponible sur le site. Pour une demande de suppression, indiquez l'adresse e-mail associée à votre compte et précisez que votre demande concerne vos données personnelles.</p>
        </section>

        <section><h2>2. Données que nous collectons</h2>
          <p>Selon les fonctions que vous utilisez, CAV peut traiter les catégories de données suivantes :</p>
          <ul>
            <li><strong>Données de compte :</strong> nom affiché, adresse e-mail, numéro de téléphone si vous le fournissez, identifiant de compte et date de création.</li>
            <li><strong>Connexion avec Google :</strong> si vous choisissez cette option, Firebase Authentication reçoit les informations d'identification nécessaires et CAV peut recevoir de Google votre nom de profil, votre adresse e-mail, votre photo de profil si elle est disponible et un identifiant de compte. Ces informations servent à créer ou à retrouver votre compte CAV.</li>
            <li><strong>Utilisation de la plateforme :</strong> inscriptions aux formations, progression, résultats de quiz, exercices, commentaires, messages envoyés et préférences de notification.</li>
            <li><strong>Paiements et inscriptions :</strong> informations nécessaires au suivi d'une demande d'inscription et à la vérification de paiement. Les informations de paiement transmises par l'utilisateur peuvent être consultées par les personnes autorisées à valider l'inscription.</li>
            <li><strong>Données techniques :</strong> informations de diagnostic et journaux techniques générés par les services d'hébergement et de sécurité utilisés pour faire fonctionner le site.</li>
          </ul>
        </section>

        <section><h2>3. Utilisation des données Google et autorisations OAuth</h2>
          <p>La connexion Google est une méthode facultative d'authentification. Dans l'implémentation actuelle, CAV utilise Google Sign-In via Firebase Authentication pour authentifier l'utilisateur. La demande d'autorisation utilise les informations de base du compte Google nécessaires à l'identification, notamment les éléments associés aux autorisations standard <code>openid</code>, <code>email</code> et <code>profile</code> lorsque celles-ci sont fournies par le flux de connexion.</p>
          <p>CAV n'utilise pas cette connexion pour accéder à Gmail, Google Drive, Google Calendar, aux contacts Google ou au contenu Google Workspace. Le code de connexion examiné ne demande pas d'autorisation OAuth supplémentaire pour ces services.</p>
          <p>Les données reçues lors de la connexion Google servent uniquement à authentifier l'utilisateur, à associer la connexion à son compte CAV, à afficher les informations de profil disponibles et à gérer l'accès à la plateforme. CAV ne vend pas les données Google et ne les utilise pas pour la publicité ciblée ni pour entraîner des modèles d'intelligence artificielle.</p>
        </section>

        <section><h2>4. Services et stockage</h2>
          <p>CAV utilise les services Firebase de Google pour l'authentification, la base de données et le stockage des fichiers nécessaires au fonctionnement de la plateforme. Les données de compte et les données pédagogiques sont enregistrées dans les services de données de CAV avec des règles d'accès destinées à limiter la consultation aux utilisateurs concernés et aux personnes autorisées selon leur rôle. Les fichiers nécessaires aux cours peuvent être hébergés dans le stockage associé à la plateforme.</p>
          <p>Le site est diffusé via son infrastructure d'hébergement et de distribution. Les prestataires techniques peuvent traiter certaines données dans la mesure nécessaire à l'hébergement, à la sécurité, à la maintenance et au fonctionnement du service.</p>
        </section>

        <section><h2>5. Partage des données</h2>
          <p>CAV ne vend pas les données personnelles. Elles peuvent être traitées ou communiquées uniquement dans les cas nécessaires suivants :</p>
          <ul>
            <li>aux services Google Firebase utilisés pour l'authentification, le stockage et le fonctionnement technique de CAV ;</li>
            <li>aux administrateurs ou membres autorisés de CAV, uniquement dans le cadre de la gestion des comptes, des formations, des paiements, de l'assistance ou de la sécurité ;</li>
            <li>aux prestataires techniques qui contribuent à l'hébergement ou à la sécurité, dans la limite de leurs fonctions ;</li>
            <li>lorsque la loi l'exige ou pour protéger les droits, la sécurité et l'intégrité du service.</li>
          </ul>
          <p>Les données Google obtenues lors de la connexion ne sont pas partagées avec des tiers à des fins indépendantes de celles décrites dans cette politique.</p>
        </section>

        <section><h2>6. Sécurité</h2>
          <p>CAV applique des mesures techniques et organisationnelles visant à protéger les données, notamment l'authentification des utilisateurs, la gestion des droits d'accès et les règles de sécurité des services Firebase. L'accès administratif est réservé aux personnes autorisées. Aucun système ne pouvant garantir une sécurité absolue, les utilisateurs doivent également protéger leurs identifiants et signaler toute activité suspecte.</p>
        </section>

        <section><h2>7. Conservation et suppression</h2>
          <p>Les données sont conservées pendant la durée nécessaire à la gestion du compte, à l'accès aux formations, au suivi pédagogique, à la sécurité et au respect des obligations légales applicables. Certaines informations peuvent être conservées plus longtemps lorsqu'une obligation légale ou un besoin légitime de résolution de litige l'exige.</p>
          <p>Vous pouvez demander la suppression de votre compte et des données personnelles associées en utilisant le formulaire de contact sur <a href="https://cav.mg">cav.mg</a>. Indiquez l'adresse e-mail de votre compte. CAV vérifiera la demande avant de la traiter. Certaines données peuvent être conservées lorsque la loi l'impose. La suppression du compte peut entraîner la perte de l'accès aux cours, à la progression et aux résultats associés.</p>
        </section>

        <section><h2>8. Choix de l'utilisateur</h2>
          <p>Vous pouvez choisir de ne pas utiliser la connexion Google et créer un compte avec une adresse e-mail et un mot de passe. Vous pouvez également demander l'accès, la correction ou la suppression des données personnelles vous concernant, sous réserve des obligations légales applicables.</p>
        </section>

        <section><h2>9. Mineurs</h2>
          <p>Les utilisateurs mineurs doivent utiliser la plateforme avec l'accord et, lorsque cela est requis, sous la supervision de leur parent ou représentant légal.</p>
        </section>

        <section><h2>10. Modifications de cette politique</h2>
          <p>Cette politique peut être mise à jour pour refléter l'évolution de la plateforme, des services utilisés ou des obligations applicables. La version en vigueur est publiée sur cette page avec sa date de mise à jour.</p>
        </section>
        <div className="privacy-bottom"><a href="/">Retour à CAV Madagascar</a><span>© 2026 CAV Madagascar</span></div>
      </article>
    </main>
  );
}

export default function App() {
  if (window.location.pathname === "/privacy-policy" || window.location.pathname === "/privacy-policy/") {
    return <PrivacyPolicyPage />;
  }
  if (window.location.pathname === "/auth/action") {
    return <Suspense fallback={<LightweightLoader label="Chargement…" />}><AuthActionPage /></Suspense>;
  }
  return <><AppContent /><SessionReplacedNotice /></>;
}
