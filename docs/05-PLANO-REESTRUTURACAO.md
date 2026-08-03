# 05 — Plano de reestruturação

De **Flutter/FlutterFlow (122k linhas)** para **Next.js 16 + React 19 + Supabase**, no padrão do SIC.

## Princípio

O banco fica. As RPCs ficam. A lógica de negócio é traduzida com correções pontuais. **A UI é jogada fora inteira** — 122k linhas de Dart gerado não têm nada aproveitável, e é justamente ali que está o custo de manutenção que motivou a reformulação.

Ordem de grandeza esperada no destino: **8–12k linhas de TSX**, pelas proporções do SIC.

## Estrutura de destino

```
vpay/
  app/
    (auth)/
      login/page.tsx
      recuperar-senha/page.tsx
      auth/callback/route.ts
    (app)/
      layout.tsx                 sidebar + header + seletor de empresa
      dashboard/page.tsx
      faturas/page.tsx
      contas-pagar/page.tsx
      cartoes/page.tsx
      contas/page.tsx            contas bancárias + saldo
      extrato/page.tsx           importação + conciliação
      clientes/page.tsx
      servicos/page.tsx
      centro-custo/page.tsx
      dre/page.tsx
      relatorios/page.tsx
      configuracoes/page.tsx
      perfil/page.tsx
    empresas/page.tsx            seleção de tenant (fora do layout do app)
    api/
      faturas/[id]/enviar/route.ts
      faturas/[id]/pdf/route.ts
      extrato/importar/route.ts
      whatsapp/route.ts
      version/route.ts
    globals.css                  design system (tokens do VPAY)
    layout.tsx
  components/
    ui/                          kit copiado/adaptado do SIC
    drawers/                     fatura, conta-pagar, cliente, servico, cartao, conta-bancaria
    layout/                      sidebar, header, empresa-switcher, theme-provider
    charts/
  lib/
    supabase-client.ts
    supabase-server.ts
    empresa.ts                   empresa ativa (cookie + server)
    feriados.ts                  dias úteis + feriados calculados
    parcelas.ts                  regras 1 e 3 do doc 04
    formato.ts                   moeda, data, CNPJ
    use-drawer.ts                store zustand
  hooks/
  types/database.ts              gerado via supabase gen types
```

## Decisões fechadas

- **Arquitetura:** idêntica ao SIC (doc 01). App Router, kit de UI próprio, drawers via zustand, tokens em CSS vars.
- **Modelagem:** mantida (doc 03), com as 8 melhorias estruturais listadas lá.
- **Identidade visual:** verde VPAY sobre os tokens do SIC (doc 07).

## Decisões a tomar (bloqueiam o início)

| # | Decisão | Opções |
|---|---|---|
| A | **Mesmo projeto Supabase ou novo?** | Reusar `gewshjjyqdfdcjtwlyas` (dados vivos, migração incremental — as melhorias do doc 03 viram migrations) × projeto novo com carga de dados (limpo, mas exige janela de corte). *A modelagem é a mesma nos dois casos; muda só onde ela roda.* |
| B | **Web-only?** | O legado compila para Android/iOS. Se houver uso mobile real, o Next precisa ser PWA — isso muda o layout desde o dia 1 |
| C | **Módulo Contratos entra na v1?** | Schema existe, tela nunca existiu |
| D | **Estratégia de PDF** | Ver seção 8 do doc 04 |
| E | **Coexistência** | O app FlutterFlow (`onpay.flutterflow.app`) continua no ar durante a migração, ou é corte seco? Afeta o link do e-mail de fatura |

## Fases

### Fase 0 — Fundação (bloqueante para tudo)
1. `create-next-app` com as versões pinadas do doc 01; copiar `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vercel.json`, o `next.config.ts` de versionamento.
2. Portar `app/globals.css` do SIC trocando a paleta primária para o verde VPAY (`#006A28` light / `#00BB47` dark) — manter toda a escala tipográfica densa e as alturas fixas.
3. Portar `components/ui/page-components.tsx` e primitivas (`button`, `badge`, `panel`, `toast`, `confirm`, `pagination`, `masked-input`, `masks`).
4. `lib/supabase-client.ts` / `lib/supabase-server.ts`; `supabase gen types typescript` → `types/database.ts` (**tipado de verdade, sem `<any>`**).
5. Auth: login, recuperação de senha, callback.
6. **Multi-tenant:** empresa ativa em cookie httpOnly, seletor no header, e **RLS ligada no banco** (ação 1 do doc 03). Não avançar sem isso — é o que hoje protege os dados apenas por convenção.

### Fase 1 — Cadastros (mais simples, valida o padrão)
Clientes (+ endereços + grupos + CNPJá), Serviços, Centro de custo, Contas bancárias, Cartões.
Padrão: página com lista (server component + RPC) → drawer de detalhe (client component).
Aqui se estabelece o template que todas as outras telas repetem.

### Fase 2 — Contas a pagar
Lista via `get_contaspagarvgeral`, detalhe via `get_contapagar_by_id`, parcelas via `get_contasparcelas`.
Porta `lib/parcelas.ts` (regras 1 e 3) + baixa de parcela.

### Fase 3 — Faturas (maior módulo)
Lista + filtros + detalhe + serviços + parcelas + baixa + envio por e-mail + PDF.
Substitui os 11.542 + 5.175 + 3.381 + 3.097 + 2.654 = **~25.800 linhas** de Dart.
Criar a RPC transacional `criar_fatura` aqui.

### Fase 4 — Tesouraria
Saldo de contas (`vwsaldo`), importação de extrato CSV (corrigindo o hash), conciliação, fechamento de fatura de cartão.

### Fase 5 — Relatórios e DRE
DRE (`dre_por_ano`, gráficos com recharts) + os relatórios PDF conforme a decisão D.

### Fase 6 — Corte
Paridade verificada módulo a módulo, redirect do domínio antigo, desligamento do FlutterFlow.

## Correções obrigatórias na tradução

Levantadas nos docs 02–04, consolidadas:

| Prioridade | Item | Onde |
|---|---|---|
| 🔴 | **Rotacionar o token da Meta/WhatsApp** que está em claro no zip | doc 02 |
| 🔴 | **Ligar RLS** por `fkEmpresa` | doc 03 §1 |
| 🔴 | Remover `cartao.ccv`, mascarar `numero` | doc 03 §2 |
| 🔴 | Feriados calculados, não lista de 2025 | doc 04 §1 |
| 🟠 | `criar_fatura` transacional (fim do N+1 e dos órfãos) | doc 04 §2 |
| 🟠 | Hash de dedup do extrato sem o número da linha + índice único | doc 04 §5 |
| 🟠 | `zsequencias` atômico | doc 04 §10 |
| 🟠 | `startDate`/`endDate` = ano corrente, não `2025` fixo | doc 02 |
| 🟡 | Arredondamento das parcelas de cartão igual ao das demais | doc 04 §4 |
| 🟡 | Guarda: não mexer em parcela já paga | doc 04 §3 |
| 🟡 | Paginação server-side nas listas | doc 02 |
| 🟡 | Linhas rejeitadas do CSV reportadas ao usuário | doc 04 §5 |
| ⚪ | Dropar `temp`, corrigir `resposnsavel`, resolver `idtenant` | doc 03 |

## Como validar a paridade

Rodar os dois sistemas contra o mesmo banco e conferir, por módulo:
- listagens com os mesmos filtros retornam a mesma contagem e o mesmo total;
- criar fatura de 5 parcelas nos dois → mesmas datas e mesmos valores centavo a centavo;
- DRE do mesmo ano bate linha a linha;
- PDF de fatura com o mesmo conteúdo (layout pode mudar).

Os 6 invariantes do fim do doc 04 viram a suíte de testes mínima.
