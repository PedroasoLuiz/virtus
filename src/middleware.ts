import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Renovacao de sessao e guarda de rota.
 *
 * Duas responsabilidades, nesta ordem:
 *
 * 1. Renovar o token do Supabase. Server Components nao podem gravar cookie,
 *    entao sem este middleware o access token expira (1h por padrao) e o
 *    usuario e deslogado no meio do trabalho. E o unico lugar do sistema que
 *    pode reescrever o cookie de sessao.
 *
 * 2. Barrar rota privada sem sessao, antes de renderizar qualquer coisa.
 */

const ROTAS_PUBLICAS = ["/login", "/recuperar-senha", "/auth"];
const COOKIE_EMPRESA = "vpay_empresa";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;


  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem configuracao nao ha o que renovar nem como autenticar. Deixa passar
  // para a UI mostrar a tela de configuracao em vez de um redirect infinito.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() valida o token no servidor e dispara a renovacao. Nao trocar por
  // getSession(), que apenas le o cookie sem verificar assinatura.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ehPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r));

  // A API nunca redireciona: quem chama espera JSON. O `handler` responde 401
  // com o envelope padrao — devolver um 307 para /login quebraria o fetch do
  // cliente com um erro de CORS ou HTML no lugar do corpo esperado.
  if (pathname.startsWith("/api/")) return response;

  if (!user && !ehPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    // Preserva para onde a pessoa queria ir, para devolver depois do login.
    if (pathname !== "/") destino.searchParams.set("de", pathname);
    return NextResponse.redirect(destino);
  }

  if (user && pathname === "/login") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  // Logado sem empresa escolhida: a casca do app nao tem tenant para consultar.
  if (user && !ehPublica && pathname !== "/selecionar-empresa") {
    if (!request.cookies.get(COOKIE_EMPRESA)) {
      const destino = request.nextUrl.clone();
      destino.pathname = "/selecionar-empresa";
      destino.search = "";
      return NextResponse.redirect(destino);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos estaticos e imagens. `_next/*` e favicon nao precisam de
     * sessao e rodar middleware neles so custa latencia.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
