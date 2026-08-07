"use client";

/**
 * Aviso do sistema operacional quando chega mensagem.
 *
 * ⚠️ Existe porque o painel vive DENTRO do sistema. Quem está numa fatura, num
 * ticket ou em outra aba não vê o contador da barra lateral, e cliente esperando
 * resposta é o caso em que atrasar cinco minutos custa. O aviso é a única coisa
 * que atravessa a janela.
 */

/** Este navegador sabe notificar? Falta em janela sem HTTPS e em alguns móveis. */
export function navegadorNotifica(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permissaoDeAviso(): NotificationPermission | null {
  return navegadorNotifica() ? Notification.permission : null;
}

/**
 * Pede a permissão.
 *
 * ⚠️ Só no CLIQUE de quem quer. Pedido na carga da página, o navegador conta
 * como abuso: o Chrome silencia o pedido para sempre naquele site, e aí nem
 * quem queria consegue ligar depois. Por isso a tela oferece o botão em vez de
 * perguntar sozinha.
 */
export async function pedirPermissaoDeAviso(): Promise<NotificationPermission | null> {
  if (!navegadorNotifica()) return null;

  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Mostra um aviso, se houver permissão.
 *
 * ⚠️ `tag` por CONVERSA. Sem ela, dez mensagens seguidas do mesmo cliente
 * empilham dez avisos na tela; com ela, o novo substitui o anterior e sobra um
 * por conversa, que é o que a pessoa precisa saber.
 *
 * ⚠️ E `renotify` LIGADO junto. Substituir sem renotificar troca o texto do
 * aviso em silêncio: no Windows, o primeiro vai para a central de ações e os
 * seguintes o atualizam lá dentro, sem nunca voltar a aparecer na tela. Só a
 * primeira mensagem de uma conversa era vista, e as outras chegavam mudas.
 *
 * O barulho repetido era a preocupação, e ela estava mal calibrada: perder a
 * segunda mensagem de um cliente custa muito mais do que um som a mais.
 */
export function avisarNoNavegador(entrada: {
  titulo: string;
  corpo: string;
  tag: string;
  icone?: string | null;
  aoClicar: () => void;
}) {
  if (!navegadorNotifica() || Notification.permission !== "granted") return;

  try {
    const aviso = new Notification(entrada.titulo, {
      body: entrada.corpo,
      tag: entrada.tag,
      icon: entrada.icone || "/favicon.ico",
      renotify: true,
      silent: false,
    } as NotificationOptions);

    aviso.onclick = () => {
      window.focus();
      aviso.close();
      entrada.aoClicar();
    };
  } catch {
    // Navegador que recusa o construtor (alguns Android exigem service worker)
    // simplesmente nao avisa. Nao ha o que fazer, e quebrar o painel por causa
    // de um aviso seria pior do que ficar sem ele.
  }
}
