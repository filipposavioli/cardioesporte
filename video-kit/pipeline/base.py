import json, subprocess, os
from edl import CROPS
cl = json.load(open("clips.json"))
os.makedirs("base", exist_ok=True)
lst = open("base/list.txt", "w")
for i, c in enumerate(cl):
    x, y, w, h = CROPS[c["frame"]]
    out = f"base/c{i:03d}.mov"
    lst.write(f"file 'c{i:03d}.mov'\n")
    if os.path.exists(out): continue
    d = c["dur"]
    vf = f"crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos,fps=30,eq=contrast=1.04:saturation=1.05,format=yuv420p"
    af = f"afade=t=in:d=0.015,afade=t=out:st={d-0.02:.3f}:d=0.02"
    subprocess.run(["ffmpeg","-loglevel","error","-y","-ss",f'{c["src"]:.3f}',"-i","raw.mov","-t",f"{d:.3f}",
        "-vf",vf,"-frames:v",str(round(d*30)),"-af",af,"-c:v","libx264","-preset","fast","-crf","16","-c:a","pcm_s16le","-ar","48000","-ac","2",
        out], check=True)
lst.close()
