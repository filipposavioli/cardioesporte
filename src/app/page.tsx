import { redirect } from "next/navigation";
import { z } from "zod";
import { Aviso } from "@/components/painel/Aviso";
import { Painel } from "@/components/painel/Painel";
import { EvolucaoSchema, MarcadorSchema, PacienteSchema, PassoSchema, ZonaSchema, type Painel as DadosPainel } from "@/lib/dados";
import { criarClienteServidor } from "@/lib/supabase/server";
import { sair } from "./acoes";

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

export default async function Inicio() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [pac, pain] = await Promise.all([
    supabase.from("pacientes").select("id").limit(1).maybeSingle(),
    supabase
      .from("paineis")
      .select("publicado_em, marcadores, evolucao, paciente, zonas, plano")
      .order("publicado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let conteudo;
  if (pac.error || pain.error) {
    conteudo = <Aviso tipo="erro" mensagem={FALHA} acaoSair={sair} />;
  } else if (!pac.data || !pain.data) {
    conteudo = <Aviso tipo="vazio" mensagem={SEM_PAINEL} acaoSair={sair} />;
  } else {
    const linha = LinhaPainel.safeParse(pain.data);
    if (!linha.success) {
      conteudo = <Aviso tipo="erro" mensagem={FALHA} acaoSair={sair} />;
    } else {
      const { publicado_em, ...dados } = linha.data;
      conteudo = <Painel dados={dados satisfies DadosPainel} atualizadoEm={publicado_em} acaoSair={sair} />;
    }
  }
  return <main className="pagina">{conteudo}</main>;
}
