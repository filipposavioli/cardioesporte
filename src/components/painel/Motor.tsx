"use client";
import { useEffect, useMemo, useRef } from "react";
import { max, scaleLinear, select } from "d3";
import type { Marcador, Zona } from "@/lib/dados";
import { Simbolo } from "@/components/marca/Simbolo";
import { usePainel } from "./contexto";
import { badgeCls, esc, nf } from "./util";

const FILLS = ["var(--sc-conc)", "var(--sc-verde)", "var(--sc-med)"];
const TXT = ["var(--sc-pet)", "var(--sc-pet)", "#fff"];

/** Barras "Acima do esperado" (drawPred do app.js). */
function Predito({ rows }: { rows: Marcador[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { mostrarTip, esconderTip, versao } = usePainel();
  useEffect(() => {
    const el = ref.current!;
    el.replaceChildren();
    const W = Math.max(260, el.clientWidth), rowH = 54, H = rows.length * rowH + 22;
    const x = scaleLinear([0, Math.max(150, max(rows, (r) => r.pct_predito!)! * 1.08)], [0, W - 8]);
    const svg = select(el).append("svg").attr("width", "100%").attr("viewBox", `0 0 ${W} ${H}`);
    rows.forEach((r, i) => {
      const y = i * rowH, p = r.pct_predito!;
      svg.append("text").attr("class", "p-l").attr("x", 0).attr("y", y + 14).text(r.exame);
      svg.append("rect").attr("x", 0).attr("y", y + 22).attr("width", W - 8).attr("height", 14).attr("rx", 7).attr("fill", "var(--sc-soft)");
      svg.append("rect").attr("x", 0).attr("y", y + 22).attr("width", x(p)).attr("height", 14).attr("rx", 7).attr("fill", "var(--sc-line)")
        .on("mousemove", (ev: MouseEvent) => mostrarTip(ev, `<span>${esc(r.exame)}</span>${esc(r.resultado)} · <b>${p}%</b> do previsto`))
        .on("mouseleave", esconderTip);
      svg.append("text").attr("class", "p-v").attr("x", W - 8).attr("y", y + 14).attr("text-anchor", "end").text(p + "%");
    });
    svg.append("line").attr("x1", x(100)).attr("x2", x(100)).attr("y1", 16).attr("y2", H - 14)
      .attr("stroke", "var(--color-fg)").attr("stroke-dasharray", "3 3").attr("opacity", 0.6);
    svg.append("text").attr("x", x(100)).attr("y", H - 2).attr("text-anchor", "middle").text("100% do previsto");
  }, [rows, versao, mostrarTip, esconderTip]);
  return <div className="sc-pred" id="sc-pred" ref={ref} />;
}

/** Faixa das zonas de treino (drawZones do app.js). */
function Zonas({ z }: { z: Zona[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { mostrarTip, esconderTip, versao } = usePainel();
  useEffect(() => {
    const el = ref.current!;
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth), H = 78, lo = 100, hi = max(z, (r) => +r.ate)!;
    const x = scaleLinear([lo, hi], [2, W - 2]);
    const svg = select(el).append("svg").attr("width", "100%").attr("viewBox", `0 0 ${W} ${H}`);
    z.forEach((r, i) => {
      const a = r.de == null ? lo : +r.de, b = +r.ate;
      svg.append("rect").attr("x", x(a) + (i ? 2 : 0)).attr("y", 26).attr("width", Math.max(0, x(b) - x(a) - (i ? 2 : 0))).attr("height", 36)
        .attr("rx", 8).attr("fill", FILLS[i % 3])
        .on("mousemove", (ev: MouseEvent) =>
          mostrarTip(ev, `<span>${esc(r.zona)}</span>${r.de == null ? "abaixo de " + r.ate : r.de + " a " + r.ate} bpm · ${esc(r.vel)}`))
        .on("mouseleave", esconderTip);
      svg.append("text").attr("class", "z-l").attr("x", (x(a) + x(b)) / 2).attr("y", 49).attr("text-anchor", "middle").style("fill", TXT[i % 3]).text(r.zona);
    });
    z.forEach((r, i) => {
      const last = i === z.length - 1;
      svg.append("text").attr("class", "z-v").attr("x", x(+r.ate)).attr("y", 16).attr("text-anchor", last ? "end" : "middle")
        .text(r.ate + (last ? " bpm · pico" : " bpm"));
    });
    // Em telas estreitas o rótulo do penúltimo limiar encosta no do pico: passa a terminar no limite.
    const rot = svg.selectAll<SVGTextElement, unknown>("text.z-v").nodes();
    const caixa = (t: SVGTextElement) => (typeof t.getBBox === "function" ? t.getBBox() : null);
    for (let i = rot.length - 2; i >= 0; i--) {
      const a = caixa(rot[i]), b = caixa(rot[i + 1]);
      if (a && b && a.x + a.width + 6 > b.x) rot[i].setAttribute("text-anchor", "end");
    }
    svg.append("text").attr("x", 2).attr("y", 76).text("repouso");
  }, [z, versao, mostrarTip, esconderTip]);
  return (
    <div className="sc-zones" id="sc-zones">
      <div ref={ref} />
      <ul className="sc-zlist">
        {z.map((r, i) => (
          <li key={r.zona}>
            <b>
              <i style={{ background: FILLS[i % 3] }}></i>
              {r.zona + " · " + r.vel}
            </b>
            {r.uso}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Motor({ marcadores, zonas }: { marcadores: Marcador[]; zonas: Zona[] | null }) {
  const pred = useMemo(() => marcadores.filter((m) => m.pct_predito != null), [marcadores]);
  const vo2 = marcadores.find((m) => m.exame === "VO₂ máximo");
  return (
    <section className="sc-sec" id="performance">
      <div className="sc-sh">
        <span className="sc-num">03</span>
        <h2>seu motor</h2>
      </div>
      <p className="sc-lead">O que o teste cardiopulmonar mostrou sobre o seu condicionamento.</p>
      <div className="sc-motor">
        {vo2 && (
          <div className="sc-vo2">
            <div className="sc-vo2-sym" aria-hidden="true">
              <Simbolo altura={160} cor="#ade736" />
            </div>
            <p className="sc-vo2-l">VO₂ máximo</p>
            <p className="sc-vo2-n">{vo2.valor == null ? "—" : nf(vo2.valor)}</p>
            <p className="sc-vo2-u">
              mL/kg/min · <span className={badgeCls(vo2.status)}>{vo2.status}</span>
            </p>
            <p className="sc-vo2-t">{vo2.leitura}</p>
          </div>
        )}
        {pred.length > 0 && (
          <div className="sc-card">
            <p className="sc-ct">Acima do esperado</p>
            <p className="sc-note">Quanto do valor previsto para você foi atingido. A linha marca 100%.</p>
            <Predito rows={pred} />
          </div>
        )}
        {zonas && zonas.length > 0 && (
          <div className="sc-card sc-zcard">
            <p className="sc-ct">Suas zonas de treino</p>
            <p className="sc-note">Frequência cardíaca nos seus limiares, medida no teste cardiopulmonar.</p>
            <Zonas z={zonas} />
          </div>
        )}
      </div>
    </section>
  );
}
