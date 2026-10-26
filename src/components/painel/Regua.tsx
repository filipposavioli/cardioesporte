import { scaleLinear } from "d3";
import type { Marcador } from "@/lib/dados";
import { dominioRegua } from "@/lib/painel-calc";
import { COR, nf } from "./util";

/** Régua: onde o valor cai em relação à faixa de referência (rule() do app.js). */
export function Regua({ m, labels }: { m: Marcador; labels: boolean }) {
  const dom = dominioRegua(m);
  if (!dom) return null;
  const { d0, d1, lo, hi } = dom;
  const v = Number(m.valor);
  const W = 260, H = labels ? 34 : 18;
  const x = scaleLinear([d0, d1], [7, W - 7]).clamp(true);
  return (
    <svg
      className="sc-rule"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`${m.resultado}; referência ${m.referencia}`}
    >
      <rect x={2} y={6} width={W - 4} height={6} rx={3} fill="var(--sc-soft)" />
      <rect
        x={x(lo ?? d0)}
        y={6}
        width={Math.max(2, x(hi ?? d1) - x(lo ?? d0))}
        height={6}
        rx={3}
        fill="var(--sc-band)"
      />
      <circle cx={x(v)} cy={9} r={6} fill={COR[m.status]} stroke="var(--color-panel)" strokeWidth={2.5} />
      {labels && lo != null && (
        <text x={x(lo)} y={30} textAnchor="middle">
          {nf(lo)}
        </text>
      )}
      {labels && hi != null && (
        <text x={x(hi)} y={30} textAnchor="middle">
          {nf(hi)}
        </text>
      )}
    </svg>
  );
}
