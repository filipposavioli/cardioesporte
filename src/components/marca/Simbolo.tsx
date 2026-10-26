// Símbolo oficial savi.core (vetor de marca.py, pacote bass. out/2026). Cor por prop.
export const SIMBOLO_D =
  "M468.58 12.46C465.06 0.00 441.46 17.65 430.07 27.45C403.59 50.24 378.80 75.90 352.84 101.69C312.68 141.55 120.85 334.59 100.69 262.52C93.44 236.63 107.27 195.34 118.31 170.67C128.13 148.72 139.03 129.91 150.64 113.33C134.88 113.33 120.45 121.89 112.74 135.64C109.69 141.08 106.42 147.57 102.43 156.81L33.54 316.35L6.51 387.33C3.17 396.11 0.64 407.05 0.35 418.49C0.00 433.10 21.69 421.83 32.44 412.14L74.68 374.08L132.53 316.78C175.35 274.36 217.88 235.09 262.26 200.43C284.08 183.38 305.32 169.47 327.95 159.94C338.71 155.40 349.58 153.44 359.86 158.41C368.52 162.60 372.97 178.53 370.61 196.86C368.02 216.91 362.89 235.08 356.33 251.25C347.23 273.69 337.01 293.01 326.09 310.16C342.42 310.16 357.20 300.44 363.67 285.44L433.85 122.88C444.25 98.79 473.38 29.45 468.58 12.46Z";
export const SIMBOLO_VB: [number, number] = [473.38, 433.1];

type Props = { altura: number; cor?: string; className?: string };

export function Simbolo({ altura, cor = "#ade736", className }: Props) {
  return (
    <svg
      className={className}
      width={+((altura * SIMBOLO_VB[0]) / SIMBOLO_VB[1]).toFixed(2)}
      height={altura}
      viewBox={`0 0 ${SIMBOLO_VB[0]} ${SIMBOLO_VB[1]}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d={SIMBOLO_D} fill={cor} />
    </svg>
  );
}
