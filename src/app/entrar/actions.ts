"use server";
import { redirect } from "next/navigation";
import { normalizarEmail } from "@/lib/email";
import { criarClienteServidor } from "@/lib/supabase/server";

// "use server" só exporta funções assíncronas.
const ERRO_CODIGO = "Código incorreto ou vencido. Peça um novo.";

/** Códigos do Auth que só dizem "este e-mail não é paciente": esperados, não são falha. */
const NAO_CADASTRADO = new Set(["otp_disabled", "signup_disabled", "user_not_found"]);

/**
 * Pede o código de 6 dígitos por e-mail. Sempre `{ ok: true }`: a tela mostra a mesma mensagem
 * neutra para qualquer e-mail, cadastrado ou não. Falhas de verdade ficam só no log do servidor.
 */
export async function pedirCodigo(email: string): Promise<{ ok: true }> {
  const normalizado = normalizarEmail(String(email ?? ""));
  try {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizado,
      options: { shouldCreateUser: false },
    });
    if (error && !NAO_CADASTRADO.has(error.code ?? "")) {
      console.error("pedirCodigo: falha ao enviar o código", {
        code: error.code,
        status: error.status,
        message: error.message,
      });
    }
  } catch (e) {
    console.error("pedirCodigo: erro inesperado", e);
  }
  return { ok: true };
}

/** Confere o código. Em caso de acerto a sessão fica nos cookies (~30 dias, renovada pelo proxy). */
export async function verificarCodigo(
  email: string,
  codigo: string,
): Promise<{ ok: true } | { erro: string }> {
  const normalizado = normalizarEmail(String(email ?? ""));
  const token = String(codigo ?? "").replace(/\D/g, "");
  if (token.length !== 6) return { erro: ERRO_CODIGO };
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizado,
      token,
      type: "email",
    });
    if (error || !data.session) {
      if (error && error.code !== "otp_expired") {
        console.error("verificarCodigo: falha", {
          code: error.code,
          status: error.status,
          message: error.message,
        });
      }
      return { erro: ERRO_CODIGO };
    }
    return { ok: true };
  } catch (e) {
    console.error("verificarCodigo: erro inesperado", e);
    return { erro: ERRO_CODIGO };
  }
}

/** Encerra a sessão e volta para /entrar. */
export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  // Só este aparelho: sair no celular não derruba a sessão do computador.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/entrar");
}
