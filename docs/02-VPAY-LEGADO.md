# 02 — Inventário do VPAY atual (FlutterFlow)

Fonte: `E:\bkp flutterflow\vpay.zip` → extraído em
`C:\Users\pedro\AppData\Local\Temp\claude\C--Users-pedro-Pedro-Projetos-DEV-Vpay\<sessão>\scratchpad\vpay\vpay`

330 arquivos no total, **227 arquivos Dart / 122.653 linhas** em `lib/`. Código 100% gerado por FlutterFlow, exceto `lib/custom_code/`.

## Stack legada

- Flutter SDK `>=3.0.0 <4.0.0`, projeto `vpay` v1.0.0+1, alvos android / ios / web.
- Backend: **Supabase** — projeto `gewshjjyqdfdcjtwlyas` (`supabase_flutter 2.9.0`, `postgrest 2.4.2`, `gotrue 2.12.0`, `realtime_client 2.5.0`, `storage_client 2.4.0`). Auth flow `implicit`.
- Roteamento `go_router 12.1.3` via wrapper `FFRoute`.
- Estado: `provider 6.1.5` + singleton `FFAppState` persistido em `flutter_secure_storage`.
- PDF: `pdf` + `printing` + `pdfx` (11 geradores de relatório custom).
- Extras: `google_generative_ai 0.4.7` (Gemini), `data_table_2`, `dropdown_button2` (fork FF), `calendar_date_picker2`, `mask_text_input_formatter`, `csv`, `file_picker`, `webviewx_plus`, `flutter_animate`, `google_fonts`, `font_awesome_flutter`.

## Tema atual (levar para os tokens CSS)

| Token | Light | Dark |
|---|---|---|
| primary | `#006A28` | `#00BB47` |
| secondary | `#E41E4C` | `#E41E4C` |
| tertiary | `#EE8B60` | `#EE8B60` |
| alternate | `#E0E3E7` | `#4A5561` |
| primaryText | `#181818` | `#FFFFFF` |
| secondaryText | `#828282` | `#95A1AC` |
| primaryBackground | `#F0F0F0` | `#141414` |
| secondaryBackground | `#FFFFFF` | `#1F1F1F` |

Raio padrão `8px` (`FFAppConstants.designRadius`), altura padrão de controle `34px` (`tamanhopadrao`).
Há ainda um "custom background" em HTML/CSS (gradientes radiais verdes) guardado como string no AppState e renderizado via WebView — **descartar**, no Next isso é uma classe CSS.

## Rotas registradas (go_router)

| Rota | Tela |
|---|---|
| `/` | `_initialize` (splash/redirect) |
| `/login` | Login |
| `/recoveryPass` | Recuperação de senha |
| `/empresas` | Seleção de empresa (multi-tenant) |
| `/help` | Ajuda |
| `/faturas` | Faturas (contas a receber) |
| `/contasPagar` | Contas a pagar |
| `/financeiro/modulos` | Hub financeiro |
| `/cadastro/modulos` | Hub de cadastros |

Só 9 rotas para ~30 telas: o resto são **componentes empilhados dentro dos hubs**. `financeiro_modulos` monta DRE, saldo de contas, faturas de cartão e relatório mensal; `cadastro_modulos` monta clientes, serviços, contas bancárias e centro de custo. É por isso que os arquivos são gigantes.

## Telas por módulo

**Autenticação** — `login`, `recovery_pass`, `empresas` (2.237 l.), `help`

**Cadastro**
- `clientes` (`clientes_comp` lista 1.998 l. / `clientes_novo` form **9.996 l.**)
- `servicos` (`servicos_comp` / `servicos_novo`)
- `centrode_custo` (`centro_custo_comp` / `centro_custo_detalhes`)
- `caixase_bancos`: `contas_comp` / `contas_detalhes`, `cartoes_detalhes` (5.610 l.), `cartoes_faturas`, `cartoes_faturas_detalhes` (4.932 l.)

**Financeiro**
- `faturas`: lista (5.175 l.), `faturas_detahes` (**11.542 l.** — maior arquivo do projeto), `faturas_detalhes_servicos`, `faturas_detalhes_baixar`, `faturas_filtros`, e componentes (`enviar_email`, `faturassendmail`, `headerfaturas`, `headertitulos`, `txt_parcela`, `txt_valor`, `no_records`)
- `contas_pagar`: lista, `contas_pagar_detalhes` (7.710 l.), `contas_pagar_baixar`
- `gerar_dre`, `saldo_conta`, `financeiro_modulos`

**Geral / compartilhado** — `header`, `navbar`, `dark` (toggle tema), `calendarpicker`, `pdfview`, `mouseregion`
**Componentes soltos** — `conciliacao` (1.534 l.), `settings`, `relatoriomes`, `mensagem`, `norecords`, `empty_servicos`, `txt_obs`

## Camada de dados

`lib/backend/supabase/database/tables/` — 37 wrappers, 30 tabelas + 6 views + 1 tabela lixo (`temp`).
`lib/backend/schema/structs/` — 23 structs (DTOs FlutterFlow, incluindo `dre_struct`, `dre_receitas`, `dre_despesas`, `dre_resumo`, `competencias`, `calendar_day`).
Detalhe completo em [03-MODELO-DADOS.md](03-MODELO-DADOS.md).

## RPCs Postgres consumidas (`api_calls.dart`, 954 l.)

Chamadas via REST `/rpc/*` com o anon key, agrupadas em `EmpresasGroup`, `FaturasGroup`, `FinanceiroGroup`, `ClientesGroup`:

| RPC | Uso |
|---|---|
| `get_empresas` | empresas do usuário |
| `get_faturas` | listagem de faturas (com filtros) |
| `get_fatura_by_id` | detalhe |
| `get_faturasparcelas` | parcelas da fatura |
| `dre_por_ano` | DRE |
| `get_contaspagarvgeral` | listagem contas a pagar |
| `get_contapagar_by_id` | detalhe |
| `get_contasparcelas` | parcelas de contas a pagar |
| `get_cartoes` | cartões |
| `get_cartaofaturaparcelas` | parcelas de fatura de cartão |
| `get_competencias_cartao` | competências disponíveis |
| `get_clientes` | clientes |
| `get_clientesenderecos` | endereços |

**Essas RPCs continuam válidas no Next** — são o ativo mais reaproveitável do legado. Chamar com `supabase.rpc('get_faturas', {...})` a partir de Server Components.

## APIs externas

| Serviço | Endpoint |
|---|---|
| CNPJá | `https://open.cnpja.com/office/{cnpj}` — autopreenchimento de cliente |
| BrasilAPI | `https://brasilapi.com.br/api/banks/v1` — lista de bancos |
| EmailJS | `https://api.emailjs.com/api/v1.0/email/send` — envio de fatura |
| WhatsApp Cloud API | `https://graph.facebook.com/v22.0/{phone_id}/messages` — 2 números configurados |
| SMS | provedor via GET |
| Gemini | `google_generative_ai` (`lib/backend/gemini/gemini.dart`) |

> ⚠️ **Segurança:** `api_calls.dart` tem um **token Bearer da Meta/WhatsApp hardcoded em texto puro**, e `supabase.dart` + `app_constants.dart` carregam o anon key do Supabase embutido. Na migração: token da Meta vai para env var **server-side** (route handler, nunca `NEXT_PUBLIC_`), e o token da Meta que está no zip deve ser **rotacionado** — ele está em backup e provavelmente em histórico de versão.

## Lógica de negócio custom (`lib/custom_code/actions/` — 22 arquivos)

O que realmente precisa ser reescrito com cuidado. Detalhe em [04-REGRAS-NEGOCIO.md](04-REGRAS-NEGOCIO.md).

**Operações**
`cadastra_fatura`, `cadastra_fatura_parcelas`, `cadastra_contas_pagar_parcelas`, `adicionar_parcela_recalcular` (+`_pagar`), `excluir_parcela_recalcular` (+`_pagar`), `gerar_parcelas_cartao`, `fechar_fatura_cartao`, `import_extrato_csv`, `enviofaturaemail`

**Relatórios PDF (11)**
`generate_fatura_p_d_f` (821 l.), `generate_contas_p_d_f`, `generate_contas_pagar_p_d_f`, `generate_contas_pagas_p_d_f`, `generate_contas_receber_p_d_f`, `generate_d_r_e_p_d_f`, `generate_extrato_bancario_p_d_f`, `generate_projecao_caixa_p_d_f`, `generate_recibo_conta_pagar_p_d_f`, `generate_relatorio_faturas_p_d_f`, `generate_relatorio_faturas_por_status_p_d_f`

## Estado global (`FFAppState`)

Persistido em secure storage: `empresatemp` (empresa ativa), `usuariotemp`, `empresas[]`, `grupoclientes[]`, `login` (timestamp), `modobloco`, `modoexibicao`, `menuRecolhido`, `registroscancelados`, `customBackgroundLight/Dark`, `saveid`.
Em memória: `faturastemp[]`, `contaspagartemp[]`, `startDate`/`endDate` (**hardcoded `2025-01-01`/`2025-12-31`** — bug latente que vira ano corrente no Next).

Mapeamento para o alvo:
- `empresatemp` → cookie httpOnly + contexto de servidor (é chave de tenant, não pode viver só no cliente);
- `usuariotemp` → sessão Supabase + tabela `usuarios`;
- `menuRecolhido`/`modoexibicao`/`modobloco`/`registroscancelados` → zustand + localStorage (padrão `hooks/use-view-pref.ts` do SIC);
- `faturastemp`/`contaspagartemp` → não existem: dado vem do servidor a cada request.

## Dívidas do legado a não repetir

1. **Arquivos de 5–11 mil linhas** com UI, estado e regra misturados.
2. **Multi-tenant no cliente** — `fkEmpresa` é aplicado via filtro no app. Precisa ser **RLS no Postgres** (ver 05).
3. **Sem paginação real** em várias listas; carrega tudo e filtra em memória.
4. **N+1 de escrita** — `cadastra_fatura` insere serviços um a um em loop; parcelas idem. Vira `insert([...])` em lote ou RPC transacional.
5. **Feriados hardcoded de 2025** em dois arquivos, duplicados.
6. **Sem transação** — falha no meio de "criar fatura + serviços + parcelas" deixa registro órfão.
7. **Segredos no código-fonte.**
8. Tabela `temp` e coluna `resposnsavel` (typo) no schema.
