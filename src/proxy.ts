import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { semSessao } from "@/lib/supabase/sessao";

/** Rotas que exigem login. */
function protegida(caminho: string): boolean {
  return caminho === "/" || caminho === "/enviar" || caminho.startsWith("/enviar/");
}

/**
 * Renova a sessão do Supabase a cada requisição (padrão do @supabase/ssr) e protege as rotas:
 * anônimo em `/` ou `/enviar` → `/entrar`; logado em `/entrar` → `/`.
 * Se o Auth estiver fora do ar, não redireciona: a página mostra a falha.
 */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(lista, cabecalhos) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
          Object.entries(cabecalhos ?? {}).forEach(([k, v]) => resposta.headers.set(k, v));
        },
      },
    },
  );

  // Não colocar código entre a criação do cliente e getUser(): é ele que renova o token.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const destino =
    !user && semSessao(error) && protegida(caminho) ? "/entrar" : user && caminho === "/entrar" ? "/" : null;
  if (destino) {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = "";
    const redirecionar = NextResponse.redirect(url);
    // Leva junto os cookies renovados (ou apagados) pelo getUser().
    resposta.cookies.getAll().forEach((c) => redirecionar.cookies.set(c));
    return redirecionar;
  }
  return resposta;
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos do Next, fontes, manifesto, ícones e imagens.
    "/((?!_next/static|_next/image|fonts/|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff2?)$).*)",
  ],
};
