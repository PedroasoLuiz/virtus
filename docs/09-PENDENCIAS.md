# 09 — Pendências

Estado em **01/08/2026**. Este doc existe para sobreviver ao fim de uma sessão de trabalho: o que está aberto, por quê, e o que decidir.

---

## ✅ Aplicado em 01/08/2026 (via MCP)

Quatro migrations rodadas no projeto `gewshjjyqdfdcjtwlyas`:

| Migration | O que fez |
|---|---|
| `views_security_invoker` | As 6 views passaram a respeitar a RLS de quem consulta. Era o único achado **ERROR** do advisor. |
| `rls_plataforma_planos_assinaturas` | Policies em `planos` (leitura autenticada) e `assinaturas` (só do tenant, só leitura) + função `empresas_do_usuario()`. |
| `menu_favoritos` | Tabela `menufavoritos` com RLS por usuário. |
| `funcoes_search_path_fixo` | `search_path` fixado nas 24 funções — fecha *search path hijacking*. |
| `backfill_clientegrupo_empresa` | Preencheu `fkEmpresa` nos 24 grupos. "GERAL" era compartilhado por 3 empresas — virou uma cópia por empresa, com os clientes repontados. |
| `rls_dominio_isolamento_tenant` | **Isolamento por empresa nas 31 tabelas.** Trocou as policies `using (true)` por tenant real. |

E no código:

- **Service role removida do app.** Não existe mais `adminClient`, `dbLeitura` nem `SUPABASE_SERVICE_ROLE_KEY` no contrato de env. Todo acesso a dado passa pelo token do usuário, sob RLS — a aplicação não tem como contornar o isolamento nem por engano.
- **Bypass de desenvolvimento removido** (`VPAY_DEV_EMPRESA`). Para testar tela agora é preciso logar, como em produção.
- **Favoritos migrados para a tabela** `menufavoritos`. O store local mantém a estrela respondendo na hora; se a gravação falhar, ele volta atrás em vez de mentir sobre o que está salvo.

Contorno **removido** do código: `VPAY_PLATAFORMA_SEM_RLS` e `dbPlataforma()` não existem mais.

---

## 🔴 Segurança

### Isolamento de tenant — RESOLVIDO em 01/08/2026

Antes: 31 tabelas com policy `using (true)`. Qualquer pessoa com o anon key — que é público, vai no bundle do navegador — lia o banco inteiro de todas as empresas, incluindo `pagamentos` (884 registros), `extratobancario` e `cartao`.

Agora, três formas de isolamento conforme a tabela:

- **(a) tem `fkEmpresa`** (16 tabelas) — compara direto com `empresas_do_usuario()`.
- **(b) é filha** (10 tabelas) — herda o tenant do pai por `EXISTS`.
- **(c) caso próprio** — `empresas` (só as do usuário), `usuariosxempresas` (só o próprio vínculo), `usuarios` (o próprio + colegas de empresa, via `usuarios_visiveis()`), `usuariosxgrupo` (próprio), `faturasstatus` (leitura global).

As auxiliares são `SECURITY DEFINER` de propósito: leem `usuariosxempresas`, que também tem RLS — sem isso a policy consultaria a tabela sob a própria policy e entraria em recursão.

**Verificado após aplicar:**

| Papel | O que enxerga |
|---|---|
| `pedro.luiz` (empresas 1 e 2) | 140 de 151 faturas · 99 de 116 clientes · 2 de 5 empresas · 12 usuários (colegas) |
| **anônimo** | **0 em faturas, clientes, pagamentos, cartão, extrato e empresas** |

A view `vwsaldo` devolve 2 linhas ao usuário — prova de que a correção de `security_invoker` pegou.

### 63 tabelas com RLS ligada e nenhuma policy

Módulos que o VPay ainda não usa (estoque, OS, manutenção, compras, obras, chat). Continuam fechadas — o que é o comportamento seguro. Cada uma ganha policy quando o módulo entrar.

### Outros

- 1 bucket público permitindo listagem (`virtusmind`).
- Proteção contra senha vazada desligada no Auth.
### Chaves a rotacionar — o que resta de mais urgente

**Service role.** Varredura feita em 01/08/2026 — o valor da chave **não está em nenhum arquivo do projeto**, nem no build (`.next`), nem em log, nem em temporário. Só sobrou o nome da variável em comentário, que é documentação.

Mas ela **continua comprometida**, por dois motivos que arquivo nenhum resolve:

1. Foi colada em texto puro no chat desta sessão, e aparece 18 vezes no histórico do Claude Code (`~/.claude/projects/.../<sessão>.jsonl`).
2. Chave que já circulou fora do cofre é chave queimada, independentemente de onde esteja hoje.

A service role **ignora toda a RLS aplicada acima**. Enquanto não for rotacionada, o isolamento por empresa vale apenas contra quem tem o anon key.

**Procedimento:**
1. Supabase Studio → Settings → API → *Reveal/Rotate* a `service_role`.
2. Não colocar a nova em lugar nenhum: o app não usa mais service role.
3. Depois de rotacionar, apagar o `.jsonl` da sessão se quiser limpar o rastro — mas isso é higiene, não mitigação; a mitigação é a rotação.

**Token da Meta/WhatsApp** — está em texto puro no `_legado/vpay/lib/backend/api_requests/api_calls.dart` (ver docs/02). Mesmo tratamento.

### Regra para não repetir

Segredo nunca entra em comando, nem em arquivo versionado. Para consultar o banco com privilégio, usar o **MCP do Supabase**, que autentica por fora e não expõe chave no texto. Foi assim que as migrations desta sessão foram aplicadas.

---

## 🟠 Correção funcional pendente

| Item | Situação |
|---|---|
| **Idempotência de escrita financeira** | `idempotencyKeySchema` existe em `shared/validators`; falta a tabela de chaves e o wrap no handler. **Obrigatório antes de baixa de pagamento.** |
| **Transação em `criar()`** | PostgREST não expõe transação entre requisições. Hoje há compensação manual. Correção: RPC `criar_fatura(jsonb)`. |
| **Trilha de auditoria** | Não existe tabela. O drawer mostra criador/editor lendo `created_at`/`fkUserCriacao`, que é só o último estado — não o histórico. |
| **Testes** | Nenhum runner. `shared/domain/parcelas.ts` e `shared/utils/money.ts` são os primeiros alvos: funções puras, alto valor. |
| **`database.types.ts`** | Escrito à mão. Com o MCP ligado dá para gerar de verdade (`generate_typescript_types`). |
| **`zsequencias` atômico** | **Já resolvido no banco**: existem `get_next_seq_fatura(p_empresa)` e `get_next_seq_contaspagar(p_empresa)`. Falta o app usar em vez de ler a tabela. |

---

## 🟡 Contornos ligados (remover depois)

| Contorno | Onde | Sai quando |
|---|---|---|
| Assinaturas Enterprise de teste | `assinaturas` id 1 e 2 (empresas 1 e 2) | Quando o billing real existir |
| Contexto de demonstração | `shared/demo/dados-demo.ts` | Só é usado quando o Supabase não está configurado — pode ficar |

Nenhum outro contorno ligado. `VPAY_DEV_EMPRESA`, `VPAY_PLATAFORMA_SEM_RLS`, `adminClient` e o cookie de favoritos foram todos removidos.

⚠️ **Consequência de testar:** sem bypass, verificar tela exige login de verdade. Conferir por status HTTP não prova render — rota protegida dá 307 e o layout nunca executa.

---

## 🟢 Telas

**Funcionais:** Faturas (lista, kanban, drawer), Contas a pagar (lista, drawer), Clientes (CRUD), Serviços (CRUD), Centro de custo (CRUD), Plano, Login e seleção de empresa.

**Placeholder** (abrem e explicam o que falta): Cartões, Contas e saldo, Extrato, DRE, Fluxo de caixa, Relatórios.

⚠️ **O backend dessas telas já existe.** O banco tem 23 RPCs, bem mais que as 13 que o zip do FlutterFlow mostrava. As que faltavam mapear:

| RPC | Alimenta |
|---|---|
| `dre_por_ano(pano, pfkempresa)` | DRE |
| `get_projecao_caixa_json(p_empresa, p_datafim)` | Fluxo de caixa |
| `get_projecao_caixa_mensal(empresa_id, data_inicio, data_fim)` | Fluxo de caixa |
| `get_extratobancario(datainicio, datafim, empresa, conta)` | Extrato bancário |
| `get_cartoes` · `get_cartaofaturaparcelas` · `get_competencias_cartao` | Cartões |
| `get_contasreceber` · `get_contaspagar` · `getcontaspagas` | Relatórios |
| `get_next_seq_fatura` · `get_next_seq_contaspagar` | Numeração atômica |

Ou seja: essas telas são **trabalho de UI**, não de regra. É o caminho mais curto para tirá-las de placeholder.

**Não existe ainda:** criação de fatura e de conta a pagar — as duas dependem do assistente de parcelamento, que é fluxo de três passos, não formulário. E nenhuma ação de baixa: "Receber", "Baixar parcela" e "Enviar por e-mail" estão desabilitados de propósito.

---

## Decisões visuais desta rodada

Registradas porque só existiam na conversa:

- **Branco é reservado ao dado.** Casca (lateral, topo, área de trabalho) fica no cinza; brancos são a tabela e os cards do kanban.
- **Raio Apple** é `corner-shape: superellipse(2)` no seletor universal, não valor de `border-radius`. O raio controla o quanto o canto abre; o expoente controla o caráter da curva. Subir o expoente deixa **mais quadrado**, não mais curvo.
- **Círculos de verdade** usam a classe `.redondo` (`corner-shape: round`) — squircle aplicado a raio circular achata as laterais.
- **Menu**: 3 níveis, trilho de 1px com marcador, tudo em token `--nav-*`. O texto do filho alinha com o rótulo do grupo (`--nav-texto-x1: 31px` = padding + ícone + gap).
- **Guias no topo foram removidas** a pedido — viraria bagunça. No lugar, a busca global do SIC (Ctrl+K).
- **Kanban sem drag-and-drop** de propósito: mover coluna significa mudar status, e isso passa pela máquina de transições. Fazer errado moveria fatura por acidente.
- **Total da fatura aparece num lugar só**, acima da barra de progresso.
- **`--h-header`** merece revisão agora que o subtítulo das listagens saiu: o cabeçalho tem `min-height: 54px` pensado para duas linhas.

---

## Armadilhas já pagas (não repetir)

1. **`"use client"` marca o módulo inteiro.** Constante ou função pura exportada de um módulo cliente não pode ser lida do servidor. Custou dois bugs: `lerFavoritosDoCookie` e `COOKIE_SIDEBAR`. Por isso existe `components/layout/cookies.ts` sem diretiva.
2. **Client component não pode importar service.** Arrasta o repositório e o Supabase para o bundle e o build quebra. `situacaoDaConta` foi para `types.ts` por isso.
3. **`position: sticky` cria contexto de empilhamento.** Sem `z-index`, o irmão seguinte pinta por cima — foi o que escondeu o menu flutuante atrás da tabela.
4. **`redirect()` do Next lança exceção de controle.** Dentro de `try/catch` o login trava sem erro visível.
5. **Verificar por status HTTP não prova render.** Rotas protegidas dão 307 e o layout nunca executa; erro de RSC passa batido. Para testar tela, ligar `VPAY_DEV_EMPRESA=1`.
6. **`select` do supabase-js precisa ser literal.** Concatenar com `+` derruba a inferência de tipo e tudo vira `never`.
