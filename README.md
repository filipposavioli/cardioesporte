# savi.core · Portal do paciente

Portal onde cada paciente do Dr. Filippo entra com o e-mail (código de 6 dígitos, sem senha), vê o próprio painel de saúde e envia novos exames. O médico cadastra pacientes, publica painéis e recebe os exames pelo script `savicore`, rodado no computador dele.

Tecnologia: Next.js 16 + Supabase (login, banco e arquivos) + Resend (e-mails) + Vercel (hospedagem). Instalável no celular como app (PWA).

Este guia tem duas partes: **implantação em produção** (feita uma vez) e **uso do dia a dia**. Para desenvolvimento local, veja o final.

---

## 1. Implantação em produção

### 1.1 Criar o projeto no Supabase

1. Crie uma conta em <https://supabase.com> e um projeto novo. Em **Region**, escolha **South America (São Paulo) — `sa-east-1`**.
2. Guarde a senha do banco num gerenciador de senhas.
3. Assine o plano **Pro** (US$ 25/mês), necessário para uso clínico: backups diários e sem pausa por inatividade.
4. No computador, na pasta do projeto, conecte e aplique o banco (tabelas, regras de acesso e a pasta privada de arquivos `envios`):

   ```bash
   npm install
   npx supabase login
   npx supabase link --project-ref <ID-DO-PROJETO>
   npx supabase db push
   ```

   O ID do projeto aparece na URL do painel do Supabase (`https://supabase.com/dashboard/project/<ID>`).

### 1.2 Configurar o login (painel do Supabase)

O `supabase db push` não aplica estas opções. Faça pelo painel, em **Authentication**:

1. **Sign In / Providers → Email**: provedor **ativado**, e **"Allow new users to sign up" DESLIGADO**. Assim só entram e-mails cadastrados pelo script. Não ative outros provedores.
2. Ainda em Email: **Email OTP Length = 6**; expiração de 600 s (10 min) é adequada.
3. **Emails → Templates → Magic Link**:
   - **Subject**: `Seu código de acesso savi.core`
   - **Message body**: cole o conteúdo de `supabase/templates/codigo.html`.
4. **Sessions** (plano Pro): **Inactivity timeout = 30 dias (720 horas)** — use a unidade que o campo pedir —, para o paciente não precisar pedir código toda semana.
5. **Rate Limits**: ajuste o limite de e-mails por hora ao plano do Resend (passo 1.3) e mantenha os limites de verificação de código. Códigos de login e avisos ao médico saem da mesma conta do Resend; se a cota acabar, **nenhum paciente consegue entrar** até ela renovar.
   - Resend **Pro** (recomendado): **30 e-mails/hora**.
   - Resend **gratuito** (100 e-mails/dia): no máximo **4 e-mails/hora** (4 × 24 = 96/dia), para pedidos de código em excesso não esgotarem a cota diária.
6. **Project Settings → API** (ou **API Keys**): copie a **Project URL**, a chave **publishable** (ou **anon**, legada) e a chave **secret** (ou **service_role**, legada), usadas nos passos 1.4 e 1.6.

### 1.3 E-mail pelo Resend (SMTP e avisos)

1. Crie conta em <https://resend.com>, em **Domains** adicione o domínio do consultório e publique os registros DNS (SPF/DKIM) que ele mostrar. Espere ficar **Verified**.
2. Crie uma **API key** (guarde como `RESEND_API_KEY`).
   - **Plano:** o gratuito permite **100 e-mails/dia e 3.000/mês**, e a cota é dividida entre os códigos de login e os avisos de novos exames. Para uso clínico, assine o **Pro** (US$ 20/mês, 50.000 e-mails/mês, sem limite diário; preços de outubro de 2026 — confira em <https://resend.com/pricing>). O portal limita os avisos a 1 por envio e 10 por paciente por hora.
3. No Supabase, **Authentication → Emails → SMTP Settings → Enable Custom SMTP**:
   - Host `smtp.resend.com`, porta `465`, usuário `resend`, senha = a API key do Resend.
   - Remetente (Sender): um endereço do domínio verificado, por exemplo `Dr. Filippo <painel@seudominio.com.br>`.
4. O mesmo domínio verificado é usado no aviso "novo exame recebido" enviado ao médico (variável `AVISO_REMETENTE`, abaixo). Sem a verificação do domínio, o Resend recusa os envios.

### 1.4 Publicar na Vercel

1. Suba o repositório para o GitHub e, em <https://vercel.com>, **Add New → Project** e importe-o. Framework: Next.js (automático). Para uso profissional, plano **Pro** (US$ 20/mês).
2. Em **Settings → Environment Variables**, cadastre as 6 variáveis (Production):

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publishable (ou `anon`, legada) |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave secret (ou `service_role`, legada) |
   | `RESEND_API_KEY` | API key do Resend |
   | `MEDICO_EMAIL` | e-mail que recebe os avisos de novos exames |
   | `AVISO_REMETENTE` | remetente do aviso, no domínio verificado (ex.: `Portal savi.core <painel@seudominio.com.br>`) |

   **Atenção:** a `SUPABASE_SERVICE_ROLE_KEY` dá acesso total ao banco. Ela só pode existir no servidor (nunca com prefixo `NEXT_PUBLIC_`, nunca em código, nunca em mensagem ou print). Só as duas primeiras variáveis são públicas por natureza.
3. Clique em **Deploy**. Depois, em **Domains**, aponte o endereço desejado (ex.: `painel.seudominio.com.br`).
4. O limite de tentativas de login por IP usa o cabeçalho `x-forwarded-for`, que a Vercel preenche. Hospedar em outro lugar exige um proxy que preencha esse cabeçalho de forma confiável.

### 1.5 Teste de ponta a ponta

1. Cadastre um paciente de teste (pode ser você, com outro e-mail) pelo passo 2.1, abra o endereço do portal, peça o código e entre.
2. Confira que o e-mail chegou com o assunto "Seu código de acesso savi.core" e que um e-mail não cadastrado recebe a mesma mensagem neutra, mas nenhum código.
3. Publique um painel (2.2), envie um exame pelo portal e veja o aviso chegar em `MEDICO_EMAIL`.
4. No celular, abra o portal e use **Adicionar à tela inicial**.

### 1.6 Rodar o script contra a produção

O script `savicore` conecta no banco usando as variáveis de ambiente. Para apontá-lo à produção, crie na pasta do projeto, no seu computador, um arquivo `.env.local` com:

```
NEXT_PUBLIC_SUPABASE_URL=<Project URL de produção>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave publishable (ou anon, legada) de produção>
SUPABASE_SERVICE_ROLE_KEY=<chave secret (ou service_role, legada) de produção>
```

O `.env.local` já está no `.gitignore`: **nunca o envie ao GitHub nem o compartilhe**; ele contém a chave de acesso total. Para voltar ao ambiente local de desenvolvimento, troque os valores de volta (ou renomeie o arquivo).

---

## 2. Uso do dia a dia (script `savicore`)

Todos os comandos rodam na pasta do projeto, no formato `npm run savicore -- <comando> ...`.

1. **Cadastrar um paciente** (cria o acesso; o paciente já pode entrar com o e-mail):

   ```bash
   npm run savicore -- cadastrar --nome "Maria Silva" --email maria@exemplo.com --nascimento 1980-05-17
   ```

   `--nascimento` é opcional (AAAA-MM-DD).
2. **Publicar o painel** a partir de uma pasta com os 5 arquivos JSON (`paciente`, `marcadores`, `zonas`, `evolucao`, `plano`; um exemplo está em `tests/fixtures/exemplo`). Antes de publicar, o script valida os arquivos e aponta o erro, se houver:

   ```bash
   npm run savicore -- publicar --email maria@exemplo.com --dados ./pacientes/maria
   ```

   Publicar de novo substitui o painel anterior.
3. **Ver os envios** dos pacientes (`--pendentes` mostra só os ainda não incorporados):

   ```bash
   npm run savicore -- envios --pendentes
   ```
4. **Baixar os arquivos de um envio** (o `<id>` é o primeiro código da linha do comando anterior):

   ```bash
   npm run savicore -- baixar --envio <id> --destino ./recebidos
   ```
5. **Marcar como incorporado** depois de atualizar o painel (o paciente passa a ver "Incorporado ao painel"):

   ```bash
   npm run savicore -- incorporar --envio <id>
   ```
6. **Desativar um paciente** (ele deixa de acessar; dados preservados):

   ```bash
   npm run savicore -- desativar --email maria@exemplo.com
   ```
7. **Reativar**:

   ```bash
   npm run savicore -- reativar --email maria@exemplo.com
   ```

Fluxo típico de um exame novo: o paciente envia pelo portal → aviso por e-mail → `envios --pendentes` → `baixar` → atualizar o painel e `publicar` → `incorporar`.

---

## 3. Custos mensais

| Serviço | Plano | Custo |
|---|---|---|
| Supabase | Pro | US$ 25/mês |
| Vercel | Pro | US$ 20/mês |
| Resend | Pro (recomendado; 50.000 e-mails/mês) | US$ 20/mês |

Total aproximado: **US$ 65/mês** (mais o registro do domínio). Com o Resend gratuito (100 e-mails/dia, 3.000/mês), cai para US$ 45/mês, mas aí o limite de e-mails do Supabase deve ficar em 4/hora (passo 1.2, item 5) e um excesso de pedidos de código pode deixar os pacientes sem login até o dia seguinte.

---

## 4. Desenvolvimento local

Requisitos: Node 20+, Docker.

1. `npm install`
2. `npx supabase start` (sobe banco, login e arquivos locais; a caixa de e-mails de teste fica em <http://127.0.0.1:54324>, onde chegam os códigos).
3. `cp .env.example .env.local` e preencha com as chaves que o `supabase start` mostra (`npx supabase status`). Os e-mails reais (Resend) são opcionais localmente.
4. `npm run dev` e abra <http://localhost:3000>.

Testes e verificações:

- `npm run lint` e `npm run typecheck`
- `npm test`: testes unitários
- `npm run test:db`: regras de acesso do banco e o script (precisa do `supabase start`)
- `npm run test:e2e`: navegador completo (precisa do `supabase start`; o Playwright sobe o servidor sozinho)

Dica: em alguns contêineres, o Chromium do Playwright não é encontrado; se acontecer, rode `npx playwright install chromium` ou crie um link simbólico do Chromium instalado para o caminho que o erro indicar.
