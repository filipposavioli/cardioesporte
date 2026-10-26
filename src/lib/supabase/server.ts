import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Cliente do Supabase com a sessão do usuário (cookies). Server Components, Server Actions e Route Handlers. */
export async function criarClienteServidor(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error(
      "Variáveis de ambiente ausentes: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY. Defina-as em .env.local.",
    );
  }
  const loja = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => loja.set(name, value, options));
        } catch {
          // Em Server Components não dá para gravar cookies; o middleware (Task 7) renova a sessão.
        }
      },
    },
  });
}
