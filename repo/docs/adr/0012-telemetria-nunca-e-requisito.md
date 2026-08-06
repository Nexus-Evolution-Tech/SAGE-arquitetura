# ADR-0012 — Telemetria nunca é requisito de funcionamento

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto

## Contexto

O SAGE roda on-premise numa escola sem garantia de internet estável. Telemetria
(logs para Grafana, erros para Sentry, heartbeat, acesso a GitHub) é o que dá
ao mantenedor remoto visibilidade sobre o sistema — mas é conveniência de
quem mantém, não uma necessidade de quem usa. Se o funcionamento básico da
catraca e do registro de presença passar a depender de qualquer serviço
externo estar acessível, uma queda de internet na escola vira uma queda do
sistema de presença, o que é desproporcional: a escola não deveria deixar de
registrar entrada e saída porque o Grafana está fora do ar.

## Decisão

Nenhum componente de telemetria é requisito de funcionamento. Sem internet,
sem Grafana, sem Sentry, sem GitHub, a catraca ainda tem que girar e o SAGE
ainda tem que registrar presença. Telemetria é sempre aditiva: quando
disponível, informa o mantenedor remoto; quando ausente, o sistema segue
funcionando normalmente e localmente.

## Consequências

**Positivas**
- Internet instável ou ausente na escola nunca é causa de indisponibilidade do
  sistema de presença
- O mantenedor remoto ainda tem visibilidade quando a rede está de pé, sem
  criar acoplamento na direção oposta
- Simplifica a operação: nenhuma variável de telemetria configurada é um
  estado válido e testado, não uma configuração incompleta

**Negativas / custo aceito**
- Durante quedas de internet, o mantenedor remoto perde visibilidade em tempo
  real e precisa confiar no buffer local até a conexão voltar
- Buffer de log em disco tem teto (50 MB) — uma queda de internet muito longa
  perde os logs mais antigos do período

**O que o código precisa respeitar**
- Nenhuma variável de telemetria configurada → o app sobe e funciona
  normalmente, sem erro nem degradação
- Internet cortada por 24 h → app funciona normal; logs vão para buffer local
  em disco, respeitando o teto de 50 MB
- Nenhuma chamada de inicialização (boot) bloqueia ou falha por causa de
  Sentry, Grafana ou heartbeat indisponíveis
- Redação de PII nos logs é testada e reprova o build se um dado sensível
  (CPF, RG, e-mail, telefone, JWT) atravessar para a saída, independente de a
  telemetria estar ligada
- Sentry configurado com `beforeSend` e `sendDefaultPii: false` quando
  presente, nunca como pré-requisito de boot

## Alternativas consideradas

### Heartbeat ou telemetria como verificação de saúde obrigatória no boot — recusada
Tornaria a disponibilidade de um serviço de terceiro (Grafana, Sentry) um
pré-requisito para a catraca girar, o que inverte a prioridade: a função
essencial do sistema não pode depender de uma conveniência de operação remota.

## Referências

- `docs/arquitetura/SAGE-plano-mestre.md`
