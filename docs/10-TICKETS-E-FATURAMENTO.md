# 10 — Tickets e faturamento

Modelo aplicado em **01/08/2026**. Inverte o desenho anterior, em que a fatura era o ponto central e controlava serviços e pagamentos.

## O fluxo

```
Ticket (execução)                    Conta a receber
├─ serviços (orçamento)   ──────►    ├─ vínculo: valor deste ticket
├─ centro de custo (via serviço)     ├─ parcelas
└─ saldo a faturar                   └─ baixas → pagamentos
```

O **ticket é o ponto de partida do orçamento**. Ele acumula os serviços; a conta a receber puxa **valor** de um ou mais tickets.

## Nomenclatura — importante

| Interface | Banco | Por quê |
|---|---|---|
| **Serviços** (grupo de menu) | — | Nome do assunto, não do registro. |
| **Tickets** (tela) | `ordensservico` | A tabela veio de outra aplicação e é referenciada pelas RPCs `get_*`. Renomear quebraria aquele sistema sem ganho — o nome que o usuário vê é decisão de interface. |
| **Contas a receber** | `faturas` | A fatura deixou de ser o centro; passou a ser o documento de cobrança gerado a partir de tickets. |

⚠️ **"Serviços" agora existe duas vezes no menu**: o grupo (que contém Tickets) e o item *Cadastros → Serviços* (`/servicos`, a tabela `servicos`). São coisas diferentes — um é a operação, o outro é o catálogo de preços. A busca global lista os dois com o mesmo rótulo.

**Ordem no menu:** Tickets vem **antes** de Financeiro. O ticket é a origem do fluxo — o orçamento nasce nele e vira conta a receber —, então aparece antes de quem consome.

**Título do ticket migrado** ficou só com o número da fatura de origem (`214`, não `Fatura 214`). O texto afirmava um vínculo 1:1 que o modelo desfaz. O `apontamento` de cada ticket segue com a explicação completa.

⚠️ Ao ler o banco, `ordensservico` = Ticket. A camada de domínio (`src/modules/tickets/`) já traduz.

## Origem da conta a receber — desenho polimórfico

Uma conta a receber pode vir de **ticket, contrato ou (futuramente) venda de produto**, e pode somar origens de tipos diferentes na mesma conta.

```sql
faturasorigens (
  "fkFatura",
  origem       -- TICKET | VENDA | CONTRATO   (discriminador)
  "fkOrdem"    -- FK real, anulável
  "fkContrato" -- FK real, anulável
  valor,
  constraint origem_coerente check (exatamente uma FK, coerente com `origem`)
)
```

**Padrão: arco exclusivo.** Discriminador + FKs anuláveis + `CHECK`. É o mesmo desenho que `movimentacoes` já usa neste banco (`origem` + `fkFatura`/`fkOrdem`/`fkOrdemCompra`/`fkOrdemProducao`) — segue a convenção da casa.

Por que **não** um `origemId` genérico: perderia a chave estrangeira. Aqui cada FK é real e o banco continua impedindo apontar para registro inexistente.

**Faturamento parcial:** o valor mora no vínculo.

> Ticket 55 vale R$ 20.000. A conta 66 leva R$ 5.000 dele **mais** R$ 230 de outro ticket. O restante fica disponível depois.

**`vw_origens_faturamento`** entrega `(tipo, origem_id, descrição, total, faturado, saldo)` para qualquer origem. A tela de gerar conta consulta essa view e **não precisa saber o tipo**. Acrescentar venda é somar um ramo ao `UNION` — nenhuma tela muda.

O saldo é **calculado, nunca armazenado**: guardar valor derivado obriga a sincronizá-lo a cada insert, update e delete, e é aí que faturamento passa a divergir de si mesmo.

**Trigger `trg_faturasorigens_saldo`** barra faturar acima do total da origem — qualquer tipo, porque consulta a view. A regra vive no banco: cobrar duas vezes é erro que o cliente vê, e todo caminho de escrita passa por ela.

Testado: 5k de 20k → saldo 15k; +15k → saldo 0; +1 → barrado; ticket+contrato na mesma linha → barrado pelo arco exclusivo.

### Para adicionar venda de produto

1. Criar o documento de venda (`vendas` + itens) quando o fluxo estiver definido.
2. `alter table faturasorigens add column "fkVenda" bigint references vendas(id)` e ampliar o `CHECK`.
3. Somar um ramo ao `UNION` de `vw_origens_faturamento`.

Nada muda em telas, trigger ou nas contas existentes.

⚠️ **Estoque:** serviço não tem estoque, produto tem. Ao incluir produto é preciso decidir **quando o estoque se move** — criação do documento (reserva), encerramento ou faturamento. `movimentacoes` já tem `fkFatura`/`fkOrdem` para amarrar. Errar esse ponto faz o estoque divergir sem ninguém perceber até o inventário.

## Migração das 151 faturas antigas

Cada fatura histórica ganhou um ticket, porque o serviço carrega o centro de custo e no modelo novo o serviço vive no ticket.

| Verificação | Resultado |
|---|---|
| Tickets criados | 151 |
| Itens copiados | 298 → 298 |
| Vínculos | 151 — nenhuma fatura sem origem |
| Valor vinculado | R$ 445.357,20 = total das faturas |
| Saldo residual | R$ 104,00 — 2 faturas cujos itens somavam mais que o total |

Decisões:

- **Coluna `origem`** (`EXECUCAO` / `MIGRACAO` / `CONTRATO`). Sem ela, indicadores operacionais — tempo médio, produtividade — somariam 151 tickets que nunca foram trabalhados.
- **Itens copiados, não movidos.** `faturasxservicos` segue com os 298 registros: é o histórico do que foi cobrado e serviu para conferir a própria migração. O fluxo novo escreve só no ticket. Limpar quando houver confiança.
- **Migração idempotente** — detecta tickets `MIGRACAO` e não roda duas vezes.
- **Vínculo não é obrigatório no banco.** O fluxo novo exige ticket, mas um `NOT NULL` invalidaria as 151 faturas históricas, e criar tickets retroativos "de verdade" seria inventar histórico operacional.

## Status do ticket — colunas do quadro

As colunas do kanban são **cadastro do usuário** (`ordensservicostatus`), não uma situação derivada do saldo. A etapa em que o ticket está é decisão de quem opera.

| Índice | Coluna | Quem move |
|---|---|---|
| 1 | Orçamento | sistema (entrada) / usuário |
| 2 | Na fila | usuário |
| 10…899 | quantas o usuário criar | usuário |
| 900 | Faturado | **só o sistema** |
| 1000 | Encerrada | **só o sistema** |

O rótulo da 900 é "Faturado", mas a **chave continua `PARCIAL`** — ela quer dizer *faturado em parte, ainda há saldo*. "Parcialmente faturado" não cabia em cabeçalho de coluna, e a distinção com *Encerrada* já vem da posição no quadro. É exatamente para isso que a chave existe: o rótulo é do usuário, o gatilho procura pela chave.

As quatro fixas têm `chave` preenchida (`ORCAMENTO`, `FILA`, `PARCIAL`, `ENCERRADA`) e `sistema = true`. Podem ser **renomeadas e recoloridas** — o nome é do usuário —, mas não excluídas nem desativadas: o gatilho precisa de um destino, e ele procura pela chave, não pelo nome.

**Índices com folga de 10.** Inserir coluna no meio não renumera a tabela inteira.

### Quem move o card

`aplica_status_do_ticket(id)` concentra a regra. Vive no banco porque a etapa tem de refletir o dinheiro em **qualquer** caminho de escrita — tela, API ou correção manual.

| Situação | Coluna |
|---|---|
| nada faturado | *Orçamento* (ou a coluna do usuário — ver abaixo) |
| faturado, mas ainda há saldo | *Faturado* |
| faturado, sem saldo **e tudo recebido** | *Encerrada* |

**"Encerrada" significa recebida, não faturada.** Saldo tem duas pernas e as duas precisam estar zeradas: saldo a faturar (total do ticket que não virou conta) e saldo a receber (conta emitida com parcela em aberto).

Três gatilhos chamam a mesma função — faltar um faria o quadro mentir até alguém editar o ticket:

| Gatilho | Evento |
|---|---|
| `trg_faturasorigens_status` | vínculo criado, alterado ou removido |
| `trg_faturasparcelas_status` | baixa dada ou desfeita |
| `trg_faturas_cancelada_status` | conta cancelada ou reativada (só quando `cancelada` muda) |

Desfazer o faturamento **devolve o ticket à coluna de onde saiu** (`fkStatusRetorno`), ou a *Orçamento* se ela não existir mais.

**Recebimento é testado por existência de parcela em aberto, não por soma de valores.** 6 das 72 faturas quitadas têm parcelas que não fecham o total (herança do legado); comparar valor deixaria essas seis travadas fora de *Encerrada* para sempre. Conta sem nenhuma parcela conta como pendente.

Ciclo verificado ponta a ponta: faturou parcial → *Faturado*; faturou tudo, nada pago → *Faturado*; baixou 1 de 2 → *Faturado*; baixou a última → *Encerrada*; estornou → *Faturado*; cancelou a conta → *Faturado*; reativou → *Encerrada*; removeu o vínculo → coluna de origem.

⚠️ **`tg_table_name` num `CASE` não funciona.** O gatilho de conta serve `faturas` (`id`) e `faturasparcelas` (`fkFatura`). Num `CASE`, plpgsql resolve os campos das **duas** pernas, e a errada estoura com `record "new" has no field`. Tem de ser `IF`, que só compila o ramo tomado.

### ⚠️ Conta cancelada consome o saldo do ticket para sempre

`vw_origens_faturamento` soma **todo** vínculo de `faturasorigens` em `faturado`, inclusive de conta cancelada. Consequências:

- o ticket parece 100% faturado mesmo sem cobrança viva;
- `checa_saldo_da_origem` passa a **barrar uma nova cobrança do mesmo ticket** — cancelou, não refatura.

Contorno atual: `tem_recebimento_pendente` trata conta cancelada como **pendente**, então o ticket para em *Faturado* em vez de mentir *Encerrada*. Entre dois estados imperfeitos, esse é o honesto — há algo em aberto ali.

**A correção de verdade** é excluir conta cancelada do `faturado` da view. Isso devolve saldo a 38 tickets migrados e muda número em tela, então é decisão de negócio, não de gatilho.

`fkStatusRetorno` existe porque, sem ele, cancelar uma conta a receber jogava o ticket de "Em execução" para "Orçamento" — apagando a etapa operacional. É `on delete set null`: um ponteiro de conveniência não pode impedir a exclusão de uma coluna vazia.

**A UI não deixa arrastar para as duas colunas de faturamento**, nem para fora delas (`tickets.service.moverTicket`). Arrastar um card para *Encerrada* afirmaria uma cobrança que não existe.

⚠️ Faturar parcialmente **tira o ticket da coluna operacional** — é o que "*Faturado* é fixa" significa. Quem precisa acompanhar execução e cobrança ao mesmo tempo vai querer dois quadros, não um.

### Visual do quadro

| Decisão | Por quê |
|---|---|
| Coluna com `--kanban-coluna-bg` — verde um tom abaixo da casca, **a 35%** | cheio, o verde virava bloco de cor e competia com o card branco; diluído, só marca o trilho |
| Raio só nos cantos de cima, sem padding inferior | a coluna encosta na base e lê como trilho que continua abaixo da dobra, não como caixa boiando |
| Cabeçalho: nome à esquerda, contagem à direita — número solto e cinza, sem pastilha | sem bolinha e sem somatória. A cor do quadro vive nas pastilhas do card; repetir no cabeçalho competiria com elas sem dizer nada a mais |
| Coluna vazia: três silhuetas brancas a 35% + "Nenhum ticket" | o texto sozinho não mostrava que ali cabe card. A altura vem de repetir as linhas do card real com conteúdo vazio, não de um `height` fixo — fixar faria as duas divergirem no primeiro ajuste de tipografia |
| `#id` sempre no verde da marca | é o identificador que se procura, se dita e se cola em outra tela. Único elemento verde do card (em cancelado, apaga junto) |
| Ícones a 14px, traço 1.7 | a 12px o traço fecha e o desenho vira mancha |
| Contagens do card: ícone + número, **sem pastilha**, coloridos (serviços `info`, contas `success`) | a cor separa "3 serviços" de "2 contas" sem obrigar a ler o ícone. Com fundo tingido eram duas caixas competindo com o card que já as contém. **Contagem zero fica cinza** — senão a cor deixaria de significar "tem algo aqui" |
| Rodapé do card **sem linha divisória**, espaçamento maior entre as linhas | o próprio espaço separa; um tracinho dentro de um card de 270px é mais uma borda para o olho processar |
| Centro de custo do cliente sob o nome | é atributo do cliente, não do ticket, e por isso vem logo abaixo dele |
| `#id`, período e cliente todos a 11px | são três identificadores do mesmo peso; nenhum manda nos outros |
| Topo do card traz o **período em meses** (`periodoEmMeses`), não a data de encerramento | "julho de 2026", "ago~nov de 2026", "nov de 2025 ~ fev de 2026". O dia não muda decisão nenhuma num quadro, e "01/07/2026 a 30/11/2026" gasta a linha inteira para dizer "segundo semestre". Mês único sai por extenso porque cabe; intervalo abrevia. O ano só aparece duas vezes quando os lados divergem |
| Nome do cliente em duas linhas (`line-clamp: 2`) | "COMERCIO DE MATERIAIS ELET…" cortado não identifica ninguém |
| Segunda linha: título; **título puramente numérico conta como vazio** e a linha some | ⚠️ nos migrados o título é o número da **fatura de origem** — o ticket 155 tem título "214". Não dá para detectar isso comparando com `ticket.id`: os dois números são diferentes, e a checagem passa batido. Preencher com data rotulada trocava um dado sem sentido por outro; card mais curto é mais honesto |

### Onde os 151 migrados foram parar

A migração original jogou todos em *Encerrada*, porque olhou só o saldo — e todo ticket migrado nasce 100% faturado por construção. Orçamento, conta em aberto e conta paga caíram no mesmo balde. `recoloca_tickets_migrados_por_status_da_fatura` distribuiu pelo status da **fatura de origem**:

| Status da fatura | Coluna | Tickets |
|---|---|---|
| ORÇAMENTO | Orçamento | 33 (19 cancelados) |
| ABERTA | Na fila | 33 (18 cancelados) |
| FATURADA / PARC. PAGA | Faturado | 13 |
| PAGA | Encerrada | 72 |

Roda só em `origem = 'MIGRACAO'`: ticket do fluxo novo tem etapa de verdade e não pode ser reposicionado por um retrato do legado.

Depois que o gatilho passou a olhar recebimento, as colunas do sistema foram recalculadas e a distribuição final ficou:

| Coluna | Tickets | Cancelados |
|---|---|---|
| Orçamento | 33 | 19 |
| Na fila | 33 | 18 |
| Faturado | 12 | 1 |
| Encerrada | 73 | 0 |

O recálculo corrigiu 2 faturas marcadas `PARC. PAGA` que estavam com **todas** as parcelas pagas — status legado desatualizado. É o argumento de ler `faturasparcelas.pago` em vez de `faturas.status`.

### ⚠️ Os 66 em Orçamento e Na fila vão migrar sozinhos

Esses 66 estão lá por posicionamento manual, mas o sistema os enxerga como **100% faturados** — a migração criou vínculo em `faturasorigens` para toda fatura, inclusive as de status `ORÇAMENTO` e `ABERTA`, que não eram cobrança de verdade.

> Qualquer alteração no faturamento ou na baixa de um deles **puxa o card para *Faturado*** (ou *Encerrada*, se as parcelas estiverem quitadas).

Verificado antes da mudança de regra: o ticket 62, em *Na fila*, foi para *Encerrada* com um `update faturasorigens set valor = valor` (transação revertida).

Na prática quase não aparece — ninguém mexe no vínculo de ticket migrado. A correção de raiz seria remover o vínculo das faturas que nunca foram cobrança (status `ORÇAMENTO`), devolvendo o saldo a esses tickets.

### Cancelado não é coluna

`ordensservico.cancelada` é booleano e continua sendo. Cancelar é ortogonal à etapa: um ticket pode ser cancelado em qualquer uma delas, e virar coluna perderia a informação de onde ele parou. Na tela fica **cinza escuro no lugar em que estava**, e o filtro decide se aparece — escondido por padrão.

### ⚠️ Duas FKs para a mesma tabela

`ordensservico` aponta duas vezes para `ordensservicostatus` (`fkStatus` e `fkStatusRetorno`). O embed do PostgREST **precisa ser qualificado**:

```ts
"coluna:ordensservicostatus!ordensservico_fkStatus_fkey(descricao, chave)"
```

Sem o `!constraint` a resposta é `PGRST201` — verificado: a tela quebraria inteira, não parcialmente.

### Não existe mais `situacaoDeFaturamento()`

A função em TypeScript que derivava `A FATURAR / PARCIAL / FATURADO` foi removida. A resposta agora é a coluna, e quem decide é o gatilho. Duas fontes para a mesma pergunta divergiriam — e a divergência só apareceria na tela, com o número já errado.

### API

| Rota | O quê |
|---|---|
| `GET/POST /api/v1/tickets/status` | lista e cria coluna |
| `PATCH/DELETE /api/v1/tickets/status/:id` | renomeia, recolore, exclui |
| `PATCH /api/v1/tickets/:id/status` | move o ticket |

Excluir coluna ocupada é barrado no serviço: os tickets ficariam com `fkStatus` nulo e sumiriam do quadro sem aviso.

## Centro de custo do cliente

Todo cliente tem um centro de custo. `clientes.fkCentroCusto` → `centrodecusto`, com **"Geral" (tipo RECEITA)** criado em cada empresa e aplicado aos 116 clientes existentes.

**Tipo RECEITA, não DESPESA:** cliente é origem de entrada. Um centro de despesa amarrado a cliente jogaria receita na coluna errada do DRE. A tela só oferece centros de receita ativos.

O padrão não é `default` de coluna nem lógica de tela — é o gatilho `trg_clientes_centro_padrao` (BEFORE INSERT). Precisa ser assim porque o "Geral" é **por empresa**: um `default` não sabe o tenant, e deixar na tela faria cliente criado por API ou importação nascer sem centro.

O nome vem por **join**, nunca copiado para `clientes` — renomear o centro tem de refletir em todo mundo que aponta para ele.

⚠️ `centrodecusto.fkUserCriacao` é `NOT NULL`. O "Geral" nasce de migração, sem usuário logado, então herda o autor de um centro que a própria empresa já tem. Inventar um uuid deixaria a auditoria apontando para ninguém.

Aparece **sob o nome do cliente** no card do quadro e na listagem de clientes. Na listagem divide uma linha com a razão social (separador `·`) em vez de empilhar: uma terceira linha quebraria a altura `--h-row` da tabela.

## Descrição do serviço no ticket

51 dos 298 itens migrados têm `ordensservicoxservicos.descricao` vazia — apareciam como "—" no drawer. Todos os 51 têm serviço vinculado com descrição no cadastro, então `listarItens` faz **fallback na leitura**: descrição própria vazia → usa a de `servicos`.

O dado **não** foi copiado para dentro do item de propósito. A descrição própria existe para personalizar a linha ("Instalação — 3º andar"); vazia, ela significa "usa o nome do cadastro". Copiar congelaria o nome de hoje num item que deveria acompanhar o cadastro.

## Numeração por tenant

`ordensservico.idtenant` é o número do ticket **dentro da empresa** — o que aparece na tela, no PDF e nas buscas. `id` continua chave interna: rota, vínculo, drawer.

Num SaaS o `id` global não serve como número de documento: o ticket 168 da empresa 1 e o 168 da empresa 3 seriam o mesmo número em documentos diferentes, e a segunda empresa a entrar começaria os tickets no 4712.

Usa `zsequencias (tabela, fkEmpresa, ultimo)`, a mesma mecânica que `faturas` e `contaspagar` já usavam — não inventei contador novo.

**`proximo_numero_do_tenant(tabela, empresa)`** incrementa dentro do `UPDATE` de um upsert, então dois inserts simultâneos pegam números diferentes: o segundo espera o lock da linha do contador. `max(idtenant) + 1` daria o mesmo número para os dois. Verificado com inserts encadeados em duas empresas — 138/139/140 na 1 e 8/9 na 3, sem colisão.

Índice único `(fkEmpresa, idtenant)` fecha a porta caso alguém insira o número à mão.

Backfill numerou o que já existia por empresa, na ordem de `id`. Ticket sem número cai no próprio `id` na leitura — melhor um número estranho que um vazio no lugar do identificador.

## Período do ticket — derivado dos serviços

Cada serviço tem `ordensservicoxservicos.data`. Execução de mais de um dia registra o **primeiro** — critério de quem lança. Guardar início e fim por item resolveria o caso raro cobrando uma coluna a mais em todos os outros.

O **período do ticket é `min`/`max` das datas dos serviços**, mantido em `datainicio`/`datafim` pelo gatilho `sincroniza_periodo_do_ticket`.

Grava nas colunas existentes em vez de virar view porque as RPCs `get_*` da aplicação de origem leem elas. Sem nenhum serviço datado o período é **nulo** — derivado quer dizer derivado, e um período que sobrevive ao sumiço da sua origem vira número órfão.

`CamposTicket` **não aceita** `inicio`/`fim`, e o campo Período no drawer nunca é editável: dois donos do mesmo número divergem.

Verificado: 3 serviços → `2026-08-20 .. 2026-11-03`; removeu o mais antigo → encolheu; mudou a data do último → esticou; apagou todos → nulo. Backfill copiou o período do ticket para os 298 itens, então nada se perdeu.

## Drawer do ticket — ver, editar e incluir

Um componente com três modos, não três arquivos: os campos, as regras e o layout são os mesmos, e arquivos separados divergiriam no primeiro campo novo. O que muda é se o campo aceita digitação e para onde o Salvar aponta.

| Rota | O quê |
|---|---|
| `POST /api/v1/tickets` | cria (nasce `origem = EXECUCAO`, na primeira coluna do quadro) |
| `PATCH /api/v1/tickets/:id` | edita cabeçalho e substitui a lista de serviços |

**O `total` do item nunca vem do cliente.** É calculado no serviço a partir de quantidade, valor, desconto e acréscimo. Ele forma o total do ticket, que por sua vez limita quanto pode ser faturado — aceitar o número da rede seria deixar o teto de cobrança ser escolhido de fora.

**Não dá para reduzir o orçamento abaixo do já faturado.** O serviço barra com mensagem; o gatilho `guarda_saldo_por_origem` barra do outro lado com erro de banco.

**A coluna não se muda pelo PATCH** — `statusId` é descartado. Quem move o card é `moverTicket`, que sabe barrar as colunas de faturamento. Dois caminhos para a mesma escrita significaria uma regra valendo só em um deles.

⚠️ **`substituirItens` apaga e reinsere, e não é transacional.** PostgREST não expõe transação entre chamadas, então uma falha no insert deixa o ticket sem itens. A ordem escolhida é a que perde menos — inserir antes de apagar duplicaria valor faturável. Resolver de verdade pede RPC.

Apaga e reinsere em vez de diferenciar linha a linha porque o item não é referenciado por nada: `faturasorigens` aponta para o **ticket**, não para o item.

### Campos que o ticket NÃO tem

Três coisas aparecem no drawer mas não são campos do ticket — todas derivadas, todas por join:

| Campo | Vem de | Por quê não é do ticket |
|---|---|---|
| **Período** | `min`/`max` das datas dos serviços | ver seção acima |
| **Local** | endereço **principal** do cliente (`clientesenderecos`) | cliente tem um endereço só; campo livre criaria a chance de o ticket dizer um lugar e o cadastro dizer outro |
| **Centro de custo** | `clientes.fkCentroCusto` | é atributo do cliente |

`ordensservico.local` e `descricao` são colunas legadas do FlutterFlow, ambas vazias em **0 de 151** tickets. `local` deixou de ser escrita; `descricao` virou campo de anotação.

O endereço sai montado como `AV GOVERNADOR VALADARES, 1532 · JARDIM SÃO CARLOS · ALFENAS/MG · 37.137-193`, só com as partes que existem — `"Rua X, , , São Paulo"` é pior que endereço incompleto. Pega o marcado como `principal`; um cliente do cadastro tem dois endereços, então escolher por posição traria o errado nele.

⚠️ **O endereço entra só na leitura de UM ticket** (`RELACOES_DETALHE`), nunca na listagem: seriam 200 tickets trazendo endereço que nenhum card mostra.

⚠️ `RELACOES_DETALHE` é escrita **por extenso**, não derivada de `RELACOES` com `.replace()`. O supabase-js interpreta a string do `select` em tempo de tipo, e manipulação em runtime devolve `ParserError` no lugar da linha tipada.

### Descrição salva sozinha

A descrição fica editável **mesmo fora do modo de edição**, e grava no `blur`. É o campo que se anota no meio do atendimento — obrigar a entrar em edição, mexer e sair faria a anotação rápida custar três cliques, e o que não é barato de escrever não é escrito. Só ela vai nesse PATCH: mandar o resto arriscaria gravar campo que o usuário nem abriu.

### Serviços: lista de cards, preço de vitrine

Tabela não comporta desconto e acréscimo sem virar seis colunas espremidas em 720px, com a descrição cortada. Cada serviço é um card:

```
PACOTE MARKETING - INICIANTE                    1.300,00   ← riscado
Instalação — 3º andar                    −4%   1.250,00
```

⚠️ Em leitura o card **não mostra quantidade nem data** — só nome, descrição e preço. Consequência: `2 × 650,00` e `1 × 1.300,00` ficam idênticos na tela, e a data que forma o período só aparece no campo Período. Os dois valores continuam visíveis no modo de edição.

**Nome do cadastro em cima, descrição do item embaixo em cinza.** São campos separados no domínio (`servicoNome` e `descricao`) — antes o repositório fundia os dois num só, e a descrição própria sumia quando existia. Sem serviço vinculado, o texto livre assume o topo.

O nome vem por embed, **nunca copiado** para dentro do item: renomear um serviço tem de refletir nos tickets que o usam.

**Percentual à esquerda do valor**, `−4%` / `+4%`. Lido antes dele, funciona como sinal do que vem, não como carimbo de promoção pendurado no fim. Verde no desconto, âmbar no acréscimo: os dois mudam o preço, só um é boa notícia para quem paga. Sem ajuste, aparece só o número — riscar um preço igual ao outro anunciaria desconto que não existe.

Ao trocar o serviço, a `descricao` **não** é sobrescrita: ela é complemento livre, e apagá-la na troca perderia o que o usuário escreveu.

Em edição o card vira grade de 3 colunas (Data, Quantidade, Unitário / Desconto, Acréscimo, Total). **Total é calculado, nunca digitado**: quem manda são os quatro campos ao lado.

**Sem totalizador na lista** — a soma e a contagem são a aba Financeiro. Repetir aqui daria dois lugares dizendo a mesma coisa.

### Abas

Topo: **Serviços | Financeiro**. Dentro de Financeiro: **Resumo | Histórico**.

*Financeiro* substituiu a barra `ProgressoValor` do topo. A barra ocupava a primeira dobra com uma pergunta que quase nunca é a primeira — quem abre um ticket quer ver o que foi executado.

**Resumo** é a composição do valor: Serviços → Desconto → Acréscimo → Despesas adicionais → **Total do ticket** → Faturado → Saldo a faturar.

Desconto e acréscimo são **soma dos itens**, não campos do ticket. Eles já vivem na linha do serviço, e um segundo par no cabeçalho criaria dois lugares para dar o mesmo desconto — com resultados diferentes dependendo de onde foi digitado.

*Despesas adicionais* é **placeholder assumido** (custo de terceiro, deslocamento, material). Fica visível em zero para o lugar dele no cálculo estar definido antes de existir: acrescentar linha no meio de um total já em uso é o tipo de mudança que faz relatório antigo deixar de fechar.

**Histórico** é o antigo *Contas a receber*, agora com recebimento: **Título · Situação · Deste ticket · Pago · A receber** (+ próximo vencimento). Clicar abre a conta a receber.

⚠️ *Deste ticket* é o que saiu daqui; *Pago* e *A receber* são da **conta inteira**. Ratear a baixa entre origens exigiria decidir qual ticket foi pago primeiro numa conta composta — invenção, não dado.

**Atrasado e a vencer não são duas colunas.** Os dois são dinheiro que ainda não entrou e somam em *A receber*; quem diz se passou do prazo é a **Situação**, que vira `ATRASADA` (vermelha) quando há parcela vencida. O valor só ganha vermelho quando parte dele já venceu — o número é o mesmo, o que muda é a urgência.

Parcela **sem vencimento conta como a vencer**: sem data não dá para afirmar atraso, e acusar atraso indevido é pior que deixar de acusar.

### Ícone antes do número

Ticket e conta a receber convivem nos mesmos drawers, e o `#` sozinho não separa os dois. Onde aparece número de **conta** vai o ícone `faturas`; onde aparece número de **ticket** vai o ícone `ticket` — os mesmos do menu, via `<Icon>`.

Aplicado no *Histórico* do ticket e na aba *Tickets* da conta a receber, que é onde a confusão acontecia.

### Largura do drawer

`Drawer` tem `LARGURA_PADRAO = 620`, e conta a receber, conta a pagar e ticket **não passam mais `width`**. O número solto em três arquivos foi exatamente o que deixou o ticket abrir mais largo que as contas. Formulário usa 540, em `FormDrawer`. `--drawer-w` no CSS acompanha (620).

⚠️ **Import circular.** `fatura-drawer` já importava `ticket-drawer` (abrir ticket a partir de uma conta). Agora o caminho inverso existe, então a conta entra por `next/dynamic` — ciclo entre componentes React quebra em runtime, não no build.

**`PanelTabs`** ganhou fio de 1px de ponta a ponta na linha do marcador, e `margin-bottom` de 18. O marcador de 2px passa por cima com `marginBottom: -1`.

**Célula da tabela com `padding`, não `height` fixo.** Com `height: 34` o texto que quebrava em duas linhas encostava nas bordas: altura fixa não cresce, só espreme.

O drawer aberto **empilhado** sobre a conta a receber recebe `somenteLeitura` — ali ele é uma espiada, e as listas de cliente e serviço nem foram carregadas.

## Travas de edição

O ticket congela em dois degraus. A regra vive em `atualizarTicket`, não só na tela — a API também é caminho de escrita.

| Estado | O que trava | Por quê |
|---|---|---|
| `faturado > 0` | **cliente** | a conta a receber já foi emitida em nome de alguém; trocar aqui deixaria a cobrança apontando para uma pessoa e o ticket para outra |
| status `ENCERRADA` | **tudo** | faturado por inteiro e recebido por inteiro — depois disso qualquer alteração só gera divergência com o que já foi pago |

Na tela isso aparece **antes** do erro: encerrado não oferece o botão Editar, e com faturamento o campo Cliente já vem bloqueado. Barrar só no Salvar faria o usuário preencher para descobrir depois que não podia.

Encerrado trava também a **descrição**, que fora desses casos salva sozinha no `blur` — sem isso um clique acidental no campo já viraria erro de API.

⚠️ Não existe trava geral de "já faturado" nos serviços. A primeira versão tinha, e ela pegava **todos os 151 migrados** — inclusive os em *Orçamento* —, porque a migração criou vínculo em `faturasorigens` para toda fatura, até as que nunca foram cobrança. A regra que é sempre verdadeira é outra: o total não pode cair abaixo do que já virou cobrança, e disso cuidam `atualizarTicket` (com mensagem) e `guarda_saldo_por_origem` (com erro de banco).

## Despesas por serviço

`ordensservicoxservicosdespesas (fkItem, descricao, valor)`, com `on delete cascade` no item e RLS herdando o tenant por `item → ordem`.

Tabela filha e não um campo `despesas` no item porque cada gasto tem **nome e valor próprios**. Um número único responderia "quanto", nunca "de que" — e é o "de que" que sustenta a conversa com o cliente sobre o valor cobrado. Diferente de `acrescimo`, que é ajuste de preço sem justificativa itemizada.

Entram no total do serviço: `bruto − desconto + acréscimo + despesas`.

⚠️ Esse cálculo existe **duas vezes** — em `tickets.service.ts` (que grava) e no drawer (que exibe durante a edição). O RSC obriga: a do serviço não pode ir para o cliente sem arrastar o Supabase junto. Elas já divergiram uma vez, quando as despesas entraram só na do servidor e a tela mostrava o total sem elas até salvar. Candidato a mover para `tickets.types.ts`, que já é o lugar das funções puras compartilhadas.

## Unidade da quantidade

`ordensservicoxservicos.unidade` — `UN` ou `H`, com `CHECK`.

O botão `un`/`h:mm` do drawer converte `2:30` para `2.5` na hora de gravar, mas a **unidade é guardada**, não inferida. No documento, `2,5` sem unidade pode ser duas horas e meia ou dois pacotes e meio, e quem recebe a fatura não tem como saber. Inferir pela fração seria pior: 1 hora cheia é inteiro.

## PDF do ticket

Dois arquivos, um botão:

| Arquivo | Situação |
|---|---|
| `pdf-recibo.ts` | **em uso** — botão da impressora |
| `pdf.ts` | sem botão. Réplica do `generateFaturaPDF` do FlutterFlow, mantida como referência do layout antigo e dona de `carregarLogo`, usada pelos dois |

O layout em uso: faixa verde de 8px colada no topo, `TICKET` + logo, bloco `Número / Situação / Apuração`, `DE`/`PARA` em duas colunas de texto, tabela de serviços, fechamento, cobrança, observações, rodapé.

**Colunas de acréscimo, desconto e despesas só aparecem quando existem** em algum item — largura em A4 é curta, e coluna zerada é espaço gasto sem informação. Como podem virar sete colunas de número, a largura delas encolhe até sobrar espaço de leitura para o serviço.

**Fechamento na mesma grade da tabela** (`COL_NUM`): rótulo na coluna "Unitário", valor na coluna "Total". É isso que faz o bloco ler como fechamento dela e não como quadro solto. Ordem: Subtotal → Acréscimo → Desconto → Despesas → **Total**, os do meio só quando há.

O total é uma linha igual às outras, só em negrito. Em 15pt e verde ele puxava o olho antes de todo o resto — total é conclusão, não manchete.

### ⚠️ A descrição em cinza não deu certo — duas vezes

A descrição do serviço desce por quebra de linha **dentro da célula**, na mesma cor do nome. Duas tentativas de deixá-la cinza falharam pela mesma raiz — as duas posicionavam texto por fora do autotable, e nenhuma das duas conhece a largura final da coluna:

1. **Desenhar à mão em `didDrawCell`** — exigia reservar a altura da linha por conta própria; o texto atravessava as colunas de valor.
2. **Linha própria com `colSpan`** — ocupava a tabela inteira por definição, então passava por baixo das colunas de valor sempre.

Quem quebra o texto tem de ser o autotable. Para ter a cor, o caminho é desenhar a tabela inteira à mão, controlando largura, quebra e cor no mesmo lugar.

## O que cada drawer mostra

**Conta a receber** → abas *Tickets* e *Parcelas*. No lugar da lista de serviços vem a de tickets: o serviço vive no ticket, e a conta é composta por **valor** de um ou mais deles. Clicar num ticket abre o drawer dele por cima — o detalhe do serviço está lá.

**Ticket** → abas *Serviços* e *Contas a receber*. A segunda traz duas colunas de valor: *Deste ticket* e *Total da conta*. São necessárias as duas, porque o ticket pode ter contribuído R$ 5.000 numa conta de R$ 5.230.

A barra de progresso do ticket mede **faturamento**, não recebimento — o dinheiro só entra quando a conta for baixada.

## ⚠️ O DRE não acompanha este modelo

`dre_por_ano` monta tudo a partir de:

```
pagamentos            → centrodecusto via p."fkCentroCusto"
cartaofaturasparcelas → centrodecusto via cp."fkCentroCusto"
```

Classifica receita/despesa por `pagamentos.natureza` e exclui transferência entre contas. **Não usa `faturasxservicos`, nem `faturascentrocusto`, nem o serviço.**

Ou seja: é um **DRE de caixa**, e o centro de custo vem do *pagamento*. A migração dos serviços para tickets **não mudou o DRE**.

O ponto onde o serviço passa a interferir é a **baixa**: quando a parcela é recebida e nasce um `pagamento`, é ali que `fkCentroCusto` é gravado. O natural é derivar do ticket. Fica em aberto:

- Um ticket pode ter serviços de centros diferentes — a baixa precisa ratear ou escolher um?
- Migrar o DRE de caixa para competência (ler da fatura/ticket) muda o número do relatório e é decisão de negócio.

## Contrato

`contratos` está vazia e tem `fkFatura`. Em aberto: contrato gera ticket ou fatura direto?

Recomendação registrada: **não obrigar contrato a gerar ticket**. Contrato cobra por um compromisso; ticket registra execução. Obrigar cria "ticket fantasma" mensal que polui o backlog e estraga indicadores. O caso híbrido legítimo — contrato que cobre execuções — é o ticket apontar para o contrato, com a cobrança vindo do contrato.

## RLS

`ordensservico` e as nove filhas vieram com RLS habilitada e **nenhuma policy**, o que em Postgres significa "ninguém lê nada" — a tela abria vazia mesmo com os 151 registros. Corrigido em `rls_tickets`: `ordensservico` e `ordensservicostatus` por `fkEmpresa`; as filhas herdam o tenant por `fkOrdem`.

**Lição:** tabela vinda de outro sistema pode chegar com RLS ligada e sem policy. Antes de dar tela por pronta, consultar como usuário comum (`set local role authenticated`), não como service role.

`ordensservicostatus` usa policy `ALL` por `fkEmpresa` — o usuário cria e apaga as próprias colunas, e a proteção das fixas é o trigger `trg_ossstatus_protege`, não a RLS.

⚠️ **Função de gatilho não é endpoint.** O PostgREST publica toda função do schema `public`. `move_status_do_ticket()` e `protege_status_do_sistema()` tiveram o `EXECUTE` revogado de `anon`/`authenticated`/`public` — são `SECURITY DEFINER`, e deixá-las chamáveis por RPC abriria um caminho para executá-las fora do contexto do trigger. Todo gatilho novo precisa do mesmo revoke.
