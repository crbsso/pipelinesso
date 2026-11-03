"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import Image from "next/image";
import Link from "next/link";
import { rotaPermitida, type AbasPermitidas } from "@/lib/auth/acessoAbas";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";

import {
  BoxCubeIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  PageIcon,
  UserCircleIcon,
} from "../icons/index";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: {
    name: string;
    path: string;
    pro?: boolean;
    new?: boolean;
  }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Painel Gerencial",
    subItems: [
      {
        name: "Visão Geral",
        path: "/consultas/painel-gerencial/visao-geral",
      },
      {
        name: "AVCB",
        path: "/consultas/painel-gerencial/avcb",
      },
      {
        name: "Inspeções",
        path: "/consultas/painel-gerencial/inspecoes",
      },
      {
        name: "Ações",
        path: "/consultas/painel-gerencial/planos-acao",
      },
      {
        name: "Motoristas",
        path: "/consultas/painel-gerencial/motoristas",
      },
      {
        name: "Extintores",
        path: "/consultas/painel-gerencial/extintores",
      },
      {
        name: "Ensaios",
        path: "/consultas/painel-gerencial/ensaios",
      },
      {
        name: "Outros Indicadores",
        path: "/consultas/painel-gerencial/outros-indicadores",
      },
    ],
  },
  {
    icon: <PageIcon />,
    name: "Programas de SSO",
    subItems: [
      {
        name: "Rota Segura",
        path: "/consultas/programas-sso/rota-segura",
      },
      {
        name: "Regras que Salvam Vidas",
        path: "/consultas/programas-sso/regras-que-salvam-vidas",
      },
      {
        name: "SIPAT",
        path: "/consultas/programas-sso/sipat",
      },
      {
        name: "Outros Programas",
        path: "/consultas/programas-sso/outros-programas",
      },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <PageIcon />,
    name: "Solicitações de acesso",
    path: "/gestao/solicitacoes-acesso",
  },
  {
    icon: <UserCircleIcon />,
    name: "Usuários",
    path: "/gestao/usuarios",
  },
  {
    icon: <BoxCubeIcon />,
    name: "Permissões",
    path: "/gestao/permissoes",
  },
];

const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    setIsHovered,
  } = useSidebar();

  const pathname = usePathname();
  const [abas, setAbas] = useState<AbasPermitidas>({});
  useEffect(()=>{
    const controle=new AbortController();
    const carregar=()=>fetch('/api/acesso/abas',{cache:'no-store',signal:controle.signal})
      .then(async resposta=>resposta.ok?await resposta.json():{})
      .then((valor:AbasPermitidas)=>{if(!controle.signal.aborted)setAbas(valor);})
      .catch(()=>{if(!controle.signal.aborted)setAbas({});});
    void carregar();
    window.addEventListener('focus',carregar);
    return ()=>{controle.abort();window.removeEventListener('focus',carregar);};
  },[pathname]);
  const itensConsulta=navItems.map(item=>({...item,subItems:item.subItems?.filter(sub=>rotaPermitida(sub.path,abas))})).filter(item=>item.subItems?.length);
  const itensGestao=othersItems.filter(item=>rotaPermitida(item.path??'',abas));

  type Submenu = { type: "main" | "others"; index: number };
  const [menuManual, setMenuManual] = useState<{rota:string;submenu:Submenu|null}|null>(null);
  const menuDaRota:Submenu|null = (() => {
    for (const tipo of ["main","others"] as const) {
      const indice=(tipo==="main"?itensConsulta:itensGestao).findIndex(nav=>nav.subItems?.some(item=>item.path===pathname));
      if(indice>=0)return {type:tipo,index:indice};
    }
    return null;
  })();
  const openSubmenu=menuManual?.rota===pathname?menuManual.submenu:menuDaRota;
  const chaveSubmenu=openSubmenu?openSubmenu.type+"-"+openSubmenu.index:null;

  const [subMenuHeight, setSubMenuHeight] = useState<
    Record<string, number>
  >({});

  const subMenuRefs = useRef<
    Record<string, HTMLDivElement | null>
  >({});

  const isActive = useCallback(
    (path: string) => path === pathname,
    [pathname],
  );

  useEffect(() => {
    if(!chaveSubmenu)return;
    const elemento=subMenuRefs.current[chaveSubmenu];
    if(elemento){
      const altura=elemento.scrollHeight;
      setSubMenuHeight(anterior=>anterior[chaveSubmenu]===altura?anterior:{...anterior,[chaveSubmenu]:altura});
    }
  },[chaveSubmenu]);

  const handleSubmenuToggle = (index:number, menuType:"main"|"others") => {
    setMenuManual({rota:pathname,submenu:openSubmenu?.type===menuType&&openSubmenu.index===index
      ?null:{type:menuType,index}});
  };

  const renderMenuItems = (
    items: NavItem[],
    menuType: "main" | "others",
  ) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() =>
                handleSubmenuToggle(index, menuType)
              }
              className={`menu-item group ${
                openSubmenu?.type === menuType &&
                openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={
                  openSubmenu?.type === menuType &&
                  openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }
              >
                {nav.icon}
              </span>

              {(isExpanded ||
                isHovered ||
                isMobileOpen) && (
                <span className="menu-item-text">
                  {nav.name}
                </span>
              )}

              {(isExpanded ||
                isHovered ||
                isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto h-5 w-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path)
                    ? "menu-item-active"
                    : "menu-item-inactive"
                }`}
              >
                <span
                  className={
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }
                >
                  {nav.icon}
                </span>

                {(isExpanded ||
                  isHovered ||
                  isMobileOpen) && (
                  <span className="menu-item-text">
                    {nav.name}
                  </span>
                )}
              </Link>
            )
          )}

          {nav.subItems &&
            (isExpanded ||
              isHovered ||
              isMobileOpen) && (
              <div
                ref={(el) => {
                  subMenuRefs.current[
                    `${menuType}-${index}`
                  ] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{
                  height:
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? `${subMenuHeight[
                          `${menuType}-${index}`
                        ]}px`
                      : "0px",
                }}
              >
                <ul className="ml-9 mt-2 space-y-1">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        }`}
                      >
                        {subItem.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed left-0 top-0 z-50 mt-16 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 lg:mt-0
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
              ? "w-[290px]"
              : "w-[90px]"
        }
        ${
          isMobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }
        lg:translate-x-0`}
      onMouseEnter={() =>
        !isExpanded && setIsHovered(true)
      }
      onMouseLeave={() =>
        setIsHovered(false)
      }
    >
      <div
        className={`flex py-8 ${
          !isExpanded && !isHovered
            ? "lg:justify-center"
            : "justify-start"
        }`}
      >
        <Link
          href="/"
          className="flex items-center gap-3"
        >
          {isExpanded ||
          isHovered ||
          isMobileOpen ? (
            <>
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src="/images/logo/seguranca-trabalho.png"
                  alt="Segurança do Trabalho"
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              <div className="leading-tight">
                <div className="text-base font-bold text-gray-900 dark:text-white">
                  CELEO
                </div>

                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Portal SSO
                </div>
              </div>
            </>
          ) : (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
              <Image
                src="/images/logo/seguranca-trabalho.png"
                alt="Segurança do Trabalho"
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-6">
            <div>
              <h2
                className={`mb-4 flex text-xs uppercase leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded ||
                isHovered ||
                isMobileOpen ? (
                  "Consultas"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>

              {renderMenuItems(
                itensConsulta,
                "main",
              )}
            </div>

            <div>
              <h2
                className={`mb-4 flex text-xs uppercase leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded ||
                isHovered ||
                isMobileOpen ? (
                  "Gestão"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>

              {renderMenuItems(
                itensGestao,
                "others",
              )}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
