/** Regras dos arquivos que o paciente envia (as mesmas do bucket `envios`). */

export const LIMITE_MB = 20;
export const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;

/** Extensão → MIME aceito pelo bucket. */
const POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
};
const ACEITOS = new Set(Object.values(POR_EXTENSAO));
/** MIME que o navegador manda quando não sabe o tipo (comum com HEIC). */
const GENERICOS = new Set(["", "application/octet-stream"]);

function extensao(nome: string): string {
  const m = /\.([^./\\]+)$/.exec(nome);
  return m ? m[1].toLowerCase() : "";
}

/**
 * MIME para gravar no bucket: o do navegador, se for aceito; senão, o deduzido pela extensão
 * (HEIC costuma vir sem MIME). `null` se o arquivo não é de um tipo aceito.
 */
export function tipoConteudo(f: { name: string; type: string }): string | null {
  const tipo = f.type.toLowerCase();
  if (ACEITOS.has(tipo)) return tipo;
  if (tipo === "image/jpg") return "image/jpeg";
  if (GENERICOS.has(tipo)) return POR_EXTENSAO[extensao(f.name)] ?? null;
  return null;
}

/** `null` se o arquivo pode ser enviado; senão, a mensagem para o paciente. */
export function validarArquivo(f: { name: string; type: string; size: number }): string | null {
  if (!tipoConteudo(f)) return `"${f.name}": formato não aceito. Envie PDF, JPEG, PNG ou HEIC.`;
  if (f.size <= 0) return `"${f.name}" está vazio.`;
  if (f.size > LIMITE_BYTES) return `"${f.name}" tem mais de ${LIMITE_MB} MB.`;
  return null;
}

const MAX_NOME = 100;

/**
 * Nome seguro para o caminho no bucket: só o nome-base, sem acentos nem caracteres de controle,
 * apenas `[A-Za-z0-9._-]`, extensão em minúsculas, no máximo 100 caracteres. Nunca vazio.
 */
export function sanitizarNome(nome: string): string {
  const base = nome.split(/[/\\]/).pop() ?? "";
  const limpo = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // acentos
    .replace(/[\u0000-\u001f\u007f]/g, ""); // controle
  const ext = extensao(limpo).replace(/[^a-z0-9]/g, "");
  const raiz = (ext ? limpo.slice(0, -(ext.length + 1)) : limpo)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  const sufixo = ext ? `.${ext}` : "";
  return (raiz || "arquivo").slice(0, MAX_NOME - sufixo.length) + sufixo;
}

/** Torna os nomes únicos dentro de um envio (sem diferenciar maiúsculas): `a.pdf`, `a-2.pdf`… */
export function nomesUnicos(nomes: string[]): string[] {
  const usados = new Set(nomes.map((n) => n.toLowerCase()));
  const vistos = new Set<string>();
  return nomes.map((nome) => {
    if (!vistos.has(nome.toLowerCase())) {
      vistos.add(nome.toLowerCase());
      return nome;
    }
    const ext = extensao(nome);
    const raiz = ext ? nome.slice(0, -(ext.length + 1)) : nome;
    const sufixo = ext ? `.${ext}` : "";
    for (let i = 2; ; i++) {
      const candidato = `${raiz.slice(0, MAX_NOME - sufixo.length - String(i).length - 1)}-${i}${sufixo}`;
      const chave = candidato.toLowerCase();
      if (!usados.has(chave) && !vistos.has(chave)) {
        vistos.add(chave);
        usados.add(chave);
        return candidato;
      }
    }
  });
}

export type Situacao = "recebido" | "incorporado";

export function rotuloSituacao(s: Situacao): string {
  return s === "incorporado" ? "Incorporado ao painel" : "Recebido";
}
