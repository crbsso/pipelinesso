"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Formulario = {
  nomeCompleto: string;
  emailCorporativo: string;
  empresa: string;
  cargoFuncao: string;
  projetoUnidade: string;
  justificativa: string;
};

const formularioInicial: Formulario = {
  nomeCompleto: "",
  emailCorporativo: "",
  empresa: "",
  cargoFuncao: "",
  projetoUnidade: "",
  justificativa: "",
};

export default function SolicitarAcessoPage() {
  const [formulario, setFormulario] =
    useState<Formulario>(formularioInicial);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const inputClassName =
    "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

  const atualizarCampo = (
    campo: keyof Formulario,
    valor: string,
  ) => {
    setFormulario((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccess(false);
    setIsLoading(true);

    try {
      const resposta = await fetch(
        "/api/solicitacoes-acesso",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formulario),
        },
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        setErrorMessage(
          resultado.error ??
            "Não foi possível enviar sua solicitação.",
        );
        return;
      }

      setSuccess(true);
      setFormulario(formularioInicial);
    } catch (error) {
      console.error(
        "Erro ao enviar solicitação de acesso:",
        error,
      );

      setErrorMessage(
        "Ocorreu um erro ao enviar sua solicitação. Tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
          Solicitação de acesso
        </p>

        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Solicite acesso ao Portal SSO
        </h1>

        <p className="mt-4 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          Preencha seus dados profissionais. A solicitação será
          encaminhada para análise da equipe responsável e não concede
          acesso automaticamente.
        </p>
      </div>

      {!success ? (
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="nomeCompleto"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Nome completo
              </label>

              <input
                id="nomeCompleto"
                type="text"
                autoComplete="name"
                placeholder="Seu nome completo"
                value={formulario.nomeCompleto}
                onChange={(event) =>
                  atualizarCampo(
                    "nomeCompleto",
                    event.target.value,
                  )
                }
                className={inputClassName}
                maxLength={150}
                required
              />
            </div>

            <div>
              <label
                htmlFor="emailCorporativo"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                E-mail profissional
              </label>

              <input
                id="emailCorporativo"
                type="email"
                autoComplete="email"
                placeholder="seu.email@empresa.com"
                value={formulario.emailCorporativo}
                onChange={(event) =>
                  atualizarCampo(
                    "emailCorporativo",
                    event.target.value,
                  )
                }
                className={inputClassName}
                maxLength={254}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="empresa"
                  className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Empresa
                </label>

                <input
                  id="empresa"
                  type="text"
                  placeholder="Ex.: CELEO"
                  value={formulario.empresa}
                  onChange={(event) =>
                    atualizarCampo(
                      "empresa",
                      event.target.value,
                    )
                  }
                  className={inputClassName}
                  maxLength={120}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="cargoFuncao"
                  className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cargo / função
                </label>

                <input
                  id="cargoFuncao"
                  type="text"
                  placeholder="Ex.: Técnico de Segurança"
                  value={formulario.cargoFuncao}
                  onChange={(event) =>
                    atualizarCampo(
                      "cargoFuncao",
                      event.target.value,
                    )
                  }
                  className={inputClassName}
                  maxLength={120}
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="projetoUnidade"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Projeto / unidade
              </label>

              <input
                id="projetoUnidade"
                type="text"
                placeholder="Informe o projeto, unidade ou área"
                value={formulario.projetoUnidade}
                onChange={(event) =>
                  atualizarCampo(
                    "projetoUnidade",
                    event.target.value,
                  )
                }
                className={inputClassName}
                maxLength={150}
                required
              />
            </div>

            <div>
              <label
                htmlFor="justificativa"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Justificativa do acesso
              </label>

              <textarea
                id="justificativa"
                placeholder="Explique brevemente por que você precisa acessar o Portal SSO."
                value={formulario.justificativa}
                onChange={(event) =>
                  atualizarCampo(
                    "justificativa",
                    event.target.value,
                  )
                }
                className="min-h-28 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                maxLength={2000}
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
              {isLoading
                ? "Enviando solicitação..."
                : "Enviar solicitação"}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">
            Solicitação enviada
          </p>

          <p className="mt-2 text-sm leading-6 text-emerald-700 dark:text-emerald-400">
            Sua solicitação foi registrada com status PENDENTE e será
            analisada pela equipe responsável. O envio não cria uma conta
            nem libera acesso automaticamente.
          </p>
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
