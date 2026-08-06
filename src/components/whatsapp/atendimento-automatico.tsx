"use client";

import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import {
  AcoesDaLinha,
  ActiveToggle,
  BotaoDeAcao,
  Button,
  EmptyRow,
  Field,
  IncluirButton,
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
import type { ContaWhatsapp } from "@/modules/whatsapp/whatsapp.types";

/**
 * Atendimento automatico: provedores, trava de teste e personas.
 *
 * ⚠️ As tres coisas moram juntas porque so se explicam juntas. A chave LIGA o
 * atendimento, a trava diz PARA QUEM ele responde, e a persona diz O QUE ele
 * pode resolver. Separadas em telas, descobrir por que o bot esta calado
 * exigiria passear pelas tres.
 *
 * Arquivo proprio, e nao mais uma secao em `configuracao.tsx`: aquele arquivo
 * ja passava de mil linhas cuidando de numeros e modelos.
 */

/** Quantos numeros de teste ha no campo, aceitando virgula, ponto e virgula ou linha. */
function contarNumeros(texto: string): number {
  return texto.split(/[,;\n]/).filter((n) => n.trim()).length;
}

export function AtendimentoAutomatico({ contas }: { contas: ContaWhatsapp[] }) {
  const { avisar } = useAvisos();
  const [provedores, setProvedores] = useState<ConfigIA[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<ConfigIA | null>(null);
  const [numeroTeste, setNumeroTeste] = useState("");
  const [salvandoTeste, setSalvandoTeste] = useState(false);

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
    setNumeroTeste(corpo.data?.[0]?.numeroTeste ?? "");
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function salvarTrava() {
    if (salvandoTeste) return;
    setSalvandoTeste(true);

    const r = await fetch("/api/v1/ia/numero-teste", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numeroTeste: numeroTeste.trim() || null }),
    });

    setSalvandoTeste(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível salvar");
      return;
    }

    avisar("sucesso", numeroTeste.trim() ? "Trava de teste ativa." : "Trava de teste removida.");
    void carregar();
  }

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
        <p style={{ fontSize: "var(--text-sm)", color: "var(--danger)", marginBottom: 12 }}>
          {erro}
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span className="rotulo">Provedores</span>
        <IncluirButton
          rotulo="Adicionar"
          onClick={() =>
            setEditando({ ...CONFIG_IA_PADRAO, ordem: (provedores?.length ?? 0) + 1 })
          }
        />
      </div>

      <p
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          lineHeight: "var(--lh-normal)",
          marginBottom: 12,
        }}
      >
        O de ordem 1 responde. Os outros existem para o dia em que ele estiver
        fora do ar ou sem cota, e são tentados na ordem.
      </p>

      <TableArea>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TableHead>
            <tr>
              <Th>Ordem</Th>
              <Th>Provedor</Th>
              <Th>Modelo</Th>
              <Th>Chave</Th>
              <Th>Ativo</Th>
              <Th> </Th>
            </tr>
          </TableHead>

          <tbody>
            {provedores == null ? (
              <EmptyRow colSpan={6} message="Carregando…" />
            ) : provedores.length === 0 ? (
              <EmptyRow
                colSpan={6}
                message="Nenhum provedor cadastrado. Sem chave, o bot não responde."
              />
            ) : (
              provedores.map((p) => (
                <Tr key={p.provedor}>
                  <Td>{p.ordem}</Td>
                  <Td>{PROVEDORES.find((x) => x.valor === p.provedor)?.rotulo ?? p.provedor}</Td>
                  <Td>{p.modelo}</Td>
                  <Td>{p.temChave ? "Guardada" : "Falta cadastrar"}</Td>
                  <Td>{p.ativo ? "Sim" : "Não"}</Td>
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
        </table>
      </TableArea>

      <div style={{ marginTop: 20 }}>
        <Field
          label="Só responde a"
          hint="Um por linha. Enquanto houver número aqui, o bot ignora todos os outros. Vazio atende todo mundo."
        >
          {/*
            Textarea e nao input: validar com uma pessoa so nao basta, e o teste
            que vale e com quem nao conhece o sistema.
          */}
          <textarea
            style={{ ...textareaStyle, minHeight: 56 }}
            placeholder={"+55 (35) 99999-9999\n+55 (35) 98888-8888"}
            value={numeroTeste}
            onChange={(e) => setNumeroTeste(e.target.value)}
          />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <Button size="sm" onClick={() => void salvarTrava()} disabled={salvandoTeste}>
            {salvandoTeste ? "Salvando…" : "Salvar trava"}
          </Button>
        </div>

        <p
          style={{
            marginTop: 10,
            fontSize: "var(--text-xs)",
            color: ligados.length > 0 ? "var(--text-tertiary)" : "var(--warning)",
            lineHeight: "var(--lh-normal)",
          }}
        >
          {ligados.length === 0
            ? "Nenhum provedor ativo com chave: o bot não vai responder ninguém."
            : numeroTeste.trim()
              ? `Em teste: ${contarNumeros(numeroTeste)} número(s) recebem resposta automática.`
              : `Respondendo a todos os contatos, por ${ligados.length} provedor(es).`}
        </p>
      </div>

      <div style={{ marginTop: 26 }}>
        <Personas contas={contas} />
      </div>
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
        hint="Fica guardada cifrada, e nunca volta para a tela."
      >
        <input
          style={inputStyle}
          type="password"
          autoComplete="off"
          placeholder={jaTemChave ? "Deixe em branco para manter a atual" : "cole a chave"}
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
 * Persona é autorização, não obrigação: quem não cadastra nenhuma segue com o
 * bot que só tria e passa adiante.
 */
function Personas({ contas }: { contas: ContaWhatsapp[] }) {
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span className="rotulo">Personas</span>
        <IncluirButton
          rotulo="Adicionar"
          onClick={() =>
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
        />
      </div>

      <p
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          lineHeight: "var(--lh-normal)",
          marginBottom: 12,
        }}
      >
        Sem persona para o setor, a IA só entende e encaminha. Com persona, ela
        pode fechar sozinha o que estiver escrito em &quot;pode resolver&quot;, e
        nada além disso.
      </p>

      <TableArea>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TableHead>
            <tr>
              <Th>Nome</Th>
              <Th>Setor</Th>
              <Th>Número</Th>
              <Th>Ativa</Th>
              <Th> </Th>
            </tr>
          </TableHead>

          <tbody>
            {personas == null ? (
              <EmptyRow colSpan={5} message="Carregando…" />
            ) : personas.length === 0 ? (
              <EmptyRow
                colSpan={5}
                message="Nenhuma persona. A IA vai triar e encaminhar tudo."
              />
            ) : (
              personas.map((p) => (
                <Tr key={p.id}>
                  <Td>{p.nome}</Td>
                  <Td>{setores.find((s) => s.id === p.setorId)?.nome ?? "Geral"}</Td>
                  <Td>
                    {contas.find((c) => c.id === p.contaId)?.apelido ?? "Todos"}
                  </Td>
                  <Td>{p.ativo ? "Sim" : "Não"}</Td>
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
        </table>
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

      <Field
        label="Setor"
        hint="Vazio vale para qualquer assunto que não tenha persona própria."
      >
        <select
          style={selectStyle}
          value={rascunho.setorId ?? ""}
          onChange={(e) =>
            setRascunho({ ...rascunho, setorId: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">Geral</option>
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
          <option value="">Todos</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.apelido || c.numero || `Número ${c.id}`}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Quem ela é"
        hint="O jeito de falar. Ex.: direta e prática, evita jargão, sempre confirma antes de encerrar."
      >
        <textarea
          style={{ ...textareaStyle, minHeight: 80 }}
          value={rascunho.descricao ?? ""}
          onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
        />
      </Field>

      <Field
        label="Pode resolver"
        hint="O que ela fecha sozinha, em lista. Fora disso, encaminha. Nunca autoriza dizer valor, vencimento ou boleto: isso continua vindo só do sistema."
      >
        <textarea
          style={{ ...textareaStyle, minHeight: 110 }}
          placeholder={
            "Ex.:\n- horário de atendimento e endereço\n- como enviar a nota fiscal\n- prazo padrão de retorno do setor"
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
