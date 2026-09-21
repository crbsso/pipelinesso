import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inicio | Portal SSO",
  description: "Portal de Seguran\u00e7a e Sa\u00fade Ocupacional da CELEO.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:px-10">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 3L19 6V11C19 15.55 16.03 19.74 12 21C7.97 19.74 5 15.55 5 11V6L12 3Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 12L11 14L15 10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Bem-vindo ao Portal SSO
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          Ambiente integrado para consulta e gest&atilde;o das informa&ccedil;&otilde;es
          de Seguran&ccedil;a e Sa&uacute;de Ocupacional da CELEO.
        </p>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          Utilize o menu lateral para acessar os m&oacute;dulos dispon&iacute;veis.
        </p>
      </div>
    </div>
  );
}
