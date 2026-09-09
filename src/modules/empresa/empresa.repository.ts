import { serverClient } from "@/infra/supabase/client";
import { primeiroPreenchido } from "@/shared/utils/texto";
import { ValidationError } from "@/shared/errors/app-error";
import type { CadastroDaEmpresa } from "@/modules/empresa/empresa.types";

/**
 * O emitente dos documentos: quem assina o cabecalho de todo PDF do sistema.
 *
 * ⚠️ Um arquivo so para a regra. Ela estava escrita identica em
 * `faturas.repository` e `tickets.repository`, e o extrato ia virar a terceira
 * copia. Cada uma e um lugar a mais para o cabecalho mudar num documento e nao
 * nos outros — e documento que sai para cliente com endereco divergente do
 * anterior nao se explica.
 *
 * ⚠️ A razao social cai para o fantasia e depois para o nome. O cadastro
 * herdado tem empresa com um dos tres vazio, e um cabecalho em branco no papel
 * e pior que o nome curto.
 */
export type EmpresaParaDocumento = {
  razaoSocial: string | null;
  endereco: string | null;
  cnpj: string | null;
  logo: string | null;
};

export async function dadosDaEmpresa(empresaId: number): Promise<EmpresaParaDocumento> {
  const supabase = await serverClient();
  const { data } = await supabase
    .from("empresas")
    .select("razaosocial, fantasia, nome, cnpj, logo, logradouro, bairro, cidade, cep")
    .eq("id", empresaId)
    .maybeSingle();

  const e = data as Record<string, string | null> | null;

  return {
    razaoSocial: primeiroPreenchido(e?.razaosocial, e?.fantasia, e?.nome),
    endereco: primeiroPreenchido(
      [e?.logradouro, e?.bairro, e?.cidade, e?.cep].filter(Boolean).join(" · "),
    ),
    cnpj: primeiroPreenchido(e?.cnpj),
    logo: primeiroPreenchido(e?.logo),
  };
}

/**
 * O cadastro inteiro, do jeito que se digita.
 *
 * ⚠️ Separado de `dadosDaEmpresa`, logo acima, ainda que leia a mesma linha.
 * Aquela resolve as quedas do cabecalho dos PDFs (razao social caindo para
 * fantasia, endereco numa linha so); esta devolve campo a campo, porque um
 * formulario nao pode receber o valor ja resolvido — a pessoa editaria a queda
 * em vez do campo vazio, e gravaria o fantasia por cima da razao social.
 */
export async function cadastroDaEmpresa(empresaId: number): Promise<CadastroDaEmpresa | null> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("empresas")
    /* ⚠️ LITERAL, numa linha so. O supabase-js interpreta esta string em tempo
       de tipo: partida em duas com `+`, ela volta como `GenericStringError` e o
       resultado inteiro perde o tipo. */
    // prettier-ignore
    .select("id, razaosocial, fantasia, nome, cnpj, ie, inscricaomunicipal, logo, urlcertificadodigital, email, contato, cep, logradouro, numero, complemento, bairro, cidade, estado, codigoibge")
    .eq("id", empresaId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const e = data as Record<string, string | number | null>;
  const texto = (v: string | number | null | undefined) => (v == null ? "" : String(v));

  return {
    id: Number(e.id),
    razaoSocial: texto(e.razaosocial),
    fantasia: texto(e.fantasia),
    apelido: texto(e.nome),
    cnpj: texto(e.cnpj),
    ie: texto(e.ie),
    inscricaoMunicipal: texto(e.inscricaomunicipal),
    logo: texto(e.logo),
    certificado: texto(e.urlcertificadodigital),
    email: texto(e.email),
    contato: texto(e.contato),
    cep: texto(e.cep),
    logradouro: texto(e.logradouro),
    numero: texto(e.numero),
    complemento: texto(e.complemento),
    bairro: texto(e.bairro),
    cidade: texto(e.cidade),
    estado: texto(e.estado),
    codigoIbge: texto(e.codigoibge),
  };
}

/**
 * Grava o cadastro.
 *
 * ⚠️ NAO toca em `ativo`, `logo` nem `urlcertificadodigital`.
 *
 * `ativo` diz se a empresa existe para os dois produtos que dividem este banco,
 * e desligar isso de dentro de uma gaveta do Vope seria mexer no outro pela
 * janela. Os outros dois sao ARQUIVO e tem caminho proprio; mandados como texto
 * por aqui, um salvar de quem nunca abriu a aba de documentos apagaria os dois.
 *
 * ⚠️ `select` depois do update para saber se ALGUMA linha mudou. Sob RLS, um
 * update que a politica descarta volta com sucesso e zero linhas — e sem esta
 * conferencia a tela diria "salvo" para uma gravacao que nao aconteceu.
 */
export type LinhaDaEmpresa = {
  razaosocial: string | null;
  fantasia: string | null;
  nome: string | null;
  cnpj: string | null;
  ie: string | null;
  inscricaomunicipal: string | null;
  email: string | null;
  contato: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  codigoibge: string | null;
};

export async function salvarCadastroDaEmpresa(
  empresaId: number,
  dados: LinhaDaEmpresa,
): Promise<boolean> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("empresas")
    .update(dados)
    .eq("id", empresaId)
    .select("id");

  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * A marca da empresa.
 *
 * ⚠️ Bucket PUBLICO (`virtusmind`), como a foto do usuario. A marca sai no
 * cabecalho do PDF e no e-mail de cobranca, e cliente de e-mail nao segue link
 * assinado com validade: a imagem simplesmente nao carregaria. Ela e desenhada
 * para ser vista por terceiros, entao nao ha o que proteger.
 *
 * ⚠️ Caminho FIXO por empresa, com `?v=` na URL. A troca cobre o arquivo
 * anterior em vez de acumular orfaos, e o parametro e o que faz o navegador
 * largar a versao antiga que ele ja tinha em cache.
 */
export async function subirLogo(empresaId: number, arquivo: File): Promise<string> {
  const supabase = await serverClient();
  const extensao = (arquivo.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
  const caminho = `Empresas/${empresaId}/logo.${extensao}`;

  const { error } = await supabase.storage
    .from(BUCKET_PUBLICO)
    .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET_PUBLICO).getPublicUrl(caminho);
  return `${data.publicUrl}?v=${Date.now()}`;
}

const BUCKET_PUBLICO = "virtusmind";

/** Grava (ou apaga, com `null`) a URL da marca. */
export async function definirLogo(empresaId: number, url: string | null): Promise<boolean> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("empresas")
    .update({ logo: url })
    .eq("id", empresaId)
    .select("id");

  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * O certificado digital A1.
 *
 * ⚠️ Bucket PRIVADO (`documentos`), ao contrario da marca. Um A1 e a assinatura
 * da empresa em arquivo: com ele e a senha se emite nota em nome dela. Publico,
 * bastaria adivinhar a URL. A policy do Storage confere a empresa pelo PRIMEIRO
 * segmento do caminho, que e por isso que ele comeca por `empresa/{id}`.
 *
 * ⚠️ O nome do arquivo e um UUID, e nao "certificado.pfx". Num bucket privado o
 * caminho ainda e a ultima linha de defesa se uma policy for afrouxada um dia, e
 * nome previsivel nao defende nada.
 *
 * ⚠️ A SENHA do certificado nao passa por aqui e nao e guardada em lugar nenhum.
 * Arquivo mais senha e a assinatura completa; guardar os dois juntos e guardar a
 * empresa inteira num lugar so. Quando a emissao de nota existir, a senha sera
 * pedida na hora de assinar.
 */
export async function subirCertificado(empresaId: number, arquivo: File): Promise<string> {
  const supabase = await serverClient();
  const extensao = (arquivo.name.split(".").pop() ?? "pfx").toLowerCase().slice(0, 4);
  const caminho = `empresa/${empresaId}/certificado/${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage
    .from("documentos")
    .upload(caminho, arquivo, { upsert: false, contentType: "application/x-pkcs12" });

  /*
   * ⚠️ A recusa do bucket vira mensagem, e nao um erro cru no log.
   *
   * O bucket tem lista propria de tipos aceitos, separada da nossa: enquanto o
   * `.pfx` nao estava nela, o envio falhava aqui e a tela dizia so "nao foi
   * possivel enviar" — sem nada no caminho nem na permissao para explicar. Duas
   * listas em lugares diferentes vao divergir de novo um dia, e da proxima vez a
   * mensagem diz qual delas recusou.
   */
  if (error) {
    throw new ValidationError(`O armazenamento recusou o arquivo: ${error.message}`);
  }

  return caminho;
}

/** Grava (ou apaga, com `null`) o caminho do certificado. */
export async function definirCertificado(
  empresaId: number,
  caminho: string | null,
): Promise<boolean> {
  const supabase = await serverClient();

  const { data, error } = await supabase
    .from("empresas")
    .update({ urlcertificadodigital: caminho })
    .eq("id", empresaId)
    .select("id");

  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Quantos bytes a empresa ocupa no bucket privado.
 *
 * ⚠️ Uma RPC, e nao um `list` do Storage. Os arquivos moram quatro pastas abaixo
 * de `empresa/{id}` (`modulo/faturaId/tipo/arquivo`), e o `list` do cliente
 * enxerga uma pasta por chamada: somar de fora seria uma varredura recursiva
 * pagando uma ida ao servidor por nivel, para devolver um numero.
 *
 * A funcao e `security definer` porque `storage.objects` nao e exposta pela API,
 * e confere o acesso na primeira linha dela. Ver a migracao
 * `armazenamento_da_empresa`.
 */
export async function bytesUsados(empresaId: number): Promise<number> {
  const supabase = await serverClient();

  const { data, error } = await supabase.rpc("armazenamento_da_empresa", {
    p_empresa: empresaId,
  });

  if (error) throw error;
  return Number(data ?? 0);
}
