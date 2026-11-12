import type { ExamDefinition, ExamType } from "../types";

const questionBank = [
  {
    id: "ipv4-network",
    topic: "Alamat IPv4",
    prompt: "Alamat jaringan dari 192.168.10.34/24 adalah …",
    options: ["192.168.10.0", "192.168.10.1", "192.168.10.34", "192.168.10.255"],
    answerIndex: 0,
  },
  {
    id: "subnet-hosts",
    topic: "Subnetting",
    prompt: "Jumlah alamat host yang dapat digunakan pada subnet /27 adalah …",
    options: ["14", "30", "32", "62"],
    answerIndex: 1,
  },
  {
    id: "vlan-purpose",
    topic: "VLAN",
    prompt: "Tujuan utama VLAN pada switch adalah …",
    options: ["Membagi broadcast domain secara logis", "Mempercepat CPU komputer", "Mengganti alamat MAC", "Menghapus kebutuhan router"],
    answerIndex: 0,
  },
  {
    id: "dhcp-purpose",
    topic: "Layanan DHCP",
    prompt: "Layanan DHCP membantu administrator dengan cara …",
    options: ["Mengenkripsi semua file", "Memberikan konfigurasi IP secara otomatis", "Menerjemahkan nama domain", "Memblokir port switch"],
    answerIndex: 1,
  },
  {
    id: "osi-transport",
    topic: "Model OSI",
    prompt: "Protokol TCP bekerja terutama pada layer … model OSI.",
    options: ["Network", "Data Link", "Transport", "Application"],
    answerIndex: 2,
  },
] satisfies ExamDefinition["questions"];

export function getDemoExam(courseId: string, examType: ExamType): ExamDefinition {
  const title = examType === "pretest" ? "Pretest · Pemetaan Awal" : "Posttest · Evaluasi Akhir";
  return {
    id: `${courseId}-${examType}`,
    title,
    description: examType === "pretest"
      ? "Ukur pemahaman awalmu sebelum membuka materi pembelajaran."
      : "Tunjukkan pemahamanmu setelah menyelesaikan seluruh materi.",
    questions: questionBank,
    durationSeconds: 15 * 60,
  };
}
