"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";

import {
  BoxCubeIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  PageIcon,
  PlugInIcon,
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
    icon: <UserCircleIcon />,
    name: "Usuários",
    path: "/gestao/usuarios",
  },
  {
    icon: <BoxCubeIcon />,
    name: "Permissões",
    path: "/gestao/permissoes",
  },
  {
    icon: <PlugInIcon />,
    name: "Configurações",
    path: "/gestao/configuracoes",
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

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);

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
    let submenuMatched = false;

    ["main", "others"].forEach((menuType) => {
      const items =
        menuType === "main"
          ? navItems
          : othersItems;

      items.forEach((nav, index) => {
        if (!nav.subItems) return;

        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path)) {
            setOpenSubmenu({
              type: menuType as "main" | "others",
              index,
            });

            submenuMatched = true;
          }
        });
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive]);

  useEffect(() => {
    if (openSubmenu === null) return;

    const key =
      `${openSubmenu.type}-${openSubmenu.index}`;

    if (subMenuRefs.current[key]) {
      setSubMenuHeight((prevHeights) => ({
        ...prevHeights,
        [key]:
          subMenuRefs.current[key]?.scrollHeight || 0,
      }));
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (
    index: number,
    menuType: "main" | "others",
  ) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }

      return {
        type: menuType,
        index,
      };
    });
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
      {/* BRANDING */}
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
                navItems,
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
                othersItems,
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