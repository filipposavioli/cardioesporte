"""Edit decision list: cortes, enquadramentos e mapeamento tempo-fonte -> tempo-saída."""
import json

SRC_IN, SRC_OUT = 9.5, 239.5
EXCLUDE = [(134.40, 138.15)]          # tropeço "É o que chamamos em dias de..."
MERGE_GAP = 0.40                      # pausas menores que isso não viram corte
PAD_IN, PAD_OUT = 0.12, 0.28

# crops no 4K (x0, y0, w, h)
CROPS = {
    "WIDE":  (0, 0, 3840, 2160),
    "MED":   (555, 150, 2880, 1620),
    "CLOSE": (1035, 255, 1920, 1080),
    "LEFT":  (960, 150, 2880, 1620),
    "PIP":   (1665, 315, 1920, 1080),
}

# plano de câmera (tempo-fonte)
PLAN = [
    (9.5, 19.6, "MED"), (19.6, 28.3, "CLOSE"), (28.3, 43.4, "MED"),
    (43.4, 54.6, "WIDE"), (54.6, 95.5, "LEFT"), (95.5, 108.9, "CLOSE"),
    (108.9, 114.0, "MED"), (114.0, 146.9, "LEFT"), (146.9, 159.0, "MED"),
    (159.0, 180.3, "LEFT"), (180.3, 193.5, "CLOSE"), (193.5, 219.2, "LEFT"),
    (219.2, 230.4, "LEFT"), (230.4, 232.2, "MED"), (232.2, 240.0, "CLOSE"),
]
ALT = {"MED": "CLOSE"}   # alternância nos jump cuts
# pausas inseridas (tela de capítulo): corta no tempo-fonte indicado e insere a pausa
GAPS = {113.6: 1.6, 148.1: 1.6}


def words():
    T = json.load(open("transcript.json"))
    ws = [w for s in T for w in s["words"] if SRC_IN <= w["s"] < SRC_OUT]
    return [w for w in ws if not any(a <= w["s"] < b for a, b in EXCLUDE)]


def speech_ranges():
    ws = words()
    rs = []
    for w in ws:
        if rs and w["s"] - rs[-1][1] < MERGE_GAP:
            rs[-1][1] = max(rs[-1][1], w["e"])
        else:
            rs.append([w["s"], w["e"]])
    out = []
    for i, (a, b) in enumerate(rs):
        a = max(SRC_IN, a - PAD_IN)
        b = b + PAD_OUT
        if i + 1 < len(rs):
            b = min(b, rs[i + 1][0] - 0.05)
        out.append([a, b])
    return out


def plan_at(t):
    for a, b, f in PLAN:
        if a <= t < b:
            return f, a
    return "MED", 0


def clips():
    res, prev_seg, alt = [], None, False
    for a, b in speech_ranges():
        # quebra o trecho nas fronteiras do plano
        cuts = sorted({a, b, *[p for s, e, _ in PLAN for p in (s, e) if a + 0.5 < p < b - 0.5]})
        for x, y in zip(cuts, cuts[1:]):
            if y - x < 0.08:
                continue
            f, seg = plan_at(x + 0.01)
            if seg != prev_seg:
                alt, prev_seg = False, seg
            elif f in ALT and x == a:     # jump cut dentro do mesmo bloco
                alt = not alt
            res.append({"src": x, "dur": y - x, "frame": ALT[f] if (alt and f in ALT) else f})
    for g, d in GAPS.items():
        i = next(k for k, c in enumerate(res) if c["src"] is not None and c["src"] <= g < c["src"] + c["dur"])
        c = res[i]
        tail = {"src": g, "dur": c["src"] + c["dur"] - g, "frame": plan_at(g)[0]}
        c["dur"] = g - c["src"]
        res[i + 1:i + 1] = [{"src": None, "dur": d, "frame": "GAP"}, tail]
    for c in res:
        c["dur"] = round(c["dur"] * 30) / 30
    t = 0.0
    for c in res:
        c["out"] = t
        t += c["dur"]
    return res


def to_out(src, cl):
    """Converte tempo-fonte em tempo-saída (usa o clipe que contém ou o próximo)."""
    for c in cl:
        if c["src"] is None:
            continue
        if src < c["src"]:
            return c["out"]
        if src < c["src"] + c["dur"]:
            return c["out"] + (src - c["src"])
    last = [c for c in cl if c["src"] is not None][-1]
    return last["out"] + last["dur"]


if __name__ == "__main__":
    cl = clips()
    for c in cl:
        print(f'{c["out"]:7.2f}  src {c["src"] or 0:7.2f} +{c["dur"]:5.2f}  {c["frame"]}')
    print("total", round(cl[-1]["out"] + cl[-1]["dur"], 2), "clips", len(cl))
    json.dump(cl, open("clips.json", "w"), indent=1)
