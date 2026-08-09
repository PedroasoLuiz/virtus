"use client";

import { useCallback, useEffect, useState } from "react";
import { BotaoDeCabecalho, Drawer } from "@/components/ui/drawer";
import { ExtratoTabela } from "./extrato-tabela";
import { ConciliacaoDrawer } from "./conciliacao-drawer";
import {
  Alert,
  CampoBloqueado,
  Field,
  Formulario,
  GrupoDeCampos,
  inputStyle,
} from "@/components/ui/kit";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { ehDataISO, hoje, somarDias } from "@/shared/utils/datas";
import type { ContaBancaria, Extrato, MovimentoDoExtrato } from "@/modules/contas/contas.types";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";

/**
 * O extrato de uma conta.
 *
 * ⚠️ Marcar como conferido saiu daqui, e volta com gesto proprio.
 *
 * O trilho de cartoes tinha um visto clicavel que aparecia no hover; ele foi
 * embora junto com o trilho. A tabela mostra o estado e nao o edita: conciliar
 * em lote e trabalho de uma tela que sabe casar linha do sistema com linha do
 * banco, e nao de um clique solto no meio da leitura. O `PUT` da rota
 * `/extrato/:pagamentoId` continua no ar esperando por ela.
 *
 * Aberto a partir da conta, e nao de um item de menu: extrato sem conta
 * escolhida e uma pergunta pela metade, e o saldo de abertura so existe em
 * relacao a uma delas.
 *
 * ⚠️ Esta tabela FOGE do padrao das outras telas de proposito.
 *
 * Ela nao e uma listagem de registros: e um documento que a pessoa confere linha
 * a linha contra o papel do banco. O desenho e o do quadro kanban — fundo verde
 * acinzentado servindo de trilho, cartoes brancos correndo por cima — porque ali
 * o branco ja significa "o dado" e o fundo significa "a casca". Aqui vale a
 * mesma leitura: o dia e casca, o lancamento e dado.
 */

/** Primeiro dia do mes corrente. E onde quase toda conferencia comeca. */
function inicioDoMes(): string {
  return `${hoje().slice(0, 7)}-01`;
}

/**
 * Teto do periodo. Espelha o `MAXIMO_DE_DIAS` do servico.
 *
 * Duplicado de proposito, e nao importado: o servico e quem RECUSA, e continua
 * recusando se alguem chamar a rota direto. Aqui o numero so serve para o
 * seletor de data nao oferecer um periodo que vai voltar com erro.
 */
const MAXIMO_DE_DIAS = 186;

/**
 * Limite de data para o seletor. `undefined` quando a outra ponta esta vazia.
 *
 * ⚠️ Passa por `ehDataISO` antes de calcular. O campo `<input type="date">` pode
 * ficar VAZIO — basta o usuario apagar o conteudo —, e ai a conta de calendario
 * recebe string vazia. Sem esta guarda, `Date` invalido derruba a tela inteira
 * no meio do render, com um "Invalid time value" que nao diz de onde veio.
 */
function limite(data: string, dias: number): string | undefined {
  return ehDataISO(data) ? somarDias(data, dias) : undefined;
}

/** Um dia do extrato, com o que fechou nele. */
type Dia = {
  data: string;
  movimentos: MovimentoDoExtrato[];
  /** Saldo depois do ULTIMO movimento do dia. E o numero que o banco imprime. */
  saldoDoDia: Centavos;
};

/**
 * Agrupa por dia, em ordem cronologica.
 *
 * Crescente porque a coluna que importa e o SALDO, e saldo e uma soma que so faz
 * sentido lida para frente: o fecho de cada dia e o do dia anterior mais o que
 * passou. De tras para frente os numeros continuam certos, mas a conta que liga
 * um dia ao outro deixa de ser visivel.
 */
function porDia(movimentos: MovimentoDoExtrato[]): Dia[] {
  const dias = new Map<string, Dia>();

  for (const m of movimentos) {
    const chave = m.data ?? "";
    const dia = dias.get(chave) ?? { data: chave, movimentos: [], saldoDoDia: m.saldoApos };

    dia.movimentos.push(m);
    // O ultimo a passar por aqui e o ultimo do dia, porque a lista chega em
    // ordem cronologica.
    dia.saldoDoDia = m.saldoApos;
    dias.set(chave, dia);
  }

  return [...dias.values()];
}

export function ExtratoDrawer({
  conta,
  empresa,
  emitidoPor,
  onClose,
}: {
  conta: ContaBancaria;
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
  onClose: () => void;
}) {

  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(hoje());
  const [extrato, setExtrato] = useState<Extrato | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conciliando, setConciliando] = useState(false);

  /**
   * Busca o extrato do periodo.
   *
   * ⚠️ Em `useCallback` e nao solta dentro do efeito: a conciliacao precisa
   * chamar a MESMA busca ao fechar, para as marcas de conferido aparecerem sem
   * a pessoa ter de fechar e abrir o extrato de novo. Duplicada, as duas versoes
   * divergiriam no primeiro parametro novo.
   */
  const buscar = useCallback(
    async (signal?: AbortSignal): Promise<Extrato | null> => {
      // Campo de data pela metade nao vira consulta: enquanto a pessoa digita
      // "2026-0", o valor ja chega aqui e voltaria 422 a cada tecla.
      if (!ehDataISO(de) || !ehDataISO(ate)) return null;

      const r = await fetch(`/api/v1/contas/${conta.id}/extrato?de=${de}&ate=${ate}`, { signal });
      const corpo = await r.json();
      if (!r.ok) throw new Error(corpo?.error?.message ?? "Falha ao carregar o extrato");

      return corpo.data as Extrato;
    },
    [conta.id, de, ate],
  );

  useEffect(() => {
    const controle = new AbortController();

    buscar(controle.signal)
      .then((dados) => {
        if (dados) setExtrato(dados);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") {
          setErro(e.message);
          setExtrato(null);
        }
      });

    return () => controle.abort();
  }, [buscar]);

  /**
   * Emite o extrato em PDF.
   *
   * ⚠️ O gerador entra por `import()` e nao no topo do arquivo. O jsPDF e o
   * autotable pesam algumas centenas de kB, e carrega-los junto com a tela faria
   * quem so quer CONFERIR o extrato pagar o custo de imprimir. E o mesmo caminho
   * que o ticket e o recibo ja usam.
   */
  async function imprimir() {
    if (!extrato) return;

    const { imprimirExtrato } = await import("./pdf-extrato");
    await imprimirExtrato(conta, extrato, empresa, emitidoPor);
  }

  const dias = extrato ? porDia(extrato.movimentos) : [];
  const pendentes = extrato?.movimentos.filter((m) => !m.conciliado).length ?? 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title="Extrato bancário"
      /*
        ⚠️ `headerExtra` poe o botao a ESQUERDA do X, e nao em `acoes`.

        Imprimir nao e a acao principal desta tela — a principal e conferir linha
        a linha —, e em `acoes` ele ganharia o peso do botao primario que os
        outros drawers usam para salvar. Ao lado do fechar, ele le como uma
        ferramenta da janela, que e o que ele e.
      */
      headerExtra={
        <>
        {/*
          ⚠️ Conciliar vem ANTES de imprimir, indo da esquerda para a direita.

          A ordem e a do trabalho: primeiro se confere contra o banco, depois se
          imprime o que ficou conferido. Invertida, o botao de papel apareceria
          primeiro numa tela cuja razao de existir e a conferencia.
        */}
        <BotaoDeCabecalho
          rotulo={
            extrato
              ? "Conciliar este extrato com o arquivo do banco"
              : "Escolha um período para poder conciliar"
          }
          desabilitado={!extrato}
          onClick={() => setConciliando(true)}
        >
          {/* Duas setas que se encontram: as duas listas virando uma. */}
          <path d="M4 8h13l-3-3" />
          <path d="M20 16H7l3 3" />
        </BotaoDeCabecalho>

        <BotaoDeCabecalho
          rotulo={
            extrato
              ? "Imprimir este extrato em PDF"
              : "Escolha um período para poder imprimir"
          }
          desabilitado={!extrato}
          onClick={() => void imprimir()}
        >
          {/* Impressora: papel saindo por cima, corpo no meio, bandeja embaixo.
              Desenhada na grade de 24, que é o `viewBox` do botão de cabeçalho. */}
          <path d="M7 8V4h10v4" />
          <path d="M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
          <path d="M7 14h10v6H7z" />
        </BotaoDeCabecalho>
        </>
      }
    >
      {/*
        ⚠️ A anatomia e a do resto do sistema: `Formulario` e `GrupoDeCampos`,
        com o vao vindo do token. Havia um `div` com `gap: 3` e margem de 18
        escritos a mao, que acertavam o ritmo dos campos por coincidencia.
      */}
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="A conta"
          legenda="De onde este extrato sai, quanto há na conta hoje, e o recorte que os lançamentos abaixo respeitam."
        >
          {/*
            ⚠️ Banco e agencia entraram na DICA, e nao em campos proprios.

            Eles nao se consultam: quem abre o extrato ja sabe de que conta ele
            e — escolheu a linha para chegar aqui. Sao dado de conferencia, e so
            valem no momento em que alguem compara com o papel do banco. Como
            campo, ocupavam duas linhas no topo de toda abertura para responder
            uma pergunta que quase nunca se faz.

            ⚠️ E "Saldo atual" saiu de vez. Ele obrigava a listagem a calcular o
            saldo de todas as contas para a tela abrir, e este drawer ja mostra
            abertura, entradas, saidas e fecho do periodo logo abaixo — que sao
            os numeros que se confere aqui.
          */}
          <Field
            label="Conta"
            hint={[
              conta.banco?.trim() ? `Banco ${conta.banco.trim()}` : null,
              conta.agencia?.trim() ? `agência ${conta.agencia.trim()}` : null,
              conta.conta?.trim() ? `conta ${conta.conta.trim()}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            <CampoBloqueado valor={conta.apelido?.trim() || conta.nome} />
          </Field>

          {/*
            ⚠️ O saldo vem do EXTRATO, e nao da conta que a listagem entregou.

            A listagem parou de calcular saldo — `vwsaldo` varre `pagamentos`
            inteiro a cada chamada —, entao `conta.saldo` chega nulo aqui. O
            extrato traz o numero de graca: para responder, ele ja busca a conta
            por id, e essa leitura ja calcula o saldo de UMA conta so.

            ⚠️ E o saldo de HOJE, nao o do periodo. Por isso ele fica no bloco da
            conta e nao no do periodo: trocar as datas ali embaixo nao o move.
          */}
          <Field
            label="Saldo atual"
            hint="Saldo de hoje, somando todo o histórico. Não depende do período consultado abaixo."
          >
            <CampoBloqueado
              valor={extrato ? formatarSemSimbolo(extrato.saldoAtual) : "—"}
            />
          </Field>

          {/*
            ⚠️ O periodo fica no MESMO grupo, logo abaixo do saldo.

            Ele teve titulo e legenda proprios enquanto somava entradas, saidas e
            fecho — havia um bloco para introduzir. Sem os tres, sobrou um
            cabecalho de secao para um campo de data: dois niveis de titulo para
            uma pergunta. O grupo aqui em cima ja diz de que trata a tela.
          */}
          <Field label="Período" hint="Até seis meses por consulta.">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* O próprio seletor já não oferece período maior que o teto. */}
              <input
                type="date"
                value={de}
                min={limite(ate, -MAXIMO_DE_DIAS)}
                max={ate || undefined}
                onChange={(e) => setDe(e.target.value)}
                style={{ ...inputStyle, width: 150 }}
              />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                até
              </span>
              <input
                type="date"
                value={ate}
                min={de || undefined}
                max={limite(de, MAXIMO_DE_DIAS)}
                onChange={(e) => setAte(e.target.value)}
                style={{ ...inputStyle, width: 150 }}
              />
            </div>
          </Field>
        </GrupoDeCampos>
      </Formulario>

      {erro && (
        /*
          ⚠️ O `Alert` do kit, e nao uma caixa escrita aqui.

          A que existia pintava o TEXTO de `--danger-text` sobre `--danger-bg` —
          e o proprio comentario do kit avisa que essa combinacao tem menos
          contraste que o preto do resto da pagina. No kit, quem carrega a
          gravidade e o icone e o cartao; o texto fica legivel.

          ⚠️ E o tom e `warning`, e nao `danger` como nos drawers que salvam.

          Aqui a falha quase sempre e o limite de seis meses da consulta: nao ha
          estrago, ha uma regra, e os campos de data que resolvem estao logo
          acima. Vermelho anunciaria prejuizo onde so falta ajustar um intervalo.
          Onde o erro e de gravacao, o vermelho fica.
        */
        <div style={{ marginTop: "var(--form-gap-grupo)" }}>
          <Alert variant="warning" title={erro} />
        </div>
      )}

      {extrato && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              // O vao de GRUPO, e nao o de campo: os lancamentos sao outro
              // assunto, e nao a continuacao do periodo consultado acima.
              marginTop: "var(--form-gap-grupo)",
              marginBottom: 8,
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-medium)",
              color: "var(--text-tertiary)",
            }}
          >
            <span>Lançamentos</span>
            <span style={{ flex: 1 }} />
            {pendentes > 0 && (
              <span style={{ fontSize: "var(--text-xs)" }}>
                {pendentes} por conferir
              </span>
            )}
          </div>

          <ExtratoTabela dias={dias} saldoAnterior={extrato.saldoInicial} de={extrato.de} />
        </>
      )}
      {/*
        A conciliacao abre em cima, no nivel 2, e devolve se mexeu em alguma
        coisa: mexendo, o extrato atras recarrega para as marcas de conferido
        aparecerem sem a pessoa precisar fechar e abrir de novo.
      */}
      {conciliando && (
        <ConciliacaoDrawer
          conta={conta}
          de={de}
          ate={ate}
          aoFechar={(mudou) => {
            setConciliando(false);
            // Mexeu na conciliacao: o extrato atras recarrega para as marcas de
            // conferido aparecerem sem a pessoa fechar e abrir de novo.
            if (mudou) buscar().then((d) => d && setExtrato(d)).catch(() => {});
          }}
        />
      )}
    </Drawer>
  );
}

// ── Peças ───────────────────────────────────────────────────────────────────

/**
 * O visto de conferido, à direita do nome.
 *
 * Só aparece quando a linha FOI conferida: em repouso, o extrato mostra o que
 * está resolvido, e uma caixa vazia em cada uma das trinta linhas transformava a
 * lista num formulário.
 *
 * Com o ponteiro em cima da linha ele surge apagado, e é assim que o gesto se
 * descobre — inclusive o de desmarcar, porque conciliar é afirmar "eu vi isso na
 * conta", e ver errado acontece.
 */
