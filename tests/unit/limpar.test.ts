import { describe, expect, it, vi } from "vitest";
import { processarLimpeza, type BucketEnvios } from "@/lib/limpeza";
import { supabaseFalso } from "./fakes";

const PAC = "11111111-1111-4111-8111-111111111111";
const ENVIO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function bucketFalso(nomes: string[]) {
  const list = vi.fn(async () => ({ data: nomes.map((name) => ({ name })), error: null }));
  const remove = vi.fn(async () => ({ data: [], error: null }));
  return { bucket: { list, remove } as unknown as BucketEnvios, list, remove };
}

function banco(opcoes: { usuario?: boolean; paciente?: boolean; envios?: { id: string; paciente_id: string }[] } = {}) {
  return supabaseFalso({
    usuario: opcoes.usuario === false ? null : { id: "u-1" },
    tabelas: {
      pacientes: opcoes.paciente === false ? [] : [{ id: PAC }],
      envios: opcoes.envios ?? [],
    },
  });
}

describe("processarLimpeza", () => {
  it("sem sessão → 401", async () => {
    const { bucket, remove } = bucketFalso(["a.pdf"]);
    const r = await processarLimpeza({ supabase: banco({ usuario: false }), bucket }, { envio_id: ENVIO });
    expect(r.status).toBe(401);
    expect(remove).not.toHaveBeenCalled();
  });

  it("id inválido → 400", async () => {
    const { bucket } = bucketFalso([]);
    expect((await processarLimpeza({ supabase: banco(), bucket }, { envio_id: "../x" })).status).toBe(400);
  });

  it("paciente desativado (sem linha visível) → 403", async () => {
    const { bucket, remove } = bucketFalso(["a.pdf"]);
    const r = await processarLimpeza({ supabase: banco({ paciente: false }), bucket }, { envio_id: ENVIO });
    expect(r.status).toBe(403);
    expect(remove).not.toHaveBeenCalled();
  });

  it("envio já registrado → 409, nada é apagado", async () => {
    const { bucket, remove } = bucketFalso(["a.pdf"]);
    const r = await processarLimpeza(
      { supabase: banco({ envios: [{ id: ENVIO, paciente_id: PAC }] }), bucket },
      { envio_id: ENVIO },
    );
    expect(r.status).toBe(409);
    expect(remove).not.toHaveBeenCalled();
  });

  it("apaga só a pasta <paciente_id>/<envio_id>/ do próprio paciente", async () => {
    const { bucket, list, remove } = bucketFalso(["a.pdf", "b.jpg"]);
    const r = await processarLimpeza({ supabase: banco(), bucket }, { envio_id: ENVIO });
    expect(r).toEqual({ status: 200, corpo: { ok: true, removidos: 2 } });
    expect(list).toHaveBeenCalledWith(`${PAC}/${ENVIO}`, expect.anything());
    expect(remove).toHaveBeenCalledWith([`${PAC}/${ENVIO}/a.pdf`, `${PAC}/${ENVIO}/b.jpg`]);
  });

  it("pasta vazia → 200 sem chamar remove", async () => {
    const { bucket, remove } = bucketFalso([]);
    const r = await processarLimpeza({ supabase: banco(), bucket }, { envio_id: ENVIO });
    expect(r.corpo).toEqual({ ok: true, removidos: 0 });
    expect(remove).not.toHaveBeenCalled();
  });
});
