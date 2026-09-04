# Pipeline SSO

Pipeline de dados desenvolvido para apoiar processos de Segurança e Saúde Ocupacional (SSO), estruturando a extração, validação, tratamento e disponibilização de dados para análise e construção de dashboards.

O primeiro caso de uso implementado é a gestão de AVCBs.

---

## Objetivo

O projeto tem como objetivo transformar fontes operacionais de dados de SSO em dados estruturados e confiáveis para consumo analítico.

A arquitetura segue o fluxo:

```text
Fonte
  ↓
Extração
  ↓
Bronze
  ↓
Gate de Qualidade
  ↓
Prata
  ↓
Regras de Negócio
  ↓
Ouro
  ↓
Banco / API
  ↓
Dashboard