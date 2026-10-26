import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import "./enviar.css";
import { Aviso } from "@/components/painel/Aviso";
import { Pattern } from "@/components/marca/Pattern";
import { Simbolo } from "@/components/marca/Simbolo";
import { Wordmark } from "@/components/marca/Wordmark";
import { rotuloSituacao, type Situacao } from "@/lib/arquivos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { semSessao } from "@/lib/supabase/sessao";
import { sair } from "../entrar/actions";
import { Formulario } from "./Formulario";

export const metadata: Metadata = { title: "Enviar exame · savi.core" };

const FALHA = "Não foi possível carregar esta página. Tente de novo.";
const DESATIVADO = "Seu acesso ao painel está desativado. Fale com o consultório do Dr. Filippo.";

type Envio = { id: string; enviado_em: string; arquivos: string[]; situacao: Situacao };

const dataBR = (s: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(s));

export default async function Enviar() {
  return <main className="pagina">{await conteudo()}</main>;
}

async function conteudo() {
  // Não confia só no proxy: a página checa a sessão por conta própria.
  const supabase = await criarClienteServidor();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user) {
    if (!error || semSessao(error)) redirect("/entrar");
    console.error("enviar: falha ao ler a sessão", error);
    return <Aviso tipo="erro" mensagem={FALHA} acaoSair={sair} />;
  }

  // RLS: só a linha do próprio paciente, e só se ativo.
  const pac = await supabase.from("pacientes").select("id").limit(1).maybeSingle();
  if (pac.error) return <Aviso tipo="erro" mensagem={FALHA} acaoSair={sair} />;
  if (!pac.data) return <Aviso tipo="desativado" mensagem={DESATIVADO} acaoSair={sair} />;

  const envios = await supabase
    .from("envios")
    .select("id, enviado_em, arquivos, situacao")
    .eq("paciente_id", pac.data.id)
    .order("enviado_em", { ascending: false })
    .limit(50);

  return (
    <div className="ev">
      <section className="ev-cartao">
        <header className="ev-topo">
          <div className="ev-pat" aria-hidden="true">
            <Pattern cols={7} rows={5} cor="#ade736" assinatura={false} />
          </div>
          <div className="ev-bar">
            <Link className="ev-voltar" href="/">
              ← Voltar ao painel
            </Link>
          </div>
          <div className="ev-marca">
            <Simbolo altura={30} cor="#ade736" />
            <Wordmark altura={17} cor="#ffffff" />
          </div>
          <h1 className="ev-titulo">Enviar exame</h1>
          <p className="ev-sub">
            PDF ou foto do resultado. O Dr. Filippo revisa e atualiza seu painel.
          </p>
        </header>
        <div className="ev-corpo">
          <Formulario />
        </div>
      </section>

      <section className="ev-cartao ev-lista-cartao" aria-labelledby="meus-envios">
        <h2 className="ev-h2" id="meus-envios">
          Meus envios
        </h2>
        {envios.error ? (
          <p className="ev-erro" role="alert">
            Não foi possível carregar seus envios.
          </p>
        ) : envios.data.length === 0 ? (
          <p className="ev-dica">Nenhum envio ainda.</p>
        ) : (
          <ul className="ev-lista" aria-labelledby="meus-envios">
            {(envios.data as Envio[]).map((e) => (
              <li key={e.id} className="ev-item">
                <span className="ev-data">{dataBR(e.enviado_em)}</span>
                <span className="ev-qtd">
                  {e.arquivos.length} {e.arquivos.length === 1 ? "arquivo" : "arquivos"}
                </span>
                <span className={`ev-sit ev-sit-${e.situacao}`}>{rotuloSituacao(e.situacao)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
