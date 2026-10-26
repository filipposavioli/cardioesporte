import type { SupabaseClient } from "@supabase/supabase-js";
import { lerEnvioId, usuarioLogado, type Resposta } from "./rotas";

/** `storage.from("envios")` do cliente admin (service role). */
export type BucketEnvios = ReturnType<SupabaseClient["storage"]["from"]>;

export type DepsLimpeza = {
  /** Cliente com a sessão do paciente (RLS). */
  supabase: SupabaseClient;
  /** Bucket pelo cliente admin: o paciente não pode apagar objetos. */
  bucket: BucketEnvios;
  log?: (...args: unknown[]) => void;
};

/**
 * `POST /api/envios/limpar {envio_id}`: apaga os arquivos de um envio que falhou no meio do
 * upload. Só a pasta `<paciente_id>/<envio_id>/` do próprio paciente, e só se o envio NÃO foi
 * registrado em `envios` (envio registrado é do médico; nunca se apaga por aqui).
 */
export async function processarLimpeza(deps: DepsLimpeza, corpo: unknown): Promise<Resposta> {
  const log = deps.log ?? console.error;
  const usuario = await usuarioLogado(deps.supabase);
  if (!usuario) return { status: 401, corpo: { erro: "Entre para continuar." } };

  const envioId = lerEnvioId(corpo);
  if (!envioId) return { status: 400, corpo: { erro: "envio_id inválido." } };

  // RLS: só a linha do próprio paciente, e só se ativo.
  const pac = await deps.supabase.from("pacientes").select("id").limit(1).maybeSingle();
  if (pac.error) {
    log("limpar: falha ao ler o paciente", pac.error);
    return { status: 500, corpo: { erro: "Falha ao ler o paciente." } };
  }
  if (!pac.data) return { status: 403, corpo: { erro: "Acesso desativado." } };

  const envio = await deps.supabase.from("envios").select("id").eq("id", envioId).maybeSingle();
  if (envio.error) {
    log("limpar: falha ao ler o envio", envio.error);
    return { status: 500, corpo: { erro: "Falha ao ler o envio." } };
  }
  if (envio.data) return { status: 409, corpo: { erro: "Envio já registrado." } };

  const pasta = `${pac.data.id}/${envioId}`;
  const lista = await deps.bucket.list(pasta, { limit: 1000 });
  if (lista.error) {
    log("limpar: falha ao listar", pasta, lista.error);
    return { status: 500, corpo: { erro: "Falha ao limpar." } };
  }
  const caminhos = (lista.data ?? []).map((o) => `${pasta}/${o.name}`);
  if (caminhos.length > 0) {
    const r = await deps.bucket.remove(caminhos);
    if (r.error) {
      log("limpar: falha ao apagar", pasta, r.error);
      return { status: 500, corpo: { erro: "Falha ao limpar." } };
    }
  }
  return { status: 200, corpo: { ok: true, removidos: caminhos.length } };
}
