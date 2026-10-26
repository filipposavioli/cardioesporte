import { describe, expect, it } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
} from "@supabase/supabase-js";
import { semSessao } from "@/lib/supabase/sessao";

describe("semSessao", () => {
  it("sem erro não é falta de sessão (usuário logado)", () => {
    expect(semSessao(null)).toBe(false);
  });

  it("sem cookie de sessão → sem sessão", () => {
    expect(semSessao(new AuthSessionMissingError())).toBe(true);
  });

  it("token inválido, vencido ou revogado (4xx do Auth) → sem sessão", () => {
    expect(semSessao(new AuthApiError("invalid JWT", 403, "bad_jwt"))).toBe(true);
    expect(semSessao(new AuthApiError("User not found", 403, "user_not_found"))).toBe(true);
    expect(semSessao(new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"))).toBe(true);
  });

  it("queda de rede, 5xx ou limite de requisições → falha (não é falta de sessão)", () => {
    expect(semSessao(new AuthRetryableFetchError("fetch failed", 0))).toBe(false);
    expect(semSessao(new AuthApiError("boom", 500, "unexpected_failure"))).toBe(false);
    expect(semSessao(new AuthApiError("too many", 429, "over_request_rate_limit"))).toBe(false);
    expect(semSessao(new AuthUnknownError("?", new Error("x")))).toBe(false);
  });
});
