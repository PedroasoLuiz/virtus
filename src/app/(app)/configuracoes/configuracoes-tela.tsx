"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AcoesDaLinha,
  Alert,
  Badge,
  EmptyRow,
  IncluirButton,
  PageHeader,
  PageLayout,
  Panel,
  TableArea,
  TableFrame,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/components/ui/kit";
import { MenuDeLinha, ItemDoMenu } from "@/components/ui/menu-de-linha";
import {
  LayoutComMenu,
  MenuDeSecoes,
  type GrupoDeSecoes,
} from "@/components/ui/menu-de-secoes";
import { useAvisos } from "@/components/ui/avisos";
import { ConexaoMetaDrawer } from "./conexao-meta-drawer";
import { DescobrirContasDrawer } from "./descobrir-contas-drawer";
import { DescobrirPaginasDrawer } from "./descobrir-paginas-drawer";
import { RenovarAcessoDrawer } from "./renovar-acesso-drawer";
import type { Acesso, Conexao, Pagina } from "@/modules/insights/insights.types";

/**
 * As integrações da empresa.
 *
 * ⚠️ O menu da esquerda é NAVEGAÇÃO, e não abas, apesar de vestir o traço delas.
 * Aba neste sistema só existe em drawer. Aqui a lista cresce com cada rede que
 * entrar (Meta, TikTok, Google), e uma faixa horizontal quebraria na quarta:
 * vertical, ela só fica mais alta, e o agrupamento por rede continua legível.
 */

type Secao = "meta-acessos" | "meta-contas" | "meta-paginas" | "tiktok";

const GRUPOS: GrupoDeSecoes<Secao>[] = [
  {
    titulo: "Meta",
    itens: [
      { chave: "meta-acessos", rotulo: "Acessos" },
      { chave: "meta-contas", rotulo: "Contas de anúncio" },
      { chave: "meta-paginas", rotulo: "Páginas e perfis" },
    ],
  },
  {
    // Honesto: aparece, e diz que não dá. Escondendo, a pergunta "e o TikTok?"
    // volta toda semana; prometendo, ela vira reclamação.
    titulo: "TikTok",
    itens: [{ chave: "tiktok", rotulo: "Acessos", nota: "em breve" }],
  },
];

/** "09/08/2026" a partir do timestamp que o banco devolve. */
function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * O que a tela diz sobre a validade do token.
 *
 * ⚠️ Vencido é `danger`, e não um aviso discreto. Token expirado não degrada o
 * painel: ele para inteiro, com uma mensagem da Meta que ninguém associa a isto.
 * Quem abre esta tela precisa ver o motivo antes de procurá-lo.
 */
function validade(acesso: Acesso): { tom: "danger" | "warning" | "neutral"; texto: string } {
  if (!acesso.expiraEm) return { tom: "neutral", texto: "Sem prazo informado" };

  const dias = Math.ceil((new Date(acesso.expiraEm).getTime() - Date.now()) / 86_400_000);

  if (dias <= 0) return { tom: "danger", texto: `Vencido em ${dataBR(acesso.expiraEm)}` };
  if (dias <= 7) return { tom: "warning", texto: `Vence em ${dias}d` };
  return { tom: "neutral", texto: `Vence em ${dataBR(acesso.expiraEm)}` };
}

export function ConfiguracoesTela({
  acessos,
  conexoes,
  paginas,
}: {
  acessos: Acesso[];
  conexoes: Conexao[];
  paginas: Pagina[];
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [secao, setSecao] = useState<Secao>("meta-acessos");
  const [editando, setEditando] = useState<Conexao | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [renovando, setRenovando] = useState<Acesso | null>(null);
  const [buscandoPagina, setBuscandoPagina] = useState(false);

  async function alternarAtivo(conexao: Conexao) {
    const r = await fetch(`/api/v1/insights/conexoes/${conexao.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !conexao.ativo }),
    });

    if (!r.ok) {
      const dados = await r.json().catch(() => null);
      avisar("atencao", dados?.error?.message ?? "Não foi possível mudar a situação");
      return;
    }

    avisar("sucesso", conexao.ativo ? "Conta desativada" : "Conta reativada");
    router.refresh();
  }

  return (
    <PageLayout>
      <Panel>
        <PageHeader
          title="Integrações"
        />

        <LayoutComMenu
          menu={<MenuDeSecoes grupos={GRUPOS} atual={secao} aoEscolher={setSecao} />}
        >
          <div style={{ minWidth: 0 }}>
            {secao === "meta-acessos" && (
              <Secao
                titulo="Acessos"
                legenda="Cada acesso é um login na Meta. O token vive nele, e renová-lo vale para todas as contas de uma vez."
              >
                <TabelaDeAcessos
                  acessos={acessos}
                  conexoes={conexoes}
                  aoRenovar={setRenovando}
                />
              </Secao>
            )}

            {secao === "meta-contas" && (
              <Secao
                titulo="Contas de anúncio"
                legenda="O que aparece no painel de Insights, e de quem é cada uma."
                acao={<IncluirButton onClick={() => setBuscando(true)} rotulo="Buscar contas" />}
              >
                <TabelaDeContas
                  conexoes={conexoes}
                  aoEditar={setEditando}
                  aoAlternar={alternarAtivo}
                />
              </Secao>
            )}

            {secao === "meta-paginas" && (
              <Secao
                titulo="Páginas e perfis"
                legenda="O Instagram vem pela Página do Facebook: o perfil comercial é um campo dentro dela."
                acao={
                  <IncluirButton
                    onClick={() => setBuscandoPagina(true)}
                    rotulo="Buscar Páginas"
                  />
                }
              >
                <TabelaDePaginas paginas={paginas} />
              </Secao>
            )}

            {secao === "tiktok" && (
              <Secao
                titulo="Acessos"
                legenda="Para trazer as métricas do TikTok Ads para o mesmo painel."
              >
                <Alert variant="info" title="Ainda não disponível">
                  O TikTok tem API própria, com aprovação e permissões separadas das da Meta.
                  Entra depois que o login da Meta estiver aprovado.
                </Alert>
              </Secao>
            )}
          </div>
        </LayoutComMenu>
      </Panel>

      {buscando && (
        <DescobrirContasDrawer acessos={acessos} onClose={() => setBuscando(false)} />
      )}

      {editando && (
        <ConexaoMetaDrawer conexao={editando} onClose={() => setEditando(null)} />
      )}

      {buscandoPagina && (
        <DescobrirPaginasDrawer acessos={acessos} onClose={() => setBuscandoPagina(false)} />
      )}

      {renovando && (
        <RenovarAcessoDrawer acesso={renovando} onClose={() => setRenovando(null)} />
      )}
    </PageLayout>
  );
}

/** Título, legenda e conteúdo do lado direito. */
function Secao({
  titulo,
  legenda,
  acao,
  children,
}: {
  titulo: string;
  legenda: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-lg)",
              fontWeight: "var(--fw-semi)",
              letterSpacing: "var(--tracking-tight)",
            }}
          >
            {titulo}
          </h2>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
            }}
          >
            {legenda}
          </p>
        </div>

        {acao}
      </div>

      {children}
    </section>
  );
}

function TabelaDeAcessos({
  acessos,
  conexoes,
  aoRenovar,
}: {
  acessos: Acesso[];
  conexoes: Conexao[];
  aoRenovar: (a: Acesso) => void;
}) {
  return (
    <TableFrame>
      <TableArea minWidth={520}>
        <TableHead>
          <Th>Acesso</Th>
          <Th minWidth={200}>Token</Th>
          <Th minWidth={100}>Contas</Th>
          <Th minWidth={44} />
        </TableHead>

        <tbody>
          {acessos.length === 0 && (
            <EmptyRow
              colSpan={4}
              message="Nenhum acesso ligado. Vá em Contas de anúncio e use “Buscar contas”."
            />
          )}

          {acessos.map((a) => {
            const prazo = validade(a);
            const quantas = conexoes.filter((c) => c.acessoId === a.id).length;

            return (
              <Tr key={a.id}>
                <Td>{a.nome ?? `Acesso ${a.id}`}</Td>
                <Td>
                  <Badge tom={prazo.tom}>{prazo.texto}</Badge>
                </Td>
                <Td>{quantas}</Td>
                <Td>
                  <AcoesDaLinha>
                    <MenuDeLinha>
                      {(fechar) => (
                        <ItemDoMenu
                          rotulo="Renovar token"
                          onClick={() => {
                            aoRenovar(a);
                            fechar();
                          }}
                        />
                      )}
                    </MenuDeLinha>
                  </AcoesDaLinha>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </TableArea>
    </TableFrame>
  );
}

function TabelaDeContas({
  conexoes,
  aoEditar,
  aoAlternar,
}: {
  conexoes: Conexao[];
  aoEditar: (c: Conexao) => void;
  aoAlternar: (c: Conexao) => void;
}) {
  return (
    <TableFrame>
      <TableArea minWidth={560}>
        <TableHead>
          <Th>Conta de anúncio</Th>
          <Th minWidth={180}>Cliente</Th>
          <Th minWidth={100}>Situação</Th>
          <Th minWidth={44} />
        </TableHead>

        <tbody>
          {conexoes.length === 0 && (
            <EmptyRow
              colSpan={4}
              message="Nenhuma conta ligada. Use “Buscar contas” para ver o que o seu acesso enxerga."
            />
          )}

          {conexoes.map((c, i) => (
            <Tr key={c.id} delay={Math.min(i * 20, 150)}>
              <Td>
                <span style={{ display: "block" }}>{c.nome ?? c.adAccountId}</span>
                {/*
                  ⚠️ O identificador vai embaixo, menor e em cinza, e não numa
                  coluna própria. Ele só serve para conferir contra o Gerenciador
                  quando algo não bate; uma coluna inteira para isso rouba
                  largura do que se lê todo dia.
                */}
                {c.nome && (
                  <span
                    style={{
                      display: "block",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {c.adAccountId}
                  </span>
                )}
              </Td>

              <Td>{c.clienteNome ?? "Sem cliente"}</Td>

              <Td>
                <Badge tom={c.ativo ? "success" : "neutral"}>
                  {c.ativo ? "Ativa" : "Inativa"}
                </Badge>
              </Td>

              <Td>
                <AcoesDaLinha>
                  <MenuDeLinha>
                    {(fechar) => (
                      <>
                        <ItemDoMenu
                          rotulo="Editar"
                          onClick={() => {
                            aoEditar(c);
                            fechar();
                          }}
                        />
                        <ItemDoMenu
                          rotulo={c.ativo ? "Desativar" : "Reativar"}
                          perigo={c.ativo}
                          onClick={() => {
                            aoAlternar(c);
                            fechar();
                          }}
                        />
                      </>
                    )}
                  </MenuDeLinha>
                </AcoesDaLinha>
              </Td>
            </Tr>
          ))}
        </tbody>
      </TableArea>
    </TableFrame>
  );
}

function TabelaDePaginas({ paginas }: { paginas: Pagina[] }) {
  return (
    <TableFrame>
      <TableArea minWidth={520}>
        <TableHead>
          <Th>Página</Th>
          <Th minWidth={180}>Instagram</Th>
          <Th minWidth={180}>Cliente</Th>
        </TableHead>

        <tbody>
          {paginas.length === 0 && (
            <EmptyRow
              colSpan={3}
              message="Nenhuma Página ligada. Use “Buscar Páginas” para ver o que o seu acesso enxerga."
            />
          )}

          {paginas.map((p, i) => (
            <Tr key={p.id} delay={Math.min(i * 20, 150)}>
              <Td>{p.nome ?? p.pageId}</Td>

              <Td>
                {/*
                  ⚠️ Sem perfil é `warning`, e não um traço discreto. A Página
                  funciona sem ele, mas o painel de seguidores não — e quem olha
                  esta linha precisa entender por que aquele cliente não aparece
                  lá, sem ter que descobrir sozinho.
                */}
                {p.igUsername ? (
                  `@${p.igUsername}`
                ) : (
                  <Badge tom="warning">Sem perfil vinculado</Badge>
                )}
              </Td>

              <Td>{p.clienteNome ?? "Sem cliente"}</Td>
            </Tr>
          ))}
        </tbody>
      </TableArea>
    </TableFrame>
  );
}
