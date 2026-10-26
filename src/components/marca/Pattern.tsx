// Pattern oficial: grade de símbolos em paralelogramo (cada linha recua para a esquerda),
// com /savi.core no canto inferior direito (como pattern_svg de marca.py). Cor por prop.
import { SIMBOLO_D, SIMBOLO_VB } from "./Simbolo";
import { WM_D, WM_SLASH_ADV, WM_SLASH_D, WM_W } from "./Wordmark";

type Props = { cols?: number; rows?: number; cor?: string; fundo?: string | null; assinatura?: boolean };

export function Pattern({ cols = 10, rows = 5, cor = "#ade736", fundo = null, assinatura = true }: Props) {
  const sc = 105 / SIMBOLO_VB[0];
  const dx = 132, dy = 92, sh = 36;
  const W = cols * dx + rows * sh + 40;
  const H = rows * dy + 70;
  const s2 = 360 / (WM_SLASH_ADV + WM_W);
  const sims = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      sims.push(
        <path
          key={`${j}-${i}`}
          transform={`translate(${Math.round(20 + (rows - 1 - j) * sh + i * dx)},${20 + j * dy}) scale(${sc.toFixed(4)})`}
          d={SIMBOLO_D}
        />,
      );
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      {fundo && <rect width={W} height={H} fill={fundo} />}
      <g fill={cor}>{sims}</g>
      {assinatura && (
        <g transform={`translate(${W - 390},${H - 66}) scale(${s2.toFixed(5)})`} fill={cor}>
          <path d={WM_SLASH_D} />
          <path transform={`translate(${WM_SLASH_ADV},0)`} d={WM_D} />
        </g>
      )}
    </svg>
  );
}
