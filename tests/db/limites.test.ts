import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { criarLimitador } from "@/lib/limites";
import { admin, anonimo, criarPacienteTeste } from "./helpers";

const L = { limite: 3, janelaS: 15 * 60 };

function relogio(inicio = new Date("2026-10-26T12:00:00Z")) {
  let t = inicio.getTime();
  return { agora: () => new Date(t), avancar: (ms: number) => (t += ms) };
}

describe("limites de login (tabela limites_login)", () => {
  it("conta tentativas até o limite e recusa a seguinte", async () => {
    const r = relogio();
    const lim = criarLimitador(admin(), r.agora);
    const chave = `teste:${randomUUID()}`;
    for (let i = 0; i < 3; i++) expect(await lim.consumir(chave, L)).not.toBeNull();
    expect(await lim.consumir(chave, L)).toBeNull();
    expect(await lim.consumir(chave, L)).toBeNull();
  });

  it("libera de novo quando a janela passa", async () => {
    const r = relogio();
    const lim = criarLimitador(admin(), r.agora);
    const chave = `teste:${randomUUID()}`;
    for (let i = 0; i < 3; i++) await lim.consumir(chave, L);
    r.avancar(14 * 60_000);
    expect(await lim.consumir(chave, L)).toBeNull();
    r.avancar(60_000 + 1);
    expect(await lim.consumir(chave, L)).not.toBeNull();
  });

  it("chaves diferentes não se misturam", async () => {
    const lim = criarLimitador(admin(), relogio().agora);
    const a = `teste:${randomUUID()}`;
    const b = `teste:${randomUUID()}`;
    for (let i = 0; i < 3; i++) await lim.consumir(a, L);
    expect(await lim.consumir(a, L)).toBeNull();
    expect(await lim.consumir(b, L)).not.toBeNull();
  });

  it("devolver libera a vaga (acerto não conta como tentativa errada)", async () => {
    const lim = criarLimitador(admin(), relogio().agora);
    const chave = `teste:${randomUUID()}`;
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push(await lim.consumir(chave, L));
    await lim.devolver(ids[2]!);
    expect(await lim.consumir(chave, L)).not.toBeNull();
    expect(await lim.consumir(chave, L)).toBeNull();
  });

  it("chamadas simultâneas não passam do limite", async () => {
    const lim = criarLimitador(admin(), relogio().agora);
    const chave = `teste:${randomUUID()}`;
    const r = await Promise.all(Array.from({ length: 10 }, () => lim.consumir(chave, L)));
    expect(r.filter((id) => id !== null)).toHaveLength(3);
  });

  it("anon e paciente logado não leem a tabela nem chamam a função", async () => {
    const { client } = await criarPacienteTeste("Paciente Exemplo");
    for (const c of [anonimo(), client]) {
      const sel = await c.from("limites_login").select("*");
      expect(sel.error !== null || sel.data?.length === 0).toBe(true);
      const ins = await c.from("limites_login").insert({ chave: "x" });
      expect(ins.error).not.toBeNull();
      const rpc = await c.rpc("consumir_limite", { p_chave: "x", p_limite: 5, p_janela_s: 60 });
      expect(rpc.error).not.toBeNull();
    }
  });
});
