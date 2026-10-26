import { beforeEach, describe, expect, it, vi } from "vitest";
import { montarAviso, processarAviso, type DepsAviso, type EnviadorEmail } from "@/lib/aviso";
import { chaveLimite, LIMITES, type Limite } from "@/lib/limites";
import { supabaseFalso } from "./fakes";

const EU = { usuario: "u-1", paciente: "11111111-1111-4111-8111-111111111111" };
const OUTRO = "22222222-2222-4222-8222-222222222222";
const ENVIO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENVIO_OUTRO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function banco(usuario: { id: string } | null = { id: EU.usuario }) {
  return supabaseFalso({
    usuario,
    tabelas: {
      pacientes: [
        { id: EU.paciente, nome: "Paciente Exemplo" },
        { id: OUTRO, nome: "Outra Pessoa" },
      ],
      envios: [
        {
          id: ENVIO,
          paciente_id: EU.paciente,
          arquivos: [`${EU.paciente}/${ENVIO}/a.pdf`, `${EU.paciente}/${ENVIO}/b.jpg`],
          observacao: "Exame de <b>sangue</b>\nde ontem",
        },
        { id: ENVIO_OUTRO, paciente_id: OUTRO, arquivos: [`${OUTRO}/${ENVIO_OUTRO}/x.pdf`], observacao: null },
      ],
    },
    // RLS: o paciente só enxerga as próprias linhas.
    visivel: (t, l) => (t === "pacientes" ? l.id : l.paciente_id) === EU.paciente,
  });
}

function resendFalso(resultado: Awaited<ReturnType<EnviadorEmail["emails"]["send"]>> = { error: null }) {
  const send = vi.fn(async () => resultado);
  return { cliente: { emails: { send } } satisfies EnviadorEmail, send };
}

/** Limitador em memória com a mesma regra do banco (sem janela: tudo dentro dela). */
function limitadorFalso() {
  const contas = new Map<string, number>();
  const consumir = vi.fn(async (chave: string, { limite }: Limite) => {
    const n = contas.get(chave) ?? 0;
    if (n >= limite) return null;
    contas.set(chave, n + 1);
    return n + 1;
  });
  return { consumir };
}

/** `update envios set avisado_em = now() where id = ? and avisado_em is null`, em memória. */
function marcadorFalso() {
  const avisados = new Set<string>();
  return vi.fn(async (envioId: string) => {
    if (avisados.has(envioId)) return false;
    avisados.add(envioId);
    return true;
  });
}

type Ambiente = Pick<DepsAviso, "medicoEmail" | "remetente" | "limitador" | "marcarAvisado">;
let AMBIENTE: Ambiente;
beforeEach(() => {
  AMBIENTE = {
    medicoEmail: "medico@example.com",
    remetente: "Portal <aviso@example.com>",
    limitador: limitadorFalso(),
    marcarAvisado: marcadorFalso(),
  };
});

describe("processarAviso", () => {
  it("sem sessão → 401", async () => {
    const { cliente, send } = resendFalso();
    const r = await processarAviso({ supabase: banco(null), resend: cliente, ...AMBIENTE }, { envio_id: ENVIO });
    expect(r.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("corpo inválido → 400", async () => {
    const { cliente } = resendFalso();
    const deps = { supabase: banco(), resend: cliente, ...AMBIENTE };
    expect((await processarAviso(deps, { envio_id: "x" })).status).toBe(400);
    expect((await processarAviso(deps, null)).status).toBe(400);
  });

  it("aviso: envio de outro paciente → 404", async () => {
    const { cliente, send } = resendFalso();
    const r = await processarAviso({ supabase: banco(), resend: cliente, ...AMBIENTE }, { envio_id: ENVIO_OUTRO });
    expect(r.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it("aviso: e-mail sem anexo e com nome/nº de arquivos", async () => {
    const { cliente, send } = resendFalso();
    const r = await processarAviso({ supabase: banco(), resend: cliente, ...AMBIENTE }, { envio_id: ENVIO });
    expect(r.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const [msg] = send.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(msg.to).toBe("medico@example.com");
    expect(msg.from).toBe("Portal <aviso@example.com>");
    expect(msg.subject).toBe("Novo exame de Paciente Exemplo");
    expect(msg.text).toContain("Paciente Exemplo");
    expect(msg.text).toContain("2 arquivos");
    expect(msg.text).toContain("Exame de <b>sangue</b>\nde ontem");
    // Só texto: sem anexos, sem HTML, sem links nem caminhos dos arquivos.
    expect(msg).not.toHaveProperty("attachments");
    expect(msg).not.toHaveProperty("html");
    expect(String(msg.text)).not.toMatch(/https?:\/\//);
    expect(String(msg.text)).not.toContain(ENVIO);
    expect(String(msg.text)).not.toContain("a.pdf");
  });

  it("singular e sem observação", async () => {
    const supabase = supabaseFalso({
      usuario: { id: EU.usuario },
      tabelas: {
        pacientes: [{ id: EU.paciente, nome: "Paciente\r\nExemplo" }],
        envios: [{ id: ENVIO, paciente_id: EU.paciente, arquivos: ["p/e/a.pdf"], observacao: null }],
      },
    });
    const { cliente, send } = resendFalso();
    await processarAviso({ supabase, resend: cliente, ...AMBIENTE }, { envio_id: ENVIO });
    const [msg] = send.mock.calls[0] as unknown as [Record<string, string>];
    expect(msg.subject).toBe("Novo exame de Paciente Exemplo"); // sem quebra de linha no assunto
    expect(msg.text).toContain("1 arquivo.");
    expect(msg.text).toContain("Observação: (nenhuma)");
  });

  it("aviso: falha do Resend → 200", async () => {
    const log = vi.fn();
    const { cliente } = resendFalso({ error: { message: "caiu", name: "application_error" } });
    const r = await processarAviso({ supabase: banco(), resend: cliente, ...AMBIENTE, log }, { envio_id: ENVIO });
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ ok: true, avisado: false });
    expect(log).toHaveBeenCalled();

    const quebra = { emails: { send: vi.fn(async () => Promise.reject(new Error("rede"))) } };
    const r2 = await processarAviso({ supabase: banco(), resend: quebra, ...AMBIENTE, log }, { envio_id: ENVIO });
    expect(r2.status).toBe(200);
  });

  it("sem RESEND_API_KEY (ou destinatário) → registra no log, não envia, 200", async () => {
    const log = vi.fn();
    const r = await processarAviso({ supabase: banco(), resend: null, ...AMBIENTE, log }, { envio_id: ENVIO });
    expect(r).toEqual({ status: 200, corpo: { ok: true, avisado: false } });
    expect(log).toHaveBeenCalled();

    const { cliente, send } = resendFalso();
    const r2 = await processarAviso(
      { supabase: banco(), resend: cliente, ...AMBIENTE, medicoEmail: "", log },
      { envio_id: ENVIO },
    );
    expect(r2.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it("falha ao ler o envio → 500", async () => {
    const supabase = supabaseFalso({ usuario: { id: EU.usuario }, tabelas: {}, erro: "fora do ar" });
    const { cliente } = resendFalso();
    const r = await processarAviso({ supabase, resend: cliente, ...AMBIENTE, log: vi.fn() }, { envio_id: ENVIO });
    expect(r.status).toBe(500);
  });
  it("aviso: só uma vez por envio (2ª chamada não envia)", async () => {
    const { cliente, send } = resendFalso();
    const deps = { supabase: banco(), resend: cliente, ...AMBIENTE };
    const r1 = await processarAviso(deps, { envio_id: ENVIO });
    expect(r1).toEqual({ status: 200, corpo: { ok: true, avisado: true } });
    const r2 = await processarAviso(deps, { envio_id: ENVIO });
    expect(r2.status).toBe(200);
    expect(r2.corpo).toEqual({ ok: true, avisado: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(AMBIENTE.marcarAvisado).toHaveBeenCalledWith(ENVIO);
  });

  it("aviso: acima do limite por usuário não envia nem marca", async () => {
    const { cliente, send } = resendFalso();
    const consumir = vi.fn(async () => null);
    const r = await processarAviso(
      { supabase: banco(), resend: cliente, ...AMBIENTE, limitador: { consumir }, log: vi.fn() },
      { envio_id: ENVIO },
    );
    expect(r.status).toBe(429);
    expect(send).not.toHaveBeenCalled();
    expect(AMBIENTE.marcarAvisado).not.toHaveBeenCalled();
    expect(consumir).toHaveBeenCalledWith(chaveLimite("aviso", EU.usuario), LIMITES.aviso);
    expect(LIMITES.aviso).toEqual({ limite: 10, janelaS: 3600 });
  });

  it("aviso: o limite conta por usuário, não por envio", async () => {
    const { cliente } = resendFalso();
    const deps = { supabase: banco(), resend: cliente, ...AMBIENTE, log: vi.fn() };
    for (let i = 0; i < LIMITES.aviso.limite; i++) await processarAviso(deps, { envio_id: ENVIO });
    expect((await processarAviso(deps, { envio_id: ENVIO })).status).toBe(429);
  });

  it("aviso: envio de outro paciente não consome o limite nem marca", async () => {
    const { cliente } = resendFalso();
    await processarAviso({ supabase: banco(), resend: cliente, ...AMBIENTE }, { envio_id: ENVIO_OUTRO });
    expect(AMBIENTE.limitador.consumir).not.toHaveBeenCalled();
    expect(AMBIENTE.marcarAvisado).not.toHaveBeenCalled();
  });

  it("aviso: falha do Resend depois de marcar não desmarca (sem novo envio)", async () => {
    const log = vi.fn();
    const { cliente, send } = resendFalso({ error: { message: "caiu", name: "application_error" } });
    const deps = { supabase: banco(), resend: cliente, ...AMBIENTE, log };
    await processarAviso(deps, { envio_id: ENVIO });
    await processarAviso(deps, { envio_id: ENVIO });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("aviso: falha do banco ao marcar ou limitar → 500, sem e-mail", async () => {
    const { cliente, send } = resendFalso();
    const quebra = async () => Promise.reject(new Error("fora do ar"));
    const r1 = await processarAviso(
      { supabase: banco(), resend: cliente, ...AMBIENTE, marcarAvisado: quebra, log: vi.fn() },
      { envio_id: ENVIO },
    );
    expect(r1.status).toBe(500);
    const r2 = await processarAviso(
      { supabase: banco(), resend: cliente, ...AMBIENTE, limitador: { consumir: quebra }, log: vi.fn() },
      { envio_id: ENVIO },
    );
    expect(r2.status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("montarAviso", () => {
  it("corta a observação em 1000 caracteres", () => {
    const longa = "a".repeat(1500);
    const { text } = montarAviso("Paciente", 1, longa);
    const linha = text.split("\n").find((l) => l.startsWith("Observação: "))!;
    expect(linha.length).toBe("Observação: ".length + 1000);
  });
});
