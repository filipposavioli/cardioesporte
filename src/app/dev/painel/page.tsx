import path from "node:path";
import { notFound } from "next/navigation";
import { Painel } from "@/components/painel/Painel";
import { validarPasta } from "@/lib/dados";
import { sair } from "../../acoes";

// Só em desenvolvimento: renderiza a fixture fictícia para conferência visual.
export default function DevPainel() {
  if (process.env.NODE_ENV !== "development") notFound();
  const dados = validarPasta(path.join(process.cwd(), "tests/fixtures/exemplo"));
  return (
    <main className="pagina">
      <Painel dados={dados} atualizadoEm={dados.paciente.ultima_coleta} acaoSair={sair} />
    </main>
  );
}
