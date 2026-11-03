import assert from "node:assert/strict";
import test from "node:test";
import { extrairTokenRecuperacao } from "../../tools/permissionamento-hml/public/recuperacao.js";
const origem = "https://ckfsarzmudwdehiiltwi.supabase.co";
const token = "token_ficticio_para_teste_123456";
test("recuperacao aceita link padrao da HML e callback com token hash", () => {
  assert.equal(extrairTokenRecuperacao(`${origem}/auth/v1/verify?type=recovery&token=${token}`,origem),token);
  assert.equal(extrairTokenRecuperacao(`http://localhost:3000/auth/confirm?type=recovery&token_hash=${token}`,origem),token);
});
test("recuperacao extrai o endereco original de um Safe Link sem navegar", () => {
  const original = `${origem}/auth/v1/verify?type=recovery&token=${token}`;
  assert.equal(extrairTokenRecuperacao(`https://nam.safelinks.protection.outlook.com/?url=${encodeURIComponent(original)}`,origem),token);
});
test("recuperacao rejeita outro projeto, outros tipos e formatos sem prova valida", () => {
  for (const link of [
    `https://outro.supabase.co/auth/v1/verify?type=recovery&token=${token}`,
    `${origem}/auth/v1/verify?type=signup&token=${token}`,
    `${origem}/auth/v1/verify?type=recovery`,
    `${origem}/auth/v1/verify?type=recovery&token=curto`,
    `javascript:alert(1)`,
    `https://exemplo.com/login?type=recovery&token=${token}`,
  ]) assert.throws(()=>extrairTokenRecuperacao(link,origem));
});

test("recuperacao identifica link de entrada protegido pelo Outlook sem aceita-lo", () => {
  const original = origem + "/auth/v1/verify?type=magiclink&token=" + token;
  const protegido = "https://eur05.safelinks.protection.outlook.com/?url=" + encodeURIComponent(original);
  assert.throws(() => extrairTokenRecuperacao(protegido, origem), { code: "LINK_DE_ENTRADA" });
});
