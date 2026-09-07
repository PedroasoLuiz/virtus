import "server-only";
import { formatarDocumento } from "@/shared/domain/documento";

/**
 * O e-mail da cobranca.
 *
 * ⚠️ A referencia e a FATURA, e nao mais o ticket.
 *
 * Era o ticket, pelo argumento de que o cliente conhece o servico que
 * contratou. Mas uma fatura reune VARIOS tickets, e ai o assunto virava "Sua
 * fatura dos tickets 160, 161" — uma lista para identificar um documento so.
 * Pior: o que o cliente abre, paga e guarda e a fatura; se ele responder
 * citando o ticket, ninguem sabe de qual cobranca ele esta falando.
 *
 * O numero da fatura e o de `faturas.idtenant`, que e o que a empresa ve na
 * tela — e nao a chave interna do banco.
 *
 * Quem assina e a EMPRESA que cobra, e agora com a marca dela no topo: e o
 * logotipo que o cliente reconhece antes de ler qualquer palavra, e um nome de
 * sistema no meio so levantaria a duvida de quem esta pedindo o dinheiro.
 *
 * ⚠️ "Fatura", e nao "cobranca". A palavra e a mesma coisa e o tom nao e:
 * cobranca soa a quem esta devendo, e este e-mail sai no dia do fechamento,
 * antes de qualquer atraso. O cliente que recebe uma fatura esta em dia.
 *
 * Sem travessao em lugar nenhum do texto, por preferencia declarada.
 *
 * HTML de e-mail nao e HTML de pagina: `<style>` no `<head>` e descartado por
 * varios clientes, entao tudo vai em `style=` na propria tag, e a estrutura e
 * feita com `<table>`, porque flex e grid o Outlook ignora.
 */

/* Azul da marca. E-mail nao le CSS var: se a identidade mudar, muda aqui. */
const AZUL = "#0A52B9";
const AZUL_CLARO = "#eef3fb";
const AZUL_LINHA = "#d8e2f2";

/*
 * ⚠️ Cinzas FRIOS, e nao os de antes.
 *
 * O fundo era `#f4f6f4` e o rotulo `#5b6b5e`: verdes tingidos, da epoca em que
 * a marca era verde. Ao lado do azul eles lem como sujeira, e o cartao branco
 * parecia amarelado sobre a pagina.
 */
const FUNDO = "#eef0f4";
const BORDA = "#dfe3ea";
const ROTULO = "#5d6b7d";
const TINTA = "#101012";
const TEXTO = "#43474e";
const APAGADO = "#8a8f98";

export function htmlDaFatura(dados: {
  empresaNome: string;
  /** A razao social por extenso, para a assinatura. Ver o repositorio. */
  empresaRazaoSocial: string | null;
  /** URL publica do logotipo de quem cobra. Nulo em empresa sem marca subida. */
  empresaLogo: string | null;
  empresaCnpj: string | null;
  empresaEndereco: string | null;
  /** Para onde mandar quem tiver duvida. O remetente e um nao-responda. */
  empresaEmail: string | null;
  empresaTelefone: string | null;
  /**
   * O numero da fatura — a referencia do documento.
   *
   * ⚠️ `faturas.idtenant`, e nao `faturas.id`. O primeiro e o numero que a
   * empresa ve e diz ao telefone; o segundo e chave de banco.
   */
  fatura: number;
  clienteNome: string | null;
  /** A pessoa que cuida disso no cliente. E quem o e-mail cumprimenta. */
  clienteResponsavel: string | null;
  /** Quem foi faturado, por extenso, e o documento dele. */
  clienteRazaoSocial: string | null;
  clienteCnpj: string | null;
  competencia: string;
  vencimento: string;
  valor: string;
  /**
   * Qual parcela e esta, sempre — "1 de 1" inclusive.
   *
   * ⚠️ Era omitida quando havia so uma, para nao virar ruido. Mas quem recebe
   * o e-mail nao sabe quantas existem: sem a linha, uma cobranca unica e a
   * primeira de doze chegam com a mesma cara, e a duvida ("isso e tudo ou vem
   * mais?") volta como pergunta ao financeiro. "1 de 1" responde de graca.
   */
  parcela: string;
  urlDoPortal: string;
}): string {
  const referencia = `Fatura ${dados.fatura}`;

  /*
   * ⚠️ So o RESPONSAVEL cumprimenta. Sem ele, cumprimenta-se sem nome.
   *
   * O nome do cliente aqui e a empresa, e "Ola, ALFALAGOS LTDA" e pior que
   * "Ola" seco: parece mala direta mal feita, que e exatamente o que uma
   * cobranca nao pode parecer.
   */
  const saudacao = dados.clienteResponsavel
    ? `Olá, ${escapar(primeiroNome(dados.clienteResponsavel))}.`
    : "Olá.";

  /*
   * ⚠️ O topo mostra a MARCA ou o nome, nunca os dois.
   *
   * Logotipo com o nome da empresa escrito embaixo e o nome duas vezes: quase
   * todo logotipo ja traz o nome desenhado nele. A altura fixa em 40px e a
   * largura automatica preservam a proporcao de qualquer arquivo que a empresa
   * suba, alto ou deitado.
   *
   * ⚠️ `alt` com o nome da empresa. Metade dos clientes de e-mail bloqueia
   * imagem por padrao: sem o `alt`, o topo da cobranca chega em branco.
   */
  const topo = dados.empresaLogo
    ? `<img src="${escapar(dados.empresaLogo)}" alt="${escapar(dados.empresaNome)}" height="40" style="height:40px;width:auto;max-width:220px;border:0;outline:none;display:block;margin:0 auto;" />`
    : `<div style="font-size:15px;font-weight:700;letter-spacing:0.02em;color:${TINTA};">${escapar(dados.empresaNome)}</div>`;

  /*
   * ⚠️ Quem foi faturado entra como LINHA, junto de vencimento e referencia.
   *
   * Era um bloco centralizado embaixo, com desenho proprio. Dois desenhos para
   * a mesma coisa — dados da cobranca — faziam o quadro parecer duas caixas
   * empilhadas por acaso. Agora e uma lista de rotulo e valor, e a leitura
   * desce numa coluna so.
   */
  const faturadoNome = dados.clienteRazaoSocial ?? dados.clienteNome;

  /*
   * ⚠️ Para onde mandar a duvida, ja que responder nao serve.
   *
   * O e-mail some do texto quando a empresa nao tem um cadastrado: prometer
   * "fale com a gente" sem dizer onde e pior que nao prometer nada. O endereco
   * vira link de verdade — este e o unico do e-mail que deve ser clicavel
   * alem do botao.
   */
  const contato = dados.empresaEmail
    ? `escreva para <a href="mailto:${escapar(dados.empresaEmail)}" style="color:${AZUL};text-decoration:none;font-weight:600;">${escapar(dados.empresaEmail)}</a>${
        dados.empresaTelefone ? ` ou ligue para ${semDetectar(dados.empresaTelefone, ROTULO)}` : ""
      }`
    : dados.empresaTelefone
      ? `ligue para ${semDetectar(dados.empresaTelefone, ROTULO)}`
      : "";

  const assinatura = [
    dados.empresaCnpj ? `CNPJ ${formatarDocumento(dados.empresaCnpj)}` : null,
    dados.empresaEndereco,
  ]
    .filter(Boolean)
    .map((t) => semDetectar(String(t), APAGADO))
    .join("<br />");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <!-- Sem isto o iOS transforma CNPJ em telefone e endereco em mapa, e a
       assinatura chega azul e sublinhada. Ver semDetectar, para os demais
       clientes. Crase nao entra aqui: fecharia o template literal. -->
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
  <title>${escapar(referencia)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${FUNDO};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA};-webkit-font-smoothing:antialiased;">

  <!-- Previa da caixa de entrada: e a segunda linha que o cliente le na lista,
       antes de abrir. Escondida no corpo para nao repetir o assunto na tela. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapar(dados.valor)} com vencimento em ${escapar(dados.vencimento)}. Boleto e nota fiscal na página.
  </div>

  <!-- Tabela externa: e o que centraliza em cliente que ignora margin:auto. -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${FUNDO};">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <!-- O cartao ocupa a largura toda ate 600px e para de crescer: linha
             comprida demais cansa, e no celular ele encosta nas bordas. -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid ${BORDA};">

          <!-- Marca de quem cobra -->
          <tr>
            <td style="padding:30px 32px 0;text-align:center;">
              ${topo}
            </td>
          </tr>

          <!-- Assunto.
               ⚠️ SEM o numero do ticket aqui. Ele ja aparece no quadro de
               dados logo abaixo, e diziamos "Sua cobranca do Ticket 160" para
               repetir "Ticket 160" quatro centimetros depois. -->
          <tr>
            <td style="padding:26px 32px 0;text-align:center;">
              <h1 style="margin:0;font-size:21px;line-height:1.3;font-weight:700;color:${TINTA};">
                Sua fatura está disponível
              </h1>
              <!-- ⚠️ Corpo em 12px, o mesmo do rodape.
                   Estava em 15px e competia com o titulo logo acima, que ja diz
                   o essencial. Aqui o texto e apoio: quem le em diagonal para no
                   titulo e no quadro azul, e este paragrafo existe para quem
                   quer o contexto antes de clicar. -->
              <p style="margin:12px 0 0;font-size:12px;line-height:1.75;color:${TEXTO};">
                ${saudacao} O fechamento${dados.competencia !== "—" ? ` referente a ${escapar(dados.competencia)}` : ""} foi
                concluído e a fatura correspondente já está disponível. Abaixo estão o
                vencimento, a referência e o valor; no botão você acessa a página da
                fatura, onde ficam o boleto, a nota fiscal e o detalhamento do que foi
                prestado no período. Agradecemos pela parceria e seguimos à disposição.
              </p>
            </td>
          </tr>

          <!-- Quadro de valores.
               O valor lidera porque e a primeira pergunta de quem abre; o resto
               qualifica. -->
          <tr>
            <td style="padding:22px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${AZUL_CLARO};border-radius:10px;">
                <tr>
                  <td style="padding:18px 22px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${linha("Vencimento", dados.vencimento, false, true)}
                      ${linha("Referência", referencia)}
                      ${linha("Parcela", dados.parcela)}
                      ${faturadoNome ? linha("Faturado para", faturadoNome) : ""}
                      ${dados.clienteCnpj ? linha("CNPJ", formatarDocumento(dados.clienteCnpj), true) : ""}
                    </table>

                    <!-- O valor fecha a lista, depois de um divisor.
                         ⚠️ Ele saiu do topo em 30px e virou a ULTIMA linha, so
                         que maior e em azul. Como heroi centralizado ele era um
                         segundo cartao dentro do cartao; aqui a leitura desce
                         numa coluna so e termina onde importa. -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${AZUL_LINHA};margin-top:14px;">
                      <tr>
                        <td valign="middle" style="padding:14px 12px 0 0;font-size:13px;color:${ROTULO};white-space:nowrap;">Valor:</td>
                        <td valign="middle" style="padding:14px 0 0;font-size:22px;line-height:1.2;font-weight:700;color:${AZUL};text-align:right;">${escapar(dados.valor)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ação -->
          <tr>
            <td style="padding:24px 32px 0;">
              <!-- Fundo no proprio <a>: na celula, o padding do link nao
                   contava para a altura da caixa e o botao saia achatado. -->
              <a href="${escapar(dados.urlDoPortal)}" style="display:block;width:100%;box-sizing:border-box;padding:13px 24px;background-color:${AZUL};color:#ffffff;font-size:14px;font-weight:600;text-align:center;text-decoration:none;border-radius:10px;">
                Ver fatura e baixar documentos
              </a>
            </td>
          </tr>

          <!-- Fecho.
               ⚠️ Os dois paragrafos viraram UM. Eram "o link e pessoal" e "se
               ja pagou, desconsidere", em blocos separados com pesos
               diferentes: duas ressalvas seguidas, cada uma pedindo a atencao
               que a outra acabou de pedir.

               ⚠️ E NAO convida mais a responder. O remetente e um endereco de
               nao-responda, e o convite antigo mandava o cliente para uma
               resposta que voltaria como falha de entrega. Agora aponta para o
               contato de verdade da empresa. -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0;font-size:12px;line-height:1.7;color:${ROTULO};text-align:center;">
                O link é pessoal e leva aos seus documentos: evite encaminhá-lo.
                Se o pagamento já foi feito, desconsidere este aviso.${
                  contato
                    ? ` Para falar sobre valores, prazos ou qualquer detalhe da fatura, ${contato}.`
                    : ""
                }
              </p>
            </td>
          </tr>

          <!-- Assinatura de quem cobra.
               ⚠️ CNPJ e endereco no rodape nao sao formalidade: cobranca sem
               identificacao de quem emite parece golpe, e filtro de spam
               pontua a falta deles. -->
          ${
            assinatura
              ? `<tr>
            <td style="padding:20px 32px 26px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:${APAGADO};text-align:center;border-top:1px solid ${BORDA};padding-top:20px;">
                <strong style="color:${ROTULO};">${escapar(dados.empresaRazaoSocial ?? dados.empresaNome)}</strong><br />
                ${assinatura}
              </p>
            </td>
          </tr>`
              : ""
          }
        </table>

        <!-- Rodape de fora do cartao: o que vale para a mensagem, e nao para a
             cobranca. Por isso fica solto sobre o fundo, mais apagado que tudo.

             ⚠️ Tudo num paragrafo so. Em dois blocos, o segundo ganhava peso de
             secao e o rodape virava um bloco de texto do tamanho do conteudo. -->
        <p style="max-width:600px;margin:18px auto 0;font-size:11px;line-height:1.6;color:${APAGADO};text-align:center;">
          Mensagem destinada ao destinatário indicado e possivelmente confidencial.
          Se você a recebeu por engano, por favor apague-a. Seus documentos ficam
          disponíveis na página da fatura sempre que precisar. Antes de imprimir, pense
          na sua responsabilidade com o meio ambiente.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Uma linha do quadro de dados, abaixo do valor.
 *
 * ⚠️ O rotulo leva DOIS PONTOS. Sem eles, rotulo e valor lem como duas colunas
 * de uma tabela que perdeu o cabecalho; com eles, cada linha se le sozinha como
 * uma frase: "Vencimento: 15/10/2026".
 *
 * `documento` pede para o cliente de e-mail nao transformar o valor em link:
 * CNPJ tem cara de telefone. Ver `semDetectar`.
 */
function linha(rotulo: string, valor: string, documento = false, primeira = false): string {
  const topo = primeira ? "0" : "9px";
  return `<tr>
    <td valign="top" style="padding:${topo} 12px 0 0;font-size:13px;line-height:1.45;color:${ROTULO};white-space:nowrap;">${escapar(rotulo)}:</td>
    <td valign="top" style="padding:${topo} 0 0;font-size:13px;line-height:1.45;font-weight:600;color:${TINTA};text-align:right;">${documento ? semDetectar(valor, TINTA) : escapar(valor)}</td>
  </tr>`;
}

/**
 * Texto que o cliente de e-mail NAO deve transformar em link.
 *
 * ⚠️ CNPJ e CEP tem cara de telefone, e endereco tem cara de mapa. O Gmail e o
 * Mail do iPhone detectam os dois e envolvem sozinhos num `<a>` com o azul
 * deles — a assinatura chegava sublinhada e clicavel, no meio de um e-mail
 * cuja unica acao deveria ser o botao.
 *
 * A `<meta format-detection>` resolve no iOS. Para o resto, o jeito que
 * funciona e entregar o texto JA dentro de um link: quem ja e link nao vira
 * link de novo, e este aponta para lugar nenhum e se pinta da cor do redor.
 */
function semDetectar(texto: string, cor: string): string {
  return `<a href="#" style="color:${cor};text-decoration:none;cursor:default;pointer-events:none;">${escapar(texto)}</a>`;
}

/**
 * O primeiro nome de quem responde, em caixa de gente.
 *
 * ⚠️ Corta tambem em `/`, `,` e `&`. O campo de responsavel e texto livre, e
 * o cadastro tem "LUCAS/KENYA" — duas pessoas numa linha. Cortando so no
 * espaco, o cumprimento saia "Ola, LUCAS/KENYA".
 *
 * ⚠️ E devolve "Lucas", nao "LUCAS". O cadastro veio todo em maiuscula da
 * importacao, e gritar o nome de quem se cumprimenta e o contrario do que a
 * saudacao existe para fazer.
 */
function primeiroNome(nome: string): string {
  const primeiro = nome.trim().split(/[\s/,&]+/).filter(Boolean)[0] ?? nome;
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

/**
 * Escapa o que vem do banco.
 *
 * Nome de cliente com `&` ou `<` quebraria o HTML; e um nome escolhido por
 * terceiro nunca deveria virar marcacao dentro de um e-mail que sai em nome da
 * empresa.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
