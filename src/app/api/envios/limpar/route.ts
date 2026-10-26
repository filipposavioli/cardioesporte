import { processarLimpeza } from "@/lib/limpeza";
import { responderJson } from "@/lib/rotas";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Apaga os arquivos de um envio que falhou no meio do upload. Ver `processarLimpeza`. */
export async function POST(request: Request) {
  return responderJson(request, async (corpo) =>
    processarLimpeza(
      { supabase: await criarClienteServidor(), bucket: criarClienteAdmin().storage.from("envios") },
      corpo,
    ),
  );
}
