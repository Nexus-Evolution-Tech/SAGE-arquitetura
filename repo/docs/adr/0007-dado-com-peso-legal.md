# ADR-0007 — Dado com peso legal exige auditoria

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto

## Contexto

O registro de presença do SAGE não é um dado informativo qualquer: a folha de
ponto de um funcionário afeta o salário dele, e a folha de presença de um
aluno afeta o registro escolar dele. Um sistema que permite sobrescrever ou
apagar um registro de presença sem deixar rastro cria a possibilidade de uma
correção mal-intencionada (ou só descuidada) alterar um fato que tem
consequência financeira ou disciplinar para uma pessoa real, sem que ninguém
consiga provar depois o que era o dado original.

## Decisão

Todo registro de presença guarda sua origem (giro da catraca, lançamento
manual, correção). Toda correção manual registra quem fez, quando, e por quê.
O registro original nunca é sobrescrito — a correção é um novo fato que aponta
para o registro anterior. Todo relatório mostra se houve correção no período a
que se refere.

## Consequências

**Positivas**
- Qualquer disputa sobre um horário registrado pode ser resolvida olhando o
  histórico completo da cadeia, não só o valor atual
- Protege a secretaria e a escola: existe prova de quem alterou o quê e por
  quê, em caso de questionamento trabalhista ou disciplinar
- Compatível com o modelo de atestação com humano no circuito da folha de
  ponto e da folha de presença (WP-08, WP-07): o sistema propõe, a secretaria
  confirma e assume a responsabilidade pela correção

**Negativas / custo aceito**
- Consultas de relatório não podem ler a tabela bruta — precisam de uma view
  que resolve, para cada registro, qual é a versão vigente da cadeia de
  correções
- O volume de linhas cresce com cada correção (nunca decresce), o que exige
  índice pensado para consulta de período em vez de ponto único

**O que o código precisa respeitar**
- `UPDATE` e `DELETE` em `RegistroPresenca` são rejeitados — correção é
  sempre `INSERT` novo apontando para o registro anterior via
  `registro_corrigido_id`
- Toda correção exige `criado_por` e `justificativa` preenchidos; ausência de
  qualquer um dos dois rejeita a correção
- Toda leitura de relatório passa pela view que resolve a versão vigente da
  cadeia, nunca lê `RegistroPresenca` diretamente
- Consulta de 12 meses de uma pessoa responde em menos de 500 ms com 500 mil
  registros na tabela
- Relatório de qualquer período indica visualmente se houve correção manual
  naquele período

## Alternativas consideradas

### Permitir `UPDATE` direto no registro, com log de auditoria separado — recusada
Um log de auditoria separado pode divergir do dado real ou ser perdido; manter
o próprio registro imutável e a correção como novo fato elimina essa classe de
inconsistência por construção.

## Referências

- `docs/arquitetura/SAGE-ROADMAP.md`
