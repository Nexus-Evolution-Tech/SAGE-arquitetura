# ADR-0005 — Postura de falha por fluxo, não postura única

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto / escola

## Contexto

O SAGE não é sempre o sistema que está fora do ar por acaso — a máquina onde
ele roda é desligada todo santo dia à noite, por decisão operacional da
escola. Isso significa que "SAGE fora do ar" não é um cenário raro de
disaster recovery: é o estado normal por várias horas diárias, e a catraca
Control iD, em modo standalone, continua decidindo sozinha nesse período.

Definir uma única postura de "falha aberta" ou "falha fechada" para todo o
sistema erra pela metade dos casos: liberar geral é seguro para entrada de
aluno, mas é o pior cenário possível para a saída de um menor de idade em
horário de aula sem o SAGE para aprovar a exceção. Bloquear geral é seguro
para a saída de menor, mas tranca um visitante ou um funcionário do lado
errado da porta sem necessidade.

## Decisão

Cada fluxo tem sua própria postura de falha, definida pelo dano que cada lado
do erro causa:

| Fluxo | Sistema fora do ar | Onde a regra vive |
|---|---|---|
| Entrada de aluno/funcionário | Libera e registra | Catraca (standalone) |
| Saída de funcionário | Libera e registra | Catraca (standalone) |
| Saída de menor em horário de aula | Bloqueia | Catraca (standalone), SAGE libera exceção |
| Entrada de visitante | Bloqueia | Catraca, SAGE cria autorização temporária |
| Evento aberto | Conforme programado | SAGE grava regra temporária antes do evento |

A regra de ouro: o SAGE é sempre quem libera, nunca quem bloqueia. Se o SAGE
cair, o mundo fica no estado seguro por padrão — criança permanece dentro da
escola, visitante permanece do lado de fora.

## Consequências

**Positivas**
- A postura de cada fluxo reduz o dano específico daquele fluxo, em vez de
  otimizar uma métrica genérica de "segurança"
- A catraca, em standalone, aplica a postura correta mesmo com o SAGE
  desligado todas as noites — que é a maior parte do tempo em que a decisão
  precisa estar certa sem supervisão
- O SAGE nunca é o componente que impede alguém de sair em emergência

**Negativas / custo aceito**
- Não existe uma resposta simples para "o que acontece se o sistema cair" —
  cada fluxo exige a pergunta feita e respondida separadamente
- A regra para saída de menor depende da catraca ter a política certa
  pré-carregada (ver ADR-0008); se a política não subiu, a postura de falha
  não se sustenta

**O que o código precisa respeitar**
- O SAGE nunca é implementado como o componente que bloqueia uma catraca —
  ele só libera exceções
- A política de bloqueio para saída de menor em horário de aula vive na
  catraca (standalone), não depende do SAGE estar no ar para valer
- Entrada de aluno/funcionário e saída de funcionário: catraca configurada
  para liberar e registrar mesmo sem conexão com o SAGE
- Entrada de visitante: catraca configurada para bloquear por padrão; SAGE
  cria autorização temporária quando necessário
- Testes de aceite simulam SAGE fora do ar para cada fluxo e verificam que a
  postura da tabela acima se mantém

## Alternativas consideradas

### Postura única de "sempre libera" (fail-open) — recusada
Segura para entrada, mas inaceitável para saída de menor: um sistema fora do
ar não pode ser a condição que permite a saída não supervisionada de uma
criança.

### Postura única de "sempre bloqueia" (fail-closed) — recusada
Segura para saída de menor, mas transforma toda queda do SAGE (que acontece
todas as noites, por desligamento programado) num incidente que tranca
pessoas do lado errado da porta sem necessidade.

## Referências

- `docs/arquitetura/SAGE-ROADMAP.md`
