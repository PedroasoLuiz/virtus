"use client";

import { useEffect, useState } from "react";
import { CabecalhoDeSecao, EmptyRow, TableArea, TableHead, Td, Th, Tr } from "@/components/ui/kit";
import { comFormatacaoDoWhatsapp } from "@/components/whatsapp/formatacao";
import type { Modelo } from "@/modules/whatsapp/whatsapp.types";

/**
 * Envio de modelo aprovado.
 *
 * ⚠️ Existe por causa da janela de 24 horas: passada ela, a Meta recusa texto
 * livre e só aceita modelo. Mas não serve só para isso — modelo também é como se
 * manda cobrança com texto já aprovado, com a conversa quente.
 *
 * São duas peças. A COLUNA lista o que há para mandar, ao lado da conversa; a
 * CAIXA toma o lugar do campo de escrita depois da escolha. Separadas porque
 * escolher e escrever são momentos diferentes: a lista precisa de espaço e não
 * pode roubar o rodapé, que é onde a mão já está.
 */

/** O que a busca dos modelos devolveu, para as duas peças usarem. */
export type ListaDeModelos = {
  modelos: Modelo[] | null;
  falhou: string | null;
};

/**
 * Busca os modelos aprovados deste número.
 *
 * ⚠️ Pela CONVERSA, e não por `?contaId=`. O painel sabia o id da conta e o
 * mandava na consulta; um campo esquecido no schema da resposta fazia esse id
 * chegar `undefined`, a rota recusava e a tela concluía "nenhum modelo
 * aprovado", culpando a Meta por um erro nosso.
 */
export function useModelos(conversaId: number, ativo: boolean): ListaDeModelos {
  const [modelos, setModelos] = useState<Modelo[] | null>(null);
  /*
   * ⚠️ Falha e lista vazia são coisas DIFERENTES, e mostrar as duas como
   * "nenhum modelo aprovado" custou caro: com a chamada quebrada, a tela dizia
   * que o problema estava na Meta e a busca ia para o lugar errado.
   */
  const [falhou, setFalhou] = useState<string | null>(null);

  useEffect(() => {
    if (!ativo) return;
    const controle = new AbortController();

    fetch(`/api/v1/whatsapp/conversas/${conversaId}/modelo`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null);

        if (!r.ok) {
          /*
           * ⚠️ Os `details` entram na mensagem. Um 422 diz "dados inválidos" e
           * para por aí; é o campo que ele lista que diz onde procurar.
           */
          const campos = (corpo?.error?.details ?? [])
            .map((d: { campo?: string; mensagem?: string }) =>
              [d.campo, d.mensagem].filter(Boolean).join(": "),
            )
            .filter(Boolean)
            .join("; ");

          throw new Error([corpo?.error?.message, campos].filter(Boolean).join(". ") || "");
        }

        setFalhou(null);
        setModelos(corpo.data ?? []);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setFalhou(e.message || "Não foi possível falar com a Meta agora.");
        setModelos([]);
      });

    return () => controle.abort();
  }, [ativo, conversaId]);

  return { modelos, falhou };
}

/**
 * A coluna dos modelos, à direita da conversa.
 *
 * ⚠️ Coluna, e não uma lista dentro do rodapé. Empilhados ali embaixo, três
 * modelos já tomavam metade da tela — e é logo acima do rodapé que está a última
 * mensagem que a pessoa acabou de ler. Ao lado, a conversa só encolhe.
 *
 * O desenho é o mesmo da aba Modelos na configuração: o NOME na linha, e o texto
 * atrás de um olho. Vinte modelos desenhados de uma vez seriam vinte bolhas
 * montadas para ler no máximo uma.
 */
export function ColunaDeModelos({
  lista,
  escolhido,
  onEscolher,
  onFechar,
}: {
  lista: ListaDeModelos;
  escolhido: string | null;
  onEscolher: (m: Modelo) => void;
  onFechar: () => void;
}) {
  const [espiando, setEspiando] = useState<Espiada | null>(null);
  const { modelos, falhou } = lista;

  return (
    <aside
      aria-label="Modelos aprovados"
      style={{
        width: 300,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: "0 12px 4px 2px",
        /*
         * ⚠️ SEM fundo proprio. Com o cinza da conversa, a coluna virava um
         * segundo cartao colado no primeiro e a tela ficava com dois blocos
         * disputando o mesmo peso. A tabela ja tem moldura; o que separa as
         * duas colunas e o vao entre elas.
         */
        animation: "fade-in 160ms var(--ease-out)",
      }}
    >
      {/*
        O mesmo cabeçalho de seção do drawer de configuração: título com um
        degrau de peso e uma frase abaixo. A coluna aparece no meio de uma
        conversa, sem contexto nenhum — sem a frase, "modelos aprovados" é
        vocabulário da Meta caído na tela.
      */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <CabecalhoDeSecao
          primeiro
          colado
          titulo="Modelos aprovados"
          legenda="Textos que a Meta já revisou. São os únicos que podem sair depois de 24 horas sem resposta do cliente, e passe o olho para ver como cada um chega."
        />

        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar os modelos"
          title="Fechar"
          style={{
            position: "absolute",
            top: 8,
            right: 0,
            width: 22,
            height: 22,
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            color: "var(--text-tertiary)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {falhou && (
        <p
          style={{
            padding: "0 2px 8px",
            fontSize: "var(--text-sm)",
            color: "var(--danger-text)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          Não foi possível carregar os modelos. {falhou}
        </p>
      )}

      {/*
        A MESMA tabela da aba Modelos, na configuração.
        
        ⚠️ Duas colunas e não quatro: idioma e categoria não cabem em trezentos
        pixels, e nenhuma das duas decide qual modelo mandar. Quem decide é o
        nome mais o texto atrás do olho.
      */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <TableArea minWidth={0}>
          <TableHead>
            <Th>Modelo</Th>
            <Th>Campos</Th>
          </TableHead>

          <tbody>
            {modelos == null ? (
              <EmptyRow colSpan={2} message="Carregando modelos…" />
            ) : modelos.length === 0 ? (
              <EmptyRow
                colSpan={2}
                message="Nenhum modelo aprovado. Confira o status no painel da Meta."
              />
            ) : (
              modelos.map((m) => (
                <LinhaDeModelo
                  key={`${m.nome}-${m.idioma}`}
                  modelo={m}
                  atual={m.nome === escolhido}
                  onEscolher={() => onEscolher(m)}
                  onEspiar={setEspiando}
                />
              ))
            )}
          </tbody>
        </TableArea>
      </div>

      {espiando && <PreviaDoModelo espiada={espiando} />}
    </aside>
  );
}

function LinhaDeModelo({
  modelo,
  atual,
  onEscolher,
  onEspiar,
}: {
  modelo: Modelo;
  atual: boolean;
  onEscolher: () => void;
  onEspiar: (e: Espiada | null) => void;
}) {
  /*
   * ⚠️ Modelo que a Meta NÃO deixa disparar daqui não fica clicável.
   *
   * Botão de pedido, catálogo ou formulário exige um `action` que o painel não
   * tem como montar, e a Meta recusa com "'action' cannot be null" — um erro que
   * chega depois do clique, sem dizer que a culpa era da escolha.
   */
  const bloqueado = modelo.bloqueio != null;

  return (
    <Tr
      onClick={bloqueado ? undefined : onEscolher}
      style={{
        // A cor da MINHA bolha no escolhido: o modelo é uma mensagem que vai
        // sair, e o cinza de linha selecionada não diz isso.
        background: atual ? "var(--primary-subtle)" : undefined,
        opacity: bloqueado ? 0.5 : 1,
        cursor: bloqueado ? "not-allowed" : "pointer",
      }}
    >
      <Td>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontWeight: "var(--fw-semi)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={modelo.bloqueio ?? modelo.nome}
          >
            {modelo.nome}
          </span>

          {!bloqueado && <BotaoDeEspiar modelo={modelo} onEspiar={onEspiar} />}
        </div>
      </Td>

      <Td>{bloqueado ? modelo.bloqueio : modelo.parametros}</Td>
    </Tr>
  );
}

/** Onde e o que mostrar na prévia. */
type Espiada = {
  modelo: Modelo;
  /**
   * O que já foi digitado, quando há.
   *
   * ⚠️ Da lista o olho mostra o modelo cru, com os `{{n}}` — ali não há valor
   * nenhum. Da caixa de envio ele mostra a mensagem COMO ELA VAI SAIR, que é a
   * pergunta que a pessoa está fazendo naquele momento.
   */
  valores?: string[];
  /**
   * De que lado o cartão cresce, e a partir de que borda.
   *
   * ⚠️ Calculado no gesto, e não fixo. O mesmo olho aparece na coluna da
   * direita, onde o cartão só cabe crescendo para a esquerda, e no rodapé, onde
   * crescer para a esquerda o joga para fora da tela. Fixo, ele ficava certo num
   * lugar e invisível no outro.
   */
  ancora: { lado: "esquerda" | "direita"; x: number; y: number; deBaixo: boolean };
};

/**
 * O olho, igual ao da aba Modelos.
 *
 * O corpo atrás de um gesto, e não desenhado em toda linha: vinte modelos eram
 * vinte bolhas montadas de uma vez, com o negrito reprocessado em cada uma, para
 * ler no máximo uma.
 */
function BotaoDeEspiar({
  modelo,
  valores,
  onEspiar,
}: {
  modelo: Modelo;
  valores?: string[];
  onEspiar: (e: Espiada | null) => void;
}) {
  // A posicao sai do proprio botao no momento do gesto: guardada antes, ela
  // apontaria para onde a linha estava antes de rolar a lista.
  const mostrar = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();

    // 320 e a largura do cartao mais o vao: abaixo disso, nao ha espaco a
    // esquerda e ele passa a crescer para a direita.
    const cabeAEsquerda = r.left > 320;
    // Na metade de baixo da tela ele sobe, ancorado pelo pe do botao.
    const deBaixo = r.top > window.innerHeight / 2;

    onEspiar({
      modelo,
      valores,
      ancora: {
        lado: cabeAEsquerda ? "esquerda" : "direita",
        x: cabeAEsquerda ? r.left - 10 : r.right + 10,
        y: deBaixo ? r.bottom : r.top,
        deBaixo,
      },
    });
  };

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Ver a mensagem de ${modelo.nome}`}
      title="Ver a mensagem"
      onMouseEnter={(e) => mostrar(e.currentTarget)}
      onMouseLeave={() => onEspiar(null)}
      // Foco tambem abre: quem navega por teclado nao tem mouse para passar.
      onFocus={(e) => mostrar(e.currentTarget)}
      onBlur={() => onEspiar(null)}
      style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        display: "grid",
        placeItems: "center",
        // Sem fundo: e um icone ao lado do nome, nao um botao.
        color: "var(--primary)",
        cursor: "pointer",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.8 12S5.5 5.5 12 5.5 22.2 12 22.2 12 18.5 18.5 12 18.5 1.8 12 1.8 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}

/**
 * A mensagem como o cliente vai receber.
 *
 * ⚠️ `position: fixed` e um só na tela. Dentro da linha ele seria recortado pelo
 * `overflow` da coluna rolável.
 */
function PreviaDoModelo({ espiada }: { espiada: Espiada }) {
  const { modelo, ancora } = espiada;

  return (
    <div
      style={{
        position: "fixed",
        ...(ancora.lado === "esquerda"
          ? { right: `calc(100vw - ${ancora.x}px)` }
          : { left: ancora.x }),
        ...(ancora.deBaixo
          ? { bottom: `calc(100vh - ${ancora.y}px)` }
          : { top: ancora.y }),
        zIndex: 500,
        width: 300,
        padding: 10,
        borderRadius: "var(--radius-lg)",
        /*
         * O MESMO fundo da area de mensagens do painel: a bolha usa
         * `primary-subtle`, que e translucido, e solta sobre o branco da tela
         * ela sumiria.
         */
        background:
          "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
        boxShadow: "var(--shadow-lg)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "7px 10px",
          borderRadius: "var(--radius-lg) var(--radius-lg) var(--radius-xs) var(--radius-lg)",
          // O MESMO da bolha enviada no painel.
          background: "var(--primary-subtle)",
          boxShadow: "var(--shadow-xs)",
          fontSize: "var(--text-sm)",
          color: "var(--text-primary)",
          lineHeight: "var(--lh-normal)",
          whiteSpace: "pre-wrap",
        }}
      >
        {modelo.cabecalho && (
          <div style={{ fontWeight: "var(--fw-semi)", marginBottom: 3 }}>{modelo.cabecalho}</div>
        )}

        {comFormatacaoDoWhatsapp(preencher(modelo.corpo, espiada.valores ?? []))}

        {modelo.rodape && (
          <div style={{ marginTop: 5, fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {modelo.rodape}
          </div>
        )}

        {modelo.botao && <CartaoDoBotao texto={modelo.botao.texto} />}
      </div>
    </div>
  );
}

/** O botão do modelo, como o WhatsApp desenha: colado embaixo da bolha. */
function CartaoDoBotao({ texto }: { texto: string }) {
  return (
    <div
      style={{
        marginTop: 7,
        paddingTop: 6,
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-semi)",
        color: "var(--info-text)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
      {texto}
    </div>
  );
}

/**
 * A caixa de envio do modelo escolhido, no lugar do campo de escrita.
 *
 * ⚠️ Não é uma tela de configuração com um botão "enviar" no fim. É a mesma
 * barra de sempre, com o texto já pronto no lugar do campo e o mesmo botão
 * redondo à direita: quem chegou aqui ia mandar uma mensagem, e um formulário no
 * meio do caminho faz parecer que virou outra tarefa.
 */
export function EnvioDoModelo({
  modelo,
  onEnviar,
  onTrocar,
}: {
  modelo: Modelo;
  onEnviar: (nome: string, parametros: string[], urlDoBotao?: string) => Promise<void>;
  /** Volta para a lista, sem fechar a coluna. */
  onTrocar: () => void;
}) {
  const [valores, setValores] = useState<string[]>([]);
  /*
   * ⚠️ Campo PRÓPRIO, fora dos `valores` do corpo.
   *
   * Na Meta o botão é outro componente, e o `{{1}}` da URL é independente dos
   * `{{n}}` do texto. Sem este valor ela recusa com "Button at index 0 of type
   * Url requires a parameter" — e o painel nem perguntava.
   */
  const [link, setLink] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [espiando, setEspiando] = useState<Espiada | null>(null);

  const pedeLink = modelo.botao?.temVariavel === true;

  const faltaPreencher =
    valores.filter((v) => v?.trim()).length < modelo.parametros ||
    (pedeLink && link.trim().length === 0);

  async function enviar() {
    if (faltaPreencher || enviando) return;

    setEnviando(true);
    try {
      await onEnviar(
        modelo.nome,
        valores.slice(0, modelo.parametros),
        pedeLink ? link.trim() : undefined,
      );
      setValores([]);
      setLink("");
      onTrocar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <footer
      style={{
        flexShrink: 0,
        /*
         * ⚠️ SEM rolagem. Os campos ficam todos na tela: rolar para achar o
         * terceiro de quatro faz preencher às cegas, e o valor no campo errado
         * sai cobrado. O limite só volta acima de dez, onde não há tela que
         * caiba.
         */
        maxHeight: modelo.parametros > 10 ? 420 : undefined,
        overflowY: modelo.parametros > 10 ? "auto" : "visible",
        padding: "0 14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/*
        O nome do modelo vira TÍTULO, com a mesma anatomia da coluna ao lado, e a
        prévia sai de cena.

        ⚠️ Ela ocupava metade do rodapé para mostrar um texto que não muda: o
        modelo é aprovado, e o que a pessoa precisa ver enquanto preenche são os
        CAMPOS. O texto continua a um passo, atrás do olho.

        ⚠️ Sem "outro modelo": a coluna da direita está aberta com a lista
        inteira, e um botão que faz o mesmo que ela vira um segundo caminho para
        o mesmo lugar.
      */}
      <CabecalhoDeSecao
        primeiro
        colado
        titulo={modelo.nome}
        legenda={
          modelo.parametros === 0
            ? "Este modelo não tem campos. É só enviar."
            : "Preencha os campos abaixo. A dica de cada um mostra onde ele cai no texto."
        }
        acao={<BotaoDeEspiar modelo={modelo} valores={valores} onEspiar={setEspiando} />}
      />

      {espiando && <PreviaDoModelo espiada={espiando} />}

      {/*
        ⚠️ Cada campo mostra ONDE ele cai no texto.

        "Campo 1", "Campo 2" não dizem nada, e a ordem dos marcadores no corpo
        não é a ordem em que se lê: num modelo de cobrança o `{{2}}` é o ticket e
        aparece depois do nome. Já saiu para um cliente uma mensagem com o valor
        no lugar do nome por causa disso.
      */}
      {Array.from({ length: modelo.parametros }, (_, i) => (
        <CampoDoModelo
          key={i}
          rotulo={`Campo ${i + 1}`}
          dica={ondeEntra(modelo.corpo, i + 1)}
          valor={valores[i] ?? ""}
          onMudar={(v) =>
            setValores((atuais) => {
              const copia = [...atuais];
              copia[i] = v;
              return copia;
            })
          }
        />
      ))}

      {pedeLink && (
        <CampoDoModelo
          rotulo="Link"
          dica="O que completa o endereço do botão"
          valor={link}
          onMudar={setLink}
        />
      )}

      {/* A mesma linha de sempre: o que sai à esquerda, o botão redondo à
          direita. É o gesto que a mão já conhece deste rodapé. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
        <p
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-snug)",
          }}
        >
          {faltaPreencher
            ? "Preencha os campos acima para enviar."
            : "O cliente recebe exatamente o texto acima."}
        </p>

        <button
          type="button"
          onClick={() => void enviar()}
          disabled={faltaPreencher || enviando}
          aria-label="Enviar"
          title="Enviar"
          className="redondo"
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            border: "none",
            borderRadius: "var(--radius-full)",
            background: faltaPreencher || enviando ? "var(--surface-3)" : "var(--primary)",
            color: faltaPreencher || enviando ? "var(--text-disabled)" : "var(--primary-fg)",
            cursor: faltaPreencher || enviando ? "not-allowed" : "pointer",
            transition: "background 120ms var(--ease)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </footer>
  );
}

/**
 * Um campo do modelo: rótulo à esquerda, caixa à direita.
 *
 * ⚠️ Na MESMA linha, e não empilhado. Com a prévia em cima, cada campo em duas
 * linhas empurrava o rodapé para cima da conversa: quatro campos comiam a tela
 * toda. Deitado, cada um custa uma linha só.
 *
 * ⚠️ A dica virou PLACEHOLDER, e não sumiu. Ela mostra onde aquele valor cai no
 * texto, e é o que impede o erro clássico: a ordem dos `{{n}}` não é a ordem em
 * que se lê a frase, e já saiu cobrança com o valor no lugar do nome.
 */
function CampoDoModelo({
  rotulo,
  dica,
  valor,
  onMudar,
}: {
  rotulo: string;
  dica: string;
  valor: string;
  onMudar: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span
        style={{
          width: 58,
          flexShrink: 0,
          fontSize: "var(--text-xs)",
          fontWeight: "var(--fw-semi)",
          color: "var(--text-tertiary)",
        }}
      >
        {rotulo}
      </span>

      <input
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={dica}
        title={dica}
        style={{
          flex: 1,
          minWidth: 0,
          height: 30,
          padding: "0 10px",
          fontSize: "var(--text-sm)",
          fontFamily: "var(--font)",
          border: "1px solid var(--input-border)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          outline: "none",
        }}
      />
    </label>
  );
}

/**
 * O rodapé de quem está FORA da janela de 24 horas.
 *
 * Substitui a barra de escrita em vez de conviver com ela: ali texto livre não
 * passa, e deixar o campo visível só produziria erro no clique.
 */
export function AvisoDaJanela({ onAbrirModelos }: { onAbrirModelos: () => void }) {
  return (
    <footer
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px 12px",
      }}
    >
      <p
        style={{
          flex: 1,
          fontSize: "var(--text-sm)",
          color: "var(--text-tertiary)",
          lineHeight: "var(--lh-snug)",
        }}
      >
        Passaram-se mais de 24 horas desde a última mensagem deste contato. Só um modelo aprovado
        pode ser enviado agora.
      </p>

      <button
        type="button"
        onClick={onAbrirModelos}
        style={{
          flexShrink: 0,
          height: 30,
          padding: "0 12px",
          border: "1px solid var(--primary-border)",
          borderRadius: "var(--radius-md)",
          background: "var(--primary-subtle)",
          color: "var(--primary)",
          fontFamily: "var(--font)",
          fontSize: "var(--text-sm)",
          fontWeight: "var(--fw-semi)",
          cursor: "pointer",
        }}
      >
        Escolher modelo
      </button>
    </footer>
  );
}

/**
 * O trecho do texto em volta de um marcador.
 *
 * ⚠️ Existe porque a POSIÇÃO do `{{n}}` não se adivinha pelo número dele: um
 * modelo pode citar o `{{4}}` antes do `{{2}}`, e a Meta aceita. Sem ver onde
 * cai, quem preenche vai pela ordem em que lê a frase — e foi assim que saiu uma
 * cobrança com o valor no lugar do nome do cliente.
 *
 * Corta em 24 caracteres de cada lado: o suficiente para reconhecer o lugar sem
 * a linha virar um parágrafo.
 */
function ondeEntra(corpo: string, numero: number): string {
  const marcador = new RegExp(`\\{\\{\\s*${numero}\\s*\\}\\}`);
  const achado = corpo.match(marcador);

  if (!achado || achado.index == null) return `Campo ${numero}`;

  const antes = corpo.slice(Math.max(0, achado.index - 24), achado.index);
  const depois = corpo.slice(achado.index + achado[0].length).slice(0, 24);

  // A quebra de linha vira espaco: numa linha so, ela nao separa nada e ainda
  // corta a frase no meio sem motivo visivel.
  const limpo = (t: string) => t.replace(/\s*\n\s*/g, " ");

  return `${limpo(antes)}[ ]${limpo(depois)}`.trim();
}

/** Troca `{{1}}`, `{{2}}`… pelos valores digitados, para a prévia. */
function preencher(corpo: string, valores: string[]): string {
  return corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (marcador, n: string) => {
    const v = valores[Number(n) - 1];
    return v?.trim() ? v : marcador;
  });
}
