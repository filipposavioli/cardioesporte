import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EvolucaoSchema, validarPasta } from "@/lib/dados";

const FIXTURE = join(__dirname, "..", "fixtures", "exemplo");
const tmps: string[] = [];

function copia(): string {
  const dir = mkdtempSync(join(tmpdir(), "painel-"));
  tmps.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

function mutar(dir: string, arquivo: string, fn: (json: Record<string, unknown>[]) => void) {
  const p = join(dir, arquivo);
  const json = JSON.parse(readFileSync(p, "utf8"));
  fn(json);
  writeFileSync(p, JSON.stringify(json));
}

afterEach(() => {
  while (tmps.length) rmSync(tmps.pop()!, { recursive: true, force: true });
});

describe("validarPasta", () => {
  it("aceita fixture de exemplo", () => {
    const p = validarPasta(FIXTURE);
    expect(p.paciente.nome).toBe("Paciente Exemplo");
    expect(p.marcadores.length).toBeGreaterThanOrEqual(14);
    expect(new Set(p.marcadores.map((m) => m.status))).toEqual(
      new Set(["Tudo certo", "Atenção", "Prioridade"]),
    );
    expect(p.zonas).toHaveLength(3);
    expect(p.zonas![0].de).toBeNull();
    expect(p.evolucao.length).toBeGreaterThan(0);
    expect(p.plano.length).toBeGreaterThanOrEqual(4);
  });

  it("rejeita status desconhecido", () => {
    const dir = copia();
    mutar(dir, "marcadores.json", (j) => (j[0].status = "Ótimo"));
    expect(() => validarPasta(dir)).toThrow(/marcadores\.json\[0\]\.status/);
  });

  it("rejeita exame duplicado", () => {
    const dir = copia();
    mutar(dir, "marcadores.json", (j) => (j[1].exame = j[0].exame));
    expect(() => validarPasta(dir)).toThrow(/marcadores\.json\[1\]\.exame.*duplicado/);
  });

  it("zonas ausente vira null", () => {
    const dir = copia();
    rmSync(join(dir, "zonas.json"));
    expect(validarPasta(dir).zonas).toBeNull();
  });

  it("data fora de AAAA-MM-DD rejeitada", () => {
    const dir = copia();
    mutar(dir, "marcadores.json", (j) => (j[2].data = "26/10/2026"));
    expect(() => validarPasta(dir)).toThrow(/marcadores\.json\[2\]\.data/);
  });

  it("melhor só aceita menor|maior|faixa", () => {
    const dir = copia();
    mutar(dir, "evolucao.json", (j) => (j[0].melhor = "igual"));
    expect(() => validarPasta(dir)).toThrow(/evolucao\.json\[0\]\.melhor/);
    expect(EvolucaoSchema.shape.melhor.safeParse("faixa").success).toBe(true);
  });

  it("paciente.json deve ter exatamente 1 item", () => {
    const dir = copia();
    mutar(dir, "paciente.json", (j) => j.push({ ...j[0] }));
    expect(() => validarPasta(dir)).toThrow(/paciente\.json/);
  });

  it("arquivo obrigatório ausente gera erro claro", () => {
    const dir = copia();
    rmSync(join(dir, "plano.json"));
    expect(() => validarPasta(dir)).toThrow(/plano\.json/);
  });
});
