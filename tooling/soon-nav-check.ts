import { chromium } from "playwright";

const BASE = process.env.SIMPUL_BASE ?? "http://localhost:5201";
const OUT = process.env.SIMPUL_SHOTS ?? "/tmp/opencode/simpul-shots-teacher";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID" });
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "siswa@simpul.sch.id");
  await page.fill("#password", "Siswa123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student/dashboard", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Klik "Lab" di sidebar — harus navigasi ke halaman Lab.
  await page.click('aside nav a[href="/student/labs"]');
  await page.waitForTimeout(1000);
  console.log("[lab] url:", page.url(), "| h1:", JSON.stringify((await page.locator("main h1").first().textContent())?.trim()));
  const goCourses = await page.locator('main a:has-text("Buka kursus saya")').count();
  const goProgress = await page.locator('main a:has-text("Lihat progres bacaan")').count();
  console.log("[lab] links courses/progress:", goCourses > 0, goProgress > 0);
  await page.screenshot({ path: `${OUT}/student-labs-id.png` });

  // Klik "Tugas" dan "Kuis" juga.
  for (const href of ["/student/assignments", "/student/quizzes", "/student/subnetting", "/student/progress"]) {
    await page.click(`aside nav a[href="${href}"]`);
    await page.waitForTimeout(600);
    console.log(`[nav] ${href} →`, page.url().includes(href) ? "OK" : `FAIL (${page.url()})`);
  }
  console.log("[nav] pageerrors:", JSON.stringify(errs.slice(0, 3)));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
