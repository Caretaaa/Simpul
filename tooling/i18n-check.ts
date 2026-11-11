import { chromium } from "playwright";

const BASE = process.env.SIMPUL_BASE ?? "http://localhost:5201";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID" });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  // 1. Login sebagai siswa.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "siswa@simpul.sch.id");
  await page.fill("#password", "Siswa123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student/dashboard", { timeout: 15000 });
  console.log("[1] dashboard ID ok:", (await page.textContent("h1"))?.includes("Dasbor"));

  // 2. Ganti bahasa ke Inggris via globe menu.
  await page.click('header button:has(svg.lucide-globe), button[aria-label="Bahasa"]');
  await page.click('button[role="menuitemradio"]:has-text("English")');
  await page.waitForTimeout(400);
  const h1en = await page.textContent("h1");
  console.log("[2] EN header:", JSON.stringify(h1en), "| lang attr:", await page.getAttribute("html", "lang"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  console.log("[2b] persisted after reload:", JSON.stringify(await page.textContent("h1")));
  // Kembali ke Indonesia.
  await page.click('button[aria-label="Language"]');
  await page.click('button[role="menuitemradio"]:has-text("Bahasa Indonesia")');
  await page.waitForTimeout(400);
  console.log("[2c] back to ID:", JSON.stringify(await page.textContent("h1")));

  // 3. Pencarian global → ?q=
  await page.fill("#global-search", "subnetting");
  await page.press("#global-search", "Enter");
  await page.waitForTimeout(800);
  console.log("[3] search url:", page.url());

  // 4. Buka kursus → detail → materi pertama → tandai selesai.
  await page.goto(`${BASE}/student/courses`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const courseLink = page.locator('a.card[href^="/student/courses/"]').first();
  console.log("[4] course card found:", (await courseLink.count()) > 0);
  if ((await courseLink.count()) > 0) {
    await courseLink.click();
    await page.waitForTimeout(1200);
    console.log("[4b] detail url:", page.url(), "| breadcrumb:", (await page.locator('nav[aria-label="Breadcrumb"]').count()) > 0);
    const lessonLink = page.locator('ol.path-rail a, .path-rail a').first();
    if ((await lessonLink.count()) > 0) {
      await lessonLink.click();
      await page.waitForTimeout(1200);
      console.log("[4c] lesson url:", page.url());
      const doneBtn = page.locator('button.btn-primary:has-text("Tandai selesai"), button.btn-primary:has-text("Mark as done")');
      if ((await doneBtn.count()) > 0) {
        await doneBtn.click();
        await page.waitForTimeout(1000);
        console.log("[4d] after mark:", (await page.locator('button.btn-primary').first().textContent())?.trim());
      }
      // Navigasi prev/next ada?
      console.log("[4e] prev/next nav:", (await page.locator('nav[aria-label] a.btn-ghost').count()));
    }
  }

  // 5. Halaman progres (data nyata).
  await page.goto(`${BASE}/student/progress`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  console.log("[5] progress page:", JSON.stringify((await page.textContent("h1"))?.trim()));

  // 6. Notifikasi + tandai dibaca.
  await page.goto(`${BASE}/notifications`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  console.log("[6] notif title:", JSON.stringify((await page.textContent("h1"))?.trim()));

  // 7. Collapse sidebar (desktop).
  await page.goto(`${BASE}/student/dashboard`, { waitUntil: "networkidle" });
  await page.click('aside button[aria-expanded]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/opencode/simpul-shots-redesign/collapsed-nav.png" });
  console.log("[7] collapsed persisted:", await page.evaluate(() => localStorage.getItem("simpul-nav-collapsed")));

  // 8. Dark mode.
  await page.click('header button[aria-label*="mode"], header button[title*="mode"], header button[aria-label*="gelap"], header button[title*="gelap"]');
  await page.waitForTimeout(400);
  console.log("[8] theme:", await page.evaluate(() => document.documentElement.dataset.theme));
  await page.screenshot({ path: "/tmp/opencode/simpul-shots-redesign/dark-dashboard.png" });

  console.log("CONSOLE ERRORS:", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
