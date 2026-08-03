# VPAY — Documentação da reformulação

Migração do VPAY de **FlutterFlow/Flutter** para **Next.js 16 + React 19 + Supabase**, seguindo o padrão já consolidado no projeto SIC.

## Decisões já fechadas

1. **Mesma arquitetura do SIC** — App Router, kit de UI próprio, drawers via zustand, design system em CSS vars. Sem lib de componentes, de form ou de data.
2. **Mesma modelagem de dados**, com as melhorias pontuais listadas no doc 03 (RLS, CVV, `zsequencias`, simetria de parcelas).
3. **Verde do VPAY** como cor de marca (`#006A28` light / `#00BB47` dark) — resto dos tokens idêntico ao SIC. Detalhe no doc 07.

## Documentos

| Doc | Conteúdo |
|---|---|
| [01 — Stack alvo](01-STACK-ALVO.md) | Versões exatas e convenções extraídas do SIC (`locasystem` v1.1.1) |
| [02 — VPAY legado](02-VPAY-LEGADO.md) | Inventário do app FlutterFlow: telas, rotas, RPCs, APIs externas, dívidas |
| [03 — Modelo de dados](03-MODELO-DADOS.md) | 30 tabelas + 6 views do Supabase e as melhorias a aplicar |
| [04 — Regras de negócio](04-REGRAS-NEGOCIO.md) | Lógica de domínio a preservar (parcelas, cartão, extrato, DRE) + invariantes |
| [05 — Plano](05-PLANO-REESTRUTURACAO.md) | Estrutura de destino, decisões pendentes, fases, correções obrigatórias |
| [06 — Mapa do código legado](06-MAPA-CODIGO-LEGADO.md) | **Onde cada regra está no código Dart** → destino no Next |
| [07 — Design tokens](07-DESIGN-TOKENS.md) | Paleta e escala; o `globals.css` implementado segue o registro Apple |
| [08 — Arquitetura](08-ARQUITETURA.md) | **Estrutura do código, camadas, plugs multiproduto e dívida conhecida** |
| [10 — Tickets e faturamento](10-TICKETS-E-FATURAMENTO.md) | **Modelo novo: ticket é a origem da conta a receber, faturamento parcial, nomenclatura** |
| [09 — Pendências](09-PENDENCIAS.md) | **Estado atual: segurança, contornos ligados, decisões visuais e armadilhas** |

## Resumo em uma tela

- **Origem:** Flutter 3.x / FlutterFlow, 227 arquivos Dart, **122.653 linhas**, 9 rotas para ~30 telas, arquivos de até 11.542 linhas.
- **Destino:** Next.js **16.1.6** / React **19.2.3** / TypeScript **5.9.3** / Tailwind **4.2.1** / `@supabase/ssr` **0.9.0** + `supabase-js` **2.99.1** / zustand **5.0.12**.
- **O que se mantém:** o projeto Supabase, o schema, as 13 RPCs Postgres, o bucket `virtusmind`, a paleta verde.
- **O que se joga fora:** toda a camada de UI Dart, o `FFAppState`, o background em WebView, os wrappers de tabela do FlutterFlow.
- **Bloqueadores de segurança antes de qualquer código:** rotacionar o token da Meta que está em claro no backup, ligar RLS por `fkEmpresa`, remover o CVV de cartão do banco.

## Fonte

- **Código legado extraído:** `C:\Users\pedro\Pedro\Projetos DEV\Vpay\_legado\vpay\` — consulta permanente, mapeado no doc 06. Não entra no build nem no repositório.
- Zip original: `E:\bkp flutterflow\vpay.zip`
- Referência de stack: `C:\Users\pedro\Pedro\Projetos DEV\SIC`
- Supabase: projeto `gewshjjyqdfdcjtwlyas`

Documentação levantada em 31/07/2026.
