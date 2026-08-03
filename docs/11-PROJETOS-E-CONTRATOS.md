# 11 — Projetos, tarefas e contratos

Camada de **execução**, separada da de dinheiro. Criada em 02/08/2026.

```
Contrato ──── Projeto ──┬── Tarefas   (execução, quadro próprio)
                        └── Ticket(s) (dinheiro)
```

O quadro de tickets já mistura dois relógios: *Orçamento → Na fila → Concluído* é execução, *Faturado → Encerrada* é cobrança. Tarefa de projeto não cabe lá sem fazer a mesma coluna significar duas coisas — e aí o quadro deixa de responder tanto "o que falta fazer" quanto "o que falta receber".

## Modalidade — o que liga tarefa a dinheiro

| Modalidade | Dinheiro | Tarefas |
|---|---|---|
| **FECHADO** | um ticket com o valor combinado (`projetos.fkOrdem`) | medem progresso, sem valor |
| **POR_DEMANDA** | cada tarefa concluída vira serviço num ticket (`projetosdemandas.fkOrdem`) | carregam valor |

Ratear preço por tarefa no escopo fechado seria inventar número. A modalidade **congela** depois do primeiro ticket: trocar faria o projeto cobrar duas vezes, ou deixaria tickets órfãos.

## Dois quadros, propósitos diferentes

| Quadro | Colunas | Onde |
|---|---|---|
| **Situação do projeto** | FILA · ANDAMENTO · PAUSADO · CONCLUIDO · ENCERRADO — conjunto **fixo** | listagem `/projetos` |
| **Tarefas do projeto** | Na fila · Em execução · Pausada · Revisão · Concluída — **por projeto**, o usuário edita | subpágina `/projetos/[id]` |

O primeiro é ciclo de vida e não cresce, então as colunas **dividem a largura**. O segundo o usuário customiza, então tem **largura fixa e rola para o lado** (`Quadro larguraFixa`) — dividindo, cada coluna nova estreitaria todas as outras.

`projetosstatus.conclui` marca a coluna que significa "feito". É ela que vai liberar virar serviço no ticket em POR_DEMANDA.

## Concluir é marca da TAREFA, não da coluna

`projetosdemandas.concluida_em` é a única resposta para "isto foi entregue?".

⚠️ Antes era consequência da coluna: o gatilho escrevia `concluida_em` ao entrar numa coluna com `conclui = true` e — o problema — **apagava em qualquer outra**. As colunas são do usuário: ele cria "Revisão", "Aguardando cliente", o que quiser. Tarefa entregue que voltasse para revisão deixava de estar concluída, sumia de *Faturar tarefas*, e a entrega parecia não ter acontecido.

Hoje:

| Gesto | Efeito |
|---|---|
| entrar numa coluna que conclui | marca, por conveniência |
| sair dela | **não** desmarca |
| clicar na marca do cartão | marca / desmarca |

`projetosstatus.conclui` continua existindo — só deixou de ser a autoridade. Ele é o atalho, não a definição.

A guarda do faturamento passou a olhar `concluida_em`, não a coluna. Sem isso, tarefa concluída à mão numa coluna qualquer era recusada com *"a tarefa precisa estar concluída"* — justamente a que a tela mostrava concluída. Verificado por SQL: marca sobrevive ao arrastar, e o lote fatura fora da coluna de conclusão.

⚠️ **Desmarcar tarefa já cobrada é recusado** — o ticket referenciaria uma entrega que o projeto passou a dizer que não aconteceu. Remove-se a cobrança primeiro.

No cartão a marca é um círculo à esquerda do título, alinhado ao topo (com título de duas linhas, centrado ela descia para o meio). Some quando a tarefa não está concluída e o mouse não está no cartão: um círculo vazio em cada linha seria uma coluna de vazios.

## Contratos — recorrência por competência

`contratos.fkFatura` **foi removida**: cabia uma fatura só, que é exatamente o que recorrência não é. O vínculo vive em `faturasorigens` (aceita `origem = 'CONTRATO'`).

Cada período gerado vira uma linha em `contratoscompetencias`, com `UNIQUE (contrato, competência)` — é ela que impede gerar o mesmo mês duas vezes.

**`gerar_competencia_do_contrato(contrato, usuario)`** é o botão. Cria o ticket e registra a competência **na mesma transação**: se o ticket entrasse sem o registro, o próximo clique geraria outro.

⚠️ Três guardas, todas verificadas:
- contrato inativo → recusa;
- competência já gerada → recusa (a `UNIQUE` fecharia, mas a mensagem daqui diz o quê);
- **competência acima do mês corrente → recusa**. Sem isso, dois cliques geravam o mês que vem e três o subsequente — contrato ativo sempre tem um próximo período válido, então o botão nunca recusava. Atrasado continua podendo.

Nunca por agendador: geração automática cria cobrança sem ninguém olhar, e contrato reajustado ou suspenso vira fatura indevida antes de alguém perceber.

## A ponte projeto → ticket

| Modalidade | Como o ticket nasce | Entra em |
|---|---|---|
| **FECHADO** | *Valor do escopo* no drawer de configuração → um ticket com um serviço no nome do projeto | **Na fila** — nasce quando o escopo é combinado, antes da entrega |
| **POR_DEMANDA** | *Faturar tarefas* → **um** ticket com uma linha por tarefa concluída | **Concluído** — entrega feita, esperando faturamento |

Duas RPCs (`gerar_ticket_do_projeto`, `gerar_ticket_das_demandas`) criam ticket, itens e vínculo na **mesma transação**. Com o ticket entrando sem o vínculo, o próximo clique geraria outro e o projeto cobraria duas vezes.

⚠️ **O ticket nascia sem `fkStatus`.** A coluna não tem default e nenhuma das RPCs a preenchia: o ticket existia, consumia número do tenant e **não aparecia em nenhuma coluna do quadro**. Não apareceu no teste porque o valor gerado foi conferido por SQL, não na tela.

### O lote

**Uma tarefa não vira uma cobrança.** Doze entregas no mês para o mesmo cliente virariam doze faturas. O lote é como se fatura de verdade: o período inteiro numa nota, discriminado item a item. O `datainicio`/`datafim` do ticket saem do menor e maior prazo das tarefas.

`projetosdemandas.fkOrdem` já suportava N tarefas → 1 ticket; o que faltava era a tela e a RPC.

O botão *Gerar ticket* dentro da tarefa chama **a mesma rota** com um id só — uma tarefa também é lote. Rota separada faria a regra de "mesmo projeto" existir em dois lugares.

⚠️ **Id inexistente no lote era ignorado em silêncio.** A checagem "todas do mesmo projeto" contava projetos *distintos entre as encontradas*: `[5, 999]` achava só a 5, contava um projeto, e o ticket saía com uma linha em vez de duas — cobrando menos do que a seleção somava, sem erro nenhum. Hoje o `cardinality` fecha. Apareceu no teste da guarda de projetos diferentes, que gerou um ticket em vez de recusar.

### O aditivo

`projetos.fkOrdem` **foi removida**: cabia um ticket só, e aditivo aprovado no meio da execução não tinha onde entrar — a saída era abrir outro projeto, partindo a entrega em dois lugares. O vínculo virou `projetosordens`, com `UNIQUE (fkOrdem)` porque um ticket pertence a um projeto só.

O segundo ticket em diante ganha **título próprio**: dois chamados "Portal de vendas" na mesma lista não se distinguem.

### Guardas, todas verificadas por SQL

modalidade errada · projeto cancelado · valor zero · tarefa não concluída · tarefa já cobrada · tarefa inexistente · lote vazio · lote de projetos diferentes

As mensagens dizem **qual** tarefa recusou. Com dez selecionadas, "alguma tarefa não está concluída" não ajuda ninguém — por isso a RPC confere uma a uma em vez de um `where` que filtra tudo de uma vez.

O serviço repete as mesmas checagens antes de chamar a RPC. **Elas existem para a mensagem, não para a garantia:** quem garante é a RPC, dentro da transação. Confiar só no serviço deixaria a porta aberta para quem chama a API direto.

### Ticket cancelado devolve a origem

Gatilho `trg_ticket_cancelado_libera_origem`: cancelar zera `projetosdemandas.fkOrdem` e apaga a linha de `projetosordens`. Sem ele o vínculo continuava apontando para um ticket cancelado e a origem **nunca mais** gerava cobrança — o mesmo defeito que a fatura cancelada tinha, a mesma correção.

O ticket continua existindo, cancelado, na tela de tickets: é lá que cobrança cancelada se consulta. O que se solta é só o vínculo.

## O ponto de amarração é o projeto

```
Contrato ──(justifica / origina)──► Ticket ──(controla)──► dinheiro
    │                                  ▲
    │                                  │ cobra
    └────────────► Projeto ────────────┘
                      │
                      └──(contém)──► Tarefas ──► execução
```

**Não é o ticket:** um projeto fechado pode ter vários (escopo + aditivos), e no FECHADO tarefa nenhuma encosta em ticket. **Não é o contrato:** ele pode não existir e pode cobrir vários projetos. O projeto é a única coisa que segura os dois lados.

O contrato é agregador **de origem, não de conteúdo**: gera ticket recorrente por competência e justifica o valor combinado. Nunca guarda tarefa, nunca guarda dinheiro.

### Contrato: justifica, mas não trava

Cobrar o escopo fechado **sem contrato passa**, de propósito. Projeto fechado no boca a boca existe, e travar impedia registrar o que já aconteceu. A tela avisa — *"a cobrança fica sem documento por trás"* — e a regra não impede.

⚠️ Foi bloqueio antes, nas três camadas. A trava saiu da RPC, do serviço e do botão.

`projetos.fkContrato` **foi removida** — mesmo defeito que `fkOrdem` tinha. Projeto grande é coberto por mais de um contrato: o retainer mensal e o do escopo extra, ou o contrato antigo e o aditivo assinado à parte. O vínculo virou `projetoscontratos`.

⚠️ Diferente do ticket, **o contrato pode servir a vários projetos** — um retainer cobre o ano inteiro. Por isso a `UNIQUE` é `(projeto, contrato)`, e não `(contrato)`.

Desvincular contrato **não** é recusado quando já há ticket: o contrato justifica a cobrança no momento em que ela nasce, e o ticket já gerado guarda o próprio valor. Travar impediria corrigir um vínculo errado sem antes desfazer a cobrança certa.

O ticket gerado herda o **cliente do projeto**. Projeto sem cliente gera ticket sem cliente — legítimo em orçamento interno, mas não fatura até alguém preencher.

### A tarefa amarra na LINHA, não no ticket

`ordensservicoxservicos."fkDemanda"` guarda a tarefa que originou cada linha de serviço.

Antes o vínculo era só tarefa → ticket. A RPC criava uma linha por tarefa, em ordem, e nada registrava a correspondência: o ticket não sabia dizer de que tarefa veio cada serviço, apagar uma linha deixava a tarefa marcada como cobrada para sempre, e editar o valor de uma linha fazia a tarefa dizer um número e a cobrança outro.

Gatilho `trg_servico_removido_libera_tarefa`: **apagar a linha devolve a tarefa** para *Faturar tarefas*. Sem ele, corrigir um ticket removendo um item deixava a tarefa presa — cobrada, fora da lista, e sem cobrança correspondente. Verificado: apagar a linha da tarefa A libera A e deixa B cobrada.

O drawer do ticket marca essas linhas com **TAREFA**, e o título vem no hover.

**A seleção continua no projeto, nunca no ticket.** É lá que se sabe o que foi entregue. Levar a escolha para dentro do ticket exigiria um navegador de tarefas naquela tela, e a mesma decisão passaria a morar em dois lugares.

### As duas listas, em abas

Ticket e contrato viram **abas** no drawer do projeto, com tabela e coluna de ações. São listas que crescem; empilhadas no meio dos campos, empurravam Descrição e Situação para fora da tela.

| Botão | Aparência | O que faz |
|---|---|---|
| **+ Novo** | verde cheio | cria — ticket do escopo, ou contrato |
| **+ Vincular** | verde vazado | aponta para algo que já existe |

O vazado não compete com o cheio: um cria, o outro só reconhece.

*+ Novo contrato* abre o cadastro de contrato **já com o cliente preenchido**, e o vincula sozinho ao voltar — quem criou dali já disse a que projeto ele pertence, e pedir para vincular em seguida seria perguntar de novo o que acabou de ser respondido.

*+ Vincular* abre um drawer sobre o outro, com **busca, tabela padrão e paginação**. Busca e paginação no cliente: a lista já vem inteira e limitada a 200 pelo repositório, e uma ida ao servidor a cada letra custaria mais que filtrar o que já está na memória.

Na tabela a célula leva **só o número** — a coluna já se chama Ticket, e repetir a palavra em cada linha é a mesma informação duas vezes. O título, quando existe (o nome do aditivo), fica no hover.

### Excluir o projeto

Apagar leva colunas, tarefas, checklist, comentários e anexos por `on delete cascade`.

⚠️ **Projeto com ticket não some.** O ticket ficaria vivo e cobrável, apontando para uma origem que deixou de existir: ninguém mais saberia dizer de onde aquele valor veio. Nem serve deixar o cascade levar `projetosordens` — a cobrança continuaria lá, órfã.

Antes é preciso **desvincular cada ticket**, um a um, pelo ✕ na lista de cobranças. Desvincular:

- tira a linha de `projetosordens` — o ticket **continua existindo**, é só o vínculo que sai;
- zera `projetosdemandas.fkOrdem` das tarefas daquele ticket, que voltam a poder ser cobradas.

Sem o segundo passo as tarefas ficariam apontando para um ticket que o projeto não conhece mais: não apareceriam em *Faturar tarefas* nem teriam como ser desfeitas.

É gesto próprio, e não uma cascata silenciosa, para que apagar por engano exija ter olhado cada cobrança antes. Também é o único jeito de desfazer uma cobrança gerada por engano **sem cancelar o ticket**.

### O valor

**O do escopo é perguntado na hora de gerar**, nunca guardado em `projetos`. Guardá-lo criaria um segundo lugar dizendo quanto o projeto vale, e ele divergiria do ticket no primeiro ajuste de serviço — que é onde o valor realmente mora depois de gerado. Pela mesma razão, `ProjetoResumo.valor` é a **soma dos tickets**, lida da view que já soma os itens.

`projetosdemandas.valor` existe porque em POR_DEMANDA a tarefa **é** a origem do valor. No FECHADO o campo nem aparece na tela: sugeriria o rateio que a modalidade existe para evitar.

⚠️ **Valor de tarefa já cobrada não muda mais** (`BusinessRuleError` no serviço, campo bloqueado na tela). O ticket copiou o número na geração; mexer na tarefa depois não o corrige, só faz a tarefa dizer um valor e a cobrança outro, sem nada na tela denunciando a diferença.

## Filhas da OS: o que foi removido

`ordensservico` tinha oito tabelas filhas herdadas do FlutterFlow, **todas com zero linhas**. Seis foram removidas:

`ordensservicoanexos` · `ordensservicohoras` · `ordensservicopercurso` · `ordensservicovalores` · `ordensservicoxcolaboradores` · `ordensservicoxveiculos`

E antes delas, `ordensservicochecklist` e `ordensservicocomentarios`.

**Por quê:** veículo, hodômetro, percurso, equipe e valor/hora com ISS descrevem **visita técnica de campo** — o produto do sistema de origem. O VPay virou outra coisa: ticket que nasce de orçamento, projeto e contrato.

Tabela vazia com nome plausível é pior que tabela inexistente: quem chega depois assume que há um fluxo por trás e escreve código para alimentá-la.

⚠️ Se o módulo de serviço de campo entrar um dia, elas voltam por migração — e aí **com RLS**, que nenhuma delas tinha.

**O que ficou:** `ordensservico`, `ordensservicostatus`, `ordensservicoxservicos`, `ordensservicoxservicosdespesas`.

`ordensservicoanexos` serviu de modelo para `projetosdemandasanexos` antes de sair — mesmas colunas (`url`, `tipo`), penduradas na **tarefa**. A granularidade é o motivo: um ticket pode nascer de várias tarefas, e apontar o anexo para o ticket perderia a qual tarefa ele pertence.

Anexo é **por link, não upload** — o sistema não tem fluxo de arquivo próprio, e link cobre o caso real (briefing no Drive, arte no Figma). Quando houver Storage, o upload entra sem mudar modelo.

## Próximos passos

1. **Tela de contas a receber** — o outro lado da ponte, e o que fecha o ciclo do dinheiro. Ela lista os tickets **concluídos** para faturar; os *na fila* aparecem e viram concluído ao serem selecionados. É para lá que vão os tickets gerados aqui.
2. **Upload de arquivo** — Storage no lugar do link colado.
3. **Rotacionar a service role key e o token Meta/WhatsApp** (painel do Supabase; só o dono faz).
4. Ver `docs/09-PENDENCIAS.md` para o resto.

## Armadilhas registradas

**PGRST201 — embed ambíguo.** `projetosdemandas` tem **três** FKs para `usuarios` (`fkResponsavel`, `fkUserCriacao`, `fkUserModificacao`). O embed precisa ser qualificado:

```ts
responsavel:usuarios!projetosdemandas_fkResponsavel_fkey(nome, email)
```

Vale para **toda tabela com `fkUserCriacao` + `fkUserModificacao`** — o risco é latente em quase todas.

**A string do `select` é literal, nunca concatenada.** O supabase-js a interpreta em tempo de tipo; `'a' + 'b'` devolve `GenericStringError` no lugar da linha tipada. Já mordeu duas vezes (`RELACOES_DETALHE` em tickets, o embed de responsável aqui).

**`try/catch` em volta de JSX** é erro de lint com razão: o `catch` engoliria erro de render, e um `notFound()` disparado lá dentro viraria 404 por causa de um bug de componente. O `try` fica em volta da **busca**.
