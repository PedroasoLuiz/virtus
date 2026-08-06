"use client";

import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import {
  AcoesDaLinha,
  ActiveToggle,
  Alert,
  Badge,
  BotaoDeAcao,
  Button,
  EmptyRow,
  Field,
  CabecalhoDeSecao,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
  textareaStyle,
} from "@/components/ui/kit";
import {
  CONFIG_IA_PADRAO,
  MODELOS_POR_PROVEDOR,
  PROVEDORES,
  type ConfigIA,
} from "@/modules/ia/ia.types";
import type { Persona } from "@/modules/atendimento/personas.types";
import { formatarTelefone, type ContaWhatsapp } from "@/modules/whatsapp/whatsapp.types";

/**
 * Atendimento automatico: o estado, os provedores e quem recebe resposta.
 *
 * ⚠️ O `Alert` do topo nao e enfeite: e a resposta a unica pergunta que traz
 * alguem a esta tela, que e "por que o bot nao respondeu?". Ele vem ANTES dos
 * cadastros porque a causa quase sempre e estado — sem chave, desligado, ou
 * preso na trava de teste — e nao configuracao errada.
 *
 * Personas moram na aba ao lado. Empilhadas aqui, viravam a terceira tabela de
 * uma rolagem so, e as tres pareciam a mesma coisa.
 */

export function AtendimentoAutomatico() {
  const { avisar } = useAvisos();
  const [provedores, setProvedores] = useState<ConfigIA[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<ConfigIA | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/v1/ia/config");
    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      /*
       * Falha APARECE. Silenciada, a tela vazia diria "não há provedor", que é
       * outra coisa: já custou uma aba em branco sem explicação nenhuma.
       */
      const detalhe = corpo?.error?.details?.[0];
      setErro(
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível carregar"),
      );
      setProvedores([]);
      return;
    }

    setErro(null);
    setProvedores(corpo.data ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function remover(provedor: string) {
    const r = await fetch(`/api/v1/ia/provedores/${provedor}`, { method: "DELETE" });

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível remover");
      return;
    }

    avisar("sucesso", "Provedor removido.");
    void carregar();
  }

  if (editando) {
    return (
      <FormularioDoProvedor
        config={editando}
        existentes={provedores ?? []}
        onFechar={() => setEditando(null)}
        onSalvou={() => {
          setEditando(null);
          void carregar();
        }}
      />
    );
  }

  const ligados = (provedores ?? []).filter((p) => p.ativo && p.temChave);

  return (
    <>
      {erro && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="danger" title="Não foi possível carregar">
            {erro}
          </Alert>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        {ligados.length === 0 ? (
          <Alert variant="warning" title="Sem provedor, o bot não responde">
            Cadastre uma chave e deixe pelo menos um provedor ativo.
          </Alert>
        ) : (
          <Alert
            variant="success"
            title={
              ligados.length === 1
                ? "Um provedor ativo"
                : `${ligados.length} provedores ativos, tentados na ordem`
            }
          >
            Quem recebe resposta automática é decidido em cada número, na aba
            Números.
          </Alert>
        )}
      </div>

      <CabecalhoDeSecao
        titulo="Provedores de IA"
        legenda="A chave que faz o atendimento automático funcionar. O de ordem 1 responde; os outros existem para o dia em que ele estiver fora do ar ou sem cota, e são tentados na sequência. Quem recebe resposta é decidido em cada número, na aba Números."
        onIncluir={() =>
          setEditando({ ...CONFIG_IA_PADRAO, ordem: (provedores?.length ?? 0) + 1 })
        }
        rotuloIncluir="Adicionar provedor"
      />

      <TableArea minWidth={0}>
          <TableHead>
                <Th>Provedor</Th>
                <Th>Situação</Th>
          <Th> </Th>
          </TableHead>

            <tbody>
              {provedores == null ? (
                <EmptyRow colSpan={3} message="Carregando…" />
              ) : provedores.length === 0 ? (
                <EmptyRow
                  colSpan={3}
                  message="Nenhum provedor. Sem chave, o bot não responde a ninguém."
                />
              ) : (
                provedores.map((p) => (
                  <Tr key={p.provedor}>
                    {/*
                      Provedor e modelo na MESMA celula, um sob o outro: e a
                      anatomia dos cartoes de conversa, e evita a tabela de seis
                      colunas que ninguem le da esquerda para a direita.
                    */}
                    <Td>
                      {/* ⚠️ Flag SEMPRE depois do titulo: quem le procura o
                          nome primeiro, e a etiqueta na frente empurra o nome
                          para uma posicao que muda a cada linha. */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: "var(--fw-semi)" }}>
                          {PROVEDORES.find((x) => x.valor === p.provedor)?.rotulo ?? p.provedor}
                        </span>
                        <Badge tom={p.ordem === 1 ? "info" : "neutral"}>
                          {p.ordem === 1 ? "principal" : `reserva ${p.ordem}`}
                        </Badge>
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {p.modelo}
                      </div>
                    </Td>

                    <Td>
                      {!p.temChave ? (
                        <Badge tom="danger">falta a chave</Badge>
                      ) : p.ativo ? (
                        <Badge tom="success">ativo</Badge>
                      ) : (
                        <Badge tom="neutral">desligado</Badge>
                      )}
                    </Td>

                    <Td>
                      <AcoesDaLinha>
                        <BotaoDeAcao rotulo="Editar" onClick={() => setEditando(p)}>
                          <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                        </BotaoDeAcao>
                        <BotaoDeAcao rotulo="Remover" onClick={() => void remover(p.provedor)}>
                          <path d="M3.4 4.6h9.2M6.4 4.6V3.4h3.2v1.2M5 4.6l.5 8.4h5l.5-8.4" />
                        </BotaoDeAcao>
                      </AcoesDaLinha>
                    </Td>
                  </Tr>
                ))
              )}
        </tbody>
      </TableArea>

    </>
  );
}

/** Cadastro de um provedor. A chave e de mao unica: entra, nunca volta. */
function FormularioDoProvedor({
  config,
  existentes,
  onFechar,
  onSalvou,
}: {
  config: ConfigIA;
  existentes: ConfigIA[];
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const { avisar } = useAvisos();
  const [rascunho, setRascunho] = useState(config);
  const [chave, setChave] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Já cadastrado significa que há chave no vault: em branco mantém, não apaga.
  const jaTemChave = existentes.some((p) => p.provedor === rascunho.provedor && p.temChave);

  async function salvar() {
    if (salvando) return;
    setSalvando(true);

    const r = await fetch("/api/v1/ia/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provedor: rascunho.provedor,
        modelo: rascunho.modelo.trim(),
        ativo: rascunho.ativo,
        ordem: rascunho.ordem,
        chave: chave.trim() || null,
      }),
    });

    setSalvando(false);
    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      const detalhe = corpo?.error?.details?.[0];
      avisar(
        "atencao",
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível salvar"),
      );
      return;
    }

    avisar("sucesso", "Provedor salvo.");
    onSalvou();
  }

  const sugestoes = MODELOS_POR_PROVEDOR[rascunho.provedor] ?? [];

  return (
    <Drawer
      open
      onClose={onFechar}
      title={jaTemChave ? "Editar provedor" : "Adicionar provedor"}
      subtitle="A chave fica cifrada e nunca volta para a tela"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void salvar()}
            disabled={salvando || (!jaTemChave && chave.trim().length < 20)}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <Field label="Provedor">
        <select
          style={selectStyle}
          value={rascunho.provedor}
          onChange={(e) => {
            const provedor = e.target.value as ConfigIA["provedor"];
            const padrao = PROVEDORES.find((p) => p.valor === provedor)?.modeloPadrao ?? "";
            /*
             * Troca o modelo junto: `gpt-5-mini` não existe no Gemini, e manter
             * o antigo produziria erro só no primeiro atendimento de verdade.
             */
            setRascunho({ ...rascunho, provedor, modelo: padrao });
          }}
        >
          {PROVEDORES.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Modelo" hint="A lista é sugestão: modelo novo pode ser digitado direto.">
        <input
          style={inputStyle}
          list="modelos-sugeridos"
          value={rascunho.modelo}
          onChange={(e) => setRascunho({ ...rascunho, modelo: e.target.value })}
        />
        <datalist id="modelos-sugeridos">
          {sugestoes.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.rotulo}
            </option>
          ))}
        </datalist>
      </Field>

      <Field label="Ordem" hint="1 responde. Os demais são tentados quando ele falha.">
        <input
          style={inputStyle}
          type="number"
          min={1}
          max={9}
          value={rascunho.ordem}
          onChange={(e) => setRascunho({ ...rascunho, ordem: Number(e.target.value) || 1 })}
        />
      </Field>

      <Field
        label="Chave da API"
        required={!jaTemChave}
        hint={jaTemChave ? "Em branco mantém a atual." : undefined}
      >
        <input
          style={inputStyle}
          type="password"
          autoComplete="off"
          placeholder={jaTemChave ? "Deixe em branco para manter" : "cole a chave"}
          value={chave}
          onChange={(e) => setChave(e.target.value)}
        />
      </Field>

      <Field label="Ativo" hint="Desligado, este provedor não é tentado.">
        <ActiveToggle
          active={rascunho.ativo}
          onChange={() => setRascunho({ ...rascunho, ativo: !rascunho.ativo })}
        />
      </Field>
    </Drawer>
  );
}

// ── Personas ────────────────────────────────────────────────────

type Setor = { id: number; nome: string };

/**
 * O que a IA pode resolver sozinha, por setor.
 *
 * ⚠️ Sem persona para um setor, o comportamento continua sendo encaminhar.
 * Persona e autorizacao, nao obrigacao: quem nao cadastra nenhuma segue com o
 * bot que so tria e passa adiante.
 */
export function Personas({ contas }: { contas: ContaWhatsapp[] }) {
  const { avisar } = useAvisos();
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [editando, setEditando] = useState<Persona | null>(null);

  const carregar = useCallback(async () => {
    const [rp, rs] = await Promise.all([
      fetch("/api/v1/atendimento/personas"),
      fetch("/api/v1/atendimento/setores"),
    ]);

    const cp = await rp.json().catch(() => null);
    setPersonas(rp.ok ? (cp?.data ?? []) : []);

    // Setor é opcional na persona, então falhar aqui não impede cadastrar: a
    // lista fica vazia e a persona nasce geral.
    const cs = await rs.json().catch(() => null);
    setSetores(rs.ok ? (cs?.data ?? []) : []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function excluir(id: number) {
    const r = await fetch(`/api/v1/atendimento/personas/${id}`, { method: "DELETE" });

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível excluir");
      return;
    }

    avisar("sucesso", "Persona excluída.");
    void carregar();
  }

  if (editando) {
    return (
      <FormularioDaPersona
        persona={editando}
        setores={setores}
        contas={contas}
        onFechar={() => setEditando(null)}
        onSalvou={() => {
          setEditando(null);
          void carregar();
        }}
      />
    );
  }

  return (
    <>
      <CabecalhoDeSecao
        titulo="Personas do atendimento"
        legenda="O que a IA pode resolver sozinha, por setor. Sem persona, ela continua só entendendo e encaminhando. Com persona, fecha sozinha o que estiver na lista e nada além, e nunca é autorizada a falar de valor, vencimento ou boleto."
        onIncluir={() =>
          setEditando({
            id: 0,
            contaId: null,
            setorId: null,
            nome: "",
            descricao: null,
            podeResolver: null,
            ativo: true,
          })
        }
        rotuloIncluir="Adicionar persona"
      />

      <TableArea minWidth={0}>
          <TableHead>
                <Th>Persona</Th>
                <Th>Onde vale</Th>
          <Th> </Th>
          </TableHead>

            <tbody>
              {personas == null ? (
                <EmptyRow colSpan={3} message="Carregando…" />
              ) : personas.length === 0 ? (
                <EmptyRow
                  colSpan={3}
                  message="Nenhuma persona. A IA vai triar e encaminhar tudo."
                />
              ) : (
                personas.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: "var(--fw-semi)" }}>{p.nome}</span>
                        {!p.ativo && <Badge tom="neutral">desligada</Badge>}
                      </div>
                      {/* O que ela resolve, cortado em uma linha: e o que
                          distingue duas personas do mesmo setor. */}
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 320,
                        }}
                      >
                        {p.podeResolver?.replace(/\s*\n\s*/g, " · ") ||
                          "Sem lista: só acolhe e encaminha"}
                      </div>
                    </Td>

                    <Td>
                      <div>{setores.find((s) => s.id === p.setorId)?.nome ?? "Qualquer setor"}</div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {contas.find((c) => c.id === p.contaId)?.apelido ??
                          (p.contaId
                            ? formatarTelefone(
                                contas.find((c) => c.id === p.contaId)?.numero ?? "",
                              )
                            : "Todos os números")}
                      </div>
                    </Td>

                    <Td>
                      <AcoesDaLinha>
                        <BotaoDeAcao rotulo="Editar" onClick={() => setEditando(p)}>
                          <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                        </BotaoDeAcao>
                        <BotaoDeAcao rotulo="Excluir" onClick={() => void excluir(p.id)}>
                          <path d="M3.4 4.6h9.2M6.4 4.6V3.4h3.2v1.2M5 4.6l.5 8.4h5l.5-8.4" />
                        </BotaoDeAcao>
                      </AcoesDaLinha>
                    </Td>
                  </Tr>
                ))
              )}
        </tbody>
      </TableArea>
    </>
  );
}

function FormularioDaPersona({
  persona,
  setores,
  contas,
  onFechar,
  onSalvou,
}: {
  persona: Persona;
  setores: Setor[];
  contas: ContaWhatsapp[];
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const { avisar } = useAvisos();
  const [rascunho, setRascunho] = useState(persona);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (salvando) return;
    setSalvando(true);

    const r = await fetch("/api/v1/atendimento/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rascunho.id || null,
        contaId: rascunho.contaId,
        setorId: rascunho.setorId,
        nome: rascunho.nome.trim(),
        descricao: rascunho.descricao?.trim() || null,
        podeResolver: rascunho.podeResolver?.trim() || null,
        ativo: rascunho.ativo,
      }),
    });

    setSalvando(false);
    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      const detalhe = corpo?.error?.details?.[0];
      avisar(
        "atencao",
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível salvar"),
      );
      return;
    }

    avisar("sucesso", "Persona salva.");
    onSalvou();
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      title={rascunho.id ? "Editar persona" : "Nova persona"}
      subtitle="Nunca autoriza dizer valor, vencimento ou boleto"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void salvar()}
            disabled={salvando || rascunho.nome.trim().length < 2}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <Field label="Nome" required hint="Só para você identificar aqui dentro.">
        <input
          style={inputStyle}
          value={rascunho.nome}
          onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
        />
      </Field>

      <Field label="Setor" hint="Vazio vale para o que não tiver persona própria.">
        <select
          style={selectStyle}
          value={rascunho.setorId ?? ""}
          onChange={(e) =>
            setRascunho({ ...rascunho, setorId: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">Qualquer setor</option>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Número" hint="Vazio vale para todos os números da empresa.">
        <select
          style={selectStyle}
          value={rascunho.contaId ?? ""}
          onChange={(e) =>
            setRascunho({ ...rascunho, contaId: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">Todos os números</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.apelido || formatarTelefone(c.numero ?? "") || `Número ${c.id}`}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Quem ela é"
        hint="O jeito de falar. Ex.: direta e prática, evita jargão, confirma antes de encerrar."
      >
        <textarea
          style={{ ...textareaStyle, minHeight: 80 }}
          value={rascunho.descricao ?? ""}
          onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
        />
      </Field>

      <Field
        label="Pode resolver"
        hint="Um item por linha. Fora dessa lista, ela encaminha."
      >
        <textarea
          style={{ ...textareaStyle, minHeight: 110 }}
          placeholder={
            "horário de atendimento e endereço\ncomo enviar a nota fiscal\nprazo padrão de retorno do setor"
          }
          value={rascunho.podeResolver ?? ""}
          onChange={(e) => setRascunho({ ...rascunho, podeResolver: e.target.value })}
        />
      </Field>

      <Field label="Ativa" hint="Desligada, o assunto volta a ser só encaminhado.">
        <ActiveToggle
          active={rascunho.ativo}
          onChange={() => setRascunho({ ...rascunho, ativo: !rascunho.ativo })}
        />
      </Field>
    </Drawer>
  );
}
