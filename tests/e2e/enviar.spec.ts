import { expect, test, type Page } from "@playwright/test";
import { admin } from "../db/helpers";
import { desativar, entrar, limparLimites, novoPaciente } from "./apoio";

const SUCESSO = "Recebido. O Dr. Filippo vai revisar e atualizar seu painel.";
const DESATIVADO = "Seu acesso ao painel está desativado. Fale com o consultório do Dr. Filippo.";

/** PDF mínimo válido (poucos bytes), suficiente para o bucket aceitar. */
function pdf(texto: string): Buffer {
  return Buffer.from(`%PDF-1.4\n% ${texto}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`);
}
/** PNG 1×1 transparente. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function pacienteId(email: string): Promise<string> {
  const { data, error } = await admin().from("pacientes").select("id").eq("email", email).single();
  if (error) throw error;
  return data.id as string;
}

async function enviosDo(pid: string) {
  const { data, error } = await admin().from("envios").select("id, arquivos, observacao, situacao").eq("paciente_id", pid);
  if (error) throw error;
  return data;
}

/** Todos os objetos do paciente no bucket (pastas de envio → arquivos). */
async function objetosDo(pid: string): Promise<string[]> {
  const bucket = admin().storage.from("envios");
  const { data: pastas, error } = await bucket.list(pid, { limit: 1000 });
  if (error) throw error;
  const caminhos: string[] = [];
  for (const p of pastas ?? []) {
    const { data: itens, error: e2 } = await bucket.list(`${pid}/${p.name}`, { limit: 1000 });
    if (e2) throw e2;
    for (const i of itens ?? []) caminhos.push(`${pid}/${p.name}/${i.name}`);
  }
  return caminhos;
}

const hoje = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());

async function abrirEnviar(page: Page): Promise<string> {
  const email = novoPaciente();
  await entrar(page, email);
  await page.goto("/enviar");
  await expect(page.getByRole("heading", { level: 1, name: "Enviar exame" })).toBeVisible();
  return email;
}

test.beforeAll(limparLimites);

test("anônimo em /enviar vai para /entrar; rotas da API respondem 401", async ({ page, request }) => {
  await page.goto("/enviar");
  await expect(page).toHaveURL("/entrar");
  for (const rota of ["/api/envios/aviso", "/api/envios/limpar"]) {
    const r = await request.post(rota, { data: { envio_id: crypto.randomUUID() } });
    expect(r.status()).toBe(401);
  }
});

test("envia PDF e aparece em Meus envios como Recebido", async ({ page }) => {
  const email = await abrirEnviar(page);
  const pid = await pacienteId(email);
  await expect(page.getByText("Nenhum envio ainda.")).toBeVisible();

  const campo = page.getByLabel("Escolher arquivos ou tirar foto");
  await expect(campo).toHaveAttribute("accept", "application/pdf,image/*,.heic,.heif");
  await expect(campo).toHaveAttribute("multiple", "");
  await campo.setInputFiles([
    { name: "Hemograma de março.pdf", mimeType: "application/pdf", buffer: pdf("hemograma") },
    { name: "foto.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(page.getByText("Hemograma de março.pdf")).toBeVisible();
  await expect(page.getByText("foto.png")).toBeVisible();
  // Um formato não aceito aparece com o erro e bloqueia o envio até ser removido.
  await campo.setInputFiles({ name: "laudo.docx", mimeType: "application/msword", buffer: Buffer.from("x") });
  await expect(page.getByText(/formato não aceito/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar" })).toBeDisabled();
  await page.getByRole("button", { name: "Remover laudo.docx" }).click();

  await page.getByLabel("Observação (opcional)").fill("Exames de rotina de outubro");
  const aviso = page.waitForResponse("**/api/envios/aviso");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(SUCESSO)).toBeVisible();
  // Aviso ao médico pedido depois do registro (sem RESEND_API_KEY local: 200, não enviado).
  expect((await aviso).status()).toBe(200);

  const lista = page.getByRole("list", { name: "Meus envios" });
  const item = lista.getByRole("listitem").first();
  await expect(item).toContainText(hoje());
  await expect(item).toContainText("2 arquivos");
  await expect(item).toContainText("Recebido");

  const envios = await enviosDo(pid);
  expect(envios).toHaveLength(1);
  const [envio] = envios;
  expect(envio.situacao).toBe("recebido");
  expect(envio.observacao).toBe("Exames de rotina de outubro");
  expect(envio.arquivos).toEqual([
    `${pid}/${envio.id}/Hemograma-de-marco.pdf`,
    `${pid}/${envio.id}/foto.png`,
  ]);
  expect((await objetosDo(pid)).sort()).toEqual([...envio.arquivos].sort());
});

test("falha parcial não registra envio", async ({ page }) => {
  const email = await abrirEnviar(page);
  const pid = await pacienteId(email);

  let uploads = 0;
  await page.route("**/storage/v1/object/envios/**", async (rota) => {
    if (rota.request().method() !== "POST") return rota.continue();
    uploads += 1;
    if (uploads === 2) {
      return rota.fulfill({ status: 500, contentType: "application/json", body: '{"error":"falha simulada"}' });
    }
    return rota.continue();
  });

  await page.getByLabel("Escolher arquivos ou tirar foto").setInputFiles([
    { name: "primeiro.pdf", mimeType: "application/pdf", buffer: pdf("um") },
    { name: "segundo.pdf", mimeType: "application/pdf", buffer: pdf("dois") },
  ]);
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível enviar" })).toBeVisible();
  await expect(page.getByText(SUCESSO)).toHaveCount(0);
  expect(uploads).toBe(2);
  expect(await enviosDo(pid)).toHaveLength(0);
  // O 1º arquivo, que chegou a subir, foi removido do bucket.
  await expect.poll(() => objetosDo(pid), { timeout: 10000 }).toEqual([]);
  await expect(page.getByText("Nenhum envio ainda.")).toBeVisible();

  // Tentar de novo (sem a falha) conclui o envio com os mesmos arquivos.
  await page.unroute("**/storage/v1/object/envios/**");
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByText(SUCESSO)).toBeVisible();
  expect(await enviosDo(pid)).toHaveLength(1);
  expect(await objetosDo(pid)).toHaveLength(2);
});

test("paciente desativado não envia", async ({ page }) => {
  const email = novoPaciente();
  await entrar(page, email);
  desativar(email);
  await page.goto("/enviar");
  await expect(page.getByText(DESATIVADO)).toBeVisible();
  await expect(page.getByLabel("Escolher arquivos ou tirar foto")).toHaveCount(0);
});
