// Modelo da formação da placa. Tudo o que a figura mostra (geometria, readout, manômetro) sai daqui.
// s vai de 0 (artéria saudável) a 6 (ruptura com trombo); entre dois estágios inteiros a interpolação é suavizada.

export const R0 = 40; // raio do lúmen saudável (unidades do desenho)
export const T0 = 0.8; // película de íntima/endotélio que existe mesmo na artéria saudável
export const A0 = Math.PI * R0 * R0;

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const ease = (t) => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};

const stepped = (list, s) => {
  const i = Math.min(list.length - 2, Math.max(0, Math.floor(s)));
  return list[i] + (list[i + 1] - list[i]) * ease(s - i);
};

// carga de placa = área da placa / área dentro da lâmina elástica interna (IEL)
const BURDEN = [0, 0.02, 0.07, 0.17, 0.4, 0.86, 0.86];
// abertura angular da placa (graus) e fração circunferencial da espessura
const WRAP = [0, 25, 40, 65, 105, 175, 175];
const RING = [0, 0, 0, 0, 0.22, 0.6, 0.6];

export function modelAt(input) {
  const s = clamp(input, 0, 6);
  const b = stepped(BURDEN, s);
  // Glagov: até ~40% de carga o vaso se expande e o lúmen não muda; depois o vaso para de compensar.
  const iel = b <= 0.4 ? A0 / (1 - b) : A0 / 0.6;
  const lumen = iel * (1 - b);
  const clot = 0.86 * ease((s - 5.2) / 0.8);
  const open = lumen * (1 - clot);
  return {
    s,
    b,
    ri: Math.sqrt(iel / Math.PI),
    iel,
    lumen,
    clot,
    open,
    stenosis: 1 - Math.sqrt(open / A0),
    wrap: (stepped(WRAP, s) * Math.PI) / 180,
    ring: stepped(RING, s),
    gap: ease(s / 0.8),
    core: ease((s - 2.4) / 1.6),
    cap: ease((s - 3.0) / 1.4),
    crystals: ease((s - 3.6) / 0.6),
    calcium: ease((s - 4.3) / 0.7),
    rupture: ease((s - 5.1) / 0.5),
  };
}

export const STAGES = [
  {
    name: "artéria saudável",
    text: "Endotélio íntegro, íntima fina, média elástica e adventícia. O fluxo laminar mantém o endotélio protegido: produz óxido nítrico e quase não deixa o LDL nem as células do sangue aderirem.",
  },
  {
    name: "disfunção endotelial",
    text: "Hipertensão, tabagismo, glicose alta, LDL elevado e fluxo turbulento (nas bifurcações, por exemplo) tornam o endotélio permeável. O LDL atravessa, fica retido na íntima e é oxidado.",
  },
  {
    name: "estria gordurosa",
    text: "O LDL oxidado ativa o endotélio: monócitos aderem, entram na íntima, viram macrófagos e engolem o LDL oxidado até virarem células espumosas. Lesão ainda reversível e sem sintomas.",
  },
  {
    name: "pré-ateroma",
    text: "Gotas de lipídio se juntam e formam um núcleo. Células musculares lisas migram da média para baixo do endotélio. A placa cresce para fora e o vaso se expande: o lúmen ainda se preserva.",
  },
  {
    name: "fibroateroma",
    text: "Uma capa fibrosa cobre o núcleo necrótico, com cristais de colesterol e início de calcificação. Com cerca de 40% de carga o vaso para de compensar (Glagov) e o lúmen passa a estreitar.",
  },
  {
    name: "placa estenótica",
    text: "Placa grande, excêntrica e calcificada. A luz residual menor reduz a reserva de fluxo (a resistência cresce com 1/r⁴). A angina de esforço costuma aparecer com estenoses acima de uns 70%.",
  },
  {
    name: "ruptura e trombo",
    text: "Uma capa fina, inflamada e cheia de macrófagos se rompe. O núcleo expõe fator tecidual, plaquetas e fibrina formam o trombo e podem ocluir a artéria: infarto agudo do miocárdio.",
  },
];

export const stageOf = (s) => clamp(Math.round(s), 0, 6);
