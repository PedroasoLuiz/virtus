"use client";

import { createPortal } from "react-dom";
import { BuscaGlobal } from "@/components/layout/busca-global";
import type { Item } from "@/components/layout/rotas";
import { MenuUsuario } from "@/components/layout/menu-usuario";
import { Notificacoes } from "@/components/layout/notificacoes";
import { useSlotDoTopo } from "@/components/layout/slot-do-topo";

/*
 * As medidas da barra de ferramentas das telas, repetidas aqui de proposito.
 *
 * ⚠️ Importar da `barra-de-ferramentas` traria um modulo client inteiro para
 * dentro deste, que e server, so para ler dois numeros. Sao duas constantes que
 * nunca mudaram; se mudarem, o alinhamento vertical avisa na primeira olhada.
 */
const LARGURA_DA_FERRAMENTA = 44;
const RESPIRO_DA_BARRA_DE_FERRAMENTAS = 8;
import type { DadosDoPerfil, EmpresaDoPerfil } from "@/components/layout/perfil-drawer";

/**
 * A busca e a identidade — que nao tem mais faixa propria.
 *
 * ⚠️ Ela nao desenha uma barra: desenha DENTRO do cabecalho da tela.
 *
 * Eram duas faixas empilhadas, e as duas meio vazias: em cima a busca com o
 * avatar a direita, embaixo o caminho e o titulo a esquerda. Mais de cem pixels
 * de casca antes da primeira linha da tabela para dizer duas coisas que cabem
 * numa linha so. Agora `Financeiro › Caixas e bancos / Movimentacoes` fica de um
 * lado e a busca com a identidade do outro.
 *
 * ⚠️ O encaixe e um PORTAL. A identidade precisa da sessao, que so o layout
 * tem; o cabecalho e da tela e nasce muito mais fundo. Ver `slot-do-topo`.
 *
 * ⚠️ Enquanto o encaixe nao existe, ela se desenha PRESA NA TELA, no mesmo
 * canto. E o caso do instante entre a navegacao e a montagem do cabecalho da
 * tela nova, e o das telas que nao usam `PageHeader`: sem esta saida, a busca e
 * o avatar simplesmente sumiriam nesses momentos.
 */
export function Topbar(props: {
  aviso: "demo" | null;
  /**
   * O que a busca do topo oferece como destino.
   *
   * ⚠️ O PORTAL manda uma lista vazia. La a casca e a mesma do sistema, e sem
   * isto a caixa ofereceria os modulos internos a quem e cliente da empresa.
   */
  rotas?: Item[];
  email: string;
  usuarioNome: string | null;
  usuarioFoto: string | null;
  /** Endereco novo esperando confirmacao, para a gaveta de perfil. */
  emailPendente: string | null;
  /** O cadastro pessoal, para a gaveta de perfil. */
  dadosDoUsuario: DadosDoPerfil;
  /** As empresas do acesso, para a aba de empresas do perfil. */
  empresas: EmpresaDoPerfil[];
  empresaAtualId: number | null;
  interno: boolean;
}) {
  return <TopoNoCabecalho {...props} />;
}

/**
 * Aparece so quando o Supabase nao esta configurado: ninguem deve confundir
 * dado de demonstracao com dado real.
 */
function Aviso() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-semi)",
        background: "var(--warning-bg)",
        color: "var(--warning-text)",
        border: "1px solid var(--warning-border)",
      }}
    >
      Dados de demonstração
    </span>
  );
}

/*
/**
 * O saldo de moedas.
 *
 * ⚠️ Azul CHAPADO, e nao degrade. O degrade que havia aqui puxava o olho para a
 * transicao em vez do numero, e uma pastilha que so se le nao precisa de
 * profundidade. Azul claro e nao `--primary`: azul cheio significa "clique aqui"
 * em toda a interface, e isto nao e botao.
 *
 * ⚠️ Mesma altura e mesmo canto dos controles ao lado. Ela nao se clica, mas
 * mora na mesma fileira deles: uma pastilha de outra medida ali faria a fileira
 * inteira parecer desalinhada para poupar uma diferenca que ninguem pediu.
 *
 * ⚠️ Zero aparece, e nao some. Um saldo que desaparece quando acaba faria a
 * pessoa procurar onde ele foi parar justamente na hora em que ela precisa saber
 * que acabou.
 *\/
function Moedas({ saldo }: { saldo: number }) {
  return (
    <span
      title={`${saldo} moedas`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: "var(--h-controle)",
        padding: "0 11px",
        borderRadius: "var(--radius-sm)",
        background: "var(--moeda-bg)",
        color: "var(--primary)",
        fontSize: "var(--text-base)",
        fontWeight: "var(--fw-semi)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {saldo}
      <IconeMoeda />
    </span>
  );
}

/**
 * Uma moeda de canto, em traco.
 *
 * ⚠️ UMA, e nao duas empilhadas. O par sobreposto que estava aqui virava um
 * borrao de dois arcos aos quinze pixels em que ele e desenhado — a segunda
 * moeda so aparecia como um risco atras da primeira. O circulo com o miolo
 * marcado se reconhece como moeda no tamanho em que de fato e visto.
 *\/
function IconeMoeda() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="3.3" />
    </svg>
  );
}

*/

function TopoNoCabecalho({
  aviso,
  rotas,
  email,
  usuarioNome,
  usuarioFoto,
  emailPendente,
  dadosDoUsuario,
  empresas,
  empresaAtualId,
  interno,
}: {
  aviso: "demo" | null;
  rotas?: Item[];
  email: string;
  usuarioNome: string | null;
  usuarioFoto: string | null;
  emailPendente: string | null;
  dadosDoUsuario: DadosDoPerfil;
  empresas: EmpresaDoPerfil[];
  empresaAtualId: number | null;
  interno: boolean;
}) {
  const encaixe = useSlotDoTopo();

  const conteudo = (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {aviso && <Aviso />}

      {/*
        ⚠️ UMA pilula para a busca e o sino, e nao duas pecas lado a lado.

        Separados, eram duas superficies brancas de cantos diferentes encostadas
        na mesma linha, e o olho lia a emenda antes de ler o conteudo. Juntos num
        corpo so, com um fio no meio, viram uma barra de acoes — e o avatar ao
        lado passa a ser a unica outra coisa da fileira, que e o certo: ele e a
        pessoa, e os dois sao ferramentas.

        ⚠️ A altura e a mesma do avatar (`--h-controle`), e o canto e redondo de
        ponta a ponta. Com um raio menor, a pilula ficaria com quinas ao lado de
        um disco e a fileira pareceria juntar duas familias de forma.
      */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "var(--h-controle)",
          borderRadius: "var(--radius-full)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <BuscaGlobal rotas={rotas} />

        {/* O fio que separa o campo do gesto. Curto de proposito: de ponta a
            ponta ele partiria a pilula em duas metades. */}
        <span
          aria-hidden
          style={{ width: 1, height: 16, background: "var(--border-strong)", flexShrink: 0 }}
        />

        <div style={{ padding: "0 5px", display: "flex" }}>
          <Notificacoes />
        </div>
      </div>

      {/* O berco de 48: e ele que poe o avatar no prumo da coluna de
          ferramentas da tela, e nao o avatar, que continua com 34. */}
      <div style={{ width: LARGURA_DA_FERRAMENTA, display: "grid", placeItems: "center" }}>
        <MenuUsuario
          email={email}
          nome={usuarioNome}
          foto={usuarioFoto}
          emailPendente={emailPendente}
          dados={dadosDoUsuario}
          empresas={empresas}
          empresaAtualId={empresaAtualId}
          interno={interno}
        />
      </div>
    </div>
  );

  if (encaixe) return createPortal(conteudo, encaixe);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: RESPIRO_DA_BARRA_DE_FERRAMENTAS,
        height: "var(--h-topbar)",
        display: "flex",
        alignItems: "center",
        zIndex: 50,
      }}
    >
      {conteudo}
    </div>
  );
}
