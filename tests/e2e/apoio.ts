import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { admin } from "../db/helpers";

const MAILPIT = "http://127.0.0.1:54324";
export const FIXTURE = "tests/fixtures/exemplo";

/**
 * Roda o CLI de publicação como o médico rodaria. (Importar scripts/savicore.ts direto não
 * funciona aqui: o Playwright transpila para CJS e o script usa import.meta.)
 */
function savicore(...args: string[]): void {
  execFileSync("npx", ["tsx", "scripts/savicore.ts", ...args], {
    stdio: "pipe",
  });
}

/** Cadastra um paciente fictício (e-mail único) pelo script; opcionalmente publica a fixture. */
export function novoPaciente(opcoes: { publicar?: boolean } = {}): string {
  const email = `e2e-${randomUUID()}@example.com`;
  savicore("cadastrar", "--nome", "Paciente Exemplo", "--email", email);
  if (opcoes.publicar) savicore("publicar", "--email", email, "--dados", FIXTURE);
  return email;
}

export function desativar(email: string): void {
  savicore("desativar", "--email", email);
}

type Mensagem = { ID: string; Subject: string; Created: string };

/** Mensagens do Mailpit (Supabase local) endereçadas a `email`, mais nova primeiro. */
export async function mensagensPara(email: string): Promise<Mensagem[]> {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  if (!r.ok) throw new Error(`Mailpit: ${r.status}`);
  const corpo = (await r.json()) as { messages: Mensagem[] };
  return corpo.messages;
}

/** Espera a `n`-ésima mensagem chegar para `email` e devolve assunto, HTML, texto e o código de 6 dígitos. */
export async function lerEmailDoCodigo(
  email: string,
  n = 1,
): Promise<{ assunto: string; html: string; texto: string; codigo: string }> {
  let msgs: Mensagem[] = [];
  await expect
    .poll(async () => (msgs = await mensagensPara(email)).length, {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(n);
  const r = await fetch(`${MAILPIT}/api/v1/message/${msgs[0].ID}`);
  const m = (await r.json()) as { Subject: string; HTML: string; Text: string };
  const codigo = m.Text.match(/\b(\d{6})\b/)?.[1] ?? m.HTML.match(/\b(\d{6})\b/)?.[1];
  if (!codigo) throw new Error("Código não encontrado no e-mail");
  return { assunto: m.Subject, html: m.HTML, texto: m.Text, codigo };
}

/** Pede o código para `digitado` e devolve o código que chegou em `caixa`. */
export async function pedirCodigo(page: Page, digitado: string, caixa = digitado, n = 1): Promise<string> {
  await page.goto("/entrar");
  await page.getByLabel("Seu e-mail").fill(digitado);
  await page.getByRole("button", { name: "Receber código" }).click();
  await expect(page.getByText("Se este e-mail estiver cadastrado, você receberá um código.")).toBeVisible();
  return (await lerEmailDoCodigo(caixa, n)).codigo;
}

/** Fluxo completo: e-mail → código → painel. */
export async function entrar(page: Page, email: string): Promise<void> {
  const codigo = await pedirCodigo(page, email);
  await page.getByLabel("Código de 6 dígitos").fill(codigo);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Zera os limites de login (tabela limites_login). Sem proxy na frente, todas as requisições
 * dos testes caem no mesmo balde de IP (20 pedidos/hora), que várias rodadas esgotariam.
 */
export async function limparLimites(): Promise<void> {
  const { error } = await admin().from("limites_login").delete().gte("id", 0);
  if (error) throw error;
}
