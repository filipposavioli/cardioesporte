"use client";
import { useEffect, useMemo, useRef } from "react";
import { area, extent, groups, line, max, min, scaleLinear, scaleUtc, select } from "d3";
import type { PontoEvolucao } from "@/lib/dados";
import { parseRef, tendencia } from "@/lib/painel-calc";
import { usePainel } from "./contexto";
import { dfmt, esc, mfmt, nf } from "./util";

type Ponto = PontoEvolucao & { dt: Date };

/** Gráfico de um marcador (drawTrends do app.js): área em degradê, faixa desejável e pontos. */
function Grafico({ nome, rows, gi }: { nome: string; rows: Ponto[]; gi: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { mostrarTip, esconderTip, versao } = usePainel();
  useEffect(() => {
    const box = ref.current!;
    box.replaceChildren();
    const first = rows[0], last = rows[rows.length - 1];
    const [rlo, rhi] = parseRef(last.ref);
    const W = Math.max(260, box.clientWidth), H = 160, m = { t: 18, r: 18, b: 22, l: 34 };
    const vals = rows.map((r) => r.valor).concat([rlo, rhi].filter((x): x is number => x != null));
    let y0 = min(vals)!, y1 = max(vals)!;
    const pad = (y1 - y0) * 0.2 || 5;
    y0 = Math.max(0, y0 - pad);
    y1 += pad;
    const x = scaleUtc(extent(rows, (r) => r.dt) as [Date, Date], [m.l, W - m.r]);
    const y = scaleLinear([y0, y1], [H - m.b, m.t]).nice(4);
    const svg = select(box).append("svg").attr("width", "100%").attr("viewBox", `0 0 ${W} ${H}`);
    const gid = "scg" + gi;
    const def = svg.append("defs").append("linearGradient").attr("id", gid).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
    ([[0, 0.32], [0.5, 0.12], [1, 0]] as const).forEach(([o, a]) =>
      def.append("stop").attr("offset", o).style("stop-color", "var(--sc-line)").style("stop-opacity", a));
    const [d0, d1] = y.domain(), b0 = Math.max(rlo ?? d0, d0), b1 = Math.min(rhi ?? d1, d1);
    if (b1 > b0)
      svg.append("rect").attr("x", m.l).attr("width", W - m.l - m.r).attr("y", y(b1)).attr("height", y(b0) - y(b1))
        .attr("fill", "var(--sc-band)").attr("opacity", 0.55).attr("rx", 4);
    const yt = y.ticks(4);
    svg.append("g").selectAll("line").data(yt).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y)
      .attr("stroke", "var(--cds-chart-grid)");
    svg.append("g").selectAll("text").data(yt).join("text").attr("x", m.l - 6).attr("y", (dd) => y(dd) + 4)
      .attr("text-anchor", "end").text((dd) => nf(dd, 0));
    svg.append("path").datum(rows).attr("fill", `url(#${gid})`)
      .attr("d", area<Ponto>((r) => x(r.dt), y(d0), (r) => y(r.valor)));
    svg.append("path").datum(rows).attr("fill", "none").attr("stroke", "var(--sc-line)").attr("stroke-width", 2.5)
      .attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
      .attr("d", line<Ponto>((r) => x(r.dt), (r) => y(r.valor)));
    const n = rows.length;
    svg.append("g").selectAll("circle").data(rows).join("circle").attr("cx", (r) => x(r.dt)).attr("cy", (r) => y(r.valor))
      .attr("r", (r, i) => (i === n - 1 ? 6 : 4))
      .attr("fill", (r, i) => (i === n - 1 ? "var(--sc-line)" : "var(--color-panel)"))
      .attr("stroke", "var(--sc-line)").attr("stroke-width", 2)
      .on("mousemove", (ev: MouseEvent, r) =>
        mostrarTip(ev, `<span>${dfmt(r.data)}</span>${esc(nome)}: <b>${nf(r.valor)}</b> ${esc(r.unidade)}`))
      .on("mouseleave", esconderTip);
    const fl = svg.append("text").attr("x", x(first.dt)).attr("y", H - 4).attr("text-anchor", "start").text(mfmt(first.data));
    const ll = svg.append("text").attr("x", x(last.dt)).attr("y", H - 4).attr("text-anchor", "end").text(mfmt(last.data));
    const larg = (t: SVGTextElement | null) =>
      t && typeof t.getComputedTextLength === "function" ? t.getComputedTextLength() : 0;
    if (n < 2 || larg(fl.node()) + larg(ll.node()) + 8 > x(last.dt) - x(first.dt)) fl.remove();
  }, [nome, rows, gi, versao, mostrarTip, esconderTip]);
  return <div className="sc-tbox" ref={ref} />;
}

export function Evolucao({ evolucao }: { evolucao: PontoEvolucao[] }) {
  const grupos = useMemo(
    () =>
      groups(
        evolucao.map((r) => ({ ...r, valor: +r.valor, dt: new Date(String(r.data).slice(0, 10) + "T12:00:00Z") })),
        (r) => r.marcador,
      ).map(([nome, rows]) => [nome, rows.sort((a, b) => +a.dt - +b.dt)] as const),
    [evolucao],
  );
  return (
    <section className="sc-sec" id="evolucao">
      <div className="sc-sh">
        <span className="sc-num">04</span>
        <h2>sua evolução</h2>
      </div>
      <p className="sc-lead">Como os marcadores mais importantes mudaram. A faixa verde é o valor desejável.</p>
      <div className="sc-trends" id="sc-trends">
        {grupos.map(([nome, rows], gi) => {
          const { primeiro, ultimo, delta, bom } = tendencia(rows);
          return (
            <div key={nome} className="sc-card sc-tcard sc-anim">
              <div className="sc-th">
                <div>
                  <p className="sc-ct">{nome}</p>
                  <p className="sc-tv">
                    {nf(ultimo.valor)}
                    <small>{ultimo.unidade + " · " + mfmt(ultimo.data)}</small>
                  </p>
                </div>
                <span className={"sc-delta " + (bom ? "up" : "down")}>
                  {(delta === 0 ? "= " : delta > 0 ? "↑ " : "↓ ") + nf(Math.abs(delta)) + " · " + (bom ? "melhorou" : "acompanhar")}
                </span>
              </div>
              <p className="sc-note">{"Desde " + mfmt(primeiro.data) + " · desejável " + ultimo.ref}</p>
              <Grafico nome={nome} rows={rows} gi={gi} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
