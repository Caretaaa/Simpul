/**
 * Konten DEMO untuk presentasi — BUKAN data sekolah asli.
 * Dipakai halaman Lab, Tugas, Kuis, dan Latihan Subnetting hingga backend
 * fase vokasional tersedia. Setiap halaman menampilkannya dengan badge demo.
 * Tenggat dihitung relatif terhadap hari ini agar contoh selalu relevan.
 */

export interface BiText {
  id: string;
  en: string;
}

export function pickText(t: BiText, lang: "id" | "en"): string {
  return lang === "id" ? t.id : t.en;
}

function daysFromNow(days: number, hour = 23): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 59, 0, 0);
  return d.toISOString();
}

export function bi(id: string, en: string): BiText {
  return { id, en };
}

/* ---------------------------------------------------------- laboratorium */

export interface DemoLabStep {
  title: BiText;
  detail: BiText;
  commands?: string[];
}

export interface DemoLab {
  id: string;
  code: string;
  title: BiText;
  course: BiText;
  durationMinutes: number;
  level: BiText;
  objectives: BiText[];
  topology: "lan" | "vlan";
  scenario: BiText;
  devices: Array<{ name: BiText; detail: string }>;
  steps: DemoLabStep[];
  checklist: BiText[];
  rubric: Array<{ aspect: BiText; weight: number; excellent: BiText }>;
}

export const DEMO_LABS: DemoLab[] = [
  {
    id: "lab-lan-kantor",
    code: "LAB-01",
    title: bi("Membangun Jaringan LAN Kantor Kecil", "Building a Small Office LAN"),
    course: bi("Dasar Pengalamatan IP & Subnetting", "IP Addressing & Subnetting Basics"),
    durationMinutes: 90,
    level: bi("Pemula · Semester 3", "Beginner · Semester 3"),
    objectives: [
      bi("Merancang skema pengalamatan IPv4 /24 untuk 24 host dan 1 gateway.", "Design a /24 IPv4 addressing scheme for 24 hosts and 1 gateway."),
      bi("Membuat kabel UTP straight-through standar T568B dan menguji konektivitasnya.", "Crimp a T568B straight-through UTP cable and test its connectivity."),
      bi("Mengonfigurasi alamat IP statis dan memverifikasi konektivitas dengan ping.", "Configure static IP addresses and verify connectivity with ping."),
    ],
    topology: "lan",
    scenario: bi(
      "Kantor kecil memiliki 1 router, 1 switch 24-port, dan 6 PC. Blok alamat yang tersedia: 192.168.10.0/24. Router menempati alamat host pertama (.1) sebagai gateway.",
      "A small office has 1 router, 1 24-port switch, and 6 PCs. Available block: 192.168.10.0/24. The router takes the first host address (.1) as gateway.",
    ),
    devices: [
      { name: bi("Router R1 (gateway)", "Router R1 (gateway)"), detail: "192.168.10.1/24" },
      { name: bi("Switch SW1", "Switch SW1"), detail: "24-port · VLAN 1" },
      { name: bi("PC-01 … PC-06", "PC-01 … PC-06"), detail: "192.168.10.11 – 192.168.10.16/24" },
    ],
    steps: [
      {
        title: bi("Isi tabel pengalamatan", "Fill in the addressing table"),
        detail: bi("Catat alamat jaringan, broadcast, gateway, dan alokasi tiap PC sebelum menyentuh perangkat.", "Record network, broadcast, gateway, and per-PC allocation before touching any device."),
      },
      {
        title: bi("Crimping kabel UTP", "Crimp the UTP cable"),
        detail: bi("Buat 2 kabel straight-through T568B (putih-oranye, oranye, putih-hijau, biru, putih-biru, hijau, putih-cokelat, cokelat). Uji dengan cable tester: 8 lampu menyala berurutan.", "Make 2 T568B straight-through cables (white-orange, orange, white-green, blue, white-blue, green, white-brown, brown). Test with a cable tester: all 8 lights in sequence."),
      },
      {
        title: bi("Sambungkan dan konfigurasi IP", "Connect and configure IPs"),
        detail: bi("Hubungkan PC ke switch, switch ke router. Atur IP statis, mask 255.255.255.0, gateway 192.168.10.1.", "Connect PCs to the switch, switch to router. Set static IP, mask 255.255.255.0, gateway 192.168.10.1."),
        commands: ["ip 192.168.10.11/24", "gateway 192.168.10.1", "ping 192.168.10.1", "ping 192.168.10.12"],
      },
      {
        title: bi("Verifikasi dan dokumentasi", "Verify and document"),
        detail: bi("Ping antar-PC dan ke gateway harus reply <1ms. Foto tabel pengalamatan + tangkapan layar hasil ping sebagai bukti.", "PC-to-PC and gateway pings must reply <1ms. Photograph the addressing table + screenshot ping results as evidence."),
      },
    ],
    checklist: [
      bi("Tabel pengalamatan terisi lengkap dan benar", "Addressing table complete and correct"),
      bi("Kabel lolos cable tester 8/8", "Cable passes tester 8/8"),
      bi("Semua PC mendapat IP statis + gateway", "All PCs have static IP + gateway"),
      bi("Ping ke gateway reply <1ms", "Gateway ping replies <1ms"),
      bi("Ping antar-PC berhasil", "PC-to-PC ping succeeds"),
      bi("Bukti foto + tangkapan layar terkumpul", "Photo + screenshot evidence collected"),
    ],
    rubric: [
      { aspect: bi("Ketepatan pengalamatan", "Addressing accuracy"), weight: 30, excellent: bi("Tanpa konflik IP, skema terdokumentasi", "No IP conflicts, scheme documented") },
      { aspect: bi("Kualitas kabel", "Cable quality"), weight: 25, excellent: bi("Rapi, lolos tester sekali uji", "Neat, passes tester first try") },
      { aspect: bi("Verifikasi konektivitas", "Connectivity verification"), weight: 25, excellent: bi("Semua ping berhasil + bukti lengkap", "All pings succeed + full evidence") },
      { aspect: bi("K3 dan kerapian", "Safety and tidiness"), weight: 20, excellent: bi("Area kerja rapi, perangkat aman", "Tidy workspace, safe devices") },
    ],
  },
  {
    id: "lab-vlan",
    code: "LAB-02",
    title: bi("Segmentasi Jaringan dengan VLAN", "Network Segmentation with VLAN"),
    course: bi("Dasar VLAN dan Segmentasi Jaringan", "VLAN and Segmentation Basics"),
    durationMinutes: 120,
    level: bi("Menengah · Semester 4", "Intermediate · Semester 4"),
    objectives: [
      bi("Membuat VLAN 10 (Guru), VLAN 20 (Siswa), dan VLAN 30 (Tamu) pada switch.", "Create VLAN 10 (Teachers), VLAN 20 (Students), and VLAN 30 (Guests) on the switch."),
      bi("Mengonfigurasi port akses dan trunk 802.1Q antar dua switch.", "Configure access ports and an 802.1Q trunk between two switches."),
      bi("Membuktikan isolasi antar-VLAN dengan ping.", "Prove inter-VLAN isolation with ping."),
    ],
    topology: "vlan",
    scenario: bi(
      "Lab sekolah memiliki 2 switch (SW-A, SW-B) yang dihubungkan trunk. Tiap switch melayani 3 PC: 1 guru, 1 siswa, 1 tamu. Komunikasi hanya boleh terjadi dalam VLAN yang sama.",
      "The school lab has 2 switches (SW-A, SW-B) linked by a trunk. Each switch serves 3 PCs: 1 teacher, 1 student, 1 guest. Traffic may only flow within the same VLAN.",
    ),
    devices: [
      { name: bi("SW-A dan SW-B", "SW-A and SW-B"), detail: "manageable · 802.1Q" },
      { name: bi("PC Guru", "Teacher PCs"), detail: "VLAN 10 · 10.10.10.0/24" },
      { name: bi("PC Siswa", "Student PCs"), detail: "VLAN 20 · 10.10.20.0/24" },
      { name: bi("PC Tamu", "Guest PCs"), detail: "VLAN 30 · 10.10.30.0/24" },
    ],
    steps: [
      {
        title: bi("Buat VLAN dan beri nama", "Create and name the VLANs"),
        detail: bi("Pada kedua switch: buat VLAN 10/20/30 dengan nama GURU, SISWA, TAMU.", "On both switches: create VLANs 10/20/30 named GURU, SISWA, TAMU."),
        commands: ["vlan database", "vlan 10 name GURU", "vlan 20 name SISWA", "vlan 30 name TAMU", "exit"],
      },
      {
        title: bi("Tetapkan port akses", "Assign access ports"),
        detail: bi("Port PC guru → access VLAN 10; PC siswa → access VLAN 20; PC tamu → access VLAN 30.", "Teacher PC ports → access VLAN 10; student ports → access VLAN 20; guest ports → access VLAN 30."),
        commands: ["interface fa0/1", "switchport mode access", "switchport access vlan 10"],
      },
      {
        title: bi("Aktifkan trunk antar-switch", "Bring up the inter-switch trunk"),
        detail: bi("Port penghubung kedua switch dijadikan trunk dan mengizinkan VLAN 10,20,30.", "The interconnect ports become trunks allowing VLANs 10,20,30."),
        commands: ["interface gi0/1", "switchport mode trunk", "switchport trunk allowed vlan 10,20,30"],
      },
      {
        title: bi("Uji isolasi", "Test isolation"),
        detail: bi("Ping dalam VLAN yang sama harus berhasil; ping beda VLAN harus gagal (RTO). Catat hasilnya.", "Same-VLAN pings must succeed; cross-VLAN pings must fail (RTO). Record the results."),
      },
    ],
    checklist: [
      bi("VLAN 10/20/30 ada di kedua switch", "VLANs 10/20/30 exist on both switches"),
      bi("Port akses sesuai peruntukan", "Access ports match their roles"),
      bi("Trunk up dan mengizinkan 3 VLAN", "Trunk up, allowing all 3 VLANs"),
      bi("Ping se-VLAN berhasil", "Same-VLAN ping succeeds"),
      bi("Ping beda VLAN gagal (isolasi terbukti)", "Cross-VLAN ping fails (isolation proven)"),
      bi("Tabel hasil pengujian terdokumentasi", "Test result table documented"),
    ],
    rubric: [
      { aspect: bi("Desain VLAN", "VLAN design"), weight: 25, excellent: bi("ID dan nama konsisten di semua switch", "Consistent IDs and names on all switches") },
      { aspect: bi("Konfigurasi port", "Port configuration"), weight: 30, excellent: bi("Access/trunk tepat, tanpa port salah", "Correct access/trunk, no misports") },
      { aspect: bi("Pembuktian isolasi", "Isolation proof"), weight: 30, excellent: bi("Uji lengkap + terdokumentasi", "Complete, documented tests") },
      { aspect: bi("Dokumentasi", "Documentation"), weight: 15, excellent: bi("Topologi + tabel + kesimpulan", "Topology + tables + conclusion") },
    ],
  },
];

/* --------------------------------------------------------------- tugas */

export type DemoSubmitState = "not-submitted" | "draft";

export interface DemoAssignment {
  id: string;
  code: string;
  title: BiText;
  course: BiText;
  dueAt: string;
  kind: BiText;
  points: number;
  instructions: BiText[];
  attachments: string[];
  /** Ekstensi berkas yang diizinkan guru (tanpa titik, huruf kecil), cth. ["pdf"] */
  allowedTypes: string[];
  /** Batas ukuran berkas versi guru (MB). */
  maxFileMB: number;
  rubric: Array<{ aspect: BiText; weight: number }>;
}

export const DEMO_ASSIGNMENTS: DemoAssignment[] = [
  {
    id: "tgs-subnet-report",
    code: "TGS-01",
    title: bi("Laporan Hasil Subnetting /24", "/24 Subnetting Result Report"),
    course: bi("Dasar Pengalamatan IP & Subnetting", "IP Addressing & Subnetting Basics"),
    dueAt: daysFromNow(3),
    kind: bi("Individu · Berkas PDF", "Individual · PDF file"),
    points: 100,
    instructions: [
      bi("Bagi blok 192.168.20.0/24 menjadi 4 subnet sama besar untuk 4 lab.", "Split 192.168.20.0/24 into 4 equal subnets for 4 labs."),
      bi("Untuk tiap subnet, tulis: alamat jaringan, broadcast, rentang host, dan jumlah host usable.", "For each subnet, write: network, broadcast, host range, and usable host count."),
      bi("Susun dalam 1 berkas PDF maksimal 3 halaman, sertakan tabel pengalamatan tiap lab.", "Compile into one PDF (max 3 pages) including each lab's addressing table."),
    ],
    attachments: ["format-laporan-subnetting.pdf", "contoh-tabel-pengalamatan.xlsx"],
    allowedTypes: ["pdf"],
    maxFileMB: 5,
    rubric: [
      { aspect: bi("Ketepatan perhitungan", "Calculation accuracy"), weight: 50 },
      { aspect: bi("Kelengkapan tabel", "Table completeness"), weight: 30 },
      { aspect: bi("Kerapian laporan", "Report tidiness"), weight: 20 },
    ],
  },
  {
    id: "tgs-vlan-config",
    code: "TGS-02",
    title: bi("Konfigurasi VLAN pada Switch Lab", "VLAN Configuration on the Lab Switch"),
    course: bi("Dasar VLAN dan Segmentasi Jaringan", "VLAN and Segmentation Basics"),
    dueAt: daysFromNow(1),
    kind: bi("Kelompok (2 orang) · Bukti foto", "Pairs · Photo evidence"),
    points: 100,
    instructions: [
      bi("Buat VLAN 10, 20, 30 sesuai materi LAB-02 pada switch lab yang ditunjuk guru.", "Create VLANs 10, 20, 30 per LAB-02 on the teacher-assigned lab switch."),
      bi("Uji ping se-VLAN dan beda-VLAN, catat hasilnya dalam tabel.", "Test same-VLAN and cross-VLAN pings, record them in a table."),
      bi("Kumpulkan foto konfigurasi (show vlan brief) dan tabel hasil pengujian.", "Submit photos of the config (show vlan brief) plus the test table."),
    ],
    attachments: ["panduan-uji-vlan.pdf"],
    allowedTypes: ["jpg", "jpeg", "png"],
    maxFileMB: 10,
    rubric: [
      { aspect: bi("Kebenaran konfigurasi", "Configuration correctness"), weight: 40 },
      { aspect: bi("Kelengkapan bukti uji", "Test evidence completeness"), weight: 40 },
      { aspect: bi("Kerja sama kelompok", "Teamwork"), weight: 20 },
    ],
  },
  {
    id: "tgs-topology",
    code: "TGS-03",
    title: bi("Diagram Topologi Jaringan Sekolah", "School Network Topology Diagram"),
    course: bi("Dasar Pengalamatan IP & Subnetting", "IP Addressing & Subnetting Basics"),
    dueAt: daysFromNow(-1),
    kind: bi("Individu · Gambar", "Individual · Diagram"),
    points: 100,
    instructions: [
      bi("Gambarkan topologi jaringan lab sekolah (2 switch, 1 router, minimal 6 host).", "Draw the school lab network topology (2 switches, 1 router, at least 6 hosts)."),
      bi("Beri label tiap perangkat: nama, alamat IP, dan VLAN bila ada.", "Label every device: name, IP address, and VLAN where applicable."),
      bi("Kumpulkan sebagai gambar PNG/JPG atau PDF yang terbaca jelas.", "Submit as a clearly readable PNG/JPG image or PDF."),
    ],
    attachments: [],
    allowedTypes: ["pdf", "png", "jpg"],
    maxFileMB: 8,
    rubric: [
      { aspect: bi("Kelengkapan perangkat", "Device completeness"), weight: 40 },
      { aspect: bi("Ketepatan label", "Label accuracy"), weight: 40 },
      { aspect: bi("Keterbacaan diagram", "Diagram readability"), weight: 20 },
    ],
  },
];

/* ---------------------------------------------------------------- kuis */

export interface DemoQuestion {
  prompt: BiText;
  options: BiText[];
  answerIndex: number;
  explanation: BiText;
}

export interface DemoQuiz {
  id: string;
  code: string;
  title: BiText;
  course: BiText;
  minutes: number;
  passingScore: number;
  questions: DemoQuestion[];
}

export const DEMO_QUIZZES: DemoQuiz[] = [
  {
    id: "kuis-subnet-dasar",
    code: "KUIS-01",
    title: bi("Kuis Dasar Subnetting", "Subnetting Basics Quiz"),
    course: bi("Dasar Pengalamatan IP & Subnetting", "IP Addressing & Subnetting Basics"),
    minutes: 15,
    passingScore: 70,
    questions: [
      {
        prompt: bi("Alamat 192.168.1.10/24 berada pada jaringan…", "The address 192.168.1.10/24 belongs to network…"),
        options: [bi("192.168.1.0", "192.168.1.0"), bi("192.168.0.0", "192.168.0.0"), bi("192.168.1.10", "192.168.1.10"), bi("192.168.1.255", "192.168.1.255")],
        answerIndex: 0,
        explanation: bi("Oktet terakhir di-AND dengan mask 255.255.255.0 → 192.168.1.0.", "Last octet ANDed with 255.255.255.0 → 192.168.1.0."),
      },
      {
        prompt: bi("Subnet mask dari prefix /26 adalah…", "The subnet mask of prefix /26 is…"),
        options: [bi("255.255.255.0", "255.255.255.0"), bi("255.255.255.192", "255.255.255.192"), bi("255.255.255.128", "255.255.255.128"), bi("255.255.255.224", "255.255.255.224")],
        answerIndex: 1,
        explanation: bi("26 bit = 8+8+8+2 → oktet ke-4 bernilai 128+64 = 192.", "26 bits = 8+8+8+2 → fourth octet is 128+64 = 192."),
      },
      {
        prompt: bi("Jumlah host usable pada /28 adalah…", "Usable hosts in a /28 are…"),
        options: [bi("16", "16"), bi("14", "14"), bi("30", "30"), bi("6", "6")],
        answerIndex: 1,
        explanation: bi("2^(32−28) − 2 = 16 − 2 = 14 host.", "2^(32−28) − 2 = 16 − 2 = 14 hosts."),
      },
      {
        prompt: bi("Alamat broadcast dari 10.0.5.0/24 adalah…", "The broadcast address of 10.0.5.0/24 is…"),
        options: [bi("10.0.5.255", "10.0.5.255"), bi("10.0.5.1", "10.0.5.1"), bi("10.255.255.255", "10.255.255.255"), bi("10.0.6.0", "10.0.6.0")],
        answerIndex: 0,
        explanation: bi("Semua bit host dinyalakan: oktet terakhir 255.", "All host bits set: last octet 255."),
      },
      {
        prompt: bi("Perintah untuk menguji konektivitas ke gateway adalah…", "The command to test connectivity to the gateway is…"),
        options: [bi("ping 192.168.1.1", "ping 192.168.1.1"), bi("tracert google.com", "tracert google.com"), bi("ipconfig", "ipconfig"), bi("netstat -r", "netstat -r")],
        answerIndex: 0,
        explanation: bi("ping mengirim ICMP echo request; ipconfig hanya menampilkan konfigurasi.", "ping sends ICMP echo requests; ipconfig only shows configuration."),
      },
    ],
  },
  {
    id: "kuis-vlan-dasar",
    code: "KUIS-02",
    title: bi("Kuis Dasar VLAN", "VLAN Basics Quiz"),
    course: bi("Dasar VLAN dan Segmentasi Jaringan", "VLAN and Segmentation Basics"),
    minutes: 10,
    passingScore: 70,
    questions: [
      {
        prompt: bi("Fungsi utama VLAN adalah…", "The main purpose of a VLAN is…"),
        options: [bi("Mempercepat kabel", "Speeding up cables"), bi("Mengelompokkan perangkat secara logis dalam broadcast domain terpisah", "Grouping devices logically into separate broadcast domains"), bi("Menambah jumlah port fisik", "Adding physical ports"), bi("Mengganti router", "Replacing routers")],
        answerIndex: 1,
        explanation: bi("VLAN memisahkan broadcast domain tanpa menambah perangkat fisik.", "VLANs split broadcast domains without extra hardware."),
      },
      {
        prompt: bi("Port yang menghubungkan dua switch dan membawa banyak VLAN disebut…", "A port linking two switches and carrying many VLANs is called…"),
        options: [bi("Access", "Access"), bi("Trunk", "Trunk"), bi("Console", "Console"), bi("Uplink internet", "Internet uplink")],
        answerIndex: 1,
        explanation: bi("Trunk 802.1Q menandai frame dengan ID VLAN agar banyak VLAN lewat satu link.", "An 802.1Q trunk tags frames with VLAN IDs so many VLANs share one link."),
      },
      {
        prompt: bi("PC pada VLAN 10 pada dasarnya…", "A PC on VLAN 10 basically…"),
        options: [bi("Bisa ping ke VLAN 20 tanpa router", "Can ping VLAN 20 without a router"), bi("Tidak bisa berkomunikasi dengan VLAN 20 tanpa routing antar-VLAN", "Cannot reach VLAN 20 without inter-VLAN routing"), bi("Berada di subnet yang sama dengan semua VLAN", "Shares one subnet with all VLANs"), bi("Tidak butuh alamat IP", "Needs no IP address")],
        answerIndex: 1,
        explanation: bi("Isolasi L2: komunikasi antar-VLAN butuh perangkat L3.", "L2 isolation: cross-VLAN traffic needs a Layer-3 device."),
      },
      {
        prompt: bi("Rentang ID VLAN normal (usable) adalah…", "The normal (usable) VLAN ID range is…"),
        options: [bi("0–4095", "0–4095"), bi("1–1005", "1–1005"), bi("1006–4094", "1006–4094"), bi("1–255", "1–255")],
        answerIndex: 1,
        explanation: bi("VLAN 1–1005 adalah rentang normal; 0 dan 4095 dicadangkan.", "VLANs 1–1005 are the normal range; 0 and 4095 are reserved."),
      },
    ],
  },
];

/* ------------------------------------------------- status kiriman demo */

/** Metadata kiriman demo — isi berkas TIDAK disimpan, hanya nama/ukuran/waktu. */
export interface DemoSubmitRecord {
  fileName: string;
  sizeBytes: number;
  submittedAt: string;
}

export function demoSubmitKey(assignmentId: string): string {
  return `simpul-demo-submit-${assignmentId}`;
}

export function demoCheckKey(labId: string): string {
  return `simpul-demo-check-${labId}`;
}

export function demoQuizBestKey(quizId: string): string {
  return `simpul-demo-quizbest-${quizId}`;
}

export function demoSubnetKey(): string {
  return "simpul-demo-subnet";
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* penyimpanan privat — abaikan */
  }
}
