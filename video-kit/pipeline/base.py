import json, subprocess, os
from edl import CROPS
cl = json.load(open("clips.json"))
os.makedirs("base2", exist_ok=True)
lst = open("base2/list.txt", "w")
for i, c in enumerate(cl):
    d = c["dur"]
    if c["src"] is None:
        lst.write(f"file 'c{i:03d}.mov'\n")
        subprocess.run(["ffmpeg","-loglevel","error","-y","-f","lavfi","-i","color=black:s=1920x1080:r=30","-f","lavfi","-i","anullsrc=r=48000:cl=stereo",
            "-frames:v",str(round(d*30)),"-t",f"{d:.3f}","-c:v","libx264","-crf","16","-pix_fmt","yuv420p","-c:a","pcm_s16le",f"base2/c{i:03d}.mov"],check=True)
        continue
    x, y, w, h = CROPS[c["frame"]]
    out = f"base2/c{i:03d}.mov"
    lst.write(f"file 'c{i:03d}.mov'\n")
    if os.path.exists(out): continue
    d = c["dur"]
    vf = f"crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos,fps=30,"+open("grade.txt").read().strip()+",format=yuv420p"
    af = f"afade=t=in:d=0.015,afade=t=out:st={d-0.02:.3f}:d=0.02"
    subprocess.run(["ffmpeg","-loglevel","error","-y","-ss",f'{c["src"]:.3f}',"-i","raw.mov","-t",f"{d:.3f}",
        "-vf",vf,"-frames:v",str(round(d*30)),"-af",af,"-c:v","libx264","-preset","fast","-crf","16","-c:a","pcm_s16le","-ar","48000","-ac","2",
        out], check=True)
lst.close()
