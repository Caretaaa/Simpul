import { chromium } from "playwright";

const BASE = process.env.SIMPUL_BASE ?? "http://localhost:5199";
const OUT = process.env.SIMPUL_SHOTS ?? "/tmp/opencode/simpul-shots";
const ACCOUNTS = [
  { role: "siswa", email: "siswa@simpul.sch.id", password: "Siswa123!" },
  { role: "guru", email: "guru@simpul.sch.id", password: "Guru123!" },
  { role: "admin", email: "admin@simpul.sch.id", password: "Admin123!" },
];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const shots: string[] = [];
  for (const acc of ACCOUNTS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID" });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const path = `${OUT}/${acc.role}-login.png`;
    await page.screenshot({ path, fullPage: true });
    shots.push(path);
    await page.fill("#email", acc.email);
    await page.fill("#password", acc.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`**/${acc.role}/dashboard`, { timeout: 15000 }).catch(async () => {
      await page.waitForTimeout(1500);
    });
    const dashPath = `${OUT}/${acc.role}-dashboard.png`;
    await page.screenshot({ path: dashPath, fullPage: true });
    shots.push(dashPath);
    // Mobile shot untuk memverifikasi responsif + bottom nav.
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "id-ID", isMobile: true, hasTouch: true });
    const mp = await mobile.newPage();
    await mp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await mp.fill("#email", acc.email);
    await mp.fill("#password", acc.password);
    await mp.click('button[type="submit"]');
    await mp.waitForTimeout(2000);
    const mPath = `${OUT}/${acc.role}-mobile.png`;
    await mp.screenshot({ path: mPath, fullPage: true });
    shots.push(mPath);
    console.log(`[${acc.role}] url=${mp.url()} consoleErrors=${JSON.stringify(errors.slice(0, 3))}`);
    await ctx.close();
    await mobile.close();
  }
  // Mobile tema gelap + 403 check
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const loginDark = `${OUT}/login-mobile-dark.png`;
  await page.screenshot({ path: loginDark });
  shots.push(loginDark);
  // Siswa coba akses rute admin → 403
  await page.fill("#email", "siswa@simpul.sch.id");
  await page.fill("#password", "Siswa123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student/dashboard", { timeout: 15000 }).catch(() => {});
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "networkidle" });
  const bodyText = (await page.textContent("body")) ?? "";
  const forbidden = `${OUT}/403-forbidden.png`;
  await page.screenshot({ path: forbidden });
  shots.push(forbidden);
  console.log(`[403] teks memuat pesan izin: ${bodyText.includes("tidak memiliki izin")} | url=${page.url()}`);
  await browser.close();
  console.log("SHOTS:\n" + shots.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
