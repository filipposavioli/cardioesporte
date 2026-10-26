import { nomesUnicos, sanitizarNome, tipoConteudo, validarArquivo } from "./arquivos";
import { criarClienteNavegador } from "./supabase/browser";

export const MAX_OBSERVACAO = 1000;

export type OpcoesEnvio = {
  /** Progresso de cada arquivo (0 a 1), na ordem recebida. */
  aoProgredir?: (indice: number, fracao: number) => void;
};

/** Erro com mensagem pronta para o paciente. */
export class FalhaEnvio extends Error {}

const FALHOU = "Não foi possível enviar seus arquivos. Nada foi registrado; tente de novo.";

/** Sobe um arquivo pelo REST do Storage com XHR (o supabase-js não informa progresso). */
function subir(
  caminho: string,
  arquivo: File,
  tipo: string,
  token: string,
  aoProgredir: (fracao: number) => void,
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const url = `${base}/storage/v1/object/envios/${caminho.split("/").map(encodeURIComponent).join("/")}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("Content-Type", tipo);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) aoProgredir(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? (aoProgredir(1), resolve())
        : reject(new Error(`upload ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
    xhr.onerror = () => reject(new Error("upload: falha de rede"));
    xhr.onabort = () => reject(new Error("upload: cancelado"));
    xhr.send(arquivo);
  });
}

async function postar(rota: string, envioId: string): Promise<Response> {
  return fetch(rota, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envio_id: envioId }),
  });
}

/**
 * Envia exames do paciente logado: gera o `envio_id`, sobe cada arquivo em
 * `<paciente_id>/<envio_id>/<nome-sanitizado>` e, só se todos subirem, registra a linha em
 * `envios` e pede o aviso ao médico. Em qualquer falha antes do registro, pede ao servidor para
 * apagar o que já subiu (o paciente não pode apagar do bucket) e lança `FalhaEnvio`.
 */
export async function enviarExames(
  arquivos: File[],
  observacao: string,
  opcoes: OpcoesEnvio = {},
): Promise<{ envioId: string }> {
  if (arquivos.length === 0) throw new FalhaEnvio("Escolha ao menos um arquivo.");
  for (const f of arquivos) {
    const erro = validarArquivo(f);
    if (erro) throw new FalhaEnvio(erro);
  }

  const supabase = criarClienteNavegador();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new FalhaEnvio("Sua sessão terminou. Entre de novo para enviar.");
  const pac = await supabase.from("pacientes").select("id").limit(1).maybeSingle();
  if (pac.error) throw new FalhaEnvio(FALHOU);
  if (!pac.data) throw new FalhaEnvio("Seu acesso ao painel está desativado. Fale com o consultório do Dr. Filippo.");

  const pacienteId = pac.data.id as string;
  const envioId = crypto.randomUUID();
  const nomes = nomesUnicos(arquivos.map((f) => sanitizarNome(f.name)));
  const caminhos = nomes.map((n) => `${pacienteId}/${envioId}/${n}`);

  const desfazer = async (motivo: unknown) => {
    console.error("envio: falhou, limpando arquivos já enviados", motivo);
    await postar("/api/envios/limpar", envioId).catch((e) => console.error("envio: limpeza falhou", e));
    throw new FalhaEnvio(FALHOU);
  };

  try {
    for (let i = 0; i < arquivos.length; i++) {
      await subir(caminhos[i], arquivos[i], tipoConteudo(arquivos[i])!, session.access_token, (fr) =>
        opcoes.aoProgredir?.(i, fr),
      );
    }
  } catch (e) {
    return desfazer(e);
  }

  const reg = await supabase.from("envios").insert({
    id: envioId,
    paciente_id: pacienteId,
    arquivos: caminhos,
    observacao: observacao.trim().slice(0, MAX_OBSERVACAO) || null,
    situacao: "recebido",
  });
  if (reg.error) return desfazer(reg.error);

  // O envio já está registrado; se o aviso falhar, o médico vê em `savicore envios --pendentes`.
  await postar("/api/envios/aviso", envioId).catch((e) => console.error("envio: aviso falhou", e));
  return { envioId };
}
