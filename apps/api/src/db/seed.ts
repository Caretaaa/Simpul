import { randomUUID } from "node:crypto";
import { hashPassword } from "../middleware/auth.js";
import { generateJoinCode } from "../modules/classes/joinCode.js";
import { getDb } from "./connection.js";
import { migrate } from "./migrate.js";
import { academicYears, classMemberships, classes, courseEnrollments, courses, lessons, modules, subjects, users } from "./schema.js";

/**
 * Seed pengembangan — DITANDAI JELAS sebagai data demo.
 * Jangan pernah menampilkannya sebagai data sekolah asli.
 * Eksekusi: npm run seed -w @simpul/api
 */
async function main(): Promise<void> {
  migrate();
  const db = getDb();
  const now = new Date();
  const yearId = randomUUID();

  await db
    .insert(academicYears)
    .values({ id: yearId, name: "2025/2026 Ganjil", isActive: true, createdAt: now, updatedAt: now })
    .onConflictDoNothing();

  const adminPass = await hashPassword("Admin123!");
  const guruPass = await hashPassword("Guru123!");
  const siswaPass = await hashPassword("Siswa123!");

  const adminId = randomUUID();
  const guruId = randomUUID();
  const siswaId = randomUUID();
  const siswa2Id = randomUUID();

  const seedUsers = [
    { id: adminId, email: "admin@simpul.sch.id", name: "Administrator Sekolah", passwordHash: adminPass, role: "admin" as const },
    { id: guruId, email: "guru@simpul.sch.id", name: "Budi Santoso, S.Kom.", passwordHash: guruPass, role: "guru" as const },
    { id: siswaId, email: "siswa@simpul.sch.id", name: "Ayu Putri Rahayu", passwordHash: siswaPass, role: "siswa" as const },
    { id: siswa2Id, email: "siswa2@simpul.sch.id", name: "Rizky Pratama", passwordHash: siswaPass, role: "siswa" as const },
  ];
  for (const u of seedUsers) {
    await db.insert(users).values({ ...u, avatarUrl: null, isActive: true, createdAt: now, updatedAt: now }).onConflictDoNothing();
  }

  const classId = randomUUID();
  const classJoinCode = generateJoinCode();
  await db
    .insert(classes)
    .values({
      id: classId,
      name: "XI TKJ 1",
      grade: "XI" as const,
      major: "TKJ",
      academicYearId: yearId,
      homeroomTeacherId: guruId,
      joinCode: classJoinCode,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const subjectSeeds = [
    { code: "AIJ", name: "Administrasi Infrastruktur Jaringan" },
    { code: "ASJ", name: "Administrasi Sistem Jaringan" },
    { code: "TLJ", name: "Teknologi Layanan Jaringan" },
    { code: "KJAR", name: "Keamanan Jaringan" },
  ];
  const subjectIds: string[] = [];
  for (const s of subjectSeeds) {
    const id = randomUUID();
    subjectIds.push(id);
    await db
      .insert(subjects)
      .values({ id, ...s, description: `Mata pelajaran TKJ — ${s.name}.`, createdAt: now, updatedAt: now })
      .onConflictDoNothing();
  }

  const courseId = randomUUID();
  await db
    .insert(courses)
    .values({
      id: courseId,
      title: "Dasar Pengalamatan IP & Subnetting",
      description: "Memahami IPv4, CIDR, dan subnetting melalui teori ringkas dan latihan terstruktur.",
      subjectId: subjectIds[0] ?? null,
      classId,
      teacherId: guruId,
      status: "published",
      thumbnailUrl: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const draftCourseId = randomUUID();
  await db
    .insert(courses)
    .values({
      id: draftCourseId,
      title: "Dasar VLAN dan Segmentasi Jaringan",
      description: "Menyiapkan material VLAN untuk kelas XI TKJ 1.",
      subjectId: subjectIds[0] ?? null,
      classId,
      teacherId: guruId,
      status: "draft",
      thumbnailUrl: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const moduleSeeds = [
    { id: randomUUID(), title: "Modul 1 — Fondasi IPv4", position: 0 },
    { id: randomUUID(), title: "Modul 2 — CIDR & Subnetting", position: 1 },
    { id: randomUUID(), title: "Modul 3 — VLAN & Switching Dasar", position: 2 },
  ];
  for (const m of moduleSeeds) {
    await db.insert(modules).values({ ...m, courseId, createdAt: now, updatedAt: now }).onConflictDoNothing();
  }

  // Seluruh materi milik guru (Budi Santoso): 3 modul × materi terstruktur.
  const lessonSeeds: Array<{ moduleIndex: number; title: string; contentType: "article" | "video" | "pdf" | "lab" | "external"; body: string }> = [
    { moduleIndex: 0, title: "Anatomi alamat IPv4 dan kelas jaringan", contentType: "article", body: sampleLesson("Anatomi alamat IPv4") },
    { moduleIndex: 0, title: "Notasi desimal bertitik dan konversi biner", contentType: "article", body: sampleLesson("Konversi biner IPv4") },
    { moduleIndex: 1, title: "CIDR dan subnet mask", contentType: "article", body: sampleLesson("CIDR dan subnet mask") },
    { moduleIndex: 1, title: "Rentang host dan broadcast address", contentType: "article", body: sampleLesson("Rentang host") },
    { moduleIndex: 1, title: "Video: cara membaca tabel subnetting", contentType: "video", body: "https://www.youtube.com/watch?v=contoh-subnetting\n\nTonton video di atas, lalu kerjakan latihan pada alat subnetting." },
    { moduleIndex: 2, title: "Konsep VLAN 802.1Q dan segmentasi", contentType: "article", body: sampleLesson("Konsep VLAN 802.1Q") },
  ];
  const positionByModule = new Map<number, number>();
  for (const l of lessonSeeds) {
    const pos = positionByModule.get(l.moduleIndex) ?? 0;
    positionByModule.set(l.moduleIndex, pos + 1);
    await db
      .insert(lessons)
      .values({
        id: randomUUID(),
        moduleId: moduleSeeds[l.moduleIndex]!.id,
        title: l.title,
        contentType: l.contentType,
        body: l.body,
        position: pos,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  // Materi kursus draf VLAN (milik guru yang sama) — belum terbit.
  const vlanModuleId = randomUUID();
  await db
    .insert(modules)
    .values({ id: vlanModuleId, courseId: draftCourseId, title: "Modul 1 — Pengenalan VLAN", position: 0, createdAt: now, updatedAt: now })
    .onConflictDoNothing();
  await db
    .insert(lessons)
    .values({
      id: randomUUID(),
      moduleId: vlanModuleId,
      title: "Mengapa jaringan perlu disegmentasi",
      contentType: "article",
      body: sampleLesson("Segmentasi jaringan"),
      position: 0,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  // Demo enrollmen: siswa terdaftar pada kursus terbit.
  await db
    .insert(courseEnrollments)
    .values({ id: randomUUID(), courseId, studentId: siswaId, enrolledAt: now })
    .onConflictDoNothing();

  // Demo keanggotaan kelas: siswa sudah tergabung via kode gabung.
  await db
    .insert(classMemberships)
    .values({ id: randomUUID(), classId, studentId: siswaId, joinedAt: now })
    .onConflictDoNothing();

  console.log("Seed demo selesai (data pengembangan):");
  console.log("  admin@simpul.sch.id  / Admin123!  (admin)");
  console.log("  guru@simpul.sch.id   / Guru123!   (guru)");
  console.log("  siswa@simpul.sch.id  / Siswa123!  (siswa)");
  console.log("  siswa2@simpul.sch.id / Siswa123!  (siswa)");
  console.log(`  Kode gabung kelas XI TKJ 1: ${classJoinCode}`);
  console.log("  Tautan gabung: http://localhost:5173/join/" + classJoinCode);
}

/** Contoh isi materi: paragraf + blok perintah untuk menguji tampilan baca. */
function sampleLesson(topic: string): string {
  return [
    `# ${topic}`,
    "",
    `Materi demo Phase 2. Bagian ini menjelaskan ${topic.toLowerCase()} secara ringkas sebelum kamu masuk ke latihan terstruktur pada lab.`,
    "",
    "## Tujuan",
    "- Memahami konsep dasar.",
    "- Menerapkannya pada skenario kelas XI TKJ.",
    "",
    "## Cek cepat",
    "Gunakan perintah berikut untuk memastikan konektivitas antar host di jaringan praktikum:",
    "",
    "```",
    "ping 192.168.10.1",
    "```",
    "",
    "> Catatan teknis: gunakan monospace untuk perintah CLI agar mudah disalin.",
  ].join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
