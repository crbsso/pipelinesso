import type { ReactNode } from "react";
import "./preview.css";
export const metadata = { title: "Prévia · Inspeções da Manutenção | Portal SSO" };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
