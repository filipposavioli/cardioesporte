import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  baixar,
  cadastrar,
  definirAtivo,
  incorporar,
  listarEnvios,
  publicar,
} from "../../scripts/savicore";
import { admin, prepararAmbiente } from "./helpers";

const FIXTURE = "tests/fixtures/exemplo";

beforeAll(() => prepararAmbiente());

const novoEmail = () => `Script-${randomUUID()}@Example.com`;

async function paineisDe(email: string) {
  const { data: p } = await admin().from("pacientes").select("id").eq("email", email.toLowerCase().trim()).single();
  const { data } = await admin().from("paineis").select("id").eq("paciente_id", p!.id);
  return data ?? [];
}

async function criarEnvio(pacienteId: string, arquivos = ["a.pdf", "b.png"]) {
  const id = randomUUID();
  const caminhos = arquivos.map((a) => `${pacienteId}/${id}/${a}`);
  for (const c of caminhos) {
    const { error } = await admin().storage.from("envios").upload(c, new Blob([`conteudo ${c}`], { type: "application/pdf" }), { contentType: "application/pdf" });
    if (error) throw error;
  }
  const { error } = await admin().from("envios").insert({ id, paciente_id: pacienteId, arquivos: caminhos });
  if (error) throw error;
  return { id, caminhos };
}

describe("cadastrar", () => {
  it("normaliza e-mail (linha e usuário Auth)", async () => {
    const email = novoEmail();
    const p = await cadastrar({ nome: "Paciente Exemplo", email: ` ${email} ` });
    expect(p.email).toBe(email.toLowerCase());
    const { data } = await admin().from("pacientes").select("email, user_id").eq("id", p.id).single();
    expect(data!.email).toBe(email.toLowerCase());
    const { data: u } = await admin().auth.admin.getUserById(data!.user_id);
    expect(u.user!.email).toBe(email.toLowerCase());
  });

  it("duplicado falha com 'já cadastrado'", async () => {
    const email = novoEmail();
    await cadastrar({ nome: "Paciente Exemplo", email });
    await expect(cadastrar({ nome: "Outro", email: email.toUpperCase() })).rejects.toThrow(/já cadastrado/);
  });
});

describe("publicar", () => {
  it("grava nova versão e mantém anterior", async () => {
    const email = novoEmail();
    await cadastrar({ nome: "Paciente Exemplo", email });
    await publicar({ email, dados: FIXTURE });
    await publicar({ email: ` ${email.toUpperCase()} `, dados: FIXTURE });
    expect(await paineisDe(email)).toHaveLength(2);
  });

  it("dados inválidos não gravam nada", async () => {
    const email = novoEmail();
    await cadastrar({ nome: "Paciente Exemplo", email });
    const dir = mkdtempSync(join(tmpdir(), "savicore-"));
    cpSync(FIXTURE, dir, { recursive: true });
    writeFileSync(join(dir, "plano.json"), "{ quebrado");
    await expect(publicar({ email, dados: dir })).rejects.toThrow(/plano\.json/);
    expect(await paineisDe(email)).toHaveLength(0);
  });

  it("e-mail inexistente falha", async () => {
    await expect(publicar({ email: novoEmail(), dados: FIXTURE })).rejects.toThrow(/não cadastrado/);
  });
});

describe("envios", () => {
  it("listarEnvios({pendentes:true}) só traz recebido, com nome e e-mail", async () => {
    const email = novoEmail();
    const p = await cadastrar({ nome: "Paciente Exemplo", email });
    const e1 = await criarEnvio(p.id);
    const e2 = await criarEnvio(p.id);
    await incorporar({ envio: e2.id });
    const pendentes = await listarEnvios({ pendentes: true });
    expect(pendentes.find((e) => e.id === e1.id)).toMatchObject({
      situacao: "recebido",
      paciente: { nome: "Paciente Exemplo", email: email.toLowerCase() },
    });
    expect(pendentes.find((e) => e.id === e2.id)).toBeUndefined();
    expect(pendentes.every((e) => e.situacao === "recebido")).toBe(true);
    const todos = await listarEnvios({});
    expect(todos.find((e) => e.id === e2.id)?.situacao).toBe("incorporado");
  });

  it("incorporar muda situação", async () => {
    const p = await cadastrar({ nome: "Paciente Exemplo", email: novoEmail() });
    const e = await criarEnvio(p.id, ["a.pdf"]);
    await incorporar({ envio: e.id });
    const { data } = await admin().from("envios").select("situacao").eq("id", e.id).single();
    expect(data!.situacao).toBe("incorporado");
  });

  it("incorporar envio inexistente falha", async () => {
    await expect(incorporar({ envio: randomUUID() })).rejects.toThrow(/não encontrado/);
  });

  it("baixar grava os arquivos no destino (só basename)", async () => {
    const p = await cadastrar({ nome: "Paciente Exemplo", email: novoEmail() });
    const e = await criarEnvio(p.id);
    const destino = mkdtempSync(join(tmpdir(), "savicore-dl-"));
    const r = await baixar({ envio: e.id, destino });
    expect(readdirSync(destino).sort()).toEqual(["a.pdf", "b.png"]);
    expect(readFileSync(join(destino, "a.pdf"), "utf8")).toBe(`conteudo ${p.id}/${e.id}/a.pdf`);
    expect(r.paciente.nome).toBe("Paciente Exemplo");
  });

  it("baixar recusa caminho fora de <paciente>/<envio>/<arquivo>", async () => {
    const p = await cadastrar({ nome: "Paciente Exemplo", email: novoEmail() });
    const id = randomUUID();
    const { error } = await admin().from("envios").insert({
      id,
      paciente_id: p.id,
      arquivos: [`${p.id}/${id}/../../outro/x.pdf`],
    });
    expect(error).toBeNull();
    const destino = mkdtempSync(join(tmpdir(), "savicore-dl-"));
    await expect(baixar({ envio: id, destino })).rejects.toThrow(/caminho inválido/);
    expect(readdirSync(destino)).toEqual([]);
  });
});

describe("definirAtivo", () => {
  it("desativa e reativa", async () => {
    const email = novoEmail();
    const p = await cadastrar({ nome: "Paciente Exemplo", email });
    await definirAtivo({ email, ativo: false });
    expect((await admin().from("pacientes").select("ativo").eq("id", p.id).single()).data!.ativo).toBe(false);
    await definirAtivo({ email, ativo: true });
    expect((await admin().from("pacientes").select("ativo").eq("id", p.id).single()).data!.ativo).toBe(true);
  });
});
