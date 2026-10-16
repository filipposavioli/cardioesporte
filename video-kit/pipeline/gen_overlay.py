"""Gera overlay.html (gráficos com tempos da linha do tempo editada) e intervals.json."""
import json
from edl import to_out

cl = json.load(open("clips.json"))
T = lambda src: round(to_out(src, cl), 3)

# (nome, início-fonte, fim-fonte) — cada intervalo vira um clipe de overlay
IV = [
    ("hook",    11.45, 15.40),
    ("lt",      43.40, 50.00),
    ("vagos",   57.60, 70.20),
    ("inigo",   75.90, 87.40),
    ("fabrica", 97.55, 107.40),
    ("ch1",    112.20, 114.05),
    ("z1",     114.05, 145.60),
    ("ch2",    146.70, 148.25),
    ("mito",   159.90, 180.00),
    ("fatmax", 182.60, 189.60),
    ("mitoc",  193.56, 219.10),
    ("melhora",219.30, 230.30),
    ("punch",  232.20, 239.40),
]
iv = {n: (T(a), T(b)) for n, a, b in IV}
s = lambda n: iv[n][0]
e = lambda n: iv[n][1]

html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
:root {{ --verde:#9FC742; --azul:#006C92; --cinza:#BDBEC0; --grafite:#1C1D21; --petroleo:#021B3A;
        --ease:cubic-bezier(.2,.8,.2,1); --pop:cubic-bezier(.3,1.5,.5,1); }}
* {{ margin:0; padding:0; box-sizing:border-box; animation-fill-mode:both !important; }}
html, body {{ width:1920px; height:1080px; overflow:hidden; background:transparent;
       font-family:'Inter Display','Inter',sans-serif; color:#fff; }}
.g {{ position:absolute; inset:0; }}
@keyframes in   {{ from {{ opacity:0 }} to {{ opacity:1 }} }}
@keyframes out  {{ to {{ opacity:0 }} }}
@keyframes up   {{ from {{ opacity:0; transform:translateY(24px) }} to {{ opacity:1; transform:none }} }}
@keyframes left {{ from {{ opacity:0; transform:translateX(-60px) }} to {{ opacity:1; transform:none }} }}
@keyframes right{{ from {{ opacity:0; transform:translateX(80px) }} to {{ opacity:1; transform:none }} }}
@keyframes pop  {{ from {{ opacity:0; transform:scale(.4) }} to {{ opacity:1; transform:scale(1) }} }}
@keyframes wipe {{ from {{ transform:scaleX(0) }} to {{ transform:scaleX(1) }} }}
@keyframes grow {{ from {{ transform:scaleY(0) }} to {{ transform:scaleY(1) }} }}
@keyframes toDark {{ from {{ color:#fff }} to {{ color:var(--petroleo) }} }}

.box {{ display:inline-block; background:var(--verde); color:var(--petroleo); font-weight:900;
        text-transform:uppercase; letter-spacing:-1px; border-radius:8px; padding:6px 22px 10px; }}
.panel {{ position:absolute; right:90px; width:720px; background:rgba(2,27,58,.90);
          border:2px solid rgba(255,255,255,.12); border-radius:22px; padding:40px 44px;
          box-shadow:0 30px 80px rgba(0,0,0,.45); }}
.tag {{ font-size:22px; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:var(--verde);
        display:flex; align-items:center; gap:12px; }}
.tag i {{ width:12px; height:12px; border-radius:50%; background:var(--verde); }}
.panel h3 {{ font-size:46px; font-weight:900; letter-spacing:-1px; margin:14px 0 22px; line-height:1.05; }}
.li {{ display:flex; gap:18px; align-items:flex-start; font-size:32px; font-weight:600; line-height:1.25;
       margin-top:20px; color:#fff; }}
.li b {{ flex:none; width:38px; height:38px; border-radius:10px; background:var(--verde); color:var(--petroleo);
         display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:900; margin-top:2px; }}
.src {{ font-size:18px; color:var(--cinza); opacity:.8; margin-top:24px; }}

/* hook */
#hook .stack {{ position:absolute; left:110px; top:300px; display:flex; flex-direction:column; gap:22px; align-items:flex-start; }}
#hook .box {{ font-size:72px; }}
#hook {{ animation:out .3s ease {e('hook')-0.3}s; }}

/* lower third */
#lt {{ animation:out .4s ease {e('lt')-0.4}s; }}
#lt .wrap {{ position:absolute; left:70px; bottom:96px; display:flex; padding:18px 40px 20px 30px; border-radius:16px; background:rgba(2,27,58,.88); animation:in .3s ease {s('lt')}s; }}
#lt .bar {{ width:10px; background:var(--verde); border-radius:3px; transform-origin:bottom; animation:grow .5s var(--ease) {s('lt')}s; }}
#lt .nm {{ margin-left:20px; overflow:hidden; }}
#lt .n {{ font-size:56px; font-weight:900; letter-spacing:-1px; text-shadow:0 2px 20px rgba(0,0,0,.5); animation:up .6s var(--ease) {s('lt')+0.15}s; }}
#lt .c {{ font-size:30px; font-weight:600; margin-top:4px; text-shadow:0 2px 14px rgba(0,0,0,.6); animation:up .6s var(--ease) {s('lt')+0.3}s; }}
#lt .c b {{ color:var(--verde); }}

/* termos vagos */
#vagos {{ animation:out .4s ease {e('vagos')-0.4}s; }}
#vagos .cards {{ position:absolute; right:110px; top:230px; width:680px; display:flex; flex-direction:column; gap:28px; }}
.mini {{ position:relative; background:rgba(2,27,58,.9); border:2px solid rgba(255,255,255,.14); border-radius:20px; padding:26px 36px; }}
.mini small {{ display:block; font-size:22px; color:var(--cinza); font-weight:600; letter-spacing:1px; text-transform:uppercase; }}
.mini strong {{ font-size:64px; font-weight:900; letter-spacing:-1px; }}
.mini .x {{ position:absolute; left:24px; right:24px; top:54%; height:8px; background:#e5484d; border-radius:4px; transform-origin:left; }}
#v1 {{ animation:right .6s var(--ease) {T(57.75)}s; }}
#v2 {{ animation:right .6s var(--ease) {T(61.55)}s; }}
#v1 .x {{ animation:wipe .35s var(--ease) {T(65.15)}s; }}
#v2 .x {{ animation:wipe .35s var(--ease) {T(65.35)}s; }}
#vagos .q {{ font-size:40px; font-weight:800; line-height:1.15; background:rgba(2,27,58,.92); border-radius:20px; padding:24px 36px; animation:up .5s var(--ease) {T(66.5)}s; }}
#vagos .q span {{ color:var(--verde); }}

/* San-Millán */
#inigo {{ animation:out .4s ease {e('inigo')-0.4}s; }}
#inigo .panel {{ top:260px; animation:right .7s var(--ease) {s('inigo')}s; }}
#inigo .li {{ animation:up .5s var(--ease) {T(77.5)}s; }}
#inigo .li + .li {{ animation-delay:{T(79.5)}s; }}

/* fábrica */
#fabrica {{ animation:out .4s ease {e('fabrica')-0.4}s; }}
#fabrica .t {{ position:absolute; left:0; right:0; bottom:120px; text-align:center; }}
#fabrica .a {{ font-size:44px; font-weight:800; text-transform:uppercase; text-shadow:0 2px 20px rgba(0,0,0,.6); animation:up .5s var(--ease) {s('fabrica')}s; }}
#fabrica .box {{ font-size:96px; margin-top:10px; animation:pop .6s var(--pop) {T(99.3)}s; }}
#fabrica .b {{ font-size:34px; font-weight:700; margin-top:18px; text-shadow:0 2px 16px rgba(0,0,0,.7); animation:up .5s var(--ease) {T(104.2)}s; }}

/* capítulos */
.chap {{ background:radial-gradient(ellipse 70% 70% at 50% 50%, #06284a 0%, #000 100%);
         display:flex; flex-direction:column; align-items:center; justify-content:center; }}
.chap .grid {{ position:absolute; inset:0; opacity:.10;
         background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px); background-size:64px 64px; }}
.chap .z {{ font-size:220px; font-weight:900; letter-spacing:-8px; line-height:1; }}
.chap .z span {{ color:var(--verde); }}
.chap .sub {{ font-size:44px; font-weight:700; color:var(--cinza); margin-top:10px; text-transform:uppercase; letter-spacing:6px; }}
.chap .bars {{ display:flex; gap:14px; margin-top:44px; align-items:flex-end; }}
.chap .bars i {{ width:56px; border-radius:6px; background:rgba(255,255,255,.15); }}
.chap .bars i.on {{ background:var(--verde); box-shadow:0 0 30px rgba(159,199,66,.7); }}
#ch1 {{ animation:in .15s linear {s('ch1')}s, out .2s linear {e('ch1')-0.2}s; }}
#ch2 {{ animation:in .15s linear {s('ch2')}s, out .2s linear {e('ch2')-0.2}s; }}
#ch1 .z, #ch2 .z {{ animation:pop .55s var(--pop) 0s; }}
#ch1 .z {{ animation-delay:{s('ch1')+0.05}s; }} #ch2 .z {{ animation-delay:{s('ch2')+0.05}s; }}
#ch1 .sub {{ animation:up .45s var(--ease) {s('ch1')+0.35}s; }} #ch2 .sub {{ animation:up .45s var(--ease) {s('ch2')+0.35}s; }}

/* zona 1 painel */
#z1 {{ animation:out .4s ease {e('z1')-0.4}s; }}
#z1 .panel {{ top:170px; animation:right .7s var(--ease) {s('z1')}s; }}
#z1 .li:nth-child(3) {{ animation:up .5s var(--ease) {T(116.0)}s; }}
#z1 .li:nth-child(4) {{ animation:up .5s var(--ease) {T(124.3)}s; }}
#z1 .li:nth-child(5) {{ animation:up .5s var(--ease) {T(129.8)}s; }}
#z1 .li:nth-child(6) {{ animation:up .5s var(--ease) {T(139.8)}s; }}
#z1 .li:nth-child(7) {{ animation:up .5s var(--ease) {T(141.4)}s; }}

/* mito */
#mito {{ animation:out .4s ease {e('mito')-0.4}s; }}
#mito .panel {{ top:230px; animation:right .7s var(--ease) {s('mito')}s; }}
#mito .tag {{ color:#e5484d; }} #mito .tag i {{ background:#e5484d; }}
#mito .claim {{ font-size:46px; font-weight:800; line-height:1.15; margin-top:16px; position:relative; animation:up .5s var(--ease) {T(163.2)}s; }}
#mito .claim .x {{ position:absolute; left:-6px; right:-6px; top:48%; height:7px; background:#e5484d; border-radius:4px; transform-origin:left; animation:wipe .4s var(--ease) {T(170.6)}s; }}
#mito .stamp {{ display:inline-block; margin-top:22px; font-size:34px; font-weight:900; color:#e5484d; border:4px solid #e5484d; border-radius:10px; padding:4px 16px; transform:rotate(-4deg); animation:pop .45s var(--pop) {T(170.6)}s; }}
#mito .fato {{ margin-top:28px; font-size:30px; font-weight:700; color:var(--cinza); animation:up .5s var(--ease) {T(177.6)}s; }}
#mito .fato .box {{ font-size:44px; text-transform:none; letter-spacing:-.5px; margin-top:10px; }}

/* fatmax */
#fatmax {{ animation:out .4s ease {e('fatmax')-0.4}s; }}
#fatmax .t {{ position:absolute; left:0; right:0; bottom:110px; text-align:center; }}
#fatmax .a {{ font-size:40px; font-weight:800; text-transform:uppercase; text-shadow:0 2px 20px rgba(0,0,0,.6); animation:up .5s var(--ease) {s('fatmax')}s; }}
#fatmax .box {{ font-size:70px; margin-top:10px; animation:pop .6s var(--pop) {T(184.2)}s; }}

/* mitocôndria (painel lateral) */
#mitoc {{ animation:out .4s ease {e('mitoc')-0.4}s; }}
#mitoc .panel {{ top:150px; width:760px; animation:right .7s var(--ease) {s('mitoc')}s; }}
#mitoc .li {{ font-size:34px; margin-top:26px; }}
#mitoc .li span {{ color:var(--verde); }}
#mitoc .li:nth-child(2) {{ animation:up .5s var(--ease) {T(193.7)}s; }}
#mitoc .li:nth-child(3) {{ animation:up .5s var(--ease) {T(201.6)}s; }}
#mitoc .li:nth-child(4) {{ animation:up .5s var(--ease) {T(212.4)}s; }}
#mitoc .li.hl {{ background:var(--verde); color:var(--petroleo); border-radius:14px; padding:14px 18px; margin-left:-18px; margin-right:-18px; }}
#mitoc .li.hl b {{ background:var(--petroleo); color:var(--verde); }}
#mitoc .li.hl span {{ color:var(--petroleo); text-decoration:underline; }}

/* melhora */
#melhora {{ animation:out .4s ease {e('melhora')-0.4}s; }}
#melhora .panel {{ top:300px; animation:right .7s var(--ease) {s('melhora')}s; }}
#melhora .li:nth-child(2) {{ animation:up .5s var(--ease) {T(222.0)}s; }}
#melhora .li:nth-child(3) {{ animation:up .5s var(--ease) {T(227.7)}s; }}

/* punch */
#punch {{ animation:out .4s ease {e('punch')-0.4}s; }}
#punch .t {{ position:absolute; left:0; right:0; bottom:120px; text-align:center; }}
#punch .a {{ font-size:64px; font-weight:900; text-transform:uppercase; letter-spacing:-1px; text-shadow:0 2px 24px rgba(0,0,0,.6); animation:up .5s var(--ease) {T(232.3)}s; }}
#punch .box {{ font-size:72px; margin-top:12px; animation:pop .6s var(--pop) {T(235.75)}s; }}
</style></head><body>

<section class="g" id="hook"><div class="stack">
  <div class="box" style="animation:left .45s var(--ease) {T(11.5)}s">Zona 2</div>
  <div class="box" style="animation:left .45s var(--ease) {T(12.35)}s">Zona 4</div>
  <div class="box" style="animation:left .45s var(--ease) {T(13.85)}s">Limiar de lactato</div>
</div></section>

<section class="g" id="lt"><div class="wrap"><div class="bar"></div><div class="nm">
  <div class="n">Dr. Filippo Savioli</div>
  <div class="c">Cardiologia do Esporte · <b>CRM-SP 151.154</b></div>
</div></div></section>

<section class="g" id="vagos"><div class="cards">
  <div class="mini" id="v1"><small>"Treine entre"</small><strong>120–140 bpm</strong><div class="x"></div></div>
  <div class="mini" id="v2"><small>"Fique em"</small><strong>65% do VO₂ máx</strong><div class="x"></div></div>
  <div class="q">Não diz o que acontece <span>dentro do seu corpo.</span></div>
</div></section>

<section class="g" id="inigo"><div class="panel">
  <div class="tag"><i></i>Referência</div>
  <h3>Prof. Iñigo San-Millán, PhD</h3>
  <div class="li"><b>✓</b>Fisiologista de atletas de elite</div>
  <div class="li"><b>✓</b>Mais de 30 anos estudando metabolismo</div>
</div></section>

<section class="g" id="fabrica"><div class="t">
  <div class="a">Seu corpo é uma</div>
  <div class="box">Fábrica de energia</div>
  <div class="b">que muda o jeito de trabalhar conforme a intensidade</div>
</div></section>

<section class="g chap" id="ch1"><div class="grid"></div>
  <div class="z">ZONA <span>1</span></div><div class="sub">Recuperação</div>
  <div class="bars"><i class="on" style="height:40px"></i><i style="height:60px"></i><i style="height:80px"></i><i style="height:100px"></i><i style="height:120px"></i><i style="height:140px"></i></div>
</section>

<section class="g" id="z1"><div class="panel">
  <div class="tag"><i></i>Zona 1</div>
  <h3>Intensidade muito leve</h3>
  <div class="li"><b>1</b>Caminhada bem devagar</div>
  <div class="li"><b>2</b>Um pouco de gordura + um pouco de glicose</div>
  <div class="li"><b>3</b>Praticamente não gera lactato</div>
  <div class="li"><b>4</b>Usada em dias de recuperação</div>
  <div class="li"><b>5</b>Fibras sem estresse metabólico</div>
</div></section>

<section class="g chap" id="ch2"><div class="grid"></div>
  <div class="z">ZONA <span>2</span></div><div class="sub">Base aeróbica</div>
  <div class="bars"><i class="on" style="height:40px"></i><i class="on" style="height:60px"></i><i style="height:80px"></i><i style="height:100px"></i><i style="height:120px"></i><i style="height:140px"></i></div>
</section>

<section class="g" id="mito"><div class="panel">
  <div class="tag"><i></i>Mito</div>
  <div class="claim">"Em baixa intensidade você não queima carboidrato, só gordura."<div class="x"></div></div>
  <div class="stamp">NÃO É VERDADE</div>
  <div class="fato">O que muda é…<br><span class="box">a proporção de cada combustível</span></div>
</div></section>

<section class="g" id="fatmax"><div class="t">
  <div class="a">Zona 2 =</div>
  <div class="box">Taxa máxima de queima de gordura</div>
</div></section>

<section class="g" id="mitoc"><div class="panel">
  <div class="tag"><i></i>Por que a zona 2 é tão importante</div>
  <div class="li"><b>1</b><div>A gordura só é queimada dentro da <span>mitocôndria</span>, a usina de energia da célula</div></div>
  <div class="li"><b>2</b><div>Fibras de <span>contração lenta</span>, as mais recrutadas na zona 2, têm mais mitocôndrias</div></div>
  <div class="li hl"><b>3</b><div>Treinar zona 2 = treinar sua <span>capacidade mitocondrial</span></div></div>
</div></section>

<section class="g" id="melhora"><div class="panel">
  <div class="tag"><i></i>Na zona 2 você melhora</div>
  <div class="li"><b>✓</b>A eficiência em limpar o lactato</div>
  <div class="li"><b>✓</b>O uso de gordura como combustível</div>
</div></section>

<section class="g" id="punch"><div class="t">
  <div class="a">Zona 2 é fundamental…</div>
  <div class="box">mas sozinha não é suficiente</div>
</div></section>
</body></html>"""

open("overlay.html", "w").write(html)
json.dump(iv, open("intervals.json", "w"), indent=1)
for k, (a, b) in iv.items():
    print(f"{k:8s} {a:7.2f} {b:7.2f}")
