"use client";
import { arc } from "d3";
import { sistemas } from "@/lib/painel-calc";

type Sis = ReturnType<typeof sistemas>[number];

const arco = (r0: number, r1: number, a0: number, a1: number) =>
  arc().cornerRadius(3)({ innerRadius: r0, outerRadius: r1, startAngle: a0, endAngle: a1 }) ?? "";

/** Anel de exames em ordem (ring() do app.js). */
function Anel({ okN, total, pior }: { okN: number; total: number; pior: string }) {
  const S = 68, R = S / 2, ri = R * 0.72, re = R * 0.98, T = 2 * Math.PI;
  return (
    <svg viewBox={`${-R} ${-R} ${S} ${S}`} aria-hidden="true">
      <path d={arco(ri, re, 0, T)} fill="var(--sc-soft)" />
      <path d={arco(ri, re, 0, (T * okN) / total)} fill="var(--sc-verde)" />
      {okN < total && <path d={arco(ri, re, (T * okN) / total + 0.06, T - 0.06)} fill={pior} />}
      <text className="r-n" textAnchor="middle" y={6} fontSize={17}>
        {`${okN}/${total}`}
      </text>
    </svg>
  );
}

const ITENS = [
  ["ok", "d-ok", "em ordem"],
  ["atencao", "d-at", "atenção"],
  ["prioridade", "d-pr", "prioridade"],
] as const;

export function Mapa({ lista, onSistema }: { lista: Sis[]; onSistema: (s: string) => void }) {
  return (
    <section className="sc-sec" id="mapa">
      <div className="sc-sh">
        <span className="sc-num">01</span>
        <h2>mapa da sua saúde</h2>
      </div>
      <p className="sc-lead">
        Cada área do corpo, com quantos exames estão em ordem. Toque numa área para ver os exames dela.
      </p>
      <div className="sc-map" id="sc-map">
        {lista.map((s) => {
          const pior = s.prioridade ? "pr" : s.atencao ? "at" : "ok";
          return (
            <button
              key={s.sistema}
              type="button"
              className={`sc-sys w-${pior} sc-anim`}
              onClick={() => onSistema(s.sistema)}
            >
              <Anel okN={s.ok} total={s.total} pior={pior === "pr" ? "var(--sc-red)" : "var(--sc-amb)"} />
              <div>
                <p className="sc-sys-n">{s.sistema}</p>
                <p className="sc-sys-c">
                  {ITENS.filter(([f]) => f === "ok" || s[f] > 0).map(([f, cls, lab]) => (
                    <span key={f}>
                      <i className={cls}></i>
                      <b>{s[f]}</b> {lab}
                    </span>
                  ))}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
