# 08 — Arquitetura

**Regra base: feature-first no topo, camadas dentro da feature.** Uma feature nova é uma pasta nova em `src/modules/` com a mesma estrutura. Nunca espalhe uma feature por pastas diferentes.

## Decisão: Next.js, não Express

A especificação original descrevia `app.js`, `server.js`, `router.post(...)` — um servidor Express separado. Foi mantido **Next.js**, por dois motivos: a stack herdada do SIC é Next, e um API server separado significa dois deploys e duas cadeias de auth para o mesmo produto.

**Nenhum princípio foi perdido.** O mapeamento:

| Spec Express | Aqui |
|---|---|
| `*.routes.js` | `src/app/api/v1/<feature>/route.ts` — declara método, schema, produto exigido. Zero lógica. |
| middlewares (auth, validate) | `handler()` em `src/shared/http/handler.ts` — uma passagem só |
| `errorHandler` global | `tratarErro()` dentro do mesmo `handler()` |
| `app.js` (registro de módulos) | file-system routing do App Router |
| `server.js` | `next start` |

Se depois o backend precisar rodar fora do Next (fila, worker, gRPC), `modules/` e `shared/` migram sem alteração — nenhum deles importa `next/*` exceto `shared/http`, que é a única camada acoplada ao framework. Foi desenhado assim de propósito.

## Estrutura

```
src/
  app/                        # roteamento (Next App Router)
    api/v1/…/route.ts         #   borda HTTP — fina, sem lógica
    (app)/…                   #   telas autenticadas
    (auth)/…                  #   login
    globals.css               #   design system (docs/07)
  modules/                    # uma pasta por feature
    faturas/
      faturas.controller.ts   #   HTTP <-> serviço
      faturas.service.ts      #   regra de negócio
      faturas.repository.ts   #   única porta de dados da feature
      faturas.schema.ts       #   contratos Zod (entrada E saída)
      faturas.types.ts        #   entidades do domínio
    clientes/                 # mesma estrutura
    plataforma/               # produtos e assinaturas (os "plugs")
  shared/                     # transversal, importado nunca reescrito
    auth/                     #   contexto de sessão + tenant + entitlements
    domain/                   #   regras entre features (parcelas)
    errors/                   #   AppError e derivados
    http/                     #   handler + envelope de resposta
    utils/                    #   money, datas, paginação, ids, logger
    validators/               #   schemas Zod reaproveitáveis
    demo/                     #   seed de demonstração (apagar ao conectar)
  infra/
    config/env.ts             #   único lugar que lê process.env
    supabase/client.ts        #   único lugar que instancia o Supabase
```

## Fluxo de uma requisição

```
route.ts  ->  handler()  ->  controller  ->  service  ->  repository  ->  Supabase
              [requestId]
              [auth + tenant]
              [entitlement]
              [Zod]
              [errorHandler]
```

Cada seta é uma fronteira. O dado que atravessa já está validado e no formato que a próxima camada espera.

**O que cada camada não sabe:**
- rota não sabe regra de negócio;
- controller não sabe regra de negócio nem banco;
- service não sabe `Request`/`Response` nem Supabase;
- repository não sabe regra de negócio.

Fluxo de dependência sempre para dentro. `shared/domain/parcelas.ts` é função pura: não importa nada de HTTP, banco ou relógio — é por isso que é testável direto.

## Onde mora cada decisão

| Pergunta | Arquivo |
|---|---|
| Como parcelar um título? | `shared/domain/parcelas.ts` |
| O que é dia útil? | `shared/utils/datas.ts` |
| Como somar dinheiro? | `shared/utils/money.ts` |
| Quem pode ver o quê? | `shared/auth/contexto.ts` + policies RLS |
| Qual o formato de erro da API? | `shared/errors/` + `shared/http/handler.ts` |
| Qual o formato de sucesso? | `shared/http/response.ts` |
| Como uma fatura vira registro? | `modules/faturas/faturas.repository.ts` |

## Plataforma multiproduto — planos e módulos

O modelo **já existia no banco** e não é "produto por slug", como assumi na primeira versão:

```
empresas → assinaturas → planos → modulo_financeiro, modulo_os, modulo_estoque, …
```

- `planos` — Free, Starter, Pro, Enterprise. Cada um liga um conjunto de flags `modulo_*` e define limites (`max_usuarios`, `max_faturas_mes`…).
- `assinaturas` — empresa × plano, com `status`, `periodicidade`, `trial_fim`.
- O VPay ocupa o módulo **`financeiro`**; o SIC ocuparia `os`, `estoque` e `manutencao`.
- Toda rota do VPay declara `requerModulo: "financeiro"` — plano sem o módulo, 403.
- A sidebar se monta pelas flags do plano. **O VPay nunca assume que é o único módulo instalado.**

Uma empresa "assina mais produtos" **subindo de plano**, não acumulando assinaturas.

⚠️ `produtos`, nesse banco, é produto de **estoque** (NCM, código de barras, preço de custo). Nada a ver com produto SaaS — não confundir.

Módulo novo: uma entrada em `MODULOS` (`plataforma.types.ts`), a coluna `modulo_*` correspondente em `planos`, e um grupo em `GRUPOS_POR_MODULO` na sidebar.

## Regras específicas de produto financeiro

**Dinheiro em centavos, sempre.** `shared/utils/money.ts` expõe o tipo `Centavos` (branded), que impede somar centavos com reais por engano. O banco herdado guarda `double precision` — a conversão acontece na fronteira do repositório (`doBanco`/`paraBanco`) e em nenhum outro lugar. Quando as colunas virarem `bigint`, apagam-se essas duas funções e nada mais muda.

**Divisão preserva o total.** `dividir(1000, 3)` → `[334, 333, 333]`. O legado jogava toda a diferença na última parcela; aqui o resto é distribuído entre as primeiras.

**Estados explícitos.** Fatura e assinatura têm máquina de estados com transições declaradas. Transição inválida é `422`, não um update silencioso.

**Invariante testável.** `soma(parcelas) === total`, conferido por `conferirTotal()` antes de qualquer escrita.

## O que ainda falta (dívida conhecida, não esquecimento)

| Item | Situação |
|---|---|
| **Idempotência de escrita financeira** | `idempotencyKeySchema` existe em `shared/validators`; falta a tabela de chaves e o wrap no handler. Obrigatório antes de baixa de pagamento. |
| **Transação em `criar()`** | PostgREST não expõe transação entre requisições. Hoje há compensação manual (apaga o cabeçalho se o filho falhar). A correção é a RPC `criar_fatura(jsonb)`. |
| **Trilha de auditoria** | Tabela de auditoria (quem, quando, estado anterior) ainda não existe. |
| **Testes** | Nenhum runner configurado. `shared/domain/parcelas.ts` e `shared/utils/money.ts` são os primeiros alvos — funções puras, alto valor. |
| **`database.types.ts`** | Escrito à mão. Substituir por `supabase gen types typescript` assim que houver acesso ao projeto. |
| **Confirmação de e-mail / troca de senha logado** | O fluxo de recuperação envia o link; a tela de definir nova senha ainda não existe. |
| **RLS de `planos`/`assinaturas`** | As tabelas têm RLS **habilitada sem policy** — leitura autenticada volta vazia. `0001_rls_plataforma.sql` corrige. Até aplicar, `VPAY_PLATAFORMA_SEM_RLS=1` contorna via service role (opt-in, bloqueado em produção). |
| **RLS do domínio** | `0002_rls_dominio.sql` escrita, não aplicada. Até lá o isolamento entre empresas é só o filtro da aplicação. |
| **Permissões por usuário** | O banco tem `permissoes`, `regras`, `regrasxusuarios` e `alcadas`, todas vazias. O VPay ainda ignora esse modelo — hoje quem entra na empresa vê tudo do plano. |

## Convenções

- Arquivo: `feature.camada.ts`. Função: verbo primeiro (`criarFatura`, `buscarPorId`).
- Import absoluto a partir de `src/` via `@/*`. Nada de `../../../`.
- `async/await` em tudo. Sem `.then` encadeado.
- Comentário explica **por quê**, não o quê.
- Sem `select('*')` — toda consulta lista suas colunas.
- Sem segredo em código: tudo passa por `infra/config/env.ts`.
- Service lança erro de domínio; nunca devolve `null` para significar falha.

## Autenticação

`src/modules/sessao/` — Supabase Auth por e-mail e senha.

| Peça | Papel |
|---|---|
| `src/middleware.ts` | Renova o token a cada request (sem isso a sessão cai em 1h) e barra rota privada antes de renderizar |
| `sessao.actions.ts` | Fronteira HTTP: Server Actions que validam, chamam o serviço e gravam o cookie |
| `sessao.service.ts` | Regra: sem empresa vinculada não entra; com uma só, pula o seletor |
| `sessao.repository.ts` | Única porta para o Supabase Auth e para `usuariosxempresas` |

Fluxo: `/login` → uma empresa vai direto para `/`; mais de uma passa por `/selecionar-empresa`. A empresa ativa vive num cookie `httpOnly` (`vpay_empresa`), validada contra `usuariosxempresas` antes de gravar — editar o cookie no navegador não dá acesso a outro tenant.

Duas decisões de segurança: erro de login é sempre o mesmo texto com e-mail inexistente ou senha errada (o Supabase também não distingue, justamente para não permitir enumeração de usuários), e a recuperação de senha responde sucesso mesmo para e-mail que não existe.

## Como rodar

```bash
npm install
cp .env.example .env.local      # preencher as chaves do Supabase
npm run dev                     # http://localhost:3000
npm run typecheck
npm run build
```

Sem `.env.local` o app sobe em **modo demonstração**: as telas mostram dados fixos com banner de aviso, e a API responde `503` com a mensagem de configuração. Falha visível, nunca silenciosa.
