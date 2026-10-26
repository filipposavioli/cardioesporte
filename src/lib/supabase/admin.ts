import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Cliente com service role (ignora RLS). Só no servidor e em scripts; nunca no navegador. */
export function criarClienteAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const faltando = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !chave && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (!url || !chave) {
    throw new Error(
      `Variáveis de ambiente ausentes: ${faltando.join(", ")}. Defina-as em .env.local.`,
    );
  }
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
