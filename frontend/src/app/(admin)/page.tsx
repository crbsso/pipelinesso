import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "In?cio | Portal SSO",
  description: "Portal de Seguran?a e Sa?de Ocupacional da CELEO.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:px-10">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl dark:bg-blue-500/10">
          ???
        </div>

        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Bem-vindo ao Portal SSO
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          Ambiente integrado para consulta e gest?o das informa??es de
          Seguran?a e Sa?de Ocupacional da CELEO.
        </p>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          Utilize o menu lateral para acessar os m?dulos dispon?veis.
        </p>
      </div>
    </div>
  );
}
