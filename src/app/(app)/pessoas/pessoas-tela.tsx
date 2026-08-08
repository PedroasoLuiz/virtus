"use client";

import { useCallback, useEffect, useState } from "react";
import {
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
  SkeletonRows,
  TableArea,
  TableFrame,
  TableHead,
  Th,
} from "@/components/ui/kit";
import type { Cliente, PapelPessoa } from "@/modules/clientes/clientes.types";
import { PessoaDrawer } from "./pessoa-drawer";
import { LinhaDaPessoa } from "./pessoa-linha";
import { PAPEIS } from "./papeis-da-listagem";

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

const POR_PAGINA = 25;

type Contagem = {
  total: number;
  cliente: number;
  fornecedor: number;
  colaborador: number;
  transportadora: number;
  corretor: number;
};

const VAZIO: Contagem = {
  total: 0,
  cliente: 0,
  fornecedor: 0,
  colaborador: 0,
  transportadora: 0,
  corretor: 0,
};

/*
 * Os campos de ordem sao os do BANCO, e nao os da tela.
 *
 * ⚠️ Ordenar por "nome fantasia quando existe, razao quando nao" era possivel na
 * memoria e nao e no banco sem uma coluna calculada. Ordena por `razao`, que e o
 * campo obrigatorio: a coluna mostra o fantasia, e o desencontro aparece so em
 * quem tem os dois diferentes — bem menos ruim do que a lista mentir depois do
 * registro 200.
 */
type Campo = "id" | "razao" | "cnpj" | "contato" | "email" | "responsavel";
type Dir = "asc" | "desc";

/*
 * ⚠️ O tipo continua `Cliente`, e a tabela `clientes`.
 *
 * O que mudou foi o NOME da tela: ali dentro há cliente, fornecedor e
 * colaborador, e chamar tudo de cliente escondia dois terços do cadastro.
 * Renomear a tabela e a API junto seria uma migração de banco e de rota para
 * consertar uma palavra na tela.
 */
export function PessoasTela() {
  const [pessoas, setPessoas] = useState<Cliente[] | null>(null);
  const [total, setTotal] = useState(0);
  const [contagem, setContagem] = useState<Contagem>(VAZIO);

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
    campo: "razao",
    dir: "asc",
  });
  const [pagina, setPagina] = useState(1);
  // null = fechado; { pessoa: null } = cadastro novo.
  const [edicao, setEdicao] = useState<{ pessoa: Cliente | null } | null>(null);

  /*
   * A busca, a ordem e a página vivem no SERVIDOR.
   *
   * ⚠️ Antes a tela recebia duzentos registros e fazia tudo na memória. Com cem
   * pessoas funcionava; com trezentas passava a mentir — o registro de número
   * 201 não existia para a busca, e o contador dizia 200 para sempre. E numa
   * base de milhares seriam milhares de linhas trafegadas por abertura de tela
   * para desenhar as vinte e cinco que cabem.
   */
  const carregar = useCallback(async () => {
    const p = new URLSearchParams({
      page: String(pagina),
      perPage: String(POR_PAGINA),
      ordem: ordem.campo,
      dir: ordem.dir,
    });

    if (busca.trim()) p.set("busca", busca.trim());
    if (papel) p.set("papel", papel);
    // Sem o parametro, a API devolve ativos e inativos: quem restringe e a tela.
    if (!inativos) p.set("ativo", "true");

    const r = await fetch(`/api/v1/clientes?${p.toString()}`);
    if (!r.ok) return;

    const corpo = await r.json();
    setPessoas(corpo.data ?? []);
    setTotal(corpo.meta?.total ?? 0);
  }, [pagina, ordem, busca, papel, inativos]);

  /*
   * ⚠️ 300ms de espera entre teclas. Sem isso, "fornecedor" sao onze consultas
   * ao banco para responder a decima primeira.
   */
  useEffect(() => {
    const t = setTimeout(() => void carregar(), 300);
    return () => clearTimeout(t);
  }, [carregar]);

  /*
   * A contagem vem SEPARADA, e so muda com o interruptor de inativos.
   *
   * ⚠️ Junto da lista, ela seria recontada a cada tecla da busca e a cada troca
   * de pagina para dar sempre o mesmo numero. E ela nao leva a busca de
   * proposito: responde "quantos existem", e nao "quantos bateram com o que
   * digitei" — que ja e o que a propria lista mostra.
   */
  useEffect(() => {
    const controle = new AbortController();

    fetch(`/api/v1/clientes/contagem${inativos ? "?inativos=true" : ""}`, {
      signal: controle.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const corpo = await r.json();
        setContagem(corpo.data ?? VAZIO);
      })
      .catch(() => {});

    return () => controle.abort();
  }, [inativos]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const visiveis = pessoas ?? [];

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
                <option value="">Todos ({contado(contagem.total)})</option>
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
          <TableArea minWidth={1174}>
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
              <Th ordem={daColuna("razao")} onOrdenar={() => ordenarPor("razao")}>
                Nome
              </Th>
              {/* Papéis não ordena: a coluna é um conjunto, e "CLI+FOR" não vem
                  antes nem depois de "COL" em ordem nenhuma que signifique algo.
                  Quem quer ver só um papel usa o filtro. */}
              <Th minWidth={216}>Papéis</Th>
              <Th
                minWidth={150}
                ordem={daColuna("cnpj")}
                onOrdenar={() => ordenarPor("cnpj")}
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
              {pessoas == null ? (
                <SkeletonRows
                  cols={9}
                  rows={6}
                  labels={[
                    "#",
                    "",
                    "Nome",
                    "Papéis",
                    "Documento",
                    "Contato",
                    "E-mail",
                    "Responsável",
                    "",
                  ]}
                />
              ) : (
                visiveis.length === 0 && (
                  <EmptyRow
                    colSpan={9}
                    message={
                      busca.trim() || papel
                        ? "Nenhuma pessoa com esse filtro."
                        : "Nenhuma pessoa cadastrada ainda."
                    }
                  />
                )
              )}

              {visiveis.map((p, i) => (
                <LinhaDaPessoa
                  key={p.id}
                  pessoa={p}
                  atraso={Math.min(i * 20, 150)}
                  onAbrir={() => setEdicao({ pessoa: p })}
                />
              ))}
            </tbody>
          </TableArea>

          {total > POR_PAGINA && (
            <Pagination
              page={pagina}
              totalPages={totalPaginas}
              total={total}
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
          aberto
          onClose={() => {
            setEdicao(null);
            // A lista mora no cliente agora: sem isto, o cadastro salvo so
            // aparecia depois de mexer na busca ou trocar de pagina.
            void carregar();
          }}
        />
      )}
    </PageLayout>
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
