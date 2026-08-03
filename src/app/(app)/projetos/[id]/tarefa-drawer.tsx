"use client";

import { useState } from "react";
import { BotaoDeCabecalho, Drawer } from "@/components/ui/drawer";
import {
  Badge,
  Button,
  CampoBloqueado,
  CampoNumerico,
  Field,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { useAvisos } from "@/components/ui/avisos";
import { Historico } from "@/components/ui/historico";
import { hoje, paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import type { Demanda, Projeto } from "@/modules/projetos/projetos.types";

/**
 * Detalhe da tarefa.
 *
 * Um título com prazo serve para lembrar que algo existe; não serve para
 * conduzir trabalho. Aqui vive o que se usa o dia inteiro: quem faz, quando,
 * o que exatamente, os subitens e a conversa.
 *
 * Salva CAMPO A CAMPO, no `blur` — não há botão Salvar. Quem abre uma tarefa
 * para marcar um item do checklist não deveria ter que confirmar a mudança, e
 * um formulário com Salvar transformaria cada ajuste em três cliques.
 */

/** Tarefa em branco, para o modo de criação. */
function tarefaVazia(colunaId: number | null): Demanda {
  return {
    id: 0,
    titulo: "",
    descricao: null,
    colunaId,
    responsavelId: null,
    responsavelNome: null,
    inicio: null,
    prazo: null,
    concluidaEm: null,
    criadaEm: new Date().toISOString(),
    criadaPor: null,
    alteradaEm: null,
    alteradaPor: null,
    valor: 0 as Demanda["valor"],
    ticketId: null,
    itens: [],
    comentarios: [],
    anexos: [],
  };
}

export function TarefaDrawer({
  tarefa: existente,
  projeto,
  responsaveis,
  criando,
  aoAtualizar,
  onClose,
}: {
  /** Ausente em modo de criação. */
  tarefa?: Demanda;
  projeto: Projeto;
  responsaveis: { id: string; nome: string }[];
  criando?: boolean;
  /** Recebe o projeto inteiro: toda escrita devolve o agregado atualizado. */
  aoAtualizar: (p: Projeto) => void;
  onClose: () => void;
}) {
  const { avisar, confirmar } = useAvisos();
  const [verAnexos, setVerAnexos] = useState(false);
  const [novoItem, setNovoItem] = useState("");
  const [comentario, setComentario] = useState("");
  const [anexoUrl, setAnexoUrl] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tituloFocado, setTituloFocado] = useState(false);

  /*
   * Marcar um item vira estado local ANTES da resposta do servidor.
   *
   * O caminho inteiro — PATCH, recarregar o projeto, redesenhar — leva o
   * bastante para a marca nao aparecer no clique, e quem nao ve resposta clica
   * de novo. Cada clique extra e um PATCH extra, e o item termina no estado de
   * quem chegou por ultimo.
   *
   * A sobreposicao vive so ate a resposta chegar: dali em diante quem manda e o
   * servidor, inclusive quando ele recusa.
   */
  const [otimista, setOtimista] = useState<Record<number, boolean>>({});

  /*
   * Em criação a tarefa ainda não existe, então cada campo alimenta um rascunho
   * local e só o botão Criar escreve. Em edição o rascunho serve apenas de
   * espelho: quem manda é o registro, e cada campo grava sozinho.
   *
   * Um formulário só para os dois modos evita a duplicação que faria criar e
   * editar divergirem no primeiro campo novo.
   */
  const [rascunho, setRascunho] = useState<Demanda>(
    () => existente ?? tarefaVazia(projeto.colunas.find((c) => c.ativo)?.id ?? null),
  );

  const tarefa = criando ? rascunho : (existente ?? rascunho);
  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [descricao, setDescricao] = useState(tarefa.descricao ?? "");

  async function chamar(url: string, metodo: string, corpo?: unknown) {
    const r = await fetch(url, {
      method: metodo,
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível salvar",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    aoAtualizar(dados.data as Projeto);
  }

  /**
   * Cobra ESTA tarefa sozinha. Uma so tambem e lote — o caminho e o mesmo, e
   * duplicar a rota faria a regra de "mesmo projeto" existir em dois lugares.
   *
   * O endpoint devolve `{ projeto, ticketId }`, nao o projeto solto.
   */
  async function chamarTicket(url: string) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demandas: [tarefa.id] }),
    });
    const dados = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível gerar o ticket");
      return;
    }

    avisar("sucesso", `Ticket ${dados.data.ticketId} gerado`, "Ele já está na tela de tickets.");
    aoAtualizar(dados.data.projeto as Projeto);
  }

  /** Em criação grava no rascunho; em edição vai direto para o servidor. */
  function salvarCampo(campos: Record<string, unknown>) {
    if (criando) {
      setRascunho((r) => ({ ...r, ...(campos as Partial<Demanda>) }));
      return;
    }
    void chamar(`/api/v1/projetos/demandas/${tarefa.id}`, "PATCH", campos);
  }

  async function criar() {
    const limpo = titulo.trim();
    if (!limpo) return;

    setSalvando(true);
    const r = await fetch(`/api/v1/projetos/${projeto.id}/demandas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: limpo,
        descricao: descricao.trim() || null,
        colunaId: rascunho.colunaId,
        responsavelId: rascunho.responsavelId,
        inicio: rascunho.inicio,
        prazo: rascunho.prazo,
      }),
    });
    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      // `details` traz o campo que o Zod recusou; só "dados inválidos"
      // obrigaria o usuário a adivinhar qual.
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível criar a tarefa",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    aoAtualizar(dados.data as Projeto);
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      /*
       * Título fixo, não o nome da tarefa: o nome é editável logo abaixo, e
       * repeti-lo aqui faria a mesma frase aparecer duas vezes na mesma tela —
       * uma delas mentindo enquanto o campo estivesse sendo digitado.
       */
      title={criando ? "Nova tarefa" : "Descrição Tarefa"}
      headerExtra={
        criando ? undefined : (
          <>
            {/*
             * Concluir tambem daqui, e nao so pelo cartao: quem abre a tarefa
             * para fechar o checklist esta a um clique de terminar, e mandar
             * fechar o drawer para marcar no cartao e um caminho de volta sem
             * razao.
             *
             * Com texto, e nao so o circulo: no cartao o circulo funciona porque
             * a linha inteira e o titulo; solto num cabecalho ele nao diz o que
             * faz.
             */}
            <BotaoConcluir
              feita={tarefa.concluidaEm != null}
              travada={tarefa.ticketId != null}
              motivo={
                tarefa.ticketId != null
                  ? `Cobrada no ticket ${tarefa.ticketId}. Remova a cobrança para reabrir.`
                  : undefined
              }
              onClick={() => salvarCampo({ concluida: tarefa.concluidaEm == null })}
            />

            <BotaoDeCabecalho
              rotulo="Anexos"
              ativo={verAnexos}
              contador={tarefa.anexos.length}
              onClick={() => setVerAnexos((v) => !v)}
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </BotaoDeCabecalho>

            {/* Excluir mora aqui, nao no rodape: a acao e do REGISTRO, como
                anexo e historico, e no rodape ela dividia a linha com "Gerar
                ticket" — vermelho ao lado de verde, os dois do mesmo tamanho. */}
            <BotaoDeCabecalho
              rotulo={tarefa.ticketId != null ? "Tarefa ja cobrada em um ticket" : "Excluir tarefa"}
              ativo={false}
              perigo
              desabilitado={tarefa.ticketId != null}
              onClick={() =>
                confirmar(`Excluir "${tarefa.titulo}"?`, "Excluir", async () => {
                  await chamar(`/api/v1/projetos/demandas/${tarefa.id}`, "DELETE");
                  onClose();
                })
              }
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
              <path d="M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6" />
              <path d="M10 11v6M14 11v6" />
            </BotaoDeCabecalho>

            {/* A mesma ficha do ticket, do mesmo componente. */}
            <Historico
              marcos={[
                { rotulo: "Criada", quem: tarefa.criadaPor, quando: tarefa.criadaEm },
                { rotulo: "Última alteração", quem: tarefa.alteradaPor, quando: tarefa.alteradaEm },
                { rotulo: "Concluída", quem: null, quando: tarefa.concluidaEm },
                {
                  rotulo: "Virou cobrança",
                  quem: tarefa.ticketId != null ? `Ticket ${tarefa.ticketId}` : null,
                  quando: null,
                },
              ]}
            />
          </>
        )
      }
      footer={
        criando ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button size="sm" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="sm" variant="primary" onClick={criar} disabled={salvando || !titulo.trim()}>
              {salvando ? "Criando…" : "Criar tarefa"}
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {tarefa.ticketId != null && <Badge tom="success">TICKET {tarefa.ticketId}</Badge>}

            {/* A tarefa concluída vira cobrança daqui. Desabilitado com o motivo
                no `title`: sumir faria a pessoa procurar onde o botão foi parar. */}
            {projeto.modalidade === "POR_DEMANDA" && tarefa.ticketId == null && (
              <Button
                size="sm"
                variant="primary"
                disabled={!tarefa.concluidaEm || tarefa.valor <= 0}
                title={
                  !tarefa.concluidaEm
                    ? "A tarefa precisa estar concluída"
                    : tarefa.valor <= 0
                      ? "Informe o valor da tarefa"
                      : undefined
                }
                onClick={() => void chamarTicket(`/api/v1/projetos/${projeto.id}/cobranca`)}
              >
                Gerar ticket
              </Button>
            )}

            <span style={{ flex: 1 }} />
            <Button size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        )
      }
    >
      {verAnexos && (
        <Painel titulo="Anexos">
          {/* Anexos por LINK, não upload.
              O sistema ainda não tem fluxo de arquivo próprio, e link cobre o
              caso real — briefing no Drive, arte no Figma, contrato assinado.
              Upload entra quando houver Storage configurado; a tabela já tem
              `url` e `tipo`, então não muda modelo. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {tarefa.anexos.map((a) => (
              <Anexo
                key={a.id}
                anexo={a}
                aoExcluir={() => void chamar(`/api/v1/projetos/anexos/${a.id}`, "DELETE")}
              />
            ))}
          </div>

          <input
            value={anexoUrl}
            onChange={(e) => setAnexoUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !anexoUrl.trim()) return;
              void chamar(`/api/v1/projetos/demandas/${tarefa.id}/anexos`, "POST", {
                url: anexoUrl.trim(),
              });
              setAnexoUrl("");
            }}
            placeholder="Colar link e teclar Enter"
            style={{ ...inputStyle, marginTop: tarefa.anexos.length ? 8 : 0 }}
          />
        </Painel>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/*
         * O título foge do padrão de propósito: ele é o assunto da tela, e um
         * rótulo "Título" em cima só repetiria o que a frase já diz. Editável no
         * lugar onde é lido, alinhado com os rótulos abaixo.
         */}
        <input
          autoFocus={criando}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onFocus={() => setTituloFocado(true)}
          onBlur={() => {
            setTituloFocado(false);
            if (criando) return;
            const limpo = titulo.trim();
            if (!limpo || limpo === tarefa.titulo) return setTitulo(tarefa.titulo);
            salvarCampo({ titulo: limpo });
          }}
          onKeyDown={(e) => {
            if (criando && e.key === "Enter" && titulo.trim()) void criar();
          }}
          maxLength={160}
          placeholder="O que precisa ser feito?"
          style={{
            width: "100%",
            marginBottom: 14,
            padding: "4px 6px",
            marginLeft: -6,
            border: "none",
            borderRadius: "var(--radius-sm)",
            // Sem moldura em repouso: só ao focar aparece um fundo, o suficiente
            // para dizer "isto se edita" sem transformar o título num campo.
            background: tituloFocado ? "var(--surface-2)" : "transparent",
            color: "var(--text-primary)",
            font: "inherit",
            fontSize: "var(--text-xl)",
            fontWeight: "var(--fw-semi)",
            letterSpacing: "var(--tracking-snug)",
            lineHeight: "var(--lh-tight)",
            outline: "none",
            transition: "background var(--dur) var(--ease)",
          }}
        />

        <Field label="Etapa">
          <select
            value={tarefa.colunaId ?? ""}
            onChange={(e) => salvarCampo({ colunaId: Number(e.target.value) })}
            style={selectStyle}
          >
            {projeto.colunas
              .filter((c) => c.ativo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.descricao}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Responsável">
          <select
            value={tarefa.responsavelId ?? ""}
            onChange={(e) => salvarCampo({ responsavelId: e.target.value || null })}
            style={selectStyle}
          >
            <option value="">Sem responsável</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Início">
          <input
            type="date"
            value={tarefa.inicio ?? ""}
            onChange={(e) => salvarCampo({ inicio: e.target.value || null })}
            style={inputStyle}
          />
        </Field>

        <Field label="Fim">
          <input
            type="date"
            value={tarefa.prazo ?? ""}
            onChange={(e) => salvarCampo({ prazo: e.target.value || null })}
            style={inputStyle}
          />
        </Field>

        {/* Valor só existe em POR_DEMANDA: no escopo fechado ele vive no
            ticket do projeto, e um campo aqui sugeriria um rateio que a
            modalidade existe para evitar. */}
        {projeto.modalidade === "POR_DEMANDA" && (
          <Field label="Valor" hint={tarefa.ticketId != null ? "Travado: já virou ticket" : undefined}>
            {tarefa.ticketId != null ? (
              <CampoBloqueado
                valor={formatarSemSimbolo(tarefa.valor)}
                titulo={`Cobrado no ticket ${tarefa.ticketId} — ajuste o valor por la`}
              />
            ) : (
              <CampoNumerico
                valor={tarefa.valor}
                escala={100}
                aoMudar={(v) => salvarCampo({ valor: v })}
              />
            )}
          </Field>
        )}

        <Field label="Descrição">
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={() => {
              if (criando) return;
              if (descricao.trim() === (tarefa.descricao ?? "").trim()) return;
              salvarCampo({ descricao: descricao.trim() || null });
            }}
            rows={4}
            placeholder="O que precisa ser feito, e como"
            style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }}
          />
        </Field>

        {/* Checklist e conversa pendem da tarefa, então só existem depois que
            ela existe — pendurá-los num rascunho exigiria guardar o que ainda
            não tem dono. */}
        {criando ? (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-2)",
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
            }}
          >
            Checklist, anexos e comentários abrem depois de criar a tarefa.
          </div>
        ) : (
          <>
            <div style={{ marginTop: 18 }}>
              {/* Sem barra de progresso nem contador: os itens estao logo abaixo,
                  marcados ou nao, e a mesma informacao duas vezes so ocupa a
                  linha que o proximo item ia usar. */}
              <div className="rotulo" style={{ fontSize: "var(--text-xs)", marginBottom: 8 }}>
                Checklist
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {tarefa.itens.map((item) => (
                  <ItemChecklist
                    key={item.id}
                    item={{ ...item, feito: otimista[item.id] ?? item.feito }}
                    aoAlternar={() => void alternarItem(item.id, otimista[item.id] ?? item.feito)}
                    aoExcluir={() => void chamar(`/api/v1/projetos/itens/${item.id}`, "DELETE")}
                  />
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 2,
                  padding: "6px 8px",
                }}
              >
                <span style={{ color: "var(--text-tertiary)", fontSize: 15, lineHeight: 1 }}>+</span>
                <input
                  value={novoItem}
                  onChange={(e) => setNovoItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !novoItem.trim()) return;
                    void chamar(`/api/v1/projetos/demandas/${tarefa.id}/itens`, "POST", {
                      descricao: novoItem.trim(),
                    });
                    setNovoItem("");
                  }}
                  placeholder="Adicionar item"
                  maxLength={200}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    font: "inherit",
                    fontSize: "var(--text-base)",
                    color: "var(--text-primary)",
                    padding: 0,
                  }}
                />
              </div>
            </div>

            {/*
             * A conversa vai por último, e num bloco de fundo próprio: ela não é
             * campo do registro, é o que se acumula em volta dele. Misturada aos
             * campos, empurraria para baixo justamente o que se vem editar.
             */}
            <div
              style={{
                marginTop: 20,
                padding: 12,
                borderRadius: "var(--radius-lg)",
                // O mesmo verde das colunas do quadro: e o tom que o app usa
                // para "area", em oposicao a "campo".
                background: "var(--kanban-coluna-bg)",
              }}
            >
              <div className="rotulo" style={{ fontSize: "var(--text-xs)", marginBottom: 10 }}>
                Comentários {tarefa.comentarios.length > 0 && `(${tarefa.comentarios.length})`}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tarefa.comentarios.map((c) => (
                  <div key={c.id} style={{ display: "flex", gap: 8 }}>
                    <Avatar nome={c.autorNome} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "inline-block",
                          maxWidth: "100%",
                          padding: "7px 12px",
                          borderRadius: 16,
                          background: "var(--surface)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "var(--text-sm)",
                            fontWeight: "var(--fw-semi)",
                            color: "var(--text-secondary)",
                            marginBottom: 1,
                          }}
                        >
                          {c.autorNome ?? "Sem autor"}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--text-base)",
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {c.texto}
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          marginLeft: 12,
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {quando(c.em)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  marginTop: tarefa.comentarios.length ? 12 : 0,
                }}
              >
                <Avatar nome={null} />
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter envia, Shift+Enter quebra linha — é o que a mão já
                    // espera de um campo de conversa.
                    if (e.key !== "Enter" || e.shiftKey || !comentario.trim()) return;
                    e.preventDefault();
                    enviarComentario();
                  }}
                  rows={1}
                  placeholder="Escreva um comentário…"
                  style={{
                    flex: 1,
                    minHeight: 34,
                    maxHeight: 120,
                    padding: "8px 14px",
                    border: "none",
                    borderRadius: 17,
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    font: "inherit",
                    fontSize: "var(--text-base)",
                    resize: "none",
                    outline: "none",
                  }}
                />
                {comentario.trim() && (
                  <Button size="sm" variant="primary" onClick={enviarComentario}>
                    Enviar
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );

  async function alternarItem(id: number, feito: boolean) {
    setOtimista((o) => ({ ...o, [id]: !feito }));
    await chamar(`/api/v1/projetos/itens/${id}`, "PATCH", { feito: !feito });
    setOtimista((o) => {
      const resto = { ...o };
      delete resto[id];
      return resto;
    });
  }

  function enviarComentario() {
    void chamar(`/api/v1/projetos/demandas/${tarefa.id}/comentarios`, "POST", {
      texto: comentario.trim(),
    });
    setComentario("");
  }
}

/**
 * Concluir, no cabecalho, ao lado do clipe.
 *
 * Mesma moldura dos botoes de icone — eles dividem a quina, e um sem borda no
 * meio de outros com borda le como se estivesse desativado. So a cor muda: em
 * repouso e cinza como os vizinhos; concluida, verde, porque a partir dai o que
 * ele diz e um FATO da tarefa, nao uma acao a fazer.
 */
function BotaoConcluir({
  feita,
  travada,
  motivo,
  onClick,
}: {
  feita: boolean;
  travada: boolean;
  motivo?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={feita}
      disabled={travada}
      title={motivo ?? (feita ? "Reabrir tarefa" : "Marcar como concluída")}
      onClick={onClick}
      style={{
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0 9px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${feita ? "var(--success)" : "var(--border)"}`,
        background: "var(--surface)",
        color: feita ? "var(--success)" : "var(--text-secondary)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-medium)",
        fontFamily: "var(--font)",
        whiteSpace: "nowrap",
        cursor: travada ? "not-allowed" : "pointer",
        opacity: travada ? 0.5 : 1,
      }}
    >
      {/* Icone, e nao a caixa marcavel do cartao: o botao inteiro ja e o
          controle, e uma caixinha dentro dele sugeria um segundo alvo. */}
      <svg
        aria-hidden
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {feita ? "Concluída" : "Marcar como concluída"}
    </button>
  );
}

/** Bloco auxiliar aberto pelos botões do header. */
function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginBottom: 16,
        padding: 12,
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-2)",
        animation: "fade-in 140ms var(--ease-out)",
      }}
    >
      <div className="rotulo" style={{ fontSize: "var(--text-xs)", marginBottom: 8 }}>
        {titulo}
      </div>
      {children}
    </section>
  );
}

function Avatar({ nome }: { nome: string | null }) {
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--radius-full)",
        background: "var(--surface-3)",
        color: "var(--text-secondary)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-semi)",
      }}
    >
      {(nome ?? "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}

function ItemChecklist({
  item,
  aoAlternar,
  aoExcluir,
}: {
  item: { id: number; descricao: string; feito: boolean };
  aoAlternar: () => void;
  aoExcluir: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 30,
        padding: "4px 8px",
        borderRadius: "var(--radius-md)",
        background: hover ? "var(--surface-2)" : "transparent",
        transition: "background var(--dur) var(--ease)",
      }}
    >
      {/* Caixa desenhada, não a nativa: a do sistema muda de forma e de cor a
          cada navegador, e aqui ela aparece dez vezes seguidas na mesma lista. */}
      <button
        type="button"
        onClick={aoAlternar}
        role="checkbox"
        aria-checked={item.feito}
        aria-label={item.descricao}
        style={{
          flexShrink: 0,
          width: 18,
          height: 18,
          display: "grid",
          placeItems: "center",
          padding: 0,
          borderRadius: "var(--radius-full)",
          border: item.feito ? "none" : "1.5px solid var(--border-strong)",
          background: item.feito ? "var(--success)" : "transparent",
          color: "#fff",
          cursor: "pointer",
          transition: "background var(--dur) var(--ease)",
        }}
      >
        {item.feito && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </button>

      <span
        onClick={aoAlternar}
        style={{
          flex: 1,
          cursor: "pointer",
          fontSize: "var(--text-base)",
          color: item.feito ? "var(--text-tertiary)" : "var(--text-primary)",
          textDecoration: item.feito ? "line-through" : undefined,
        }}
      >
        {item.descricao}
      </span>

      {hover && (
        <button
          type="button"
          onClick={aoExcluir}
          aria-label="Remover item"
          title="Remover item"
          style={{
            width: 18,
            height: 18,
            border: "none",
            background: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            padding: 0,
            fontSize: 11,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function Anexo({
  anexo,
  aoExcluir,
}: {
  anexo: { id: number; url: string; nome: string };
  aoExcluir: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 28,
        padding: "2px 6px",
        borderRadius: "var(--radius-md)",
        background: hover ? "var(--surface)" : "transparent",
      }}
    >
      <svg
        aria-hidden
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-tertiary)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
      </svg>

      {/* `noopener` sempre: aba aberta por link externo consegue mexer na
          janela de origem sem ele. */}
      <a
        href={anexo.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: "var(--text-base)",
          color: "var(--primary)",
          textDecoration: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {anexo.nome}
      </a>

      {hover && (
        <button
          type="button"
          onClick={aoExcluir}
          aria-label="Remover anexo"
          title="Remover anexo"
          style={{
            width: 18,
            height: 18,
            border: "none",
            background: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            padding: 0,
            fontSize: 11,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Hoje mostra a hora; o resto, a data — é assim que se lê uma conversa. */
function quando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toISOString().slice(0, 10) as DataISO;
  const p = (n: number) => String(n).padStart(2, "0");

  return dia === hoje() ? `${p(d.getHours())}:${p(d.getMinutes())}` : paraFormatoBR(dia);
}
