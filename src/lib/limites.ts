import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/** Limites de login do app (decisão R11). Janelas em segundos. */
export const LIMITES = {
  /** Códigos errados por e-mail. */
  verificar: { limite: 5, janelaS: 15 * 60 },
  /** Pedidos de código por e-mail. */
  pedirEmail: { limite: 5, janelaS: 60 * 60 },
  /** Pedidos de código por IP do cliente. */
  pedirIp: { limite: 20, janelaS: 60 * 60 },
} as const;

export type Limite = { limite: number; janelaS: number };

/** Chave do contador: tipo + sha256 do valor (e-mail/IP nunca ficam em claro no banco). */
export function chaveLimite(tipo: string, valor: string): string {
  return `${tipo}:${createHash("sha256").update(valor).digest("hex")}`;
}

/**
 * IP do cliente: 1º endereço do x-forwarded-for (em produção, posto pela Vercel), senão
 * x-real-ip, senão "desconhecido". Nenhum outro dado do cliente é aceito.
 */
export function ipDoCliente(h: Headers): string {
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  const real = h.get("x-real-ip")?.trim();
  return real || "desconhecido";
}

/** Contadores na tabela `limites_login` (só service role). `agora` é injetável para testes. */
export function criarLimitador(
  db: SupabaseClient = criarClienteAdmin(),
  agora: () => Date = () => new Date(),
) {
  return {
    /** Consome uma tentativa; devolve o id dela, ou null se o limite já foi atingido. Lança se o banco falhar. */
    async consumir(chave: string, { limite, janelaS }: Limite): Promise<number | null> {
      const { data, error } = await db.rpc("consumir_limite", {
        p_chave: chave,
        p_limite: limite,
        p_janela_s: janelaS,
        p_agora: agora().toISOString(),
      });
      if (error) throw new Error(`limites_login: ${error.message}`);
      return (data as number | null) ?? null;
    },
    /** Devolve a vaga de uma tentativa que não deve contar (ex.: código certo). */
    async devolver(id: number): Promise<void> {
      const { error } = await db.from("limites_login").delete().eq("id", id);
      if (error) throw new Error(`limites_login: ${error.message}`);
    },
  };
}

/** Executa `trabalho` e só termina depois de pelo menos `ms` (com sucesso ou erro). */
export async function aoMenos<T>(ms: number, trabalho: () => Promise<T>): Promise<T> {
  const piso = new Promise<void>((r) => setTimeout(r, ms));
  try {
    return await trabalho();
  } finally {
    await piso;
  }
}
