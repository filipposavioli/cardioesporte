import type { Marcador, Painel, PontoEvolucao, Status } from "./dados";

// Port fiel dos cálculos do app.js do painel aprovado (resumo, sistemas, rule, parseRef, drawTrends).

const ORDEM_STATUS: Status[] = ["Tudo certo", "Atenção", "Prioridade"];

export function resumo(m: Marcador[]): { status: Status; n: number }[] {
  return ORDEM_STATUS.map((status) => ({ status, n: m.filter((x) => x.status === status).length }));
}

export function sistemas(
  m: Marcador[],
): { sistema: string; total: number; ok: number; atencao: number; prioridade: number }[] {
  return [...new Set(m.map((x) => x.sistema))].map((sistema) => {
    const g = m.filter((x) => x.sistema === sistema);
    return {
      sistema,
      total: g.length,
      ok: g.filter((x) => x.status === "Tudo certo").length,
      atencao: g.filter((x) => x.status === "Atenção").length,
      prioridade: g.filter((x) => x.status === "Prioridade").length,
    };
  });
}

/** Domínio do eixo da régua (como `rule()` do app.js). null sem valor ou sem limites. */
export function dominioRegua(
  m: Marcador,
): { d0: number; d1: number; lo: number | null; hi: number | null } | null {
  const v = Number(m.valor);
  const lo = m.ref_min ?? null;
  const hi = m.ref_max ?? null;
  if (m.valor == null || !Number.isFinite(v) || (lo == null && hi == null)) return null;
  const a = lo ?? 0;
  const b = hi ?? Math.max(v, a) * 1.6;
  const span = b - a || Math.abs(b) || 1;
  let d0 = Math.min(a, v) - span * 0.3;
  const d1 = Math.max(b, v) + span * 0.3;
  if (lo == null || (a >= 0 && d0 < 0)) d0 = Math.max(0, Math.min(d0, 0));
  return { d0, d1, lo, hi };
}

export function parseRef(ref: string): [number | null, number | null] {
  const s = String(ref).replace(/,/g, ".");
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^<\s*([\d.]+)/))) return [null, +m[1]];
  if ((m = s.match(/^>\s*([\d.]+)/))) return [+m[1], null];
  if ((m = s.match(/([\d.]+)\s*[–-]\s*([\d.]+)/))) return [+m[1], +m[2]];
  return [null, null];
}

export function tendencia(pontos: PontoEvolucao[]): {
  primeiro: PontoEvolucao;
  ultimo: PontoEvolucao;
  delta: number;
  bom: boolean;
} {
  if (pontos.length === 0) throw new Error("tendencia: lista de pontos vazia");
  const rows = [...pontos].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const primeiro = rows[0];
  const ultimo = rows[rows.length - 1];
  const [rlo, rhi] = parseRef(ultimo.ref);
  const delta = ultimo.valor - primeiro.valor;
  const dentro = (rlo == null || ultimo.valor >= rlo) && (rhi == null || ultimo.valor <= rhi);
  const dir = ultimo.melhor;
  const bom = dir === "menor" ? delta <= 0 : dir === "maior" ? delta >= 0 : dentro;
  return { primeiro, ultimo, delta, bom };
}

export function temMotor(p: Painel): boolean {
  return (
    p.zonas != null ||
    p.marcadores.some((m) => m.exame === "VO₂ máximo" || m.pct_predito != null)
  );
}
