import { afterEach, describe, expect, it, vi } from "vitest";
import { aoMenos, chaveLimite, ipDoCliente, LIMITES } from "@/lib/limites";

describe("ipDoCliente", () => {
  it("usa o primeiro endereço do x-forwarded-for", () => {
    expect(
      ipDoCliente(new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1", "x-real-ip": "9.9.9.9" })),
    ).toBe("203.0.113.7");
  });
  it("cai para x-real-ip e depois para 'desconhecido'", () => {
    expect(ipDoCliente(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(ipDoCliente(new Headers())).toBe("desconhecido");
    expect(ipDoCliente(new Headers({ "x-forwarded-for": " , " }))).toBe("desconhecido");
  });
});

describe("chaveLimite", () => {
  it("não guarda o e-mail nem o IP em claro e separa os tipos", () => {
    const k = chaveLimite("verificar", "paciente@example.com");
    expect(k).not.toContain("paciente");
    expect(k).toMatch(/^verificar:[0-9a-f]{64}$/);
    expect(chaveLimite("verificar", "paciente@example.com")).toBe(k);
    expect(chaveLimite("pedir-email", "paciente@example.com")).not.toBe(k);
  });
});

describe("LIMITES", () => {
  it("valores da decisão R11", () => {
    expect(LIMITES.verificar).toEqual({ limite: 5, janelaS: 15 * 60 });
    expect(LIMITES.pedirEmail).toEqual({ limite: 5, janelaS: 60 * 60 });
    expect(LIMITES.pedirIp).toEqual({ limite: 20, janelaS: 60 * 60 });
  });
});

describe("aoMenos", () => {
  afterEach(() => vi.useRealTimers());

  it("só resolve depois do piso, mesmo se o trabalho for instantâneo", async () => {
    vi.useFakeTimers();
    let pronto = false;
    const p = aoMenos(2000, async () => "x").then((v) => {
      pronto = true;
      return v;
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(pronto).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe("x");
  });

  it("não espera a mais quando o trabalho passa do piso", async () => {
    vi.useFakeTimers();
    let pronto = false;
    const p = aoMenos(2000, () => new Promise<string>((r) => setTimeout(() => r("lento"), 3000))).then(
      (v) => {
        pronto = true;
        return v;
      },
    );
    await vi.advanceTimersByTimeAsync(2999);
    expect(pronto).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe("lento");
  });

  it("respeita o piso também quando o trabalho lança", async () => {
    vi.useFakeTimers();
    const p = aoMenos(2000, async () => {
      throw new Error("falhou");
    });
    const verif = expect(p).rejects.toThrow("falhou");
    await vi.advanceTimersByTimeAsync(2000);
    await verif;
  });
});
