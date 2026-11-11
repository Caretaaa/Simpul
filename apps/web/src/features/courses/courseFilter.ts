import { useMemo, useState } from "react";

export type CourseStatusFilter = "all" | "in-progress" | "completed" | "not-started";
export type CourseSort = "progress" | "title" | "materials";

export interface FilterableCourse {
  id: string;
  title: string;
  subjectName: string | null;
  className: string | null;
  teacherName: string | null;
  totalLessons: number;
  completedLessons: number;
}

export interface CourseFilterState {
  q: string;
  status: CourseStatusFilter;
  sort: CourseSort;
}

export function courseProgress(c: Pick<FilterableCourse, "totalLessons" | "completedLessons">): number | null {
  if (c.totalLessons === 0) return null;
  return Math.round((c.completedLessons / c.totalLessons) * 100);
}

export function courseStatus(c: Pick<FilterableCourse, "totalLessons" | "completedLessons">): Exclude<CourseStatusFilter, "all"> {
  if (c.totalLessons > 0 && c.completedLessons >= c.totalLessons) return "completed";
  if (c.completedLessons > 0) return "in-progress";
  return "not-started";
}

export function filterCourses<T extends FilterableCourse>(
  courses: T[],
  state: CourseFilterState,
): T[] {
  const q = state.q.trim().toLowerCase();
  const matched = courses.filter((c) => {
    if (state.status !== "all" && courseStatus(c) !== state.status) return false;
    if (q.length === 0) return true;
    const hay = [c.title, c.subjectName, c.className, c.teacherName]
      .filter((v): v is string => typeof v === "string")
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  const by = [...matched];
  if (state.sort === "title") {
    by.sort((a, b) => a.title.localeCompare(b.title, "id"));
  } else if (state.sort === "materials") {
    by.sort((a, b) => b.totalLessons - a.totalLessons || a.title.localeCompare(b.title, "id"));
  } else {
    by.sort((a, b) => {
      const pa = courseProgress(a);
      const pb = courseProgress(b);
      if (pa === null && pb === null) return a.title.localeCompare(b.title, "id");
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pb - pa || a.title.localeCompare(b.title, "id");
    });
  }
  return by;
}

/** State filter kursus yang dipakai ulang dasbor & halaman kursus. */
export function useCourseFilter(initialQ = "") {
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState<CourseStatusFilter>("all");
  const [sort, setSort] = useState<CourseSort>("progress");
  const state = useMemo<CourseFilterState>(() => ({ q, status, sort }), [q, status, sort]);
  return { q, setQ, status, setStatus, sort, setSort, state };
}
