import { chromium } from "playwright";

const BASE = process.env.SIMPUL_BASE ?? "http://localhost:5201";
const OUT = process.env.SIMPUL_SHOTS ?? "/tmp/opencode/simpul-shots-redesign";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  // Dasbor EN + halaman kursus EN (cek overflow string Inggris).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.click('button:has-text("EN")');
  await page.waitForTimeout(300);
  await page.fill("#email", "siswa@simpul.sch.id");
  await page.fill("#password", "Siswa123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student/dashboard", { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/siswa-dashboard-en.png`, fullPage: false });
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log("[en-desktop] overflowX =", overflowX);
  await page.goto(`${BASE}/student/courses`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/siswa-courses-en.png`, fullPage: false });

  // Mobile EN + dark.
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  // Panel editorial tersembunyi di seluler → pakai tombol globe pada form.
  await mp.click('form button[aria-label="Bahasa"]');
  await mp.fill("#email", "siswa@simpul.sch.id");
  await mp.fill("#password", "Siswa123!");
  await mp.click('button[type="submit"]');
  await mp.waitForURL("**/student/dashboard", { timeout: 15000 });
  await mp.waitForTimeout(1200);
  const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log("[en-mobile] overflowX =", mOverflow);
  await mp.screenshot({ path: `${OUT}/siswa-mobile-en.png`, fullPage: false });
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
