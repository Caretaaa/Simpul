import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { loadEnv } from "./config.js";
import { __resetDb, getDb } from "./db/connection.js";
import { migrate } from "./db/migrate.js";
import { eq } from "drizzle-orm";
import { academicYears, classMemberships, classes, subjects, users } from "./db/schema.js";
import { hashPassword } from "./middleware/auth.js";

const DEMO = {
  admin: { email: "admin@t.sch.id", password: "Admin123!", name: "Admin", role: "admin" as const },
  guru: { email: "guru@t.sch.id", password: "Guru123!", name: "Guru", role: "guru" as const },
  siswa: { email: "siswa@t.sch.id", password: "Siswa123!", name: "Siswa", role: "siswa" as const },
};

function cookieOf(res: { headers: Record<string, unknown> }): string {
  const set = res.headers["set-cookie"];
  const first = Array.isArray(set) ? set[0] : String(set ?? "");
  return first.split(";")[0] ?? "";
}

let YEAR_ID = "";
let CLASS_ID = "";
let SUBJECT_ID = "";

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "simpul-test-"));
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
  process.env.SESSION_SECRET = "rahasia-pengujian-minimal-32-karakter!!";
  __resetDb();
  migrate();
  const db = getDb();
  const now = new Date();
  for (const u of Object.values(DEMO)) {
    await db.insert(users).values({
      id: randomUUID(), email: u.email, name: u.name,
      passwordHash: await hashPassword(u.password), role: u.role,
      isActive: true, createdAt: now, updatedAt: now,
    });
  }
  YEAR_ID = randomUUID();
  CLASS_ID = randomUUID();
  SUBJECT_ID = randomUUID();
  await db.insert(academicYears).values({ id: YEAR_ID, name: "Tahun Uji", isActive: true, createdAt: now, updatedAt: now });
  await db.insert(classes).values({ id: CLASS_ID, name: "XI TKJ Uji", grade: "XI", major: "TKJ", academicYearId: YEAR_ID, homeroomTeacherId: null, createdAt: now, updatedAt: now });
  await db.insert(subjects).values({ id: SUBJECT_ID, code: "UJI", name: "Mata Pelajaran Uji", description: null, createdAt: now, updatedAt: now });
});

const sessions = new Map<FastifyInstance, string>();

async function testApp(): Promise<FastifyInstance> {
  return buildApp({ ...loadEnv(), NODE_ENV: "test" as const });
}

async function login(email: string, password: string): Promise<FastifyInstance> {
  const app = await testApp();
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
  expect(res.statusCode).toBe(200);
  sessions.set(app, cookieOf(res));
  return app;
}

/** Injeksi permintaan terautentikasi dengan sesi milik instance aplikasi. */
function asSession(app: FastifyInstance) {
  return (opts: { method: "GET" | "POST" | "PATCH" | "DELETE"; url: string; payload?: unknown }) =>
    app.inject({
      method: opts.method,
      url: opts.url,
      payload: opts.payload as object | undefined,
      headers: { cookie: sessions.get(app)! },
    });
}

describe("Phase 2 — alur inti LMS", () => {
  it("guru membuat kursus, modul, materi → kursus bisa terbit", async () => {
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const req = asSession(guru);
    const created = await req({
      method: "POST", url: "/api/courses",
      payload: { title: "Kursus VLAN Dasar", description: "Dasar VLAN", subjectId: SUBJECT_ID, classId: CLASS_ID },
    });
    expect(created.statusCode).toBe(201);
    const courseId = created.json().course.id as string;

    // Belum boleh terbit: belum ada materi.
    const early = await req({ method: "POST", url: `/api/courses/${courseId}/status`, payload: { status: "published" } });
    expect(early.statusCode).toBe(409);
    expect(early.json().message).toMatch(/minimal satu materi/);

    const mod = await req({ method: "POST", url: `/api/courses/${courseId}/modules`, payload: { title: "Modul 1 — VLAN" } });
    expect(mod.statusCode).toBe(201);
    const moduleId = mod.json().module.id as string;

    const lesson = await req({
      method: "POST", url: "/api/lessons",
      payload: { moduleId, title: "Konsep VLAN 802.1Q", contentType: "article", body: "# Konsep VLAN" },
    });
    expect(lesson.statusCode).toBe(201);
    const lessonId = lesson.json().lesson.id as string;

    const republish = await req({ method: "POST", url: `/api/courses/${courseId}/status`, payload: { status: "published" } });
    expect(republish.statusCode).toBe(200);

    const detail = await req({ method: "GET", url: `/api/courses/${courseId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().modules[0].lessons[0].id).toBe(lessonId);

    // Siswa tidak boleh membuat kursus.
    const siswa = await login(DEMO.siswa.email, DEMO.siswa.password);
    const denied = await asSession(siswa)({
      method: "POST", url: "/api/courses", payload: { title: "x", subjectId: SUBJECT_ID, classId: CLASS_ID },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("admin mendaftarkan siswa → siswa menandai materi selesai (progres terhitung)", async () => {
    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const adminReq = asSession(admin);
    const created = await adminReq({
      method: "POST", url: "/api/courses",
      payload: { title: "Kursus Enrollmen", subjectId: SUBJECT_ID, classId: CLASS_ID },
    });
    const courseId = created.json().course.id as string;
    const mod = await adminReq({ method: "POST", url: `/api/courses/${courseId}/modules`, payload: { title: "Modul 1" } });
    const moduleId = mod.json().module.id as string;
    const lesson = await adminReq({
      method: "POST", url: "/api/lessons", payload: { moduleId, title: "Materi 1", body: "# Materi" },
    });
    const lessonId = lesson.json().lesson.id as string;
    await adminReq({ method: "POST", url: `/api/courses/${courseId}/status`, payload: { status: "published" } });

    const siswa = await login(DEMO.siswa.email, DEMO.siswa.password);
    const studentReq = asSession(siswa);
    const me = await studentReq({ method: "GET", url: "/api/auth/me" });
    const studentId = me.json().user.id as string;

    const before = await studentReq({ method: "GET", url: "/api/courses" });
    expect(before.statusCode).toBe(200);
    const beforeCourse = (before.json().courses as Array<{ id: string; isEnrolled: boolean }>).find(
      (c) => c.id === courseId,
    );
    expect(beforeCourse?.isEnrolled ?? false).toBe(false);

    const enroll = await adminReq({
      method: "POST", url: `/api/courses/${courseId}/enrollments`, payload: { studentIds: [studentId] },
    });
    expect(enroll.json().added).toBe(1);
    // Enrollmen idempoten: ulangi tidak menambah baris.
    const again = await adminReq({
      method: "POST", url: `/api/courses/${courseId}/enrollments`, payload: { studentIds: [studentId] },
    });
    expect(again.json().added).toBe(0);

    const after = await studentReq({ method: "GET", url: "/api/courses" });
    const mine = (after.json().courses as Array<{ id: string; isEnrolled: boolean }>).find((c) => c.id === courseId);
    expect(mine?.isEnrolled).toBe(true);

    const progress = await studentReq({
      method: "POST", url: `/api/lessons/${lessonId}/progress`, payload: { status: "completed" },
    });
    expect(progress.statusCode).toBe(200);
    const meProgress = await studentReq({ method: "GET", url: "/api/me/progress" });
    const completed = (meProgress.json().progress as Array<{ lessonId: string; status: string }>).filter((p) => p.status === "completed");
    expect(completed.map((p) => p.lessonId)).toContain(lessonId);

    // Guru tidak boleh mencatat progres siswa.
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const guruProgress = await asSession(guru)({
      method: "POST", url: `/api/lessons/${lessonId}/progress`, payload: { status: "completed" },
    });
    expect(guruProgress.statusCode).toBe(403);
  });

  it("kursus tak dikenal menghasilkan 404", async () => {
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const res = await asSession(guru)({ method: "GET", url: "/api/courses/tidak-ada" });
    expect(res.statusCode).toBe(404);
  });

  it("guru hanya boleh mengubah kursusnya sendiri", async () => {
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const guruReq = asSession(guru);
    const created = await guruReq({
      method: "POST", url: "/api/courses", payload: { title: "Kursus Guru A", subjectId: SUBJECT_ID, classId: CLASS_ID },
    });
    const courseId = created.json().course.id as string;

    // Buat kursus kedua oleh admin → guru tidak boleh mengubahnya.
    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const other = await asSession(admin)({
      method: "POST", url: "/api/courses", payload: { title: "Kursus Admin", subjectId: SUBJECT_ID, classId: CLASS_ID },
    });
    const otherId = other.json().course.id as string;
    const denied = await guruReq({ method: "PATCH", url: `/api/courses/${otherId}`, payload: { title: "Diubah Guru" } });
    expect(denied.statusCode).toBe(403);
    void courseId;
  });

  it("reset kata sandi: token sekali-pakai dan sandi baru berfungsi", async () => {
    // Akun khusus agar perubahan sandi tidak mengganggu tes lain.
    const targetEmail = "reset@t.sch.id";
    const db = getDb();
    const now = new Date();
    await db.insert(users).values({
      id: randomUUID(), email: targetEmail, name: "Akun Reset", passwordHash: await hashPassword("SandiLama123"),
      role: "siswa", isActive: true, createdAt: now, updatedAt: now,
    });

    const app = await testApp();
    const req = await app.inject({
      method: "POST", url: "/api/auth/password-reset/request", payload: { email: targetEmail },
    });
    expect(req.statusCode).toBe(200);
    const token = req.json().devToken as string;
    expect(typeof token).toBe("string");

    const resolve = await app.inject({
      method: "POST", url: "/api/auth/password-reset/resolve", payload: { token, password: "SandiBaru123" },
    });
    expect(resolve.statusCode).toBe(200);

    // Token tidak bisa dipakai dua kali.
    const again = await app.inject({
      method: "POST", url: "/api/auth/password-reset/resolve", payload: { token, password: "SandiLain123" },
    });
    expect(again.statusCode).toBe(400);

    // Login dengan sandi baru.
    const loginNew = await app.inject({
      method: "POST", url: "/api/auth/login", payload: { email: targetEmail, password: "SandiBaru123" },
    });
    expect(loginNew.statusCode).toBe(200);

    // Sandi lama tidak lagi berlaku.
    const old = await app.inject({
      method: "POST", url: "/api/auth/login", payload: { email: targetEmail, password: "SandiLama123" },
    });
    expect(old.statusCode).toBe(401);
  });

  it("admin membuat pengumuman sekolah yang terlihat siswa", async () => {
    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const adminReq = asSession(admin);
    const created = await adminReq({
      method: "POST", url: "/api/announcements",
      payload: { title: "Ujian praktik minggu depan", body: "Persiapkan perangkat praktikum Anda.", scope: "school" },
    });
    expect(created.statusCode).toBe(201);

    const siswa = await login(DEMO.siswa.email, DEMO.siswa.password);
    const list = await asSession(siswa)({ method: "GET", url: "/api/announcements" });
    expect((list.json().announcements as unknown[]).length).toBeGreaterThan(0);

    // Guru tidak boleh mengumumkan untuk kursus admin (bukan miliknya).
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const otherCourse = await asSession(guru)({
      method: "POST", url: "/api/courses", payload: { title: "Kursus Guru A 2", subjectId: SUBJECT_ID, classId: CLASS_ID },
    });
    const courseId = otherCourse.json().course.id as string;
    const adminCourse = await adminReq({
      method: "POST", url: "/api/courses", payload: { title: "Kursus Admin 2", subjectId: SUBJECT_ID, classId: CLASS_ID },
    });
    const adminCourseId = adminCourse.json().course.id as string;
    const denied = await asSession(guru)({
      method: "POST", url: "/api/announcements",
      payload: { title: "Pengumuman", body: "Isi", scope: "course", courseId: adminCourseId },
    });
    expect(denied.statusCode).toBe(403);
    const own = await asSession(guru)({
      method: "POST", url: "/api/announcements",
      payload: { title: "Info kursus saya", body: "Isi", scope: "course", courseId },
    });
    expect(own.statusCode).toBe(201);
  });
});

describe("Gabung kelas via kode", () => {
  it("kelas baru otomatis memiliki kode gabung 6 karakter yang unik", async () => {
    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const adminReq = asSession(admin);
    const first = await adminReq({
      method: "POST", url: "/api/classes",
      payload: { name: "X TKJ Kode A", grade: "X", major: "TKJ", academicYearId: YEAR_ID },
    });
    expect(first.statusCode).toBe(201);
    const codeA = first.json().class.joinCode as string;
    expect(codeA).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const second = await adminReq({
      method: "POST", url: "/api/classes",
      payload: { name: "X TKJ Kode B", grade: "X", major: "TKJ", academicYearId: YEAR_ID },
    });
    const codeB = second.json().class.joinCode as string;
    expect(codeB).not.toBe(codeA);
  });

  it("siswa mengintip kelas dari kode, bergabung, dan otomatis terdaftar ke kursus terbit", async () => {
    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const adminReq = asSession(admin);
    const created = await adminReq({
      method: "POST", url: "/api/classes",
      payload: { name: "XI TKJ Gabung", grade: "XI", major: "TKJ", academicYearId: YEAR_ID },
    });
    const classId = created.json().class.id as string;
    const joinCode = created.json().class.joinCode as string;

    // Siapkan kursus terbit pada kelas tersebut.
    const course = await adminReq({
      method: "POST", url: "/api/courses",
      payload: { title: "Kursus Kelas Gabung", subjectId: SUBJECT_ID, classId },
    });
    const courseId = course.json().course.id as string;
    const mod = await adminReq({ method: "POST", url: `/api/courses/${courseId}/modules`, payload: { title: "Modul 1" } });
    await adminReq({
      method: "POST", url: "/api/lessons",
      payload: { moduleId: mod.json().module.id, title: "Materi 1", body: "# Materi" },
    });
    await adminReq({ method: "POST", url: `/api/courses/${courseId}/status`, payload: { status: "published" } });

    const siswa = await login(DEMO.siswa.email, DEMO.siswa.password);
    const studentReq = asSession(siswa);

    // Intip info kelas dari kode (huruf kecil + spasi tetap dikenali).
    const peek = await studentReq({ method: "GET", url: `/api/classes/code/${joinCode.toLowerCase()}` });
    expect(peek.statusCode).toBe(200);
    expect(peek.json().class.name).toBe("XI TKJ Gabung");
    expect(peek.json().isMember).toBe(false);
    expect(peek.json().publishedCourseCount).toBe(1);

    // Sebelum bergabung, kursus kelas itu tidak terlihat siswa.
    const before = await studentReq({ method: "GET", url: "/api/courses" });
    expect((before.json().courses as Array<{ id: string }>).some((c) => c.id === courseId)).toBe(false);

    const joined = await studentReq({ method: "POST", url: "/api/classes/join", payload: { code: joinCode } });
    expect(joined.statusCode).toBe(200);
    expect(joined.json().already).toBe(false);
    expect(joined.json().enrolledCourses).toBe(1);

    // Sesudah bergabung: kursus terlihat dan berstatus terdaftar.
    const after = await studentReq({ method: "GET", url: "/api/courses" });
    const mine = (after.json().courses as Array<{ id: string; isEnrolled: boolean }>).find((c) => c.id === courseId);
    expect(mine?.isEnrolled).toBe(true);

    // Gabung ulang bersifat idempoten.
    const again = await studentReq({ method: "POST", url: "/api/classes/join", payload: { code: joinCode } });
    expect(again.json().already).toBe(true);

    // Daftar anggota tercatat.
    const members = await adminReq({ method: "GET", url: `/api/classes/${classId}/members` });
    expect((members.json().members as Array<{ email: string }>).some((m) => m.email === DEMO.siswa.email)).toBe(true);
  });

  it("kode salah → 404; guru/admin tidak boleh bergabung sebagai siswa", async () => {
    const siswa = await login(DEMO.siswa.email, DEMO.siswa.password);
    const wrong = await asSession(siswa)({ method: "POST", url: "/api/classes/join", payload: { code: "ZZZZZZ" } });
    expect(wrong.statusCode).toBe(404);

    const peekWrong = await asSession(siswa)({ method: "GET", url: "/api/classes/code/ZZZZZZ" });
    expect(peekWrong.statusCode).toBe(404);

    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const guruJoin = await asSession(guru)({ method: "POST", url: "/api/classes/join", payload: { code: "ABCDEF" } });
    expect(guruJoin.statusCode).toBe(403);
  });

  it("kode gabung dapat dibuat ulang oleh admin", async () => {    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const adminReq = asSession(admin);
    const created = await adminReq({
      method: "POST", url: "/api/classes",
      payload: { name: "XII TKJ Regenerasi", grade: "XII", major: "TKJ", academicYearId: YEAR_ID },
    });
    const classId = created.json().class.id as string;
    const oldCode = created.json().class.joinCode as string;
    const regen = await adminReq({ method: "POST", url: `/api/classes/${classId}/regenerate-code` });
    expect(regen.statusCode).toBe(200);
    expect(regen.json().joinCode).not.toBe(oldCode);

    // Kode lama tidak lagi berlaku.
    const siswa = await login(DEMO.siswa.email, DEMO.siswa.password);
    const stale = await asSession(siswa)({ method: "POST", url: "/api/classes/join", payload: { code: oldCode } });
    expect(stale.statusCode).toBe(404);
  });
});

describe("Pembuatan kelas oleh guru & admin", () => {
  it("guru dapat membuat kelas dan otomatis menjadi walinya", async () => {
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const guruReq = asSession(guru);
    const me = await guruReq({ method: "GET", url: "/api/auth/me" });
    const guruId = me.json().user.id as string;

    const created = await guruReq({
      method: "POST", url: "/api/classes",
      payload: { name: "XII TKJ Guru", grade: "XII", major: "TKJ", academicYearId: YEAR_ID },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().class.homeroomTeacherId).toBe(guruId);
    expect(created.json().class.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // Kelas guru muncul di "kelas saya".
    const mine = await guruReq({ method: "GET", url: "/api/classes/mine" });
    expect((mine.json().classes as Array<{ id: string }>).some((c) => c.id === created.json().class.id)).toBe(true);
  });

  it("siswa dilarang membuat kelas (403)", async () => {
    const siswa = await login(DEMO.siswa.email, DEMO.siswa.password);
    const denied = await asSession(siswa)({
      method: "POST", url: "/api/classes",
      payload: { name: "X TKJ Siswa", grade: "X", major: "TKJ", academicYearId: YEAR_ID },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("admin membuat kelas sambil memilih wali dan siswa anggota", async () => {
    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const adminReq = asSession(admin);

    const gurus = await adminReq({ method: "GET", url: "/api/users/by-role?role=guru" });
    expect(gurus.statusCode).toBe(200);
    const guruId = (gurus.json().users as Array<{ id: string }>)[0]!.id;

    const siswas = await adminReq({ method: "GET", url: "/api/users/by-role?role=siswa" });
    const studentIds = (siswas.json().users as Array<{ id: string }>).map((u) => u.id);
    expect(studentIds.length).toBeGreaterThan(0);

    const created = await adminReq({
      method: "POST", url: "/api/classes",
      payload: { name: "X TKJ Lengkap", grade: "X", major: "TKJ", academicYearId: YEAR_ID, homeroomTeacherId: guruId, studentIds },
    });
    expect(created.statusCode).toBe(201);
    const classId = created.json().class.id as string;
    expect(created.json().class.homeroomTeacherId).toBe(guruId);
    expect(created.json().class.memberCount).toBe(studentIds.length);

    // Anggota tercatat dan terlihat siswa sebagai kelasnya.
    const members = await adminReq({ method: "GET", url: `/api/classes/${classId}/members` });
    expect((members.json().members as unknown[]).length).toBe(studentIds.length);

    const siswa = await login(DEMO.siswa.email, DEMO.siswa.password);
    const mine = await asSession(siswa)({ method: "GET", url: "/api/classes/mine" });
    expect((mine.json().classes as Array<{ id: string }>).some((c) => c.id === classId)).toBe(true);
  });

  it("admin dapat mengganti daftar siswa (semantik set) dan wali", async () => {
    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const adminReq = asSession(admin);
    const created = await adminReq({
      method: "POST", url: "/api/classes",
      payload: { name: "X TKJ Ubah", grade: "X", major: "TKJ", academicYearId: YEAR_ID },
    });
    const classId = created.json().class.id as string;

    const siswas = await adminReq({ method: "GET", url: "/api/users/by-role?role=siswa" });
    const allIds = (siswas.json().users as Array<{ id: string }>).map((u) => u.id);
    const subset = allIds.slice(0, 1);

    const patched = await adminReq({ method: "PATCH", url: `/api/classes/${classId}`, payload: { studentIds: subset } });
    expect(patched.statusCode).toBe(200);
    const members = await adminReq({ method: "GET", url: `/api/classes/${classId}/members` });
    expect((members.json().members as unknown[]).length).toBe(subset.length);

    // Wali non-guru ditolak.
    const badWali = await adminReq({ method: "PATCH", url: `/api/classes/${classId}`, payload: { homeroomTeacherId: subset[0] } });
    expect(badWali.statusCode).toBe(400);

    // Siswa tak dikenal ditolak.
    const badStudent = await adminReq({ method: "PATCH", url: `/api/classes/${classId}`, payload: { studentIds: ["tidak-ada"] } });
    expect(badStudent.statusCode).toBe(400);
  });
});

describe("Absensi kehadiran", () => {
  let guruId = "";
  let siswaId = "";
  let classId = "";
  let attendanceCode = "";
  let sessionId = "";

  beforeAll(async () => {
    const db = getDb();
    const allUsers = await db.select().from(users);
    guruId = allUsers.find((u) => u.email === DEMO.guru.email)!.id;
    siswaId = allUsers.find((u) => u.email === DEMO.siswa.email)!.id;
    // Kelas uji dijadikan kelas wali guru, dengan satu siswa anggota.
    await db.update(classes).set({ homeroomTeacherId: guruId }).where(eq(classes.id, CLASS_ID));
    const members = await db.select().from(classMemberships).where(eq(classMemberships.classId, CLASS_ID));
    if (!members.some((m) => m.studentId === siswaId)) {
      await db.insert(classMemberships).values({ id: randomUUID(), classId: CLASS_ID, studentId: siswaId, joinedAt: new Date() });
    }
    classId = CLASS_ID;
  });

  it("guru melihat kelas absensi dan kartu QR siswa dibuat otomatis", async () => {
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const req = asSession(guru);

    const classesRes = await req({ method: "GET", url: "/api/attendance/classes" });
    expect(classesRes.statusCode).toBe(200);
    const row = (classesRes.json().classes as Array<{ id: string; memberCount: number; isHomeroom: boolean }>).find(
      (c) => c.id === classId,
    );
    expect(row).toBeTruthy();
    expect(row!.isHomeroom).toBe(true);
    expect(row!.memberCount).toBeGreaterThanOrEqual(1);

    const cards = await req({ method: "GET", url: `/api/attendance/classes/${classId}/cards` });
    expect(cards.statusCode).toBe(200);
    const student = (cards.json().students as Array<{ id: string; name: string; attendanceCode: string }>).find(
      (s) => s.id === siswaId,
    );
    expect(student).toBeTruthy();
    expect(student!.attendanceCode).toMatch(/^[2-9A-HJ-NP-Z]{10}$/);
    attendanceCode = student!.attendanceCode;
  });

  it("membuka sesi absensi bersifat idempoten untuk kelas+tanggal yang sama", async () => {
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const req = asSession(guru);

    const first = await req({
      method: "POST", url: "/api/attendance/sessions",
      payload: { classId, date: "2026-02-10" },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().created).toBe(true);
    const session = first.json().session;
    sessionId = session.id as string;
    expect(session.status).toBe("open");
    expect(session.title).toBe("Absensi harian");
    expect(session.date).toBe("2026-02-10");
    const roster = session.students as Array<{ id: string; attendanceCode: string; status: string | null }>;
    expect(roster.find((s) => s.id === siswaId)?.status).toBeNull();
    expect(session.summary.unmarked).toBe(session.summary.total);

    const again = await req({
      method: "POST", url: "/api/attendance/sessions",
      payload: { classId, date: "2026-02-10" },
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().created).toBe(false);
    expect(again.json().session.id).toBe(sessionId);

    const patched = await req({
      method: "PATCH", url: `/api/attendance/sessions/${sessionId}`,
      payload: { title: "Absensi Dasar Jaringan" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().session.title).toBe("Absensi Dasar Jaringan");

    const list = await req({ method: "GET", url: `/api/attendance/sessions?classId=${classId}` });
    expect(list.statusCode).toBe(200);
    expect((list.json().sessions as Array<{ id: string }>)[0]!.id).toBe(sessionId);
  });

  it("pindai kartu menandai hadir, duplikat terdeteksi, kode asing ditolak", async () => {
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const req = asSession(guru);

    const scan = await req({ method: "POST", url: `/api/attendance/sessions/${sessionId}/scan`, payload: { code: attendanceCode } });
    expect(scan.statusCode).toBe(200);
    expect(scan.json().duplicate).toBe(false);
    expect(scan.json().student.name).toContain("Siswa");
    expect(scan.json().record.status).toBe("hadir");
    expect(scan.json().record.method).toBe("scan");

    const dup = await req({ method: "POST", url: `/api/attendance/sessions/${sessionId}/scan`, payload: { code: attendanceCode } });
    expect(dup.statusCode).toBe(200);
    expect(dup.json().duplicate).toBe(true);

    // Isi QR lengkap dari kamera juga diterima.
    const viaQr = await req({
      method: "POST", url: `/api/attendance/sessions/${sessionId}/scan`,
      payload: { code: `SIMPUL:ATT:${attendanceCode.toLowerCase()}` },
    });
    expect(viaQr.statusCode).toBe(200);
    expect(viaQr.json().duplicate).toBe(true);

    const unknown = await req({ method: "POST", url: `/api/attendance/sessions/${sessionId}/scan`, payload: { code: "ZZZZZZZZZZ" } });
    expect(unknown.statusCode).toBe(404);
  });

  it("guru dapat mengisi status manual, menghapus tanda, dan menolak non-anggota", async () => {
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const req = asSession(guru);

    const izin = await req({
      method: "POST", url: `/api/attendance/sessions/${sessionId}/records`,
      payload: { studentId: siswaId, status: "izin", note: "Acara sekolah" },
    });
    expect(izin.statusCode).toBe(200);
    expect(izin.json().record.status).toBe("izin");
    expect(izin.json().record.method).toBe("manual");
    expect(izin.json().record.note).toBe("Acara sekolah");
    expect(izin.json().summary.izin).toBe(1);
    expect(izin.json().summary.hadir).toBe(0);

    const cleared = await req({
      method: "POST", url: `/api/attendance/sessions/${sessionId}/records`,
      payload: { studentId: siswaId, status: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().record).toBeNull();

    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const outsider = await asSession(admin)({
      method: "POST", url: "/api/users",
      payload: { email: "bukan.anggota@simpul.sch.id", name: "Bukan Anggota", password: "Anggota123!", role: "siswa" },
    });
    expect(outsider.statusCode).toBe(201);
    const outsiderId = outsider.json().user.id as string;
    const denied = await req({
      method: "POST", url: `/api/attendance/sessions/${sessionId}/records`,
      payload: { studentId: outsiderId, status: "hadir" },
    });
    expect(denied.statusCode).toBe(404);
  });

  it("sesi ditutup menolak perubahan kehadiran lalu dapat dibuka kembali", async () => {
    const guru = await login(DEMO.guru.email, DEMO.guru.password);
    const req = asSession(guru);

    const closed = await req({ method: "PATCH", url: `/api/attendance/sessions/${sessionId}`, payload: { status: "closed" } });
    expect(closed.statusCode).toBe(200);
    expect(closed.json().session.status).toBe("closed");

    const scan = await req({ method: "POST", url: `/api/attendance/sessions/${sessionId}/scan`, payload: { code: attendanceCode } });
    expect(scan.statusCode).toBe(409);
    const record = await req({
      method: "POST", url: `/api/attendance/sessions/${sessionId}/records`,
      payload: { studentId: siswaId, status: "hadir" },
    });
    expect(record.statusCode).toBe(409);

    const reopened = await req({ method: "PATCH", url: `/api/attendance/sessions/${sessionId}`, payload: { status: "open" } });
    expect(reopened.statusCode).toBe(200);
    const rescanned = await req({ method: "POST", url: `/api/attendance/sessions/${sessionId}/scan`, payload: { code: attendanceCode } });
    expect(rescanned.statusCode).toBe(200);
    expect(rescanned.json().record.status).toBe("hadir");
  });

  it("siswa melihat kartu sendiri dan riwayat; guru lain serta siswa tidak boleh membuka sesi", async () => {
    const siswa = await login(DEMO.siswa.email, DEMO.siswa.password);
    const siswaReq = asSession(siswa);
    const me = await siswaReq({ method: "GET", url: "/api/attendance/me" });
    expect(me.statusCode).toBe(200);
    expect(me.json().card.attendanceCode).toBe(attendanceCode);
    expect(me.json().card.qrPayload).toBe(`SIMPUL:ATT:${attendanceCode}`);
    expect(me.json().card.className).toBe("XI TKJ Uji");
    const history = me.json().history as Array<{ sessionId: string; status: string; date: string }>;
    expect(history[0]?.sessionId).toBe(sessionId);
    expect(history[0]?.status).toBe("hadir");

    const forbidden = await siswaReq({ method: "GET", url: `/api/attendance/sessions/${sessionId}` });
    expect(forbidden.statusCode).toBe(403);
    const teacherList = await siswaReq({ method: "GET", url: "/api/attendance/classes" });
    expect(teacherList.statusCode).toBe(403);

    // Guru lain tidak mengajar kelas itu.
    const admin = await login(DEMO.admin.email, DEMO.admin.password);
    const created = await asSession(admin)({
      method: "POST", url: "/api/users",
      payload: { email: "guru.lain@simpul.sch.id", name: "Guru Lain", password: "GuruLain123!", role: "guru" },
    });
    expect(created.statusCode).toBe(201);
    const other = await login("guru.lain@simpul.sch.id", "GuruLain123!");
    const otherReq = asSession(other);
    const peek = await otherReq({ method: "GET", url: `/api/attendance/sessions/${sessionId}` });
    expect(peek.statusCode).toBe(403);
    const scanTry = await otherReq({
      method: "POST", url: `/api/attendance/sessions/${sessionId}/scan`, payload: { code: attendanceCode },
    });
    expect(scanTry.statusCode).toBe(403);
  });
});
