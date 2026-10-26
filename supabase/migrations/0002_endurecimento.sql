-- Endurecimento do portal (revisão da 0001).

-- 1. E-mail sempre normalizado: unicidade efetivamente sem diferenciar
--    maiúsculas/minúsculas e sem espaços nas pontas.
alter table public.pacientes
  add constraint pacientes_email_normalizado
  check (email = lower(btrim(email)));

-- 2. Envio: nenhum elemento NULL e todo caminho exatamente
--    <paciente_id>/<envio_id>/<arquivo>, com arquivo sem "/" e diferente de
--    "." e "..".
drop policy "paciente cria envio para si" on public.envios;

create policy "paciente cria envio para si"
  on public.envios for insert to authenticated
  with check (
    paciente_id = (select public.meu_paciente_id())
    and situacao = 'recebido'
    and cardinality(arquivos) > 0
    and not exists (
      select 1
      from unnest(arquivos) as a(caminho)
      where a.caminho is null
        or a.caminho !~ ('^' || paciente_id::text || '/' || id::text || '/[^/]+$')
        or a.caminho ~ '/\.{1,2}$'
    )
  );

-- 3. Storage: upload exige exatamente 2 níveis de pasta
--    (<paciente_id>/<envio_id>/<arquivo>), além da pasta própria.
drop policy "paciente envia arquivo para a própria pasta" on storage.objects;

create policy "paciente envia arquivo para a própria pasta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'envios'
    and (storage.foldername(name))[1] = (select public.meu_paciente_id())::text
    and array_length(storage.foldername(name), 1) = 2
  );
