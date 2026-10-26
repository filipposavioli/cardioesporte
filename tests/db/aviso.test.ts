import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { criarMarcadorAviso } from "@/lib/aviso";
import { admin, criarPacienteTeste } from "./helpers";

function envio(pacienteId: string, extra: Record<string, unknown> = {}) {
  const id = randomUUID();
  return { id, paciente_id: pacienteId, arquivos: [`${pacienteId}/${id}/x.pdf`], ...extra };
}

describe("aviso ao médico (envios.avisado_em)", () => {
  it("paciente não define avisado_em ao inserir nem depois", async () => {
    const a = await criarPacienteTeste("Paciente Exemplo A");
    const comAviso = await a.client
      .from("envios")
      .insert(envio(a.pacienteId, { avisado_em: new Date().toISOString() }));
    expect(comAviso.error?.code).toBe("42501");

    const ok = envio(a.pacienteId);
    expect((await a.client.from("envios").insert(ok)).error).toBeNull();
    const alteracao = await a.client
      .from("envios")
      .update({ avisado_em: new Date().toISOString() })
      .eq("id", ok.id)
      .select();
    expect(alteracao.data ?? []).toHaveLength(0);
    const { data } = await admin().from("envios").select("avisado_em").eq("id", ok.id).single();
    expect(data!.avisado_em).toBeNull();
  });

  it("observação tem no máximo 1000 caracteres", async () => {
    const a = await criarPacienteTeste("Paciente Exemplo A");
    const longa = await a.client.from("envios").insert(envio(a.pacienteId, { observacao: "a".repeat(1001) }));
    expect(longa.error?.code).toBe("23514");
    const limite = await a.client.from("envios").insert(envio(a.pacienteId, { observacao: "a".repeat(1000) }));
    expect(limite.error).toBeNull();
  });

  it("marca o envio uma única vez", async () => {
    const a = await criarPacienteTeste("Paciente Exemplo A");
    const e = envio(a.pacienteId);
    expect((await a.client.from("envios").insert(e)).error).toBeNull();
    const marcar = criarMarcadorAviso(admin());
    const resultados = await Promise.all([marcar(e.id), marcar(e.id), marcar(e.id)]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(await marcar(e.id)).toBe(false);
    expect(await marcar(randomUUID())).toBe(false);
    const { data } = await admin().from("envios").select("avisado_em").eq("id", e.id).single();
    expect(data!.avisado_em).not.toBeNull();
  });
});
