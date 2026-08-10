"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BotaoDeAcao,
  EmptyRow,
  FilterButton,
  FilterItem,
  IncluirButton,
  MarcaDeConciliacao,
  PageHeader,
  PageLayout,
  Pagination,
  Panel,
  SearchInput,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { NovoRecebimentoDrawer } from "./novo-recebimento-drawer";
import { RecebimentoDrawer } from "./recebimento-drawer";
import { IndicadoresDeBaixa } from "@/components/financeiro/indicadores-de-baixa";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type {
  IndicadoresDeRecebimento,
  RecebimentoResumo,
} from "@/modules/recebimentos/recebimentos.types";

/**
 * Listagem do dinheiro que entrou.
 *
 * E o outro lado de "Contas a receber": la esta o que o cliente deve, aqui o que
 * ele pagou. Uma linha por LANCAMENTO — o mesmo que o extrato do banco mostra —
 * e nao uma por parcela quitada. Um PIX que fecha tres parcelas e uma linha so,
 * e e assim que ele aparece no banco.
 *
 * Filtro e busca acontecem em memoria sobre a pagina carregada. Quando o volume
 * exigir, sobem para a query — `listarQuerySchema` ja preve os parametros.
 */

const PAGE_SIZE = 25;

export function RecebimentosTabela({
  recebimentos,
  indicadores,
}: {
  recebimentos: RecebimentoResumo[];
  indicadores: IndicadoresDeRecebimento;
}) {
  const router = useRouter();
  const { avisar, confirmar } = useAvisos();
  const [criando, setCriando] = useState(false);
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return recebimentos.filter((r) => {
      if (de && (r.data ?? "") < de) return false;
      if (ate && (r.data ?? "") > ate) return false;
      if (!termo) return true;
      return (
        String(r.id).includes(termo) ||
        (r.clienteNome ?? "").toLowerCase().includes(termo) ||
        (r.tipo ?? "").toLowerCase().includes(termo)
      );
    });
  }, [recebimentos, busca, de, ate]);

  /*
   * O mesmo estorno do cabecalho do drawer, disparado da linha.
   *
   * ⚠️ Nao e duplicacao da regra: quem decide o que pode ser estornado e o
   * servico, no DELETE. Aqui so se pergunta e se avisa — a tela apaga o botao
   * do que ja foi conciliado para poupar a viagem, e o servidor recusa de novo.
   */
  async function estornar(id: number) {
    const r = await fetch(`/api/v1/recebimentos/${id}`, { method: "DELETE" });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível estornar");
      return;
    }

    avisar("sucesso", "Recebimento estornado", "As parcelas voltaram a ficar em aberto.");
    router.refresh();
  }

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  return (
    <PageLayout>
      <Panel>
        <PageHeader title="Baixas">
          <FilterButton
            activeCount={(de ? 1 : 0) + (ate ? 1 : 0)}
            onClear={() => {
              setDe("");
              setAte("");
              setPagina(1);
            }}
          >
            <FilterItem label="De">
              <input
                type="date"
                value={de}
                onChange={(e) => {
                  setDe(e.target.value);
                  setPagina(1);
                }}
                style={inputStyle}
              />
            </FilterItem>
            <FilterItem label="Até">
              <input
                type="date"
                value={ate}
                onChange={(e) => {
                  setAte(e.target.value);
                  setPagina(1);
                }}
                style={inputStyle}
              />
            </FilterItem>
          </FilterButton>
          <SearchInput
            value={busca}
            onSearch={(v) => {
              setBusca(v);
              setPagina(1);
            }}
          />
          <IncluirButton onClick={() => setCriando(true)} />
        </PageHeader>

        {/*
          ⚠️ Os cartoes ficam FORA do `TableFrame`.

          O recuo lateral de 16 mora no frame porque ha um cartao em volta da
          tabela; os indicadores tem cartao proprio, e dentro do frame ganhariam
          o recuo duas vezes. Aqui eles usam o mesmo recuo, na altura certa:
          entre a barra de busca e a tabela.
        */}
        <div style={{ padding: "0 16px 14px" }}>
          <IndicadoresDeBaixa dados={indicadores} />
        </div>

        <TableFrame>
          <TableArea minWidth={900}>
            <TableHead>
              <Th minWidth={64}>#</Th>
              {/*
                ⚠️ Conciliado abre a linha, antes da data.

                E o estado do registro, e nao um dado dele: a pergunta de quem
                varre a lista e "o que ainda falta conferir?". No fim da linha,
                responder isso exigia atravessar cinco colunas de dado por vez.

                ⚠️ TUDO a esquerda, inclusive o dinheiro e as acoes. E a regra da
                conta a receber, e ela existe para o olho nao refazer o percurso
                a cada tela: com uma coluna puxada para a direita, a leitura
                salta o vao vazio do meio e volta.
              */}
              <Th minWidth={80}>Conciliado</Th>
              <Th minWidth={90}>Data</Th>
              <Th>Cliente</Th>
              <Th minWidth={110}>Forma</Th>
              <Th minWidth={190}>Conta</Th>
              <Th minWidth={130}>Destino</Th>
              <Th minWidth={110}>Valor</Th>
              <Th minWidth={80}>Ações</Th>
            </TableHead>
            <tbody>
              {visiveis.length === 0 && <EmptyRow colSpan={9} />}
              {visiveis.map((r, i) => (
                <Tr key={r.id} delay={Math.min(i * 20, 150)} onClick={() => setDetalhe(r.id)}>
                  <Td style={NUM}>{r.id}</Td>
                  <Td>
                    {/* Conciliado e gesto humano: significa "conferi no extrato".
                        Por isso nasce pendente e nada no sistema o marca sozinho. */}
                    <MarcaDeConciliacao conciliado={r.conciliado} />
                  </Td>
                  <Td style={NUM}>{r.data ? paraFormatoBR(r.data as DataISO) : "—"}</Td>
                  <Td style={{ maxWidth: 240 }}>
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.clienteNome ?? "—"}
                    </span>
                  </Td>
                  {/*
                    ⚠️ Todas as celulas no mesmo peso e na mesma cor.

                    Forma, conta e destino eram `--text-secondary` e o valor era
                    verde e semibold. Tres pesos numa linha so criam uma
                    hierarquia que nao existe no dado: numa lista de dinheiro que
                    entrou, TODO valor e credito, e pintar todos de verde nao
                    distingue nada — so tira a cor de circulacao para quando ela
                    tiver algo a dizer.
                  */}
                  <Td>{r.tipo ?? "—"}</Td>
                  <Td style={{ whiteSpace: "nowrap" }}>{r.contaNome ?? "—"}</Td>
                  <Td style={{ whiteSpace: "nowrap" }}>{destino(r)}</Td>
                  <Td style={NUM}>{formatarSemSimbolo(r.valor)}</Td>
                  <Td>
                    {/*
                      ⚠️ Nao e o `AcoesDaLinha` do kit: ele empurra para a
                      direita, e nesta tabela tudo alinha a esquerda.
                    */}
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      <BotaoDeAcao rotulo="Abrir este recebimento" onClick={() => setDetalhe(r.id)}>
                        {/* Olho: ver sem mexer, que e o que o drawer faz. */}
                        <path d="M1.3 8s2.4-4.5 6.7-4.5S14.7 8 14.7 8s-2.4 4.5-6.7 4.5S1.3 8 1.3 8z" />
                        <circle cx="8" cy="8" r="1.9" />
                      </BotaoDeAcao>

                      {/*
                        ⚠️ Estornar, e nao editar.

                        Recebimento gravado ja abateu parcela e pode ter recibo
                        emitido: mudar o valor por cima deixaria a parcela dizendo
                        uma coisa e o extrato outra. A correcao e desfazer e
                        lancar de novo, que e o mesmo gesto do cabecalho do
                        drawer. Desabilitado com o motivo quando ja foi
                        conciliado, e nao escondido: sumir faria parecer que o
                        sistema nao sabe estornar.
                      */}
                      <BotaoDeAcao
                        rotulo={
                          r.conciliado
                            ? "Não dá para estornar: este recebimento já foi conciliado no extrato"
                            : "Estornar este recebimento"
                        }
                        perigo
                        desabilitado={r.conciliado}
                        onClick={() =>
                          confirmar(
                            `Estornar o recebimento ${r.id}?`,
                            "Estornar",
                            () => estornar(r.id),
                            "O lançamento é apagado e as parcelas voltam a ficar em aberto. O desconto dado na baixa volta a ser devido.",
                          )
                        }
                      >
                        {/* Seta circular anti-horária: desfazer. Grade de 16. */}
                        <path d="M2.7 8a5.3 5.3 0 1 0 1.55-3.75L2.7 5.8" />
                        <path d="M2.7 2.7v3.3h3.3" />
                      </BotaoDeAcao>
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>

          <Pagination
            page={paginaAtual}
            totalPages={totalPaginas}
            total={filtrados.length}
            pageSize={PAGE_SIZE}
            onPage={setPagina}
          />
        </TableFrame>
      </Panel>

      <RecebimentoDrawer
        recebimentoId={detalhe}
        aoEstornar={() => router.refresh()}
        onClose={() => setDetalhe(null)}
      />

      {criando && (
        <NovoRecebimentoDrawer
          onClose={() => setCriando(false)}
          aoCriar={() => {
            setCriando(false);
            router.refresh();
          }}
        />
      )}
    </PageLayout>
  );
}

/** Numero em coluna: tabular e sem quebra, para o digito alinhar com o de cima. */
const NUM: React.CSSProperties = {
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

/** "3 parcelas · 2 contas". Com uma conta so, dizer isso e ruido. */
function destino(r: RecebimentoResumo): string {
  const parcelas = r.qtdParcelas === 1 ? "1 parcela" : `${r.qtdParcelas} parcelas`;
  return r.qtdContas > 1 ? `${parcelas} · ${r.qtdContas} contas` : parcelas;
}

