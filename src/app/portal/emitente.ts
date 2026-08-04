"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * A empresa emissora escolhida pelo cliente.
 *
 * Cookie e nao parametro de URL porque a escolha atravessa a navegação: quando o
 * portal tiver a tela de chamados, ela precisa continuar valendo lá. É o mesmo
 * papel do `vpay_empresa` do sistema, com outro nome — o do sistema é o tenant
 * que se administra, este é de quem se recebe a cobrança, e misturar os dois num
 * cookie só faria um sobrescrever o outro.
 *
 * ⚠️ Não é credencial. Um cookie adulterado só troca a empresa exibida; o que o
 * cliente pode ver continua sendo decidido pelas policies `*_portal`.
 *
 * O nome fica local, sem `export`: arquivo `"use server"` só pode exportar
 * função async — tudo que ele expõe vira endpoint, e uma string não é chamável.
 */
const COOKIE_EMITENTE = "vpay_portal_emitente";

export async function emitenteEscolhido(): Promise<number | undefined> {
  const bruto = (await cookies()).get(COOKIE_EMITENTE)?.value;
  const id = Number(bruto);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export async function escolherEmitente(formData: FormData): Promise<void> {
  const id = Number(formData.get("emitenteId"));

  if (Number.isInteger(id) && id > 0) {
    (await cookies()).set(COOKIE_EMITENTE, String(id), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  redirect("/portal");
}
