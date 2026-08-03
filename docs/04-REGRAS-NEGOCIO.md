# 04 — Regras de negócio a preservar

Extraídas de `lib/custom_code/actions/`. Este é o conteúdo que **não pode ser perdido** na reescrita — o resto (UI FlutterFlow) é descartável.

---

## 1. Geração de parcelas (fatura e conta a pagar)

Fonte: `cadastra_fatura_parcelas.dart`, `cadastra_contas_pagar_parcelas.dart`

**Entrada:** nº de parcelas, intervalo em dias, id do título, valor total, data do 1º vencimento (`dd/MM/yyyy`).

**Algoritmo:**
1. Valida: `parcelas > 0 && intervalo > 0 && valorTotal > 0`.
2. `valorBase = valorTotal / parcelas`.
3. Para cada parcela `i` de 1..n:
   - `venc = vencimentoInicial + intervalo * (i - 1)` dias;
   - **ajuste de dia útil**: sábado → +2 dias, domingo → +1 dia; se cair em feriado, +1 dia e reaplica o ajuste de fim de semana, em laço até cair em dia útil;
   - `valor = round(valorBase, 2)`, acumulado em `soma`;
   - **na última parcela**, `valor += round(valorTotal - soma, 2)` — absorve a diferença de arredondamento. Garante que a soma das parcelas seja exatamente o total.
4. Insere em `faturasparcelas` / `contaspagarparcelas` (`vencimento` no formato `yyyy-MM-dd`).

**Feriados** — lista hardcoded de 2025, duplicada nos dois arquivos:
`01/01, 18/04, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12`.
→ No Next: **um único módulo** `lib/feriados.ts` com cálculo de móveis (Páscoa → Carnaval, Sexta-Feira Santa, Corpus Christi) em vez de lista fixa por ano. É a maior fonte de bug latente do legado (vira quebrado em 2026).

**Regra extra de contas a pagar:** quando `parcelas == 1`, o vencimento não passa pelo cálculo incremental (usa a data base direto).

---

## 2. Criação de fatura

Fonte: `cadastra_fatura.dart`

1. `insert` em `faturas` com defaults: `status = 'aberta'`, `cancelada = false`, `total = 0.0`, `observacoes = ''`, `rodape = ''`. Retorna `id`.
2. Para cada serviço da fatura, `insert` em `faturasxservicos` com defaults `quantidade = 1.0`, `acrescimo = 0`, `desconto = 0`, `incluir = true`.

**Problemas a corrigir:** loop de insert (N+1) e ausência de transação — se o passo 2 falhar, sobra fatura órfã.
→ No Next: **RPC Postgres `criar_fatura(payload jsonb)`** que faz cabeçalho + itens + parcelas numa única transação. Resolve N+1, atomicidade e ainda roda sob RLS.

---

## 3. Recálculo de parcelas (adicionar / excluir)

Fonte: `adicionar_parcela_recalcular.dart` (+`_pagar`), `excluir_parcela_recalcular.dart` (+`_pagar`)

**Adicionar parcela:**
1. Ordena por `numeroparcela`, pega a última.
2. Intervalo = diferença em dias entre última e penúltima; se ≤ 0 ou só existe uma parcela, usa **30 dias**.
3. Divide o valor da última por 2: metade fica na última, metade vai para a nova.
4. Nova parcela: `numeroparcela = ultima + 1`, `vencimento = ultima.vencimento + intervalo`.

**Excluir parcela:**
1. Bloqueia se houver apenas uma parcela (`'Não é possível excluir a única parcela.'`).
2. Deleta a parcela.
3. **Soma o valor excluído à última parcela restante** (preserva o total).
4. Renumera todas as parcelas sequencialmente a partir de 1.

Invariante em ambos: **a soma das parcelas nunca muda**. Testar isso explicitamente na reescrita.
O legado não verifica se a parcela está paga antes de mexer — **adicionar essa guarda**.

---

## 4. Cartão de crédito

**Parcelamento de compra** (`gerar_parcelas_cartao.dart`):
- Competência inicial: se `dataCompra.day < cartao.diaFechamento` → competência é o **mês da compra**; senão, **mês seguinte**.
- `valorParcela = valor / totalParcelas` (sem ajuste de arredondamento — **divergente da regra 1, corrigir**).
- Uma linha em `cartaofaturasparcelas` por parcela, competência incrementando 1 mês, `status = 'ABERTO'`.

**Fechamento de fatura** (`fechar_fatura_cartao.dart`):
- Exige usuário autenticado e empresa ativa.
- `dataFechamento = (ano, mês da competência, cartao.diaFechamento)`.
- `dataVencimento`: se `diaFechamento > diaVencimento`, vence no **mês seguinte** (com virada de ano); senão no mesmo mês.
- Bloqueia se já existe `cartaofaturas` `FECHADA` para o par (cartão, competência).
- Insere `cartaofaturas` com `status = 'FECHADA'`, depois marca todas as `cartaofaturasparcelas` daquele cartão/competência com `status ABERTO` ou nulo como `FECHADO` + `fkCartaoFatura`.

Fatura de cartão fechada pode virar uma `contaspagar` (campo `cartaofaturas.fkContaPagar`).

---

## 5. Importação de extrato bancário (CSV)

Fonte: `import_extrato_csv.dart`

- Delimitador detectado pelo header: `,` se presente, senão `;`.
- Colunas obrigatórias (header em minúsculas): `data`, `transação`, `identificação`, `valor`. Opcional: `tipo transação`. Fora disso → `"CSV fora do padrão esperado."`.
- Data `dd/MM/yyyy` estrita; valor com `,` → `.` e limpeza de não-numéricos. Linha inválida é **pulada em silêncio** (→ no Next, relatar linhas rejeitadas ao usuário).
- `nome` = identificação em UPPERCASE.
- `tipo` = `debito` se valor < 0, senão `credito`; grava sempre `valor.abs()`.
- **Hash de deduplicação:** `base64url("fkConta|yyyy-MM-dd|valor|descricao|nome|numeroDaLinha")`.
  ⚠️ Incluir o número da linha faz o hash ser **sempre único** — a dedup não funciona. Comentário no código admite ("linha do CSV = sempre única") e o `onConflict` foi removido. **Corrigir:** tirar a linha do hash, criar índice único em `(fkContaBancaria, hash)` e usar `upsert ... on conflict do nothing`.
- Insert em lotes de **200**.

---

## 6. Conciliação bancária

Fonte: `lib/components/conciliacao_widget.dart` (1.534 l.) + campos `extratobancario.conciliado` / `fkPagamento` e `pagamentos.conciliado`.
Vincula linha de extrato ↔ `pagamentos`, marcando os dois lados como conciliados. Lógica está embutida na UI — precisa ser extraída para uma função de domínio na reescrita.

---

## 7. Envio de fatura por e-mail

Fonte: `enviofaturaemail.dart`

- Provider **EmailJS** — `service_15oikmx` / `template_zkds583` / `user_id dSWtDeKnHBcaPBUkU` (hardcoded).
- Monta HTML com botões condicionais: **Boleto** (se URL), **Nota Fiscal** (se URL), e sempre **Fatura**, apontando para `https://onpay.flutterflow.app/faturas?idfat={id}`.
- Cada envio registra linha em `faturahistoricoemails` (fatura, parcela, e-mail, usuário).

→ No Next: virar **route handler** `app/api/faturas/[id]/enviar/route.ts`, credenciais em env server-side, e o link público apontando para o novo domínio (rota pública de visualização de fatura, sem login).

---

## 8. Relatórios PDF (11)

`fatura` (821 l., o mais complexo), `contas`, `contas a pagar`, `contas pagas`, `contas a receber`, `DRE`, `extrato bancário`, `projeção de caixa`, `recibo de conta paga`, `relatório de faturas`, `relatório de faturas por status`.

Gerados client-side com o pacote `pdf` do Dart. **Não têm equivalente direto no Next** — decidir em 05 entre:
- **(a)** React-PDF / `@react-pdf/renderer` em route handler → PDF server-side, layout em JSX;
- **(b)** HTML + CSS print + Puppeteer/Playwright em serverless;
- **(c)** HTML com `@media print` e o próprio "Imprimir → Salvar como PDF" do navegador.

Recomendação: **(c) para a maioria** (mais barato, zero infra, e o usuário já vê na tela o que vai imprimir) e **(a) só para a fatura**, que é documento enviado a cliente e precisa de layout fixo.

---

## 9. DRE

RPC `dre_por_ano` no Postgres + structs `dre_struct`, `dre_receitas_struct`, `dre_despesas_struct`, `dre_resumo_struct`, `competencias_struct`.
Toda a apuração já está no banco — **reaproveitar a RPC integralmente**, só refazer a tela. Receitas e despesas classificadas por `centrodecusto.tipo`.

---

## 10. Numeração sequencial

`zsequencias` (`tabela`, `ultimo`, `fkEmpresa`) — contador por empresa e por tabela, lido/incrementado pela aplicação. Sem lock → duas criações simultâneas geram o mesmo número.
→ **RPC `proximo_numero(tabela text)` com `UPDATE ... RETURNING`** (atômico) ou sequence por tenant.

---

## Invariantes para virar teste automatizado

1. `soma(parcelas.valor) == titulo.total`, sempre — na criação, ao adicionar e ao excluir parcela.
2. Nenhum vencimento cai em sábado, domingo ou feriado.
3. Não é possível deixar um título com zero parcelas.
4. Fatura de cartão não fecha duas vezes na mesma competência.
5. Importar o mesmo CSV duas vezes não duplica lançamentos.
6. Toda leitura/escrita é restrita à empresa ativa do usuário (validar via RLS, não via UI).
