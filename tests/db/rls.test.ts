import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { admin, anonimo, criarPacienteTeste } from "./helpers";

const TABELAS = ["pacientes", "paineis", "envios"] as const;

function pdf(conteudo = "%PDF-1.4 teste") {
  return new Blob([conteudo], { type: "application/pdf" });
}

async function publicarPainel(pacienteId: string): Promise<string> {
  const { data, error } = await admin()
    .from("paineis")
    .insert({
      paciente_id: pacienteId,
      marcadores: [],
      evolucao: [],
      paciente: { nome: "Paciente Exemplo" },
      zonas: null,
      plano: {},
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Dois pacientes novos (e-mails únicos), cada um com um painel publicado. */
async function cenario() {
  const a = await criarPacienteTeste("Paciente Exemplo A");
  const b = await criarPacienteTeste("Paciente Exemplo B");
  const painelA = await publicarPainel(a.pacienteId);
  const painelB = await publicarPainel(b.pacienteId);
  return { a, b, painelA, painelB };
}

async function criarEnvioAdmin(pacienteId: string): Promise<string> {
  const id = randomUUID();
  const { error } = await admin()
    .from("envios")
    .insert({ id, paciente_id: pacienteId, arquivos: [`${pacienteId}/${id}/x.pdf`] });
  if (error) throw error;
  return id;
}

async function desativar(pacienteId: string) {
  const { error } = await admin().from("pacientes").update({ ativo: false }).eq("id", pacienteId);
  if (error) throw error;
}

describe("RLS do portal", () => {
  it("paciente lê só o próprio cadastro", async () => {
    const { a } = await cenario();
    const { data, error } = await a.client.from("pacientes").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(a.pacienteId);
  });

  it("paciente lê o próprio painel e não lê painel de outro", async () => {
    const { a, b, painelA } = await cenario();

    const proprio = await a.client.from("paineis").select("id, paciente_id");
    expect(proprio.error).toBeNull();
    expect(proprio.data).toEqual([{ id: painelA, paciente_id: a.pacienteId }]);

    const outro = await a.client.from("paineis").select("*").eq("paciente_id", b.pacienteId);
    expect(outro.error).toBeNull();
    expect(outro.data).toHaveLength(0);
  });

  it("paciente não grava painel", async () => {
    const { a, b, painelA } = await cenario();

    const insercao = await a.client.from("paineis").insert({
      paciente_id: a.pacienteId,
      marcadores: [],
      evolucao: [],
      paciente: {},
      plano: {},
    });
    expect(insercao.error).not.toBeNull();

    const insercaoOutro = await a.client.from("paineis").insert({
      paciente_id: b.pacienteId,
      marcadores: [],
      evolucao: [],
      paciente: {},
      plano: {},
    });
    expect(insercaoOutro.error).not.toBeNull();

    const alteracao = await a.client
      .from("paineis")
      .update({ plano: { hack: true } })
      .eq("id", painelA)
      .select();
    expect(alteracao.data ?? []).toHaveLength(0);
    const remocao = await a.client.from("paineis").delete().eq("id", painelA).select();
    expect(remocao.data ?? []).toHaveLength(0);

    const { data } = await admin().from("paineis").select("plano").eq("id", painelA).single();
    expect(data!.plano).toEqual({});
  });

  it("paciente não altera o próprio cadastro", async () => {
    const { a } = await cenario();
    const alteracao = await a.client
      .from("pacientes")
      .update({ nome: "Outro nome" })
      .eq("id", a.pacienteId)
      .select();
    expect(alteracao.data ?? []).toHaveLength(0);
    const insercao = await a.client
      .from("pacientes")
      .insert({ nome: "Novo", email: `novo-${randomUUID()}@example.com` });
    expect(insercao.error).not.toBeNull();

    const { data } = await admin().from("pacientes").select("nome").eq("id", a.pacienteId).single();
    expect(data!.nome).toBe("Paciente Exemplo A");
  });

  it("paciente cria envio só para si", async () => {
    const { a, b } = await cenario();

    const id = randomUUID();
    const ok = await a.client
      .from("envios")
      .insert({ id, paciente_id: a.pacienteId, arquivos: [`${a.pacienteId}/${id}/x.pdf`] });
    expect(ok.error).toBeNull();

    const lidos = await a.client.from("envios").select("id, situacao");
    expect(lidos.data).toEqual([{ id, situacao: "recebido" }]);

    const idB = randomUUID();
    const paraOutro = await a.client
      .from("envios")
      .insert({ id: idB, paciente_id: b.pacienteId, arquivos: [`${b.pacienteId}/${idB}/x.pdf`] });
    expect(paraOutro.error?.code).toBe("42501");

    const id2 = randomUUID();
    const incorporado = await a.client.from("envios").insert({
      id: id2,
      paciente_id: a.pacienteId,
      arquivos: [`${a.pacienteId}/${id2}/x.pdf`],
      situacao: "incorporado",
    });
    expect(incorporado.error?.code).toBe("42501");

    const alteracao = await a.client
      .from("envios")
      .update({ situacao: "incorporado", observacao: "alterado" })
      .eq("id", id)
      .select();
    expect(alteracao.data ?? []).toHaveLength(0);

    const remocao = await a.client.from("envios").delete().eq("id", id).select();
    expect(remocao.data ?? []).toHaveLength(0);

    const { data } = await admin().from("envios").select("situacao, observacao").eq("id", id);
    expect(data).toEqual([{ situacao: "recebido", observacao: null }]);
    const { data: todos } = await admin()
      .from("envios")
      .select("id")
      .in("paciente_id", [a.pacienteId, b.pacienteId]);
    expect(todos).toEqual([{ id }]);
  });

  it("envio só aponta para arquivos na própria pasta do envio", async () => {
    const { a, b } = await cenario();

    const id = randomUUID();
    const deOutro = await a.client.from("envios").insert({
      id,
      paciente_id: a.pacienteId,
      arquivos: [`${b.pacienteId}/${id}/x.pdf`],
    });
    expect(deOutro.error).not.toBeNull();

    const outroEnvio = await a.client.from("envios").insert({
      id,
      paciente_id: a.pacienteId,
      arquivos: [`${a.pacienteId}/${randomUUID()}/x.pdf`],
    });
    expect(outroEnvio.error).not.toBeNull();

    const vazio = await a.client
      .from("envios")
      .insert({ id, paciente_id: a.pacienteId, arquivos: [] });
    expect(vazio.error).not.toBeNull();
  });

  it("paciente não lê envio de outro", async () => {
    const { a, b } = await cenario();
    await criarEnvioAdmin(b.pacienteId);
    const { data, error } = await a.client.from("envios").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("storage isolado", async () => {
    const { a, b } = await cenario();
    const bucket = (c: typeof a.client) => c.storage.from("envios");

    const caminhoA = `${a.pacienteId}/${randomUUID()}/x.pdf`;
    const subidaA = await bucket(a.client).upload(caminhoA, pdf(), { contentType: "application/pdf" });
    expect(subidaA.error).toBeNull();

    const pastaB = `${b.pacienteId}/${randomUUID()}`;
    const subidaEmB = await bucket(a.client).upload(`${pastaB}/x.pdf`, pdf(), {
      contentType: "application/pdf",
    });
    expect(subidaEmB.error).toMatchObject({ statusCode: "403" });

    const subidaB = await bucket(b.client).upload(`${pastaB}/x.pdf`, pdf("%PDF-1.4 de B"), {
      contentType: "application/pdf",
    });
    expect(subidaB.error).toBeNull();

    const lista = await bucket(a.client).list(pastaB);
    expect(lista.data ?? []).toHaveLength(0);
    const download = await bucket(a.client).download(`${pastaB}/x.pdf`);
    expect(download.data).toBeNull();
    expect(download.error).not.toBeNull();
    const assinada = await bucket(a.client).createSignedUrl(`${pastaB}/x.pdf`, 300);
    expect(assinada.data).toBeNull();

    // A lê o próprio arquivo
    const proprio = await bucket(a.client).download(caminhoA);
    expect(proprio.error).toBeNull();
    expect(await proprio.data!.text()).toBe("%PDF-1.4 teste");
  });

  it("paciente não sobrescreve nem apaga arquivo", async () => {
    const { a } = await cenario();
    const bucket = a.client.storage.from("envios");
    const caminho = `${a.pacienteId}/${randomUUID()}/x.pdf`;
    expect((await bucket.upload(caminho, pdf(), { contentType: "application/pdf" })).error).toBeNull();

    const sobrescrita = await bucket.upload(caminho, pdf("%PDF-1.4 trocado"), {
      contentType: "application/pdf",
      upsert: true,
    });
    expect(sobrescrita.error).not.toBeNull();
    const update = await bucket.update(caminho, pdf("%PDF-1.4 trocado"), {
      contentType: "application/pdf",
    });
    expect(update.error).not.toBeNull();

    await bucket.remove([caminho]);
    const mover = await bucket.move(caminho, `${a.pacienteId}/${randomUUID()}/y.pdf`);
    expect(mover.error).not.toBeNull();

    const { data, error } = await admin().storage.from("envios").download(caminho);
    expect(error).toBeNull();
    expect(await data!.text()).toBe("%PDF-1.4 teste");
  });

  it("bucket privado recusa tipo e tamanho fora do limite", async () => {
    const { data: info } = await admin().storage.getBucket("envios");
    expect(info).toMatchObject({ public: false, file_size_limit: 20971520 });
    expect([...(info!.allowed_mime_types ?? [])].sort()).toEqual(
      ["application/pdf", "image/heic", "image/heif", "image/jpeg", "image/png"],
    );

    const { a } = await cenario();
    const bucket = a.client.storage.from("envios");
    const pasta = `${a.pacienteId}/${randomUUID()}`;

    const texto = await bucket.upload(`${pasta}/x.txt`, new Blob(["oi"], { type: "text/plain" }), {
      contentType: "text/plain",
    });
    expect(texto.error).toMatchObject({ statusCode: "415" });

    const grande = new Blob([new Uint8Array(20971520 + 1)], { type: "application/pdf" });
    const excesso = await bucket.upload(`${pasta}/grande.pdf`, grande, {
      contentType: "application/pdf",
    });
    expect(excesso.error).toMatchObject({ statusCode: "413" });

    const png = await bucket.upload(`${pasta}/foto.png`, new Blob(["png"], { type: "image/png" }), {
      contentType: "image/png",
    });
    expect(png.error).toBeNull();
  });

  it("inativo não lê nada", async () => {
    const { a } = await cenario();
    await criarEnvioAdmin(a.pacienteId);
    const caminho = `${a.pacienteId}/${randomUUID()}/x.pdf`;
    expect(
      (await a.client.storage.from("envios").upload(caminho, pdf(), { contentType: "application/pdf" }))
        .error,
    ).toBeNull();

    await desativar(a.pacienteId);

    for (const tabela of TABELAS) {
      const { data, error } = await a.client.from(tabela).select("*");
      expect(error, tabela).toBeNull();
      expect(data, tabela).toHaveLength(0);
    }
    const download = await a.client.storage.from("envios").download(caminho);
    expect(download.data).toBeNull();
  });

  it("inativo não envia", async () => {
    const { a } = await cenario();
    await desativar(a.pacienteId);

    const id = randomUUID();
    const insercao = await a.client
      .from("envios")
      .insert({ id, paciente_id: a.pacienteId, arquivos: [`${a.pacienteId}/${id}/x.pdf`] });
    expect(insercao.error).not.toBeNull();

    const subida = await a.client.storage
      .from("envios")
      .upload(`${a.pacienteId}/${id}/x.pdf`, pdf(), { contentType: "application/pdf" });
    expect(subida.error).toMatchObject({ statusCode: "403" });
  });

  it("usuário autenticado sem cadastro de paciente não lê nada", async () => {
    await cenario();
    const email = `solto-${randomUUID()}@example.com`;
    const password = `Senha-${randomUUID()}`;
    const { error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
    expect(error).toBeNull();
    const cliente = anonimo();
    expect((await cliente.auth.signInWithPassword({ email, password })).error).toBeNull();

    for (const tabela of TABELAS) {
      const { data } = await cliente.from(tabela).select("*");
      expect(data ?? [], tabela).toHaveLength(0);
    }
    const { data: id } = await cliente.rpc("meu_paciente_id");
    expect(id).toBeNull();
  });

  it("anônimo não lê nada", async () => {
    const { a } = await cenario();
    await criarEnvioAdmin(a.pacienteId);
    const cliente = anonimo();

    for (const tabela of TABELAS) {
      const { data } = await cliente.from(tabela).select("*");
      expect(data ?? [], tabela).toHaveLength(0);
    }
    const insercao = await cliente
      .from("envios")
      .insert({ paciente_id: a.pacienteId, arquivos: [`${a.pacienteId}/x/x.pdf`] });
    expect(insercao.error).not.toBeNull();

    const subida = await cliente.storage
      .from("envios")
      .upload(`${a.pacienteId}/${randomUUID()}/x.pdf`, pdf(), { contentType: "application/pdf" });
    expect(subida.error).not.toBeNull();

    const rpc = await cliente.rpc("meu_paciente_id");
    expect(rpc.data ?? null).toBeNull();
  });
});
