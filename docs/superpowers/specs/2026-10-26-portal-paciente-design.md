# Portal do paciente savi.core — especificação (fase 1)

Data: 26/10/2026 · Responsável: Dr. Filippo Savioli · Status: aguardando revisão

## 1. Objetivo

Um web app único em que cada paciente do Dr. Filippo entra com login e vê **somente o próprio painel de saúde** (formato savi.core já aprovado) e **envia exames novos** (PDF ou foto) para revisão.

**Sucesso:** o paciente abre o link no celular, entra com o e-mail, vê o painel atualizado e, quando faz um exame novo, envia pelo app; o médico recebe um aviso por e-mail.

## 2. Escopo

**Dentro (fase 1)**
- Login por e-mail com código de 6 dígitos, restrito a pacientes cadastrados.
- Painel do paciente com as seções do painel savi.core.
- Envio de exames (PDF/foto) com observação e lista "Meus envios".
- Script de publicação usado pelo Claude: cadastrar paciente, publicar painel, listar e baixar envios, marcar envio como incorporado.
- Aviso por e-mail ao médico a cada envio.

**Fora (fases futuras)**
- Área do médico dentro do app (lançar/editar dados em formulário).
- Registro de dados pelo paciente (peso, PA, treinos), lembretes, metas.
- App de loja (iOS/Android).

## 3. Arquitetura

| Peça | Tecnologia | Função |
|---|---|---|
| App web | Next.js (App Router, TypeScript) na Vercel | Telas de entrada, painel e envio; PWA instalável |
| Autenticação | Supabase Auth (OTP por e-mail) | Código de 6 dígitos; cadastro público desligado |
| Banco | Supabase Postgres, região `sa-east-1` (São Paulo) | Pacientes, painéis, envios; RLS em todas as tabelas |
| Arquivos | Supabase Storage, bucket privado `envios` | Exames enviados; acesso por URL assinada (expira em 5 min) |
| Aviso | Resend (e-mail transacional) | E-mail ao médico a cada envio |
| Publicação | Script Node/TS em `scripts/` com a chave de serviço | Grava dados vindos do fluxo Drive → JSON |

Segredos (chave de serviço do Supabase, chave do Resend, e-mail do médico) ficam em variáveis de ambiente — nunca no repositório. Nenhum dado de paciente é versionado no git; os dados de exemplo usados em testes são fictícios.

## 4. Modelo de dados

```sql
pacientes (
  id uuid pk default gen_random_uuid(),
  user_id uuid unique references auth.users,  -- preenchido no cadastro
  nome text not null,
  email text unique not null,
  nascimento date,
  ativo boolean not null default true,
  criado_em timestamptz default now()
)

paineis (
  id uuid pk,
  paciente_id uuid references pacientes not null,
  publicado_em timestamptz default now(),
  marcadores jsonb not null,   -- mesmo formato de marcadores.json
  evolucao   jsonb not null,   -- evolucao.json
  paciente   jsonb not null,   -- paciente.json (objeto único)
  zonas      jsonb,            -- zonas.json (null sem TECP)
  plano      jsonb not null    -- plano.json
)
-- painel exibido = o mais recente por paciente; anteriores ficam como histórico

envios (
  id uuid pk,
  paciente_id uuid references pacientes not null,
  arquivos text[] not null,    -- caminhos no bucket: <paciente_id>/<envio_id>/<arquivo>
  observacao text,
  enviado_em timestamptz default now(),
  situacao text not null default 'recebido' check (situacao in ('recebido','incorporado'))
)
```

Os formatos dos JSONs são exatamente os da skill `painel-paciente-savicore` (marcadores com `exame`, `sistema`, `valor`, `resultado`, `referencia`, `status`, `data`, `leitura`, `ref_min`, `ref_max`, `pct_predito`; etc.). O script valida o formato antes de gravar.

## 5. Segurança e privacidade (LGPD)

- **RLS:** paciente lê apenas a linha de `pacientes` com `user_id = auth.uid()` e `ativo = true`, e apenas `paineis`/`envios` desse paciente. Paciente pode **inserir** em `envios` (só para si, com `situacao = 'recebido'`), nunca alterar ou apagar. Nenhuma escrita de paciente em `paineis`.
- **Storage:** paciente só envia/lê arquivos sob a pasta `<seu paciente_id>/`. Tipos aceitos: PDF, JPEG, PNG, HEIC; até 20 MB por arquivo.
- **Login:** cadastro público desativado; só e-mails criados pelo script recebem código. Mensagem de entrada neutra ("Se este e-mail estiver cadastrado, você receberá um código.") para não revelar quem é paciente. Sessão de ~30 dias no aparelho; botão "Sair".
- **Desativar acesso:** `ativo = false` bloqueia o painel imediatamente.
- Dados hospedados no Brasil (Supabase São Paulo). Rodapé com aviso educativo (o painel não substitui a consulta), como no painel atual.

## 6. Telas

### 6.1 Entrada — `/entrar`
Marca savi.core, campo de e-mail → envio do código → campo de 6 dígitos → painel. Erros: código inválido/expirado ("Código incorreto ou vencido. Peça um novo."), limite de tentativas do Supabase respeitado.

### 6.2 Painel — `/`
Port do `pagina.html` + `estilo.css` + `app.js` da skill para componentes React, mantendo o visual aprovado: cabeçalho petróleo com anel de status; 01 mapa da saúde; 02 onde focar (régua); 03 seu motor (VO₂, % do predito, zonas — só aparece se houver TECP); 04 sua evolução; 05 próximos passos; 06 todos os exames (filtro por situação/sistema e busca); rodapé com assinatura. Gráficos com d3. Fonte Glancyr da marca. Modo escuro conforme o aparelho.
Topo: "Atualizado em dd/mm/aaaa" e botão **Enviar exame**.
Sem painel publicado: "Seu painel está sendo preparado pelo Dr. Filippo." + botão Enviar exame.

### 6.3 Enviar exame — `/enviar`
Seleção de um ou mais arquivos (PDF ou foto, com acesso à câmera no celular), observação opcional, botão Enviar com progresso. Sucesso: "Recebido. O Dr. Filippo vai revisar e atualizar seu painel." Abaixo, "Meus envios" (data, nº de arquivos, situação: Recebido / Incorporado ao painel). Falha de envio: mensagem clara e opção de tentar de novo; nada é registrado em `envios` se o upload falhar.

### 6.4 Aviso ao médico
Após o envio, uma rota do servidor (Next.js route handler, autenticada como o paciente) confirma que o envio é do paciente e manda e-mail via Resend: "Novo exame de <Nome> — <n> arquivo(s), observação: …". O e-mail não leva o arquivo nem resultados, só o aviso. Se o e-mail falhar, o envio continua registrado (o script lista pendentes).

## 7. Script de publicação (`scripts/savicore.ts`)

Comandos:
- `cadastrar --nome "<Nome>" --email <e-mail> [--nascimento AAAA-MM-DD]` → cria usuário no Auth e linha em `pacientes`.
- `publicar --email <e-mail> --dados <pasta com os 5 JSONs>` → valida e insere nova linha em `paineis`.
- `envios [--pendentes]` → lista envios.
- `baixar --envio <id> --destino <pasta>` → baixa os arquivos.
- `incorporar --envio <id>` → marca como incorporado.
- `desativar --email <e-mail>` / `reativar`.

Fluxo do médico: pede ao Claude → Claude lê o Drive, monta os JSONs (como na skill), o médico revisa leituras e próximos passos → Claude roda `publicar`.

## 8. Tratamento de erros

- Dados inválidos no `publicar`: o script recusa e aponta o campo (nada é gravado).
- Falha ao carregar o painel: mensagem "Não foi possível carregar seu painel. Tente de novo." com botão.
- Sessão expirada: volta para `/entrar`.

## 9. Testes

- **Regras de acesso (prioridade):** testes contra um Supabase local (CLI) provando que paciente A não lê painéis, envios nem arquivos do paciente B; que paciente não grava em `paineis`; que paciente inativo não lê nada; que anônimo não lê nada.
- **Script:** validação dos JSONs e comandos contra o banco local.
- **Componentes do painel:** funções de cálculo (resumo, sistemas, régua, tendência) com testes unitários.
- **Ponta a ponta (Playwright):** entrar, ver painel, enviar arquivo, ver em "Meus envios"; conferência visual em 390 px, 1280 px e modo escuro, com dados fictícios.

## 10. Implantação e custos

- Contas a criar pelo médico: Supabase (projeto em São Paulo), Vercel, Resend; domínio opcional (ex.: `painel.cardioesporte.com.br`).
- Desenvolvimento e testes podem rodar no plano gratuito. Para uso real: Supabase Pro (US$ 25/mês — o gratuito pausa após 1 semana sem uso e não tem backup) e Vercel Pro (US$ 20/mês — o Hobby não permite uso comercial). Resend gratuito cobre o volume previsto.
- Configuração do e-mail do código: modelo em português com a marca savi.core; envio por SMTP próprio (Resend) para não depender do limite do e-mail padrão do Supabase.
