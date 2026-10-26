"use client"; // Error boundaries são Client Components.

import { useEffect } from "react";
import { Aviso } from "@/components/painel/Aviso";
import { sair } from "./entrar/actions";

const FALHA = "Não foi possível carregar seu painel. Tente de novo.";

/** Erro inesperado em qualquer página: o mesmo aviso de falha do painel, em pt-BR. */
export default function Erro({ error }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="pagina">
      <Aviso tipo="erro" mensagem={FALHA} acaoSair={sair} />
    </main>
  );
}
