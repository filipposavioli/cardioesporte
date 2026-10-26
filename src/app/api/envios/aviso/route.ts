import { Resend } from "resend";
import { processarAviso } from "@/lib/aviso";
import { responderJson } from "@/lib/rotas";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Avisa o médico por e-mail de um envio do paciente logado. Ver `processarAviso`. */
export async function POST(request: Request) {
  return responderJson(request, async (corpo) => {
    const chave = process.env.RESEND_API_KEY;
    return processarAviso(
      {
        supabase: await criarClienteServidor(),
        resend: chave ? new Resend(chave) : null,
        medicoEmail: process.env.MEDICO_EMAIL,
        remetente: process.env.AVISO_REMETENTE,
      },
      corpo,
    );
  });
}
