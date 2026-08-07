"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PrecisaDeAjuda } from "@/components/ui/ajuda";
import { comFormatacaoDoWhatsapp } from "@/components/whatsapp/formatacao";
import {
  CabecalhoDeSecao,
  EmptyRow,
  Pagination,
  PanelTabs,
  SkeletonRows,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  selectStyle,
} from "@/components/ui/kit";
import { formatarTelefone, type ContaWhatsapp, type Modelo } from "@/modules/whatsapp/whatsapp.types";
import type { VinculoDeModelo } from "@/modules/whatsapp/finalidades";
import { Finalidades } from "./finalidades";

/**
 * Os modelos que a Meta ja aprovou, por numero.
 *
 * ⚠️ Lidos da Meta, e nao do nosso banco. O status muda no painel dela sem
 * aviso: um modelo aprovado ontem volta para revisao quando alguem o edita, e
 * uma copia nossa mostraria "aprovado" ate alguem tropecar no erro de envio.
 */

const POR_PAGINA = 10;

/*
 * Duas sub-abas, na ordem em que se pensa.
 *
 * "Sistema" e o que o VPAY envia e por qual modelo; "Externo" e o catalogo que a
 * Meta aprovou para aquele numero. Empilhadas numa tela so, o inventario abria a
 * pagina e a pessoa lia um catalogo antes de saber para que ele serve.
 */
const SUB_SISTEMA = "Sistema";
const SUB_EXTERNO = "Externo";

export function AbaDeModelos({
  contas,
  cache,
  onCarregou,
}: {
  contas: ContaWhatsapp[];
  /** Ja lidos da Meta nesta abertura do painel, por conta. */
  cache: Record<number, Modelo[]>;
  onCarregou: (contaId: number, modelos: Modelo[]) => void;
}) {
  const ativas = useMemo(() => contas.filter((c) => c.ativo && c.temToken), [contas]);
  const [contaId, setContaId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [pagina, setPagina] = useState(1);
  /** O UNICO cartao de previa da tela. Nulo enquanto o mouse nao chega. */
  const [espiando, setEspiando] = useState<Espiada | null>(null);
  const [vinculos, setVinculos] = useState<VinculoDeModelo[] | null>(null);
  const [sub, setSub] = useState(SUB_SISTEMA);

  const escolhida = contaId ?? ativas[0]?.id ?? null;
  const todos = escolhida == null ? null : (cache[escolhida] ?? null);

  const totalPaginas = Math.max(1, Math.ceil((todos?.length ?? 0) / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const modelos =
    todos?.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA) ?? null;

  useEffect(() => {
    /*
     * ⚠️ Ja lido nesta abertura, nao pergunta de novo.
     *
     * Esta consulta sai para a META, nao para o nosso banco, e o componente
     * monta e desmonta a cada troca de aba: sem o cache, ir e voltar entre
     * "Modelos" e "Números" gastava uma chamada externa por vez. Num SaaS isso
     * multiplica por usuario e por sessao.
     */
    if (escolhida == null || cache[escolhida]) return;

    const controle = new AbortController();

    /*
     * Adiado por um tique: limpar a lista de forma sincrona dentro do efeito
     * encadeia um render extra so para mostrar "carregando" por um quadro.
     */
    const t = setTimeout(() => setErro(null), 0);

    fetch(`/api/v1/whatsapp/modelos?contaId=${escolhida}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null);
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Não foi possível ler os modelos");
        onCarregou(escolhida, corpo.data ?? []);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Falha aparece: silenciada, a lista vazia mentiria dizendo que a
        // empresa nao tem modelo nenhum.
        setErro(e instanceof Error ? e.message : "Não foi possível ler os modelos");
        onCarregou(escolhida, []);
      });

    return () => {
      clearTimeout(t);
      controle.abort();
    };
    /*
     * ⚠️ `escolhida` e a UNICA dependencia, de proposito.
     *
     * Esta consulta sai para a Meta, nao para o nosso banco: trocar de aba e
     * voltar disparava uma chamada externa a cada vez. O componente monta e
     * desmonta com a aba, entao o cache vive um nivel acima, em `modelosPorConta`.
     */
  }, [escolhida, cache, onCarregou]);

  /*
   * Os vinculos saem do NOSSO banco, e por isso vem num efeito proprio.
   *
   * Junta-los a leitura dos modelos amarraria uma consulta barata ao cache da
   * chamada externa: salvar um vinculo precisaria invalidar a lista da Meta
   * junto, e ai cada gravacao gastaria uma ida ate la sem necessidade.
   */
  const carregarVinculos = useCallback(async () => {
    const r = await fetch("/api/v1/whatsapp/vinculos");
    const corpo = await r.json().catch(() => null);

    setVinculos(r.ok ? (corpo?.data ?? []) : []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void carregarVinculos(), 0);

    return () => clearTimeout(t);
  }, [carregarVinculos]);

  if (ativas.length === 0) {
    return (
      <EmptyRow
        colSpan={1}
        message="Cadastre um número ativo com token para ver os modelos aprovados."
      />
    );
  }

  return (
    <>
      <CabecalhoDeSecao
        colado
        titulo="Modelos"
        legenda="Modelo é da conta da Meta, e por isso pertence a um número: dois números em WABAs diferentes têm listas diferentes. Escolha de qual número você está falando e depois o que fazer com os modelos dele."
      />

      {/*
        ⚠️ Sistema PRIMEIRO, e não a lista de aprovados.

        A pergunta que traz alguém aqui é "o que o sistema envia, e por qual
        modelo" — a lista da Meta é o inventário que responde à segunda metade
        dela. Ela abrindo a tela fazia a pessoa ler um catálogo antes de saber
        para que ele serve.
      */}
      <PanelTabs
        tabs={[SUB_SISTEMA, SUB_EXTERNO]}
        active={sub}
        onChange={(t) => setSub(t as typeof SUB_SISTEMA)}
      />

      {sub === SUB_SISTEMA && (
        <Finalidades contas={ativas} vinculos={vinculos} onMudou={() => void carregarVinculos()} />
      )}

      {sub === SUB_EXTERNO && (
        <>
          <CabecalhoDeSecao
            colado
            titulo="Modelos aprovados"
            legenda="Lidos da Meta agora, porque o status muda lá sem aviso. Só modelo aprovado pode ser enviado, e é ele que permite falar com quem não escreve há mais de 24 horas. Para criar ou editar, use o painel da Meta."
          />

      {/*
        ⚠️ Aparece SEMPRE, mesmo com um número só.

        Escondido quando havia um, a tabela dizia "modelos aprovados" sem dizer
        de quem — e modelo é da conta da Meta, não da empresa. Com dois números
        em WABAs diferentes, as listas são outras, e quem viu a tela sem seletor
        não tem motivo para desconfiar disso. Visível, ele é o rótulo do que
        está logo abaixo.

        Estreito e à esquerda, colado na tabela: é um filtro do que vem a
        seguir, não um campo de formulário.
      */}
      <div style={{ marginBottom: 26 }}>
        <select
          value={escolhida ?? ""}
          onChange={(e) => {
            setContaId(Number(e.target.value));
            // Página 1: a 3 de um número não corresponde à 3 do outro.
            setPagina(1);
          }}
          aria-label="Número"
          style={{ ...selectStyle, width: "auto", minWidth: 180, maxWidth: "100%" }}
        >
          {ativas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.apelido || formatarTelefone(c.numero ?? "")}
            </option>
          ))}
        </select>
      </div>



          {erro && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--danger)", marginBottom: 12 }}>
              {erro}
            </p>
          )}

        <TableArea minWidth={0}>
          <TableHead>
            <Th>Nome</Th>
            <Th>Categoria</Th>
            <Th>Idioma</Th>
            <Th>Variáveis</Th>
          </TableHead>

          <tbody>
            {modelos == null ? (
              <SkeletonRows
                cols={4}
                rows={3}
                labels={["Nome", "Categoria", "Idioma", "Variáveis"]}
              />
            ) : modelos.length === 0 ? (
              <EmptyRow colSpan={4} message="Nenhum modelo aprovado neste número." />
            ) : (
              modelos.map((m) => (
                <Tr key={`${m.nome}-${m.idioma}`}>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: "var(--fw-semi)" }}>{m.nome}</span>

                      {/*
                        O corpo atras de um olho, e nao desenhado em toda linha.

                        Vinte modelos eram vinte bolhas montadas de uma vez, com
                        o negrito reprocessado em cada uma, para ler no maximo
                        uma. Aqui existe UM cartao, montado quando o mouse chega.
                      */}
                      <BotaoDeEspiar corpo={m.corpo} nome={m.nome} onEspiar={setEspiando} />
                    </div>
                  </Td>
                  <Td>{m.categoria.toLowerCase()}</Td>
                  <Td>{m.idioma}</Td>
                  <Td>{m.parametros}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableArea>

        {(todos?.length ?? 0) > POR_PAGINA && (

          <Pagination

            page={paginaAtual}

            totalPages={totalPaginas}

            total={todos?.length ?? 0}

            pageSize={POR_PAGINA}

            onPage={setPagina}

          />

        )}
        </>
      )}

        <PrecisaDeAjuda
          duvidas={[
            {
              pergunta: "Como ligo um modelo meu a uma cobrança?",
              resposta:
                "Na aba Sistema. Você escolhe um modelo aprovado e diz qual campo dele recebe o quê. O nome do modelo pode ser o que você quiser: quem sabe o que vai em cada campo é esse vínculo.",
            },
            {
              pergunta: "Posso usar um número para cada coisa?",
              resposta:
                "Pode, e é para isso que o seletor de número existe. O vínculo é por número: cobrança pelo financeiro, ticket pelo almoxarifado, aniversário pelo comercial. Na hora de enviar, o sistema procura qual número tem o vínculo daquela finalidade e fala por ele.",
            },
            {
              pergunta: "Como crio um modelo novo?",
              resposta:
                "Modelo é criado e aprovado no painel da Meta, não aqui. Esta tela só lê o que já está aprovado, porque enviar um que não está gera erro no envio.",
              href: "https://business.facebook.com/wa/manage/message-templates/",
              rotuloDoLink: "Abrir o gerenciador de modelos",
            },
            {
              pergunta: "Meu modelo sumiu da lista",
              resposta:
                "Editar um modelo o devolve para revisão, e nesse estado ele sai de aprovado. A lista mostra só os aprovados, então ele volta sozinho quando a Meta liberar.",
              href: "https://business.facebook.com/wa/manage/message-templates/",
              rotuloDoLink: "Ver o status lá",
            },
            {
              pergunta: "Por que preciso de modelo?",
              resposta:
                "Passadas 24 horas da última mensagem do cliente, a Meta recusa texto livre. Só modelo aprovado passa, e é por isso que a cobrança sai por modelo.",
              href: "https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates",
              rotuloDoLink: "Ver a regra da janela",
            },
          ]}
        />

        {espiando && <PreviaDoModelo espiada={espiando} />}
    </>
  );
}

/** Onde e o que mostrar na previa. */
type Espiada = { corpo: string; x: number; y: number };

function BotaoDeEspiar({
  corpo,
  nome,
  onEspiar,
}: {
  corpo: string;
  nome: string;
  onEspiar: (e: Espiada | null) => void;
}) {
  // A posicao sai do proprio botao no momento do gesto: guardada antes, ela
  // apontaria para onde a linha estava antes de rolar a tabela.
  const mostrar = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    onEspiar({ corpo, x: r.right + 10, y: r.top });
  };

  return (
    <button
      type="button"
      aria-label={`Ver a mensagem de ${nome}`}
      title="Ver a mensagem"
      onMouseEnter={(e) => mostrar(e.currentTarget)}
      onMouseLeave={() => onEspiar(null)}
      // Foco tambem abre: quem navega por teclado nao tem mouse para passar.
      onFocus={(e) => mostrar(e.currentTarget)}
      onBlur={() => onEspiar(null)}
      style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        display: "grid",
        placeItems: "center",
        border: "none",
        // Sem fundo: e um icone ao lado do nome, nao um botao. A moldura
        // redonda pedia um alvo que ali nao existe.
        background: "transparent",
        color: "var(--primary)",
        cursor: "pointer",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.8 12S5.5 5.5 12 5.5 22.2 12 22.2 12 18.5 18.5 12 18.5 1.8 12 1.8 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

/**
 * A mensagem como o cliente vai receber.
 *
 * ⚠️ `position: fixed` e um so na tela. Dentro da celula ele seria recortado
 * pelo `overflow` da area rolavel, e um por linha significaria montar vinte
 * bolhas com o negrito reprocessado para ler no maximo uma.
 */
function PreviaDoModelo({ espiada }: { espiada: Espiada }) {
  return (
    <div
      style={{
        position: "fixed",
        left: espiada.x,
        top: espiada.y,
        zIndex: 500,
        maxWidth: 320,
        padding: 10,
        /*
         * O MESMO fundo da area de mensagens do painel.
         *
         * A bolha usa `primary-subtle`, que e translucido: solta sobre o branco
         * da tela ela sumia. Por tras dela vai o fundo de conversa de verdade,
         * o mesmo empilhamento que a thread usa, e nao um bege inventado que
         * nao existia em lugar nenhum do sistema.
         */
        borderRadius: "var(--radius-lg)",
        background:
          "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
        boxShadow: "var(--shadow-lg)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "7px 10px",
          borderRadius:
            "var(--radius-lg) var(--radius-lg) var(--radius-xs) var(--radius-lg)",
          // O MESMO da bolha enviada no painel. O verde de WhatsApp que eu
          // tinha posto nao existe em lugar nenhum do sistema.
          background: "var(--primary-subtle)",
          boxShadow: "var(--shadow-xs)",
          fontSize: "var(--text-sm)",
          color: "var(--text-primary)",
          lineHeight: "var(--lh-normal)",
          whiteSpace: "pre-wrap",
        }}
      >
        {comFormatacaoDoWhatsapp(espiada.corpo)}
      </div>
    </div>
  );
}
