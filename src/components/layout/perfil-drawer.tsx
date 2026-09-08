"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  CampoBloqueado,
  EmptyRow,
  Field,
  Formulario,
  GrupoDeCampos,
  PanelTabs,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { Drawer } from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import { RecorteDeFoto } from "@/components/layout/recorte-de-foto";
import { iniciais } from "@/components/layout/avatar";
import {
  alterarSenhaAction,
  editarPerfilAction,
  meuPedidoDeExclusaoAction,
  pedirExclusaoAction,
  selecionarEmpresaAction,
  trocarEmailAction,
  trocarFotoAction,
} from "@/modules/sessao/sessao.actions";
import type { PedidoDeExclusao } from "@/modules/sessao/sessao.repository";
import { paraFormatoBR, type DataISO } from "@/shared/utils/datas";
import { analisarTelefone, mascararTelefone } from "@/shared/domain/telefone";

/**
 * O perfil da propria pessoa.
 *
 * ⚠️ A IDENTIFICACAO fica fixa no topo, e so o resto tem abas.
 *
 * Foto, nome e e-mail sao a resposta de "quem sou eu" — a razao de a gaveta
 * existir, e o que a pessoa veio conferir. Numa aba, ela precisaria de um clique
 * para ver a propria cara. Embaixo vem o que se FAZ com a conta: empresas
 * primeiro, porque e consulta e troca de contexto, e a senha depois, que e o
 * caso raro.
 *
 * ⚠️ UM salvar so no cabecalho, ao lado do X, e ele grava a IDENTIFICACAO.
 *
 * A troca de senha tem botao proprio, dentro do grupo dela, porque nao e o mesmo
 * gesto: ela pede a senha atual, pode falhar sozinha e nao deve viajar junto com
 * a correcao de um nome. Um botao unico no topo que as fizesse juntas obrigaria
 * quem so quer arrumar o proprio nome a digitar senha.
 *
 * ⚠️ A largura e a da casa: `Drawer` sem `width`. Um numero proprio aqui era o
 * comeco de cada gaveta ter a sua.
 */

export type EmpresaDoPerfil = { id: number; nome: string; logo: string | null };

/** O cadastro que a pessoa preenche sobre si. */
export type DadosDoPerfil = {
  nascimento: string | null;
  whatsapp: string | null;
  instagram: string | null;
  pronome: string | null;
  funcao: string | null;
};

/**
 * As opcoes de tratamento.
 *
 * ⚠️ Lista e nao texto livre: em campo aberto cada pessoa escreve de um jeito
 * ("ele", "Ele/Dele", "masculino") e a mesma coisa aparece com cinco grafias. E
 * ha a saida de nao dizer, que precisa existir.
 */
const PRONOMES = ["ele/dele", "ela/dela", "elu/delu", "prefiro nao informar"];

const ABA_EMPRESAS = "Empresas";
const ABA_CONTATO = "Contato";
const ABA_SENHA = "Senha";
const ABA_MAIS = "Mais";

/** O lado da foto dentro da gaveta. */
const LADO_DA_FOTO = 88;

/**
 * A faixa atras da foto.
 *
 * ⚠️ Baixa de proposito: ela existe para dar fundo a metade de cima do retrato,
 * e nao para ser uma capa de rede social. Alta, viraria um espaco vazio pedindo
 * uma imagem que esta gaveta nao tem para oferecer.
 */
const ALTURA_DA_FAIXA = 56;

/**
 * A cor da capa: o azul da marca no tom mais fraco que a casa tem.
 *
 * ⚠️ Azul e nao cinza. Cinza era mais uma superficie neutra num drawer que ja e
 * todo neutro, e a faixa desaparecia atras da propria foto. O azul diz que
 * aquele bloco e do sistema, e nao um espaco em branco esperando imagem.
 *
 * ⚠️ Ela sobe pelo CABECALHO (`capa` do `Drawer`), que perde a divisoria. Titulo
 * e faixa viram um bloco so; com o fio no meio, a mesma cor lia como duas tiras
 * coladas.
 */
const COR_DA_CAPA = "var(--primary-subtle)";

export function PerfilDrawer({
  nome: nomeAtual,
  email,
  foto,
  emailPendente,
  dados,
  empresas,
  empresaAtualId,
  interno,
  onClose,
}: {
  nome: string | null;
  email: string;
  foto: string | null;
  /** Endereco novo esperando confirmacao. Nulo quando nao ha troca em curso. */
  emailPendente: string | null;
  dados: DadosDoPerfil;
  empresas: EmpresaDoPerfil[];
  empresaAtualId: number | null;
  interno: boolean;
  onClose: () => void;
}) {
  const [aba, setAba] = useState(ABA_EMPRESAS);
  const { avisar } = useAvisos();
  const [salvando, setSalvando] = useState(false);
  /* Qual empresa esta sendo assumida agora: trava a linha e diz onde o clique
     pegou, porque a troca recarrega a casca inteira e demora um instante. */
  const [assumindo, setAssumindo] = useState<number | null>(null);

  const [nome, setNome] = useState(nomeAtual ?? "");
  const [nascimento, setNascimento] = useState(dados.nascimento ?? "");
  const [whatsapp, setWhatsapp] = useState(dados.whatsapp ?? "");
  const [instagram, setInstagram] = useState(dados.instagram ?? "");
  const [pronome, setPronome] = useState(dados.pronome ?? "");
  const [funcao, setFuncao] = useState(dados.funcao ?? "");

  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");

  /* O arquivo escolhido, enquanto a pessoa ainda esta recortando. */
  const [recortando, setRecortando] = useState<File | null>(null);
  const [menuDaFoto, setMenuDaFoto] = useState(false);

  const [emailNovo, setEmailNovo] = useState(email);

  /*
   * O pedido de exclusao carrega quando a aba abre, e nao com a gaveta.
   *
   * ⚠️ `undefined` e "ainda nao perguntei"; `null` e "nao ha pedido". Com um
   * valor so para os dois, a tela mostraria "nenhum pedido" antes de ter olhado.
   */
  const [pedido, setPedido] = useState<PedidoDeExclusao | null | undefined>(undefined);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (aba !== ABA_MAIS || pedido !== undefined) return;

    let vivo = true;
    void meuPedidoDeExclusaoAction().then((r) => {
      if (vivo) setPedido(r);
    });
    return () => {
      vivo = false;
    };
  }, [aba, pedido]);

  /**
   * Manda de novo o link para o endereco que ja esta pendente.
   *
   * ⚠️ E o MESMO pedido, e nao um novo: chama a mesma acao com o endereco que o
   * Auth ja guarda. O Supabase reemite o link e invalida o anterior, entao nao
   * ficam dois links validos disputando a mesma troca.
   */
  async function reenviarConfirmacao() {
    if (!emailPendente) return;

    setSalvando(true);

    const form = new FormData();
    form.set("novo", emailPendente);
    const { erro } = await trocarEmailAction({ erro: null }, form);

    setSalvando(false);
    avisar(
      erro ? "atencao" : "sucesso",
      erro ?? "Confirmação reenviada",
      erro ? undefined : `Mandamos de novo para ${email} e para ${emailPendente}.`,
    );
  }

  async function pedirExclusao() {
    setSalvando(true);

    const form = new FormData();
    form.set("motivo", motivo);
    const { erro } = await pedirExclusaoAction({ erro: null }, form);

    setSalvando(false);

    if (erro) {
      avisar("atencao", erro);
      return;
    }

    setMotivo("");
    /* Relê em vez de montar o pedido aqui: a data e a situacao sao do banco, e
       inventá-las na tela criaria uma segunda verdade. */
    setPedido(await meuPedidoDeExclusaoAction());
    avisar("sucesso", "Pedido registrado", "Você será avisado por e-mail quando houver resposta.");
  }

  /*
   * ⚠️ Compara TODOS os campos, e nao so o nome.
   *
   * Com a trava olhando so o nome, quem trocasse apenas o WhatsApp encontrava o
   * botao apagado e nao tinha como gravar.
   */
  const mudou =
    nome.trim() !== (nomeAtual ?? "").trim() ||
    nascimento !== (dados.nascimento ?? "") ||
    whatsapp !== (dados.whatsapp ?? "") ||
    instagram !== (dados.instagram ?? "") ||
    pronome !== (dados.pronome ?? "") ||
    funcao !== (dados.funcao ?? "") ||
    emailNovo.trim().toLowerCase() !== email.toLowerCase();
  const nomeValido = nome.trim().length >= 2;
  const senhaCompleta = atual.length > 0 && nova.length > 0 && repetida.length > 0;

  /*
   * O numero e conferido enquanto se digita, mas so RECLAMA quando ja ha algo
   * escrito: um campo vazio nao esta errado, esta em branco.
   */
  const erroDoWhatsapp = whatsapp.trim() ? analisarTelefone(whatsapp).erro : null;

  async function salvarNome() {
    setSalvando(true);

    const form = new FormData();
    form.set("nome", nome);
    form.set("nascimento", nascimento);
    form.set("whatsapp", whatsapp);
    form.set("instagram", instagram);
    form.set("pronome", pronome);
    form.set("funcao", funcao);
    const { erro } = await editarPerfilAction({ erro: null }, form);

    if (erro) {
      setSalvando(false);
      avisar("atencao", erro);
      return;
    }

    /*
     * ⚠️ O e-mail vai numa chamada SEPARADA, e depois do resto.
     *
     * Ele nao e uma coluna de `usuarios`: quem o guarda e o Auth, e a troca dele
     * nem acontece agora, so quando o link for aberto. Junto no mesmo salvar, uma
     * recusa do Auth ("ja existe uma conta com este e-mail") faria parecer que o
     * nome e o telefone tambem nao gravaram.
     */
    if (emailNovo.trim().toLowerCase() !== email.toLowerCase()) {
      const troca = new FormData();
      troca.set("novo", emailNovo.trim());
      const resposta = await trocarEmailAction({ erro: null }, troca);

      setSalvando(false);

      if (resposta.erro) {
        avisar("atencao", resposta.erro, "O resto do perfil foi salvo.");
        return;
      }

      /* O aviso fala do LINK, e nao de troca feita: o endereco na tela continua o
         antigo ate alguem confirmar. */
      avisar(
        "sucesso",
        "Perfil salvo. Confirme nos dois e-mails",
        `Mandamos um link para ${email} e outro para ${emailNovo.trim()}. A troca vale quando os dois forem abertos.`,
      );
      return;
    }

    setSalvando(false);
    avisar("sucesso", "Perfil salvo");
  }

  async function salvarSenha() {
    /*
     * A repeticao e conferida AQUI, e nao no servidor: ela nao e regra de
     * negocio, e sim protecao contra erro de digitacao. O servidor nem precisa
     * saber que existiu um segundo campo.
     */
    if (nova !== repetida) {
      avisar("atencao", "A confirmação não confere com a nova senha");
      return;
    }

    setSalvando(true);

    const form = new FormData();
    form.set("atual", atual);
    form.set("nova", nova);
    const { erro } = await alterarSenhaAction({ erro: null }, form);

    setSalvando(false);

    if (erro) {
      avisar("atencao", erro);
      return;
    }

    /* Some com o que foi digitado: senha não fica na tela depois de gravada. */
    setAtual("");
    setNova("");
    setRepetida("");
    avisar("sucesso", "Senha alterada");
  }

  /**
   * Assume outra empresa dali mesmo.
   *
   * ⚠️ E a MESMA acao do cartao da empresa e da tela de selecao: ela grava o
   * cookie do tenant e redireciona. Escrever uma troca propria aqui daria dois
   * caminhos para a mesma decisao, e um deles envelheceria.
   *
   * ⚠️ Nao ha "voltar": a gaveta morre junto com a navegacao, e e o certo — o
   * perfil que estava aberto era o da sessao anterior.
   */
  async function assumir(empresaId: number) {
    setAssumindo(empresaId);

    const form = new FormData();
    form.set("empresaId", String(empresaId));
    const { erro } = await selecionarEmpresaAction({ erro: null }, form);

    /* So se chega aqui quando a acao RECUSOU: no caminho feliz ela redireciona
       e esta linha nunca roda. */
    setAssumindo(null);
    if (erro) avisar("atencao", erro);
  }

  async function enviarFoto(arquivo: File | null) {
    setSalvando(true);

    const form = new FormData();
    if (arquivo) form.set("foto", arquivo);
    const { erro } = await trocarFotoAction({ erro: null }, form);

    setSalvando(false);
    setRecortando(null);
    avisar(
      erro ? "atencao" : "sucesso",
      erro ?? (arquivo ? "Foto atualizada" : "Foto removida"),
    );
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Meu perfil"
      capa={COR_DA_CAPA}
      acoes={
        <Button
          size="xs"
          variant="primary"
          disabled={!mudou || !nomeValido || Boolean(erroDoWhatsapp) || salvando}
          onClick={() => void salvarNome()}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      }
    >
      <Formulario>
        {/* A janela de recorte sai por portal e cobre a tela; aqui ela e so
            montada, e nao ocupa espaco no formulario. */}
        {recortando && (
          <RecorteDeFoto
            arquivo={recortando}
            onPronto={(recorte) => void enviarFoto(recorte)}
            onCancelar={() => setRecortando(null)}
          />
        )}

        {/*
          ⚠️ A foto vem ACIMA do titulo, sobre uma faixa, como numa ficha.

          Ela e a cara da pessoa, nao um dado a preencher: dentro do grupo,
          ficava numa linha de formulario com rotulo a esquerda, como se "foto"
          fosse irma de "nome" e "e-mail". Aqui em cima ela abre a gaveta do jeito
          que um perfil abre em qualquer lugar, e o titulo logo abaixo passa a
          nomear os campos que realmente se digitam.

          ⚠️ A faixa SANGRA ate as bordas da gaveta (`margin` negativa de 16).

          O corpo do drawer tem 16 de recuo; respeitando esse recuo, a faixa
          viraria um retangulo cinza flutuando com folga dos dois lados — um
          cartao. Encostada nas bordas, ela le como cabecalho da ficha, que e o
          que ela e.
        */}
        <div style={{ margin: "-16px -16px 0" }}>
          <div style={{ height: ALTURA_DA_FAIXA, background: COR_DA_CAPA }} />

          {/*
            A foto sobe METADE para fora da faixa. E o encaixe do perfil de rede
            social, e ele existe por um motivo pratico: liga o retrato a faixa sem
            precisar de moldura, titulo ou linha para dizer que os dois sao a
            mesma peca.
          */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              padding: "0 16px",
              marginTop: -(LADO_DA_FOTO / 2),
            }}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <span
                aria-hidden
                style={{
                  width: LADO_DA_FOTO,
                  height: LADO_DA_FOTO,
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  borderRadius: "var(--radius-md)",
                  /* A borda da cor do fundo da gaveta recorta a foto contra a
                     capa. Sem ela, os dois tons se encostam e a foto parece
                     colada na faixa. */
                  border: "3px solid var(--surface)",
                  background: "var(--primary-subtle)",
                  color: "var(--primary)",
                  fontSize: 22,
                  fontWeight: "var(--fw-bold)",
                }}
              >
                {foto ? (
                  /*
                    `img` e nao `next/image`: a URL vem do storage com um `?v=`
                    que muda a cada troca, e o otimizador exigiria cadastrar o
                    host e ainda guardaria a versao antiga.
                  */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={foto}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  iniciais(nomeAtual ?? email)
                )}
              </span>

              {/*
                ⚠️ UM botao de camera no pe da foto, e nao dois botoes de texto ao
                lado.

                "Trocar foto" e "Remover" ocupavam a linha inteira para duas
                acoes que so existem por causa do retrato ao lado. Na quina dele,
                a camera diz o assunto sem palavra nenhuma, e o que fazer com a
                foto se decide no cartao que ela abre. E o gesto que toda ficha de
                perfil usa, do WhatsApp ao sistema operacional.
              */}
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuDaFoto}
                aria-label="Alterar a foto"
                title="Alterar a foto"
                disabled={salvando}
                onClick={() => setMenuDaFoto((v) => !v)}
                className="redondo"
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 28,
                  height: 28,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "var(--radius-full)",
                  border: "2px solid var(--surface)",
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  cursor: salvando ? "wait" : "pointer",
                  padding: 0,
                }}
              >
                <IconeCamera />
              </button>

              {menuDaFoto && (
                <>
                  {/* Camada que fecha ao clicar fora. O cartao e pequeno e vive
                      dentro da gaveta: nao precisa de portal. */}
                  <div
                    onClick={() => setMenuDaFoto(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 1 }}
                  />

                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      zIndex: 2,
                      minWidth: 170,
                      padding: 4,
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-strong)",
                      background: "var(--surface)",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    {/*
                      O `input` de arquivo fica escondido dentro do rotulo: o
                      campo nativo traz o texto "Nenhum arquivo escolhido" e um
                      botao com o visual do sistema operacional.
                    */}
                    <label style={ITEM_DO_CARTAO}>
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const arquivo = e.target.files?.[0] ?? null;
                          /* Zera o campo: escolhendo o MESMO arquivo de novo, o
                             `change` nao dispararia e a tela nao reagiria. */
                          e.target.value = "";
                          setMenuDaFoto(false);
                          if (arquivo) setRecortando(arquivo);
                        }}
                      />
                      {foto ? "Trocar a foto" : "Escolher uma foto"}
                    </label>

                    {foto && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuDaFoto(false);
                          void enviarFoto(null);
                        }}
                        style={{ ...ITEM_DO_CARTAO, color: "var(--danger-text)" }}
                      >
                        Remover a foto
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <GrupoDeCampos
          primeiro
          titulo="Identificação"
          legenda="É este nome e esta foto que aparecem no seu avatar e em quem lançou cada movimentação."
        >
          <Field label="Nome" required>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={120}
              style={inputStyle}
            />
          </Field>

          {/*
            ⚠️ Campo livre, e a troca vale so depois dos DOIS links.

            O projeto tem "Secure email change" ligado no Auth: a confirmacao sai
            para o endereco atual E para o novo, e a troca so acontece quando os
            dois forem abertos. E isso que segura a conta, e nao um campo de senha
            aqui: quem senta numa maquina destravada ate dispara o pedido, mas
            precisaria abrir a caixa ANTIGA para concluir, e quem tem a caixa
            antiga ja tinha a conta de qualquer jeito.

            ⚠️ A dica precisa dizer "os dois". Quem abre so o link do endereco
            novo continua entrando pelo antigo, e sem esse aviso conclui que a
            troca falhou.

            ⚠️ `type="email"` e o que existe de "mascara" aqui. Endereco de e-mail
            nao tem forma fixa para mascarar caractere a caractere: o que se pode
            e deixar o navegador validar o formato e oferecer o teclado certo no
            celular. A conferencia de verdade e do `emailSchema` no servidor.
          */}
          <Field
            label="E-mail"
            hint="É com ele que você entra. A troca é confirmada por link nos dois endereços, o atual e o novo."
          >
            <input
              type="email"
              autoComplete="email"
              value={emailNovo}
              onChange={(e) => setEmailNovo(e.target.value)}
              placeholder="voce@empresa.com.br"
              style={inputStyle}
            />
          </Field>

          {/*
            ⚠️ A troca EM CURSO precisa aparecer, e travada.

            Entre pedir e confirmar podem passar dias, e nesse meio tempo o campo
            de cima mostra o endereco antigo: quem volta aqui nao tem como saber
            se o pedido saiu, se expirou ou se ele digitou errado. O campo so
            existe enquanto ha troca pendente, e some sozinho quando o Auth
            conclui ou o link expira.

            ⚠️ Bloqueado porque nao ha o que fazer com ele aqui: quem termina a
            troca sao os dois links, e um campo editavel convidaria a corrigir o
            endereco por cima, o que na verdade abriria um segundo pedido.
          */}
          {emailPendente && (
            /*
              ⚠️ Rotulo CURTO ("A confirmar").

              A coluna de rotulo do `Field` tem 130px: "Aguardando confirmação"
              quebrava em duas linhas e desalinhava a caixa do campo de todos os
              outros. O que a frase explicava passou para a dica, que tem a
              largura inteira.
            */
            <Field
              label="A confirmar"
              hint="Abra o link enviado aos dois endereços para concluir a troca. Para desistir, basta não abrir."
            >
              <CampoBloqueado
                valor={emailPendente}
                titulo="Endereço novo, ainda não confirmado."
                /*
                  ⚠️ O reenviar mora DENTRO da caixa, e nao ao lado dela.

                  Fora, ele seria um botao solto na linha, do tamanho de uma acao
                  de formulario, para uma coisa que so existe enquanto durar
                  aquele campo. Dentro, ele se le como parte do proprio campo, que
                  e o que ele e. Mesma mecanica do olho do `CampoSecreto`.
                */
                depois={
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void reenviarConfirmacao()}
                    style={{
                      marginLeft: "auto",
                      border: "none",
                      background: "none",
                      padding: 0,
                      fontFamily: "var(--font)",
                      fontSize: "var(--text-sm)",
                      fontWeight: "var(--fw-medium)",
                      color: "var(--primary)",
                      cursor: salvando ? "wait" : "pointer",
                    }}
                  >
                    Reenviar
                  </button>
                }
              />
            </Field>
          )}

          <Field label="Pronome">
            <select
              value={pronome}
              onChange={(e) => setPronome(e.target.value)}
              style={selectStyle}
            >
              <option value="">Não informado</option>
              {PRONOMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Aniversário">
            <input
              type="date"
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              style={{ ...inputStyle, width: 170 }}
            />
          </Field>

          <Field label="Função" hint="O que você faz na empresa. Não define o que você pode ver.">
            <input
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              maxLength={80}
              placeholder="Financeiro, Suporte, Sócio"
              style={inputStyle}
            />
          </Field>

          {/*
            ⚠️ TRAVADO, e dizendo o porque no proprio campo.

            Grupo de permissao nao existe no banco: `usuariosxempresas` guarda so
            quem e de qual empresa, sem papel nem nivel. O campo aparece porque o
            lugar dele ja esta decidido, e quem procura "onde mudo o meu acesso"
            merece encontrar a resposta em vez do nada. Editavel, ele prometeria
            um controle que ninguem aplica.
          */}
          <Field
            label="Grupo de permissão"
            hint="Ainda não há grupos: todo acesso liberado enxerga o mesmo. Quem define isso é a empresa, não você."
          >
            {/* `CampoBloqueado` e a peca da casa para isto: mesmo tamanho de um
                campo editavel, fundo apagado e cadeado. Um `input` desabilitado
                por conta propria seria um segundo desenho para a mesma ideia. */}
            <CampoBloqueado valor={interno ? "Equipe da casa" : "Completo"} />
          </Field>
        </GrupoDeCampos>

        {/*
          ⚠️ As abas ficam DEPOIS da identificacao, e nao no topo da gaveta.

          Elas dividem o que se faz com a conta; quem sou eu nao entra na divisao.
          Empresas vem primeiro por ser o que se consulta e onde se troca de
          contexto; senha e o caso raro.

          ⚠️ O titulo do grupo dentro da aba NAO repete o nome dela.

          "Empresas > Empresas" nao acrescenta nada e ainda faz a pessoa ler duas
          vezes a mesma palavra para chegar ao conteudo. O nome da aba diz o
          assunto; o titulo e a legenda dizem o que ali se pode fazer.
        */}
        <div>
          <PanelTabs
            tabs={[ABA_EMPRESAS, ABA_CONTATO, ABA_SENHA, ABA_MAIS]}
            active={aba}
            onChange={setAba}
          />

          {aba === ABA_EMPRESAS && (
            <GrupoDeCampos
              primeiro
              titulo="Onde você entra"
              legenda="Cada empresa ligada a este acesso. A troca também se faz pelo cartão da empresa, no topo do menu."
            >

              <TableArea minWidth={0}>
                <TableHead>
                  {/* A coluna da marca nao tem titulo: um rotulo em cima de um
                      quadrado de 26px nomeia o obvio e rouba largura do nome. */}
                  <Th minWidth={34}> </Th>
                  <Th>Empresa</Th>
                  <Th minWidth={120}>Acesso</Th>
                  <Th minWidth={96}> </Th>
                </TableHead>

                <tbody>
                  {empresas.length === 0 && (
                    <EmptyRow colSpan={4} message="Nenhuma empresa ligada a este acesso." />
                  )}

                  {empresas.map((e, i) => {
                    const emUso = e.id === empresaAtualId;

                    return (
                      <Tr key={e.id} delay={i * 12}>
                        {/*
                          ⚠️ A MARCA entra na tabela.

                          Sem ela a lista era uma coluna de razoes sociais em caixa
                          alta, todas parecidas, e escolher entre elas virava
                          leitura de texto. A marca e como a pessoa reconhece a
                          empresa em um relance — e a mesma que ela ve no cartao do
                          topo do menu.
                        */}
                        <Td>
                          <MarcaDaEmpresa nome={e.nome} logo={e.logo} />
                        </Td>

                        <Td>
                          <span
                            style={{
                              fontWeight: emUso ? "var(--fw-semi)" : "var(--fw-regular)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {e.nome}
                          </span>
                        </Td>

                        {/*
                          ⚠️ O acesso e o MESMO em todas, e a coluna diz isso.

                          `usuariosxempresas` guarda so quem e de qual empresa: nao
                          existe papel, perfil nem nivel. Escrever "Administrador"
                          aqui prometeria um controle que o banco nao tem, e a
                          primeira pessoa a confiar nele daria acesso achando que
                          limitava. O unico recorte real e `interno`, que e do
                          usuario e nao da empresa.
                        */}
                        <Td>
                          <Badge tom={interno ? "info" : "neutral"}>
                            {interno ? "Equipe da casa" : "Completo"}
                          </Badge>
                        </Td>

                        {/*
                          ⚠️ A ultima coluna e a ACAO, e ela some na linha em uso.

                          Um botao "Usar esta" apagado na empresa ativa faria a
                          pessoa procurar por que ele nao clica. O que responde
                          "voce esta aqui" e a pastilha; o botao so existe onde ha
                          para onde ir.
                        */}
                        <Td style={{ textAlign: "right" }}>
                          {emUso ? (
                            <Badge tom="success">Em uso</Badge>
                          ) : (
                            <Button
                              size="xs"
                              disabled={assumindo != null}
                              onClick={() => void assumir(e.id)}
                            >
                              {assumindo === e.id ? "Entrando…" : "Usar esta"}
                            </Button>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </TableArea>
            </GrupoDeCampos>
          )}

          {aba === ABA_CONTATO && (
            <GrupoDeCampos
              primeiro
              titulo="Como te encontram"
              legenda="Fica visível para quem trabalha nas mesmas empresas. Nada aqui é usado para entrar no sistema."
            >
              {/*
                ⚠️ A mascara e a MESMA de pessoas (`mascararTelefone`), e nao uma
                escrita aqui: ela ja sabe do DDD, do nono digito e do numero de
                fora do pais, e uma segunda copia divergiria no primeiro ajuste.
              */}
              <Field label="WhatsApp" error={erroDoWhatsapp ?? undefined}>
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(mascararTelefone(e.target.value))}
                  maxLength={20}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  style={inputStyle}
                />
              </Field>

              {/*
                O arroba nao aparece como enfeite ao lado da caixa, mas tambem
                nao entra no cadastro: digitado junto, metade das pessoas escreve
                com e metade sem, e o mesmo usuario fica com duas grafias. O
                campo tira o que a pessoa digitar e guarda so o nome.
              */}
              <Field label="Instagram">
                {/* ⚠️ Mesma largura do WhatsApp: os dois sao campos livres do
                    mesmo grupo, e larguras diferentes dao a um deles uma
                    importancia que ele nao tem. */}
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value.replace(/^@+/, ""))}
                  maxLength={60}
                  placeholder="seu.usuario"
                  style={inputStyle}
                />
              </Field>
            </GrupoDeCampos>
          )}

          {aba === ABA_MAIS && (
            <GrupoDeCampos
              primeiro
              titulo="Seus dados"
              legenda="A LGPD garante a você pedir a exclusão dos seus dados pessoais. O pedido fica registrado com data e alguém responde."
            >
              {/*
                ⚠️ O botao ABRE UM PEDIDO, e nao apaga nada — e a tela diz isso
                antes de a pessoa clicar.

                Ela assina lancamento, baixa e ticket: `fkUserCriacao` aponta para
                ela em registro fiscal que a empresa e obrigada a guardar, e a
                propria LGPD ressalva esse dever. Um botao que prometesse
                apagamento imediato mentiria, e a pessoa so descobriria depois.
              */}
              {pedido === undefined ? (
                <span style={{ fontSize: "var(--text-base)", color: "var(--text-tertiary)" }}>
                  Carregando…
                </span>
              ) : pedido?.aberta ? (
                /*
                  ⚠️ Isto NAO e um alerta de resultado: e o estado do pedido, e
                  ele precisa estar aqui toda vez que a aba abrir. Aviso de
                  resultado ("pedido registrado") vai para a notificacao da casa
                  e some sozinho; isto fica.
                */
                <CampoBloqueado
                  valor={`Em análise desde ${paraFormatoBR(pedido.abertaEm.slice(0, 10) as DataISO)}`}
                  titulo="Você será avisado por e-mail quando houver resposta."
                />
              ) : (
                <>
                  {pedido && (
                    <Field label="Pedido anterior">
                      <CampoBloqueado
                        valor={`${paraFormatoBR(pedido.abertaEm.slice(0, 10) as DataISO)} — ${
                          pedido.situacao === "ATENDIDA" ? "atendido" : "recusado"
                        }`}
                        titulo={pedido.resposta ?? undefined}
                      />
                    </Field>
                  )}

                  <Field
                    label="Motivo"
                    hint="Opcional. Ajuda quem for analisar a entender o que você quer apagar."
                  >
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      maxLength={300}
                      style={inputStyle}
                    />
                  </Field>

                  <div>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={salvando}
                      onClick={() => void pedirExclusao()}
                    >
                      {salvando ? "Registrando…" : "Solicitar exclusão dos meus dados"}
                    </Button>
                  </div>

                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      lineHeight: "var(--lh-normal)",
                    }}
                  >
                    Lançamentos, baixas e documentos fiscais que você registrou continuam
                    guardados: a lei obriga a empresa a mantê-los. O que sai são os seus dados
                    pessoais de cadastro.
                  </span>
                </>
              )}
            </GrupoDeCampos>
          )}

          {aba === ABA_SENHA && (
            <GrupoDeCampos
              primeiro
              titulo="Trocar a senha"
              legenda="A senha atual é pedida para provar que é você. Ter a sessão aberta não basta."
            >

  <Field label="Senha atual" required>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={atual}
                    onChange={(e) => setAtual(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Nova senha" required>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={nova}
                    onChange={(e) => setNova(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field
                  label="Repita a nova senha"
                  required
                  hint="A senha atual é pedida para provar que é você. Ter a sessão aberta não basta."
                >
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={repetida}
                    onChange={(e) => setRepetida(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <div style={{ marginTop: 12 }}>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!senhaCompleta || salvando}
                    onClick={() => void salvarSenha()}
                  >
                    {salvando ? "Alterando…" : "Alterar senha"}
                  </Button>
                </div>
            </GrupoDeCampos>
          )}
        </div>

      </Formulario>
    </Drawer>
  );
}

/** Uma linha do cartao suspenso da foto. Mesmo desenho do menu do usuario. */
const ITEM_DO_CARTAO: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 8px",
  border: "none",
  background: "none",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontFamily: "var(--font)",
  fontSize: "var(--text-base)",
  color: "var(--text-primary)",
};

/** Camera: o que se faz com o retrato. */
function IconeCamera() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

/**
 * A marca da empresa na tabela, ou as iniciais dela.
 *
 * ⚠️ MESMO desenho do cartao da empresa no topo do menu: quadrado de 26px com
 * canto arredondado, e as iniciais em azul quando nao ha logo cadastrado. Um
 * segundo jeito de desenhar a mesma empresa faria a pessoa duvidar se e a mesma.
 */
function MarcaDaEmpresa({ nome, logo }: { nome: string; logo: string | null }) {
  const molde: React.CSSProperties = {
    width: 26,
    height: 26,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
  };

  if (logo) {
    return (
      /*
        `img` e nao `next/image`: a URL vem do storage e muda por empresa, e o
        otimizador exigiria cadastrar cada host.
      */
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" style={{ ...molde, objectFit: "contain" }} />
    );
  }

  return (
    <span
      aria-hidden
      style={{
        ...molde,
        background: "var(--primary-subtle)",
        color: "var(--primary)",
        fontSize: 10,
        fontWeight: "var(--fw-bold)",
      }}
    >
      {nome.trim().slice(0, 2).toUpperCase()}
    </span>
  );
}
