"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  Alert,
  Badge,
  Button,
  Field,
  Formulario,
  GrupoDeCampos,
  selectStyle,
  SeletorBuscavel,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import type { Acesso, PaginaDisponivel } from "@/modules/insights/insights.types";

/**
 * Descobre as Páginas de um acesso e liga as escolhidas.
 *
 * ⚠️ Aqui não existe a opção de colar token, diferente da busca de contas. Página
 * só faz sentido pendurada num acesso que já existe, e o token dela é derivado
 * dele a cada consulta. Aceitar token aqui abriria um segundo caminho para
 * gravar segredo, que é o que acabamos de reduzir a um.
 */
export function DescobrirPaginasDrawer({
  acessos,
  onClose,
}: {
  acessos: Acesso[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [acessoId, setAcessoId] = useState<string>(
    acessos.length > 0 ? String(acessos[0].id) : "",
  );

  const [paginas, setPaginas] = useState<PaginaDisponivel[] | null>(null);
  const [jaLigadas, setJaLigadas] = useState<string[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [clientes, setClientes] = useState<Map<string, { id: number; nome: string }>>(
    new Map(),
  );

  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscarClientes = useCallback(async (termo: string) => {
    const p = new URLSearchParams({ perPage: "15", papel: "cliente", ativo: "true" });
    if (termo.trim()) p.set("busca", termo.trim());

    const r = await fetch(`/api/v1/clientes?${p.toString()}`);
    if (!r.ok) return [];

    const corpo = await r.json();
    return ((corpo.data ?? []) as { id: number; razao: string; nomeFantasia: string | null }[]).map(
      (c) => ({ id: c.id, nome: c.nomeFantasia?.trim() || c.razao }),
    );
  }, []);

  async function buscar() {
    setBuscando(true);
    setErro(null);

    const r = await fetch("/api/v1/insights/paginas-disponiveis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acessoId: Number(acessoId) }),
    });

    const dados = await r.json().catch(() => null);
    setBuscando(false);

    if (!r.ok) {
      setErro(dados?.error?.message ?? "Não foi possível consultar a Meta");
      setPaginas(null);
      return;
    }

    setPaginas(dados.data.paginas as PaginaDisponivel[]);
    setJaLigadas(dados.data.jaLigadas as string[]);
    setMarcadas(new Set());
  }

  async function ligar() {
    setSalvando(true);

    const escolhidas = (paginas ?? [])
      .filter((p) => marcadas.has(p.pageId))
      .map((p) => ({
        pageId: p.pageId,
        nome: p.nome,
        igUserId: p.igUserId,
        igUsername: p.igUsername,
        clienteId: clientes.get(p.pageId)?.id ?? null,
      }));

    const r = await fetch("/api/v1/insights/paginas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acessoId: Number(acessoId), paginas: escolhidas }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível ligar as Páginas");
      return;
    }

    avisar(
      "sucesso",
      escolhidas.length === 1 ? "Página ligada" : `${escolhidas.length} Páginas ligadas`,
    );
    router.refresh();
    onClose();
  }

  function alternar(id: string) {
    setMarcadas((antes) => {
      const novo = new Set(antes);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const semInstagram = (paginas ?? []).filter((p) => !p.igUserId).length;

  return (
    <Drawer
      open
      onClose={onClose}
      title="Buscar Páginas"
      acoes={
        paginas === null ? (
          <Button
            size="xs"
            variant="primary"
            disabled={!acessoId || buscando}
            onClick={buscar}
          >
            {buscando ? "Buscando…" : "Buscar"}
          </Button>
        ) : (
          <Button
            size="xs"
            variant="primary"
            disabled={salvando || marcadas.size === 0}
            onClick={ligar}
          >
            {salvando ? "Ligando…" : `Ligar ${marcadas.size || ""}`.trim()}
          </Button>
        )
      }
    >
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="Qual acesso"
          legenda="A Meta só mostra as Páginas que este acesso já enxerga."
        >
          <Field label="Acesso">
            <select
              value={acessoId}
              onChange={(e) => {
                setAcessoId(e.target.value);
                setPaginas(null);
              }}
              style={selectStyle}
            >
              {acessos.length === 0 && <option value="">Nenhum acesso ligado</option>}
              {acessos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome ?? `Acesso ${a.id}`}
                </option>
              ))}
            </select>
          </Field>
        </GrupoDeCampos>

        {erro && (
          <Alert variant="danger" title={erro}>
            Se a mensagem falar em permissão, gere o token de novo marcando pages_show_list,
            pages_read_engagement, instagram_basic e instagram_manage_insights.
          </Alert>
        )}

        {paginas !== null && (
          <GrupoDeCampos
            titulo="O que este acesso enxerga"
            legenda="Marque as Páginas que devem aparecer no painel e diga de quem é cada uma."
          >
            {paginas.length === 0 && (
              <Alert variant="warning" title="Nenhuma Página neste acesso">
                O token vale, mas não alcança Página nenhuma. Em modo de desenvolvimento isso
                costuma ser a conta sem função de Testador no app, ou o token gerado sem a
                permissão pages_show_list.
              </Alert>
            )}

            {semInstagram > 0 && (
              <Alert variant="info" title="Nem toda Página tem Instagram">
                {semInstagram === 1
                  ? "Uma Página não tem perfil comercial vinculado."
                  : `${semInstagram} Páginas não têm perfil comercial vinculado.`}{" "}
                Elas podem ser ligadas, mas o painel de perfil só funciona nas que têm.
              </Alert>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {paginas.map((p) => {
                const marcada = marcadas.has(p.pageId);
                const cliente = clientes.get(p.pageId) ?? null;

                return (
                  <div
                    key={p.pageId}
                    style={{ padding: "7px 8px", borderRadius: "var(--radius-sm)" }}
                  >
                    <label
                      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => alternar(p.pageId)}
                      />

                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block" }}>{p.nome}</span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "var(--text-xs)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {/*
                            ⚠️ O @ embaixo, e não numa coluna. É o que identifica
                            o perfil na conversa com o cliente, e a ausência dele
                            é a informação mais importante desta linha.
                          */}
                          {p.igUsername ? `@${p.igUsername}` : "Sem Instagram vinculado"}
                        </span>
                      </span>

                      {jaLigadas.includes(p.pageId) && <Badge tom="success">Já ligada</Badge>}
                    </label>

                    {marcada && (
                      <div style={{ marginTop: 6, marginLeft: 26 }}>
                        <SeletorBuscavel
                          valor={cliente?.id ?? null}
                          rotulo={cliente?.nome ?? null}
                          buscar={buscarClientes}
                          aoEscolher={(escolhido) =>
                            setClientes((antes) => {
                              const novo = new Map(antes);
                              if (escolhido) novo.set(p.pageId, escolhido);
                              else novo.delete(p.pageId);
                              return novo;
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GrupoDeCampos>
        )}
      </Formulario>
    </Drawer>
  );
}
