# Portal do paciente savi.core — plano de implementação (fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app com login por código no e-mail em que cada paciente vê só o próprio painel savi.core e envia exames para revisão, alimentado por um script de publicação.

**Architecture:** Next.js (App Router, TypeScript) servindo três telas (`/entrar`, `/`, `/enviar`) sobre Supabase (Auth OTP, Postgres com RLS, Storage privado). Os dados do painel são os 5 JSONs da skill `painel-paciente-savicore`, gravados como `jsonb` por um script CLI com a chave de serviço. O visual é um port do `pagina.html`/`estilo.css`/`app.js` da skill para componentes React.

**Tech Stack:** Node 22, Next.js 16, React 19, TypeScript, `@supabase/supabase-js` 2, `@supabase/ssr`, Supabase CLI (local via Docker), zod, d3 7.9, Resend, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-portal-paciente-design.md`

## Global Constraints

- Região do Supabase em produção: `sa-east-1` (São Paulo).
- Cadastro público desligado (`enable_signup = false` / `shouldCreateUser: false`); só e-mails criados pelo script entram.
- Código OTP de **6 dígitos**; sessão de ~30 dias.
- Mensagem neutra na entrada: "Se este e-mail estiver cadastrado, você receberá um código."
- Erro de código: "Código incorreto ou vencido. Peça um novo."
- Sem painel: "Seu painel está sendo preparado pelo Dr. Filippo."
- Sucesso do envio: "Recebido. O Dr. Filippo vai revisar e atualizar seu painel."
- Falha ao carregar: "Não foi possível carregar seu painel. Tente de novo."
- Situações de envio: `recebido` / `incorporado` (exibidas como "Recebido" / "Incorporado ao painel").
- Arquivos aceitos: PDF, JPEG, PNG, HEIC; até **20 MB** por arquivo; caminho `<paciente_id>/<envio_id>/<arquivo>` no bucket privado `envios`; URLs assinadas de **5 min**.
- Status de marcador: exatamente "Tudo certo", "Atenção", "Prioridade".
- Nenhum dado de paciente real no repositório; fixtures fictícias (paciente "Paciente Exemplo").
- Segredos só em variáveis de ambiente (`.env.local`, nunca versionado): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `MEDICO_EMAIL`, `AVISO_REMETENTE`.
- Interface toda em pt-BR; datas `dd/mm/aaaa`; números com vírgula decimal.
- Fonte Glancyr com fallback `Glancyr, Inter` (a Glancyr não tem `₂ · °`).

## Review Focus

1. **E-mail com maiúsculas ou espaços** (`Fulano@Gmail.com `) — cadastro e login normalizam para minúsculas sem espaços; o paciente entra normalmente. Teste em Task 4 (`cadastrar normaliza e-mail`) e Task 7 (`normalizarEmail`).
2. **Foto HEIC do iPhone ou PDF com MIME vazio** — o navegador às vezes manda `type = ""` para HEIC; a validação usa a extensão quando o MIME vem vazio. Teste em Task 8 (`aceita HEIC sem MIME`).
3. **Envio com vários arquivos em que um falha** — nenhuma linha em `envios` é criada e os arquivos já subidos desse envio são removidos; o paciente vê a mensagem de erro e pode tentar de novo. Teste em Task 8 (`falha parcial não registra envio`).
4. **Paciente desativado com sessão aberta** — ao recarregar, não vê painel nem envios e não consegue enviar. Teste em Task 2 (`inativo não lê nada`, `inativo não envia`).
5. **Painel sem TECP / sem evolução** — `zonas` null e nenhum marcador com `pct_predito` ou "VO₂ máximo": seção 03 some; `evolucao` vazia: seção 04 some, sem erro. Teste em Task 6 (`oculta motor sem TECP`, `oculta evolução vazia`).

---

## Estrutura de arquivos

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, playwright.config.ts, .env.example, README.md
supabase/config.toml                      # auth: signup off, otp 6 dígitos, template pt-BR
supabase/migrations/0001_portal.sql       # tabelas, RLS, bucket e políticas de storage
supabase/templates/codigo.html            # e-mail do código (marca savi.core)
src/lib/dados.ts                          # schemas zod dos 5 JSONs + tipos
src/lib/painel-calc.ts                    # resumo, sistemas, domínio da régua, tendência, parseRef
src/lib/supabase/{browser,server,admin}.ts
src/lib/email.ts                          # normalizarEmail
src/lib/arquivos.ts                       # validarArquivo (tipo/tamanho)
src/middleware.ts                         # sessão; redireciona anônimo para /entrar
src/app/layout.tsx, globals.css, manifest.ts
src/app/entrar/page.tsx                   # formulário e-mail → código
src/app/page.tsx                          # painel (server component carrega dados)
src/app/enviar/page.tsx                   # upload + Meus envios
src/app/api/envios/aviso/route.ts         # e-mail ao médico (Resend)
src/components/painel/*.tsx               # Hero, Mapa, Foco, Motor, Evolucao, Plano, Tabela, Regua, Rodape
src/components/painel/painel.css          # port do estilo.css
src/components/marca/*.tsx + public/fonts/Glancyr-VF.ttf
scripts/savicore.ts                       # CLI de publicação
tests/fixtures/exemplo/*.json             # 5 JSONs fictícios
tests/unit/*.test.ts                      # dados, painel-calc, email, arquivos
tests/db/*.test.ts                        # RLS e script contra Supabase local
tests/e2e/*.spec.ts                       # Playwright
```

---

### Task 1: Projeto base, Supabase local e infraestrutura de testes

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `.gitignore`, `supabase/config.toml`, `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: scripts npm `dev`, `build`, `lint`, `typecheck`, `test` (unit), `test:db` (vitest em `tests/db`, exige `supabase start`), `test:e2e`, `savicore` (`tsx scripts/savicore.ts`).

- [ ] **Step 1:** `npx create-next-app@16` com TypeScript, App Router, `src/`, ESLint, sem Tailwind. Adicionar deps: `@supabase/supabase-js @supabase/ssr zod d3@7.9.0 resend`; dev: `supabase vitest @playwright/test tsx @types/d3`. Não rodar `playwright install` (Chromium já está em `/opt/pw-browsers`).
- [ ] **Step 2:** `npx supabase init`; em `supabase/config.toml`: `[auth] enable_signup = false`, `[auth.email] enable_signup = false`, `otp_length = 6`, `otp_expiry = 600`, `jwt_expiry = 3600` com refresh ativo; `site_url = "http://localhost:3000"`.
- [ ] **Step 3:** Smoke test `tests/unit/smoke.test.ts` (`expect(1+1).toBe(2)`); `npm test` → PASS. `npx supabase start` sobe; `npm run build` passa.
- [ ] **Step 4:** `.env.example` com as 6 variáveis das Global Constraints; `.gitignore` inclui `.env*.local`, `supabase/.temp`, `tests/e2e/.artefatos`.
- [ ] **Step 5:** Commit `chore: projeto Next.js + Supabase local + testes`.

### Task 2: Banco de dados, RLS e storage

**Files:**
- Create: `supabase/migrations/0001_portal.sql`, `tests/db/helpers.ts`, `tests/db/rls.test.ts`

**Interfaces:**
- Produces: tabelas `pacientes`, `paineis`, `envios` (colunas exatas da spec §4); função SQL `public.meu_paciente_id() returns uuid` (security definer: id do paciente com `user_id = auth.uid()` e `ativo`); bucket `envios` privado, `file_size_limit = 20971520`, `allowed_mime_types` = pdf, jpeg, png, heic, heif.
- Produces (`tests/db/helpers.ts`): `admin()` (cliente service role), `criarPacienteTeste(nome): Promise<{pacienteId, client}>` — cria usuário via `auth.admin.createUser({email_confirm:true, password})`, linha em `pacientes`, e retorna cliente anon autenticado por senha (senha só nos testes).

- [ ] **Step 1: Testes que falham** em `tests/db/rls.test.ts`, com pacientes A e B e um painel publicado para cada via admin:
  - `paciente lê só o próprio cadastro` — A faz `select * from pacientes` → 1 linha, id de A.
  - `paciente não lê painel de outro` — A filtra `paineis` por `paciente_id = B` → 0 linhas.
  - `paciente não grava painel` — insert em `paineis` por A → erro.
  - `paciente cria envio só para si` — insert com `paciente_id = A` ok; com `paciente_id = B` → erro; com `situacao = 'incorporado'` → erro; update/delete do próprio envio → 0 linhas afetadas.
  - `storage isolado` — A sobe em `A/<uuid>/x.pdf` ok; em `B/<uuid>/x.pdf` → erro; A não lista nem baixa `B/...`.
  - `inativo não lê nada` — admin põe A `ativo=false`; A lê 0 linhas em `pacientes`, `paineis`, `envios`.
  - `inativo não envia` — insert em `envios` e upload por A inativo → erro.
  - `anônimo não lê nada` — cliente anon sem sessão → 0 linhas nas 3 tabelas.
- [ ] **Step 2:** `npm run test:db` → FAIL (tabelas inexistentes).
- [ ] **Step 3:** Escrever a migration: tabelas; `alter table ... enable row level security` nas três; políticas `select` usando `paciente_id = meu_paciente_id()` (em `pacientes`: `id = meu_paciente_id()`); `insert` em `envios` com check `paciente_id = meu_paciente_id() and situacao = 'recebido'`; nenhuma política de update/delete para `authenticated`; índice `paineis(paciente_id, publicado_em desc)`. Storage: insert/select em `storage.objects` com `bucket_id = 'envios' and (storage.foldername(name))[1] = meu_paciente_id()::text`.
- [ ] **Step 4:** `npx supabase db reset && npm run test:db` → PASS.
- [ ] **Step 5:** Commit `feat(db): tabelas, RLS e storage do portal`.

### Task 3: Schemas dos dados do painel

**Files:**
- Create: `src/lib/dados.ts`, `tests/unit/dados.test.ts`, `tests/fixtures/exemplo/{marcadores,evolucao,paciente,zonas,plano}.json`

**Interfaces:**
- Produces: `Marcador`, `PontoEvolucao`, `DadosPaciente`, `Zona`, `Passo`, `Painel` (tipos zod-inferidos); `Status = 'Tudo certo'|'Atenção'|'Prioridade'`; `validarPasta(dir: string): Painel` (lê os 5 arquivos; `zonas.json` opcional → `null`; `paciente.json` é array de 1 → objeto) que lança `Error` com mensagem `"<arquivo>[<índice>].<campo>: <motivo>"`.

- [ ] **Step 1: Testes que falham:** `aceita fixture de exemplo`; `rejeita status desconhecido` (mensagem contém `marcadores.json[0].status`); `rejeita exame duplicado` (`exame` é chave única); `zonas ausente vira null`; `data fora de AAAA-MM-DD rejeitada`; `melhor só aceita menor|maior|faixa`.
- [ ] **Step 2:** `npm test -- dados` → FAIL.
- [ ] **Step 3:** Implementar schemas com os campos exatos da skill (marcadores: `exame, sistema, valor:number|null, resultado, referencia, status, data, leitura, ref_min?:number|null, ref_max?:number|null, pct_predito?:number|null`; evolução: `marcador, unidade, ref, data, valor:number, melhor`; paciente: `nome, idade:number, ultima_coleta, periodo, foco`; zonas: `zona, de:number|null, ate:number, vel, uso`; plano: `n:number, foco, acao`). Fixture fictícia com ~15 marcadores cobrindo os 3 status, 3 marcadores de evolução e 3 zonas.
- [ ] **Step 4:** `npm test -- dados` → PASS.
- [ ] **Step 5:** Commit `feat: schemas e fixture dos dados do painel`.

### Task 4: Script de publicação `scripts/savicore.ts`

**Files:**
- Create: `scripts/savicore.ts`, `src/lib/supabase/admin.ts`, `src/lib/email.ts`, `tests/db/script.test.ts`, `tests/unit/email.test.ts`

**Interfaces:**
- Consumes: `validarPasta` (Task 3), tabelas (Task 2).
- Produces: `normalizarEmail(s: string): string` (trim + lowercase); funções exportadas e usadas pela CLI: `cadastrar({nome, email, nascimento?})`, `publicar({email, dados})`, `listarEnvios({pendentes?})`, `baixar({envio, destino})`, `incorporar({envio})`, `definirAtivo({email, ativo})`. CLI: comandos e flags exatamente como spec §7 (`desativar`/`reativar` chamam `definirAtivo`). Saída legível em pt-BR; erros com código de saída 1.

- [ ] **Step 1: Testes que falham:** `normalizarEmail(' Fulano@Gmail.com ') === 'fulano@gmail.com'`; `cadastrar normaliza e-mail` (linha e usuário Auth com e-mail minúsculo); `cadastrar duplicado falha com "já cadastrado"`; `publicar grava nova versão e mantém anterior` (2 publicações → 2 linhas); `publicar com dados inválidos não grava nada`; `publicar para e-mail inexistente falha`; `listarEnvios({pendentes:true}) só traz recebido`; `incorporar muda situação`; `baixar grava os arquivos no destino`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar; `cadastrar` usa `auth.admin.createUser({email, email_confirm: true})` e grava `user_id`. `admin.ts` lê `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` e falha com mensagem clara se faltar.
- [ ] **Step 4:** `npm test -- email && npm run test:db -- script` → PASS.
- [ ] **Step 5:** Commit `feat: script de publicação savicore`.

### Task 5: Cálculos do painel

**Files:**
- Create: `src/lib/painel-calc.ts`, `tests/unit/painel-calc.test.ts`

**Interfaces:**
- Consumes: tipos da Task 3.
- Produces: `resumo(m: Marcador[]): {status: Status, n: number}[]` (sempre 3 itens, ordem Tudo certo/Atenção/Prioridade); `sistemas(m): {sistema, total, ok, atencao, prioridade}[]` (ordem de primeira aparição); `dominioRegua(m): {d0, d1, lo, hi} | null`; `parseRef(ref: string): [number|null, number|null]`; `tendencia(pontos: PontoEvolucao[]): {primeiro, ultimo, delta, bom: boolean}`; `temMotor(p: Painel): boolean` (há `zonas` ou marcador "VO₂ máximo" ou algum `pct_predito`).

- [ ] **Step 1: Testes que falham** (valores conferidos com o `app.js` da skill): `resumo conta os 3 status mesmo com zero`; `sistemas agrupa em ordem`; `parseRef('< 100') → [null,100]`, `('> 60') → [60,null]`, `('20–50') → [20,50]`, `('3,5 - 5,0') → [3.5,5]`, `('Normal') → [null,null]`; `dominioRegua null sem valor ou sem limites`; `dominioRegua com só máximo começa em 0`; `tendencia "menor" com queda é bom`; `tendencia "faixa" usa último dentro da ref`; `temMotor false sem zonas, VO₂ e pct_predito`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Port fiel das funções `rule`, `parseRef`, cálculos `resumo`/`sistemas` e lógica `bom` de `drawTrends` do `app.js` da skill (`dominioRegua` reproduz o cálculo de `d0`/`d1` com margem de 30% do span).
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat: cálculos do painel`.

### Task 6: Componentes do painel e página `/`

**Files:**
- Create: `src/components/painel/{Painel,Hero,Mapa,Foco,Motor,Evolucao,Plano,Tabela,Regua,Rodape}.tsx`, `src/components/painel/painel.css`, `src/components/marca/{Simbolo,Wordmark,Pattern}.tsx`, `public/fonts/Glancyr-VF.ttf`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/dev/painel/page.tsx` (só em `NODE_ENV=development`, renderiza a fixture), `tests/unit/painel.test.tsx`
- Modify: `vitest.config.ts` (ambiente `jsdom` para `*.test.tsx`)

**Interfaces:**
- Consumes: Task 3 (tipos), Task 5 (cálculos), `src/lib/supabase/server.ts` (criado aqui: `criarClienteServidor()` com `@supabase/ssr` e cookies).
- Produces: `<Painel dados={Painel} atualizadoEm={string} />` (client component); `page.tsx` busca `pacientes` (1 linha) e o painel mais recente (`order publicado_em desc limit 1`) e renderiza `<Painel>`, o estado vazio ou o estado de erro (textos das Global Constraints). Botão "Enviar exame" → `/enviar`; "Sair" no topo.

- [ ] **Step 1: Testes que falham** (Testing Library sobre a fixture): `mostra nome e "N de total em ordem"`; `filtro "Atenção" na tabela mostra só Atenção`; `clicar num sistema filtra a tabela por ele`; `busca filtra por exame`; `oculta motor sem TECP` (fixture sem zonas/VO₂/pct → sem `#performance`); `oculta evolução vazia`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Extrair fonte e vetores: rodar o "Primeiro passo" da skill `marca-savicore` (gera `~/savicore-marca/Glancyr-VF.ttf` e `marca.py`), copiar a fonte para `public/fonts/`, e gerar os SVGs de `simbolo_svg`, `wordmark_svg`, `pattern_svg` como componentes (cor por prop). Port de `pagina.html`/`estilo.css` para os componentes mantendo classes `sc-*`; trocar `--cds-*`/`--color-*` pelos tokens do `html_standalone.py` (claro e `prefers-color-scheme: dark`) em `globals.css`; gráficos d3 em `useEffect` desenhados após montar todos os cards e redesenhados em resize (> 40 px de diferença), como no standalone.
- [ ] **Step 4:** Rodar testes → PASS; `npm run dev`, abrir `/dev/painel` no Playwright em 1280 px, 390 px e modo escuro, capturar e conferir (anéis, régua, gráficos não achatados, sem erro no console).
- [ ] **Step 5:** Commit `feat: painel do paciente`.

### Task 7: Login por código e proteção das rotas

**Files:**
- Create: `src/app/entrar/page.tsx`, `src/app/entrar/actions.ts`, `src/middleware.ts`, `src/lib/supabase/browser.ts`, `supabase/templates/codigo.html`, `tests/e2e/entrar.spec.ts`
- Modify: `supabase/config.toml` (`[auth.email.template.magic_link]` → `codigo.html`, assunto "Seu código de acesso savi.core")

**Interfaces:**
- Consumes: `normalizarEmail` (Task 4).
- Produces: server actions `pedirCodigo(email)` → sempre `{ok: true}` (usa `signInWithOtp({email, options:{shouldCreateUser:false}})` e ignora erro "user not found"); `verificarCodigo(email, codigo)` → `{ok}` ou `{erro: 'Código incorreto ou vencido. Peça um novo.'}`; `sair()`. Middleware: renova sessão; anônimo em `/` ou `/enviar` → `/entrar`; logado em `/entrar` → `/`.

- [ ] **Step 1: Testes que falham** (Playwright + Inbucket/Mailpit do Supabase local para ler o código): `e-mail não cadastrado mostra mensagem neutra`; `paciente cadastrado entra com o código e vê o painel`; `e-mail com maiúsculas entra`; `código errado mostra erro`; `anônimo em / vai para /entrar`; `sair volta para /entrar`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar. Template do e-mail com `{{ .Token }}`, marca (petróleo/verde), texto pt-BR, sem link. Campo do código com `inputmode="numeric" autocomplete="one-time-code" maxlength=6`.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat: login por código no e-mail`.

### Task 8: Envio de exames e aviso ao médico

**Files:**
- Create: `src/lib/arquivos.ts`, `src/app/enviar/page.tsx`, `src/app/enviar/Formulario.tsx`, `src/app/api/envios/aviso/route.ts`, `tests/unit/arquivos.test.ts`, `tests/unit/aviso.test.ts`, `tests/e2e/enviar.spec.ts`

**Interfaces:**
- Consumes: clientes Supabase (Tasks 6–7), tabelas/bucket (Task 2).
- Produces: `validarArquivo(f: {name: string, type: string, size: number}): string | null` (null = ok, senão mensagem pt-BR); `enviarExames(arquivos: File[], observacao: string)` no cliente: gera `envio_id` (uuid), sobe cada arquivo em `<paciente_id>/<envio_id>/<nome-sanitizado>`, em falha remove os já subidos e lança; só então insere em `envios` e faz `POST /api/envios/aviso {envio_id}`. Rota: autentica o paciente, lê o envio pelo cliente do paciente (RLS garante posse) e envia e-mail via Resend para `MEDICO_EMAIL` com assunto `Novo exame de <Nome>` e corpo com nº de arquivos e observação, sem anexos nem resultados; responde 200 mesmo se o Resend falhar (registra no log).

- [ ] **Step 1: Testes que falham:** `aceita PDF, JPEG, PNG, HEIC`; `aceita HEIC sem MIME` (`{name:'IMG_1.HEIC', type:''}` → null); `rejeita .docx`; `rejeita 21 MB` (mensagem cita 20 MB); `aviso: envio de outro paciente → 404`; `aviso: e-mail sem anexo e com nome/nº de arquivos` (Resend mockado); `aviso: falha do Resend → 200`; e2e: `envia PDF e aparece em Meus envios como Recebido`; `falha parcial não registra envio` (interceptar o 2º upload com erro via `page.route` → nenhuma linha nova, mensagem de erro visível, 1º arquivo removido do bucket).
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar. Input `accept="application/pdf,image/*,.heic,.heif" multiple`; no celular a câmera fica disponível pelo seletor nativo. Barra de progresso por arquivo. "Meus envios" ordenado por data desc, situação traduzida.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat: envio de exames e aviso ao médico`.

### Task 9: PWA, fluxo completo e documentação de implantação

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/icon-{192,512}.png` (símbolo verde sobre petróleo), `tests/e2e/fluxo.spec.ts`, `README.md`

**Interfaces:**
- Consumes: tudo acima.

- [ ] **Step 1: Teste que falha** `fluxo.spec.ts`: script `cadastrar` + `publicar` (fixture) → paciente entra com código → vê "Paciente Exemplo" → envia arquivo → `listarEnvios({pendentes:true})` traz o envio → `incorporar` → recarregar `/enviar` mostra "Incorporado ao painel"; segundo paciente cadastrado sem painel vê "Seu painel está sendo preparado pelo Dr. Filippo.".
- [ ] **Step 2:** Rodar → FAIL (manifest ausente faz a verificação `link[rel=manifest]` falhar).
- [ ] **Step 3:** Manifest (`name: "savi.core · Meu painel"`, `lang: "pt-BR"`, cores petróleo `#17203b`, `display: "standalone"`). README em pt-BR: rodar localmente; criar projeto Supabase em `sa-east-1`, aplicar migration (`supabase link` + `supabase db push`), desligar cadastro, configurar SMTP do Resend e template; deploy na Vercel com as variáveis; uso do script (os 7 comandos); custos (Supabase Pro US$ 25, Vercel Pro US$ 20).
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test && npm run test:db && npm run test:e2e` → tudo PASS; capturas finais em 390/1280/escuro conferidas.
- [ ] **Step 5:** Commit `feat: PWA, teste de fluxo completo e guia de implantação`.
