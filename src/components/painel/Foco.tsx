import type { Marcador } from "@/lib/dados";
import { Regua } from "./Regua";
import { ORDER, badgeCls } from "./util";

export function Foco({ marcadores }: { marcadores: Marcador[] }) {
  const itens = marcadores
    .filter((m) => m.status !== "Tudo certo")
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  return (
    <section className="sc-sec" id="foco">
      <div className="sc-sh">
        <span className="sc-num">02</span>
        <h2>onde focar</h2>
      </div>
      <p className="sc-lead">A régua mostra onde o seu valor cai: a faixa verde é o esperado.</p>
      <div className="sc-focus" id="sc-focus">
        {itens.map((m) => (
          <article key={m.exame} className={"sc-fcard sc-anim" + (m.status === "Prioridade" ? " is-pr" : "")}>
            <div className="sc-fhead">
              <div>
                <p className="sc-fname">{m.exame}</p>
                <p className="sc-fsys">{m.sistema}</p>
              </div>
              <span className={badgeCls(m.status)}>{m.status}</span>
            </div>
            <p className="sc-fval">{m.resultado}</p>
            {m.valor != null && (m.ref_min != null || m.ref_max != null) && (
              <div className="sc-frule">
                <Regua m={m} labels />
              </div>
            )}
            <p className="sc-fread">{m.leitura}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
