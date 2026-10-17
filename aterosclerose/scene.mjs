import { iso, onTop, extrude, circleRing, ring, pathOf, towardViewer, cameraOf, cylinder, knurl, lineOnTop, solidSvg, lineSvg, dotsSvg } from "./vendor/iso-kit.mjs";
import { modelAt, clamp, ease, T0 } from "./model.mjs";

// A parte que se redesenha a cada quadro: parede, placa, células, partículas e trombo.
// Roda no build (quadro inicial) e na página (mesmo código, inlinado).

export const AZ = 45;
export const EL = 52;
export const C = [0, 0];
export const ZF = 15; // piso do lúmen
export const ZT = 19; // topo da parede
export const MEDIA = 8;
export const ADV = 10;
const TAU = Math.PI * 2;
const BACK = ((AZ + 180) * Math.PI) / 180;
export const LEDGE_R = 82;
export const LEDGE_Z = 9;
// o seletor de estágio anda num sulco na borda do suporte: da esquerda, passando pela frente, até a direita
export const stageAngle = (s) => BACK + Math.PI / 2 + (s / 6) * Math.PI;

const at = (angle, radius) => [C[0] + radius * Math.cos(angle), C[1] + radius * Math.sin(angle)];
const relative = (angle) => {
  let d = (angle - BACK) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const mix = (a, b, u) => a + (b - a) * u;
const mix3 = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u), mix(a[2], b[2], u)];

function seeded(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seeded(11);
const sign = () => (random() < 0.5 ? -1 : 1);
const orbiter = (extra) => ({ a: random() * TAU, w: sign() * (0.1 + random() * 0.16), u0: 0.4 + random() * 0.3, du: 0.12 + random() * 0.12, nu: 0.4 + random() * 0.6, ph: random() * TAU, ...extra });

const LDL = Array.from({ length: 20 }, (_, i) => orbiter({ thr: 0.25 + (i / 20) * 2.9 + random() * 0.1, dlt: (random() - 0.5) * 2, dep: 0.15 + random() * 0.7 }));
const RBC = Array.from({ length: 12 }, () => orbiter({ w: sign() * (0.07 + random() * 0.1) }));
const MONO = Array.from({ length: 6 }, (_, i) => orbiter({ thr: 1.1 + i * 0.2, dlt: (i / 5 - 0.5) * 1.6, dep: 0.3 + random() * 0.5 }));
const SMC = Array.from({ length: 8 }, (_, i) => ({ thr: 2.6 + i * 0.13, dlt: (i / 7 - 0.5) * 1.5 }));

// luz da artéria: raio medido a partir do centro, em cada ângulo
export function lumenOf(m) {
  const profile = (rel) => {
    const u = Math.abs(rel) / Math.max(m.wrap, 1e-6);
    const focal = u >= 1 ? 0 : Math.pow(0.5 + 0.5 * Math.cos(Math.PI * u), 0.8);
    return m.ring + (1 - m.ring) * focal;
  };
  const N = 96;
  const areaOf = (T) => {
    let sum = 0;
    let first = 0;
    let prev = 0;
    for (let k = 0; k <= N; k++) {
      const r = m.ri - T * profile(relative(BACK + (TAU * k) / N));
      if (k === 0) first = r;
      else sum += 0.5 * prev * r * Math.sin(TAU / N);
      prev = k === N ? first : r;
    }
    return sum;
  };
  let T = 0;
  if (m.b > 1e-6) {
    let lo = 0;
    let hi = m.ri - 1.2;
    if (areaOf(hi) > m.lumen) T = hi;
    else {
      for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) / 2;
        if (areaOf(mid) > m.lumen) lo = mid;
        else hi = mid;
      }
      T = (lo + hi) / 2;
    }
  }
  return { T, rAt: (angle) => m.ri - T * profile(relative(angle)) };
}

const archPoints = (a0, a1, r0, r1, n) => {
  const out = [];
  for (let k = 0; k <= n; k++) out.push(at(a0 + ((a1 - a0) * k) / n, r1));
  for (let k = n; k >= 0; k--) out.push(at(a0 + ((a1 - a0) * k) / n, r0));
  return out;
};

const polygonArea = (points) => {
  let sum = 0;
  points.forEach(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    sum += x * ny - nx * y;
  });
  return Math.abs(sum) / 2;
};


const areaOf2 = (points) => {
  let sum = 0;
  points.forEach(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    sum += x * ny - nx * y;
  });
  return sum / 2;
};
const turned = (points, positive) => ((areaOf2(points) > 0) === positive ? points : [...points].reverse());

function facingRuns(flags) {
  const n = flags.length;
  const start = flags.findIndex((f, i) => f !== flags[(i + n - 1) % n]);
  if (start < 0) return flags[0] ? [Array.from({ length: n + 1 }, (_, i) => i % n)] : [];
  const runs = [];
  let run = null;
  for (let step = 0; step < n; step++) {
    const i = (start + step) % n;
    if (flags[i]) {
      if (!run) run = [i];
      run.push((i + 1) % n);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}

// sólido com furo: parede da artéria (withOuter) ou anel da placa (só a face de dentro aparece)
function ringSolid(outerRing, innerRing, z, height, P, withOuter) {
  const [vx, vy] = towardViewer(P);
  const { sinA, cosA } = cameraOf(P);
  const outer = turned(outerRing, true);
  const inner = turned(innerRing, false);
  const base = withOuter ? extrude(outer, z, height, P, { convex: true }) : null;
  const topOf = (list) => list.map(([x, y]) => iso([x, y, z + height], P));
  const botOf = (list) => list.map(([x, y]) => iso([x, y, z], P));
  const top = topOf(inner);
  const bot = botOf(inner);
  const n = inner.length;
  const flags = [];
  const buckets = [[], [], [], []];
  inner.forEach(([ax, ay], i) => {
    const [bx, by] = inner[(i + 1) % n];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;
    const facing = nx * vx + ny * vy > 1e-9;
    flags.push(facing);
    if (!facing) return;
    const lit = (nx * -sinA + ny * cosA + 1) / 2;
    const shade = Math.min(3, Math.max(0, Math.floor(lit * 4)));
    buckets[shade].push(pathOf(turned([top[i], top[(i + 1) % n], bot[(i + 1) % n], bot[i]], true), true));
  });
  const shades = buckets.map((list, i) => (base ? base.shades[i] : "") + list.join(""));
  const outerTop = pathOf(turned(topOf(outer), true), true);
  const hole = pathOf(turned(top, false), true);
  const lines = [pathOf(top, true)];
  for (const run of facingRuns(flags)) lines.push(pathOf(run.map((i) => bot[i])));
  flags.forEach((f, i) => {
    if (f !== flags[(i + n - 1) % n] && height > 0) lines.push(pathOf([top[i], bot[i]]));
  });
  return {
    fill: outerTop + hole + shades.join(""),
    outline: (base ? base.outline : "") + lines.join(""),
    crease: base ? base.crease : "",
    top: outerTop + hole,
    shades,
  };
}

export function trackSvg(P) {
  const arc = [];
  for (let k = 0; k <= 60; k++) arc.push(at(stageAngle((6 * k) / 60), LEDGE_R));
  const stops = [0, 1, 2, 3, 4, 5, 6].map((i) => at(stageAngle(i), LEDGE_R));
  return lineSvg(onTop(arc, LEDGE_Z, P), { tone: "faint" }) + lineSvg(stops.map(([x, y]) => onTop(circleRing(x, y, 1.7, 12), LEDGE_Z, P, true)).join(""), { tone: "mid" }) + dotsSvg(stops.map(([x, y]) => iso([x, y, LEDGE_Z], P)), { size: 0.5, tone: "hi" });
}

function knobSvg(s, P) {
  const a = stageAngle(s);
  const [x, y] = at(a, LEDGE_R);
  const top = LEDGE_Z + 3.6;
  return (
    solidSvg(cylinder(x, y, 4.6, LEDGE_Z, 3.6, P, 28, 0.4), { tone: "hi" }) +
    lineSvg(knurl(x, y, 4.6, LEDGE_Z, top, 22, P, 0.4), { tone: "lo" }) +
    lineSvg(lineOnTop([x, y], [x + Math.cos(a) * -3.6, y + Math.sin(a) * -3.6], top, P), { tone: "lit" }) +
    dotsSvg([iso([x, y, top], P)], { size: 0.55, tone: "hi" })
  );
}

export function sceneAt(s, t, P) {
  const m = modelAt(s);
  const L = lumenOf(m);
  const riD = m.ri + T0;
  const rOut = riD + MEDIA + ADV;
  const high = ZT - ZF;
  const out = { m };
  const poly = (points, z, closed = false) => onTop(points, z, P, closed);
  const dot = (x, y, z) => iso([x, y, z], P);

  // parede e anel da placa: sólidos com furo (sem emendas); a placa vai por cima da parede
  const N = 96;
  out.wall = solidSvg(ringSolid(circleRing(C[0], C[1], rOut, N), circleRing(C[0], C[1], riD, N), ZF, high, P, true), { tone: "mid" });
  const lumen = [];
  for (let k = 0; k < N; k++) {
    const a = (TAU * k) / N;
    lumen.push(at(a, L.rAt(a)));
  }
  out.plaque = `<g style="--tint:${clamp(m.b / 0.1, 0, 1).toFixed(3)}">${solidSvg(ringSolid(circleRing(C[0], C[1], riD, N), lumen, ZF, high, P, false), { tone: "hi", className: "ath-plaque" })}</g>`;

  const thickAt = (a) => Math.max(0, riD - L.rAt(a));
  const deepAt = () => riD - 1.2;
  const capTh = 1.1;
  const marks = [];

  // núcleo lipídico
  const phiK = Math.min(m.wrap * 0.8, 1.7);
  const shallowAt = (a) => {
    const deep = deepAt();
    const full = L.rAt(a) + capTh + 0.9;
    const thick = Math.max(0, deep - full);
    const u = Math.abs(relative(a)) / Math.max(phiK, 1e-6);
    const taper = u >= 1 ? 0 : Math.pow(Math.cos((Math.PI * u) / 2), 2);
    return deep - thick * m.core * taper;
  };
  if (m.core > 0.03 && phiK > 0.2) {
    const deepPts = [];
    const shallowPts = [];
    for (let k = 0; k <= 40; k++) {
      const a = BACK + phiK * ((2 * k) / 40 - 1);
      deepPts.push(at(a, deepAt()));
      shallowPts.push(at(a, shallowAt(a)));
    }
    marks.push(`<path class="ath-core" d="${poly([...deepPts, ...shallowPts.reverse()], ZT, true)}"/>`);
    if (m.crystals > 0.03) {
      const rhombi = [];
      for (let j = 0; j < 7; j++) {
        const a = BACK + phiK * ((j / 6) * 2 - 1) * 0.72;
        const near = shallowAt(a);
        const far = deepAt();
        if (far - near < 3.2) continue;
        const [cx, cy] = at(a, mix(near + 1.3, far - 1.5, 0.5 + 0.3 * Math.sin(j * 2.1)));
        const psi = j * 0.9;
        const len = 1.5 * m.crystals;
        const wid = 0.5 * m.crystals;
        const corner = (du, dv) => [cx + du * Math.cos(psi) - dv * Math.sin(psi), cy + du * Math.sin(psi) + dv * Math.cos(psi)];
        rhombi.push(poly([corner(len, 0), corner(0, wid), corner(-len, 0), corner(0, -wid)], ZT, true));
      }
      marks.push(lineSvg(rhombi.join(""), { tone: "mid" }));
    }
    if (m.calcium > 0.03) {
      const count = Math.floor(8 * m.calcium);
      const specks = [];
      for (let j = 0; j < count; j++) {
        const a = BACK + phiK * (-0.8 + (1.6 * j) / 7);
        if (deepAt() - shallowAt(a) < 2.2) continue;
        const [x, y] = at(a, deepAt() - 0.8);
        specks.push(dot(x, y, ZT));
      }
      marks.push(dotsSvg(specks, { size: 0.85, tone: "hi" }));
    }
  }

  // endotélio (pontilhado) com a falha na lesão; a capa fibrosa em destaque
  const gap = 0.22 * m.gap + 0.2 * m.rupture;
  const lining = [];
  for (let k = 0; k <= 90; k++) {
    const a = BACK + gap + ((TAU - 2 * gap) * k) / 90;
    lining.push(at(a, L.rAt(a) + 0.35));
  }
  marks.push(lineSvg(poly(lining, ZT), { tone: "mid", dotted: true, free: true }));

  if (m.cap > 0.03) {
    const half = m.rupture * 0.2;
    const reach = Math.min(m.wrap * 0.85, 1.9) * m.cap;
    const edge = (from, to) => {
      const pts = [];
      for (let k = 0; k <= 30; k++) {
        const a = BACK + mix(from, to, k / 30);
        pts.push(at(a, L.rAt(a) + capTh));
      }
      return poly(pts, ZT);
    };
    if (reach > half + 0.02) marks.push(lineSvg(edge(-reach, -half) + edge(half, reach), { tone: "lit", free: true }));
  }

  // movimento livre dentro do lúmen
  const drift = (e, z) => {
    const a = e.a + e.w * t;
    const r = L.rAt(a) * (e.u0 + e.du * Math.sin(e.nu * t + e.ph)) * 0.86;
    return [...at(a, r), z];
  };
  const inside = (e) => {
    const a = BACK + e.dlt * clamp(m.wrap, 0.22, 0.55) * 0.9;
    const thick = thickAt(a);
    return [...at(a, L.rAt(a) + 0.35 + e.dep * 0.8 * Math.max(0.2, thick - 0.7)), ZT];
  };

  const blood = [];
  for (const e of RBC) {
    const [x, y] = drift(e, ZF + 0.4);
    blood.push(poly(circleRing(x, y, 2.8, 12), ZF + 0.4, true) + poly(circleRing(x, y, 1.1, 8), ZF + 0.4, true));
  }
  marks.push(lineSvg(blood.join(""), { tone: "mid" }));

  const free = [];
  const oxidised = [];
  for (const e of LDL) {
    const q = ease((s - e.thr) / 0.9);
    const [x, y, z] = mix3(drift(e, ZF + 0.9), inside(e), q);
    (q > 0.98 && s > e.thr + 0.9 ? oxidised : free).push(dot(x, y, z));
  }
  marks.push(dotsSvg(free, { size: 1.15, tone: "hi" }));
  if (oxidised.length) marks.push(`<g class="ath-ox">${dotsSvg(oxidised, { size: 1.5, tone: "hi" })}</g>`);

  // monócitos que viram macrófagos e células espumosas
  const cellLines = [];
  const lipid = [];
  for (const e of MONO) {
    const q = ease((s - e.thr) / 1);
    if (s < e.thr - 0.35) continue;
    const [x, y, z] = mix3(drift(e, ZF + 0.9), inside(e), q);
    const thick = thickAt(BACK + e.dlt * clamp(m.wrap, 0.22, 0.55) * 0.9);
    const r = mix(2.3, clamp(0.4 * thick, 1, 2.3), q);
    cellLines.push(poly(circleRing(x, y, r, 14), z, true) + poly(circleRing(x + r * 0.25, y - r * 0.2, r * 0.38, 8), z, true));
    const foam = ease((s - e.thr - 1) / 1);
    for (let d = 0; d < Math.round(5 * foam); d++) {
      const ang = d * 1.9 + e.ph;
      lipid.push(dot(x - r * 0.1 + Math.cos(ang) * r * 0.55, y + Math.sin(ang) * r * 0.55, z));
    }
  }
  if (cellLines.length) marks.push(lineSvg(cellLines.join(""), { tone: "hi" }));
  if (lipid.length) marks.push(dotsSvg(lipid, { size: 0.7, tone: "hi" }));

  // células musculares lisas subindo da média até a capa
  const fibres = [];
  for (const e of SMC) {
    const q = ease((s - e.thr) / 0.8);
    if (q <= 0.01) continue;
    const a = BACK + e.dlt * Math.min(m.wrap * 0.8, 1.2);
    const stop = L.rAt(a) + capTh + 1.7;
    const [cx, cy] = at(a, mix(riD + 4, Math.min(stop, riD - 0.8), q));
    const tangent = a + Math.PI / 2;
    const ellipse = [];
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * TAU;
      const du = 2.8 * Math.cos(ang);
      const dv = 0.85 * Math.sin(ang);
      ellipse.push([cx + du * Math.cos(tangent) - dv * Math.sin(tangent), cy + du * Math.sin(tangent) + dv * Math.cos(tangent)]);
    }
    fibres.push(poly(ellipse, ZT, true));
  }
  if (fibres.length) marks.push(lineSvg(fibres.join(""), { tone: "mid" }));
  out.marks = marks.join("");

  // trombo sobre a ruptura
  out.thrombus = "";
  if (m.clot > 0.01) {
    const origin = at(BACK, L.rAt(BACK) - 0.7);
    const insideLumen = (x, y) => {
      const dx = x - C[0];
      const dy = y - C[1];
      return Math.hypot(dx, dy) < L.rAt(Math.atan2(dy, dx)) - 0.25;
    };
    const rays = 48;
    const blob = (reach) => {
      const pts = [];
      for (let k = 0; k < rays; k++) {
        const beta = (k / rays) * TAU;
        const want = reach * (1 + 0.08 * Math.sin(5 * beta + 1.3));
        let len = 0;
        while (len < want && insideLumen(origin[0] + Math.cos(beta) * (len + 0.4), origin[1] + Math.sin(beta) * (len + 0.4))) len += 0.4;
        pts.push([origin[0] + Math.cos(beta) * len, origin[1] + Math.sin(beta) * len, beta, len]);
      }
      return pts;
    };
    let lo = 0;
    let hi = 60;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (polygonArea(blob(mid)) < m.clot * m.lumen) lo = mid;
      else hi = mid;
    }
    const shape = blob(hi);
    out.thrombus = solidSvg(extrude(shape.map(([x, y]) => [x, y]), ZF, high - 0.2, P, { convex: false }), { tone: "mid", className: "ath-thr" });
    const platelets = shape.filter((_, k) => k % 4 === 0).map(([x, y, , len], k) => dot(origin[0] + (x - origin[0]) * (0.35 + 0.1 * (k % 3)), origin[1] + (y - origin[1]) * (0.35 + 0.1 * (k % 3)), ZT - 0.2 + len * 0));
    out.thrombus += dotsSvg(platelets, { size: 0.6, tone: "hi" });
  }

  // camadas da parede, desenhadas por cima da parede inteira
  const layers = [];
  layers.push(lineSvg(ring(C[0], C[1], riD + MEDIA, ZT, P, 72), { tone: "mid" }));
  for (const d of [2.4, 4.7, 7]) layers.push(lineSvg(ring(C[0], C[1], riD + d, ZT, P, 64), { tone: "faint" }));
  const collagen = [];
  for (const [d, count] of [[MEDIA + 3.2, 40], [MEDIA + 8.2, 52]]) {
    for (let k = 0; k < count; k++) {
      const [x, y] = at((k / count) * TAU + d, riD + d);
      collagen.push(dot(x, y, ZT));
    }
  }
  layers.push(dotsSvg(collagen, { size: 0.5, tone: "lo" }));
  const vasa = [BACK + 2.35, BACK - 2.7].map((a) => at(a, riD + MEDIA + 6.4));
  layers.push(lineSvg(vasa.map(([x, y]) => poly(circleRing(x, y, 2.1, 14), ZT, true)).join(""), { tone: "mid" }));
  layers.push(dotsSvg(vasa.map(([x, y]) => dot(x, y, ZT)), { size: 0.6, tone: "mid" }));
  out.rings = layers.join("");
  out.knob = knobSvg(s, P);

  return out;
}
