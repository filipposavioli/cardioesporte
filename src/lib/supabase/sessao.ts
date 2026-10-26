import { isAuthApiError, isAuthSessionMissingError, type AuthError } from "@supabase/supabase-js";

/**
 * O erro de `auth.getUser()` significa só "não há sessão válida" (mandar para /entrar)?
 * Sem cookie, ou token inválido/vencido/revogado (4xx do Auth) → true.
 * Queda de rede, 5xx ou limite de requisições (429) → false: é falha, não falta de login.
 */
export function semSessao(erro: AuthError | null): boolean {
  if (!erro) return false;
  if (isAuthSessionMissingError(erro)) return true;
  return isAuthApiError(erro) && erro.status >= 400 && erro.status < 500 && erro.status !== 429;
}
