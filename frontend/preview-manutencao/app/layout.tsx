import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import "./preview.css";
const outfit = Outfit({ subsets: ["latin"] });
export const metadata = { title: "Prévia · Inspeções da Manutenção | Portal SSO" };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><body className={outfit.className}>{children}</body></html>;
}
