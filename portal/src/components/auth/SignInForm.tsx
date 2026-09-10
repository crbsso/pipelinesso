"use client";

import { EyeCloseIcon, EyeIcon } from "@/icons";
import { createClient } from "@/lib/supabase/client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { FormEvent, useState } from "react";

export default function SignInForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Informe seu e-mail e sua senha.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("Erro de autenticação:", error.message);

        setErrorMessage(
          "Não foi possível entrar. Verifique seu e-mail e sua senha."
        );

        return;
      }

      router.replace("/consultas/painel-gerencial/avcb");
      router.refresh();
    } catch (error) {
      console.error("Erro inesperado no login:", error);

      setErrorMessage(
        "Ocorreu um erro ao tentar entrar no Portal SSO."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const inputClassName =
    "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

  return (
    <div className="w-full">
      <div className="mb-10">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Image
              src="/images/logo/seguranca-trabalho.png"
              alt="CELEO Portal SSO"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              CELEO
            </p>

            <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
              Portal SSO
            </p>
          </div>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Acesso corporativo
        </p>

        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          Bem-vindo ao Portal SSO
        </h2>

        <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
          Entre com suas credenciais para acessar o ambiente de Segurança e
          Saúde Ocupacional.
        </p>
      </div>

      <form onSubmit={handleSignIn}>
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
              className={inputClassName}
              required
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Senha
              </label>

              <Link
                href="/esqueci-senha"
                className="text-sm font-medium text-sky-600 transition hover:text-sky-700 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>

            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${inputClassName} pr-12`}
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                className="absolute right-4 top-1/2 z-20 -translate-y-1/2"
                aria-label={
                  showPassword ? "Ocultar senha" : "Mostrar senha"
                }
              >
                {showPassword ? (
                  <EyeIcon className="fill-slate-500 dark:fill-slate-400" />
                ) : (
                  <EyeCloseIcon className="fill-slate-500 dark:fill-slate-400" />
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/15 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-600"
          >
            {isLoading ? (
              "Entrando..."
            ) : (
              <>
                Entrar no Portal

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

      <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0"
          >
            <path
              d="M12 3 5 6v5c0 4.6 2.9 8.1 7 10 4.1-1.9 7-5.4 7-10V6l-7-3Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <span>Acesso restrito a usuários autorizados.</span>
        </div>
      </div>
    </div>
  );
}