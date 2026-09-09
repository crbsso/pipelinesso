"use client";

import { EyeCloseIcon, EyeIcon } from "@/icons";
import { createClient } from "@/lib/supabase/client";

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
    "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs outline-none transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800";

  return (
    <div className="flex w-full flex-1 flex-col lg:w-1/2">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 text-title-sm font-semibold text-gray-800 dark:text-white/90 sm:text-title-md">
              Portal SSO
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Entre com suas credenciais para acessar o Portal de Segurança e
              Saúde Ocupacional.
            </p>
          </div>

          <form onSubmit={handleSignIn}>
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                >
                  E-mail <span className="text-error-500">*</span>
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
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                >
                  Senha <span className="text-error-500">*</span>
                </label>

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
                    className="absolute right-4 top-1/2 z-30 -translate-y-1/2"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 dark:border-error-500/30 dark:bg-error-500/10">
                  <p className="text-sm text-error-600 dark:text-error-400">
                    {errorMessage}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              Acesso restrito a usuários autorizados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}