import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  desativar,
  entrar,
  lerEmailDoCodigo,
  limparLimites,
  mensagensPara,
  novoPaciente,
  pedirCodigo,
} from "./apoio";

const NEUTRA = "Se este e-mail estiver cadastrado, você receberá um código.";
const ERRO_CODIGO = "Código incorreto ou vencido. Peça um novo.";
const MUITAS = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
const DESATIVADO = "Seu acesso ao painel está desativado. Fale com o consultório do Dr. Filippo.";

test.beforeAll(limparLimites);

test("e-mail não cadastrado mostra mensagem neutra", async ({ page }) => {
  const email = `ninguem-${randomUUID()}@example.com`;
  await page.goto("/entrar");
  await page.getByLabel("Seu e-mail").fill(email);
  const inicio = Date.now();
  await page.getByRole("button", { name: "Receber código" }).click();
  await expect(page.getByText(NEUTRA)).toBeVisible();
  // Piso de 2 s: não cadastrado não responde mais rápido que cadastrado (R12).
  expect(Date.now() - inicio).toBeGreaterThanOrEqual(1900);
  // Mesma tela de quem está cadastrado: não revela se o e-mail existe.
  const campo = page.getByLabel("Código de 6 dígitos");
  await expect(campo).toBeVisible();
  await expect(campo).toHaveAttribute("inputmode", "numeric");
  await expect(campo).toHaveAttribute("autocomplete", "one-time-code");
  await expect(campo).toHaveAttribute("maxlength", "6");
  // Nenhum e-mail sai para quem não é paciente.
  await page.waitForTimeout(1000);
  expect(await mensagensPara(email)).toHaveLength(0);
  // Dá para voltar e trocar o e-mail.
  await page.getByRole("button", { name: "Trocar e-mail" }).click();
  await expect(page.getByLabel("Seu e-mail")).toHaveValue(email);
});

test("paciente cadastrado entra com o código e vê o painel", async ({ page }) => {
  const email = novoPaciente({ publicar: true });
  const codigo = await pedirCodigo(page, email);

  const msg = await lerEmailDoCodigo(email);
  expect(msg.assunto).toBe("Seu código de acesso savi.core");
  expect(msg.html).toContain(codigo);
  expect(msg.html).not.toMatch(/<a\s/i); // só o código, sem link

  await page.getByLabel("Código de 6 dígitos").fill(codigo);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Paciente Exemplo" })).toBeVisible();

  // Já logado, /entrar leva de volta ao painel.
  await page.goto("/entrar");
  await expect(page).toHaveURL("/");
});

test("e-mail com maiúsculas entra", async ({ page }) => {
  const email = novoPaciente({ publicar: true });
  const codigo = await pedirCodigo(page, `  ${email.toUpperCase()} `, email);
  await page.getByLabel("Código de 6 dígitos").fill(codigo);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Paciente Exemplo" })).toBeVisible();
});

test("código errado mostra erro", async ({ page }) => {
  const email = novoPaciente({ publicar: true });
  const codigo = await pedirCodigo(page, email);
  const errado = String((Number(codigo) + 1) % 1_000_000).padStart(6, "0");
  await page.getByLabel("Código de 6 dígitos").fill(errado);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: ERRO_CODIGO })).toHaveText(ERRO_CODIGO);
  await expect(page).toHaveURL("/entrar");

  // Volta, pede um novo código e entra com ele.
  await page.getByRole("button", { name: "Trocar e-mail" }).click();
  await page.waitForTimeout(1500); // [auth.email] max_frequency = "1s" entre envios ao mesmo e-mail
  await page.getByRole("button", { name: "Receber código" }).click();
  await expect(page.getByText(NEUTRA)).toBeVisible();
  const novo = (await lerEmailDoCodigo(email, 2)).codigo;
  await page.getByLabel("Código de 6 dígitos").fill(novo);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
});

test("anônimo em / vai para /entrar", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/entrar");
  await page.goto("/enviar");
  await expect(page).toHaveURL("/entrar");
  await expect(page.getByLabel("Seu e-mail")).toBeVisible();
});

test("sair volta para /entrar", async ({ page }) => {
  const email = novoPaciente({ publicar: true });
  await entrar(page, email);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL("/entrar");
  await page.goto("/");
  await expect(page).toHaveURL("/entrar");
});

test("paciente desativado vê aviso", async ({ page }) => {
  const email = novoPaciente({ publicar: true });
  await entrar(page, email);
  desativar(email);
  await page.reload();
  await expect(page.getByText(DESATIVADO, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enviar exame" })).toHaveCount(0);
  await expect(page.getByText("Paciente Exemplo")).toHaveCount(0);
});

test("/dev/painel abre sem sessão em desenvolvimento", async ({ page }) => {
  await page.goto("/dev/painel");
  await expect(page).toHaveURL("/dev/painel");
  await expect(page.getByRole("heading", { level: 1, name: "Paciente Exemplo" })).toBeVisible();
});

test("6ª tentativa errada bloqueia mesmo com código certo", async ({ page }) => {
  const email = novoPaciente({ publicar: true });
  const codigo = await pedirCodigo(page, email);
  const errado = String((Number(codigo) + 1) % 1_000_000).padStart(6, "0");
  const campo = page.getByLabel("Código de 6 dígitos");
  for (let i = 0; i < 5; i++) {
    await campo.fill(errado);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: ERRO_CODIGO })).toBeVisible();
  }
  await campo.fill(codigo);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: MUITAS })).toHaveText(MUITAS);
  await page.goto("/");
  await expect(page).toHaveURL("/entrar");
});
