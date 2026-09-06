"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  BotaoDeAcao,
  Button,
  CampoBloqueado,
  CampoNumerico,
  EmptyRow,
  Field,
  Formulario,
  GrupoDeCampos,
  inputDeCelula,
  inputStyle,
  PanelTabs,
  SeletorBuscavel,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje } from "@/shared/utils/datas";
import { totalDosLancamentos } from "@/modules/contas-pagar/contas-pagar.types";

/**
 * Nova conta a pagar.
 *
 * Espelho da nova conta a receber na anatomia e na LOGICA: la o total sai dos
 * tickets escolhidos, aqui sai dos lancamentos digitados. Nos dois casos ele e
 * consequencia do detalhamento, e nao um numero que alguem afirma por fora.
 *
 * ⚠️ Nao ha escolha de conta bancaria nem de cartao. De onde o dinheiro sai e
 * decisao da BAIXA: a mesma despesa pode ser paga em PIX hoje ou no cartao
 * amanha, e prender a forma aqui obrigaria a editar a divida para trocar de
 * bolso.
 */

/**
 * De onde a conta vem.
 *
 * ⚠️ Ou lancamentos, OU compras — nunca os dois. Uma conta que tivesse as duas
 * listas somaria dois detalhamentos para o mesmo total, e ninguem saberia qual
 * deles a DRE deveria acreditar. A aba nao e um filtro de exibicao: e a escolha
 * da origem.
 */
const ABA_LANCAMENTOS = "Lançamentos";
const ABA_COMPRAS = "Compras";

/*
 * ⚠️ Parcelas e anexos sao ABA, e nao blocos empilhados.
 *
 * O drawer ficou alto: fornecedor, documento, lancamentos, cronograma e arquivos
 * um sob o outro obrigavam a rolar so para conferir se a soma fechou. Como aba,
 * cada assunto ocupa a mesma altura, e o que e comum a todos — fornecedor,
 * documento, emissao, total e observacao — fica sempre a vista no bloco de cima.
 *
 * ⚠️ As duas PRIMEIRAS sao a origem, e mutuamente exclusivas: a conta vem de
 * lancamento OU de compra. As outras duas nao concorrem com elas — sao o que
 * fazer com o total que a origem produziu, e o papel que comprova a divida.
 */
const ABA_PARCELAS = "Parcelas";
const ABA_ANEXOS = "Anexos";

type Centro = {
  id: number;
  codigo: string | null;
  descricao: string;
  tipo: string;
  ativo: boolean;
};
type TipoDoc = { id: number; sigla: string; nome: string };

/** Enquanto se edita, centro e um TEXTO: "" e o estado de "ainda nao escolhi". */
type LinhaLancamento = {
  descricao: string;
  valor: number;
  centroCustoId: string;
};

/** Uma linha do cronograma enquanto a conta ainda nao existe. */
type LinhaParcela = { vencimento: string; valor: number };

/**
 * O mesmo dia no mes seguinte, sem estourar o fim do mes.
 *
 * ⚠️ Sobre `Date.UTC`: `new Date("2026-01-31")` no horario de Brasilia volta um
 * dia, e a parcela nasceria em 30/01.
 */
function somarUmMes(iso: string): string {
  if (!iso) return "";

  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const proximo = new Date(Date.UTC(ano, mes, 1));
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();

  proximo.setUTCDate(Math.min(dia, ultimoDia));
  return proximo.toISOString().slice(0, 10);
}

const LINHA_VAZIA: LinhaLancamento = {
  descricao: "",
  valor: 0,
  centroCustoId: "",
};

/**
 * Os dados que a conta ja nasce sabendo, quando ela vem de outra tela.
 *
 * ⚠️ Existe para a conciliacao: a linha do extrato ja traz data, valor e
 * historico do banco, e obrigar a redigitar os tres seria pedir de novo o que a
 * pessoa acabou de ler na tela ao lado. O fornecedor NAO vem — o historico do
 * banco vem abreviado e as vezes traz a maquininha no lugar de quem recebeu, e
 * escolher por ele seria adivinhar.
 */
export type ContaInicial = {
  valor?: Centavos;
  emissao?: string;
  descricao?: string;
};

export function NovaContaDrawer({
  onClose,
  inicial,
}: {
  onClose: () => void;
  inicial?: ContaInicial;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const listaDeSiglas = useId();

  const [aba, setAba] = useState(ABA_LANCAMENTOS);

  const [fornecedorId, setFornecedorId] = useState<number | null>(null);
  const [nomeDoFornecedor, setNomeDoFornecedor] = useState<string | null>(null);
  const [documento, setDocumento] = useState("");
  const [sigla, setSigla] = useState("");
  const [tipos, setTipos] = useState<TipoDoc[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);

  // Comeca com UMA linha: a conta mais comum tem exatamente um lancamento, e
  // abrir com a tabela vazia obrigaria um clique antes de qualquer digitacao.
  const [lancamentos, setLancamentos] = useState<LinhaLancamento[]>([
    {
      ...LINHA_VAZIA,
      ...(inicial?.valor != null ? { valor: inicial.valor } : {}),
      ...(inicial?.descricao ? { descricao: inicial.descricao } : {}),
    },
  ]);

  const [emissao, setEmissao] = useState<string>(inicial?.emissao ?? hoje());
  const [observacoes, setObservacoes] = useState("");

  const [arquivos, setArquivos] = useState<File[]>([]);
  const entradaDeArquivo = useRef<HTMLInputElement>(null);
  const [salvando, setSalvando] = useState(false);

  /**
   * Os fornecedores que casam com o que foi digitado.
   *
   * ⚠️ BUSCA, e nao a lista inteira, e filtrada por PAPEL. Sem o papel a lista
   * traria os clientes junto, e quem cadastra despesa escolheria por engano quem
   * paga em vez de quem recebe — o mesmo nome existe nos dois lados quando a
   * empresa compra de quem ela atende.
   */
  const buscarFornecedores = useCallback(async (termo: string) => {
    const p = new URLSearchParams({
      perPage: "15",
      papel: "fornecedor",
      ativo: "true",
    });
    if (termo.trim()) p.set("busca", termo.trim());

    const r = await fetch(`/api/v1/clientes?${p.toString()}`);
    if (!r.ok) return [];

    const corpo = await r.json();

    return (
      (corpo.data ?? []) as {
        id: number;
        razao: string;
        nomeFantasia: string | null;
      }[]
    ).map((c) => ({ id: c.id, nome: c.nomeFantasia?.trim() || c.razao }));
  }, []);

  useEffect(() => {
    const controle = new AbortController();

    fetch("/api/v1/centro-custo", { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const corpo = await r.json();
        setCentros((corpo.data ?? []) as Centro[]);
      })
      .catch(() => {
        // Silencioso: sem a lista o lancamento nasce sem centro, que e
        // permitido. Um aviso assustaria sobre algo que nao impede de salvar.
      });

    fetch("/api/v1/documentos-tipos", { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const corpo = await r.json();
        setTipos((corpo.data ?? []) as TipoDoc[]);
      })
      .catch(() => {
        // A especie e obrigatoria, entao sem a lista o botao ja fica travado
        // dizendo o que falta. Um aviso somaria barulho a uma trava explicada.
      });

    return () => controle.abort();
  }, []);

  /*
   * ⚠️ So os centros de DESPESA, e so os ativos.
   *
   * Centro tem tipo, e o tipo diz de que lado do resultado a linha cai. Uma
   * despesa apontando para centro de receita entra na DRE somando onde deveria
   * subtrair. O servidor tambem recusa; aqui a lista nem chega a oferecer.
   */
  const centrosDeDespesa = useMemo(
    () => centros.filter((c) => c.tipo === "DESPESA" && c.ativo),
    [centros],
  );

  /*
   * A especie sai da SIGLA digitada, sem diferenciar caixa.
   *
   * ⚠️ Casamento exato, e nao "comeca com": com `NF-e` e `NFS-e` na lista, o
   * prefixo faria "NF" escolher uma das duas sozinho enquanto a pessoa ainda
   * estava digitando a outra.
   */
  const tipoEscolhido = useMemo(
    () =>
      tipos.find((t) => t.sigla.toLowerCase() === sigla.trim().toLowerCase()) ??
      null,
    [tipos, sigla],
  );

  const total = totalDosLancamentos(lancamentos);

  /*
   * O cronograma e DERIVADO enquanto ninguem o toca, e vira estado no primeiro
   * ajuste.
   *
   * ⚠️ Nulo significa "ainda nao mexeram": ai a tabela mostra uma parcela unica
   * com o total do momento, e ela acompanha o que se digita nos lancamentos.
   * Guardando o cronograma em estado desde o inicio, seria preciso sincroniza-lo
   * num efeito a cada tecla — e sincronizar estado dentro de efeito e o caminho
   * de renders em cascata que o proprio React desaconselha.
   *
   * Depois do primeiro ajuste ele para de acompanhar, e e isso que se quer: quem
   * repartiu em tres nao quer o trabalho desfeito porque corrigiu um centavo num
   * lancamento. O que muda passa a aparecer em "Falta parcelar".
   */
  const [parcelasEditadas, setParcelasEditadas] = useState<
    LinhaParcela[] | null
  >(null);

  const parcelas: LinhaParcela[] =
    parcelasEditadas ??
    (total > 0 ? [{ vencimento: hoje(), valor: total }] : []);

  const parcelado = parcelas.reduce((soma, p) => soma + p.valor, 0);
  const faltaParcelar = total - parcelado;

  function mudarParcela(indice: number, mudanca: Partial<LinhaParcela>) {
    setParcelasEditadas(
      parcelas.map((p, i) => (i === indice ? { ...p, ...mudanca } : p)),
    );
  }

  /**
   * Reparte a ultima parcela em duas.
   *
   * ⚠️ O resto de centavo fica na PRIMEIRA das duas, e nao na nova. Dividir 100
   * em duas da 50 e 50; dividir 101 da 51 e 50 — a parcela que ja existia
   * absorve a sobra, e a nova sai com o numero redondo que se combina.
   */
  function dividirUltima() {
    const ultima = parcelas.at(-1);
    if (!ultima || ultima.valor < 2) return;

    const metade = Math.floor(ultima.valor / 2);

    setParcelasEditadas([
      ...parcelas.slice(0, -1),
      { ...ultima, valor: ultima.valor - metade },
      { vencimento: somarUmMes(ultima.vencimento), valor: metade },
    ]);
  }

  /** Tira a parcela e devolve o valor dela para a ultima que sobrar. */
  function removerParcela(indice: number) {
    if (parcelas.length <= 1) return;

    const fora = parcelas[indice];
    const restantes = parcelas.filter((_, i) => i !== indice);
    const ultima = restantes.length - 1;

    setParcelasEditadas(
      restantes.map((p, i) =>
        i === ultima ? { ...p, valor: p.valor + fora.valor } : p,
      ),
    );
  }

  function mudarLinha(indice: number, mudanca: Partial<LinhaLancamento>) {
    setLancamentos((l) =>
      l.map((linha, i) => (i === indice ? { ...linha, ...mudanca } : linha)),
    );
  }

  const motivoTravado = !fornecedorId
    ? "Escolha o fornecedor"
    : !tipoEscolhido
      ? "Informe a espécie do documento"
      : documento.trim().length === 0
        ? "Informe o número do documento"
        : lancamentos.some((l) => l.descricao.trim().length === 0)
          ? "Descreva cada lançamento"
          : lancamentos.some((l) => l.valor <= 0)
            ? "Cada lançamento precisa de um valor"
            : total <= 0
              ? "O total da conta precisa ser maior que zero"
              : parcelas.some((p) => !p.vencimento)
                ? "Informe o vencimento de cada parcela"
                : faltaParcelar !== 0
                  ? "As parcelas precisam somar o total da conta"
                  : undefined;

  async function criar() {
    setSalvando(true);

    const r = await fetch("/api/v1/contas-pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fornecedorId,
        emissao,
        documento: documento.trim(),
        tipoDocumentoId: tipoEscolhido?.id,
        /*
         * ⚠️ O total NAO viaja. Ele e a soma destas linhas, e quem a faz e o
         * servidor, com a mesma funcao pura que a tela usou aqui em cima.
         */
        lancamentos: lancamentos.map((l) => ({
          descricao: l.descricao.trim(),
          valor: l.valor,
          centroCustoId: l.centroCustoId ? Number(l.centroCustoId) : null,
        })),
        origem: { tipo: "AVULSA" },
        observacoes: observacoes.trim() || null,
        parcelas: parcelas.map((p) => ({
          vencimento: p.vencimento,
          valor: p.valor,
        })),
      }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível criar a conta",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    /*
     * Os anexos sobem DEPOIS, e uma falha aqui nao desfaz a conta.
     *
     * ⚠️ A conta ja existe e ja e cobravel: apagar tudo porque um PDF nao subiu
     * seria perder o cadastro inteiro por causa do acessorio. O aviso diz o que
     * faltou, e o arquivo se anexa de novo pelo drawer da conta.
     */
    const falharam: string[] = [];

    for (const arquivo of arquivos) {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);

      const envio = await fetch(
        `/api/v1/contas-pagar/${dados.data.id}/anexos`,
        {
          method: "POST",
          body: corpo,
        },
      );

      if (!envio.ok) falharam.push(arquivo.name);
    }

    if (falharam.length > 0) {
      avisar(
        "atencao",
        "A conta foi criada, mas nem todo arquivo subiu",
        `Reenvie pelo drawer da conta: ${falharam.join(", ")}.`,
      );
      router.refresh();
      onClose();
      return;
    }

    avisar(
      "sucesso",
      `Conta ${dados.data.numero} criada`,
      `${dados.data.qtdParcelas} parcela(s), ${formatarSemSimbolo(dados.data.total)}.`,
    );
    router.refresh();
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Nova conta a pagar"
      acoes={
        /*
         * ⚠️ A dica vai num `span` em volta, e nao no botao: navegador nao
         * dispara evento de mouse em `button:disabled`, entao o `title` no
         * proprio botao nunca aparece — que e justamente quando ele precisa.
         */
        <span title={motivoTravado}>
          <Button
            size="xs"
            variant="primary"
            disabled={salvando || !!motivoTravado}
            onClick={criar}
          >
            {salvando ? "Criando…" : "Criar conta"}
          </Button>
        </span>
      }
    >
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="De quem é a conta"
          legenda="O fornecedor e o papel que origina a dívida."
        >
          <Field label="Fornecedor" required>
            <SeletorBuscavel
              valor={fornecedorId}
              rotulo={nomeDoFornecedor}
              buscar={buscarFornecedores}
              aoEscolher={(f) => {
                setFornecedorId(f?.id ?? null);
                setNomeDoFornecedor(f?.nome ?? null);
              }}
            />
          </Field>

          {/*
            ⚠️ A SIGLA e o campo que se digita, e o nome vem atras.

            Ela e curta, e o que se sabe de cor: quem lanca uma guia digita
            "DAS", nao "Documento de Arrecadação do Simples Nacional". O nome ao
            lado confirma que a sigla certa foi entendida, e por isso ele e
            bloqueado — dois campos editaveis para o mesmo fato divergiriam.
          */}
          <Field
            label="Documento"
            required
            hint="Digite a sigla: DAS, NFS-e, CT."
          >
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={sigla}
                onChange={(e) => setSigla(e.target.value)}
                list={listaDeSiglas}
                maxLength={12}
                placeholder="Sigla"
                style={{
                  ...inputStyle,
                  width: 96,
                  flexShrink: 0,
                  textTransform: "uppercase",
                }}
              />
              <datalist id={listaDeSiglas}>
                {tipos.map((t) => (
                  <option key={t.id} value={t.sigla}>
                    {t.nome}
                  </option>
                ))}
              </datalist>

              <div style={{ flex: 1, minWidth: 0 }}>
                <CampoBloqueado
                  valor={
                    tipoEscolhido?.nome ??
                    (sigla.trim()
                      ? "Sigla não reconhecida"
                      : "Escolha a espécie")
                  }
                />
              </div>
            </div>
          </Field>

          <Field
            label="Nº do documento"
            required
            hint="O número que vem no papel. Não é o número da conta, que o sistema dá sozinho."
          >
            <input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              maxLength={255}
              style={inputStyle}
            />
          </Field>

          <Field
            label="Emissão"
            hint="A data do documento, e não a do vencimento."
          >
            <input
              type="date"
              value={emissao}
              onChange={(e) => setEmissao(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field
            label="Total da conta"
            hint="A soma dos lançamentos. É ele que as parcelas repartem."
          >
            <CampoBloqueado valor={formatarSemSimbolo(total as Centavos)} />
          </Field>

          {/*
            ⚠️ A observacao mora AQUI, junto de quem e a conta, e nao no bloco do
            pagamento. Ela e nota sobre o acordo — "combinei prazo maior com o
            fornecedor" —, e nao sobre a forma de pagar.
          */}
          <Field label="Observações">
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Anotação de quem trabalha nesta conta"
              maxLength={4000}
              style={{
                ...inputStyle,
                height: "auto",
                padding: 8,
                resize: "vertical",
              }}
            />
          </Field>
        </GrupoDeCampos>

        {/*
          ⚠️ As duas primeiras abas escolhem a ORIGEM, e sao exclusivas: a conta
          vem de lancamento OU de compra. A terceira nao concorre com elas — e o
          que fazer com o total que qualquer uma das duas produziu.
        */}
        <div>
          <PanelTabs
            tabs={[ABA_LANCAMENTOS, ABA_COMPRAS, ABA_PARCELAS, ABA_ANEXOS]}
            active={aba}
            onChange={setAba}
          />

          {aba === ABA_PARCELAS ? (
            <GrupoDeCampos
              primeiro
              titulo="Como vai ser paga"
              legenda="Cada parcela tem data e valor próprios, e o + reparte a última em duas. A soma tem de fechar com o total da conta."
              /*
                ⚠️ O `+` DIVIDE a última, e não acrescenta uma parcela solta.

                O total está fixo — ele veio dos lançamentos —, então toda parcela
                nova tem que sair de alguma. Acrescentando por fora, a soma passaria
                do total e o salvar travaria sem a pessoa entender o que fez de
                errado. Dividindo, ela sempre fecha.
              */
              onIncluir={total > 0 ? dividirUltima : undefined}
              rotuloIncluir="Mais uma parcela"
            >
              {/*
                ⚠️ O total e CAMPO BLOQUEADO, e nao digitavel.

                Na conta a receber ele sai dos tickets escolhidos; aqui sai dos
                lancamentos. Nos dois casos ele e consequencia do detalhamento — e
                digitavel, ele deixaria a conta afirmar um valor que suas proprias
                linhas nao sustentam.
              */}

              <TableArea minWidth={0}>
                <TableHead>
                  <Th minWidth={44}>#</Th>
                  <Th minWidth={140}>Vencimento</Th>
                  <Th minWidth={110}>Valor</Th>
                  <Th minWidth={44}> </Th>
                </TableHead>

                <tbody>
                  {parcelas.length === 0 && (
                    <EmptyRow
                      colSpan={4}
                      message="Informe o valor dos lançamentos primeiro."
                    />
                  )}

                  {parcelas.map((p, i) => (
                    <Tr key={i}>
                      <Td style={NUM}>{i + 1}</Td>

                      <Td>
                        <input
                          type="date"
                          value={p.vencimento}
                          onChange={(e) =>
                            mudarParcela(i, { vencimento: e.target.value })
                          }
                          style={inputDeCelula}
                        />
                      </Td>

                      <Td>
                        <CampoNumerico
                          valor={p.valor}
                          escala={100}
                          aoMudar={(v) => mudarParcela(i, { valor: v })}
                          style={inputDeCelula}
                        />
                      </Td>

                      <Td>
                        {/*
                          ⚠️ Tirar uma parcela devolve o valor dela para a ULTIMA que
                          sobrar, e nao some com o dinheiro. O total esta fixo: sem
                          devolver, a soma deixaria de fechar e o salvar travaria.
                        */}
                        <span
                          title={
                            parcelas.length === 1
                              ? "A conta precisa de ao menos uma parcela"
                              : undefined
                          }
                        >
                          <BotaoDeAcao
                            rotulo="Tirar esta parcela"
                            desabilitado={parcelas.length === 1}
                            onClick={() => removerParcela(i)}
                          >
                            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" />
                          </BotaoDeAcao>
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableArea>

              {/*
                ⚠️ O que FALTA repartir, e nao a soma parcial. A pergunta de quem
                edita e "quanto ainda preciso distribuir para poder salvar".
              */}
              {faltaParcelar !== 0 && (
                <Field
                  label="Falta parcelar"
                  hint="Precisa chegar a zero para salvar."
                >
                  <CampoBloqueado
                    valor={formatarSemSimbolo(faltaParcelar as Centavos)}
                  />
                </Field>
              )}
            </GrupoDeCampos>
          ) : aba === ABA_ANEXOS ? (
            <GrupoDeCampos
              primeiro
              titulo="Arquivos da conta"
              legenda="A nota, o contrato, o comprovante. Eles sobem junto quando a conta for criada."
              /*
                ⚠️ O `+` do TITULO, e nao um botao no rodape da lista. No rodape
                ele desce junto com o ultimo arquivo, e quem anexou oito rola ate
                o fim para achar como anexar o nono. Mesma decisao de todo
                cadastro de filho no sistema.
              */
              onIncluir={() => entradaDeArquivo.current?.click()}
              rotuloIncluir="Escolher arquivo"
            >
              <input
                ref={entradaDeArquivo}
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const escolhidos = Array.from(e.target.files ?? []);
                  // Limpo para que escolher o MESMO arquivo de novo volte a
                  // disparar o evento.
                  e.target.value = "";
                  if (escolhidos.length > 0)
                    setArquivos((a) => [...a, ...escolhidos]);
                }}
              />

              <TableArea minWidth={0}>
                <TableHead>
                  <Th>Arquivo</Th>
                  <Th minWidth={90}>Tamanho</Th>
                  <Th minWidth={44}> </Th>
                </TableHead>

                <tbody>
                  {arquivos.length === 0 && (
                    <EmptyRow
                      colSpan={3}
                      message="Use o + para anexar a nota ou o contrato."
                    />
                  )}

                  {arquivos.map((a, i) => (
                    <Tr key={i}>
                      <Td style={{ maxWidth: 260 }}>
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.name}
                        </span>
                      </Td>

                      {/* Em KB porque o limite do bucket e de 20 MB: em bytes o
                          numero nao se le, e em MB quase todo anexo daria 0,1. */}
                      <Td style={NUM}>
                        {Math.max(1, Math.round(a.size / 1024))} KB
                      </Td>

                      <Td>
                        <BotaoDeAcao
                          rotulo="Tirar este arquivo"
                          onClick={() =>
                            setArquivos((atual) =>
                              atual.filter((_, n) => n !== i),
                            )
                          }
                        >
                          <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" />
                        </BotaoDeAcao>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableArea>
            </GrupoDeCampos>
          ) : aba === ABA_COMPRAS ? (
            <p
              style={{
                padding: "28px 16px",
                textAlign: "center",
                border: "1px dashed var(--border-strong)",
                borderRadius: "var(--radius-lg)",
                color: "var(--text-tertiary)",
                fontSize: "var(--text-sm)",
                lineHeight: 1.6,
              }}
            >
              Gerar a conta a partir de um pedido de compra ainda não existe.
              Enquanto isso, a despesa entra em Lançamentos.
            </p>
          ) : (
            <GrupoDeCampos
              titulo="O que está sendo pago"
              legenda="Cada linha tem o próprio centro de custo, e é por elas que a DRE separa o custo. Desconto entra como linha e subtrai."
              onIncluir={() =>
                setLancamentos((l) => [...l, { ...LINHA_VAZIA }])
              }
            >
              {/*
                ⚠️ SEM moldura em volta: o cartao do drawer ja e a moldura, e as
                duas juntas dao contorno dentro de contorno.

                ⚠️ Os campos usam `inputDeCelula`, e nao `inputStyle`: dentro da
                tabela, a moldura de cada campo brigaria com as divisorias da
                linha e o resultado e uma grade dentro de outra.
              */}
              <TableArea minWidth={0}>
                {/*
                  ⚠️ SEM coluna de tipo. Ela chegou a existir com Item, Despesa
                  e Desconto, e as tres foram embora: item e despesa somavam
                  igual, e DESCONTO nao pertence a conta. A conta e o que se DEVE
                  conforme o documento; desconto por antecipacao depende de
                  QUANDO se paga, e por isso mora na baixa, ao lado de juros e
                  multa.
                */}
                <TableHead>
                  {/*
                    ⚠️ Mesma ordem e mesmas larguras do drawer de edicao. As duas
                    tabelas mostram o mesmo dado: colunas em ordens diferentes
                    obrigariam a reaprender a leitura ao passar de uma para a
                    outra.
                  */}
                  <Th minWidth={150}>C. de Custo</Th>
                  <Th minWidth={220}>Descrição</Th>
                  <Th minWidth={110}>Valor</Th>
                  <Th minWidth={44}> </Th>
                </TableHead>

                <tbody>
                  {lancamentos.length === 0 && (
                    <EmptyRow
                      colSpan={4}
                      message="Use o + para incluir o que está sendo pago."
                    />
                  )}

                  {lancamentos.map((l, i) => (
                    <Tr key={i}>
                      <Td>
                        <select
                          value={l.centroCustoId}
                          onChange={(e) =>
                            mudarLinha(i, { centroCustoId: e.target.value })
                          }
                          style={inputDeCelula}
                        >
                          <option value="">Sem centro</option>
                          {centrosDeDespesa.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.codigo
                                ? `${c.codigo} · ${c.descricao}`
                                : c.descricao}
                            </option>
                          ))}
                        </select>
                      </Td>

                      <Td>
                        <input
                          value={l.descricao}
                          onChange={(e) =>
                            mudarLinha(i, { descricao: e.target.value })
                          }
                          maxLength={255}
                          placeholder="O que é esta linha"
                          style={inputDeCelula}
                        />
                      </Td>

                      <Td>
                        {/*
                          ⚠️ `CampoNumerico` tem estilo proprio e nao herda o da
                          celula: sem `style`, ele era o unico campo da tabela sem
                          a linha pontilhada, e parecia texto.
                        */}
                        <CampoNumerico
                          valor={l.valor}
                          escala={100}
                          aoMudar={(v) => mudarLinha(i, { valor: v })}
                          style={inputDeCelula}
                        />
                      </Td>

                      <Td>
                        {/*
                          ⚠️ A ultima linha nao se apaga: a conta precisa de ao
                          menos um lancamento, e uma tabela vazia so poderia ser
                          desfeita pelo `+`. Travado com o motivo a vista.
                        */}
                        <span
                          title={
                            lancamentos.length === 1
                              ? "A conta precisa de ao menos um lançamento"
                              : undefined
                          }
                        >
                          <BotaoDeAcao
                            rotulo="Tirar esta linha"
                            desabilitado={lancamentos.length === 1}
                            onClick={() =>
                              setLancamentos((linhas) =>
                                linhas.filter((_, n) => n !== i),
                              )
                            }
                          >
                            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" />
                          </BotaoDeAcao>
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableArea>
            </GrupoDeCampos>
          )}
        </div>
      </Formulario>
    </Drawer>
  );
}

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
