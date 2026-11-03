import { redirect } from 'next/navigation';
import { carregarAbas } from '@/lib/auth/abasServidor';
import type { AbasPermitidas } from '@/lib/auth/acessoAbas';
import type { ModuloPortal } from '@/lib/auth/politicaAcesso';
export default async function ProtecaoAbas({modulos,children}:{modulos:readonly ModuloPortal[];children:(abas:AbasPermitidas)=>React.ReactNode}) {
 const r=await carregarAbas();
 if(!r.ok && r.status===401)redirect('/signin');
 if(!r.ok || !modulos.some(m=>r.abas[m]))return <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900"><h1 className="text-xl font-semibold">{!r.ok && r.status===503?'Permissões indisponíveis':'Acesso não permitido'}</h1><p className="mt-2">{!r.ok && r.status===503?'Tente novamente mais tarde.':'Solicite ao administrador um perfil com acesso a esta área.'}</p></section>;
 return <>{children(r.abas)}</>;
}
