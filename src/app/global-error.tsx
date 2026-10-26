"use client"; // Error boundaries são Client Components.

import { useEffect } from "react";

/**
 * Erro no próprio layout raiz: substitui o documento inteiro (sem globals.css), por isso
 * os estilos ficam aqui mesmo. Mesma mensagem de falha do painel, em pt-BR.
 */
export default function ErroGlobal({ error }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 16,
          background: "#17203b",
          color: "#fff",
          fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <title>Erro · savi.core</title>
        <main role="alert" style={{ maxWidth: "26rem" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 22 }}>
            <span style={{ color: "#ade736" }}>/</span>savi.core
          </p>
          <p style={{ margin: "28px 0 24px", fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
            Não foi possível carregar seu painel. Tente de novo.
          </p>
          {/* Recarga completa: o layout raiz falhou, então refaz tudo no servidor. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block",
              background: "#ade736",
              color: "#17203b",
              fontWeight: 700,
              borderRadius: 999,
              padding: "10px 18px",
              textDecoration: "none",
            }}
          >
            Tentar de novo
          </a>
        </main>
      </body>
    </html>
  );
}
