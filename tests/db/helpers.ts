import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Ambiente = { url: string; anonKey: string; serviceKey: string };

let ambiente: Ambiente | undefined;

/** Lê URL e chaves do `.env.local`; sem ele, usa `npx supabase status -o env`. */
function carregarAmbiente(): Ambiente {
  if (ambiente) return ambiente;
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    const saida = execSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const valores = Object.fromEntries(
      saida
        .split("\n")
        .map((linha) => linha.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => [m[1], m[2]]),
    );
    url ||= valores.API_URL;
    anonKey ||= valores.ANON_KEY;
    serviceKey ||= valores.SERVICE_ROLE_KEY;
  }
  if (!url || !anonKey || !serviceKey) {
    throw new Error("Supabase local não encontrado: rode `npx supabase start`.");
  }
  ambiente = { url, anonKey, serviceKey };
  return ambiente;
}

const semSessao = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

let clienteAdmin: SupabaseClient | undefined;

/** Cliente com service role (ignora RLS). Só para testes. */
export function admin(): SupabaseClient {
  const { url, serviceKey } = carregarAmbiente();
  clienteAdmin ??= createClient(url, serviceKey, semSessao);
  return clienteAdmin;
}

/** Cliente anon sem sessão. */
export function anonimo(): SupabaseClient {
  const { url, anonKey } = carregarAmbiente();
  return createClient(url, anonKey, semSessao);
}

/**
 * Cria usuário confirmado + linha em `pacientes` e devolve um cliente anon
 * autenticado por senha (senha só existe nos testes; o app usa código OTP).
 */
export async function criarPacienteTeste(
  nome: string,
): Promise<{ pacienteId: string; client: SupabaseClient }> {
  const email = `teste-${randomUUID()}@example.com`;
  const password = `Senha-${randomUUID()}`;

  const { data: criado, error: erroUsuario } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (erroUsuario || !criado.user) throw erroUsuario ?? new Error("usuário não criado");

  const { data: paciente, error: erroPaciente } = await admin()
    .from("pacientes")
    .insert({ nome, email, user_id: criado.user.id })
    .select("id")
    .single();
  if (erroPaciente) throw erroPaciente;

  const client = anonimo();
  const { error: erroLogin } = await client.auth.signInWithPassword({ email, password });
  if (erroLogin) throw erroLogin;

  return { pacienteId: paciente.id as string, client };
}
