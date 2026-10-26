"use client";
import type { Marcador, Status } from "@/lib/dados";
import { Regua } from "./Regua";
import { badgeCls } from "./util";

type Props = {
  marcadores: Marcador[];
  filtro: Status | "";
  sistemaF: string;
  busca: string;
  onFiltro: (st: Status | "") => void;
  onLimparSistema: () => void;
  onBusca: (q: string) => void;
};

const CHIPS: { f: Status | ""; cls?: string; rot: string }[] = [
  { f: "", rot: "Todos" },
  { f: "Tudo certo", cls: "d-ok", rot: "Tudo certo" },
  { f: "Atenção", cls: "d-at", rot: "Atenção" },
  { f: "Prioridade", cls: "d-pr", rot: "Prioridade" },
];

export function Tabela({ marcadores, filtro, sistemaF, busca, onFiltro, onLimparSistema, onBusca }: Props) {
  const q = busca.trim().toLowerCase();
  const linhas = marcadores.filter(
    (m) =>
      (!filtro || m.status === filtro) &&
      (!sistemaF || m.sistema === sistemaF) &&
      (!q || (m.exame + " " + m.sistema + " " + m.leitura).toLowerCase().includes(q)),
  );
  return (
    <section className="sc-sec" id="exames">
      <div className="sc-sh">
        <span className="sc-num">06</span>
        <h2>todos os exames</h2>
      </div>
      <div className="sc-tools">
        <div className="sc-chips" role="group" aria-label="Filtrar por situação">
          {CHIPS.map((c) => (
            <button
              key={c.rot}
              type="button"
              className={"sc-chip" + (filtro === c.f ? " is-on" : "")}
              aria-pressed={filtro === c.f}
              onClick={() => onFiltro(c.f)}
            >
              {c.cls && <i className={c.cls}></i>}
              {c.rot}
            </button>
          ))}
        </div>
        <div className="sc-tools-r">
          {sistemaF && (
            <button type="button" className="sc-sysf" id="sc-sysf" aria-label={`Remover filtro ${sistemaF}`} onClick={onLimparSistema}>
              {sistemaF + "  ✕"}
            </button>
          )}
          <input
            className="sc-search"
            id="sc-search"
            type="search"
            placeholder="Buscar exame…"
            aria-label="Buscar exame"
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
          />
        </div>
      </div>
      <div className="sc-tablewrap">
        <table className="sc-table" id="sc-table">
          <thead>
            <tr>
              <th>Exame</th>
              <th>Resultado</th>
              <th>Referência</th>
              <th>Situação</th>
              <th>O que significa</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((m) => (
              <tr key={m.exame}>
                <td>{m.exame}</td>
                <td>
                  {m.resultado}
                  <Regua m={m} labels={false} />
                </td>
                <td>{m.referencia}</td>
                <td>
                  <span className={badgeCls(m.status)}>{m.status}</span>
                </td>
                <td>{m.leitura}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
