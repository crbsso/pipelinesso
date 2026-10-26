export type EventoHistoricoCondutor = {
  driver_id_cobli: string | null;
  situacao_motorista: string | null;
  secao_rm: string | null;
  nome_exibicao: string | null;
};

export function classificarCondutorHistorico(
  evento: EventoHistoricoCondutor,
): string {
  const driver = (
    evento.driver_id_cobli ?? ""
  ).trim();

  const situacao = (
    evento.situacao_motorista ?? ""
  ).trim();

  const setor = (
    evento.secao_rm ?? ""
  ).trim();

  if (!driver) {
    return "SEM_MOTORISTA_IDENTIFICADO";
  }

  if (!situacao) {
    return "MOTORISTA_FORA_CADASTRO_ATUAL";
  }

  if (situacao === "SEM_IDENTIDADE_RM") {
    return "MOTORISTA_SEM_IDENTIDADE_RM";
  }

  if (situacao === "PENDENTE_DESATIVACAO_COBLI") {
    return "MOTORISTA_DESLIGADO_IDENTIFICADO";
  }

  if (situacao === "REVISAR_SITUACAO_RM") {
    return "MOTORISTA_REVISAR_RM";
  }

  if (!setor) {
    return "MOTORISTA_RM_SEM_SETOR";
  }

  return "IDENTIFICADO_COM_SETOR";
}

export function nomeCondutorHistorico(
  evento: EventoHistoricoCondutor,
): string {
  const status = classificarCondutorHistorico(evento);

  const semIdentificacao = [
    "SEM_MOTORISTA_IDENTIFICADO",
    "MOTORISTA_SEM_IDENTIDADE_RM",
    "MOTORISTA_FORA_CADASTRO_ATUAL",
  ];

  if (semIdentificacao.includes(status)) {
    return "N\u00e3o identificado";
  }

  return (
    evento.nome_exibicao?.trim() ||
    "N\u00e3o identificado"
  );
}
