import { describe, expect, it } from "vitest";
import type { Marcador, Painel, PontoEvolucao } from "../../src/lib/dados";
import { dominioRegua, parseRef, resumo, sistemas, temMotor, tendencia } from "../../src/lib/painel-calc";

const mk = (o: Partial<Marcador> = {}): Marcador => ({
  exame: "X", sistema: "Coração", valor: 1, resultado: "1", referencia: "", status: "Tudo certo",
  data: "2026-01-01", leitura: "ok", ...o,
});
const pt = (data: string, valor: number, melhor: PontoEvolucao["melhor"], ref = ""): PontoEvolucao => ({
  marcador: "M", unidade: "u", ref, data, valor, melhor,
});

describe("resumo", () => {
  it("conta os 3 status mesmo com zero", () => {
    expect(resumo([mk(), mk({ status: "Atenção" }), mk({ status: "Atenção" })])).toEqual([
      { status: "Tudo certo", n: 1 },
      { status: "Atenção", n: 2 },
      { status: "Prioridade", n: 0 },
    ]);
    expect(resumo([]).map((r) => r.n)).toEqual([0, 0, 0]);
  });
});

describe("sistemas", () => {
  it("agrupa em ordem de primeira aparição", () => {
    const r = sistemas([
      mk({ sistema: "B" }), mk({ sistema: "A", status: "Prioridade" }),
      mk({ sistema: "B", status: "Atenção" }),
    ]);
    expect(r).toEqual([
      { sistema: "B", total: 2, ok: 1, atencao: 1, prioridade: 0 },
      { sistema: "A", total: 1, ok: 0, atencao: 0, prioridade: 1 },
    ]);
  });
});

describe("parseRef", () => {
  it("interpreta formatos", () => {
    expect(parseRef("< 100")).toEqual([null, 100]);
    expect(parseRef("> 60")).toEqual([60, null]);
    expect(parseRef("20–50")).toEqual([20, 50]);
    expect(parseRef("3,5 - 5,0")).toEqual([3.5, 5]);
    expect(parseRef("Normal")).toEqual([null, null]);
  });
});

describe("dominioRegua", () => {
  it("null sem valor ou sem limites", () => {
    expect(dominioRegua(mk({ valor: null, ref_min: 1, ref_max: 2 }))).toBeNull();
    expect(dominioRegua(mk({ valor: 5 }))).toBeNull();
    expect(dominioRegua(mk({ valor: 5, ref_min: null, ref_max: null }))).toBeNull();
  });
  it("com só máximo começa em 0", () => {
    const r = dominioRegua(mk({ valor: 80, ref_max: 100 }))!;
    expect(r.d0).toBe(0);
    expect(r.lo).toBeNull();
    expect(r.hi).toBe(100);
    expect(r.d1).toBeCloseTo(130);
  });
  it("com faixa aplica margem de 30% do span", () => {
    const r = dominioRegua(mk({ valor: 35, ref_min: 20, ref_max: 50 }))!;
    expect(r.d0).toBeCloseTo(11);
    expect(r.d1).toBeCloseTo(59);
    expect(r.lo).toBe(20);
  });
});

describe("tendencia", () => {
  it('"menor" com queda é bom', () => {
    const t = tendencia([pt("2026-06-01", 100, "menor"), pt("2025-06-01", 130, "menor")]);
    expect(t.primeiro.valor).toBe(130);
    expect(t.ultimo.valor).toBe(100);
    expect(t.delta).toBe(-30);
    expect(t.bom).toBe(true);
  });
  it('"maior" com queda não é bom', () => {
    expect(tendencia([pt("2025-01-01", 50, "maior"), pt("2026-01-01", 40, "maior")]).bom).toBe(false);
  });
  it('"faixa" usa último dentro da ref', () => {
    expect(tendencia([pt("2025-01-01", 30, "faixa", "20–50"), pt("2026-01-01", 45, "faixa", "20–50")]).bom).toBe(true);
    expect(tendencia([pt("2025-01-01", 30, "faixa", "20–50"), pt("2026-01-01", 55, "faixa", "20–50")]).bom).toBe(false);
  });
  it("lança com lista vazia", () => {
    expect(() => tendencia([])).toThrow();
  });
});

describe("temMotor", () => {
  const base: Painel = {
    marcadores: [mk()], evolucao: [], zonas: null, plano: [],
    paciente: { nome: "P", idade: 1, ultima_coleta: "2026-01-01", periodo: "", foco: "" },
  };
  it("false sem zonas, VO₂ e pct_predito", () => {
    expect(temMotor(base)).toBe(false);
  });
  it("true com zonas, VO₂ máximo ou pct_predito", () => {
    expect(temMotor({ ...base, zonas: [{ zona: "Z1", de: null, ate: 1, vel: "", uso: "" }] })).toBe(true);
    expect(temMotor({ ...base, marcadores: [mk({ exame: "VO₂ máximo" })] })).toBe(true);
    expect(temMotor({ ...base, marcadores: [mk({ pct_predito: 90 })] })).toBe(true);
  });
});
