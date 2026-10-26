import type { Metadata } from "next";
import "./entrar.css";
import { Pattern } from "@/components/marca/Pattern";
import { Simbolo } from "@/components/marca/Simbolo";
import { Wordmark } from "@/components/marca/Wordmark";
import { FormEntrar } from "./FormEntrar";

export const metadata: Metadata = { title: "Entrar · savi.core" };

export default function Entrar() {
  return (
    <main className="en">
      <div className="en-cartao">
        <header className="en-topo">
          <div className="en-pat" aria-hidden="true">
            <Pattern cols={7} rows={5} cor="#ade736" assinatura={false} />
          </div>
          <div className="en-marca">
            <Simbolo altura={34} cor="#ade736" />
            <Wordmark altura={19} cor="#ffffff" />
          </div>
          <h1 className="en-titulo">Seu painel de saúde</h1>
          <p className="en-sub">Exames, evolução e próximos passos, com o Dr. Filippo Savioli.</p>
        </header>
        <div className="en-corpo">
          <FormEntrar />
        </div>
      </div>
    </main>
  );
}
