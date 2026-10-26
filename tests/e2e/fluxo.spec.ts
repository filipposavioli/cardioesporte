import { expect, test } from "@playwright/test";
import { entrar, enviosPendentes, incorporarEnvio, limparLimites, novoPaciente } from "./apoio";

const PDF = Buffer.from("%PDF-1.4\n% fluxo\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

test.beforeAll(limparLimites);

test("PWA: manifest ligado à página e ícones servidos", async ({ page, request }) => {
  await page.goto("/entrar");
  const href = await page.locator("link[rel=manifest]").getAttribute("href");
  expect(href).toBeTruthy();
  const r = await request.get(href!);
  expect(r.ok()).toBe(true);
  const m = await r.json();
  expect(m).toMatchObject({ name: "savi.core · Meu painel", lang: "pt-BR", display: "standalone", theme_color: "#17203b" });
  for (const icone of m.icons as { src: string }[]) expect((await request.get(icone.src)).ok()).toBe(true);
  await expect(page.locator("link[rel=apple-touch-icon]")).toHaveCount(1);
});

test("fluxo completo: cadastro → painel → envio → incorporação; paciente sem painel", async ({ page, browser }) => {
  const email = novoPaciente({ publicar: true });
  await entrar(page, email);
  await expect(page.getByText("Paciente Exemplo").first()).toBeVisible();

  await page.goto("/enviar");
  await page.getByLabel("Escolher arquivos ou tirar foto").setInputFiles({ name: "exame.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Recebido. O Dr. Filippo vai revisar e atualizar seu painel.")).toBeVisible();

  const pendentes = enviosPendentes().filter((l) => l.includes(`<${email}>`));
  expect(pendentes).toHaveLength(1);
  incorporarEnvio(pendentes[0].split(/\s/)[0]);
  expect(enviosPendentes().filter((l) => l.includes(`<${email}>`))).toHaveLength(0);

  await page.reload();
  await expect(page.getByRole("list", { name: "Meus envios" }).getByText("Incorporado ao painel")).toBeVisible();

  const outro = novoPaciente();
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await entrar(p2, outro);
  await expect(p2.getByText("Seu painel está sendo preparado pelo Dr. Filippo.")).toBeVisible();
  await ctx.close();
});
