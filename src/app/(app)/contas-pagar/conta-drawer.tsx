"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { useRouter } from "next/navigation";
import { useAvisos } from "@/components/ui/avisos";
import { MenuDoCabecalho } from "@/components/ui/menu-de-cabecalho";
import { ItemDoMenu, MenuDeLinha } from "@/components/ui/menu-de-linha";
import { NovaBaixaDrawer } from "./baixas/nova-baixa-drawer";
import { EditorDeParcelamento } from "@/components/financeiro/editor-de-parcelamento";
import { oQuePodeNaConta } from "@/shared/domain/parcelas";
import {
  LancamentosDaConta,
  type LancamentoDaConta,
} from "./lancamentos-da-conta";
import {
  AcoesDaLinha,
  Alert,
  BotaoDeAcao,
  CampoBloqueado,
  EmptyRow,
  Field,
  GrupoDeCampos,
  MarcaDeConciliacao,
  PanelTabs,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { situacaoDaConta } from "@/modules/contas-pagar/contas-pagar.types";
import { inputStyle } from "@/components/ui/kit";
import { formatarDocumento } from "@/shared/domain/documento";
import { ehPessoaFisica } from "@/shared/domain/cadastro-pessoa";

/**
 * Detalhe da conta a pagar.
 *
 * Mesmo padrao do drawer de fatura: primeiro quanto ja saiu e quanto falta,
 * depois de quem e a conta, e so entao as parcelas. Campos aparecem como campo
 * bloqueado com cadeado — a tela ainda nao edita nada, e o cadeado explica por
 * que. As acoes de baixa ficam desabilitadas e visiveis, para o que falta nao
 * se esconder.
 */

type Parcela = {
  id: number;
  numero: number;
  vencimento: string | null;
  valor: number;
  acrescimo: number;
  desconto: number;
  total: number;
  pago: boolean;
  /** Combinada, mas nao vai mais acontecer: o contrato foi encerrado antes. */
  cancelada: boolean;
  motivoDoCancelamento: string | null;
  /**
   * Juros e multa PAGOS por atraso, somados — o que a baixa cobrou a mais.
   *
   * ⚠️ Nao e `acrescimo`: aquele foi combinado no parcelamento e ja esta dentro
   * de `total`. Este e a diferenca entre pagar em dia e pagar tarde, e por isso
   * aparece AO LADO do valor, e nao dentro dele — o valor precisa continuar
   * batendo com o boleto.
   */
  jurosMulta: number;
  /** O dinheiro desta parcela ja bateu no extrato. */
  conciliado: boolean;
  nfs: string | null;
  boleto: string | null;
  /** A prova de que o dinheiro saiu. */
  comprovante: string | null;
};

type Conta = {
  id: number;
  numero: number | null;
  fornecedorId: number | null;
  descricao: string;
  documento: string | null;
  tipoDocumentoSigla: string | null;
  fornecedorNome: string | null;
  emissao: string | null;
  proximoVencimento: string | null;
  total: number;
  pago: boolean;
  valorPago: number;
  cancelada: boolean;
  suspensa: boolean;
  conciliada: boolean;
  qtdParcelas: number;
  parcelasPagas: number;
  observacoes: string | null;
  fornecedorDoc: string | null;
  centroCustoNome: string | null;
  parcelas: Parcela[];
  anexos: {
    id: number;
    nome: string;
    caminho: string;
    criadoEm: string | null;
  }[];
  rateio: {
    centroCustoId: number | null;
    centroCustoNome: string | null;
    valor: number;
  }[];
  lancamentos: LancamentoDaConta[];
};

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

export function ContaDrawer({
  contaId,
  onClose,
  nivel,
}: {
  contaId: number | null;
  onClose: () => void;
  /**
   * O andar em que ele abre. Padrao 1, o da tela de listagem.
   *
   * ⚠️ Existe porque o extrato abre este mesmo drawer POR CIMA dele: a coluna
   * "Registro" leva da linha do banco ate o titulo sem sair da conferencia. No
   * andar 1 os dois ficariam empilhados no mesmo z, e fechar um fecharia a
   * leitura do outro junto.
   */
  nivel?: 1 | 2 | 3;
}) {
  // `key` remonta a cada conta: o estado nasce vazio sozinho, sem limpar a mao
  // dentro de um efeito, e sem mostrar o registro anterior enquanto carrega.
  return contaId == null ? null : (
    <Conteudo key={contaId} contaId={contaId} onClose={onClose} nivel={nivel} />
  );
}

function Conteudo({
  contaId,
  onClose,
  nivel,
}: {
  contaId: number;
  onClose: () => void;
  nivel?: 1 | 2 | 3;
}) {
  const [conta, setConta] = useState<Conta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"lancamentos" | "parcelas" | "anexos">(
    "lancamentos",
  );
  /** A parcela que o menu da linha mandou baixar. */
  const [baixando, setBaixando] = useState<number | null>(null);
  /** O total que a edicao de lancamentos ainda nao gravou. Nulo fora de edicao. */
  const [totalPendente, setTotalPendente] = useState<number | null>(null);
  const [parcelando, setParcelando] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [salvandoObs, setSalvandoObs] = useState(false);

  async function salvarObservacoes() {
    // Sem ida ao servidor quando nada mudou: sair do campo sem digitar e o caso
    // mais comum, e ele nao pode custar uma escrita.
    if (!conta || observacoes === (conta.observacoes ?? "")) return;

    setSalvandoObs(true);
    const r = await fetch(`/api/v1/contas-pagar/${contaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacoes: observacoes.trim() || null }),
    });
    const dados = await r.json().catch(() => null);
    setSalvandoObs(false);

    if (!r.ok) {
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível salvar a observação",
      );
      return;
    }

    setConta(dados.data as Conta);
  }
  const entrada = useRef<HTMLInputElement>(null);
  const { avisar, confirmar } = useAvisos();

  /**
   * O envio de documento DA PARCELA — nota, boleto, comprovante.
   *
   * ⚠️ Mora aqui, e nao dentro do menu da linha, e essa e a correcao.
   *
   * O `input type=file` estava dentro de `AcoesDaParcela`, que o `MenuDeLinha`
   * so monta enquanto aberto. Escolher "Anexar nota" fechava o menu, e o menu
   * fechado DESMONTA o filho: quando o clique programado chegava, o input ja nao
   * existia e nada acontecia — nem dialogo, nem erro. Os tres itens estavam
   * mortos desde que o menu passou a montar por funcao.
   *
   * ⚠️ O alvo viaja em `ref`, e nao em estado. Estado exigiria um render entre o
   * clique da pessoa e o clique no input, e e nesse intervalo que o navegador
   * pode considerar o gesto expirado e recusar abrir o seletor de arquivo.
   */
  const alvoDoAnexo = useRef<{
    parcelaId: number;
    tipo: "nfs" | "boleto" | "comprovante";
  } | null>(null);
  const entradaDaParcela = useRef<HTMLInputElement>(null);

  function pedirDocumentoDaParcela(
    parcelaId: number,
    tipo: "nfs" | "boleto" | "comprovante",
  ) {
    alvoDoAnexo.current = { parcelaId, tipo };
    entradaDaParcela.current?.click();
  }

  async function enviarDocumentoDaParcela(arquivo: File) {
    const alvo = alvoDoAnexo.current;
    if (!alvo) return;

    const corpo = new FormData();
    corpo.append("arquivo", arquivo);

    const r = await fetch(
      `/api/v1/contas-pagar/${contaId}/parcelas/${alvo.parcelaId}/documento?tipo=${alvo.tipo}`,
      { method: "POST", body: corpo },
    );
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("erro", dados?.error?.message ?? "Não foi possível anexar");
      return;
    }

    setConta(dados.data as Conta);
    avisar("sucesso", "Documento anexado");
  }

  /*
   * ⚠️ A LISTA atrás também muda, e por isso o `router.refresh()`.
   *
   * Este drawer não tinha router nenhum: ele só sabia atualizar a si mesmo. Com
   * cancelar e excluir isso deixou de bastar — a conta some ou muda de situação
   * na tabela e nos indicadores do topo, e sem o refresh a tela atrás continuava
   * mostrando uma conta que não existe mais até alguém apertar F5.
   *
   * `refresh` e não recarga da página: ele refaz só o que o servidor renderiza,
   * mantendo o estado do que está aberto.
   */
  const router = useRouter();

  /*
   * ⚠️ Cancelar e excluir CHEGARAM AGORA. Nao existiam.
   *
   * Contas a receber tinha os dois desde o comeco; aqui a unica saida era
   * cancelar parcela por parcela, e a conta continuava viva no meio delas — o
   * total seguia contando e nada explicava por que todas estavam mortas. Nao era
   * decisao de modelo, era buraco.
   *
   * As travas espelham o outro lado, e sao as MESMAS aqui: o que barra os dois e
   * ter parcela paga. Do lado de la, cancelar aceita conta emitida sem baixa
   * porque a cobranca ainda pode ser desfeita; aqui, uma conta sem pagamento e
   * so um compromisso — e compromisso se desfaz inteiro ou nao se desfaz.
   */
  const temBaixa = (conta?.parcelasPagas ?? 0) > 0;

  async function cancelarConta() {
    const r = await fetch(`/api/v1/contas-pagar/${contaId}/cancelamento`, { method: "POST" });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("erro", "Não foi possível cancelar a conta", dados?.error?.message);
      return;
    }

    setConta(dados.data as Conta);
    router.refresh();
    avisar("sucesso", "Conta cancelada", "Ela saiu das listagens do dia a dia. O histórico fica.");
  }

  async function excluirConta() {
    const r = await fetch(`/api/v1/contas-pagar/${contaId}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("erro", "Não foi possível excluir a conta", dados?.error?.message);
      return;
    }

    // Fecha antes de atualizar: o drawer aponta para uma conta que não existe
    // mais, e recarregar com ele aberto daria 404 na tela.
    onClose();
    router.refresh();
    avisar("sucesso", "Conta a pagar excluída");
  }

  /*
   * As duas escritas devolvem a CONTA inteira, e a tela adota a resposta.
   *
   * Recarregar por conta propria depois de gravar abriria uma janela em que a
   * lista mostra o estado velho; e montar o novo estado na mao aqui seria uma
   * segunda versao da verdade, que diverge do servidor no primeiro campo que
   * alguem esquecer.
   */
  async function enviarAnexo(arquivo: File) {
    const corpo = new FormData();
    corpo.append("arquivo", arquivo);

    const r = await fetch(`/api/v1/contas-pagar/${contaId}/anexos`, {
      method: "POST",
      body: corpo,
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível enviar o arquivo",
      );
      return;
    }

    setConta(dados.data as Conta);
    avisar("sucesso", "Arquivo anexado");
  }

  async function removerAnexo(anexoId: number) {
    const r = await fetch(`/api/v1/contas-pagar/${contaId}/anexos/${anexoId}`, {
      method: "DELETE",
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível remover o arquivo",
      );
      return;
    }

    setConta(dados.data as Conta);
    avisar("sucesso", "Arquivo removido");
  }

  /**
   * Cancela uma parcela: ela foi combinada, mas não vai mais acontecer.
   *
   * ⚠️ NÃO é apagar. A conta continua dizendo que o acordo previa doze parcelas,
   * e é isso que se explica depois; o que muda é que ela para de ser cobrada e
   * sai do "em aberto".
   */
  async function cancelarParcela(parcelaId: number) {
    const r = await fetch(
      `/api/v1/contas-pagar/${contaId}/parcelas/${parcelaId}/cancelamento`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível cancelar");
      return;
    }

    await recarregar();
  }

  async function reativarParcela(parcelaId: number) {
    const r = await fetch(
      `/api/v1/contas-pagar/${contaId}/parcelas/${parcelaId}/cancelamento`,
      { method: "DELETE" },
    );

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível reativar");
      return;
    }

    await recarregar();
  }

  /** Relê a conta do servidor. Usado depois de gravar por outro caminho. */
  async function recarregar() {
    const r = await fetch(`/api/v1/contas-pagar/${contaId}`);
    if (!r.ok) return;
    const corpo = await r.json();
    setConta(corpo.data as Conta);
    setObservacoes((corpo.data as Conta).observacoes ?? "");
  }

  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/contas-pagar/${contaId}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok)
          throw new Error(corpo?.error?.message ?? "Falha ao carregar a conta");
        setConta(corpo.data);
        setObservacoes((corpo.data as Conta).observacoes ?? "");
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setErro(e.message);
      });

    return () => controle.abort();
  }, [contaId]);

  /*
   * ⚠️ Pago sai das PARCELAS baixadas, e nao de um campo do cabecalho: e a
   * parcela que carrega a verdade sobre o pagamento.
   *
   * ⚠️ E "em aberto" e o que as parcelas NAO PAGAS somam, e nao total menos
   * pago. A subtracao ignora o desconto: uma conta de 1.500 baixada com 500 de
   * desconto pagou 1.000 e esta quitada, e pela subtracao ela apareceria com 500
   * em aberto para sempre. Parcela paga nao espera mais nada. Mesma regra do
   * lado que recebe.
   */
  const pago = conta
    ? conta.parcelas.filter((p) => p.pago).reduce((s, p) => s + p.total, 0)
    : 0;
  /*
   * ⚠️ Parcela CANCELADA nao entra no "em aberto".
   *
   * Ela continua na conta porque foi combinada, mas ninguem vai pagar: somada,
   * a conta ficaria devendo para sempre um dinheiro que o contrato encerrado ja
   * dispensou.
   */
  const emAberto = conta
    ? conta.parcelas
        .filter((p) => !p.pago && !p.cancelada)
        .reduce((s, p) => s + p.total, 0)
    : 0;

  /*
   * O resumo e montado UMA vez e lido pelas duas regras.
   *
   * ⚠️ Montado duas vezes, ele ja tinha divergido: bastaria acrescentar um campo
   * em `ContaPagarResumo` e lembrar de um dos dois para a situacao e o
   * vencimento passarem a discordar sobre a mesma conta, na mesma tela.
   */
  const resumo = conta
    ? {
        ...conta,
        fornecedorId: null,
        emissao: null,
        valorPago: pago as Centavos,
        proximoVencimento: conta.proximoVencimento as DataISO | null,
        total: conta.total as Centavos,
      }
    : null;

  const situacao = resumo ? situacaoDaConta(resumo) : null;

  return (
    <Drawer
      open
      nivel={nivel}
      onClose={onClose}
      /*
        ⚠️ O titulo nao carrega mais o numero. Ele virou o campo "Código" no alto
        da ficha, onde da para copiar; repetido no titulo, era o mesmo dado duas
        vezes na mesma tela. Mesma decisao da conta a receber.
      */
      /*
        ⚠️ SEM pastilha no cabecalho, e SEM rodape.

        As pastilhas de situacao ao lado do fechar nao existem no kit: elas
        foram desenhadas so aqui, e um enfeite que so uma tela tem vira dialeto.
        A situacao ja e campo na ficha, onde da para ler e copiar.

        O rodape tinha um "Baixar parcela" solto, e o Pedro perguntou o que ele
        fazia ali — a pergunta certa. Baixar exige saber QUAL parcela, e no
        rodape ele nao sabia nenhuma. O gesto mora no menu da linha, que sabe.
      */
      title="Conta a pagar"
      /*
        ⚠️ Um "…" so, sem barra de icones.

        Cancelar e excluir sao os dois gestos destrutivos da tela, e soltos ao
        lado do X ficariam a um pixel do fechar. No menu cada um tem rotulo
        escrito e, quando barrado, o motivo no lugar do icone cinza.

        Mesmo componente do drawer de ticket e do de conta a receber.
      */
      headerExtra={
        conta ? (
          <MenuDoCabecalho>
            {(fechar) => (
              <>
                {!conta.cancelada && (
                  <ItemDoMenu
                    rotulo="Cancelar conta"
                    desabilitado={temBaixa}
                    motivo={
                      temBaixa
                        ? "Conta com parcela paga não é cancelada; estorne a baixa antes"
                        : undefined
                    }
                    icone={
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      >
                        {/* Círculo cortado: proibido, e não um X, que aqui
                            significaria fechar o drawer. */}
                        <circle cx="12" cy="12" r="9" />
                        <path d="M5.6 5.6l12.8 12.8" />
                      </svg>
                    }
                    onClick={() => {
                      fechar();
                      confirmar(
                        `Cancelar a conta ${conta.numero}?`,
                        "Cancelar conta",
                        cancelarConta,
                        "Ela para de ser cobrada e sai das listagens do dia a dia. As parcelas e os anexos ficam.",
                      );
                    }}
                  />
                )}

                <ItemDoMenu
                  rotulo="Excluir conta a pagar"
                  perigo
                  desabilitado={temBaixa}
                  motivo={
                    temBaixa ? "Conta com baixa não é excluída, é cancelada" : undefined
                  }
                  icone={
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  }
                  onClick={() => {
                    fechar();
                    confirmar(
                      `Excluir a conta ${conta.numero}?`,
                      "Excluir",
                      excluirConta,
                      "Parcelas, rateio e anexos vão junto, e os arquivos saem do armazenamento.",
                    );
                  }}
                />
              </>
            )}
          </MenuDoCabecalho>
        ) : null
      }
    >
      {/*
        ⚠️ FORA do menu da linha e fora das abas: ele precisa continuar montado
        enquanto o seletor de arquivo do sistema esta aberto. Dentro do menu, o
        proprio gesto de escolher a opcao o desmontava. Ver
        `pedirDocumentoDaParcela`.
      */}
      <input
        ref={entradaDaParcela}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          // Limpo para que enviar o MESMO arquivo de novo volte a disparar o
          // evento: sem isso, o segundo envio nao acontece e a tela trava.
          e.target.value = "";
          if (arquivo) void enviarDocumentoDaParcela(arquivo);
        }}
      />

      {erro && (
        /*
          O `Alert` do kit, e nao uma caixa escrita aqui. A que existia
          pintava o TEXTO de `--danger-text` sobre `--danger-bg`, e o
          proprio kit avisa que essa combinacao tem menos contraste que o
          preto do resto da pagina. La quem carrega a gravidade e o icone
          e o cartao.
        */
        <Alert variant="danger" title={erro} />
      )}

      {!conta && !erro && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[70, 90, 55, 100].map((l, i) => (
            <div
              key={i}
              className="sk"
              style={{
                height: 14,
                width: `${l}%`,
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-3)",
              }}
            />
          ))}
        </div>
      )}

      {conta && (
        <>
          {/*
            ⚠️ SEM barra de progresso aqui.

            Ela dizia total e pago em desenho, e logo abaixo os mesmos dois
            numeros aparecem como campo, junto com o em aberto. Era o mesmo dado
            duas vezes, e a versao em barra e a que nao da para copiar nem ler
            com precisao. Quem decide o que fazer com a conta le o "em aberto",
            que a barra nao mostrava.
          */}

          {/*
            ⚠️ O ritmo e o do FORMULARIO, o mesmo da conta a receber e da ficha
            de pessoa: campos colados entre si, e o vao grande so entre um
            assunto e outro. Havia um `gap: 8` escrito aqui, que acertava o vao
            dos campos por acaso e errava o resto.

            ⚠️ Sem titulo nem legenda: o que esta em cima da tabela e a
            identificacao da conta, e ela nao precisa se apresentar. Cada aba tem
            o proprio titulo, que e onde o assunto muda.
          */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--form-gap-campo)",
            }}
          >
            {/*
              ⚠️ O codigo vem PRIMEIRO e e campo com cadeado, como na conta a
              receber. Escrito so no titulo do drawer, ele some quando a pessoa
              rola a tabela, e nao da para copiar.
            */}
            <Field label="Código">
              <CampoBloqueado
                valor={String(conta.numero ?? conta.id)}
                titulo="O número é dado pelo sistema quando a conta nasce, e conta por empresa."
              />
            </Field>

            <Field label="Fornecedor">
              <CampoBloqueado valor={conta.fornecedorNome ?? "—"} />
            </Field>

            {/*
              ⚠️ O documento aparece LOGO ABAIXO do nome, e nao noutra secao.
              Dois fornecedores de nome parecido sao a hora exata em que alguem
              confere o CNPJ, e e a mesma hora em que ele precisa ser copiado.
              Mesma decisao da conta a receber.

              ⚠️ E a DESCRICAO saiu daqui: ela e do LANCAMENTO, e mora na aba
              dele. Repetida no cabecalho, ela dizia o nome de uma linha so
              enquanto a conta pode ter varias.
            */}
            <Field label={ehPessoaFisica(conta.fornecedorDoc) ? "CPF" : "CNPJ"}>
              <CampoBloqueado
                valor={
                  conta.fornecedorDoc
                    ? formatarDocumento(conta.fornecedorDoc)
                    : "—"
                }
              />
            </Field>

            {/*
              ⚠️ "Documento" e o numero da NOTA, e nao o numero da conta. Ele fica
              perto do fornecedor porque e ali que alguem confere se a nota que
              chegou e mesmo a que esta sendo paga.
            */}
            {/*
              ⚠️ Especie e numero num campo SO na leitura, e em dois na escrita.
              Quem le quer "NFS-e 1234" de uma vez; quem digita precisa escolher
              a especie de uma lista para o relatorio por especie fechar depois.
            */}
            <Field label="Documento">
              <CampoBloqueado
                valor={
                  conta.documento
                    ? [conta.tipoDocumentoSigla, conta.documento]
                        .filter(Boolean)
                        .join(" ")
                    : "—"
                }
              />
            </Field>

            <Field label="Emissão">
              <CampoBloqueado
                valor={
                  conta.emissao ? paraFormatoBR(conta.emissao as DataISO) : "—"
                }
              />
            </Field>

            {/*
              ⚠️ O resumo sai do RATEIO, e nao mais de `centroCustoNome`.

              Aquele campo vem da coluna legada `fkCentroCusto`, que so guarda um
              centro e nao e mais escrita: numa conta nova ele viria vazio, e a
              ficha diria "sem centro" para uma conta repartida em dois. Com um
              centro so, o texto e o mesmo de antes; com varios, ele conta quantos
              e manda para a aba.
            */}
            <Field label="Centro de custo">
              <CampoBloqueado
                valor={
                  conta.rateio.length === 0
                    ? "—"
                    : conta.rateio.length === 1
                      ? (conta.rateio[0].centroCustoNome ?? "Sem centro")
                      : `${conta.rateio.length} centros (ver Lançamentos)`
                }
              />
            </Field>

            <Field label="Situação">
              <CampoBloqueado valor={situacao ?? "—"} />
            </Field>

            {/*
              ⚠️ Os tres valores sao CAMPO, um por linha, como na conta a receber.
              No rodape eram numeros soltos com rotulo miudo, e o "em aberto" — que
              e o que decide se ainda ha o que pagar — tinha o mesmo peso do resto.
            */}
            <Field label="Total">
              {/*
                ⚠️ O campo continua o MESMO: mesma caixa, mesmo tamanho, mesmo
                cadeado. O total novo entra DENTRO dele, depois do antigo, no
                cor da marca. Trocado por outro componente, o bloco pulava de
                altura ao entrar em edicao.
              */}
              <CampoBloqueado
                valor={formatarSemSimbolo(conta.total as Centavos)}
                depois={
                  totalPendente != null && totalPendente !== conta.total ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--primary)",
                        fontWeight: "var(--fw-semi)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span aria-hidden>&rsaquo;&rsaquo;</span>
                      {formatarSemSimbolo(totalPendente as Centavos)}
                    </span>
                  ) : undefined
                }
              />
            </Field>

            <Field label="Pago">
              <CampoBloqueado valor={formatarSemSimbolo(pago as Centavos)} />
            </Field>

            <Field label="Em aberto">
              <CampoBloqueado
                valor={formatarSemSimbolo(emAberto as Centavos)}
              />
            </Field>

            {/*
              ⚠️ Aparece SEMPRE, e nao so quando ha texto. Em observacao, o vazio
              tambem e resposta: "ninguem anotou nada". Sumindo, a ficha muda de
              tamanho de conta para conta e quem procura a anotacao nao sabe se
              ela nao existe ou se o campo e que nao existe aqui.

              ⚠️ E ela NAO e bloqueada. Observacao e o unico campo da ficha que
              nao veio do documento: e a anotacao de quem trabalha na conta, e
              ela nasce depois. Travada, obrigaria a abrir outra tela para
              escrever "combinei prorrogar com o fornecedor".
            */}
            <Field
              label="Observações"
              hint={salvandoObs ? "Salvando…" : "Salva ao sair do campo."}
            >
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                /*
                 * Grava ao SAIR do campo, e nao a cada tecla: uma requisicao por
                 * letra faria dezenas de escritas para uma frase, e um `debounce`
                 * ainda gravaria versoes intermediarias que ninguem quis.
                 */
                onBlur={() => void salvarObservacoes()}
                rows={3}
                maxLength={4000}
                placeholder="Anotação de quem trabalha nesta conta"
                style={{
                  ...inputStyle,
                  height: "auto",
                  padding: 8,
                  resize: "vertical",
                }}
              />
            </Field>
          </div>

          {/*
            ⚠️ O vao antes das abas e o dos GRUPOS do formulario. Sem ele, as
            abas encostam no ultimo campo e parecem pertencer a ele; elas comecam
            outro assunto, e o respiro e o que diz isso.
          */}
          <div style={{ marginTop: "var(--form-gap-grupo)" }} />

          <PanelTabs
            /*
              ⚠️ Lancamentos vem PRIMEIRO: e o que a conta e. Parcelas sao como
              ela sera paga, e anexo e o papel dela. A ordem segue a pergunta que
              se faz ao abrir: o que estou pagando, depois quando.
            */
            tabs={[
              `Lançamentos (${conta.lancamentos.length})`,
              `Parcelas (${conta.parcelas.length})`,
              `Anexos (${conta.anexos.length})`,
            ]}
            active={
              aba === "lancamentos"
                ? `Lançamentos (${conta.lancamentos.length})`
                : aba === "parcelas"
                  ? `Parcelas (${conta.parcelas.length})`
                  : `Anexos (${conta.anexos.length})`
            }
            onChange={(t) =>
              setAba(
                t.startsWith("Lançamentos")
                  ? "lancamentos"
                  : t.startsWith("Parcelas")
                    ? "parcelas"
                    : "anexos",
              )
            }
          />

          {aba === "parcelas" ? (
            /*
              ⚠️ O titulo NAO repete o nome da aba: ela ja se chama Parcelas. O
              titulo diz o que aquela lista e para esta conta.
            */
            <GrupoDeCampos
              primeiro
              titulo="Pagamento"
              legenda="Cada parcela vence e é paga por conta própria. A vencida aparece em vermelho, e o menu da linha é onde se dá baixa."
              /*
                ⚠️ Mexer no cronograma sai do `+` do TITULO, e nao do menu de
                cada linha. E a mesma decisao da conta a receber: mudar
                vencimento, dividir o saldo e acrescentar parcela sao o mesmo
                gesto — abrir o cronograma inteiro —, e ele nao pertence a uma
                parcela especifica.

                Fica visivel e travado enquanto o editor nao existe: escondido,
                ninguem descobriria que ele vai existir.
              */
              onIncluir={
                conta.cancelada ? undefined : () => setParcelando(true)
              }
              rotuloIncluir="Mexer no parcelamento"
            >
              {/*
                ⚠️ Mesma anatomia da parcela da conta a RECEBER: bolinha de
                estado colada no numero, conciliado logo depois, e o menu de
                acoes fechando a linha. Sao o mesmo objeto visto dos dois lados
                do caixa, e duas leituras diferentes obrigariam quem trabalha nas
                duas telas a aprender duas vezes.
              */}
              <TableArea minWidth={0}>
                <TableHead>
                  <Th minWidth={54}>#</Th>
                  {/*
                    ⚠️ Conciliado e sobre o EXTRATO, nao sobre a baixa. Dar baixa
                    e dizer "paguei"; conciliar e ter conferido que o dinheiro
                    saiu da conta. Sem esta coluna as duas viram a mesma coisa na
                    leitura, e quem fecha o mes nao ve o que falta bater.
                  */}
                  <Th minWidth={90}>Conciliado</Th>
                  <Th minWidth={110}>Vencimento</Th>
                  <Th minWidth={110}>Valor</Th>
                  <Th minWidth={90}>Documentos</Th>
                  <Th> </Th>
                </TableHead>

                <tbody>
                  {conta.parcelas.length === 0 && (
                    <EmptyRow colSpan={6} message="Nenhuma parcela gerada." />
                  )}

                  {conta.parcelas.map((p) => (
                    <Tr
                      key={p.id}
                      /*
                        ⚠️ Vencida pinta a LINHA toda. A data sozinha em vermelho
                        se perde no meio da tabela, e atraso e o unico estado aqui
                        que pede acao hoje.
                      */
                      /*
                        ⚠️ A cancelada fica APAGADA, e nao escondida. Ela continua
                        contando a história do contrato — doze combinadas, quatro
                        aconteceram — e sumindo da tabela essa história se perde.
                      */
                      style={
                        p.cancelada
                          ? { color: "var(--text-disabled)" }
                          : parcelaVencida(p)
                            ? {
                                background: "var(--danger-bg)",
                                color: "var(--danger-text)",
                              }
                            : undefined
                      }
                    >
                      <Td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <Bolinha parcela={p} />
                          {p.numero}
                        </span>
                      </Td>

                      <Td>
                        <MarcaDeConciliacao
                          conciliado={p.conciliado}
                          cancelada={p.cancelada}
                        />
                      </Td>

                      <Td style={NUM}>
                        {p.vencimento ? (
                          paraFormatoBR(p.vencimento as DataISO)
                        ) : (
                          <span style={{ color: "var(--text-disabled)" }}>
                            —
                          </span>
                        )}
                      </Td>

                      <Td style={NUM}>
                        {formatarSemSimbolo(p.total as Centavos)}

                        {/*
                          ⚠️ Mesma anatomia do desconto logo abaixo: o valor em
                          cima, e o que aconteceu com ele numa segunda linha
                          menor. Era um risco em cima do número, que dizia
                          "isto não vale" sem dizer por quê — e risco some na
                          impressão e para quem enxerga pouco.
                        */}
                        {p.cancelada && (
                          <div
                            title={
                              p.motivoDoCancelamento ??
                              "Não vai mais acontecer: continua na conta como histórico"
                            }
                            style={{
                              marginTop: 1,
                              fontSize: "var(--text-xs)",
                              color: "var(--text-disabled)",
                            }}
                          >
                            cancelada
                          </div>
                        )}

                        {/* Desconto dado na baixa: sem mostrar aqui, a soma das
                            parcelas nao fecha com o total e parece erro de conta. */}
                        {p.desconto > 0 && (
                          <div
                            title={`Desconto de ${formatarSemSimbolo(p.desconto as Centavos)}`}
                            style={{
                              marginTop: 1,
                              fontSize: "var(--text-xs)",
                              color: "var(--debito)",
                            }}
                          >
                            −{formatarSemSimbolo(p.desconto as Centavos)}
                          </div>
                        )}

                        {/*
                          ⚠️ Juros e multa vao AO LADO do valor, e nao somados
                          nele.

                          O valor da parcela e o que se combinou com o
                          fornecedor, e e por ele que se confere o boleto. O que
                          o atraso custou e outra coisa — e a diferenca entre
                          pagar em dia e pagar tarde. Embutido, o numero deixava
                          de bater com o documento e ninguem via quanto o atraso
                          cobrou; ao lado, os dois se leem de uma vez.

                          ⚠️ Os dois num numero so, pelo mesmo motivo: quem olha
                          a coluna quer o quanto, nao a quebra. Ela esta na
                          baixa.
                        */}
                        {p.jurosMulta > 0 && (
                          <div
                            title={`Juros e multa de ${formatarSemSimbolo(p.jurosMulta as Centavos)} pagos por atraso`}
                            /*
                              ⚠️ VERMELHO, e nao verde. Verde aqui leria como
                              dinheiro que entrou; juros e multa sao dinheiro
                              que SAIU a mais do que se devia. Numa conta a
                              pagar todo acrescimo e prejuizo, e a cor precisa
                              dizer isso antes do sinal.
                            */
                            style={{
                              marginTop: 1,
                              fontSize: "var(--text-xs)",
                              color: "var(--debito)",
                            }}
                          >
                            +{formatarSemSimbolo(p.jurosMulta as Centavos)}
                          </div>
                        )}
                      </Td>

                      <Td>
                        <Anexos
                          boleto={p.boleto}
                          nfs={p.nfs}
                          comprovante={p.comprovante}
                        />
                      </Td>

                      <Td>
                        <AcoesDaLinha>
                          <MenuDeLinha>
                            {(fechar) => (
                              <AcoesDaParcela
                                parcela={p}
                                cancelada={conta.cancelada}
                                fechar={fechar}
                                aoBaixar={() => setBaixando(p.id)}
                                aoEditarParcelamento={() => setParcelando(true)}
                                aoAnexar={(tipo) =>
                                  pedirDocumentoDaParcela(p.id, tipo)
                                }
                                aoCancelar={() =>
                                  confirmar(
                                    `Cancelar a parcela ${p.numero}?`,
                                    "Cancelar parcela",
                                    () => void cancelarParcela(p.id),
                                    "Ela deixa de ser cobrada e continua na conta, marcada como cancelada.",
                                  )
                                }
                                aoReativar={() => void reativarParcela(p.id)}
                              />
                            )}
                          </MenuDeLinha>
                        </AcoesDaLinha>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableArea>
            </GrupoDeCampos>
          ) : aba === "lancamentos" ? (
            <LancamentosDaConta
              contaId={conta.id}
              lancamentos={conta.lancamentos}
              total={conta.total}
              /*
                ⚠️ Editavel so enquanto NADA foi pago. Ao primeiro centavo a
                conta vira documento: alguem pagou contra um valor, e mexer no
                total depois faria o comprovante que existe apontar para uma
                divida que mudou de tamanho. O servidor recusa de novo.
              */
              travado={conta.parcelasPagas > 0 || conta.cancelada}
              motivoTravado={
                conta.cancelada
                  ? "Conta cancelada não se edita."
                  : "Esta conta já tem parcela paga. O valor não muda depois do primeiro pagamento."
              }
              aoMudar={setConta}
              aoMudarTotal={setTotalPendente}
            />
          ) : (
            <GrupoDeCampos
              primeiro
              titulo="Arquivos da conta"
              legenda="A nota, o contrato, o comprovante. O link vale por uma hora e é gerado na hora de abrir, e não fica valendo para sempre."
              onIncluir={() => entrada.current?.click()}
            >
              {/*
                ⚠️ O `input` de arquivo fica ESCONDIDO e o gesto sai do `+` do
                titulo, que e onde o resto do sistema cadastra filho. No rodape
                da lista ele desceria junto com o ultimo arquivo, e quem tem oito
                anexos rolaria ate o fim para achar como enviar o nono.
              */}
              <input
                ref={entrada}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  // O valor e limpo para que enviar o MESMO arquivo de novo
                  // volte a disparar o evento: sem isso, o segundo envio nao
                  // acontece e a tela parece travada.
                  e.target.value = "";
                  if (arquivo) void enviarAnexo(arquivo);
                }}
              />

              <TableArea minWidth={0}>
                <TableHead>
                  <Th>Arquivo</Th>
                  <Th minWidth={104}>Enviado</Th>
                  <Th minWidth={70}>Ações</Th>
                </TableHead>

                <tbody>
                  {conta.anexos.length === 0 && (
                    <EmptyRow
                      colSpan={3}
                      message="Nenhum arquivo anexado a esta conta."
                    />
                  )}

                  {conta.anexos.map((a, i) => (
                    <Tr key={a.id} delay={i * 12}>
                      <Td>{a.nome}</Td>
                      <Td style={NUM}>
                        {a.criadoEm
                          ? paraFormatoBR(a.criadoEm.slice(0, 10) as DataISO)
                          : "—"}
                      </Td>
                      <Td>
                        {/*
                          ⚠️ Nao e o `AcoesDaLinha` do kit: ele empurra para a
                          direita, e nesta tabela tudo alinha a esquerda.
                        */}
                        <span style={{ display: "inline-flex", gap: 4 }}>
                          <BotaoDeAcao
                            rotulo="Abrir o arquivo"
                            onClick={() =>
                              window.open(
                                `/api/v1/contas-pagar/${conta.id}/anexos/${a.id}`,
                                "_blank",
                                "noopener",
                              )
                            }
                          >
                            <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8Z" />
                            <circle cx="8" cy="8" r="1.9" />
                          </BotaoDeAcao>
                          <BotaoDeAcao
                            rotulo="Remover o arquivo"
                            onClick={() =>
                              confirmar(
                                `Remover ${a.nome} desta conta?`,
                                "Remover",
                                () => removerAnexo(a.id),
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
        </>
      )}
      {/*
       * ⚠️ Baixar abre o MESMO drawer da tela de baixas, so que ja com o
       * fornecedor escolhido e esta parcela marcada.
       *
       * Uma tela de baixa propria aqui seriam dois lugares para o mesmo fato, e
       * eles divergem: a de baixas ja sabe repartir um pagamento entre contas, e
       * a daqui nunca saberia, porque so enxerga uma. Mesma decisao da conta a
       * receber.
       */}
      {/*
       * O MESMO editor da conta a receber. As regras de quem pode mexer vem de
       * `oQuePodeNaConta`, que ja era compartilhada; o que muda entre os dois
       * lados e texto e a URL do PUT.
       */}
      {parcelando && conta && (
        <EditorDeParcelamento
          url={`/api/v1/contas-pagar/${conta.id}/parcelas`}
          numero={String(conta.numero ?? conta.id)}
          contraparte={conta.fornecedorNome}
          rotuloContraparte="Fornecedor"
          tituloDaConta="Conta a pagar"
          total={conta.total}
          parcelas={conta.parcelas.map((p) => ({
            id: p.id,
            numero: p.numero,
            vencimento: p.vencimento,
            total: p.total,
            pago: p.pago,
            cancelada: p.cancelada,
          }))}
          pode={oQuePodeNaConta({
            cancelada: conta.cancelada,
            parcelas: conta.parcelas.map((p) => ({
              id: p.id,
              numero: p.numero,
              vencimento: (p.vencimento ?? hoje()) as DataISO,
              valor: p.total as Centavos,
              pago: p.pago,
              cancelada: p.cancelada,
            })),
          })}
          onClose={() => setParcelando(false)}
          aoSalvar={() => {
            setParcelando(false);
            recarregar();
          }}
        />
      )}

      {baixando != null && conta && (
        <NovaBaixaDrawer
          fornecedorInicial={{
            id: conta.fornecedorId ?? 0,
            nome: conta.fornecedorNome,
          }}
          parcelaInicial={baixando}
          onClose={() => setBaixando(null)}
        />
      )}
    </Drawer>
  );
}

/**
 * Vencida: passou da data e ainda espera dinheiro.
 *
 * ⚠️ So parcela NAO paga vence. Numa paga a data e historia, e pintar a linha de
 * vermelho encheria a tabela de atraso que ja foi resolvido.
 */
/**
 * ⚠️ Parcela CANCELADA nunca esta vencida.
 *
 * Vencida fala de cobranca atrasada, e a cancelada nao vai ser cobrada. Sem esta
 * condicao, encerrar um contrato pintava de vermelho justamente as parcelas que
 * a pessoa acabou de dizer que nao existem mais.
 */
function parcelaVencida(p: {
  pago: boolean;
  cancelada?: boolean;
  vencimento: string | null;
}): boolean {
  return (
    !p.pago && !p.cancelada && p.vencimento != null && p.vencimento < hoje()
  );
}

/**
 * O estado da parcela num ponto de cor, colado no numero.
 *
 * ⚠️ Conciliada e diferente de paga: paga e "saiu daqui", conciliada e "bateu
 * com o extrato". Mesma leitura da parcela da conta a receber.
 */
function Bolinha({
  parcela,
}: {
  parcela: {
    pago: boolean;
    cancelada?: boolean;
    conciliado: boolean;
    vencimento: string | null;
  };
}) {
  /*
   * ⚠️ Cancelada e testada ANTES de vencida e de "em aberto", e depois de paga.
   *
   * Depois de paga porque dinheiro que saiu manda em qualquer marca; antes das
   * outras duas porque uma parcela que nao vai acontecer nao esta esperando nem
   * atrasada.
   */
  const estado = parcela.conciliado
    ? "Conciliada"
    : parcela.pago
      ? "Paga"
      : parcela.cancelada
        ? "Cancelada"
        : parcelaVencida(parcela)
          ? "Vencida"
          : "Em aberto";

  const cor =
    estado === "Conciliada"
      ? "var(--primary)"
      : estado === "Paga"
        ? "var(--success)"
        : estado === "Vencida"
          ? "var(--danger)"
          : "var(--text-tertiary)";

  return (
    <span
      aria-label={estado}
      title={estado}
      style={{
        width: 8,
        height: 8,
        flexShrink: 0,
        borderRadius: "var(--radius-full)",
        background: cor,
      }}
      className="redondo"
    />
  );
}

/**
 * O menu de acoes de uma parcela a pagar.
 *
 * ⚠️ NAO tem "enviar por e-mail" nem "enviar por WhatsApp", que existem do lado
 * que recebe. La o documento vai PARA o cliente, que precisa dele para pagar.
 * Aqui quem paga e a propria empresa: nao ha a quem enviar, e a nota vem do
 * fornecedor em vez de sair daqui.
 */
function AcoesDaParcela({
  parcela,
  cancelada,
  fechar,
  aoBaixar,
  aoEditarParcelamento,
  aoAnexar,
  aoCancelar,
  aoReativar,
}: {
  parcela: Parcela;
  cancelada: boolean;
  fechar: () => void;
  aoBaixar: () => void;
  aoEditarParcelamento: () => void;
  /**
   * Pede o arquivo e envia — quem faz e o DRAWER.
   *
   * ⚠️ Nao pode ser feito aqui. Este componente so existe enquanto o menu esta
   * aberto, e todo item do menu fecha o menu ao ser escolhido: o `input` que
   * abriria o seletor de arquivo era desmontado no mesmo gesto que devia
   * aciona-lo, e os tres "Anexar" nao faziam nada.
   */
  aoAnexar: (tipo: "nfs" | "boleto" | "comprovante") => void;
  aoCancelar: () => void;
  aoReativar: () => void;
}) {
  function pedirArquivo(qual: "nfs" | "boleto" | "comprovante") {
    /*
      ⚠️ O pedido vem ANTES de fechar. Fechando primeiro, este componente
      desmonta e a chamada seguinte roda em cima do que ja saiu da tela.
    */
    aoAnexar(qual);
    fechar();
  }

  return (
    <>
      <ItemDoMenu
        rotulo="Baixar parcela"
        icone={<IconeSaida />}
        /*
          ⚠️ Baixar mora AQUI, e nao num botao de rodape. O gesto exige saber
          QUAL parcela, e so a linha sabe. No rodape ele nao sabia nenhuma.
        */
        desabilitado={parcela.pago || cancelada}
        motivo={
          parcela.pago
            ? "Esta parcela já está paga"
            : cancelada
              ? "Conta cancelada não recebe baixa"
              : undefined
        }
        onClick={() => {
          fechar();
          aoBaixar();
        }}
      />

      {/*
        ⚠️ Cancelar mora no menu DA LINHA, e não num botão de "encerrar a partir
        de tal data" acima da tabela.

        Aquele decidia por várias parcelas de uma vez, a partir de um corte que a
        tela não mostrava antes de gravar. Aqui a pessoa vê a parcela, cancela
        aquela, e repete quantas vezes quiser — e o que aconteceu está sempre à
        vista, linha a linha.
      */}
      <ItemDoMenu
        rotulo={parcela.cancelada ? "Reativar parcela" : "Cancelar parcela"}
        icone={parcela.cancelada ? <IconeReativar /> : <IconeCancelar />}
        desabilitado={parcela.pago || cancelada}
        motivo={
          parcela.pago
            ? "Parcela paga não se cancela: estorne a baixa antes"
            : cancelada
              ? "Esta conta está cancelada"
              : undefined
        }
        onClick={() => {
          fechar();
          if (parcela.cancelada) aoReativar();
          else aoCancelar();
        }}
      />

      <ItemDoMenu
        rotulo={parcela.nfs ? "Trocar a nota" : "Anexar nota"}
        icone={<IconeNota />}
        desabilitado={cancelada}
        motivo={cancelada ? "Conta cancelada não recebe documento" : undefined}
        onClick={() => pedirArquivo("nfs")}
      />

      <ItemDoMenu
        rotulo={parcela.boleto ? "Trocar o boleto" : "Anexar boleto"}
        icone={<IconeBoleto />}
        desabilitado={cancelada}
        motivo={cancelada ? "Conta cancelada não recebe documento" : undefined}
        onClick={() => pedirArquivo("boleto")}
      />

      {/*
        ⚠️ O comprovante e o documento mais importante deste lado: e a unica
        prova de que o dinheiro saiu, e o que se procura quando o fornecedor
        cobra de novo. Ele nem existia como coluna ate agora.
      */}
      <ItemDoMenu
        rotulo={
          parcela.comprovante ? "Trocar o comprovante" : "Anexar comprovante"
        }
        icone={<IconeComprovante />}
        desabilitado={cancelada}
        motivo={cancelada ? "Conta cancelada não recebe documento" : undefined}
        onClick={() => pedirArquivo("comprovante")}
      />

      {/*
        ⚠️ Imprimir o comprovante ainda nao existe, e aparece TRAVADO em vez de
        ausente: some a opcao e a pessoa procura onde ela foi parar, sem
        descobrir que o sistema ainda nao faz.
      */}
      {/*
        ⚠️ Editar abre o CRONOGRAMA inteiro, e nao um formulario daquela parcela.
        Mudar vencimento, dividir o saldo e acrescentar parcela sao o mesmo
        gesto, e cada um deles mexe no valor das outras — o total esta fixo. Uma
        tela por parcela nao teria como manter a soma fechando.
      */}
      <ItemDoMenu
        rotulo="Editar parcelamento"
        icone={<IconeCalendario />}
        desabilitado={cancelada}
        motivo={cancelada ? "Conta cancelada não se edita" : undefined}
        onClick={() => {
          fechar();
          aoEditarParcelamento();
        }}
      />

      <ItemDoMenu
        rotulo="Imprimir comprovante"
        icone={<IconeImpressora />}
        desabilitado
        motivo="O comprovante em PDF ainda não existe."
        onClick={() => {}}
      />
    </>
  );
}

/*
 * Os icones do menu, na grade de 16 e com traco de 1.5.
 *
 * ⚠️ Todos CONTORNADOS, nenhum preenchido. Num menu, icone cheio pesa mais que o
 * rotulo e o olho passa a ler o desenho antes da palavra — e a palavra e que diz
 * o que vai acontecer. Preenchido fica reservado para marca de estado, onde o
 * desenho E a informacao.
 */
const TRACO = {
  width: 15,
  height: 15,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Seta saindo para uma bandeja: o dinheiro deixando a conta. */
function IconeSaida() {
  return (
    <svg {...TRACO}>
      <path d="M8 9V2" />
      <path d="M5.4 4.6L8 2l2.6 2.6" />
      <path d="M2.8 10v2a1.4 1.4 0 001.4 1.4h7.6A1.4 1.4 0 0013.2 12v-2" />
    </svg>
  );
}

/** Folha com linhas: a nota do fornecedor. */
function IconeNota() {
  return (
    <svg {...TRACO}>
      <path d="M3.5 2.2h6l3 3v8.6h-9z" />
      <path d="M9.5 2.2v3h3" />
      <path d="M5.6 8.6h4.8M5.6 11h3.2" />
    </svg>
  );
}

/** Barras de larguras diferentes: o codigo de barras do boleto. */
function IconeBoleto() {
  return (
    <svg {...TRACO}>
      <path d="M2.6 3.4v9.2M5 3.4v9.2M7.2 3.4v9.2M9.8 3.4v9.2M13.4 3.4v9.2" />
    </svg>
  );
}

/** Folha com visto: a prova de que o dinheiro saiu. */
function IconeComprovante() {
  return (
    <svg {...TRACO}>
      <path d="M3.5 2.2h6l3 3v8.6h-9z" />
      <path d="M9.5 2.2v3h3" />
      <path d="M5.8 9.4l1.5 1.5 2.9-3" />
    </svg>
  );
}

/** Calendario: o cronograma inteiro, que e o que "Editar parcelamento" abre. */
function IconeCalendario() {
  return (
    <svg {...TRACO}>
      <rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.4" />
      <path d="M2.4 6.4h11.2M5.4 2.2v2.4M10.6 2.2v2.4" />
    </svg>
  );
}

/** Impressora, na mesma grade dos outros. */
function IconeImpressora() {
  return (
    <svg {...TRACO}>
      <path d="M4.4 6V2.4h7.2V6" />
      <path d="M4.4 12H3a.9.9 0 01-.9-.9V7.8A1.4 1.4 0 013.5 6.4h9A1.4 1.4 0 0113.9 7.8v3.3a.9.9 0 01-.9.9h-1.4" />
      <rect x="4.4" y="9.6" width="7.2" height="4" rx="0.7" />
    </svg>
  );
}

function Anexos({
  boleto,
  nfs,
  comprovante,
}: {
  boleto: string | null;
  nfs: string | null;
  comprovante: string | null;
}) {
  if (!boleto && !nfs && !comprovante) {
    return <span style={{ color: "var(--text-disabled)" }}>—</span>;
  }

  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {nfs && <Anexo href={nfs} rotulo="NF" />}
      {boleto && <Anexo href={boleto} rotulo="Boleto" />}
      {/* Por ultimo porque e o que aparece por ultimo na vida da parcela: a nota
          chega, o boleto se paga, e o comprovante e a prova do que aconteceu. */}
      {comprovante && <Anexo href={comprovante} rotulo="Comprovante" />}
    </span>
  );
}

function Anexo({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-medium)",
        color: "var(--primary)",
        border: "1px solid var(--primary-border)",
        background: "var(--primary-subtle)",
        borderRadius: "var(--radius-xs)",
        padding: "1px 6px",
      }}
    >
      {rotulo}
    </a>
  );
}

/** Círculo com um corte: existe, e deixou de valer. */
function IconeCancelar() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M4.4 11.6L11.6 4.4" />
    </svg>
  );
}

/** Seta que volta: o que foi cancelado torna a valer. */
function IconeReativar() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8a5 5 0 1 1 1.6 3.7" />
      <path d="M3 4.6V8h3.4" />
    </svg>
  );
}
