import { z } from "zod";

// Schemas dos 5 JSONs do painel. Seguros para importar em código de navegador:
// o acesso ao disco só acontece dentro de validarPasta (sem import estático de node:fs).

export const STATUS = ["Tudo certo", "Atenção", "Prioridade"] as const;
export type Status = (typeof STATUS)[number];

const DataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve estar no formato AAAA-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "data inexistente");

export const MarcadorSchema = z.object({
  exame: z.string().min(1),
  sistema: z.string().min(1),
  valor: z.number().nullable(),
  resultado: z.string().min(1),
  referencia: z.string(),
  status: z.enum(STATUS),
  data: DataISO,
  leitura: z.string().min(1),
  ref_min: z.number().nullable().optional(),
  ref_max: z.number().nullable().optional(),
  pct_predito: z.number().nullable().optional(),
});

export const EvolucaoSchema = z.object({
  marcador: z.string().min(1),
  unidade: z.string(),
  ref: z.string(),
  data: DataISO,
  valor: z.number(),
  melhor: z.enum(["menor", "maior", "faixa"]),
});

export const PacienteSchema = z.object({
  nome: z.string().min(1),
  idade: z.number(),
  ultima_coleta: DataISO,
  periodo: z.string(),
  foco: z.string(),
});

export const ZonaSchema = z.object({
  zona: z.string().min(1),
  de: z.number().nullable(),
  ate: z.number(),
  vel: z.string(),
  uso: z.string(),
});

export const PassoSchema = z.object({
  n: z.number(),
  foco: z.string().min(1),
  acao: z.string().min(1),
});

export type Marcador = z.infer<typeof MarcadorSchema>;
export type PontoEvolucao = z.infer<typeof EvolucaoSchema>;
export type DadosPaciente = z.infer<typeof PacienteSchema>;
export type Zona = z.infer<typeof ZonaSchema>;
export type Passo = z.infer<typeof PassoSchema>;

export type Painel = {
  marcadores: Marcador[];
  evolucao: PontoEvolucao[];
  paciente: DadosPaciente;
  zonas: Zona[] | null;
  plano: Passo[];
};

function falha(arquivo: string, issues: z.core.$ZodIssue[]): never {
  const i = issues[0];
  const [idx, ...resto] = i.path;
  const campo = resto.map(String).join(".");
  const local =
    typeof idx === "number"
      ? `${arquivo}[${idx}]${campo ? "." + campo : ""}`
      : `${arquivo}${idx !== undefined ? "." + [idx, ...resto].map(String).join(".") : ""}`;
  throw new Error(`${local}: ${i.message}`);
}

function lerLista<T>(arquivo: string, bruto: unknown, schema: z.ZodType<T>): T[] {
  const r = z.array(schema).safeParse(bruto);
  if (!r.success) return falha(arquivo, r.error.issues);
  return r.data;
}

/** Lê os 5 JSONs de `dir`, valida e devolve o painel. Síncrona; só para Node (CLI/servidor). */
export function validarPasta(dir: string): Painel {
  const fs = process.getBuiltinModule("node:fs");
  const path = process.getBuiltinModule("node:path");

  const ler = (arquivo: string, opcional = false): unknown => {
    const p = path.join(dir, arquivo);
    if (!fs.existsSync(p)) {
      if (opcional) return null;
      throw new Error(`${arquivo}: arquivo não encontrado em ${dir}`);
    }
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch {
      throw new Error(`${arquivo}: JSON inválido`);
    }
  };

  const marcadores = lerLista("marcadores.json", ler("marcadores.json"), MarcadorSchema);
  const vistos = new Set<string>();
  marcadores.forEach((m, i) => {
    if (vistos.has(m.exame)) {
      throw new Error(`marcadores.json[${i}].exame: duplicado ("${m.exame}")`);
    }
    vistos.add(m.exame);
  });

  const evolucao = lerLista("evolucao.json", ler("evolucao.json"), EvolucaoSchema);

  const pacientes = lerLista("paciente.json", ler("paciente.json"), PacienteSchema);
  if (pacientes.length !== 1) {
    throw new Error(`paciente.json: deve conter exatamente 1 item (encontrado ${pacientes.length})`);
  }

  const zonasBruto = ler("zonas.json", true);
  const zonas = zonasBruto === null ? null : lerLista("zonas.json", zonasBruto, ZonaSchema);

  const plano = lerLista("plano.json", ler("plano.json"), PassoSchema);

  return { marcadores, evolucao, paciente: pacientes[0], zonas, plano };
}
