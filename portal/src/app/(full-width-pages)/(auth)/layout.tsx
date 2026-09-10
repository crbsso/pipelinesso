import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { ThemeProvider } from "@/context/ThemeContext";
import Image from "next/image";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <main className="min-h-screen bg-white dark:bg-gray-950">
        <div className="flex min-h-screen w-full">
          {/* Área de login */}
          <section className="flex w-full items-center justify-center bg-white px-6 py-10 dark:bg-gray-950 lg:w-[42%] lg:px-12 xl:px-20">
            <div className="w-full max-w-md">{children}</div>
          </section>

          {/* Área institucional */}
          <section className="relative hidden min-h-screen overflow-hidden lg:block lg:w-[58%]">
            <Image
              src="/images/sso/login-sso.png"
              alt="Equipe técnica em ambiente de infraestrutura elétrica"
              fill
              priority
              sizes="58vw"
              className="object-cover object-center"
            />

            {/* Sobreposição para leitura */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/15" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />

            {/* Mensagem institucional */}
            <div className="absolute bottom-14 left-12 right-12 z-10 max-w-2xl xl:bottom-16 xl:left-14">
              <div className="mb-5 h-1 w-12 rounded-full bg-sky-400" />

              <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
                Segurança orientada por
                <span className="block text-sky-300">
                  informação e prevenção.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-white/80 xl:text-lg">
                Indicadores, conformidade e gestão de Segurança e Saúde
                Ocupacional em um único ambiente.
              </p>

              <div className="mt-8 flex items-center gap-6 border-t border-white/20 pt-5 text-xs font-medium uppercase tracking-[0.12em] text-white/65">
                <span>Segurança</span>

                <span className="h-1 w-1 rounded-full bg-white/40" />

                <span>Saúde</span>

                <span className="h-1 w-1 rounded-full bg-white/40" />

                <span>Gestão</span>
              </div>
            </div>
          </section>
        </div>

        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </main>
    </ThemeProvider>
  );
}