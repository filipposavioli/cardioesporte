// node build.mjs [--light]  →  aterosclerose.html | aterosclerose-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./vendor/iso-kit.mjs";
import { STAGES, modelAt, stageOf } from "./model.mjs";
import { sceneAt, trackSvg, AZ, EL, C, ZF, ZT } from "./scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const inline = (file) => readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");

const WIDTH = 680;
const HEIGHT = 490;

const HALF = 104;
const PLATE = { x: C[0] - HALF, y: C[1] - HALF, w: HALF * 2, d: HALF * 2, r: 10 };
const PLATE_H = 12;
const FOOT_H = 5;

const PLINTH_R = 90;
const PLINTH_H = 9;
const DISC_R = 76;

const DIAL = [C[0] + 82, C[1] - 82];
const DIAL_R = 22;
const DIAL_Z = 46;
const DIAL_H = 9;
const DIAL_TOP = DIAL_Z + DIAL_H;
const SWEEP = [-0.75 * Math.PI, 1.5 * Math.PI];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [DIAL[0] + DIAL_R, DIAL[1] - DIAL_R, DIAL_TOP + 2], [DIAL[0] - DIAL_R, DIAL[1] + DIAL_R, DIAL_TOP + 2], [C[0], C[1], ZT + 2]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: AZ, elevation: EL },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depthXY = (x, y) => k.depthOf([x, y, 0], P);
const byDepth = (points) => [...points].sort((a, b) => depthXY(a[0], a[1]) - depthXY(b[0], b[1]));

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  // placa de identificação no canto da esquerda
  const label = { x: C[0] - HALF + 14, y: C[1] + HALF - 46, w: 32, d: 32, r: 3 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  [[0.3, 6], [0.5, 12], [0.7, 6]].forEach(([v, trim]) => {
    out.push(L(k.lineOnTop([label.x + 6, label.y + label.d * v], [label.x + label.w - 6 - trim, label.y + label.d * v], 0.8, P), { tone: "lo", free: true }));
  });
  out.push(D([at([label.x + 3.5, label.y + 3.5, 0.8]), at([label.x + label.w - 3.5, label.y + label.d - 3.5, 0.8])], { size: 0.45 }));
  return out.join("");
}

function plinth() {
  const [cx, cy] = C;
  const behind = [];
  const ahead = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.38;
    const x = cx + Math.cos(angle) * 82;
    const y = cy + Math.sin(angle) * 82;
    (depthXY(x, y) < depthXY(cx, cy) ? behind : ahead).push([x, y]);
  }
  const screw = ([x, y]) =>
    S(k.cylinder(x, y, 2.6, PLINTH_H, 2.4, P, 18), { tone: "mid" }) + L(k.knurl(x, y, 2.6, PLINTH_H, PLINTH_H + 2.4, 14, P), { tone: "lo" }) + L(k.lineOnTop([x - 1.5, y], [x + 1.5, y], PLINTH_H + 2.4, P), { tone: "hi" });
  const base = k.cylinder(cx, cy, PLINTH_R, 0, PLINTH_H, P, 96, 1);
  const disc = k.cylinder(cx, cy, DISC_R, PLINTH_H, ZF - PLINTH_H, P, 96, 0.8);
  const out = [`<path class="iso-halo" d="${base.fill}"/>`, S(base, { tone: "lo" })];
  const marks = k.radialTicks(cx, cy, PLINTH_R - 0.8, 72, 6, PLINTH_H, [1.3, 2.8], P);
  out.push(L(marks.minor, { tone: "lo" }), L(marks.major, { tone: "mid" }));
  out.push(behind.map(screw).join(""));
  out.push(S(disc, { tone: "mid" }));
  out.push(L(k.ring(cx, cy, DISC_R - 4, ZF, P, 96), { tone: "faint" }));
  out.push(ahead.map(screw).join(""));
  return out.join("");
}

const needleAt = (stenosis) => {
  const angle = -0.75 * Math.PI + stenosis * 1.5 * Math.PI;
  const [x, y] = DIAL;
  return k.lineOnTop([x - Math.sin(angle) * 4, y + Math.cos(angle) * 4], [x + Math.sin(angle) * (DIAL_R - 4.5), y - Math.cos(angle) * (DIAL_R - 4.5)], DIAL_TOP + 0.2, P);
};

function dial() {
  const out = [];
  const [x, y] = DIAL;
  const base = { x: x - 15, y: y - 15, w: 30, d: 30, r: 4 };
  out.push(`<path class="iso-halo" d="${k.haloOf(base, 0, 6, P)}"/>`);
  out.push(S(k.slabOf(base, 0, 6, P, 5, 0.8), { tone: "mid" }));
  out.push(D(k.corners(base, 4).map(([px, py]) => at([px, py, 6])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, 6.5, 6, 4, P, 32), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 6.5, 6, 10, 28, P), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 4.2, 10, DIAL_Z - 10, P, 28), { tone: "mid", crease: "none" }));
  out.push(L([18, 32].map((z) => k.sideArc(x, y, 4.2, z, P, 14)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 3.4, DIAL_TOP, 84, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 3.4, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 2.2, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 3, 50, 5, DIAL_TOP, [1.3, 2.8], P, SWEEP[0], SWEEP[1]);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // zona crítica: de 70% a 100% de estenose
  const zone = [];
  for (let step = 0; step <= 30; step++) {
    const angle = SWEEP[0] + SWEEP[1] * (0.7 + (0.3 * step) / 30);
    zone.push([x + Math.sin(angle) * (DIAL_R - 5.4), y - Math.cos(angle) * (DIAL_R - 5.4)]);
  }
  out.push(L(k.onTop(zone, DIAL_TOP, P), { tone: "hi" }));
  out.push(S(k.slabOf({ x: x + DIAL_R - 1, y: y - 2.4, w: 5, d: 4.8, r: 1.2 }, DIAL_Z + 2, 5, P, 3), { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.6, DIAL_TOP, P, 16), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 10], DIAL_TOP, P, "x"), "ESTENOSE %", { size: 2.2, tone: "lo", anchor: "middle" }));
  return out.join("");
}

// quadro inicial: artéria saudável
const first = sceneAt(0, 0, P);
const slot = (name, markup) => `<g data-slot="${name}">${markup}</g>`;
const SLOTS = ["wall", "plaque", "marks", "thrombus", "rings", "knob"];

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Uma bancada didática com um corte transversal de artéria coronária preso a um suporte giratório. O corte tem adventícia, média e íntima; ao deslizar o carrinho sobre a régua do tempo, uma placa se forma na parede: LDL entra, é oxidado, macrófagos viram células espumosas, surgem núcleo lipídico e capa fibrosa, e por fim a capa se rompe e um trombo se forma. Um manômetro mostra a estenose do lúmen.",
  body: [
    plate(),
    plinth(),
    trackSvg(P),
    ...SLOTS.map((name) => slot(name, first[name])),
    dial(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.1"/>`,
  ],
});

const initial = STAGES[0];
const readoutOf = (s) => {
  const m = modelAt(s);
  return `${stageOf(s)} · ${STAGES[stageOf(s)].name} · estenose ${Math.round(m.stenosis * 100)}%`;
};

const CSS = `
.iso{--ath-amber:#d6a23f}
.iso[data-theme="light"]{--ath-amber:#c98a12}
.iso .iso-swatch[data-mark="amber"] path{stroke:var(--ath-amber)}
.iso .ath-plaque>.iso-top{fill:color-mix(in srgb,var(--ath-amber) calc(var(--tint,1)*34%),var(--anatomy-top))}
.iso .ath-plaque>.iso-shade{fill:color-mix(in srgb,var(--ath-amber) calc(var(--tint,1)*26%),var(--anatomy-shade-1))}
.iso .ath-plaque>.iso-shade[data-shade="0"]{fill:color-mix(in srgb,var(--ath-amber) calc(var(--tint,1)*26%),var(--anatomy-shade-0))}
.iso .ath-plaque>.iso-shade[data-shade="3"]{fill:color-mix(in srgb,var(--ath-amber) calc(var(--tint,1)*26%),var(--anatomy-shade-3))}
.iso .ath-core{fill:color-mix(in srgb,var(--ath-amber) 52%,var(--anatomy-shade-0));stroke:var(--ath-amber);stroke-opacity:.55;stroke-width:.6px;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.iso .ath-ox circle{fill:var(--anatomy-lit);opacity:1}
.iso .ath-thr>.iso-fill{fill:color-mix(in srgb,var(--anatomy-red) 35%,var(--anatomy-paper))}
.iso .ath-thr>.iso-top{fill:color-mix(in srgb,var(--anatomy-red) 60%,var(--anatomy-top))}
.iso .ath-thr>.iso-shade{fill:color-mix(in srgb,var(--anatomy-red) 45%,var(--anatomy-shade-1))}
.iso .ath-thr>.iso-edge{stroke:var(--anatomy-red)}
.iso .iso-stage{outline:none;touch-action:pan-y}
.iso .iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.iso .ath-steps{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px auto 0;max-width:620px}
.iso .ath-steps button{all:unset;cursor:pointer;box-sizing:border-box;padding:5px 9px;border:1px solid var(--anatomy-faint);color:var(--anatomy-muted);font:10.5px/1.2 var(--anatomy-mono);letter-spacing:.06em;text-transform:uppercase;transition:color .3s,border-color .3s}
.iso .ath-steps button:hover{color:var(--anatomy-text);border-color:var(--anatomy-lo)}
.iso .ath-steps button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:2px}
.iso .ath-steps button[aria-pressed="true"]{color:var(--anatomy-strong);border-color:var(--anatomy-hi)}
.iso .ath-note{margin:10px 0 0;color:var(--anatomy-text);font-size:14px;line-height:1.6;min-height:6.4em}
.iso .ath-note strong{color:var(--anatomy-strong);font-weight:600}
`;

const chips = STAGES.map((stage, index) => `<button type="button" data-stage="${index}" aria-pressed="${index === 0}">${index} ${stage.name}</button>`).join("");
const note = `<p class="ath-note" aria-live="polite"><strong>${initial.name}.</strong> ${initial.text}</p>`;

const live = `
${inline("model.mjs")}
${inline("scene.mjs")}
const P = ${JSON.stringify(P)};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const SWEEP = ${JSON.stringify(SWEEP)};
const SLOTS = ${JSON.stringify(SLOTS)};
const stageBox = document.querySelector(".iso-stage");
const svg = stageBox.querySelector("svg");
const slots = Object.fromEntries(SLOTS.map((name) => [name, svg.querySelector('[data-slot="' + name + '"]')]));
const needle = svg.querySelector('[data-part="needle"]');
const readout = document.querySelector("[data-readout]");
const noteBox = document.querySelector(".ath-note");
const chips = [...document.querySelectorAll(".ath-steps button")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const needleAt = (stenosis) => {
  const angle = SWEEP[0] + stenosis * SWEEP[1];
  const [x, y] = DIAL;
  return lineOnTop([x - Math.sin(angle) * 4, y + Math.cos(angle) * 4], [x + Math.sin(angle) * (DIAL_R - 4.5), y - Math.cos(angle) * (DIAL_R - 4.5)], DIAL_TOP + 0.2, P);
};
const TOUR = [0, 1, 2, 3, 4, 5, 6, 0], DWELL = 3.6;
let s = 0, target = 0, clock = 0, tour = !still.matches, tourClock = 0, tau = 0.6;
let frame = 0, last = 0, visible = false, idleTimer = 0, shown = -1;
function draw() {
  const scene = sceneAt(s, still.matches ? 0 : clock, P);
  for (const name of SLOTS) slots[name].innerHTML = scene[name];
  needle.setAttribute("d", needleAt(scene.m.stenosis));
  const index = stageOf(s);
  const text = index + " · " + STAGES[index].name + " · estenose " + Math.round(scene.m.stenosis * 100) + "%";
  if (readout.textContent !== text) readout.textContent = text;
  if (index !== shown) {
    shown = index;
    noteBox.innerHTML = "<strong>" + STAGES[index].name + ".</strong> " + STAGES[index].text;
    chips.forEach((chip, i) => chip.setAttribute("aria-pressed", String(i === index)));
    stageBox.setAttribute("aria-valuenow", String(index));
    stageBox.setAttribute("aria-valuetext", index + " de 6, " + STAGES[index].name + ", estenose " + Math.round(scene.m.stenosis * 100) + " por cento");
  }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (tour) { tourClock += dt; target = TOUR[Math.floor(tourClock / DWELL) % TOUR.length]; }
  if (!calm) clock += dt;
  s = calm ? target : s + (target - s) * (1 - Math.exp(-dt / tau));
  if (Math.abs(target - s) < 0.0004) s = target;
  draw();
  frame = visible && (!calm || s !== target) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next, seconds) => {
  tour = false; tau = 0.38; target = clamp(next, 0, 6);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { tour = !still.matches; tourClock = Math.max(0, TOUR.findIndex((v) => v === Math.round(target))) * DWELL; tau = 0.6; run(); }, seconds || 6500);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stageBox);
stageBox.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.07) / 0.86, 0, 1);
  steer(share * 6, 3200);
});
stageBox.addEventListener("pointerdown", (event) => {
  const box = svg.getBoundingClientRect();
  steer(clamp(((event.clientX - box.left) / box.width - 0.07) / 0.86, 0, 1) * 6, 6500);
});
stageBox.addEventListener("keydown", (event) => {
  const here = Math.round(target);
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = Math.min(6, here + 1);
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = Math.max(0, here - 1);
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = 6;
  if (to === null) return;
  event.preventDefault();
  steer(to, 8000);
});
chips.forEach((chip) => chip.addEventListener("click", () => steer(Number(chip.dataset.stage), 9000)));
draw();
`;

let html = k.plateHtml({
  fig: "Fig 1",
  title: "Aterosclerose coronária",
  hint: "Passe o mouse ou toque nos estágios",
  readout: readoutOf(0),
  keys: [
    { mark: "lit", label: "LDL oxidado e capa fibrosa" },
    { mark: "amber", label: "Placa e núcleo lipídico" },
    { mark: "raised", label: "Parede da artéria" },
    { mark: "red", label: "Trombo" },
  ],
  caption:
    "Corte transversal de uma artéria coronária. Cada marca no sulco do suporte é um estágio da doença, de décadas; o manômetro lê a estenose do lúmen. Até cerca de 40% de carga de placa o vaso se expande e o lúmen não encolhe (Glagov), por isso o ponteiro só sobe depois. No lúmen, discos são hemácias e pontos são LDL. Modelo didático: as áreas seguem esse remodelamento, a escala de tempo é qualitativa.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Linha do tempo da aterosclerose: setas avançam ou voltam um estágio" aria-valuemin="0" aria-valuemax="6" aria-valuenow="0" aria-valuetext="0 de 6, ${initial.name}, estenose 0 por cento">${svg}</div><div class="ath-steps" role="group" aria-label="Estágios">${chips}</div>`,
});
html = html.replace("</figure>", `${note}</figure>`);

const file = theme === "light" ? "aterosclerose-light.html" : "aterosclerose.html";
const page = k
  .pageHtml({ title: "Aterosclerose coronária", theme, body: `<style>${CSS}</style>${html}`, script: inline("vendor/iso-kit.mjs") + live })
  .replace('<html lang="en">', '<html lang="pt-BR">');
writeFileSync(join(HERE, file), page);
console.log("wrote", file, Math.round(page.length / 1024) + " KB");
