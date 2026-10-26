import type { SupabaseClient } from "@supabase/supabase-js";

/** Resultado de uma rota da API, independente do Next (para testar sem servidor). */
export type Resposta = { status: number; corpo: Record<string, unknown> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê `{ envio_id: <uuid> }` do corpo; `null` se não vier assim. */
export function lerEnvioId(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const id = (corpo as { envio_id?: unknown }).envio_id;
  return typeof id === "string" && UUID.test(id) ? id.toLowerCase() : null;
}

/** O usuário logado (pela sessão do cliente do paciente), ou `null`. */
export async function usuarioLogado(supabase: SupabaseClient): Promise<{ id: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
}

/** Converte para a resposta do Next; recusa POST que não seja JSON (barra formulários de outros sites). */
export async function responderJson(
  request: Request,
  tratar: (corpo: unknown) => Promise<Resposta>,
): Promise<Response> {
  const tipo = request.headers.get("content-type") ?? "";
  if (!tipo.toLowerCase().startsWith("application/json")) {
    return Response.json({ erro: "Envie JSON." }, { status: 415 });
  }
  const corpo: unknown = await request.json().catch(() => null);
  const r = await tratar(corpo);
  return Response.json(r.corpo, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
