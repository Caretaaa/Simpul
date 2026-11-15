import { chromium, type Browser, type Page } from "playwright";

/**
 * Verifikasi browser nyata untuk absensi QR per mata pelajaran:
 * guru membuka sesi → QR sesi tampil → tandai manual → poster QR tercetak,
 * lalu siswa membuka tautan QR (termasuk lewat login) dan check-in sendiri.
 * Screenshot ke /tmp/opencode/simpul-shots.
 */
const BASE = process.env.SIMPUL_BASE ?? "http://localhost:5173";
const OUT = process.env.SIMPUL_SHOTS ?? "/tmp/opencode/simpul-shots";
const ACC = {
  guru: { email: "guru@simpul.sch.id", password: "Guru123!" },
  siswa: { email: "siswa@simpul.sch.id", password: "Siswa123!" },
};

/**
 * Tunggu sampai teks pada `scope` cocok. Deploy produksi (Neon HTTP) bisa
 * butuh beberapa detik per permintaan, jadi pemeriksaan ini memakai polling
 * alih-alih jeda tetap.
 */
async function waitForText(page: Page, scope: string, needle: RegExp, timeout = 25000): Promise<string> {
  const deadline = Date.now() + timeout;
  let text = "";
  do {
    text = (await page.textContent(scope)) ?? "";
    if (needle.test(text)) return text;
    await page.waitForTimeout(400);
  } while (Date.now() < deadline);
  return text;
}

async function waitForCount(page: Page, selector: string, timeout = 25000): Promise<number> {
  const deadline = Date.now() + timeout;
  let count = 0;
  do {
    count = await page.locator(selector).count();
    if (count > 0) return count;
    await page.waitForTimeout(400);
  } while (Date.now() < deadline);
  return count;
}

const results: Array<{ step: string; ok: boolean; note: string }> = [];
function check(step: string, ok: boolean, note = ""): void {
  results.push({ step, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${note ? ` — ${note}` : ""}`);
}

async function login(page: Page, who: keyof typeof ACC): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", ACC[who].email);
  await page.fill("#password", ACC[who].password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/${who === "guru" ? "teacher" : "student"}/dashboard`, { timeout: 20000 });
}

async function main(): Promise<void> {
  const browser: Browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const consoleErrors: string[] = [];
  const apiErrors: string[] = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "id-ID" });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/api/")) apiErrors.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });

  // ——— Guru: hub absensi
  await login(page, "guru");
  await page.goto(`${BASE}/teacher/attendance`, { waitUntil: "networkidle" });
  await page.waitForSelector('form[aria-label="Absensi kehadiran"]');
  await page.screenshot({ path: `${OUT}/attendance-hub.png`, fullPage: true });
  const classOptions = await page.locator("#att-class option").count();
  check("hub memuat pilihan kelas", classOptions > 0, `${classOptions} opsi`);
  check("nav Absensi aktif untuk guru", (await page.locator('nav a[href="/teacher/attendance"]').count()) > 0);
  check(
    "hub tidak lagi menautkan kartu QR siswa",
    (await page.locator('a[href*="/teacher/attendance/cards/"]').count()) === 0,
  );

  // ——— Buka / lanjutkan sesi hari ini
  await page.click('form[aria-label="Absensi kehadiran"] button[type="submit"]');
  await page.waitForURL(/\/teacher\/attendance\/[0-9a-f-]{10,}/i, { timeout: 20000 });
  await page.waitForSelector("section code.font-mono2");
  const sessionUrl = page.url();
  const sessionId = sessionUrl.split("/").pop() ?? "";
  await page.screenshot({ path: `${OUT}/attendance-session.png`, fullPage: true });
  check("sesi absensi terbuka", /\/teacher\/attendance\//.test(sessionUrl), sessionUrl);

  // ——— QR sesi tampil dengan kode 8 karakter
  const qrImgs = await waitForCount(page, 'main img[alt^="QR absensi sesi"]');
  const code = ((await page.textContent("section code.font-mono2")) ?? "").trim();
  check("QR sesi dirender untuk guru", qrImgs > 0, `${qrImgs} QR`);
  check("kode sesi 8 karakter tampil", /^[2-9A-HJ-NP-Z]{8}$/.test(code), code);
  check(
    "QR menautkan halaman check-in siswa",
    (await page.locator(`main a[href$="/absen/${code}"]`).count()) > 0,
    `/absen/${code}`,
  );
  const summaryTotal = await page.locator("main dl dd").last().textContent();
  check("ringkasan total siswa terbaca", Boolean(summaryTotal?.trim()), `unmarked=${summaryTotal?.trim()}`);

  // ——— Tandai manual siswa pertama
  const firstRow = page.locator("main ul > li.card").first();
  await firstRow.waitFor({ state: "visible" });
  await firstRow.getByRole("button", { name: "Hadir", exact: true }).click();
  const firstRowText = await waitForText(page, "main ul > li.card", /Manual/);
  check("status manual tersimpan", /Hadir/.test(firstRowText) && /Manual/.test(firstRowText), firstRowText.slice(0, 80));

  // Kosongkan lagi agar siswa yang sama bisa menguji check-in QR di bawah.
  await firstRow.getByRole("button", { name: "Hapus tanda" }).click();
  const clearedText = await waitForText(page, "main ul > li.card", /Belum ditandai/);
  check("tanda manual dapat dihapus", /Belum ditandai/.test(clearedText), clearedText.slice(0, 60));

  // ——— Poster QR sesi
  const qrLink = page.locator('main a[href*="/qr"]').first();
  await qrLink.waitFor({ state: "visible" });
  const qrHref = await qrLink.getAttribute("href");
  await page.goto(`${BASE}${qrHref}`, { waitUntil: "networkidle" });
  const posterQr = await waitForCount(page, "#attendance-qr-print img");
  const posterText = (await page.textContent("#attendance-qr-print")) ?? "";
  await page.screenshot({ path: `${OUT}/attendance-qr-poster.png`, fullPage: true });
  check("poster QR sesi dirender", posterQr > 0, `${posterQr} QR`);
  check("poster memuat kode sesi", posterText.includes(code), code);

  // ——— Siswa: tautan QR → login → kembali ke check-in
  const sctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "id-ID" });
  const sp = await sctx.newPage();
  sp.on("pageerror", (e) => consoleErrors.push(String(e)));
  sp.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/api/")) apiErrors.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  await sp.goto(`${BASE}/absen/${code}`, { waitUntil: "networkidle" });
  await sp.waitForURL(/\/login/, { timeout: 20000 });
  await sp.fill("#email", ACC.siswa.email);
  await sp.fill("#password", ACC.siswa.password);
  await sp.click('button[type="submit"]');
  await sp.waitForURL(`**/absen/${code}`, { timeout: 20000 });
  const checkinText = await waitForText(sp, "main", /Konfirmasi kehadiran/);
  check("QR membawa siswa kembali ke check-in setelah masuk", /Konfirmasi kehadiran/.test(checkinText));
  check("check-in menampilkan kelas sesi", /XI TKJ/.test(checkinText), checkinText.slice(0, 80));

  // ——— Siswa menandai kehadirannya sendiri
  await sp.getByRole("button", { name: /Tandai kehadiran saya/ }).waitFor({ state: "visible", timeout: 25000 });
  await sp.getByRole("button", { name: /Tandai kehadiran saya/ }).click();
  const doneText = await waitForText(sp, "main", /Kehadiran Anda tercatat|sudah tercatat/);
  check("check-in siswa tercatat", /Kehadiran Anda tercatat|sudah tercatat/.test(doneText));
  await sp.screenshot({ path: `${OUT}/attendance-student-checkin.png`, fullPage: true });

  await sp.reload({ waitUntil: "networkidle" });
  const repeatText = await waitForText(sp, "main", /sudah tercatat/);
  check("membuka ulang QR tidak menggandakan catatan", /sudah tercatat/.test(repeatText));
  check("check-in berulang tidak menampilkan tombol", (await sp.getByRole("button", { name: /Tandai kehadiran saya/ }).count()) === 0);

  // ——— Kode asing ditolak dengan pesan jelas
  await sp.goto(`${BASE}/absen/ZZZZZZZZ`, { waitUntil: "networkidle" });
  const badText = await waitForText(sp, "main", /Kode tidak dikenali/);
  check("kode sesi asing ditolak dengan pesan", /Kode tidak dikenali/.test(badText));

  // ——— Riwayat siswa
  await sp.goto(`${BASE}/student/attendance`, { waitUntil: "networkidle" });
  const historyText = await waitForText(sp, "main", /Riwayat kehadiran/);
  await sp.screenshot({ path: `${OUT}/attendance-student.png`, fullPage: true });
  check(
    "riwayat kehadiran siswa memuat sesi",
    /Riwayat kehadiran/.test(historyText) && /Hadir|Terlambat|Izin|Sakit|Alpa/.test(historyText),
  );
  check(
    "halaman siswa hanya menampilkan formulir kode, bukan kartu QR pribadi",
    (await sp.locator("#attendance-code").count()) === 1 && (await sp.locator('img[alt*="QR kartu"]').count()) === 0,
  );

  // ——— Guru melihat check-in siswa pada sesi yang sama
  await page.goto(sessionUrl, { waitUntil: "networkidle" });
  const liveText = await waitForText(page, "main", /Check-in QR/);
  check("guru melihat status check-in siswa", /Check-in QR/.test(liveText));

  // ——— Tampilan ponsel: sesi guru dan check-in siswa
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "id-ID", isMobile: true, hasTouch: true });
  const mp = await mobile.newPage();
  await login(mp, "guru");
  await mp.goto(sessionUrl, { waitUntil: "networkidle" });
  await waitForCount(mp, "main ul > li.card");
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await mp.screenshot({ path: `${OUT}/attendance-session-mobile.png`, fullPage: true });
  check("sesi tidak meluber horizontal di ponsel", overflow <= 1, `overflow=${overflow}px`);
  await mobile.close();

  const mobileS = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "id-ID", isMobile: true, hasTouch: true });
  const msp = await mobileS.newPage();
  await login(msp, "siswa");
  await msp.goto(`${BASE}/absen/${code}`, { waitUntil: "networkidle" });
  await waitForText(msp, "main", /Konfirmasi kehadiran/);
  await msp.screenshot({ path: `${OUT}/attendance-student-mobile.png`, fullPage: true });
  const sOverflow = await msp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("check-in siswa tidak meluber di ponsel", sOverflow <= 1, `overflow=${sOverflow}px`);
  await mobileS.close();

  // ——— Bersihkan sesi uji agar database tidak menumpuk
  const cleanup = await page.evaluate(async (id) => {
    const res = await fetch(`/api/attendance/sessions/${id}`, { method: "DELETE", credentials: "include" });
    return res.status;
  }, sessionId);
  check("sesi uji dihapus", cleanup === 200, `status ${cleanup}`);

  // Dikecualikan: 401 /auth/me (pemeriksaan sesi di halaman login) dan 404
  // kode asing yang sengaja dipicu uji di atas.
  const unexpectedApiErrors = apiErrors.filter(
    (e) => !/^401 \/api\/auth\/me/.test(e) && !/^404 \/api\/attendance\/sessions\/by-code\/ZZZZZZZZ/.test(e),
  );
  check("tanpa galat API tak terduga", unexpectedApiErrors.length === 0, unexpectedApiErrors.slice(0, 3).join(" | "));
  check(
    "tanpa error runtime halaman",
    consoleErrors.filter((e) => !/favicon|manifest|Failed to load resource/i.test(e)).length === 0,
    consoleErrors.slice(0, 3).join(" | "),
  );

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
