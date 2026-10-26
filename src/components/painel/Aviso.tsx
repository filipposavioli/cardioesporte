import "./painel.css";
import Link from "next/link";
import { Pattern } from "@/components/marca/Pattern";
import { Simbolo } from "@/components/marca/Simbolo";
import { Wordmark } from "@/components/marca/Wordmark";

type Props = {
  mensagem: string;
  /** "vazio": sem painel publicado (botão Enviar exame); "erro": falha ao carregar (botão Tentar de novo). */
  tipo: "vazio" | "erro";
  acaoSair?: (fd: FormData) => void | Promise<void>;
};

/** Estados da página `/` sem painel para mostrar, no mesmo cabeçalho petróleo do painel. */
export function Aviso({ mensagem, tipo, acaoSair }: Props) {
  return (
    <div className="sc">
      <section className="sc-aviso" role={tipo === "erro" ? "alert" : undefined}>
        <div className="sc-pat" aria-hidden="true">
          <Pattern cols={7} rows={5} cor="#ade736" assinatura={false} />
        </div>
        <div className="sc-bar">
          {acaoSair && (
            <form action={acaoSair}>
              <button className="sc-sair" type="submit">
                Sair
              </button>
            </form>
          )}
        </div>
        <div className="sc-brand" style={{ position: "relative" }}>
          <Simbolo altura={40} cor="#ade736" />
          <span className="sc-wm">
            <Wordmark altura={22} cor="#ffffff" />
          </span>
        </div>
        <p className="sc-aviso-t">{mensagem}</p>
        <div className="sc-aviso-a">
          {tipo === "vazio" ? (
            <Link className="sc-btn" href="/enviar">
              Enviar exame
            </Link>
          ) : (
            // Recarga completa de propósito: refaz a busca do painel no servidor.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a className="sc-btn" href="/">
              Tentar de novo
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
