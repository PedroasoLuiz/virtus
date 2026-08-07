"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  AcoesDaLinha,
  BotaoDeAcao,
  EmptyRow,
  FilterButton,
  IncluirButton,
  FilterItem,
  PageHeader,
  PageLayout,
  Pagination,
  Panel,
  SearchInput,
  selectStyle,
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
 * ⚠️ O recorte por papel mora no botão de filtro, com a CONTAGEM em cada opção.
 * Ele já foi uma fileira de pastilhas acima da tabela: o recorte é o mesmo, mas
 * ali custava uma faixa da tela para algo que não se troca a todo instante.
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

type Campo = "id" | "nome" | "documento" | "contato" | "email" | "responsavel";
type Dir = "asc" | "desc";

/** O que cada coluna ordenável compara. `id` sai fora: ele é número. */
function valorDoCampo(p: Cliente, campo: Exclude<Campo, "id">): string {
  if (campo === "nome") return p.nomeFantasia?.trim() || p.razao;
  if (campo === "documento") return (p.cnpj ?? "").replace(/\D/g, "");
  if (campo === "contato") return (p.contato ?? "").replace(/\D/g, "");
  if (campo === "email") return p.email ?? "";
  return p.responsavel ?? "";
}

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
  /*
   * A ordem da tabela.
   *
   * ⚠️ Comeca pelo NOME, e nao pelo id. Cadastro se procura pelo nome; a ordem de
   * cadastro so interessa a quem quer ver "o que entrou por ultimo", que e um
   * clique de distancia.
   */
  const [ordem, setOrdem] = useState<{ campo: Campo; dir: Dir }>({
    campo: "nome",
    dir: "asc",
  });
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

  /*
   * ⚠️ `localeCompare` com `sensitivity: "base"`, e nao `<` direto.
   *
   * Comparacao crua de string poe "Ávila" depois de "Zamboni", porque compara o
   * codigo do caractere: nomes com acento iam todos para o fim da lista. O
   * `sensitivity` ainda faz "acia" e "ACIA" caírem juntos, que e o que se espera
   * de uma agenda.
   */
  const ordenadas = useMemo(() => {
    const sinal = ordem.dir === "asc" ? 1 : -1;

    return [...filtradas].sort((a, b) => {
      if (ordem.campo === "id") return (a.id - b.id) * sinal;

      const x = valorDoCampo(a, ordem.campo);
      const y = valorDoCampo(b, ordem.campo);

      // Vazio vai sempre para o FIM, nas duas direcoes: inverter a ordem nao
      // deveria trazer uma parede de tracos para o topo da tela.
      if (!x && !y) return 0;
      if (!x) return 1;
      if (!y) return -1;

      return x.localeCompare(y, "pt-BR", { sensitivity: "base" }) * sinal;
    });
  }, [filtradas, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = ordenadas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  /*
   * Clicar na mesma coluna INVERTE; clicar noutra comeca do inicio.
   *
   * ⚠️ Comecar do inicio importa: herdando o "decrescente" da coluna anterior,
   * trocar de Nome para Documento devolvia a lista de tras para frente sem que
   * ninguem tivesse pedido.
   */
  const ordenarPor = (campo: Campo) => {
    setOrdem((atual) =>
      atual.campo === campo
        ? { campo, dir: atual.dir === "asc" ? "desc" : "asc" }
        : { campo, dir: "asc" },
    );
    setPagina(1);
  };

  const daColuna = (campo: Campo) => (ordem.campo === campo ? ordem.dir : null);

  return (
    <PageLayout>
      <Panel>
        <PageHeader
          title="Pessoas"
          description="Clientes, fornecedores e colaboradores no mesmo cadastro. Os papéis dizem em que cada um entra."
        >
          {/*
            ⚠️ Papel e situação moram DENTRO do botão de filtro.

            Eles já foram uma fileira de pastilhas acima da tabela, e ali
            custavam uma faixa inteira da tela para um recorte que não se troca a
            todo instante. No botão, o mesmo recorte cabe em dois campos, e o
            contador de filtros ativos diz quando a lista está aparada — que era
            o único aviso que a fileira dava de graça.
          */}
          <FilterButton
            activeCount={(papel ? 1 : 0) + (inativos ? 1 : 0)}
            onClear={() => {
              setPapel("");
              setInativos(false);
              setPagina(1);
            }}
          >
            <FilterItem label="Papel">
              <select
                value={papel}
                onChange={(e) => {
                  setPapel(e.target.value as PapelPessoa | "");
                  setPagina(1);
                }}
                style={selectStyle}
              >
                {/*
                  A CONTAGEM vem junto de cada opção.

                  ⚠️ É o que a fileira de pastilhas fazia bem e não podia se
                  perder no caminho: sem o número, escolher "Fornecedores" é uma
                  aposta, e quem quer saber quantos são precisa filtrar para
                  descobrir.
                */}
                <option value="">Todos ({contado(ativas.length)})</option>
                {PAPEIS.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo} ({contado(contagem[p.valor])})
                  </option>
                ))}
              </select>
            </FilterItem>

            {/*
              ⚠️ Inativo fica FORA por padrão.

              Antes eles vinham na lista misturados: quem procurava um fornecedor
              achava o cadastro velho e mandava cobrança para ele. Aqui a
              exceção é explícita, e o contador do botão avisa que ela está
              ligada.
            */}
            <FilterItem label="Situação">
              <select
                value={inativos ? "todos" : "ativos"}
                onChange={(e) => {
                  setInativos(e.target.value === "todos");
                  setPagina(1);
                }}
                style={selectStyle}
              >
                <option value="ativos">Só os ativos</option>
                <option value="todos">Ativos e inativos</option>
              </select>
            </FilterItem>
          </FilterButton>

          <SearchInput
            value={busca}
            onSearch={(v) => {
              setBusca(v);
              setPagina(1);
            }}
          />

          <IncluirButton onClick={() => setEdicao({ pessoa: null })} rotulo="Nova pessoa" />
        </PageHeader>

        <TableFrame>
          <TableArea minWidth={1090}>
            <TableHead>
              {/*
                O número vem PRIMEIRO, e a bolinha logo depois.
                
                ⚠️ Ela não tem título — é reconhecimento, não um dado a ler —, e
                uma coluna sem cabeçalho abrindo a tabela deixava a primeira
                célula do cabeçalho vazia, com o "#" parecendo o título dela.
              */}
              <Th minWidth={46} ordem={daColuna("id")} onOrdenar={() => ordenarPor("id")}>
                #
              </Th>
              <Th className="col-avatar" minWidth={26}>
                {" "}
              </Th>
              <Th ordem={daColuna("nome")} onOrdenar={() => ordenarPor("nome")}>
                Nome
              </Th>
              {/* Papéis não ordena: a coluna é um conjunto, e "CLI+FOR" não vem
                  antes nem depois de "COL" em ordem nenhuma que signifique algo.
                  Quem quer ver só um papel usa o filtro. */}
              <Th minWidth={132}>Papéis</Th>
              <Th
                minWidth={150}
                ordem={daColuna("documento")}
                onOrdenar={() => ordenarPor("documento")}
              >
                Documento
              </Th>
              <Th
                minWidth={140}
                ordem={daColuna("contato")}
                onOrdenar={() => ordenarPor("contato")}
              >
                Contato
              </Th>
              <Th minWidth={190} ordem={daColuna("email")} onOrdenar={() => ordenarPor("email")}>
                E-mail
              </Th>
              <Th
                minWidth={140}
                ordem={daColuna("responsavel")}
                onOrdenar={() => ordenarPor("responsavel")}
              >
                Responsável
              </Th>
              <Th align="right" minWidth={80}>
                Ações
              </Th>
            </TableHead>

            <tbody>
              {visiveis.length === 0 && (
                <EmptyRow
                  colSpan={9}
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
                  <Td style={{ fontVariantNumeric: "tabular-nums" }}>{p.id}</Td>

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

                  {/*
                    ⚠️ A linha inteira já abre o cadastro, e o lápis fica assim
                    mesmo. Sem ele, a única pista de que dá para editar é
                    descobrir que a linha é clicável — e quem chega na tela pela
                    primeira vez não descobre.
                  */}
                  <Td>
                    <AcoesDaLinha>
                      <BotaoDeAcao rotulo="Editar" onClick={() => setEdicao({ pessoa: p })}>
                        <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableArea>

          {ordenadas.length > POR_PAGINA && (
            <Pagination
              page={paginaAtual}
              totalPages={totalPaginas}
              total={ordenadas.length}
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

/**
 * A contagem, com teto.
 *
 * ⚠️ Para em 999. Acima disso o número deixa de ser informação e vira largura: a
 * diferença entre 4.312 e 4.318 não muda decisão nenhuma, e cinco dígitos dentro
 * de uma opção de filtro empurram o rótulo para fora. "999+" diz o que importa,
 * que é "são muitos".
 */
function contado(total: number): string {
  return total > 999 ? "999+" : String(total);
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
