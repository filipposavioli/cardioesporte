import type { SupabaseClient } from "@supabase/supabase-js";
import { lerEnvioId, usuarioLogado, type Resposta } from "./rotas";

/** O pedaço do cliente do Resend que usamos (o real ou um falso nos testes). */
export type EnviadorEmail = {
  emails: {
    send(msg: { from: string; to: string; subject: string; text: string }): Promise<{ error: unknown }>;
  };
};

export type DepsAviso = {
  /** Cliente com a sessão do paciente: a RLS garante que ele só lê os próprios envios. */
  supabase: SupabaseClient;
  /** `null` quando não há RESEND_API_KEY. */
  resend: EnviadorEmail | null;
  medicoEmail?: string;
  remetente?: string;
  log?: (...args: unknown[]) => void;
};

const umaLinha = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

/** Texto do aviso: só nome, quantidade e observação. Sem anexos, links, caminhos ou resultados. */
export function montarAviso(nome: string, nArquivos: number, observacao: string | null) {
  const quem = umaLinha(nome);
  const qtd = `${nArquivos} ${nArquivos === 1 ? "arquivo" : "arquivos"}`;
  return {
    subject: `Novo exame de ${quem}`,
    text: [
      `${quem} enviou ${qtd}.`,
      "",
      `Observação: ${observacao?.trim() || "(nenhuma)"}`,
      "",
      "Para ver os envios pendentes: npm run savicore -- envios --pendentes",
    ].join("\n"),
  };
}

/**
 * `POST /api/envios/aviso {envio_id}`: confirma que o envio é do paciente logado e avisa o médico
 * por e-mail. Se o e-mail falhar (ou não estiver configurado), responde 200 mesmo assim: o envio
 * já está registrado e aparece em `savicore envios --pendentes`.
 */
export async function processarAviso(deps: DepsAviso, corpo: unknown): Promise<Resposta> {
  const log = deps.log ?? console.error;
  const usuario = await usuarioLogado(deps.supabase);
  if (!usuario) return { status: 401, corpo: { erro: "Entre para continuar." } };

  const envioId = lerEnvioId(corpo);
  if (!envioId) return { status: 400, corpo: { erro: "envio_id inválido." } };

  const envio = await deps.supabase
    .from("envios")
    .select("id, paciente_id, arquivos, observacao")
    .eq("id", envioId)
    .maybeSingle();
  if (envio.error) {
    log("aviso: falha ao ler o envio", envio.error);
    return { status: 500, corpo: { erro: "Falha ao ler o envio." } };
  }
  // Envio de outro paciente é invisível pela RLS: mesmo 404 de um id inexistente.
  if (!envio.data) return { status: 404, corpo: { erro: "Envio não encontrado." } };

  const pac = await deps.supabase
    .from("pacientes")
    .select("nome")
    .eq("id", envio.data.paciente_id)
    .maybeSingle();
  if (pac.error || !pac.data) {
    log("aviso: falha ao ler o paciente", pac.error);
    return { status: 500, corpo: { erro: "Falha ao ler o paciente." } };
  }

  if (!deps.resend || !deps.medicoEmail || !deps.remetente) {
    log("aviso: e-mail não configurado (RESEND_API_KEY, MEDICO_EMAIL, AVISO_REMETENTE); aviso não enviado", envioId);
    return { status: 200, corpo: { ok: true, avisado: false } };
  }

  const arquivos = (envio.data.arquivos as string[] | null) ?? [];
  const msg = montarAviso(String(pac.data.nome), arquivos.length, envio.data.observacao as string | null);
  try {
    const { error } = await deps.resend.emails.send({
      from: deps.remetente,
      to: deps.medicoEmail,
      subject: msg.subject,
      text: msg.text,
    });
    if (error) {
      log("aviso: o Resend recusou o e-mail", envioId, error);
      return { status: 200, corpo: { ok: true, avisado: false } };
    }
  } catch (e) {
    log("aviso: falha ao enviar o e-mail", envioId, e);
    return { status: 200, corpo: { ok: true, avisado: false } };
  }
  return { status: 200, corpo: { ok: true, avisado: true } };
}
