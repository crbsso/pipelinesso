"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function AtualizarSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage(
        "A nova senha deve possuir pelo menos 8 caracteres."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas informadas não são iguais.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error("Erro ao atualizar senha:", error.message);

        setErrorMessage(
          "Não foi possível atualizar sua senha. Solicite um novo link de recuperação."
        );

        return;
      }

      // Encerra somente a sessão temporária usada na recuperação.
      await supabase.auth.signOut({ scope: "local" });

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Erro inesperado:", error);

      setErrorMessage(
        "Ocorreu um erro ao atualizar sua senha."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-lg font-semibold text-emerald-800">
            Senha atualizada
          </p>

          <p className="mt-2 text-sm leading-6 text-emerald-700">
            Sua nova senha foi cadastrada com sucesso. Agora você pode
            acessar o Portal SSO utilizando essa senha.
          </p>
        </div>

        <Link
          href="/signin"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Recuperação de acesso
        </p>

        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Crie uma nova senha
        </h1>

        <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
          Defina uma nova senha para acessar sua conta no Portal SSO.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-5">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Nova senha
            </label>

            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              required
              minLength={8}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Confirmar nova senha
            </label>

            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              required
              minLength={8}
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">
                {errorMessage}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Atualizando..." : "Atualizar senha"}
          </button>
        </div>
      </form>
    </div>
  );
}