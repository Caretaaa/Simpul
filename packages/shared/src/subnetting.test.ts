import { describe, expect, it } from "vitest";
import {
  calculateSubnet,
  generateExercise,
  intToIp,
  ipToInt,
  maskToPrefix,
  prefixToMask,
  validateAnswer,
} from "./subnetting.js";

describe("ipToInt / intToIp", () => {
  it("mengonversi bolak-balik dengan benar", () => {
    expect(intToIp(ipToInt("192.168.1.10"))).toBe("192.168.1.10");
    expect(ipToInt("0.0.0.0")).toBe(0);
    expect(ipToInt("255.255.255.255")).toBe(4294967295);
  });
  it("menolak IP tidak valid", () => {
    expect(() => ipToInt("300.1.1.1")).toThrow();
    expect(() => ipToInt("192.168.1")).toThrow();
    expect(() => ipToInt("abc.def.1.1")).toThrow();
  });
});

describe("prefixToMask / maskToPrefix", () => {
  it("menghitung mask standar", () => {
    expect(prefixToMask(24)).toBe("255.255.255.0");
    expect(prefixToMask(16)).toBe("255.255.0.0");
    expect(prefixToMask(26)).toBe("255.255.255.192");
    expect(maskToPrefix("255.255.255.0")).toBe(24);
  });
  it("menolak mask non-kontigu", () => {
    expect(() => maskToPrefix("255.0.255.0")).toThrow();
  });
});

describe("calculateSubnet", () => {
  it("menghitung contoh klasik 192.168.1.10/24", () => {
    const s = calculateSubnet("192.168.1.10", 24);
    expect(s.networkAddress).toBe("192.168.1.0");
    expect(s.broadcastAddress).toBe("192.168.1.255");
    expect(s.firstUsableHost).toBe("192.168.1.1");
    expect(s.lastUsableHost).toBe("192.168.1.254");
    expect(s.usableHostCount).toBe(254);
    expect(s.subnetMask).toBe("255.255.255.0");
  });
  it("menghitung /26 dengan tepat", () => {
    const s = calculateSubnet("10.10.5.130", 26);
    expect(s.networkAddress).toBe("10.10.5.128");
    expect(s.broadcastAddress).toBe("10.10.5.191");
    expect(s.firstUsableHost).toBe("10.10.5.129");
    expect(s.lastUsableHost).toBe("10.10.5.190");
    expect(s.usableHostCount).toBe(62);
  });
  it("menangani /31 dan /32 (RFC 3021)", () => {
    expect(calculateSubnet("192.168.0.0", 31).usableHostCount).toBe(2);
    expect(calculateSubnet("192.168.0.1", 32).usableHostCount).toBe(1);
  });
  it("total alamat konsisten 2^(32-prefix)", () => {
    for (const p of [8, 16, 20, 24, 28]) {
      expect(calculateSubnet("10.0.0.5", p).totalAddresses).toBe(2 ** (32 - p));
    }
  });
});

describe("generateExercise", () => {
  it("deterministik bila seed sama", () => {
    const a = generateExercise("mudah", 42);
    const b = generateExercise("mudah", 42);
    expect(a).toEqual(b);
  });
  it("solusi konsisten dengan perhitungan ulang", () => {
    const ex = generateExercise("sedang", 7);
    expect(ex.solution).toEqual(calculateSubnet(ex.ip, ex.prefix));
  });
});

describe("validateAnswer", () => {
  it("menilai jawaban benar dan salah per kolom", () => {
    const ex = generateExercise("mudah", 99);
    const full = {
      networkAddress: ex.solution.networkAddress,
      broadcastAddress: ex.solution.broadcastAddress,
      firstUsableHost: ex.solution.firstUsableHost ?? "",
      lastUsableHost: ex.solution.lastUsableHost ?? "",
      subnetMask: ex.solution.subnetMask,
    };
    expect(validateAnswer(ex, full).correct).toBe(true);
    const wrong = { ...full, broadcastAddress: "1.1.1.1" };
    const r = validateAnswer(ex, wrong);
    expect(r.correct).toBe(false);
    expect(r.perField.broadcastAddress).toBe(false);
    expect(r.perField.networkAddress).toBe(true);
  });
});
