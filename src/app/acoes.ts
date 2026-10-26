"use server";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Encerra a sessão e volta para /entrar. (Provisório: a Task 7 completa o fluxo de login.) */
export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
