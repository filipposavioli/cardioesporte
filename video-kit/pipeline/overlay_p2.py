"""Gráficos da segunda parte (zona 3 em diante) + animação de curtir/inscrever.
Componentes reutilizáveis: panel, btitle, chap, likesub. Tempos em segundos do arquivo bruto (convertidos por T)."""

CSS = """
.btitle { position:absolute; left:0; right:0; bottom:110px; text-align:center; }
.btitle .a { font-size:46px; font-weight:800; text-transform:uppercase; text-shadow:0 2px 20px rgba(0,0,0,.6); }
.btitle .box { font-size:76px; margin-top:10px; }
.btitle .b { font-size:34px; font-weight:700; margin-top:16px; text-shadow:0 2px 16px rgba(0,0,0,.7); }
.chap .q { font-size:120px; font-weight:900; letter-spacing:-4px; line-height:1.02; text-align:center; text-transform:uppercase; }
.chap .q span { color:var(--verde); }
.panel .note { font-size:20px; color:var(--cinza); opacity:.75; margin-top:22px; }
.panel .li > div span { color:var(--verde); }
.panel .li.hl { background:var(--verde); color:var(--petroleo); border-radius:14px; padding:14px 18px; margin-left:-18px; margin-right:-18px; }
.panel .li.hl b { background:var(--petroleo); color:var(--verde); }
.panel .li.hl span { color:var(--petroleo); text-decoration:underline; }
.panel .claim { font-size:44px; font-weight:800; line-height:1.15; margin-top:16px; position:relative; }
.panel .claim .x { position:absolute; left:-6px; right:-6px; top:48%; height:7px; background:#e5484d; border-radius:4px; transform-origin:left; }
.panel .stamp { display:inline-block; margin-top:22px; font-size:34px; font-weight:900; color:#e5484d; border:4px solid #e5484d; border-radius:10px; padding:4px 16px; transform:rotate(-4deg); }
.panel .tag.red { color:#e5484d; } .panel .tag.red i { background:#e5484d; }
.fuel { margin-top:26px; }
.fuel .row { display:flex; align-items:center; gap:18px; margin-top:18px; font-size:28px; font-weight:700; }
.fuel .row label { width:200px; }
.fuel .track { flex:1; height:40px; border-radius:10px; background:rgba(255,255,255,.08); overflow:hidden; }
.fuel .bar { height:100%; border-radius:10px; }
.fuel .fat .bar { background:var(--cinza); }
.fuel .carb .bar { background:var(--verde); }
@keyframes fatDown { from { width:55% } to { width:22% } }
@keyframes carbUp  { from { width:45% } to { width:78% } }
.big { font-size:120px; font-weight:900; color:var(--verde); letter-spacing:-3px; line-height:1; margin-top:18px; }
.big small { font-size:40px; color:#fff; letter-spacing:0; margin-left:12px; }
.cmp { display:flex; gap:22px; margin-top:22px; }
.cmp .c { flex:1; border-radius:18px; padding:24px 26px; background:rgba(255,255,255,.07); border:2px solid rgba(255,255,255,.12); }
.cmp .c.on { background:var(--verde); color:var(--petroleo); border-color:var(--verde); }
.cmp .c small { display:block; font-size:22px; font-weight:800; letter-spacing:3px; text-transform:uppercase; opacity:.8; }
.cmp .c strong { display:block; font-size:54px; font-weight:900; letter-spacing:-1px; margin-top:4px; }
.cmp .c p { font-size:24px; font-weight:700; margin-top:10px; line-height:1.3; }
.dist .row { margin-top:22px; }
.dist .row label { display:block; font-size:28px; font-weight:700; margin-bottom:10px; }
.dist .bar { height:44px; border-radius:10px; transform-origin:left; }

/* curtir / inscrever */
.lsw { position:absolute; display:flex; }
.ls { position:relative; display:flex; gap:20px; align-items:center; }
.ls .pill { display:flex; align-items:center; gap:14px; height:84px; padding:0 30px; border-radius:999px;
            font-size:32px; font-weight:800; color:#fff; background:rgba(2,27,58,.92); border:2px solid rgba(255,255,255,.18);
            box-shadow:0 18px 50px rgba(0,0,0,.45); position:relative; }
.ls svg { width:40px; height:40px; }
.ls .sub { background:var(--verde); color:var(--petroleo); border-color:var(--verde); min-width:300px; justify-content:center; }
.ls .sub .s2 { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:10px;
               border-radius:999px; background:var(--grafite); color:#fff; opacity:0; }
.ls .bell { width:84px; padding:0; justify-content:center; }
.ls .cur { position:absolute; left:0; top:0; width:56px; height:56px; filter:drop-shadow(0 6px 10px rgba(0,0,0,.5)); }
@keyframes likeOn { from { background:rgba(2,27,58,.92); color:#fff } to { background:var(--verde); color:var(--petroleo) } }
@keyframes ring { 0%{transform:rotate(0)} 15%{transform:rotate(18deg)} 30%{transform:rotate(-16deg)} 45%{transform:rotate(12deg)} 60%{transform:rotate(-8deg)} 75%{transform:rotate(4deg)} 100%{transform:rotate(0)} }
@keyframes click { 0%{transform:scale(1)} 50%{transform:scale(.8)} 100%{transform:scale(1)} }
@keyframes bump { 0%{transform:scale(1)} 40%{transform:scale(1.12)} 100%{transform:scale(1)} }
"""

THUMB = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.3l1-4.6.03-.32c0-.41-.17-.79-.44-1.06L13.2 1 6.6 7.6C6.2 7.95 6 8.45 6 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>'
BELL = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>'
CURSOR = '<svg viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.8 L11.6 14 L18 14 Z" fill="#fff" stroke="#021B3A" stroke-width="1.4" stroke-linejoin="round"/></svg>'


def build(T):
    iv, css, html = [], [CSS], []

    def a(name, dur, t, ease="var(--ease)"):
        return f"{name} {dur}s {ease} {T(t):.3f}s"

    def sec(id_, s, e, inner, cls="g", fade=False):
        iv.append((id_, s, e))
        anim = f"in .15s linear {T(s):.3f}s, out .2s linear {T(e) - 0.2:.3f}s" if fade else f"out .4s ease {T(e) - 0.4:.3f}s"
        html.append(f'<section class="{cls}" id="{id_}" style="animation:{anim}">{inner}</section>')

    def panel(id_, s, e, tag, title, items, top=200, note=None, extra="", tagcls="", extra_first=False):
        lis = "".join(
            f'<div class="li{" hl" if hl else ""}" style="animation:{a("up", .5, t)}"><b>{b}</b><div>{txt}</div></div>'
            for t, txt, b, hl in items)
        h = f'<h3 style="animation:{a("up", .5, s + .2)}">{title}</h3>' if title else ""
        n = f'<div class="note" style="animation:{a("up", .5, note[0])}">{note[1]}</div>' if note else ""
        sec(id_, s, e, f'<div class="panel" style="top:{top}px; animation:{a("right", .7, s)}">'
                       f'<div class="tag {tagcls}"><i></i>{tag}</div>{h}{extra + lis if extra_first else lis + extra}{n}</div>')

    def btitle(id_, s, e, small=None, box=None, sub=None):
        p = []
        if small: p.append(f'<div class="a" style="animation:{a("up", .5, small[0])}">{small[1]}</div>')
        if box: p.append(f'<div class="box" style="animation:{a("pop", .6, box[0], "var(--pop)")}">{box[1]}</div>')
        if sub: p.append(f'<div class="b" style="animation:{a("up", .5, sub[0])}">{sub[1]}</div>')
        sec(id_, s, e, f'<div class="btitle">{"".join(p)}</div>')

    def chap(id_, s, e, n=None, sub="", q=None):
        bars = ""
        if n:
            bars = '<div class="bars">' + "".join(
                f'<i class="{"on" if k < n else ""}" style="height:{40 + 20 * k}px"></i>' for k in range(6)) + "</div>"
        head = (f'<div class="z" style="animation:{a("pop", .55, s + .05, "var(--pop)")}">ZONA <span>{n}</span></div>' if n
                else f'<div class="q" style="animation:{a("pop", .55, s + .05, "var(--pop)")}">{q}</div>')
        sb = f'<div class="sub" style="animation:{a("up", .45, s + .35)}">{sub}</div>' if sub else ""
        sec(id_, s, e, f'<div class="grid"></div>{head}{sb}{bars}', cls="g chap", fade=True)

    def likesub(id_, s, e, t_like, t_sub, t_bell, pos="left:0; right:0; bottom:90px; justify-content:center"):
        # cursor: wrapper externo entra até o like; interno anda até o "inscreva-se"
        cur = (f'<div style="position:absolute; left:0; top:0; animation:curIn_{id_} .5s var(--ease) {T(t_like) - .55:.3f}s">'
               f'<div style="animation:curMove_{id_} .5s var(--ease) {T(t_sub) - .55:.3f}s">'
               f'<div class="cur" style="animation:click .25s ease {T(t_like) - .05:.3f}s, click .25s ease {T(t_sub) - .05:.3f}s">{CURSOR}</div>'
               f'</div></div>')
        css.append(f"@keyframes curIn_{id_} {{ from {{ transform:translate(260px,180px); opacity:0 }} to {{ transform:translate(150px,40px); opacity:1 }} }}"
                   f"@keyframes curMove_{id_} {{ from {{ transform:translate(0,0) }} to {{ transform:translate(250px,0) }} }}")
        inner = (f'<div class="lsw" style="{pos}"><div class="ls" style="animation:{a("up", .5, s)}">'
                 f'<div class="pill like" style="animation:likeOn .2s ease {T(t_like):.3f}s, bump .35s ease {T(t_like):.3f}s">{THUMB}Gostei</div>'
                 f'<div class="pill sub" style="animation:bump .35s ease {T(t_sub):.3f}s">Inscreva-se'
                 f'<div class="s2" style="animation:in .2s ease {T(t_sub):.3f}s">Inscrito ✓</div></div>'
                 f'<div class="pill bell"><span style="display:flex; animation:ring .9s ease {T(t_bell):.3f}s">{BELL}</span></div>'
                 f'{cur}</div></div>')
        sec(id_, s, e, inner)

    # ---------- ZONA 3 ----------
    chap("ch3", 240.0, 242.0, n=3, sub="Transição")
    panel("z3", 244.0, 275.6, "Zona 3", "Zona de transição", [
        (248.3, "O corpo precisa de energia <span>mais rápido</span> do que a gordura consegue fornecer", "1", False),
        (259.4, "Começa a recrutar as fibras de <span>contração rápida</span>", "2", False),
        (266.6, "Essas fibras precisam de mais <span>ATP</span>, a molécula de energia da célula", "3", False),
        (271.8, "A gordura não entrega energia rápido o suficiente", "4", False),
    ], top=170)
    fuel = (f'<div class="fuel">'
            f'<div class="row fat" style="animation:{a("up", .5, 277.0)}"><label>Gordura</label><div class="track"><div class="bar" style="animation:fatDown 1.6s var(--ease) {T(278.6):.3f}s"></div></div></div>'
            f'<div class="row carb" style="animation:{a("up", .5, 277.2)}"><label>Carboidrato</label><div class="track"><div class="bar" style="animation:carbUp 1.6s var(--ease) {T(282.9):.3f}s"></div></div></div>'
            f'</div>')
    panel("z3f", 276.6, 295.6, "Zona 3 · combustível", "Queda progressiva da gordura", [
        (288.4, "Do predomínio de gordura ao <span>predomínio de carboidrato</span>", "→", True),
    ], top=230, extra=fuel, extra_first=True, note=(277.4, "Representação ilustrativa"))

    # ---------- ZONA 4 ----------
    chap("ch4", 297.6, 299.6, n=4, sub="Limiar de lactato")
    btitle("z4a", 302.1, 308.9, small=(302.1, "Na zona 4"), box=(306.2, "A queima de gordura praticamente desaparece"))
    panel("z4b", 309.0, 320.2, "Zona 4", "Limiar de lactato", [
        (310.5, "Depende quase exclusivamente de <span>carboidrato</span>", "1", False),
        (313.3, "Única forma de gerar ATP na velocidade que o esforço exige", "2", False),
    ], top=280)
    panel("lac", 321.0, 347.3, "Mito", None, [
        (338.5, "O lactato é um <span>subproduto natural e obrigatório</span> do uso da glicose", "✓", False),
        (344.0, "Ele é produzido em <span>qualquer intensidade</span>", "✓", False),
    ], top=170, tagcls="red",
        extra="")
    # claim + carimbo inseridos antes da lista
    html[-1] = html[-1].replace('<div class="tag red"><i></i>Mito</div>',
        f'<div class="tag red"><i></i>Mito</div>'
        f'<div class="claim" style="animation:{a("up", .5, 326.3)}">"O lactato é um vilão que queima o músculo."'
        f'<div class="x" style="animation:{a("wipe", .4, 336.9)}"></div></div>'
        f'<div class="stamp" style="animation:{a("pop", .45, 337.9, "var(--pop)")}">TAMBÉM É MITO</div>')
    panel("lac2", 347.6, 387.6, "O que muda na zona 4", "A quantidade de lactato", [
        (350.3, "O lactato aumenta muito", "1", False),
        (377.2, "As mitocôndrias das fibras lentas, que processam o lactato, ficam <span>sobrecarregadas</span>", "2", False),
        (385.8, "O lactato que sobra <span>escapa para o sangue</span>", "3", True),
    ], top=200)
    btitle("teste", 387.9, 397.4, small=(388.0, "É isso que medimos no"), box=(392.6, "Teste de lactato"), sub=(394.6, "no laboratório ou no campo"))
    big = f'<div class="big" style="animation:{a("pop", .6, 410.8, "var(--pop)")}">15–30<small>minutos</small></div>'
    panel("mlss", 397.7, 413.6, "Limiar de lactato", "Máximo estado estável de lactato", [
        (405.4, "Intensidade muito exigente, sustentada por:", "!", False),
    ], top=250, extra=big)

    # ---------- ZONA 5 ----------
    chap("ch5", 414.0, 416.1, n=5, sub="VO₂ máximo")
    btitle("z5a", 416.7, 427.2, small=(419.4, "Sua capacidade aeróbica máxima"), box=(426.0, "VO₂ máximo"))
    panel("z5b", 427.4, 444.6, "Zona 5", "VO₂ máximo", [
        (428.8, "A gordura <span>não participa mais</span>", "1", False),
        (431.9, "Só carboidrato, com produção enorme de lactato", "2", False),
        (440.8, "Sustentada por <span>2 a 3 minutos</span> no máximo", "3", True),
    ], top=230)

    # ---------- ZONA 6 ----------
    chap("ch6", 445.0, 447.4, n=6, sub="Esforço anaeróbico")
    likesub("ls1", 449.6, 456.0, t_like=451.6, t_sub=453.4, t_bell=454.3,
            pos="left:90px; bottom:80px")
    panel("z6", 456.1, 478.9, "Zona 6", "Esforço anaeróbico", [
        (457.2, "O corpo ultrapassa a capacidade aeróbica máxima", "1", False),
        (469.5, "O músculo usa o <span>ATP já armazenado</span> dentro dele", "2", False),
        (476.4, "Por isso essa zona <span>não depende de oxigênio</span>", "3", False),
    ], top=230)
    btitle("sprint", 479.4, 488.9, small=(479.4, "Sprint máximo"), box=(484.1, "20 a 30 segundos no limite"))

    # ---------- MENSAGEM PRINCIPAL ----------
    chap("chq", 489.5, 492.0, q="Qual zona é a<br><span>mais importante?</span>")
    btitle("meia", 497.8, 508.0, small=(500.6, "“Só treinar zona 2 resolve tudo”"), box=(505.5, "Meia verdade perigosa"))
    panel("z2ok", 508.4, 527.6, "Zona 2 melhora", None, [
        (512.4, "A função <span>mitocondrial</span>", "✓", False),
        (514.2, "A capacidade de <span>limpar lactato</span>", "✓", False),
        (517.1, "A eficiência em <span>usar gordura</span>", "✓", False),
    ], top=250, note=(519.4, "Comprovado em laboratório: oxidação de gordura e clearance de lactato"))
    cmp = (f'<div class="cmp">'
           f'<div class="c" style="animation:{a("up", .5, 532.5)}"><small>Zona 2</small><strong>Base</strong><p>Constrói o motor aeróbico</p></div>'
           f'<div class="c on" style="animation:{a("pop", .5, 535.9, "var(--pop)")}"><small>Zona 4</small><strong>Turbo</strong><p>Acelerar · responder a um esforço decisivo · sustentar picos</p></div>'
           f'</div>')
    panel("turbo", 528.1, 551.8, "Só zona 2?", "Você constrói a base, mas perde o turbo", [], top=230, extra=cmp)
    dist = (f'<div class="dist">'
            f'<div class="row" style="animation:{a("up", .5, 554.9)}"><label>Baixa intensidade · maior parte do volume</label>'
            f'<div class="bar" style="width:100%; background:var(--cinza); animation:{a("wipe", .8, 555.2)}"></div></div>'
            f'<div class="row" style="animation:{a("up", .5, 562.5)}"><label>Alta intensidade · parte significativa e exigente</label>'
            f'<div class="bar" style="width:38%; background:var(--verde); animation:{a("wipe", .8, 563.0)}"></div></div>'
            f'</div>')
    panel("elite", 552.1, 578.3, "Atletas de elite", "Como eles distribuem o treino", [], top=260, extra=dist,
          note=(574.0, "Representação ilustrativa"))
    btitle("acel", 578.5, 584.6, small=(578.6, "Sem alta intensidade"), box=(580.9, "A capacidade de acelerar desaparece"))

    # ---------- RESUMO ----------
    chap("chr", 584.9, 586.5, q="<span>Resumo</span>")
    panel("resumo", 586.6, 614.6, "Resumo", None, [
        (587.6, "Cada zona estimula um <span>sistema energético</span> diferente", "1", False),
        (592.6, "E recruta <span>fibras musculares</span> diferentes", "2", False),
        (596.4, "Não existe <span>zona mágica</span> que resolve tudo", "3", False),
        (600.6, "O segredo: entender o que cada intensidade provoca no seu corpo, seja por performance ou por saúde e longevidade", "4", True),
    ], top=200)

    # ---------- CTA final (sincronizado com a fala) ----------
    likesub("ls2", 615.8, 630.4, t_like=622.6, t_sub=627.7, t_bell=628.6)

    return iv, "\n".join(css), "\n".join(html)
