import { chromium, type Page } from "playwright";

const BASE = process.env.SIMPUL_BASE ?? "http://localhost:5199";
const OUT = process.env.SIMPUL_SHOTS ?? "/tmp/opencode/simpul-shots";
const ACC = {
  admin: { email: "admin@simpul.sch.id", password: "Admin123!" },
  guru: { email: "guru@simpul.sch.id", password: "Guru123!" },
  siswa: { email: "siswa@simpul.sch.id", password: "Siswa123!" },
};

async function login(page: Page, who: keyof typeof ACC): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", ACC[who].email);
  await page.fill("#password", ACC[who].password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const failures: Array<{ url: string; error: string }> = [];

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "id-ID" });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") failures.push({ url: page.url(), error: m.text() }); });

  // --- Admin: pengguna, kelas, mapel, tahun ajaran
  await login(page, "admin");
  for (const [route, name] of [
    ["/admin/users", "admin-users"],
    ["/admin/classes", "admin-classes"],
    ["/admin/subjects", "admin-subjects"],
    ["/admin/academic-years", "admin-years"],
    ["/admin/courses", "admin-courses"],
  ] as const) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log(`[admin] ${route} → ${page.url()}`);
  }

  // Uji form: tambah kelas melalui form nyata.
  await page.goto(`${BASE}/admin/classes`, { waitUntil: "networkidle" });
  const uniqueName = `XI TKJ ${new Date().getSeconds()}`;
  await page.fill("#k-name", uniqueName);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(900);
  const classBody = (await page.textContent("body")) ?? "";
  console.log(`[admin] kelas "${uniqueName}" tercatat: ${classBody.includes(uniqueName)}`);

  // --- Guru: buat kursus + modul + materi
  await login(page, "guru");
  await page.goto(`${BASE}/teacher/courses`, { waitUntil: "networkidle" });
  await page.click("text=Kursus baru");
  await page.waitForTimeout(400);
  await page.fill("#c-title", "Konfigurasi VLAN pada Switch");
  await page.fill("#c-desc", "Latihan segmentasi jaringan dengan VLAN 802.1Q.");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/teacher\/courses\/[^/]+\/edit/, { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/teacher-editor.png`, fullPage: true });
  console.log(`[guru] editor kursus → ${page.url()}`);

  const moduleTitle = "Modul 1 — Konsep VLAN";
  await page.fill("#nm-title", moduleTitle);
  await page.click("text=Tambah modul");
  await page.waitForTimeout(900);

  const lessonInput = page.locator('input[id^="lt-"]').first();
  await lessonInput.fill("Konsep VLAN 802.1Q");
  await page.click("text=Tambah materi");
  await page.waitForTimeout(900);
  await page.click("text=Terbitkan");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/teacher-editor-saved.png`, fullPage: true });
  const editorBody = (await page.textContent("body")) ?? "";
  console.log(`[guru] modul tampil: ${editorBody.includes(moduleTitle)}, materi tampil: ${editorBody.includes("Konsep VLAN 802.1Q")}`);

  // --- Siswa: lihat kursus terbit & baca materi
  await login(page, "siswa");
  await page.goto(`${BASE}/student/courses`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/student-courses.png`, fullPage: true });
  const studentBody = (await page.textContent("body")) ?? "";
  console.log(`[siswa] kursus terbit terlihat: ${studentBody.includes("Konfigurasi VLAN pada Switch")}`);

  const link = page.locator('a:has-text("Konfigurasi VLAN pada Switch")').first();
  if (await link.count()) {
    await link.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/student-course-detail.png`, fullPage: true });
    console.log(`[siswa] detail kursus → ${page.url()}`);

    await page.locator('a:has-text("Konsep VLAN 802.1Q")').first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/student-lesson.png`, fullPage: true });
    await page.click("text=Tandai selesai");
    await page.waitForTimeout(900);
    const lessonText = (await page.textContent("body")) ?? "";
    console.log(`[siswa] halaman materi + tandai selesai: ${lessonText.includes("Sudah selesai")}`);
  }

  // --- Mobile
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "id-ID" });
  const mp = await mctx.newPage();
  await login(mp, "guru");
  await mp.goto(`${BASE}/teacher/courses`, { waitUntil: "networkidle" });
  await mp.screenshot({ path: `${OUT}/teacher-mobile.png`, fullPage: true });
  console.log(`[guru-mobile] ${mp.url()}`);

  // --- Rute 404
  await page.goto(`${BASE}/student/tidak-ada`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/404.png`, fullPage: true });
  console.log(`[404] ${page.url()} :: ${((await page.textContent("body")) ?? "").includes("Halaman tidak ada")}`);

  await browser.close();

  const relevant = failures.filter((f) => !f.error.includes("Failed to load resource") || f.error.includes("Internal Server Error"));
  if (relevant.length > 0) {
    console.log("CONSOLE ERRORS:\n" + JSON.stringify(relevant.slice(0, 5), null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
