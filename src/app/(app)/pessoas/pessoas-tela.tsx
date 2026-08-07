"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  EmptyRow,
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
} from "@/components/ui/kit";
import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";
import { PessoaDrawer } from "./pessoa-drawer";

/**
 * Pessoas: clientes, fornecedores e colaboradores no mesmo cadastro.
 *
 * ⚠️ A tabela continua sendo a tabela do sistema. O que faltava não era outro
 * componente, era CONTEXTO: quem abria via cinco colunas de dados sem nada
 * dizendo o que aquela tela é nem por que fornecedor e cliente moram juntos.
 *
 * ⚠️ Os contadores por papel são FILTRO, e não enfeite. Eles respondem a
 * pergunta que a tela levanta ("são todos clientes?") e, no mesmo gesto,
 * recortam a lista — um número que não faz nada seria só mais coisa para ler.
 */

/*
 * Os tres papeis, com a sigla e a cor de cada um.
 *
 * ⚠️ A cor segue o DINHEIRO, e nao um sorteio: cliente e entrada (verde),
 * fornecedor e saida (ambar), colaborador nao e nem uma coisa nem outra (azul).
 * Quem varre a coluna aprende a distinguir os tres sem ler as siglas.
 */
const PAPEIS: {
  valor: PapelPessoa;
  rotulo: string;
  sigla: string;
  fundo: string;
  texto: string;
}[] = [
  {
    valor: "cliente",
    rotulo: "Clientes",
    sigla: "CLI",
    fundo: "var(--success-bg)",
    texto: "var(--success-text)",
  },
  {
    valor: "fornecedor",
    rotulo: "Fornecedores",
    sigla: "FOR",
    fundo: "var(--warning-bg)",
    texto: "var(--warning-text)",
  },
  {
    valor: "colaborador",
    rotulo: "Colaboradores",
    sigla: "COL",
    fundo: "var(--info-bg)",
    texto: "var(--info-text)",
  },
];

const POR_PAGINA = 25;

export function PessoasTela({
  pessoas,
  centros,
}: {
  /*
   * ⚠️ O tipo continua `Cliente`, e a tabela `clientes`.
   *
   * O que mudou foi o NOME da tela: ali dentro há cliente, fornecedor e
   * colaborador, e chamar tudo de cliente escondia dois terços do cadastro.
   * Renomear a tabela e a API junto seria uma migração de banco e de rota para
   * consertar uma palavra na tela.
   */
  pessoas: Cliente[];
  centros: { id: number; descricao: string }[];
}) {
  const [busca, setBusca] = useState("");
  const [papel, setPapel] = useState<PapelPessoa | "">("");
  const [inativos, setInativos] = useState(false);
  const [pagina, setPagina] = useState(1);
  // null = fechado; { pessoa: null } = cadastro novo.
  const [edicao, setEdicao] = useState<{ pessoa: Cliente | null } | null>(null);

  /*
   * A contagem sai da lista JÁ sem os inativos, e não do total bruto.
   *
   * ⚠️ Senão o chip diz 128 clientes, o filtro mostra 119 e a diferença fica sem
   * explicação na tela — quem confere vai procurar o erro no lugar errado.
   */
  const ativas = useMemo(
    () => pessoas.filter((p) => inativos || p.ativo),
    [pessoas, inativos],
  );

  const contagem = useMemo(
    () => ({
      cliente: ativas.filter((p) => p.papeis.includes("cliente")).length,
      fornecedor: ativas.filter((p) => p.papeis.includes("fornecedor")).length,
      colaborador: ativas.filter((p) => p.papeis.includes("colaborador")).length,
    }),
    [ativas],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, "");

    return ativas.filter((p) => {
      if (papel && !p.papeis.includes(papel)) return false;
      if (!termo) return true;

      return (
        p.razao.toLowerCase().includes(termo) ||
        (p.nomeFantasia ?? "").toLowerCase().includes(termo) ||
        (p.responsavel ?? "").toLowerCase().includes(termo) ||
        (digitos.length > 0 && (p.cnpj ?? "").includes(digitos)) ||
        (digitos.length > 0 && (p.contato ?? "").replace(/\D/g, "").includes(digitos))
      );
    });
  }, [ativas, busca, papel]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <PageLayout>
      <Panel>
        <PageHeader
          title="Pessoas"
          description="Clientes, fornecedores e colaboradores no mesmo cadastro. Os papéis dizem em que cada um entra."
          onIncluir={() => setEdicao({ pessoa: null })}
          rotuloIncluir="Nova pessoa"
        >
          <SearchInput
            value={busca}
            onSearch={(v) => {
              setBusca(v);
              setPagina(1);
            }}
          />
        </PageHeader>

        {/*
          A fileira de papéis: filtro e panorama no mesmo elemento.

          ⚠️ Fora do `FilterButton` de propósito. Escondido atrás do botão de
          filtro, o papel virava uma opção que ninguém abre — e é justamente o
          recorte que a tela pede toda hora ("quero ver só os fornecedores").
        */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 16px 12px",
            flexWrap: "wrap",
          }}
        >
          <Chip
            rotulo="Todas"
            total={ativas.length}
            ativo={papel === ""}
            onClick={() => {
              setPapel("");
              setPagina(1);
            }}
          />

          {PAPEIS.map((p) => (
            <Chip
              key={p.valor}
              rotulo={p.rotulo}
              total={contagem[p.valor]}
              ativo={papel === p.valor}
              onClick={() => {
                setPapel(papel === p.valor ? "" : p.valor);
                setPagina(1);
              }}
            />
          ))}

          <span style={{ flex: 1 }} />

          {/*
            ⚠️ Inativo fica FORA por padrão, e a chave diz isso.

            Antes eles vinham na lista em cinza claro, misturados: quem procurava
            um fornecedor achava o cadastro velho e mandava cobrança para ele.
            Escondido por padrão, e a um clique de aparecer quando o assunto é
            justamente o cadastro antigo.
          */}
          <Chip
            rotulo="Mostrar inativos"
            ativo={inativos}
            onClick={() => {
              setInativos((v) => !v);
              setPagina(1);
            }}
          />
        </div>

        <TableFrame>
          <TableArea minWidth={1010}>
            <TableHead>
              {/* Sem título: a bolinha é reconhecimento, não um dado a ler. */}
              <Th className="col-avatar" minWidth={26}>
                {" "}
              </Th>
              <Th minWidth={46}>#</Th>
              <Th>Nome</Th>
              <Th minWidth={132}>Papéis</Th>
              <Th minWidth={150}>Documento</Th>
              <Th minWidth={140}>Contato</Th>
              <Th minWidth={190}>E-mail</Th>
              <Th minWidth={140}>Responsável</Th>
            </TableHead>

            <tbody>
              {visiveis.length === 0 && (
                <EmptyRow
                  colSpan={8}
                  message={
                    busca.trim() || papel
                      ? "Nenhuma pessoa com esse filtro."
                      : "Nenhuma pessoa cadastrada ainda."
                  }
                />
              )}

              {visiveis.map((p, i) => (
                <Tr
                  key={p.id}
                  delay={Math.min(i * 20, 150)}
                  dimmed={!p.ativo}
                  onClick={() => setEdicao({ pessoa: p })}
                >
                  {/*
                    A bolinha das iniciais, a mesma do chat e das personas.

                    ⚠️ Ela e o número fazem coisas DIFERENTES, e por isso ficam
                    lado a lado: a cor estável faz reconhecer a linha certa sem
                    ler, e o número é o que se dita ao telefone e o que aparece
                    na fatura. Uma não substitui a outra.
                  */}
                  <Td className="col-avatar">
                    <Avatar
                      nome={p.nomeFantasia?.trim() || p.razao}
                      semente={String(p.id)}
                      tamanho={26}
                    />
                  </Td>

                  <Td style={{ fontVariantNumeric: "tabular-nums" }}>{p.id}</Td>

                  <Td style={{ maxWidth: 320 }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.nomeFantasia?.trim() || p.razao}
                    </div>

                    {/* A razão social só entra quando ela NÃO é o que já está
                        no nome acima. */}
                    {p.nomeFantasia?.trim() && p.nomeFantasia.trim() !== p.razao && (
                      <div
                        style={{
                          marginTop: 1,
                          // Um degrau abaixo do resto da linha: e o nome formal,
                          // que serve para conferir e nao para achar.
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.razao}
                      </div>
                    )}
                  </Td>

                  {/*
                    ⚠️ As três siglas ficam SEMPRE na mesma posição, e a que não
                    vale aparece apagada. Mostrando só as que valem, "FOR" cairia
                    ora na primeira coluna, ora na segunda, e a leitura vertical
                    — que é para o que uma coluna de papel serve — sumiria.
                  */}
                  <Td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {PAPEIS.map((papel) => (
                        <Flag
                          key={papel.valor}
                          papel={papel}
                          tem={p.papeis.includes(papel.valor)}
                        />
                      ))}
                    </div>
                  </Td>

                  <Td>{p.cnpj ? formatarDocumento(p.cnpj) : <Vazio />}</Td>
                  <Td>{p.contato || <Vazio />}</Td>

                  <Td style={{ maxWidth: 220 }}>
                    <span
                      title={p.email ?? undefined}
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.email || <Vazio />}
                    </span>
                  </Td>

                  <Td>{p.responsavel || <Vazio />}</Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>

          {filtradas.length > POR_PAGINA && (
            <Pagination
              page={paginaAtual}
              totalPages={totalPaginas}
              total={filtradas.length}
              pageSize={POR_PAGINA}
              onPage={setPagina}
            />
          )}
        </TableFrame>
      </Panel>

      {edicao && (
        <PessoaDrawer
          // `key` pelo registro: trocar de pessoa remonta o drawer, e o estado
          // inicial já vem da certa sem precisar de efeito para sincronizar.
          key={edicao.pessoa?.id ?? "novo"}
          cliente={edicao.pessoa}
          centros={centros}
          aberto
          onClose={() => setEdicao(null)}
        />
      )}
    </PageLayout>
  );
}

/**
 * Chip de papel: rótulo e contagem.
 *
 * ⚠️ A contagem entra DENTRO do chip, e não numa legenda ao lado. Ela é o que
 * faz o chip valer a pena existir: sem o número, "Fornecedores" é só mais um
 * botão de filtro; com ele, a fileira inteira vira o resumo do cadastro.
 */
function Chip({
  rotulo,
  total,
  ativo,
  onClick,
}: {
  rotulo: string;
  total?: number;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 11px",
        borderRadius: "var(--radius-full)",
        /*
         * ⚠️ Sem borda. Quatro pastilhas contornadas em fila viram uma cerca, e
         * o que a fileira precisa mostrar e o NUMERO de cada papel — o contorno
         * competia com ele. O que recorta a pastilha do cinza da tela e o
         * proprio fundo, branco quando apagada e verde tingido quando acesa.
         */
        border: "1px solid transparent",
        background: ativo ? "var(--primary-subtle)" : "var(--surface)",
        color: ativo ? "var(--primary)" : "var(--text-secondary)",
        fontSize: "var(--text-sm)",
        fontWeight: ativo ? "var(--fw-semi)" : "var(--fw-normal)",
        fontFamily: "var(--font)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background var(--dur-fast) var(--ease)",
      }}
    >
      {rotulo}

      {total != null && (
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            color: ativo ? "var(--primary)" : "var(--text-tertiary)",
            fontWeight: "var(--fw-semi)",
          }}
        >
          {total}
        </span>
      )}
    </button>
  );
}

/**
 * A sigla de um papel.
 *
 * ⚠️ A que NÃO vale continua ocupando o lugar dela, apagada. Some, e a coluna
 * perde o alinhamento: "FOR" passa a cair ora na primeira posição, ora na
 * segunda, e ler a coluna de cima a baixo vira decifrar caso a caso.
 */
function Flag({ papel, tem }: { papel: (typeof PAPEIS)[number]; tem: boolean }) {
  return (
    <span
      title={tem ? papel.rotulo : undefined}
      style={{
        width: 34,
        height: 17,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-xs)",
        background: tem ? papel.fundo : "transparent",
        color: tem ? papel.texto : "var(--text-disabled)",
        fontSize: "var(--text-2xs)",
        fontWeight: "var(--fw-semi)",
        letterSpacing: "0.03em",
        // Apagada quase some: ela existe para segurar a posição, não para ser
        // lida. Legível demais, a linha vira três siglas competindo com o nome.
        opacity: tem ? 1 : 0.3,
      }}
    >
      {papel.sigla}
    </span>
  );
}

/** O traço do campo vazio. Célula em branco parece coluna quebrada. */
function Vazio() {
  return <span style={{ color: "var(--text-disabled)" }}>—</span>;
}

/** CPF ou CNPJ, pela quantidade de dígitos. */
function formatarDocumento(bruto: string): string {
  const d = bruto.replace(/\D/g, "");

  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");

  return bruto;
}
