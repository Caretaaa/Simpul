import { chromium } from "playwright";

const BASE = process.env.SIMPUL_BASE ?? "http://localhost:5201";
const OUT = process.env.SIMPUL_SHOTS ?? "/tmp/opencode/simpul-shots-teacher";

async function login(page: import("playwright").Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // Guru: halaman kursus (EN) + editor kursus + buat modul (validasi) + buat kelas.
  const g = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const gp = await g.newPage();
  const gerr: string[] = [];
  gp.on("pageerror", (e) => gerr.push(String(e)));
  await login(gp, "guru@simpul.sch.id", "Guru123!");
  await gp.waitForURL("**/teacher/dashboard", { timeout: 15000 });
  // Paksa EN via localStorage (simulasi preferensi tersimpan).
  await gp.evaluate(() => localStorage.setItem("simpul-lang", "en"));
  await gp.goto(`${BASE}/teacher/courses`, { waitUntil: "networkidle" });
  await gp.waitForTimeout(1200);
  console.log("[guru-courses] h1:", JSON.stringify((await gp.locator("main h1").first().textContent())?.trim()));
  await gp.screenshot({ path: `${OUT}/guru-courses-en.png` });
  const overflow1 = await gp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log("[guru-courses] overflowX =", overflow1);

  // Buka editor kursus pertama.
  const editLink = gp.locator('a[href$="/edit"]').first();
  if ((await editLink.count()) > 0) {
    await editLink.click();
    await gp.waitForTimeout(1200);
    console.log("[editor] url ok:", gp.url().includes("/edit"));
    await gp.screenshot({ path: `${OUT}/course-editor-en.png` });
    // Dialog konfirmasi hapus muncul (jangan konfirmasi — dismiss).
    gp.on("dialog", (d) => { console.log("[editor] dialog:", JSON.stringify(d.message())); void d.dismiss(); });
    const delBtn = gp.locator('button:has-text("Delete")').first();
    if ((await delBtn.count()) > 0) {
      await delBtn.click();
      await gp.waitForTimeout(500);
    } else {
      console.log("[editor] no delete button visible (read-only or empty)");
    }
  }
  // Halaman kelas guru.
  await gp.goto(`${BASE}/teacher/classes`, { waitUntil: "networkidle" });
  await gp.waitForTimeout(1000);
  console.log("[guru-classes] h1:", JSON.stringify((await gp.locator("main h1").first().textContent())?.trim()));
  await gp.screenshot({ path: `${OUT}/guru-classes-en.png` });
  console.log("[guru] pageerrors:", JSON.stringify(gerr.slice(0, 3)));
  await g.close();

  // Admin: halaman pengguna (ID) + buat pengumuman.
  const a = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID" });
  const ap = await a.newPage();
  const aerr: string[] = [];
  ap.on("pageerror", (e) => aerr.push(String(e)));
  await login(ap, "admin@simpul.sch.id", "Admin123!");
  await ap.waitForURL("**/admin/dashboard", { timeout: 15000 });
  await ap.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
  await ap.waitForTimeout(1000);
  console.log("[admin-users] h1:", JSON.stringify((await ap.locator("main h1").first().textContent())?.trim()));
  await ap.screenshot({ path: `${OUT}/admin-users-id.png` });
  // Tulis pengumuman sebagai admin.
  await ap.goto(`${BASE}/admin/announcements`, { waitUntil: "networkidle" });
  await ap.waitForTimeout(800);
  await ap.fill("#an-title", "Uji pengumuman bilingual");
  await ap.fill("#an-body", "Isi pengumuman uji dari skrip verifikasi.");
  await ap.click('button[type="submit"]:has-text("Terbitkan")');
  await ap.waitForTimeout(1200);
  const announced = await ap.locator('li.card h2:has-text("Uji pengumuman bilingual")').count();
  console.log("[admin-announce] published visible:", announced > 0);
  console.log("[admin] pageerrors:", JSON.stringify(aerr.slice(0, 3)));
  await a.close();
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
