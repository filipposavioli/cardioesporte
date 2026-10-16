import json, subprocess
iv=json.load(open('intervals.json'))
D=207.6667
args=['ffmpeg','-loglevel','error','-y','-i','base.mov']
fc=[]; last='0:v'
for k,(n,(a,b)) in enumerate(iv.items(),1):
    args+=['-itsoffset',f'{round(a*30)/30:.4f}','-i',f'ov_{n}.mov']
    fc.append(f'[{last}][{k}:v]overlay=0:0:eof_action=pass:repeatlast=0[v{k}]'); last=f'v{k}'
fc.append(f'[{last}]fade=t=out:st={D-0.3:.2f}:d=0.3,format=yuv420p[vout]')
fc.append(f'[0:a]highpass=f=80,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st={D-0.3:.2f}:d=0.3,aresample=48000[aout]')
args+=['-filter_complex',';'.join(fc),'-map','[vout]','-map','[aout]','-c:v','libx264','-preset','medium','-crf','17','-c:a','pcm_s16le','comp.mov']
subprocess.run(args,check=True)
subprocess.run(['ffmpeg','-loglevel','error','-y','-i','comp.mov','-i','endcard.mov','-filter_complex',
  f'[0:a]apad=whole_dur={D}[a0];[0:v][a0][1:v][1:a]concat=n=2:v=1:a=1[v][a]','-map','[v]','-map','[a]',
  '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',
  'amostra_zona2_youtube.mp4'],check=True)
