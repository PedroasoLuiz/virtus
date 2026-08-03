# 03 — Modelo de dados (Supabase)

Extraído dos wrappers em `lib/backend/supabase/database/tables/`. Nomes de coluna em **camelCase** (padrão FlutterFlow) — mantidos, porque as RPCs e o banco existente dependem deles.

Convenção presente em quase toda tabela: `id` (int8, PK), `createdAt`, `updatedAt`, `fkUserCriacao` (uuid → auth.users), `fkUserModificacao`, `fkEmpresa` (tenant).

## Núcleo / tenant

**`empresas`** — `razaosocial`, `fantasia`, `nome`, `cnpj`, `ie`, `inscricaomunicipal`, `logo`, `contato`, `email`, endereço completo (`logradouro`, `numero`, `complemento`, `bairro`, `cep`, `cidade`, `estado`, `codigoibge`), `urlcertificadodigital`, `ativo`

**`usuarios`** — PK `fkUser` (uuid, sem `id` próprio), `nome`, `email`, `ativo`, `externo`
**`usuariosxempresas`** — `fkUser` × `fkEmpresa` (define o acesso multi-tenant)
**`usuariosxgrupo`** — `fkUser` × `fkGrupo`

**`zsequencias`** — `tabela`, `ultimo`, `fkEmpresa`. Numeração sequencial por empresa feita na aplicação. **Candidato a virar sequence/RPC atômica** — hoje é race condition.

## Cadastros

**`clientes`** — `razao`, `nomefantasia`, `cnpj`, `contato`, `responsavel`, `email`, `urlicon`, `fkGrupo`, flags `ativo` / `cliente` / `fornecedor` / `colaborador` (mesma tabela serve os três papéis)
**`clientesenderecos`** — `fkCliente`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `cep`, `principal`
**`clientegrupo`** — `descricao`, `resposnsavel` *(typo no schema)*, `contato`, `email`, `ativo`
**`servicos`** — `descricao`, `valor`, `cnae`, `fkCentroCusto`, `fkModeloContrato`, `ativo`, `deletado`
**`centrodecusto`** — `descricao`, `tipo` (receita/despesa), `ativo`

## Contas a receber (faturas)

**`faturas`** — `fkCliente`, `dataInicio`, `dataFim`, `status`, `cancelada`, `total`, `observacoes`, `rodape`, `parcelas`, `idtenant`
**`faturasxservicos`** — `fkFatura`, `fkServico`, `descricao`, `valor`, `quantidade`, `acrescimo`, `desconto`, `total`, `incluir`, `observacoes`, `anexo`
**`faturasparcelas`** — `fkFatura`, `numeroparcela`, `vencimento`, `valor`, `pago`, `fkPagamento`, `observacoes`
**`faturascentrocusto`** — rateio: `fkFatura` × `fkCentroCusto` × `valor`
**`faturasstatus`** — `descricao`, `nivel`, `padrao`, `ativo`
**`faturahistoricoemails`** — `fkFatura`, `parcela`, `email`, `fkUsuarioEnvio`, `createdAt`

## Contas a pagar

**`contaspagar`** — `fkFornecedor` (→ clientes), `descricao`, `total`, `fkCentroCusto`, `pago`, `cancelada`, `fkStatus`, `data`, `observacoes`, `idtenant`
**`contaspagarparcelas`** — `fkContaPagar`, `numeroparcela`, `vencimento`, `valor`, `acrescimo`, `desconto`, `total`, `pago`, `fkPagamento`, `nfs`, `boleto`, `observacoes`
**`contaspagarcentrocusto`** — rateio
**`contaspagarstatus`** — `descricao`, `nivel`, `padrao`, `ativo`

> Assimetria a resolver: `contaspagarparcelas` tem `acrescimo`/`desconto`/`total`/`nfs`/`boleto`; `faturasparcelas` **não tem** (a view `vw_faturasparcelas` expõe esses campos, então existem em algum lugar derivado). Uniformizar.

## Tesouraria

**`contasbancarias`** — `apelido`, `banco`, `agencia`, `conta`, `tipo`, `logo`, `limite`, `saldoinicial`, `ativo`
**`pagamentos`** — tabela central de movimento: `fkContaBancaria`, `data`, `tipo`, `natureza`, `descricao`, `nome`, `valor`, `comprovante`, `origem`, `observacoes`, `fkCentroCusto`, `titulo`, `conciliado`
**`extratobancario`** — `fkContaBancaria`, `data`, `descricao`, `nome`, `valor`, `tipo` (debito/credito), `hash` (dedup de importação), `conciliado`, `fkPagamento`

## Cartão de crédito

**`cartao`** — `apelido`, `bandeira`, `numero`, `expiracao`, `ccv`, `limite`, `diaFechamento`, `diaVencimento`, `fkContaBancaria`, `ativo`
> ⚠️ `numero`, `expiracao` e `ccv` em claro no banco. Guardar CVV é vedado pelo PCI-DSS e não tem uso funcional aqui. **Remover `ccv` e mascarar `numero` para os 4 últimos dígitos na migração.**

**`cartaofaturas`** — `fkCartao`, `competencia`, `dataFechamento`, `dataVencimento`, `valor`, `acrescimo`, `desconto`, `total`, `status`, `fkContaPagar`
**`cartaofaturasparcelas`** — `fkCartaoFatura`, `fkCartao`, `fkFornecedor`, `descricao`, `dataCompra`, `competencia`, `numeroparcela`, `valor`, `categoria`, `fkCentroCusto`, `status`

## Contratos

**`contratos`** — `fkCliente`, `fkFatura`, `fkModelo`, `numero`, `descricao`, `inicio`, `fim`, `valor`, `ativo`, `deletado`
**`contratosservicos`** — `fkContrato`, `fkServico`, `descricao`, `valor`, `quantidade`, `total`
**`contratosclausulas`** — `fkContrato`, `ordem`, `titulo`, `texto`
**`contratosmodelos`** — `titulo`, `descricao`, `ativo`
**`contratosmodelosclausulas`** — `fkModelo`, `ordem`, `titulo`, `texto`, `ativo`

> Módulo **presente no schema mas sem tela** no app FlutterFlow. Decidir em 05 se entra no escopo da v1 do Next.

## Views

| View | Conteúdo |
|---|---|
| `vw_faturasparcelas` | parcela + fatura + pagamento + centro de custo (`idFatura`, `idParcela`, `parcela`, `vencimento`, `boleto`, `nfs`, `dataPagamento`, `conciliado`, `valor`, `acrescimo`, `desconto`, `total`, `paga`) |
| `vw_faturasparcelas_clientes` | idem + `clienteNome` |
| `vw_contasparcelas` | parcela a pagar + fornecedor (`fornecedorRazao`, `fornecedorCnpj`), `parcelaXY` ("2/5"), centro de custo, pagamento, conciliação |
| `vw_cartao` | cartão + `utilizado` (limite consumido) |
| `vwsaldo` | `contaId`, `apelido`, `banco`, `conta`, `limite`, `saldo` |

## Storage

Bucket **`virtusmind`** (`FFAppConstants.bucketNameClients`) — logos, anexos de serviço, comprovantes, PDFs.

## Ações estruturais recomendadas

| # | Ação | Motivo |
|---|---|---|
| 1 | **Habilitar RLS** em todas as tabelas, política por `fkEmpresa ∈ (select fkEmpresa from usuariosxempresas where fkUser = auth.uid())` | hoje o isolamento de tenant é só filtro no cliente — com o anon key exposto, qualquer um lê tudo |
| 2 | Remover `cartao.ccv`, mascarar `cartao.numero` | PCI-DSS |
| 3 | Dropar tabela `temp` | lixo |
| 4 | Resolver `idtenant` vs `fkEmpresa` (duas colunas de tenant em `faturas` e `contaspagar`) | ambiguidade |
| 5 | Corrigir `clientegrupo.resposnsavel` → `responsavel` | typo |
| 6 | `zsequencias` → RPC atômica com `for update` ou sequence nativa | race condition |
| 7 | Uniformizar `faturasparcelas` com `contaspagarparcelas` (`acrescimo`, `desconto`, `total`, `nfs`, `boleto`) | simetria |
| 8 | Gerar `types/database.ts` com `supabase gen types typescript` | eliminar o `<any>` herdado do SIC |
