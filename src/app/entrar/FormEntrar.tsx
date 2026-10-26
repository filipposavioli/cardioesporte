"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { pedirCodigo, verificarCodigo } from "./actions";

const NEUTRA = "Se este e-mail estiver cadastrado, você receberá um código.";

/** Duas etapas na mesma tela: e-mail → código de 6 dígitos → painel. */
export function FormEntrar() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const campoEmail = useRef<HTMLInputElement>(null);

  function enviarEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    iniciar(async () => {
      await pedirCodigo(email);
      setErro(null);
      setCodigo("");
      setEtapa("codigo");
    });
  }

  function enviarCodigo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    iniciar(async () => {
      const r = await verificarCodigo(email, codigo);
      if ("erro" in r) {
        setErro(r.erro);
        return;
      }
      router.replace("/");
    });
  }

  function trocarEmail() {
    setErro(null);
    setCodigo("");
    setEtapa("email");
    requestAnimationFrame(() => campoEmail.current?.focus());
  }

  if (etapa === "email") {
    return (
      <form className="en-form" onSubmit={enviarEmail}>
        <label className="en-label" htmlFor="en-email">
          Seu e-mail
        </label>
        <input
          ref={campoEmail}
          id="en-email"
          className="en-input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="en-dica">Enviamos um código de 6 dígitos para você entrar, sem senha.</p>
        <button className="en-btn" type="submit" disabled={pendente}>
          {pendente ? "Enviando…" : "Receber código"}
        </button>
      </form>
    );
  }

  return (
    <form className="en-form" onSubmit={enviarCodigo}>
      <p className="en-status" role="status">
        {NEUTRA}
      </p>
      <p className="en-email">{email.trim()}</p>
      <label className="en-label" htmlFor="en-codigo">
        Código de 6 dígitos
      </label>
      <input
        id="en-codigo"
        className="en-input en-codigo"
        type="text"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        value={codigo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? "en-erro" : undefined}
        onChange={(e) => {
          setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6));
          setErro(null);
        }}
      />
      {erro && (
        <p id="en-erro" className="en-erro" role="alert">
          {erro}
        </p>
      )}
      <button className="en-btn" type="submit" disabled={pendente}>
        {pendente ? "Conferindo…" : "Entrar"}
      </button>
      <p className="en-dica">Não chegou? Confira o spam, ou volte e peça um novo código.</p>
      <button className="en-link" type="button" onClick={trocarEmail} disabled={pendente}>
        Trocar e-mail
      </button>
    </form>
  );
}
