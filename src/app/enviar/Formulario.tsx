"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LIMITE_MB, validarArquivo } from "@/lib/arquivos";
import { enviarExames, FalhaEnvio, MAX_OBSERVACAO } from "@/lib/enviar";

const SUCESSO = "Recebido. O Dr. Filippo vai revisar e atualizar seu painel.";

type Item = { chave: string; arquivo: File; erro: string | null };
type Estado = "pronto" | "enviando" | "falhou" | "enviado";

const tamanho = (b: number) =>
  b < 1024 * 1024
    ? `${Math.max(1, Math.round(b / 1024))} KB`
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(b / (1024 * 1024))} MB`;

/** Seleção de arquivos (PDF/foto; no celular o seletor nativo oferece a câmera), observação e envio. */
export function Formulario() {
  const router = useRouter();
  const idCampo = useId();
  const idObs = useId();
  const campo = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [observacao, setObservacao] = useState("");
  const [progresso, setProgresso] = useState<number[]>([]);
  const [estado, setEstado] = useState<Estado>("pronto");
  const [erro, setErro] = useState<string | null>(null);

  const enviando = estado === "enviando";
  const invalidos = itens.some((i) => i.erro);

  function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    const novos = Array.from(lista, (arquivo) => ({
      chave: crypto.randomUUID(),
      arquivo,
      erro: validarArquivo(arquivo),
    }));
    setItens((atuais) => [...atuais, ...novos]);
    setProgresso([]);
    if (estado !== "falhou") setEstado("pronto");
    setErro(null);
    if (campo.current) campo.current.value = ""; // permite escolher o mesmo arquivo de novo
  }

  function remover(chave: string) {
    setItens((atuais) => atuais.filter((i) => i.chave !== chave));
    setProgresso([]);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (itens.length === 0 || invalidos || enviando) return;
    setEstado("enviando");
    setErro(null);
    setProgresso(itens.map(() => 0));
    try {
      await enviarExames(
        itens.map((i) => i.arquivo),
        observacao,
        {
          aoProgredir: (indice, fracao) =>
            setProgresso((p) => p.map((v, j) => (j === indice ? fracao : v))),
        },
      );
      setItens([]);
      setObservacao("");
      setProgresso([]);
      setEstado("enviado");
      router.refresh(); // atualiza "Meus envios" (server component)
    } catch (falha) {
      setErro(falha instanceof FalhaEnvio ? falha.message : "Não foi possível enviar seus arquivos. Tente de novo.");
      setEstado("falhou");
      setProgresso([]);
    }
  }

  return (
    <form className="ev-form" onSubmit={enviar} noValidate>
      {estado === "enviado" && (
        <p className="ev-ok" role="status">
          {SUCESSO}
        </p>
      )}

      <input
        ref={campo}
        id={idCampo}
        className="ev-arquivo"
        type="file"
        accept="application/pdf,image/*,.heic,.heif"
        multiple
        disabled={enviando}
        onChange={(e) => adicionar(e.target.files)}
      />
      <label htmlFor={idCampo} className="ev-escolher" aria-disabled={enviando || undefined}>
        <span className="ev-escolher-t">Escolher arquivos ou tirar foto</span>
        <span className="ev-escolher-d">PDF, JPEG, PNG ou HEIC · até {LIMITE_MB} MB cada</span>
      </label>

      {itens.length > 0 && (
        <ul className="ev-arquivos" aria-label="Arquivos escolhidos">
          {itens.map((item, i) => {
            const fr = progresso[i];
            return (
              <li key={item.chave} className="ev-arq" data-invalido={item.erro ? "" : undefined}>
                <div className="ev-arq-l">
                  <span className="ev-arq-nome">{item.arquivo.name}</span>
                  <span className="ev-arq-tam">{tamanho(item.arquivo.size)}</span>
                  {!enviando && (
                    <button
                      type="button"
                      className="ev-remover"
                      aria-label={`Remover ${item.arquivo.name}`}
                      onClick={() => remover(item.chave)}
                    >
                      ×
                    </button>
                  )}
                </div>
                {item.erro && <p className="ev-erro">{item.erro}</p>}
                {fr !== undefined && (
                  <div
                    className="ev-prog"
                    role="progressbar"
                    aria-label={`Envio de ${item.arquivo.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(fr * 100)}
                  >
                    <span style={{ width: `${Math.round(fr * 100)}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <label htmlFor={idObs} className="ev-label">
        Observação (opcional)
      </label>
      <textarea
        id={idObs}
        className="ev-obs"
        rows={3}
        maxLength={MAX_OBSERVACAO}
        placeholder="Ex.: exames de sangue de outubro"
        value={observacao}
        disabled={enviando}
        onChange={(e) => setObservacao(e.target.value)}
      />

      {erro && (
        <p className="ev-erro ev-erro-caixa" role="alert">
          {erro}
        </p>
      )}

      <button className="ev-btn" type="submit" disabled={itens.length === 0 || invalidos || enviando}>
        {enviando ? "Enviando…" : estado === "falhou" ? "Tentar de novo" : "Enviar"}
      </button>
    </form>
  );
}
