# ADR-0008 — Política mora no SAGE, identidade mora na catraca

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto

## Contexto

A Control iD organiza suas regras de acesso num grafo de sete tipos de objeto
e quatro tabelas de ligação: `users` → `user_groups` → `groups` →
`group_access_rules` → `access_rules` → `access_rule_time_zones` →
`time_zones` → `time_spans`, mais `portals` e `portal_access_rules`. Expressar
algo simples como "a turma 1B entra das 7h às 12h30 pela catraca principal"
exige popular e manter esse grafo inteiro em sincronia.

Uma escola tem uma quantidade de exceções de horário muito maior do que esse
modelo foi pensado para expressar com conforto: atestado, prova de
recuperação, aula remarcada, evento, aluno em dois períodos. Subir toda essa
granularidade de exceção para dentro do grafo `time_zones`/`access_rules` da
catraca tornaria a sincronização cara de manter e frágil a cada mudança de
grade.

## Decisão

A catraca guarda usuários, cartões, QR, e o mínimo de regra necessária para
sustentar as posturas de falha do ADR-0005. O SAGE guarda a grade horária, as
turmas, as exceções, as aprovações, e toda a interpretação de presença. Só
sobe para a catraca o que precisa funcionar de forma autônoma, offline, sem o
SAGE por perto.

## Consequências

**Positivas**
- A catraca fica simples de manter em sincronia: menos tipos de objeto, menos
  dependência entre eles, menos chance de divergência
- Toda a granularidade de exceção (atestado, prova, evento) vive só no SAGE,
  onde pode mudar sem tocar no grafo da catraca
- Separa claramente responsabilidade: "quem pode entrar/sair fisicamente
  agora" é da catraca; "por que essa pessoa está autorizada e o que isso
  significa" é do SAGE

**Negativas / custo aceito**
- A catraca não sabe o motivo por trás de uma liberação — ela só executa a
  política mínima que foi carregada nela
- Qualquer decisão que dependa de contexto que só o SAGE tem (turma, grade,
  aprovação específica) não pode ser resolvida pela catraca sozinha quando o
  SAGE está fora do ar — por isso a postura de falha por fluxo (ADR-0005)
  existe

**O que o código precisa respeitar**
- O grafo `time_zones` → `time_spans` → `access_rules` →
  `group_access_rules` não recebe a granularidade de exceção da escola — só
  a política mínima necessária para a tabela de postura do ADR-0005
- Grade horária, turmas, exceções e aprovações são modeladas e mantidas
  inteiramente no banco do SAGE, nunca replicadas como estrutura fina na
  catraca
- Toda mudança que só precisa valer para interpretação (pilares 3 e 4 do
  produto) não gera escrita na catraca
- `portals` são sempre lidos do equipamento, nunca criados pelo SAGE — eles
  representam o hardware físico

## Alternativas consideradas

### Espelhar toda a granularidade de exceções no grafo da catraca — recusada
Caro de manter em sincronia e rígido demais para o volume de exceções
legítimas que uma escola real produz; qualquer mudança de grade viraria uma
cascata de escritas em `time_zones`/`access_rules`.

## Referências

- `docs/arquitetura/SAGE-ROADMAP.md`
- `docs/arquitetura/SAGE-design-sincronizacao.md`
