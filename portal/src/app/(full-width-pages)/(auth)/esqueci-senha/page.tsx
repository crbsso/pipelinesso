"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccess(false);

    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado) {
      setErrorMessage("Informe seu e-mail corporativo.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(
        emailNormalizado,
        {
          redirectTo: window.location.origin,
        }
      );

      if (error) {
        console.error(
          "Erro ao solicitar recuperação de senha:",
          error.message
        );

        setErrorMessage(
          "Não foi possível processar a solicitação. Tente novamente."
        );

        return;
      }

      setSuccess(true);
    } catch (error) {
      console.error(
        "Erro inesperado ao solicitar recuperação de senha:",
        error
      );

      setErrorMessage(
        "Ocorreu um erro ao solicitar a recuperação da senha."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Recuperação de acesso
        </p>

        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Esqueceu sua senha?
        </h1>

        <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
          Informe o e-mail corporativo associado à sua conta no Portal SSO.
          Enviaremos as instruções para definição de uma nova senha.
        </p>
      </div>

      {!success ? (
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                E-mail corporativo
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="seu.email@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                required
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
                <p className="text-sm leading-6 text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/15 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-600"
            >
              {isLoading ? (
                "Enviando..."
              ) : (
                <>
                  Enviar link de recuperação

                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                className="stroke-emerald-700 dark:stroke-emerald-400"
                aria-hidden="true"
              >
                <path
                  d="m5 12 4 4L19 6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                Solicitação recebida
              </p>

              <p className="mt-2 text-sm leading-6 text-emerald-700 dark:text-emerald-400">
                Se este e-mail estiver associado a uma conta autorizada do
                Portal SSO, você receberá um link para redefinir sua senha.
              </p>

              <p className="mt-2 text-sm leading-6 text-emerald-700 dark:text-emerald-400">
                Verifique também a pasta de spam ou lixo eletrônico.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-7">
        <Link
          href="/signin"
          className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition hover:text-sky-700 hover:underline dark:text-sky-400"
        >
          <span aria-hidden="true">←</span>
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}