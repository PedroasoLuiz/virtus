/**
 * Nome do cookie de preferencia de interface.
 *
 * Modulo sem `"use client"` de proposito: o layout e Server Component e precisa
 * desta constante. Importar um valor de um modulo marcado como cliente nao
 * funciona — o Next substitui o modulo por uma referencia de cliente e a
 * constante chega indefinida no servidor.
 */
export const COOKIE_SIDEBAR = "vope_sidebar";

/*
 * ⚠️ `cookieDaVisao` SAIU daqui, e nao deve voltar.
 *
 * Ela dava um cookie por tela, sob a ideia de que o kanban de tickets e o de
 * faturas eram escolhas diferentes. Na pratica nao sao: quem trabalha olhando
 * quadro quer quadro em tudo, e escolher de novo em cada tela era o trabalho
 * que a preferencia existia para poupar.
 *
 * Virou UMA preferencia, no perfil do usuario, em `modules/preferencias`. O
 * motivo de ser lida no servidor continua valendo e vale mais ainda: a sessao ja
 * a entrega junto do resto, e a pagina nasce no modo certo sem o piscar de abrir
 * em tabela e saltar para kanban quando o JavaScript sobe. A diferenca e que
 * agora ela acompanha a pessoa entre navegadores, e nao so o dispositivo.
 */
