/**
 * CLI de publicação do portal savi.core.
 *
 *   npm run savicore -- cadastrar --nome "<Nome>" --email <e-mail> [--nascimento AAAA-MM-DD]
 *   npm run savicore -- publicar --email <e-mail> --dados <pasta com os 5 JSONs>
 *   npm run savicore -- envios [--pendentes]
 *   npm run savicore -- baixar --envio <id> --destino <pasta>
 *   npm run savicore -- incorporar --envio <id>
 *   npm run savicore -- desativar --email <e-mail>
 *   npm run savicore -- reativar --email <e-mail>
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { normalizarEmail } from "../src/lib/email";
import { validarPasta } from "../src/lib/dados";
import { criarClienteAdmin } from "../src/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PacienteResumo = { id: string; nome: string; email: string };

export type Envio = {
  id: string;
  situacao: "recebido" | "incorporado";
  enviado_em: string;
  observacao: string | null;
  arquivos: string[];
  paciente: { nome: string; email: string };
};

function checarUuid(valor: string, rotulo: string): string {
  if (!UUID.test(valor)) throw new Error(`${rotulo} inválido: "${valor}"`);
  return valor.toLowerCase();
}

async function buscarPaciente(email: string): Promise<PacienteResumo & { ativo: boolean }> {
  const normalizado = normalizarEmail(email);
  const { data, error } = await criarClienteAdmin()
    .from("pacientes")
    .select("id, nome, email, ativo")
    .eq("email", normalizado)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar paciente: ${error.message}`);
  if (!data) throw new Error(`Paciente não cadastrado: ${normalizado}`);
  return data;
}

export async function cadastrar(args: {
  nome: string;
  email: string;
  nascimento?: string;
}): Promise<PacienteResumo> {
  const nome = args.nome.trim();
  const email = normalizarEmail(args.email);
  if (!nome) throw new Error("Nome obrigatório.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`E-mail inválido: "${args.email}"`);
  if (args.nascimento !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(args.nascimento)) {
    throw new Error("Nascimento deve estar no formato AAAA-MM-DD.");
  }

  const db = criarClienteAdmin();
  const { data: existente, error: erroBusca } = await db
    .from("pacientes")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (erroBusca) throw new Error(`Falha ao buscar paciente: ${erroBusca.message}`);
  if (existente) throw new Error(`Paciente já cadastrado: ${email}`);

  const { data: criado, error: erroAuth } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (erroAuth || !criado.user) {
    if (erroAuth && /already|registered|exists/i.test(erroAuth.message)) {
      throw new Error(`Paciente já cadastrado: ${email}`);
    }
    throw new Error(`Falha ao criar usuário: ${erroAuth?.message ?? "desconhecida"}`);
  }

  const { data, error } = await db
    .from("pacientes")
    .insert({ nome, email, nascimento: args.nascimento ?? null, user_id: criado.user.id })
    .select("id, nome, email")
    .single();
  if (error) {
    await db.auth.admin.deleteUser(criado.user.id); // desfaz para não deixar usuário órfão
    throw new Error(
      error.code === "23505"
        ? `Paciente já cadastrado: ${email}`
        : `Falha ao gravar paciente: ${error.message}`,
    );
  }
  return data;
}

export async function publicar(args: { email: string; dados: string }): Promise<{ id: string }> {
  const paciente = await buscarPaciente(args.email);
  const painel = validarPasta(args.dados); // lança antes de gravar qualquer coisa
  const { data, error } = await criarClienteAdmin()
    .from("paineis")
    .insert({ paciente_id: paciente.id, ...painel })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao publicar: ${error.message}`);
  return { id: data.id };
}

type LinhaEnvio = Omit<Envio, "paciente"> & {
  paciente_id: string;
  pacientes: { nome: string; email: string } | null;
};

function paraEnvio(l: LinhaEnvio): Envio & { paciente_id: string } {
  const { pacientes, ...resto } = l;
  return { ...resto, paciente: { nome: pacientes?.nome ?? "?", email: pacientes?.email ?? "?" } };
}

const COLUNAS_ENVIO = "id, paciente_id, situacao, enviado_em, observacao, arquivos, pacientes(nome, email)";

export async function listarEnvios(
  args: { pendentes?: boolean } = {},
): Promise<(Envio & { paciente_id: string })[]> {
  let consulta = criarClienteAdmin().from("envios").select(COLUNAS_ENVIO);
  if (args.pendentes) consulta = consulta.eq("situacao", "recebido");
  const { data, error } = await consulta.order("enviado_em", { ascending: false });
  if (error) throw new Error(`Falha ao listar envios: ${error.message}`);
  return (data as unknown as LinhaEnvio[]).map(paraEnvio);
}

async function buscarEnvio(id: string) {
  const { data, error } = await criarClienteAdmin()
    .from("envios")
    .select(COLUNAS_ENVIO)
    .eq("id", checarUuid(id, "Id de envio"))
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar envio: ${error.message}`);
  if (!data) throw new Error(`Envio não encontrado: ${id}`);
  return paraEnvio(data as unknown as LinhaEnvio);
}

export async function baixar(args: {
  envio: string;
  destino: string;
}): Promise<{ paciente: { nome: string; email: string }; arquivos: string[] }> {
  const envio = await buscarEnvio(args.envio);
  // Defesa em profundidade: o caminho precisa ser exatamente <paciente>/<envio>/<arquivo>.
  const prefixo = `${envio.paciente_id}/${envio.id}/`;
  const nomes = envio.arquivos.map((caminho) => {
    const nome = typeof caminho === "string" ? caminho.slice(prefixo.length) : "";
    if (
      typeof caminho !== "string" ||
      !caminho.startsWith(prefixo) ||
      !nome ||
      nome.includes("/") ||
      nome === "." ||
      nome === ".."
    ) {
      throw new Error(`Envio ${envio.id}: caminho inválido "${String(caminho)}"`);
    }
    return nome;
  });

  const bucket = criarClienteAdmin().storage.from("envios");
  const conteudos: Buffer[] = [];
  for (const caminho of envio.arquivos) {
    const { data, error } = await bucket.download(caminho);
    if (error || !data) throw new Error(`Falha ao baixar ${caminho}: ${error?.message}`);
    conteudos.push(Buffer.from(await data.arrayBuffer()));
  }
  mkdirSync(args.destino, { recursive: true });
  nomes.forEach((nome, i) => writeFileSync(join(args.destino, nome), conteudos[i]));
  return { paciente: envio.paciente, arquivos: nomes };
}

export async function incorporar(args: { envio: string }): Promise<void> {
  const id = checarUuid(args.envio, "Id de envio");
  const { data, error } = await criarClienteAdmin()
    .from("envios")
    .update({ situacao: "incorporado" })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Falha ao atualizar envio: ${error.message}`);
  if (!data?.length) throw new Error(`Envio não encontrado: ${args.envio}`);
}

export async function definirAtivo(args: { email: string; ativo: boolean }): Promise<void> {
  const paciente = await buscarPaciente(args.email);
  const { error } = await criarClienteAdmin()
    .from("pacientes")
    .update({ ativo: args.ativo })
    .eq("id", paciente.id);
  if (error) throw new Error(`Falha ao atualizar paciente: ${error.message}`);
}

// ------------------------------------------------------------------- CLI

function obrigatorio(valor: string | undefined, flag: string): string {
  if (!valor) throw new Error(`Faltou --${flag}.`);
  return valor;
}

function dataBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const USO = `Uso: npm run savicore -- <comando> [opções]

  cadastrar  --nome "<Nome>" --email <e-mail> [--nascimento AAAA-MM-DD]
  publicar   --email <e-mail> --dados <pasta com os 5 JSONs>
  envios     [--pendentes]
  baixar     --envio <id> --destino <pasta>
  incorporar --envio <id>
  desativar  --email <e-mail>
  reativar   --email <e-mail>`;

/** `parseArgs` com as mensagens de erro em português, seguidas do uso. */
function lerOpcoes(args: string[]) {
  try {
    return parseArgs({
      args,
      options: {
        nome: { type: "string" },
        email: { type: "string" },
        nascimento: { type: "string" },
        dados: { type: "string" },
        envio: { type: "string" },
        destino: { type: "string" },
        pendentes: { type: "boolean" },
      },
      strict: true,
    });
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    const msg = e instanceof Error ? e.message : String(e);
    const opcao = msg.match(/'(-{1,2}[^' ]+)/)?.[1] ?? "";
    const texto =
      codigo === "ERR_PARSE_ARGS_UNKNOWN_OPTION"
        ? `Opção desconhecida: ${opcao}`
        : codigo === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE"
          ? msg.includes("does not take an argument")
            ? `A opção ${opcao} não recebe valor`
            : `A opção ${opcao} precisa de um valor`
          : codigo === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL"
            ? `Argumento inesperado: ${msg.match(/'([^']*)'/)?.[1] ?? ""}`
            : `Argumentos inválidos (${msg})`;
    throw new Error(`${texto}\n\n${USO}`);
  }
}

export async function executar(argv: string[]): Promise<void> {
  const [comando, ...resto] = argv;
  const { values: v } = lerOpcoes(resto);

  switch (comando) {
    case "cadastrar": {
      const p = await cadastrar({
        nome: obrigatorio(v.nome, "nome"),
        email: obrigatorio(v.email, "email"),
        nascimento: v.nascimento,
      });
      console.log(`Paciente cadastrado: ${p.nome} <${p.email}> (id ${p.id})`);
      return;
    }
    case "publicar": {
      const email = obrigatorio(v.email, "email");
      const r = await publicar({ email, dados: obrigatorio(v.dados, "dados") });
      console.log(`Painel publicado para ${normalizarEmail(email)} (id ${r.id}).`);
      return;
    }
    case "envios": {
      const lista = await listarEnvios({ pendentes: v.pendentes });
      if (!lista.length) {
        console.log(v.pendentes ? "Nenhum envio pendente." : "Nenhum envio.");
        return;
      }
      for (const e of lista) {
        console.log(
          `${e.id}  ${e.situacao.padEnd(11)}  ${dataBR(e.enviado_em)}  ${e.paciente.nome} <${e.paciente.email}>  ${e.arquivos.length} arquivo(s)` +
            (e.observacao ? `  obs: ${e.observacao}` : ""),
        );
      }
      return;
    }
    case "baixar": {
      const destino = obrigatorio(v.destino, "destino");
      const r = await baixar({ envio: obrigatorio(v.envio, "envio"), destino });
      console.log(`Envio de ${r.paciente.nome} <${r.paciente.email}>: ${r.arquivos.length} arquivo(s) em ${destino}`);
      r.arquivos.forEach((a) => console.log(`  ${a}`));
      return;
    }
    case "incorporar":
      await incorporar({ envio: obrigatorio(v.envio, "envio") });
      console.log("Envio marcado como incorporado.");
      return;
    case "desativar":
    case "reativar": {
      const email = obrigatorio(v.email, "email");
      await definirAtivo({ email, ativo: comando === "reativar" });
      console.log(`Paciente ${normalizarEmail(email)} ${comando === "reativar" ? "reativado" : "desativado"}.`);
      return;
    }
    default:
      throw new Error(comando ? `Comando desconhecido: ${comando}\n\n${USO}` : USO);
  }
}

const executadoDiretamente =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDiretamente) {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  executar(process.argv.slice(2)).catch((e: unknown) => {
    console.error(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
