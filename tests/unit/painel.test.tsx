import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Painel } from "@/components/painel/Painel";
import type { Painel as DadosPainel } from "@/lib/dados";
import marcadores from "../fixtures/exemplo/marcadores.json";
import evolucao from "../fixtures/exemplo/evolucao.json";
import paciente from "../fixtures/exemplo/paciente.json";
import zonas from "../fixtures/exemplo/zonas.json";
import plano from "../fixtures/exemplo/plano.json";

const fixture = (): DadosPainel =>
  ({ marcadores, evolucao, paciente: paciente[0], zonas, plano }) as DadosPainel;

const linhas = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLTableRowElement>("#sc-table tbody tr"));
const coluna = (tr: HTMLTableRowElement, i: number) => tr.cells[i].textContent ?? "";

afterEach(cleanup);

describe("<Painel>", () => {
  it('mostra nome e "N de total em ordem"', () => {
    const { container } = render(<Painel dados={fixture()} atualizadoEm="2026-10-05" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Paciente Exemplo");
    const ok = marcadores.filter((m) => m.status === "Tudo certo").length;
    expect(container.querySelector("#sc-donut")!.textContent).toContain(`de ${marcadores.length} em ordem`);
    expect(container.querySelector("#sc-donut .c-n")!.textContent).toBe(String(ok));
    expect(screen.getByText(/Atualizado em 05\/10\/2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Enviar exame" }).getAttribute("href")).toBe("/enviar");
    expect(linhas(container)).toHaveLength(marcadores.length);
  });

  it('filtro "Atenção" na tabela mostra só Atenção', async () => {
    const { container } = render(<Painel dados={fixture()} atualizadoEm="2026-10-05" />);
    const chips = within(container.querySelector(".sc-chips") as HTMLElement);
    await userEvent.click(chips.getByRole("button", { name: "Atenção" }));
    const rs = linhas(container);
    expect(rs).toHaveLength(marcadores.filter((m) => m.status === "Atenção").length);
    rs.forEach((tr) => expect(coluna(tr, 3)).toBe("Atenção"));
  });

  it("clicar num sistema filtra a tabela por ele", async () => {
    const { container } = render(<Painel dados={fixture()} atualizadoEm="2026-10-05" />);
    const card = Array.from(container.querySelectorAll<HTMLButtonElement>(".sc-sys")).find((b) =>
      b.textContent?.includes("Rins"),
    )!;
    await userEvent.click(card);
    const rs = linhas(container);
    const exames = marcadores.filter((m) => m.sistema === "Rins").map((m) => m.exame);
    expect(rs.map((tr) => coluna(tr, 0))).toEqual(exames);
    const chip = container.querySelector<HTMLButtonElement>("#sc-sysf")!;
    expect(chip.textContent).toContain("Rins");
    await userEvent.click(chip);
    expect(container.querySelector("#sc-sysf")).toBeNull();
    expect(linhas(container)).toHaveLength(marcadores.length);
  });

  it("busca filtra por exame", async () => {
    const { container } = render(<Painel dados={fixture()} atualizadoEm="2026-10-05" />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar exame" }), "ferritina");
    const rs = linhas(container);
    expect(rs).toHaveLength(1);
    expect(coluna(rs[0], 0)).toBe("Ferritina");
  });

  it("oculta motor sem TECP", () => {
    const d = fixture();
    d.zonas = null;
    d.marcadores = d.marcadores
      .filter((m) => m.exame !== "VO₂ máximo")
      .map((m) => ({ ...m, pct_predito: null }));
    const { container } = render(<Painel dados={d} atualizadoEm="2026-10-05" />);
    expect(container.querySelector("#performance")).toBeNull();
    expect(container.querySelector("#mapa")).not.toBeNull();
  });

  it("mostra motor com TECP", () => {
    const { container } = render(<Painel dados={fixture()} atualizadoEm="2026-10-05" />);
    expect(container.querySelector("#performance")).not.toBeNull();
    expect(container.querySelector(".sc-vo2-n")!.textContent).toBe("42,5");
  });

  it("oculta evolução vazia", () => {
    const d = fixture();
    d.evolucao = [];
    const { container } = render(<Painel dados={d} atualizadoEm="2026-10-05" />);
    expect(container.querySelector("#evolucao")).toBeNull();
    expect(container.querySelector("#plano")).not.toBeNull();
  });
});
