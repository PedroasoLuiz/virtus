"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  Alert,
  Badge,
  Button,
  CampoSecreto,
  Field,
  Formulario,
  GrupoDeCampos,
  selectStyle,
  SeletorBuscavel,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import type { Acesso, ContaDisponivel } from "@/modules/insights/insights.types";

/**
 * Descobre as contas de anúncio que um acesso enxerga e liga as escolhidas.
 *
 * ⚠️ Isto existe para acabar com o `act_` digitado à mão. Copiar o
 * identificador do Gerenciador erra fácil, e o erro só aparece depois, como
 * "conta não encontrada" numa tela que parecia salva — a pessoa jura que
 * cadastrou, e cadastrou mesmo, só que a conta errada.
 */
export function DescobrirContasDrawer({
  acessos,
  onClose,
}: {
  acessos: Acesso[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();

  /*
   * ⚠️ Se já existe conexão, o padrão é reaproveitar o acesso dela.
   *
   * O acesso guardado é o mesmo que enxerga as outras contas do mesmo Business
   * Manager. Pedir para colar de novo mandaria a pessoa ao Explorer buscar algo
   * que o sistema já tem.
   */
  const [origem, setOrigem] = useState<string>(
    acessos.length > 0 ? String(acessos[0].id) : "novo",
  );
  const [token, setToken] = useState("");

  const [contas, setContas] = useState<ContaDisponivel[] | null>(null);
  const [jaConectadas, setJaConectadas] = useState<string[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  /*
   * ⚠️ O cliente se escolhe AQUI, na mesma passada, e o seletor só aparece na
   * linha marcada.
   *
   * Ligar dez contas e depois abrir dez vezes o editar para dizer de quem é cada
   * uma é o tipo de trabalho que ninguém faz — e conta sem cliente não serve
   * para apresentar a ninguém, que é o motivo da tela existir. Escondido até
   * marcar, ele não polui a lista de quem só está conferindo o que enxerga.
   */
  const [clientes, setClientes] = useState<Map<string, { id: number; nome: string }>>(
    new Map(),
  );

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

  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const colando = origem === "novo";

  async function buscar() {
    setBuscando(true);
    setErro(null);

    const r = await fetch("/api/v1/insights/contas-disponiveis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        colando ? { token: token.trim() } : { acessoId: Number(origem) },
      ),
    });

    const dados = await r.json().catch(() => null);
    setBuscando(false);

    if (!r.ok) {
      setErro(dados?.error?.message ?? "Não foi possível consultar a Meta");
      setContas(null);
      return;
    }

    setContas(dados.data.contas as ContaDisponivel[]);
    setJaConectadas(dados.data.jaConectadas as string[]);
    setMarcadas(new Set());
  }

  async function ligar() {
    setSalvando(true);

    /*
     * ⚠️ Reaproveitando um acesso, o token NÃO viaja pelo navegador: a tela
     * manda o id da conexão de origem e o servidor lê o segredo lá dentro. Um
     * "devolve o token para eu reenviar" seria mais simples de escrever e
     * colocaria a credencial no DevTools de quem estivesse com a tela aberta.
     */
    const escolhidas = (contas ?? [])
      .filter((c) => marcadas.has(c.adAccountId))
      .map((c) => ({
        adAccountId: c.adAccountId,
        nome: c.nome,
        clienteId: clientes.get(c.adAccountId)?.id ?? null,
      }));

    const r = await fetch("/api/v1/insights/conexoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        colando
          ? { token: token.trim(), contas: escolhidas }
          : { acessoId: Number(origem), contas: escolhidas },
      ),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível ligar as contas");
      return;
    }

    setToken("");
    avisar(
      "sucesso",
      escolhidas.length === 1 ? "Conta ligada" : `${escolhidas.length} contas ligadas`,
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

  const podeBuscar = colando ? token.trim().length >= 20 : true;

  return (
    <Drawer
      open
      onClose={onClose}
      title="Buscar contas"
      acoes={
        contas === null ? (
          <Button size="xs" variant="primary" disabled={!podeBuscar || buscando} onClick={buscar}>
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
          legenda="A Meta só mostra as contas que este acesso já enxerga."
        >
          <Field label="Acesso">
            <select
              value={origem}
              onChange={(e) => {
                setOrigem(e.target.value);
                setContas(null);
              }}
              style={selectStyle}
            >
              {acessos.map((a) => (
                <option key={a.id} value={a.id}>
                  Usar {a.nome ?? `acesso ${a.id}`}
                </option>
              ))}
              <option value="novo">Colar um token novo</option>
            </select>
          </Field>

          {colando && (
            <Field label="Token de acesso" required>
              <CampoSecreto valor={token} placeholder="EAAG…" onMudar={setToken} />
            </Field>
          )}
        </GrupoDeCampos>

        {erro && (
          <Alert variant="danger" title={erro}>
            Se a mensagem falar em permissão, confira se o token foi gerado com ads_read.
          </Alert>
        )}

        {contas !== null && (
          <GrupoDeCampos
            titulo="O que este acesso enxerga"
            legenda="Marque as contas que devem aparecer no painel e diga de quem é cada uma."
          >
            {contas.length === 0 && (
              <Alert variant="warning" title="Nenhuma conta de anúncio neste acesso">
                O token é válido, mas não alcança conta nenhuma. Normalmente isso quer dizer
                que quem gerou o token não tem acesso às contas no Business Manager.
              </Alert>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {contas.map((c) => {
                const jaEsta = jaConectadas.includes(c.adAccountId);

                const marcada = marcadas.has(c.adAccountId);
                const cliente = clientes.get(c.adAccountId) ?? null;

                return (
                  <div
                    key={c.adAccountId}
                    style={{ padding: "7px 8px", borderRadius: "var(--radius-sm)" }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => alternar(c.adAccountId)}
                      />

                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block" }}>{c.nome}</span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "var(--text-xs)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {c.adAccountId}
                          {c.moeda ? ` · ${c.moeda}` : ""}
                        </span>
                      </span>

                      {/*
                        ⚠️ Já ligada continua marcável, e não bloqueada. Marcar de
                        novo é como se renova o token dela: a gravação é upsert
                        pela conta, então religar substitui o acesso no lugar.
                      */}
                      {jaEsta && <Badge tom="success">Já ligada</Badge>}
                      {!c.ativa && <Badge tom="neutral">Sem veiculação</Badge>}
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
                              if (escolhido) novo.set(c.adAccountId, escolhido);
                              else novo.delete(c.adAccountId);
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
