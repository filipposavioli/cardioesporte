"use client";
import { arc, pie } from "d3";
import type { DadosPaciente, Status } from "@/lib/dados";
import Link from "next/link";
import { Pattern } from "@/components/marca/Pattern";
import { Simbolo } from "@/components/marca/Simbolo";
import { Wordmark } from "@/components/marca/Wordmark";
import { usePainel } from "./contexto";
import { COR, dataBR, dfmt, esc } from "./util";

type Props = {
  paciente: DadosPaciente;
  resumo: { status: Status; n: number }[];
  atualizadoEm: string;
  acaoSair?: (fd: FormData) => void | Promise<void>;
  onStatus: (st: Status) => void;
};

const CLS: Record<Status, string> = { "Tudo certo": "d-ok", "Atenção": "d-at", "Prioridade": "d-pr" };

export function Hero({ paciente, resumo, atualizadoEm, acaoSair, onStatus }: Props) {
  const { mostrarTip, esconderTip } = usePainel();
  const tot = resumo.reduce((s, d) => s + d.n, 0);
  const ok = resumo.find((d) => d.status === "Tudo certo")?.n ?? 0;

  const S = 240, R = S / 2;
  const fatias = pie<{ status: Status; n: number }>().sort(null).value((d) => d.n).padAngle(0.035)(
    resumo.filter((d) => d.n > 0),
  );
  const a = arc<(typeof fatias)[number]>().innerRadius(R * 0.74).outerRadius(R * 0.96).cornerRadius(6);

  return (
    <header className="sc-hero" id="topo">
      <div className="sc-pat" aria-hidden="true">
        <Pattern cols={7} rows={5} cor="#ade736" assinatura={false} />
      </div>
      <div className="sc-bar">
        <span className="sc-upd">Atualizado em {dataBR(atualizadoEm)}</span>
        <Link className="sc-btn" href="/enviar">
          Enviar exame
        </Link>
        {acaoSair && (
          <form action={acaoSair}>
            <button className="sc-sair" type="submit">
              Sair
            </button>
          </form>
        )}
      </div>
      <div className="sc-hero-in">
        <div className="sc-hero-l">
          <div className="sc-brand">
            <Simbolo altura={40} cor="#ade736" />
            <span className="sc-wm">
              <Wordmark altura={22} cor="#ffffff" />
            </span>
          </div>
          <p className="sc-kicker">painel de saúde</p>
          <h1 className="sc-name">{paciente.nome}</h1>
          <p className="sc-meta">
            <span>{paciente.periodo}</span> · última coleta <span>{dfmt(paciente.ultima_coleta)}</span>
          </p>
          <p className="sc-take" id="sc-take">
            A maioria dos seus exames está em ordem: <b>{`${ok} de ${tot}`}</b>
            {" dentro do esperado. " + (paciente.foco || "")}
          </p>
          <p className="sc-method">
            <span>Avaliar</span>
            <span>Medir</span>
            <span>Interpretar</span>
            <span>Orientar</span>
            <span>Acompanhar</span>
          </p>
        </div>
        <div className="sc-hero-r">
          <div className="sc-donut" id="sc-donut">
            <svg viewBox={`${-R} ${-R} ${S} ${S}`} role="img" aria-label={`${ok} de ${tot} exames em ordem`}>
              <circle r={R * 0.85} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={R * 0.22} />
              {fatias.map((d) => (
                <path
                  key={d.data.status}
                  d={a(d) ?? undefined}
                  fill={COR[d.data.status]}
                  style={{ cursor: "pointer" }}
                  onMouseMove={(ev) =>
                    mostrarTip(ev, `<span>${esc(d.data.status)}</span><b>${d.data.n}</b> de ${tot} exames`)
                  }
                  onMouseLeave={esconderTip}
                  onClick={() => onStatus(d.data.status)}
                />
              ))}
              <text className="c-n" textAnchor="middle" y={14} fontSize={64}>
                {ok}
              </text>
              <text className="c-t" textAnchor="middle" y={42} fontSize={15}>
                {`de ${tot} em ordem`}
              </text>
            </svg>
          </div>
          <div className="sc-legend">
            {resumo.map((r) => (
              <button key={r.status} className="sc-lg" type="button" onClick={() => onStatus(r.status)}>
                <i className={CLS[r.status]}></i>
                {r.status} <b>{r.n}</b>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
