"use client";
import "./painel.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Painel as DadosPainel, Status } from "@/lib/dados";
import { resumo, sistemas, temMotor } from "@/lib/painel-calc";
import { PainelCtx, type PontoTela } from "./contexto";
import { Evolucao } from "./Evolucao";
import { Foco } from "./Foco";
import { Hero } from "./Hero";
import { Mapa } from "./Mapa";
import { Motor } from "./Motor";
import { Plano } from "./Plano";
import { Rodape } from "./Rodape";
import { Tabela } from "./Tabela";

type Props = {
  dados: DadosPainel;
  /** Data (ou timestamp ISO) da publicação do painel. */
  atualizadoEm: string;
  /** Server action do botão "Sair". Sem ela, o botão não aparece. */
  acaoSair?: (fd: FormData) => void | Promise<void>;
};

export function Painel({ dados, atualizadoEm, acaoSair }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [filtro, setFiltro] = useState<Status | "">("");
  const [sistemaF, setSistemaF] = useState("");
  const [busca, setBusca] = useState("");
  const [versao, setVersao] = useState(0);

  const res = useMemo(() => resumo(dados.marcadores), [dados.marcadores]);
  const sis = useMemo(() => sistemas(dados.marcadores), [dados.marcadores]);

  const mostrarTip = useCallback((ev: PontoTela, html: string) => {
    const root = rootRef.current, tip = tipRef.current;
    if (!root || !tip) return;
    const r = root.getBoundingClientRect();
    tip.innerHTML = html;
    tip.hidden = false;
    let x = ev.clientX - r.left + 14;
    const y = ev.clientY - r.top + 14;
    if (x + tip.offsetWidth > root.clientWidth) x = ev.clientX - r.left - tip.offsetWidth - 14;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }, []);
  const esconderTip = useCallback(() => {
    if (tipRef.current) tipRef.current.hidden = true;
  }, []);
  const ctx = useMemo(() => ({ mostrarTip, esconderTip, versao }), [mostrarTip, esconderTip, versao]);

  // Redesenha os gráficos quando a largura muda mais de 40 px (como o standalone aprovado).
  useEffect(() => {
    let w = window.innerWidth;
    const aoRedimensionar = () => {
      if (Math.abs(window.innerWidth - w) > 40) {
        w = window.innerWidth;
        setVersao((v) => v + 1);
      }
    };
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  const irPara = (st: Status | "", sist: string) => {
    setFiltro(st);
    setSistemaF(sist);
    document.getElementById("exames")?.scrollIntoView?.({ behavior: "smooth" });
  };

  return (
    <PainelCtx.Provider value={ctx}>
      <div className="sc" ref={rootRef}>
        <Hero
          paciente={dados.paciente}
          resumo={res}
          atualizadoEm={atualizadoEm}
          acaoSair={acaoSair}
          onStatus={(st) => irPara(st, "")}
        />
        <Mapa lista={sis} onSistema={(s) => irPara("", s)} />
        <Foco marcadores={dados.marcadores} />
        {temMotor(dados) && <Motor marcadores={dados.marcadores} zonas={dados.zonas} />}
        {dados.evolucao.length > 0 && <Evolucao evolucao={dados.evolucao} />}
        <Plano plano={dados.plano} />
        <Tabela
          marcadores={dados.marcadores}
          filtro={filtro}
          sistemaF={sistemaF}
          busca={busca}
          onFiltro={setFiltro}
          onLimparSistema={() => setSistemaF("")}
          onBusca={setBusca}
        />
        <Rodape />
        <div className="sc-tip" id="sc-tip" ref={tipRef} hidden></div>
      </div>
    </PainelCtx.Provider>
  );
}
