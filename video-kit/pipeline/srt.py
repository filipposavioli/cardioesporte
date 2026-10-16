"""Legendas SRT no tempo editado, com correções de transcrição."""
import json
from edl import words, to_out
cl = json.load(open("clips.json"))
FIX = {"Inigo": "Iñigo", "Samilan,": "San-Millán,", "lipar": "limpar", "mitocôndrial.": "mitocondrial.", "VO2": "VO₂"}
ws = []
for w in words():
    t = FIX.get(w["w"].strip(), w["w"].strip())
    if t == "de" and ws and ws[-1][2] == "capacidade" and w["s"] > 217: continue
    if t == "%" and ws: ws[-1] = (ws[-1][0], to_out(w["e"], cl), ws[-1][2] + "%"); continue
    ws.append((to_out(w["s"], cl), to_out(w["e"], cl), t))
lines, cur = [], []
for a, b, t in ws:
    txt = " ".join(x[2] for x in cur + [(a, b, t)])
    if cur and (len(txt) > 42 or b - cur[0][0] > 3.8 or a - cur[-1][1] > 0.6 or (len(txt) > 24 and cur[-1][2][-1] == ",")):
        lines.append(cur); cur = []
    cur.append((a, b, t))
    if t[-1] in ".?!": lines.append(cur); cur = []
if cur: lines.append(cur)
def ts(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
with open("amostra_zona2_youtube.srt", "w") as f:
    for i, l in enumerate(lines, 1):
        en = l[-1][1] + 0.15
        if i < len(lines): en = min(en, lines[i][0][0] - 0.02)
        f.write(f"{i}\n{ts(l[0][0])} --> {ts(en)}\n{' '.join(x[2] for x in l)}\n\n")
