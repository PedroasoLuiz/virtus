# 06 — Mapa do código legado → destino

Índice de rastreabilidade. Sempre que uma dúvida de regra de negócio aparecer durante a reescrita, **a resposta está no arquivo Dart apontado aqui** — é a única fonte de verdade sobre o comportamento atual.

## Onde está o código

O zip foi extraído para dentro do projeto, em local permanente:

```
C:\Users\pedro\Pedro\Projetos DEV\Vpay\_legado\vpay\
```

Origem: `E:\bkp flutterflow\vpay.zip` (330 arquivos, 9,6 MB).
Todos os caminhos abaixo são **relativos a `_legado/vpay/`**.

> ⚠️ `_legado/` é referência de consulta, **não entra no build e não vai para o repositório**. Adicionar ao `.gitignore` do projeto Next (ou versionar num repo separado de arquivo morto — decidir junto com a decisão E do doc 05). Contém o token da Meta em claro.

---

## Regras de negócio → arquivo

| Regra (doc 04) | Arquivo legado | Linhas | Destino no Next |
|---|---|---|---|
| §1 Parcelas de fatura | `lib/custom_code/actions/cadastra_fatura_parcelas.dart` | 172 | `lib/parcelas.ts` + `lib/feriados.ts` |
| §1 Parcelas de conta a pagar | `lib/custom_code/actions/cadastra_contas_pagar_parcelas.dart` | 168 | idem (função única, os dois casos convergem) |
| §2 Criação de fatura | `lib/custom_code/actions/cadastra_fatura.dart` | 47 | RPC `criar_fatura(jsonb)` |
| §3 Adicionar parcela (receber) | `lib/custom_code/actions/adicionar_parcela_recalcular.dart` | 45 | `lib/parcelas.ts` |
| §3 Adicionar parcela (pagar) | `lib/custom_code/actions/adicionar_parcela_recalcular_pagar.dart` | — | idem |
| §3 Excluir parcela (receber) | `lib/custom_code/actions/excluir_parcela_recalcular.dart` | 40 | idem |
| §3 Excluir parcela (pagar) | `lib/custom_code/actions/excluir_parcela_recalcula_pagar.dart` | — | idem |
| §4 Parcelamento de cartão | `lib/custom_code/actions/gerar_parcelas_cartao.dart` | 44 | `lib/cartao.ts` |
| §4 Fechamento de fatura de cartão | `lib/custom_code/actions/fechar_fatura_cartao.dart` | 88 | `lib/cartao.ts` + RPC transacional |
| §5 Importação de extrato CSV | `lib/custom_code/actions/import_extrato_csv.dart` | 118 | `app/api/extrato/importar/route.ts` |
| §6 Conciliação bancária | `lib/components/conciliacao_widget.dart` | **1.534** | `lib/conciliacao.ts` + `app/(app)/extrato/` |
| §7 Envio de fatura por e-mail | `lib/custom_code/actions/enviofaturaemail.dart` | 132 | `app/api/faturas/[id]/enviar/route.ts` |
| §9 DRE | RPC `dre_por_ano` + `lib/pages/financeiro/gerar_dre/` | — | `app/(app)/dre/` (RPC mantida) |
| §10 Sequências | busca `zsequencias` espalhada nas telas | — | RPC `proximo_numero(text)` |

## Relatórios PDF → arquivo

Todos em `lib/custom_code/actions/`:

| Relatório | Arquivo | Linhas |
|---|---|---|
| Fatura | `generate_fatura_p_d_f.dart` | **821** |
| Recibo de conta paga | `generate_recibo_conta_pagar_p_d_f.dart` | 544 |
| Contas (geral) | `generate_contas_p_d_f.dart` | 555 |
| Contas a pagar | `generate_contas_pagar_p_d_f.dart` | — |
| Contas pagas | `generate_contas_pagas_p_d_f.dart` | — |
| Contas a receber | `generate_contas_receber_p_d_f.dart` | — |
| DRE | `generate_d_r_e_p_d_f.dart` | — |
| Extrato bancário | `generate_extrato_bancario_p_d_f.dart` | — |
| Projeção de caixa | `generate_projecao_caixa_p_d_f.dart` | — |
| Relatório de faturas | `generate_relatorio_faturas_p_d_f.dart` | — |
| Faturas por status | `generate_relatorio_faturas_por_status_p_d_f.dart` | — |

O layout visual de cada um está no próprio arquivo (`pw.Table`, `pw.Row`…). Ao refazer, abrir o Dart correspondente para copiar **colunas, ordem, agrupamentos e totalizadores** — é o que o usuário reconhece.

## Telas → destino

| Módulo | Arquivo legado (`lib/pages/…`) | Linhas | Destino |
|---|---|---|---|
| Login | `autenticacao/login/login_widget.dart` | 1.151 | `app/(auth)/login/` |
| Recuperar senha | `autenticacao/recovery_pass/recovery_pass_widget.dart` | 628 | `app/(auth)/recuperar-senha/` |
| Seleção de empresa | `autenticacao/empresas/empresas_widget.dart` | 2.237 | `app/empresas/` |
| Ajuda | `autenticacao/help/help_widget.dart` | 1.088 | `app/(app)/ajuda/` |
| **Hub cadastros** | `cadastro/cadastro_modulos/cadastro_modulos_widget.dart` | 2.098 | dissolvido na sidebar |
| Clientes — lista | `cadastro/clientes/clientes_comp/clientes_comp_widget.dart` | 1.998 | `app/(app)/clientes/page.tsx` |
| Clientes — form | `cadastro/clientes/clientes_novo/clientes_novo_widget.dart` | **9.996** | `components/drawers/cliente-drawer.tsx` |
| Serviços | `cadastro/servicos/servicos_comp` + `servicos_novo` | 1.011 + 1.949 | `app/(app)/servicos/` + drawer |
| Centro de custo | `cadastro/centrode_custo/centro_custo_comp` + `_detalhes` | 1.103 + 1.237 | `app/(app)/centro-custo/` + drawer |
| Contas bancárias | `cadastro/caixase_bancos/contas_comp` + `contas_detalhes` | 1.671 + 4.003 | `app/(app)/contas/` + drawer |
| Cartões | `cadastro/caixase_bancos/cartoes_detalhes_widget.dart` | 5.610 | `app/(app)/cartoes/` + drawer |
| Faturas de cartão | `cadastro/caixase_bancos/cartoes_faturas` + `_detalhes` | 2.619 + 4.932 | `app/(app)/cartoes/faturas/` |
| **Hub financeiro** | `financeiro/financeiro_modulos/financeiro_modulos_widget.dart` | 3.055 | dissolvido na sidebar |
| Faturas — lista | `financeiro/faturas/faturas/faturas_widget.dart` | 5.175 | `app/(app)/faturas/page.tsx` |
| Faturas — detalhe | `financeiro/faturas/faturas_detahes/faturas_detahes_widget.dart` | **11.542** | `components/drawers/fatura-drawer.tsx` |
| Faturas — serviços | `financeiro/faturas/faturas_detalhes_servicos/` | 3.381 | aba dentro do drawer |
| Faturas — baixa | `financeiro/faturas/faturas_detalhes_baixar/` | 3.097 | aba dentro do drawer |
| Faturas — filtros | `financeiro/faturas/faturas_filtros/` | 2.654 | toolbar da página |
| Contas a pagar — lista | `financeiro/contas_pagar/contas_pagar/` | 2.955 | `app/(app)/contas-pagar/page.tsx` |
| Contas a pagar — detalhe | `financeiro/contas_pagar/contas_pagar_detalhes/` | 7.710 | `components/drawers/conta-pagar-drawer.tsx` |
| Contas a pagar — baixa | `financeiro/contas_pagar/contas_pagar_baixar/` | 2.985 | aba dentro do drawer |
| DRE | `financeiro/gerar_dre/` | — | `app/(app)/dre/` |
| Saldo de contas | `financeiro/saldo_conta/saldo_conta_widget.dart` | 1.371 | `app/(app)/contas/` (painel) |

> Os dois "hubs" (`cadastro_modulos`, `financeiro_modulos`) existem só porque o FlutterFlow empilha componentes em vez de navegar. No Next viram entradas da sidebar — some a camada inteira.

## Infraestrutura → destino

| Assunto | Arquivo legado | Destino |
|---|---|---|
| Config Supabase (URL + anon key) | `lib/backend/supabase/supabase.dart` | `.env.local` + `lib/supabase-*.ts` |
| Chamadas RPC e APIs externas | `lib/backend/api_requests/api_calls.dart` (954 l.) | `lib/queries/*.ts` (server) + `app/api/*` |
| Estado global | `lib/app_state.dart` (459 l.) | cookie de empresa + zustand + sessão Supabase |
| Constantes (UFs, regex, bucket, raio) | `lib/app_constants.dart` | `lib/constantes.ts` |
| Tema (cores light/dark) | `lib/flutter_flow/flutter_flow_theme.dart` | `app/globals.css` |
| Wrappers de tabela | `lib/backend/supabase/database/tables/*.dart` (37) | `types/database.ts` gerado |
| DTOs | `lib/backend/schema/structs/*.dart` (23) | tipos derivados do gerado |
| Rotas | `lib/flutter_flow/nav/nav.dart` | file-system routing do App Router |
| Máscaras | `mask_text_input_formatter` nas telas | `components/ui/masks.ts` (do SIC) |
| Gemini | `lib/backend/gemini/gemini.dart` | avaliar se mantém — sem uso visível |

## Assets

`assets/images/`, `assets/fonts/` (fonte de ícones `Coolicons_FlutterMart_com.ttf`), `assets/pdfs/`, `assets/jsons/`, `assets/videos/`, `assets/audios/`.
Logo e ícones do app estão em `assets/images/app_launcher_icon.png` e `adaptive_foreground_icon.png` (fundo `#006A28`). Reaproveitar para favicon e PWA.

## Como consultar

```powershell
# achar onde uma regra é aplicada
rg "fkCartaoFatura" "C:\Users\pedro\Pedro\Projetos DEV\Vpay\_legado\vpay\lib"

# ver uma ação custom inteira
code "C:\Users\pedro\Pedro\Projetos DEV\Vpay\_legado\vpay\lib\custom_code\actions\cadastra_fatura_parcelas.dart"

# listar todas as chamadas de RPC
rg "rpc/" "C:\Users\pedro\Pedro\Projetos DEV\Vpay\_legado\vpay\lib\backend\api_requests\api_calls.dart"
```
