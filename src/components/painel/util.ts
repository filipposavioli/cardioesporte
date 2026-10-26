import type { Status } from "@/lib/dados";

// Formatação e constantes do app.js aprovado.
export const nf = (v: number, d?: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d ?? 1 }).format(v);
export const dfmt = (s: string) => {
  const [y, m, d] = String(s).slice(0, 10).split("-");
  return d + "/" + m + "/" + y;
};
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mfmt = (s: string) => {
  const [y, m] = String(s).slice(0, 10).split("-");
  return MES[+m - 1] + "/" + y.slice(2);
};
/** Data de publicação (data ou timestamp ISO) em dd/mm/aaaa, no fuso de São Paulo. */
export const dataBR = (s: string) =>
  /T/.test(s)
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(s))
    : dfmt(s);

export const COR: Record<Status, string> = {
  "Tudo certo": "var(--sc-verde)",
  "Atenção": "var(--sc-amb)",
  "Prioridade": "var(--sc-red)",
};
export const badgeCls = (s: Status) =>
  s === "Tudo certo" ? "sc-badge sc-b-ok" : s === "Atenção" ? "sc-badge sc-b-at" : "sc-badge sc-b-pr";
export const ORDER: Record<Status, number> = { Prioridade: 0, "Atenção": 1, "Tudo certo": 2 };
export const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
