import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal SSO | CELEO",
  description:
    "Acesso ao Portal de Segurança e Saúde Ocupacional da CELEO.",
};

export default function SignIn() {
  return <SignInForm />;
}