const navSubitems = [
  "Visão Geral",
  "AVCB",
  "Inspeções",
  "Extintores",
  "Ensaios",
  "Outros Indicadores",
];

const kpis = [
  { titulo: "Instalações", valor: "--", detalhe: "Total sob gestão" },
  { titulo: "Regular", valor: "--", detalhe: "Dentro da validade" },
  { titulo: "A vencer", valor: "--", detalhe: "Próximos 90 dias" },
  { titulo: "Vencido", valor: "--", detalhe: "Prazo expirado" },
  { titulo: "Conformidade", valor: "--", detalhe: "Índice geral" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#17212B]">
      {/* HEADER */}
      <header className="flex h-[72px] items-center justify-between border-b border-[#D9E1E8] bg-white px-7">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0B1F33] text-sm font-bold text-white">
            SSO
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[19px] font-semibold tracking-tight">
                CELEO
              </h1>

              <span className="h-5 w-px bg-[#D9E1E8]" />

              <span className="text-[17px] font-medium text-[#435466]">
                Portal SSO
              </span>
            </div>

            <p className="mt-0.5 text-xs text-[#78899A]">
              Segurança e Saúde Ocupacional
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full border border-[#D9E1E8] bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#66788A]">
            Ambiente de desenvolvimento
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF2F8] text-sm font-semibold text-[#163A5F]">
            VB
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-72px)]">
        {/* SIDEBAR */}
        <aside className="w-[274px] shrink-0 bg-[#0B1F33] px-4 py-6 text-white">
          <nav>
            {/* CONSULTAS */}
            <div>
              <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7F98AE]">
                Consultas
              </p>

              <div className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#163A5F]">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M4 19V9" />
                    <path d="M10 19V5" />
                    <path d="M16 19v-7" />
                    <path d="M22 19H2" />
                  </svg>
                </span>

                Painel Gerencial
              </div>

              <div className="ml-4 border-l border-[#29445E] pl-3">
                {navSubitems.map((item) => {
                  const ativo = item === "AVCB";

                  return (
                    <div
                      key={item}
                      className={[
                        "relative mb-1 flex items-center rounded-md px-3 py-2.5 text-[13px] transition",
                        ativo
                          ? "bg-[#163A5F] font-medium text-white"
                          : "text-[#B6C4D0] hover:bg-[#122D48] hover:text-white",
                      ].join(" ")}
                    >
                      {ativo && (
                        <span className="absolute -left-[13px] h-7 w-[3px] rounded-full bg-[#62A7D9]" />
                      )}

                      {item}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PROGRAMAS */}
            <div className="mt-7">
              <div className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#D8E1E8] transition hover:bg-[#122D48] hover:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#132D47]">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M12 3v18" />
                    <path d="M3 12h18" />
                  </svg>
                </span>

                Programas de SSO
              </div>
            </div>

            {/* GESTÃO */}
            <div className="mt-8">
              <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7F98AE]">
                Gestão
              </p>

              {["Usuários", "Permissões", "Configurações"].map((item) => (
                <div
                  key={item}
                  className="mb-1 cursor-pointer rounded-md px-3 py-2.5 text-[13px] text-[#B6C4D0] transition hover:bg-[#122D48] hover:text-white"
                >
                  {item}
                </div>
              ))}
            </div>
          </nav>
        </aside>

        {/* CONTEÚDO */}
        <main className="min-w-0 flex-1 px-8 py-7">
          {/* CABEÇALHO DA PÁGINA */}
          <div className="mb-7">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#78899A]">
              <span>Consultas</span>
              <span>/</span>
              <span>Painel Gerencial</span>
              <span>/</span>
              <span className="text-[#2563A5]">AVCB</span>
            </div>

            <h2 className="text-[29px] font-semibold tracking-[-0.02em] text-[#17212B]">
              Gestão de AVCB
            </h2>

            <p className="mt-1.5 text-sm text-[#66788A]">
              Acompanhamento da situação dos Autos de Vistoria do Corpo de
              Bombeiros.
            </p>
          </div>

          {/* ABAS */}
          <div className="mb-6 flex gap-7 border-b border-[#D9E1E8]">
            <button className="relative pb-3 text-sm font-semibold text-[#163A5F]">
              Gestão CELEO

              <span className="absolute bottom-[-1px] left-0 h-[3px] w-full rounded-t-full bg-[#2563A5]" />
            </button>

            <button className="pb-3 text-sm font-medium text-[#78899A] transition hover:text-[#435466]">
              Gestão Terceiros
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-5 gap-4">
            {kpis.map((kpi) => (
              <div
                key={kpi.titulo}
                className="rounded-[10px] border border-[#D9E1E8] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#78899A]">
                      {kpi.titulo}
                    </p>

                    <p className="mt-2 text-[27px] font-semibold tracking-tight text-[#17212B]">
                      {kpi.valor}
                    </p>
                  </div>

                  <div className="mt-1 h-2 w-2 rounded-full bg-[#A8B5C1]" />
                </div>

                <p className="mt-1 text-[11px] text-[#98A6B3]">
                  {kpi.detalhe}
                </p>
              </div>
            ))}
          </div>

          {/* DISTRIBUIÇÃO */}
          <section className="mt-5 rounded-[10px] border border-[#D9E1E8] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex items-center justify-between border-b border-[#E7ECF0] px-6 py-5">
              <div>
                <h3 className="text-[16px] font-semibold text-[#17212B]">
                  Distribuição por status
                </h3>

                <p className="mt-1 text-xs text-[#78899A]">
                  Situação atual dos AVCBs sob gestão.
                </p>
              </div>

              <div className="flex gap-2">
                <button className="rounded-md bg-[#163A5F] px-4 py-2 text-xs font-medium text-white">
                  Todos
                </button>

                <button className="rounded-md border border-[#D1D9E0] bg-white px-4 py-2 text-xs font-medium text-[#526474] transition hover:bg-[#F5F7FA]">
                  Vencido
                </button>

                <button className="rounded-md border border-[#D1D9E0] bg-white px-4 py-2 text-xs font-medium text-[#526474] transition hover:bg-[#F5F7FA]">
                  A vencer
                </button>

                <button className="rounded-md border border-[#D1D9E0] bg-white px-4 py-2 text-xs font-medium text-[#526474] transition hover:bg-[#F5F7FA]">
                  Regular
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              {/* REGULAR */}
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#21875B]" />
                    <span className="font-medium text-[#435466]">Regular</span>
                  </div>

                  <span className="font-semibold text-[#435466]">--</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[#EEF2F5]">
                  <div className="h-full w-0 bg-[#21875B]" />
                </div>
              </div>

              {/* A VENCER */}
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#D59B20]" />
                    <span className="font-medium text-[#435466]">
                      A vencer
                    </span>
                  </div>

                  <span className="font-semibold text-[#435466]">--</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[#EEF2F5]">
                  <div className="h-full w-0 bg-[#D59B20]" />
                </div>
              </div>

              {/* VENCIDO */}
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#C94B4B]" />
                    <span className="font-medium text-[#435466]">
                      Vencido
                    </span>
                  </div>

                  <span className="font-semibold text-[#435466]">--</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[#EEF2F5]">
                  <div className="h-full w-0 bg-[#C94B4B]" />
                </div>
              </div>

              <div className="mt-5 rounded-md bg-[#F7F9FB] px-4 py-3 text-xs text-[#66788A]">
                <span className="font-semibold text-[#435466]">
                  Critério de “A Vencer”:
                </span>{" "}
                AVCBs com vencimento nos próximos 90 dias.
              </div>
            </div>
          </section>

          {/* FILTROS */}
          <section className="mt-5 rounded-[10px] border border-[#D9E1E8] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="mb-4">
              <h3 className="text-[15px] font-semibold">Filtros</h3>
              <p className="mt-0.5 text-xs text-[#8A99A7]">
                Refine os dados apresentados no painel.
              </p>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {["Projeto", "UF", "Responsável", "Gestão", "Status"].map(
                (filtro) => (
                  <div key={filtro}>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[#78899A]">
                      {filtro}
                    </label>

                    <select className="w-full rounded-md border border-[#D1D9E0] bg-white px-3 py-2.5 text-sm text-[#435466] outline-none transition focus:border-[#2563A5]">
                      <option>Todos</option>
                    </select>
                  </div>
                ),
              )}
            </div>
          </section>

          {/* TABELA */}
          <section className="mt-5 overflow-hidden rounded-[10px] border border-[#D9E1E8] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex items-center justify-between border-b border-[#E7ECF0] px-5 py-4">
              <div>
                <h3 className="text-[15px] font-semibold">
                  Detalhamento dos AVCBs
                </h3>

                <p className="mt-0.5 text-xs text-[#8A99A7]">
                  Relação das instalações conforme os filtros selecionados.
                </p>
              </div>

              <div className="text-xs font-medium text-[#78899A]">
                -- registros
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FAFB]">
                  <tr className="border-b border-[#E7ECF0]">
                    {[
                      "Projeto",
                      "Subestação",
                      "UF",
                      "Responsável",
                      "Vigência",
                      "Status",
                    ].map((coluna) => (
                      <th
                        key={coluna}
                        className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#78899A]"
                      >
                        {coluna}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-[#98A6B3]"
                    >
                      Os dados do Supabase serão conectados na próxima etapa.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}