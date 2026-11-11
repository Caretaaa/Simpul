/**
 * Logika domain subnetting IPv4.
 * Murni, deterministik, tanpa dependensi framework — dipakai web & api.
 * Semua fungsi diuji di `subnetting.test.ts`.
 */

/** Konversi dotted-decimal → integer 32-bit unsigned. */
export function ipToInt(ip: string): number {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) throw new Error(`Alamat IP tidak valid: ${ip}`);
  let n = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) throw new Error(`Alamat IP tidak valid: ${ip}`);
    const o = Number(p);
    if (o < 0 || o > 255) throw new Error(`Oktet di luar rentang 0–255: ${ip}`);
    n = n * 256 + o;
  }
  return n >>> 0;
}

/** Konversi integer 32-bit → dotted-decimal. */
export function intToIp(n: number): string {
  n = n >>> 0;
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join(".");
}

/** Prefix (/0–/32) → subnet mask dotted-decimal. */
export function prefixToMask(prefix: number): string {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Prefix harus 0–32, diterima: ${prefix}`);
  }
  if (prefix === 0) return "0.0.0.0";
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return intToIp(mask);
}

/** Subnet mask dotted-decimal → prefix. Mask harus kontigu. */
export function maskToPrefix(mask: string): number {
  const m = ipToInt(mask);
  if (m === 0) return 0;
  let prefix = 0;
  let seenZero = false;
  for (let i = 31; i >= 0; i--) {
    const bit = (m >>> i) & 1;
    if (bit === 1) {
      if (seenZero) throw new Error(`Subnet mask tidak kontigu: ${mask}`);
      prefix++;
    } else {
      seenZero = true;
    }
  }
  return prefix;
}

export interface SubnetInfo {
  networkAddress: string;
  broadcastAddress: string;
  subnetMask: string;
  prefix: number;
  firstUsableHost: string | null;
  lastUsableHost: string | null;
  usableHostCount: number;
  totalAddresses: number;
  wildcardMask: string;
  ipClass: "A" | "B" | "C" | "D" | "E";
}

/** Kelas alamat berdasarkan oktet pertama (klasik, untuk edukasi). */
export function ipClass(ip: string): SubnetInfo["ipClass"] {
  const first = Number(ip.trim().split(".")[0]);
  if (first <= 127) return "A";
  if (first <= 191) return "B";
  if (first <= 223) return "C";
  if (first <= 239) return "D";
  return "E";
}

/** Hitung seluruh informasi subnet dari IP + prefix. */
export function calculateSubnet(ip: string, prefix: number): SubnetInfo {
  const addr = ipToInt(ip);
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  const network = (addr & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const hostBits = 32 - prefix;
  const totalAddresses = 2 ** hostBits;
  const usableHostCount = prefix >= 31 ? (prefix === 31 ? 2 : 1) : totalAddresses - 2;
  return {
    networkAddress: intToIp(network),
    broadcastAddress: intToIp(broadcast),
    subnetMask: intToIp(mask),
    prefix,
    firstUsableHost: prefix === 32 ? intToIp(network) : prefix === 31 ? intToIp(network) : intToIp(network + 1),
    lastUsableHost:
      prefix === 32 ? intToIp(network) : prefix === 31 ? intToIp(broadcast) : intToIp(broadcast - 1),
    usableHostCount,
    totalAddresses,
    wildcardMask: intToIp((~mask >>> 0) >>> 0),
    ipClass: ipClass(ip),
  };
}

export type Difficulty = "mudah" | "sedang" | "sukar";

export interface SubnetExercise {
  id: string;
  ip: string;
  prefix: number;
  difficulty: Difficulty;
  solution: SubnetInfo;
  explanation: string;
}

/** PRNG mulberry32 — deterministik bila seed diberikan (untuk pengujian). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRIVATE_RANGES: Array<[number, number]> = [
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")],
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")],
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")],
];

function randomPrivateIp(rand: () => number): string {
  const [lo, hi] = PRIVATE_RANGES[Math.floor(rand() * PRIVATE_RANGES.length)] as [number, number];
  return intToIp(lo + Math.floor(rand() * (hi - lo + 1)));
}

/** Bangkitkan soal latihan. Deterministik bila `seed` diisi. */
export function generateExercise(difficulty: Difficulty = "mudah", seed?: number): SubnetExercise {
  const rand = seed === undefined ? Math.random : mulberry32(seed);
  let prefix: number;
  if (difficulty === "mudah") prefix = 24 + Math.floor(rand() * 3); // /24–/26
  else if (difficulty === "sedang") prefix = 16 + Math.floor(rand() * 9); // /16–/24
  else prefix = 8 + Math.floor(rand() * 19); // /8–/26
  const ip = randomPrivateIp(rand);
  const solution = calculateSubnet(ip, prefix);
  return {
    id: `ex-${difficulty}-${seed ?? Date.now()}`,
    ip,
    prefix,
    difficulty,
    solution,
    explanation:
      `Alamat jaringan = IP AND mask (/${prefix} → ${solution.subnetMask}). ` +
      `Broadcast = alamat jaringan OR komplemen mask. Host usable = ${solution.firstUsableHost} – ${solution.lastUsableHost} (${solution.usableHostCount} host).`,
  };
}

export interface SubnetAnswer {
  networkAddress?: string;
  broadcastAddress?: string;
  firstUsableHost?: string;
  lastUsableHost?: string;
  subnetMask?: string;
}

/** Validasi jawaban siswa terhadap solusi (perbandingan string ternormalisasi). */
export function validateAnswer(
  exercise: SubnetExercise,
  answer: SubnetAnswer,
): { correct: boolean; perField: Record<keyof SubnetAnswer, boolean>; score: number } {
  const fields: Array<keyof SubnetAnswer> = [
    "networkAddress",
    "broadcastAddress",
    "firstUsableHost",
    "lastUsableHost",
    "subnetMask",
  ];
  const perField = {} as Record<keyof SubnetAnswer, boolean>;
  let ok = 0;
  let asked = 0;
  for (const f of fields) {
    const given = answer[f];
    if (given === undefined || given === "") continue;
    asked++;
    const match = given.trim() === String(exercise.solution[f]);
    perField[f] = match;
    if (match) ok++;
  }
  return { correct: asked > 0 && ok === asked, perField, score: asked === 0 ? 0 : ok / asked };
}
