import type { SupabaseClient } from "@supabase/supabase-js";

type Linha = Record<string, unknown>;

/**
 * Supabase falso para testar rotas sem banco: só `auth.getUser` e
 * `from(t).select().eq().limit().maybeSingle()`. A "RLS" é simulada pelo filtro `visivel`
 * (o que o paciente logado enxerga de cada tabela).
 */
export function supabaseFalso(opcoes: {
  usuario: { id: string } | null;
  tabelas: Record<string, Linha[]>;
  visivel?: (tabela: string, linha: Linha) => boolean;
  erro?: string;
}): SupabaseClient {
  const visivel = opcoes.visivel ?? (() => true);
  return {
    auth: {
      getUser: async () =>
        opcoes.usuario
          ? { data: { user: opcoes.usuario }, error: null }
          : { data: { user: null }, error: { name: "AuthSessionMissingError", message: "sem sessão" } },
    },
    from(tabela: string) {
      const filtros: [string, unknown][] = [];
      const q = {
        select: () => q,
        eq: (col: string, v: unknown) => (filtros.push([col, v]), q),
        limit: () => q,
        maybeSingle: async () => {
          if (opcoes.erro) return { data: null, error: { message: opcoes.erro } };
          const linhas = (opcoes.tabelas[tabela] ?? [])
            .filter((l) => visivel(tabela, l))
            .filter((l) => filtros.every(([c, v]) => l[c] === v));
          return { data: linhas[0] ?? null, error: null };
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
}
