"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizarEmail } from "@/lib/email";
import { aoMenos, chaveLimite, criarLimitador, ipDoCliente, LIMITES } from "@/lib/limites";
import { criarClienteServidor } from "@/lib/supabase/server";

// "use server" só exporta funções assíncronas.
const ERRO_CODIGO = "Código incorreto ou vencido. Peça um novo.";
const MUITAS = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

/** Tempo mínimo de `pedirCodigo`: cadastrado (envia e-mail) e não cadastrado respondem igual (R12). */
const PISO_PEDIR_MS = 2000;

/** Códigos do Auth que só dizem "este e-mail não é paciente": esperados, não são falha. */
const NAO_CADASTRADO = new Set(["otp_disabled", "signup_disabled", "user_not_found"]);

/**
 * Pede o código de 6 dígitos por e-mail. Sempre `{ ok: true }`, depois de pelo menos 2 s: a tela
 * mostra a mesma mensagem neutra para qualquer e-mail, cadastrado ou não, dentro ou fora do limite
 * (5 pedidos/e-mail/hora, 20/IP/hora). Falhas de verdade ficam só no log do servidor.
 */
export async function pedirCodigo(email: string): Promise<{ ok: true }> {
  const ip = ipDoCliente(await headers());
  const normalizado = normalizarEmail(String(email ?? ""));
  await aoMenos(PISO_PEDIR_MS, async () => {
    try {
      const limites = criarLimitador();
      const dentro =
        (await limites.consumir(chaveLimite("pedir-ip", ip), LIMITES.pedirIp)) !== null &&
        (await limites.consumir(chaveLimite("pedir-email", normalizado), LIMITES.pedirEmail)) !== null;
      if (!dentro) return;

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
  });
  return { ok: true };
}

/**
 * Confere o código. No máximo 5 códigos errados por e-mail a cada 15 min (cadastrado ou não):
 * acima disso recusa sem nem consultar o Supabase. Em caso de acerto a sessão fica nos cookies.
 */
export async function verificarCodigo(
  email: string,
  codigo: string,
): Promise<{ ok: true } | { erro: string }> {
  const normalizado = normalizarEmail(String(email ?? ""));
  const token = String(codigo ?? "").replace(/\D/g, "");
  if (token.length !== 6) return { erro: ERRO_CODIGO };
  try {
    // A tentativa é consumida antes de verificar (sem corrida entre chamadas simultâneas)
    // e devolvida se o código estiver certo: só os erros contam.
    const limites = criarLimitador();
    const tentativa = await limites.consumir(chaveLimite("verificar", normalizado), LIMITES.verificar);
    if (tentativa === null) return { erro: MUITAS };

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.auth.verifyOtp({ email: normalizado, token, type: "email" });
    if (error?.status === 429) {
      await limites.devolver(tentativa);
      console.error("verificarCodigo: limite do Supabase", { code: error.code, message: error.message });
      return { erro: MUITAS };
    }
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
    await limites.devolver(tentativa).catch((e) => console.error("verificarCodigo: devolver tentativa", e));
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
