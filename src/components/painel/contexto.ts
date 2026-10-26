"use client";
import { createContext, useContext } from "react";

export type PontoTela = { clientX: number; clientY: number };
export type CtxPainel = {
  /** Mostra a dica (html já escapado) perto do ponteiro. */
  mostrarTip: (ev: PontoTela, html: string) => void;
  esconderTip: () => void;
  /** Muda quando a largura da janela varia mais de 40 px: os gráficos redesenham. */
  versao: number;
};

export const PainelCtx = createContext<CtxPainel>({ mostrarTip: () => {}, esconderTip: () => {}, versao: 0 });
export const usePainel = () => useContext(PainelCtx);
