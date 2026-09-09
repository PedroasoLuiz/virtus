import * as repo from "@/modules/empresa/empresa.repository";
import type { CadastroDaEmpresa } from "@/modules/empresa/empresa.types";
import type { EntradaDoCadastro } from "@/modules/empresa/empresa.schema";
import { cnpjParaBanco } from "@/modules/empresa/empresa.schema";
import { AppError, NotFoundError, ValidationError } from "@/shared/errors/app-error";
import { apagarDocumento } from "@/shared/storage/documentos";
import { entitlementsDaEmpresa } from "@/modules/plataforma/plataforma.service";
import type { ArmazenamentoDaEmpresa } from "@/modules/empresa/empresa.types";

/**
 * O cadastro da propria empresa.
 *
 * ⚠️ A empresa e sempre a ATIVA da sessao, recebida de cima. O servico nao
 * escolhe tenant: quem escolhe e o cookie, conferido no contexto.
 */
export async function cadastro(empresaId: number): Promise<CadastroDaEmpresa> {
  const dados = await repo.cadastroDaEmpresa(empresaId);
  if (!dados) throw new NotFoundError("Empresa não encontrada");
  return dados;
}

/**
 * Grava o cadastro.
 *
 * ⚠️ String vazia vira `null` no banco.
 *
 * A coluna aceita os dois, e o resto do sistema ja trata `null` como "nao
 * informou" — `primeiroPreenchido`, no cabecalho dos PDFs, e o exemplo. Gravando
 * `""`, o cabecalho passaria a imprimir uma linha em branco em vez de cair para
 * o proximo campo preenchido.
 */
export async function salvar(empresaId: number, entrada: EntradaDoCadastro): Promise<void> {
  const vazio = (v: string) => (v.trim() === "" ? null : v.trim());

  const gravou = await repo.salvarCadastroDaEmpresa(empresaId, {
    razaosocial: vazio(entrada.razaoSocial),
    fantasia: vazio(entrada.fantasia),
    nome: vazio(entrada.apelido),
    cnpj: vazio(cnpjParaBanco(entrada.cnpj)),
    ie: vazio(entrada.ie),
    inscricaomunicipal: vazio(entrada.inscricaoMunicipal),
    email: vazio(entrada.email.toLowerCase()),
    contato: vazio(entrada.contato),
    cep: vazio(entrada.cep),
    logradouro: vazio(entrada.logradouro),
    numero: vazio(entrada.numero),
    complemento: vazio(entrada.complemento),
    bairro: vazio(entrada.bairro),
    cidade: vazio(entrada.cidade),
    estado: vazio(entrada.estado),
    codigoibge: vazio(entrada.codigoIbge),
  });

  /*
   * ⚠️ Zero linhas nao e sucesso silencioso.
   *
   * Sob RLS, o update de uma linha que a politica nao alcanca volta sem erro e
   * sem nada gravado. Sem esta checagem a gaveta fecharia dizendo "salvo" e o
   * cadastro continuaria como estava, que e o pior dos dois mundos: a pessoa
   * so descobriria no PDF do mes seguinte.
   */
  if (!gravou) {
    throw new AppError("FORBIDDEN", 403, "Sem permissão para alterar esta empresa.");
  }
}

/**
 * O espaco ocupado e o teto do plano.
 *
 * ⚠️ Nunca derruba a gaveta. E um numero de rodape: se a soma falhar, o cadastro
 * da empresa continua abrindo e editavel, e o que some e a linha do espaco. Um
 * erro aqui impedindo alguem de corrigir o CNPJ seria trocar o essencial pelo
 * acessorio.
 */
export async function armazenamento(empresaId: number): Promise<ArmazenamentoDaEmpresa | null> {
  try {
    const [usadoBytes, entitlements] = await Promise.all([
      repo.bytesUsados(empresaId),
      entitlementsDaEmpresa(empresaId),
    ]);

    return { usadoBytes, limiteMb: entitlements.plano?.limites.storageMb ?? null };
  } catch {
    return null;
  }
}

/** Imagem de marca: o que cliente de e-mail sabe desenhar. */
const TIPOS_DA_MARCA = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const TETO_DA_MARCA = 2 * 1024 * 1024;

export async function trocarLogo(empresaId: number, arquivo: File): Promise<string> {
  if (!TIPOS_DA_MARCA.includes(arquivo.type)) {
    throw new ValidationError("Envie a marca em PNG, JPG, WEBP ou SVG.");
  }
  if (arquivo.size > TETO_DA_MARCA) {
    throw new ValidationError("A imagem passou de 2 MB.");
  }

  const url = await repo.subirLogo(empresaId, arquivo);
  if (!await repo.definirLogo(empresaId, url)) {
    throw new AppError("FORBIDDEN", 403, "Sem permissão para alterar esta empresa.");
  }
  return url;
}

/**
 * ⚠️ Apaga so o cadastro, e nao o arquivo. O caminho e fixo por empresa: a
 * proxima marca cobre esta, e apagar no storage seria uma segunda chamada que
 * pode falhar sozinha e deixar o cadastro apontando para nada.
 */
export async function removerLogo(empresaId: number): Promise<void> {
  if (!await repo.definirLogo(empresaId, null)) {
    throw new AppError("FORBIDDEN", 403, "Sem permissão para alterar esta empresa.");
  }
}

/*
 * O A1 e um PKCS#12. Os navegadores nomeiam esse tipo de tres jeitos diferentes
 * e alguns nao nomeiam nada — por isso a extensao TAMBEM vale como prova.
 */
const TIPOS_DO_CERTIFICADO = [
  "application/x-pkcs12",
  "application/pkcs12",
  "application/x-pkcs12-certificate",
];
const TETO_DO_CERTIFICADO = 1024 * 1024;

export async function enviarCertificado(empresaId: number, arquivo: File): Promise<void> {
  const extensao = (arquivo.name.split(".").pop() ?? "").toLowerCase();

  if (!TIPOS_DO_CERTIFICADO.includes(arquivo.type) && !["pfx", "p12"].includes(extensao)) {
    throw new ValidationError("O certificado A1 é um arquivo .pfx ou .p12.");
  }
  if (arquivo.size > TETO_DO_CERTIFICADO) {
    throw new ValidationError("Certificado maior que 1 MB. Confira se é o arquivo certo.");
  }

  const caminho = await repo.subirCertificado(empresaId, arquivo);
  if (!await repo.definirCertificado(empresaId, caminho)) {
    throw new AppError("FORBIDDEN", 403, "Sem permissão para alterar esta empresa.");
  }
}

/**
 * ⚠️ Aqui o arquivo e apagado DE VERDADE, ao contrario da marca.
 *
 * O caminho leva um UUID, entao ele nao seria coberto pelo proximo envio e
 * ficaria para sempre no bucket. E, diferente de uma imagem, o que sobraria e a
 * assinatura da empresa esquecida num arquivo que ninguem mais lista.
 */
export async function removerCertificado(empresaId: number, caminho: string): Promise<void> {
  if (!await repo.definirCertificado(empresaId, null)) {
    throw new AppError("FORBIDDEN", 403, "Sem permissão para alterar esta empresa.");
  }
  if (caminho) await apagarDocumento(caminho);
}
