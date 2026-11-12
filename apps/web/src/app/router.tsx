import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { RequireAuth, RequireBareAuth } from "./guards";
import { LoginPage } from "../features/auth/LoginPage";
import { AdminDashboard, StudentDashboard, TeacherDashboard } from "../routes/dashboards";
import {
  NotFoundPage,
  NotificationsPage,
  PlaceholderPage,
  ProfilePage,
  SettingsPage,
} from "../routes/pages";
import {
  AdminAcademicYearsPage,
  AdminClassesPage,
  AdminSubjectsPage,
  AdminUsersPage,
  AnnouncementsPage,
} from "../features/admin/admin-pages";
import { TeacherCoursesPage } from "../features/teacher/teacher-courses";
import { TeacherClassesPage } from "../features/teacher/teacher-classes";
import { CourseEditorPage } from "../features/teacher/course-editor";
import { JoinClassPage } from "../features/classes/class-join";
import {
  StudentCourseDetailPage,
  StudentCoursesPage,
  StudentLessonPage,
  StudentProgressPage,
} from "../features/courses/student-learning";
import { DemoLabDetailPage, DemoLabsPage } from "../features/demo/demo-labs";
import { DemoAssignmentsPage } from "../features/demo/demo-assignments";
import { DemoQuizRunnerPage, DemoQuizzesPage } from "../features/demo/demo-quizzes";
import { DemoSubnetPage } from "../features/demo/demo-subnet";

const StudentExamPage = lazy(() => import("../features/exams/StudentExamPage"));

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/", element: <Navigate to="/login" replace /> },
  {
    element: <RequireBareAuth roles={["siswa"]} />,
    children: [
      {
        path: "/student/courses/:courseId/exams/:examType",
        element: <Suspense fallback={<div className="min-h-screen bg-[#FDFBF7] p-8 text-stone-600" role="status">Memuat modul ujian…</div>}><StudentExamPage /></Suspense>,
      },
    ],
  },
  {
    element: <RequireAuth roles={["siswa"]} />,
    children: [
      { path: "/student/dashboard", element: <StudentDashboard /> },
      { path: "/student/courses", element: <StudentCoursesPage /> },
      { path: "/student/courses/:courseId", element: <StudentCourseDetailPage /> },
      { path: "/student/lessons/:lessonId", element: <StudentLessonPage /> },
      { path: "/student/labs", element: <DemoLabsPage /> },
      { path: "/student/labs/:labId", element: <DemoLabDetailPage /> },
      { path: "/student/assignments", element: <DemoAssignmentsPage /> },
      { path: "/student/quizzes", element: <DemoQuizzesPage /> },
      { path: "/student/quizzes/:quizId", element: <DemoQuizRunnerPage /> },
      { path: "/student/subnetting", element: <DemoSubnetPage /> },
      { path: "/student/progress", element: <StudentProgressPage /> },
    ],
  },
  {
    element: <RequireAuth roles={["guru"]} />,
    children: [
      { path: "/teacher/dashboard", element: <TeacherDashboard /> },
      { path: "/teacher/courses", element: <TeacherCoursesPage scope="teacher" /> },
      { path: "/teacher/courses/:courseId/edit", element: <CourseEditorPage /> },
      { path: "/teacher/announcements", element: <AnnouncementsPage scope="guru" /> },
      { path: "/teacher/labs", element: <PlaceholderPage no="TCH-LAB" title="Kelola Lab" body="Pembuatan lab, rubrik penilaian, dan review kiriman hadir di Phase 3." /> },
      { path: "/teacher/assignments", element: <PlaceholderPage no="TCH-ASG" title="Tugas" body="Pembuatan tugas dan penilaian kiriman hadir di Phase 3." /> },
      { path: "/teacher/submissions", element: <PlaceholderPage no="TCH-SUB" title="Kiriman masuk" body="Antrean penilaian tugas dan lab hadir di Phase 3." /> },
      { path: "/teacher/assessments", element: <PlaceholderPage no="TCH-ASS" title="Asesmen & rubrik" body="Bank soal, rubrik kompetensi, dan capaian kelas hadir di Phase 3." /> },
      { path: "/teacher/classes", element: <TeacherClassesPage /> },
    ],
  },
  {
    element: <RequireAuth roles={["admin"]} />,
    children: [
      { path: "/admin/dashboard", element: <AdminDashboard /> },
      { path: "/admin/users", element: <AdminUsersPage /> },
      { path: "/admin/classes", element: <AdminClassesPage /> },
      { path: "/admin/subjects", element: <AdminSubjectsPage /> },
      { path: "/admin/academic-years", element: <AdminAcademicYearsPage /> },
      { path: "/admin/courses", element: <TeacherCoursesPage scope="admin" /> },
      { path: "/admin/competencies", element: <PlaceholderPage no="ADM-CMP" title="Kompetensi" body="Peta kompetensi TKJ yang dapat dikonfigurasi; pencapaian siswa diisi di Phase 3." /> },
      { path: "/admin/announcements", element: <AnnouncementsPage scope="admin" /> },
      { path: "/admin/settings", element: <PlaceholderPage no="ADM-SET" title="Pengaturan sekolah" body="Identitas sekolah dan preferensi notifikasi hadir di Phase 3." /> },
    ],
  },
  {
    element: <RequireAuth roles={["admin", "guru", "siswa"]} />,
    children: [
      { path: "/join/:code", element: <JoinClassPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "/notifications", element: <NotificationsPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
