import type { Passo } from "@/lib/dados";

export function Plano({ plano }: { plano: Passo[] }) {
  return (
    <section className="sc-sec" id="plano">
      <div className="sc-sh">
        <span className="sc-num">05</span>
        <h2>próximos passos</h2>
      </div>
      <p className="sc-lead">O que vamos trabalhar juntos até a próxima avaliação.</p>
      <ol className="sc-plan" id="sc-plan">
        {plano.map((r) => (
          <li key={r.n} className="sc-anim">
            <span className="sc-pn">{String(r.n).padStart(2, "0")}</span>
            <p className="sc-pf">{r.foco}</p>
            <p className="sc-pa">{r.acao}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
