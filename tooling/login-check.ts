import { chromium } from "playwright";

const BASE = process.env.SIMPUL_BASE ?? "http://localhost:5201";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const acc of [
    { email: "siswa@simpul.sch.id", password: "Siswa123!", expect: "/student/dashboard" },
    { email: "guru@simpul.sch.id", password: "Guru123!", expect: "/teacher/dashboard" },
    { email: "admin@simpul.sch.id", password: "Admin123!", expect: "/admin/dashboard" },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID" });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", acc.email);
    await page.fill("#password", acc.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL(`**${acc.expect}`, { timeout: 15000 });
      console.log(`[OK] ${acc.email} → ${page.url()}`);
    } catch {
      const alert = await page.locator('[role="alert"]').first().textContent().catch(() => "(tanpa pesan)");
      console.log(`[FAIL] ${acc.email} → tetap di ${page.url()} | pesan: ${alert}`);
    }
    console.log(`     pageerrors: ${JSON.stringify(errors.slice(0, 2))}`);
    await ctx.close();
  }
  // Kredensial salah → pesan error yang jelas (bukan crash).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "siswa@simpul.sch.id");
  await page.fill("#password", "Salah123!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  console.log("[wrong-pw] pesan:", await page.locator('[role="alert"]').first().textContent().catch(() => "(tanpa pesan)"));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
