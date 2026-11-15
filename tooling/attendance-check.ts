import { chromium, type Browser, type Page } from "playwright";

/**
 * Verifikasi browser nyata untuk fitur absensi:
 * guru membuka sesi → tandai manual → pindai kode → tutup/buka → kartu QR,
 * lalu siswa melihat kartu + riwayat. Screenshot ke /tmp/opencode/simpul-shots.
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
  await page.waitForURL(`**/${who === "guru" ? "teacher" : "student"}/dashboard`, { timeout: 15000 });
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
  check(
    "nav Absensi aktif untuk guru",
    (await page.locator('nav a[href="/teacher/attendance"]').count()) > 0,
  );

  // ——— Buka / lanjutkan sesi hari ini
  await page.click('form[aria-label="Absensi kehadiran"] button[type="submit"]');
  await page.waitForURL(/\/teacher\/attendance\/[0-9a-f-]{10,}/i, { timeout: 15000 });
  await page.waitForSelector("#scan-code");
  const sessionUrl = page.url();
  await page.screenshot({ path: `${OUT}/attendance-session.png`, fullPage: true });
  check("sesi absensi terbuka", /\/teacher\/attendance\//.test(sessionUrl), sessionUrl);
  const summaryTotal = await page.locator("dl dd").last().textContent();
  check("ringkasan total siswa terbaca", Boolean(summaryTotal?.trim()), `unmarked=${summaryTotal?.trim()}`);

  // ——— Tandai manual siswa pertama
  const firstRow = page.locator("main ul > li.card").first();
  await firstRow.waitFor({ state: "visible" });
  const firstCode = (await firstRow.locator(".font-mono2").first().textContent())?.trim() ?? "";
  await firstRow.getByRole("button", { name: "Hadir", exact: true }).click();
  const firstRowText = await waitForText(page, "main ul > li.card", /Manual/);
  check("status manual tersimpan", /Hadir/.test(firstRowText) && /Manual/.test(firstRowText), firstRowText.slice(0, 80));
  check("kode kartu tampil di baris siswa", /^[2-9A-HJ-NP-Z]{10}$/.test(firstCode), firstCode);

  // ——— Pindai kode (jalur input; pemindai barcode USB memakai jalur yang sama)
  await page.fill("#scan-code", firstCode);
  await page.press("#scan-code", "Enter");
  const feedback = await waitForText(page, '[aria-live="polite"]', /(Kehadiran tercatat|sudah ditandai hadir|Status diperbarui)/);
  check(
    "hasil pindai memberi umpan balik",
    /(Kehadiran tercatat|sudah ditandai hadir|Status diperbarui)/.test(feedback),
    feedback.trim(),
  );

  // ——— Pindai kode asing ditolak
  await page.fill("#scan-code", "ZZZZZZZZZZ");
  await page.press("#scan-code", "Enter");
  const badFeedback = await waitForText(page, '[aria-live="polite"]', /tidak dikenali/);
  check("kode asing ditolak dengan pesan", /tidak dikenali/.test(badFeedback), badFeedback.trim());

  // ——— Tutup lalu buka kembali
  const closeBtn = page.getByRole("button", { name: /Tutup sesi/ });
  if ((await closeBtn.count()) > 0) {
    await closeBtn.click();
    const bodyClosed = await waitForText(page, "main", /Ditutup/);
    check("sesi dapat ditutup", /Ditutup/.test(bodyClosed));
    await page.getByRole("button", { name: /Buka kembali sesi/ }).click();
    await waitForText(page, "main", /Berlangsung/);
  } else {
    check("tombol tutup sesi tersedia", false);
  }

  // ——— Kartu QR kelas
  const cardsLink = page.locator('main a[href*="/teacher/attendance/cards/"]').first();
  await cardsLink.waitFor({ state: "visible" });
  const cardsHref = await cardsLink.getAttribute("href");
  await page.goto(`${BASE}${cardsHref}`, { waitUntil: "networkidle" });
  const qrCount = await waitForCount(page, "#attendance-print img");
  const cardsText = (await page.textContent("main")) ?? "";
  await page.screenshot({ path: `${OUT}/attendance-cards.png`, fullPage: true });
  check("kartu QR siswa dirender", qrCount > 0, `${qrCount} QR`);
  check("kartu memuat kode siswa", /[2-9A-HJ-NP-Z]{10}/.test(cardsText));

  // ——— Tampilan sesi di ponsel
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "id-ID", isMobile: true, hasTouch: true });
  const mp = await mobile.newPage();
  await login(mp, "guru");
  await mp.goto(sessionUrl, { waitUntil: "networkidle" });
  await waitForCount(mp, "main ul > li.card");
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await mp.screenshot({ path: `${OUT}/attendance-session-mobile.png`, fullPage: true });
  check("sesi tidak meluber horizontal di ponsel", overflow <= 1, `overflow=${overflow}px`);
  await mobile.close();

  // ——— Siswa: kartu + riwayat
  const sctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "id-ID" });
  const sp = await sctx.newPage();
  sp.on("pageerror", (e) => consoleErrors.push(String(e)));
  await login(sp, "siswa");
  await sp.goto(`${BASE}/student/attendance`, { waitUntil: "networkidle" });
  const studentQr = await waitForCount(sp, 'img[alt="QR kartu absensi"]');
  const studentBody = (await sp.textContent("main")) ?? "";
  await sp.screenshot({ path: `${OUT}/attendance-student.png`, fullPage: true });
  check("siswa melihat QR kartu", studentQr > 0);
  check("riwayat kehadiran siswa memuat sesi", /Riwayat kehadiran/.test(studentBody) && /Hadir|Terlambat|Izin|Sakit|Alpa/.test(studentBody));
  check("kartu siswa menampilkan kelas", /XI TKJ/.test(studentBody), studentBody.slice(0, 60));

  const mobileS = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "id-ID", isMobile: true, hasTouch: true });
  const msp = await mobileS.newPage();
  await login(msp, "siswa");
  await msp.goto(`${BASE}/student/attendance`, { waitUntil: "networkidle" });
  await waitForCount(msp, 'img[alt="QR kartu absensi"]');
  await msp.screenshot({ path: `${OUT}/attendance-student-mobile.png`, fullPage: true });
  const sOverflow = await msp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("kartu siswa tidak meluber di ponsel", sOverflow <= 1, `overflow=${sOverflow}px`);
  await mobileS.close();

  // Dikecualikan: 401 /auth/me (pemeriksaan sesi di halaman login) dan 404 scan
  // yang sengaja dipicu oleh uji "kode asing ditolak" di atas.
  const unexpectedApiErrors = apiErrors.filter(
    (e) =>
      !/^401 \/api\/auth\/me/.test(e) &&
      !/^404 \/api\/attendance\/sessions\/[^/]+\/scan/.test(e),
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
