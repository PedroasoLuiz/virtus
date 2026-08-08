"use client";

import { Avatar } from "@/components/ui/avatar";
import { AcoesDaLinha, BotaoDeAcao, Td, Tr } from "@/components/ui/kit";
import type { Cliente } from "@/modules/clientes/clientes.types";
import { formatarDocumento } from "@/shared/domain/documento";
import { PAPEIS, type PapelVisual } from "./papeis-da-listagem";

/**
 * Uma pessoa na listagem.
 *
 * ⚠️ Arquivo proprio: a tela ja teve seiscentas linhas, e metade delas era o
 * desenho de UMA linha da tabela. Mexer no filtro obrigava a rolar por celulas de
 * documento, e-mail e siglas de papel no caminho.
 */
export function LinhaDaPessoa({
  pessoa: p,
  atraso,
  onAbrir,
}: {
  pessoa: Cliente;
  /** Escalona a entrada das linhas. Vem do indice na pagina. */
  atraso: number;
  onAbrir: () => void;
}) {
  return (
    <Tr delay={atraso} dimmed={!p.ativo} onClick={onAbrir}>
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
                    ⚠️ As cinco siglas ficam SEMPRE na mesma posição, e a que
                    não vale aparece apagada. Mostrando só as que valem, "FOR"
                    cairia ora na primeira coluna, ora na segunda, e a leitura
                    vertical, que é para o que uma coluna de papel serve, sumiria.
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
                      <BotaoDeAcao rotulo="Editar" onClick={() => onAbrir()}>
                        <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
    </Tr>
  );
}

/**
 * A sigla de um papel.
 *
 * ⚠️ A que NÃO vale continua ocupando o lugar dela, apagada. Some, e a coluna
 * perde o alinhamento: "FOR" passa a cair ora na primeira posição, ora na
 * segunda, e ler a coluna de cima a baixo vira decifrar caso a caso.
 */
function Flag({ papel, tem }: { papel: PapelVisual; tem: boolean }) {
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
