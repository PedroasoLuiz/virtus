"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Field, PageHeader, PageLayout, Panel, inputStyle, selectStyle } from "@/components/ui/kit";
import { Drawer } from "@/components/ui/drawer";
import { ehDataISO, hoje, type DataISO } from "@/shared/utils/datas";
import type { LadoDoRelatorio, Relatorio } from "@/modules/relatorios/relatorios.types";
import type { Dre } from "@/modules/dre/dre.types";
import type { ProjecaoDeCaixa } from "@/modules/fluxo-caixa/fluxo-caixa.types";
import type { EmpresaParaDocumento } from "@/modules/empresa/empresa.repository";
import { OpcoesDoFluxo } from "./opcoes-do-fluxo";

/**
 * A pasta de relatorios.
 *
 * ⚠️ Uma LISTA de documentos, e nao uma tela de analise.
 *
 * A DRE e o fluxo de caixa eram telas proprias, cada uma com indicador, grafico
 * e grade — e as tres viviam soltas dentro de "Analitico", que era um nome que
 * nao dizia o que se ganhava clicando. Elas tem uma coisa em comum e so uma: sao
 * DOCUMENTOS que se emite para um periodo. Reunidas aqui, o menu perdeu um nivel
 * inteiro e a pergunta "onde tiro o relatorio de X" passou a ter um lugar so.
 *
 * ⚠️ Sem numero, sem grafico e sem contagem nesta tela. Um total aqui seria o
 * resultado de um periodo que ninguem escolheu ainda: ele estaria certo por
 * acaso, e o gesto desta tela e escolher, nao conferir.
 *
 * ⚠️ Cada documento sai de uma consulta NOVA, com os parametros do momento. Nada
 * e carregado ao abrir a pasta: quem entra aqui vem escolher qual relatorio
 * quer, e carregar os quatro para mostrar uma grade de icones seria pagar quatro
 * consultas para nao usar nenhuma.
 */
export function RelatoriosTela({
  empresa,
  emitidoPor,
}: {
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
}) {
  const [aberto, setAberto] = useState<Documento | null>(null);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Relatórios" />

        {/*
          O cartao branco ocupa a area inteira, como a moldura de uma tabela: e o
          mesmo material, e esta tela e a listagem de uma pasta.
        */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            margin: "0 var(--vao-da-pagina) var(--vao-da-pagina)",
            padding: 20,
            overflowY: "auto",
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div
            style={{
              display: "grid",
              /* Colunas que se ajustam a largura, como um gerenciador de
                 arquivos: em tela estreita cabem tres, em tela larga oito. */
              gridTemplateColumns: "repeat(auto-fill, minmax(124px, 1fr))",
              gap: 8,
            }}
          >
            {DOCUMENTOS.map((doc) => (
              <CartaoDeDocumento key={doc.id} doc={doc} onClick={() => setAberto(doc)} />
            ))}
          </div>
        </div>
      </Panel>

      {aberto?.id === "receber" && (
        <ParametrosDeParcelas
          lado="receber"
          empresa={empresa}
          emitidoPor={emitidoPor}
          onClose={() => setAberto(null)}
        />
      )}

      {aberto?.id === "pagar" && (
        <ParametrosDeParcelas
          lado="pagar"
          empresa={empresa}
          emitidoPor={emitidoPor}
          onClose={() => setAberto(null)}
        />
      )}

      {aberto?.id === "dre" && (
        <ParametrosDaDre empresa={empresa} emitidoPor={emitidoPor} onClose={() => setAberto(null)} />
      )}

      {aberto?.id === "fluxo" && (
        <ParametrosDoFluxo
          empresa={empresa}
          emitidoPor={emitidoPor}
          onClose={() => setAberto(null)}
        />
      )}
    </PageLayout>
  );
}

type Documento = {
  id: "receber" | "pagar" | "dre" | "fluxo";
  nome: string;
  /** O que ele responde. Aparece na dica, e nao embaixo do nome. */
  sobre: string;
  icone: React.ReactNode;
};

/**
 * ⚠️ A ORDEM e a do ciclo do dinheiro, e nao alfabetica: o que entra, o que sai,
 * o resultado dos dois, e o que ainda vai acontecer. Quem procura pelo nome usa
 * a busca do topo; quem esta olhando a pasta le uma historia.
 */
const DOCUMENTOS: Documento[] = [
  {
    id: "receber",
    nome: "Contas a receber",
    sobre: "Parcelas a receber no período, mês a mês, com o que já venceu.",
    icone: <IconeDocumento tom="entra" />,
  },
  {
    id: "pagar",
    nome: "Contas a pagar",
    sobre: "Parcelas a pagar no período, mês a mês, com o que já venceu.",
    icone: <IconeDocumento tom="sai" />,
  },
  {
    id: "dre",
    nome: "DRE",
    sobre: "Receitas e despesas por centro de custo, mês a mês, no ano escolhido.",
    icone: <IconeDocumento tom="grade" />,
  },
  {
    id: "fluxo",
    nome: "Fluxo de caixa",
    sobre: "A projeção do saldo daqui para a frente, partindo das contas.",
    icone: <IconeDocumento tom="curva" />,
  },
];

/**
 * Um documento na pasta: icone grande, nome embaixo.
 *
 * ⚠️ Nome EMBAIXO do icone, e nao ao lado. E a forma que gerenciador de arquivo
 * usa desde sempre, e ela existe porque o icone e o que se reconhece de longe:
 * ao lado, ele viraria um marcador de lista e a coluna de nomes e que faria o
 * trabalho — que e o que uma tabela ja faz melhor.
 */
function CartaoDeDocumento({ doc, onClick }: { doc: Documento; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={doc.sobre}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "16px 8px 14px",
        border: "none",
        borderRadius: "var(--radius-md)",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "var(--font)",
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {doc.icone}
      <span
        style={{
          fontSize: "var(--text-base)",
          color: "var(--text-primary)",
          textAlign: "center",
          lineHeight: "var(--lh-snug)",
        }}
      >
        {doc.nome}
      </span>
    </button>
  );
}

/**
 * A folha de papel, com uma marca dentro que diz de que assunto ela e.
 *
 * ⚠️ A MESMA folha para os quatro, mudando so o miolo. Quatro desenhos
 * diferentes fariam a pasta parecer ter quatro tipos de coisa; sao todos o mesmo
 * tipo — um documento que se emite —, e o que muda e o conteudo.
 */
function IconeDocumento({ tom }: { tom: "entra" | "sai" | "grade" | "curva" }) {
  const miolo = {
    entra: <path d="M17 30v-9M17 21l-3 3M17 21l3 3" />,
    sai: <path d="M17 21v9M17 30l-3-3M17 30l3-3" />,
    grade: <path d="M11 22h12M11 26h12M11 30h12" />,
    curva: <path d="M11 30l4-5 3 3 5-7" />,
  }[tom];

  return (
    <svg width="46" height="46" viewBox="0 0 34 44" fill="none" aria-hidden>
      {/* A folha, com a orelha dobrada. Preenchida no tom mais fraco da marca:
          vazada, ela some contra o branco do cartao. */}
      <path
        d="M4 3.5h16L30 13v27.5H4z"
        fill="var(--primary-subtle)"
        stroke="var(--primary)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M20 3.5V13h10" stroke="var(--primary)" strokeWidth="1.6" strokeLinejoin="round" />
      <g stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {miolo}
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Os parametros de cada documento
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Contas a receber e a pagar.
 *
 * ⚠️ Um componente para os dois lados. Eles sao o mesmo documento visto das duas
 * pontas — mesmo periodo, mesmo agrupamento por mes, mesma coluna de vencido —, e
 * dois arquivos divergiriam na primeira correcao.
 */
function ParametrosDeParcelas({
  lado,
  empresa,
  emitidoPor,
  onClose,
}: {
  lado: LadoDoRelatorio;
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
  onClose: () => void;
}) {
  const [de, ate] = mesCorrente();
  const [inicio, setInicio] = useState<string>(de);
  const [fim, setFim] = useState<string>(ate);
  const [comCartao, setComCartao] = useState(false);

  const recebe = lado === "receber";

  return (
    <Emissao
      titulo={recebe ? "Contas a receber" : "Contas a pagar"}
      onClose={onClose}
      podeEmitir={ehDataISO(inicio) && ehDataISO(fim)}
      emitir={async () => {
        const params = new URLSearchParams({ lado, de: inicio, ate: fim });
        if (comCartao) params.set("cartao", "true");

        const dados = await buscar<Relatorio>(`/api/v1/relatorios/parcelas?${params}`);
        const { imprimirParcelas } = await import("./pdf-parcelas");
        await imprimirParcelas(dados, empresa, emitidoPor);
      }}
    >
      <Field label="De">
        <input
          type="date"
          style={{ ...inputStyle, width: 160 }}
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
        />
      </Field>

      <Field label="Até">
        <input
          type="date"
          style={{ ...inputStyle, width: 160 }}
          value={fim}
          onChange={(e) => setFim(e.target.value)}
        />
      </Field>

      {/* So o lado que PAGA tem fatura de cartao: do lado que recebe, cartao e
          forma de recebimento e ja entra pela parcela. */}
      {!recebe && (
        <Field label="Cartão de crédito" hint="Inclui os ciclos de fatura no documento.">
          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={comCartao}
              onChange={(e) => setComCartao(e.target.checked)}
            />
            <span style={{ fontSize: "var(--text-base)" }}>Incluir os ciclos de fatura</span>
          </label>
        </Field>
      )}
    </Emissao>
  );
}

/** A DRE, por exercício. */
function ParametrosDaDre({
  empresa,
  emitidoPor,
  onClose,
}: {
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
  onClose: () => void;
}) {
  const anoCorrente = Number(hoje().slice(0, 4));
  const [ano, setAno] = useState(anoCorrente);

  return (
    <Emissao
      titulo="DRE"
      onClose={onClose}
      podeEmitir
      emitir={async () => {
        const dados = await buscar<Dre>(`/api/v1/relatorios/dre?ano=${ano}`);
        const { imprimirDre } = await import("./pdf-dre");
        await imprimirDre(dados, empresa, emitidoPor);
      }}
    >
      <Field label="Exercício">
        <select
          style={{ ...selectStyle, width: 120 }}
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
        >
          {/* Cinco anos para tras: e o que a base cobre. */}
          {Array.from({ length: 5 }, (_, i) => anoCorrente - i).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Field>
    </Emissao>
  );
}

/**
 * O fluxo de caixa.
 *
 * ⚠️ Este NAO usa o `Emissao` dos outros: as opcoes dele sao uma tela inteira
 * (quais contas, com ou sem os meses vencidos, e o saldo de partida que muda
 * conforme a escolha), e essa peca ja existe pronta em `OpcoesDoFluxo`.
 *
 * ⚠️ Ele carrega a projecao ANTES de abrir as opcoes, porque a lista de contas e
 * o saldo de cada uma sao o que se escolhe la dentro. Sem isso, o drawer abriria
 * com um vazio pedindo para a pessoa escolher entre nada.
 */
function ParametrosDoFluxo({
  empresa,
  emitidoPor,
  onClose,
}: {
  empresa: EmpresaParaDocumento;
  emitidoPor: string;
  onClose: () => void;
}) {
  const [contas, setContas] = useState<ProjecaoDeCaixa["contas"] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const horizonte = daquiAUmAno();

  useEffect(() => {
    let vivo = true;

    void buscar<ProjecaoDeCaixa>(`/api/v1/relatorios/fluxo-caixa?ate=${horizonte}`)
      .then((p) => vivo && setContas(p.contas))
      .catch((e: Error) => vivo && setErro(e.message));

    return () => {
      vivo = false;
    };
    /* O horizonte inicial nao muda enquanto a gaveta esta aberta: quem o move e
       o campo de dentro do `OpcoesDoFluxo`, e ele refaz a consulta na hora de
       emitir. Buscar de novo aqui a cada digito da data seria uma consulta por
       tecla para atualizar uma lista de contas que nao depende dela. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (erro) {
    return (
      <Drawer open onClose={onClose} title="Fluxo de caixa">
        <Alert variant="warning">{erro}</Alert>
      </Drawer>
    );
  }

  if (!contas) {
    return (
      <Drawer open onClose={onClose} title="Fluxo de caixa">
        <p style={{ fontSize: "var(--text-md)", color: "var(--text-tertiary)" }}>
          Carregando as contas…
        </p>
      </Drawer>
    );
  }

  return (
    <OpcoesDoFluxo
      contas={contas}
      ateInicial={horizonte}
      onClose={onClose}
      aoGerar={async (projecao) => {
        const { imprimirFluxo } = await import("./pdf-fluxo");
        await imprimirFluxo(projecao, empresa, emitidoPor);
      }}
    />
  );
}

/**
 * A moldura de todo documento: os parametros, e o botao que emite.
 *
 * ⚠️ O erro aparece AQUI dentro, e nao como aviso de canto de tela. A gaveta
 * continua aberta com o que a pessoa escolheu, entao ela corrige a data e tenta
 * de novo — um aviso que some levaria junto a unica pista do que deu errado.
 */
function Emissao({
  titulo,
  podeEmitir,
  emitir,
  onClose,
  children,
}: {
  titulo: string;
  podeEmitir: boolean;
  emitir: () => Promise<void>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setEmitindo(true);
    setErro(null);

    try {
      await emitir();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível emitir o documento.");
    } finally {
      setEmitindo(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={titulo}
      footer={
        <Button variant="primary" disabled={!podeEmitir || emitindo} onClick={() => void gerar()}>
          {emitindo ? "Emitindo…" : "Emitir PDF"}
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--form-gap-campo)" }}>
        {erro && <Alert variant="warning">{erro}</Alert>}
        {children}
        {/* O aviso existe para o caso de o PDF abrir em outra aba e o navegador
            engolir: sem ele, o clique parece não ter feito nada. */}
        <p style={{ margin: "10px 0 0", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
          O documento abre numa aba nova, pronto para imprimir ou salvar.
        </p>
      </div>
    </Drawer>
  );
}

/** Uma consulta da API, com o erro do servidor virando exceção legível. */
async function buscar<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const corpo = await r.json().catch(() => null);

  if (!r.ok) {
    throw new Error(corpo?.error?.message ?? "Não foi possível carregar os dados.");
  }
  return corpo.data as T;
}

/**
 * Primeiro e ultimo dia do mes de hoje.
 *
 * ⚠️ O padrao e o MES CORRENTE, e nao "de hoje em diante". O relatorio serve
 * para fechar o mes: o que venceu na primeira quinzena e continua em aberto e
 * justamente o que se veio cobrar, e um periodo comecando hoje o esconderia.
 */
function mesCorrente(): [DataISO, DataISO] {
  const [ano, mes] = hoje().split("-").map(Number);

  /* Dia zero do mes SEGUINTE e o ultimo dia deste: evita a tabela de quantos
     dias tem cada mes, e acerta fevereiro bissexto sozinho. */
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const doisDigitos = String(mes).padStart(2, "0");

  return [
    `${ano}-${doisDigitos}-01` as DataISO,
    `${ano}-${doisDigitos}-${String(ultimo).padStart(2, "0")}` as DataISO,
  ];
}

function daquiAUmAno(): DataISO {
  const [ano, mes, dia] = hoje().split("-");
  return `${Number(ano) + 1}-${mes}-${dia}` as DataISO;
}
