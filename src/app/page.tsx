import { redirect } from "next/navigation";
import { z } from "zod";
import { Aviso } from "@/components/painel/Aviso";
import { Painel } from "@/components/painel/Painel";
import {
  EvolucaoSchema,
  MarcadorSchema,
  PacienteSchema,
  PassoSchema,
  ZonaSchema,
  type Painel as DadosPainel,
} from "@/lib/dados";
import { criarClienteServidor } from "@/lib/supabase/server";
import { semSessao } from "@/lib/supabase/sessao";
import { sair } from "./entrar/actions";

const LinhaPainel = z.object({
  publicado_em: z.string(),
  marcadores: z.array(MarcadorSchema),
  evolucao: z.array(EvolucaoSchema),
  paciente: PacienteSchema,
  zonas: z.array(ZonaSchema).nullable(),
  plano: z.array(PassoSchema),
});

const SEM_PAINEL = "Seu painel está sendo preparado pelo Dr. Filippo.";
const FALHA = "Não foi possível carregar seu painel. Tente de novo.";
const DESATIVADO = "Seu acesso ao painel está desativado. Fale com o consultório do Dr. Filippo.";

export default async function Inicio() {
  return <main className="pagina">{await conteudo()}</main>;
}

async function conteudo() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user) {
    // Sem sessão → entrar. Auth fora do ar não é "deslogado": mostra a falha.
    if (!error || semSessao(error)) redirect("/entrar");
    console.error("painel: falha ao ler a sessão", error);
    return <Aviso tipo="erro" mensagem={FALHA} acaoSair={sair} />;
  }

  // RLS só mostra a linha do próprio paciente, e só se `ativo = true`.
  const pac = await supabase.from("pacientes").select("id").limit(1).maybeSingle();
  if (pac.error) return <Aviso tipo="erro" mensagem={FALHA} acaoSair={sair} />;
  if (!pac.data) return <Aviso tipo="desativado" mensagem={DESATIVADO} acaoSair={sair} />;

  const pain = await supabase
    .from("paineis")
    .select("publicado_em, marcadores, evolucao, paciente, zonas, plano")
    .eq("paciente_id", pac.data.id) // defesa em profundidade, além da RLS
    .order("publicado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pain.error) return <Aviso tipo="erro" mensagem={FALHA} acaoSair={sair} />;
  if (!pain.data) return <Aviso tipo="vazio" mensagem={SEM_PAINEL} acaoSair={sair} />;

  const linha = LinhaPainel.safeParse(pain.data);
  if (!linha.success) return <Aviso tipo="erro" mensagem={FALHA} acaoSair={sair} />;
  const { publicado_em, ...dados } = linha.data;
  return <Painel dados={dados satisfies DadosPainel} atualizadoEm={publicado_em} acaoSair={sair} />;
}
