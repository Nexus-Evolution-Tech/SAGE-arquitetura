# ADR-0010 — Voltar para o Knex, abandonar o query builder caseiro

- **Status:** Aceito
- **Data:** 2026-08-05
- **Decide:** arquiteto

## Contexto

O SAGE trata dado de menores de idade e dado com peso legal (folha de ponto,
folha de presença — ver ADR-0007). O `queryBuilder.js` caseiro atualmente em
uso interpola nome de tabela, nome de coluna, `ORDER BY`, `LIMIT` e `OFFSET`
diretamente na string SQL, sem escape, e não abre transação nenhuma. Isso é
injeção de SQL disponível em qualquer endpoint que aceite ordenação ou
paginação vinda do cliente, e significa que uma importação de Excel em massa
que falhar no meio deixa linhas gravadas e linhas não gravadas, sem forma de
desfazer atomicamente.

Este é um dos itens do WP-0, classificado como bloqueante: empacotar o sistema
num instalador antes de fechar isso distribui a vulnerabilidade em vez de
corrigi-la.

## Decisão

Restaurar o Knex como camada de acesso a banco, recuperando transações e
escaping de identificadores. A superfície de API do `globalDB` é mantida igual
para não quebrar os call sites existentes — troca-se apenas a implementação
por baixo.

## Consequências

**Positivas**
- Elimina a classe de vulnerabilidade de injeção via identificador
  (tabela/coluna/`ORDER BY`/`LIMIT`/`OFFSET`) por construção, porque o Knex
  escapa identificadores corretamente
- Ganha transação real: uma importação de Excel que falha na linha N não deixa
  gravado nada anterior a N
- Não exige reescrever os call sites, porque a superfície de API é preservada

**Negativas / custo aceito**
- Reintroduz uma dependência externa que havia sido removida em favor do
  código caseiro — decisão anterior é revertida
- Exige reteste de todos os call sites que dependiam do comportamento
  específico do query builder caseiro

**O que o código precisa respeitar**
- Nenhum identificador (tabela, coluna, `ORDER BY`, `LIMIT`, `OFFSET`) vindo
  de entrada do cliente é interpolado direto em string SQL — sempre via API
  do Knex que escapa
- Importação de Excel em massa roda dentro de transação: falha na linha N não
  deixa nenhuma linha anterior gravada
- `?sort=nome;DROP TABLE Pessoa--` (ou payload equivalente) não executa SQL
  arbitrário — testado explicitamente
- A superfície pública do `globalDB` permanece a mesma para os call sites
  existentes

## Alternativas consideradas

### Corrigir o `queryBuilder.js` caseiro adicionando escaping manual — recusada
Escaping manual de identificador é uma superfície de erro recorrente e já
provou falhar uma vez; o Knex já resolve isso e transação junto, sem reinventar
a roda dentro de um sistema que trata dado de menor.

## Referências

- `docs/arquitetura/SAGE-plano-mestre.md`
