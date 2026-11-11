/**
 * Verifikasi halaman demo siswa: Lab, Tugas, Kuis, Latihan Subnetting.
 * Memastikan: badge demo tampil, konten interaktif berfungsi, state tersimpan
 * di localStorage, kuis dinilai benar, mesin subnetting nyata dipakai, dan EN.
 * Jalankan dari root repo:
 *   SIMPUL_BASE=http://localhost:5201 SIMPUL_SHOTS=/tmp/opencode/simpul-shots-demo \
 *   npx tsx tooling/demo-check.ts
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { calculateSubnet } from "../packages/shared/src/subnetting";
import { DEMO_QUIZZES, DEMO_LABS } from "../apps/web/src/lib/demo";

const BASE = process.env.SIMPUL_BASE ?? "http://localhost:5201";
const OUT = process.env.SIMPUL_SHOTS ?? "/tmp/opencode/simpul-shots-demo";
mkdirSync(OUT, { recursive: true });

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
}

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

  // — Login siswa
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "siswa@simpul.sch.id");
  await page.fill("#password", "Siswa123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student/dashboard", { timeout: 15000 });
  await page.waitForTimeout(800);

  // — Sidebar: item demo berbadge "Demo", bukan "Segera hadir"
  const demoBadges = await page.locator("aside .demo-badge").count();
  const soonBadges = await page.locator("aside a[href='/student/labs'] .soon-badge").count();
  check("sidebar: badge Demo pada item lab", demoBadges >= 4, `count=${demoBadges}`);
  check("sidebar: tanpa badge Segera hadir pada Lab", soonBadges === 0);

  // — Daftar lab
  await page.click("aside nav a[href='/student/labs']");
  await page.waitForTimeout(700);
  const labH1 = (await page.locator("main h1").first().textContent())?.trim() ?? "";
  check("labs: h1", labH1.includes("Lab Workspace"), labH1);
  const bannerBadge = (await page.locator("main .demo-banner .demo-badge").first().textContent())?.trim() ?? "";
  check("labs: banner badge Data demo", bannerBadge === "Data demo", bannerBadge);
  const labCards = await page.locator("main article").count();
  check("labs: 2 kartu lab", labCards === 2, `count=${labCards}`);
  await page.screenshot({ path: `${OUT}/01-labs-list-id.png`, fullPage: true });

  // — Detail lab + checklist persisten
  const lab1 = DEMO_LABS[0];
  if (!lab1) throw new Error("demo lab hilang");
  await page.goto(`${BASE}/student/labs/${lab1.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const detailH1 = (await page.locator("main h1").first().textContent())?.trim() ?? "";
  check("lab detail: judul", detailH1.includes(lab1.title.id), detailH1);
  const figures = await page.locator("main figure").count();
  const expectedCommands = lab1.steps.reduce((n, s) => n + (s.commands?.length ?? 0), 0);
  check("lab detail: blok perintah", figures === expectedCommands, `${figures}/${expectedCommands}`);
  const boxes = await page.locator("main aside input[type='checkbox']");
  const boxCount = await boxes.count();
  check("lab detail: item checklist", boxCount === lab1.checklist.length, `${boxCount}/${lab1.checklist.length}`);
  await boxes.first().check();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const stillChecked = await page.locator("main aside input[type='checkbox']").first().isChecked();
  check("lab detail: centang tersimpan (localStorage)", stillChecked);
  await page.screenshot({ path: `${OUT}/02-lab-detail-id.png`, fullPage: true });

  // — Tugas: status tenggat + unggah berkas demo (format mengikuti izin guru)
  await page.click("aside nav a[href='/student/assignments']");
  await page.waitForTimeout(700);
  const asgH1 = (await page.locator("main h1").first().textContent())?.trim() ?? "";
  check("tugas: h1", asgH1.includes("Tugas"), asgH1);
  const asgCards = await page.locator("main article").count();
  check("tugas: 3 kartu", asgCards === 3, `count=${asgCards}`);
  const overdue = await page.locator("main article", { hasText: "Terlambat" }).count();
  check("tugas: ada kartu Terlambat", overdue >= 1);
  const firstCard = page.locator("main article").first();
  const formatInfo = await firstCard.locator("p", { hasText: "Format yang diizinkan guru" }).count();
  check("tugas: info format guru tampil", formatInfo >= 1);
  // (a) format tidak diizinkan → ditolak dengan pesan
  await firstCard.locator("input[type='file']").setInputFiles({
    name: "jawaban.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("tes"),
  });
  await page.waitForTimeout(200);
  const typeErr = await firstCard.locator("[role='alert']").count();
  check("tugas: format salah ditolak", typeErr >= 1);
  // (b) format diizinkan → chip muncul → kumpulkan
  await firstCard.locator("input[type='file']").setInputFiles({
    name: "laporan-subnetting.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 tes demo"),
  });
  await page.waitForTimeout(200);
  const chip = await firstCard.locator("span", { hasText: "laporan-subnetting.pdf" }).count();
  check("tugas: berkas terpilih tampil", chip >= 1);
  await firstCard.locator("button", { hasText: "Kumpulkan berkas" }).click();
  await page.waitForTimeout(300);
  const submittedPill = await firstCard.locator("span", { hasText: "Terkumpul (demo)" }).count();
  check("tugas: pil Terkumpul muncul", submittedPill >= 1);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const fileAfterReload = await page
    .locator("main article")
    .first()
    .locator("span", { hasText: "laporan-subnetting.pdf" })
    .count();
  check("tugas: kiriman tersimpan setelah reload", fileAfterReload >= 1);
  const recRaw = await page.evaluate(
    () => localStorage.getItem("simpul-demo-submit-tgs-subnet-report") ?? "",
  );
  check("tugas: metadata kiriman di localStorage", recRaw.includes("laporan-subnetting.pdf"), recRaw.slice(0, 60));
  await page.screenshot({ path: `${OUT}/03-assignments-id.png`, fullPage: true });

  // — Kuis: jawab semua benar → skor 100 & Lulus
  const quiz1 = DEMO_QUIZZES[0];
  if (!quiz1) throw new Error("demo quiz hilang");
  await page.click("aside nav a[href='/student/quizzes']");
  await page.waitForTimeout(700);
  const quizH1 = (await page.locator("main h1").first().textContent())?.trim() ?? "";
  check("kuis: h1", quizH1.includes("Kuis"), quizH1);
  await page.goto(`${BASE}/student/quizzes/${quiz1.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const introVisible = await page.locator("main button", { hasText: "Mulai kuis" }).count();
  check("kuis: tombol Mulai", introVisible === 1);
  await page.locator("main button", { hasText: "Mulai kuis" }).click();
  await page.waitForTimeout(300);
  for (let i = 0; i < quiz1.questions.length; i++) {
    const question = quiz1.questions[i];
    if (!question) break;
    const radios = page.locator("main fieldset input[type='radio']");
    await radios.nth(question.answerIndex).check();
    const isLast = i === quiz1.questions.length - 1;
    await page
      .locator("main button", { hasText: isLast ? "Selesai & lihat skor" : "Lanjut" })
      .first()
      .click();
    await page.waitForTimeout(250);
  }
  const scoreText = (await page.locator("main .font-display.text-5xl").textContent())?.trim() ?? "";
  check("kuis: skor 100%", scoreText === "100%", scoreText);
  const lulus = await page.locator("main span", { hasText: "Lulus" }).count();
  check("kuis: pil Lulus", lulus >= 1);
  const reviewCount = await page.locator("main ol.card, main section ol li.card").count();
  check("kuis: tinjauan tersedia", reviewCount >= quiz1.questions.length, `${reviewCount}`);
  await page.screenshot({ path: `${OUT}/04-quiz-result-id.png`, fullPage: true });
  const quizBestAfter = await page.evaluate(() => localStorage.getItem("simpul-demo-quizbest-kuis-subnet-dasar"));
  check("kuis: skor terbaik tersimpan", quizBestAfter === "100", String(quizBestAfter));

  // — Latihan subnetting: mesin nyata, jawaban dihitung ulang di script
  await page.click("aside nav a[href='/student/subnetting']");
  await page.waitForTimeout(700);
  const subH1 = (await page.locator("main h1").first().textContent())?.trim() ?? "";
  check("subnet: h1", subH1.includes("Latihan Subnetting"), subH1);
  const ipText = (await page.locator("main code").first().textContent())?.trim() ?? "";
  const prefixText = (await page.locator("main span.font-mono2").filter({ hasText: /^\/\d+$/ }).first().textContent())?.trim() ?? "";
  const prefix = Number(prefixText.replace("/", ""));
  check("subnet: soal terbaca", /^\d+\.\d+\.\d+\.\d+$/.test(ipText) && prefix >= 8 && prefix <= 26, `${ipText}/${prefix}`);
  const sol = calculateSubnet(ipText, prefix);
  await page.fill("#subnet-networkAddress", sol.networkAddress);
  await page.fill("#subnet-broadcastAddress", sol.broadcastAddress);
  await page.fill("#subnet-firstUsableHost", sol.firstUsableHost ?? "");
  await page.fill("#subnet-lastUsableHost", sol.lastUsableHost ?? "");
  await page.fill("#subnet-subnetMask", sol.subnetMask);
  await page.locator("main button", { hasText: "Periksa jawaban" }).click();
  await page.waitForTimeout(300);
  const allOk = await page.locator("main span", { hasText: "Semua kolom yang diisi benar!" }).count();
  check("subnet: semua benar", allOk >= 1);
  const historyRows = await page.locator("main li", { hasText: "%" }).count();
  check("subnet: riwayat terisi", historyRows >= 1, `rows=${historyRows}`);
  await page.screenshot({ path: `${OUT}/05-subnet-correct-id.png`, fullPage: true });
  // soal baru: kolom dikosongkan
  await page.locator("main button", { hasText: "Soal baru" }).click();
  await page.waitForTimeout(300);
  const cleared = await page.locator("#subnet-networkAddress").inputValue();
  check("subnet: soal baru mengosongkan jawaban", cleared === "");
  const pembahasan = await page.locator("main button", { hasText: "Tampilkan pembahasan" }).count();
  check("subnet: tombol pembahasan", pembahasan === 1);

  // — Bahasa Inggris
  await page.click("button.icon-btn[aria-label='Bahasa']");
  await page.waitForTimeout(200);
  await page.locator("[role='menuitemradio']").filter({ hasText: "EN" }).click();
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/student/labs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const enBadge = (await page.locator("main .demo-banner .demo-badge").first().textContent())?.trim() ?? "";
  check("en: badge Demo data", enBadge === "Demo data", enBadge);
  const enBanner = (await page.locator("main .demo-banner").textContent()) ?? "";
  check("en: teks banner Inggris", enBanner.includes("sample content"), "");
  const asgEnH1 = await (async () => {
    await page.goto(`${BASE}/student/assignments`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    return (await page.locator("main h1").first().textContent())?.trim() ?? "";
  })();
  check("en: h1 tugas = Assignments", asgEnH1 === "Assignments", asgEnH1);
  await page.screenshot({ path: `${OUT}/06-assignments-en.png`, fullPage: true });

  check("tanpa pageerror", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  console.log(`\nRingkasan: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
