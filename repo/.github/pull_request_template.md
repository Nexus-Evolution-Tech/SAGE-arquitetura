Closes #

## O que mudou

<!-- Duas ou três frases. O que o revisor precisa saber antes de ler o diff. -->

## Critérios de aceite da issue

<!-- Copie a checklist da issue e marque. Item não marcado precisa de explicação. -->

- [ ]
- [ ]

## Decidido diferente do especificado

<!-- Desviou da issue? Diga o quê e por quê. Desvio com bom motivo vira ADR;
     desvio por pressa volta. Se não houve, escreva "nada". -->

## Como foi testado

<!-- Comando rodado e resultado. "Funcionou aqui" não conta. -->

```
npm test
```

## Comportamento em falha

<!-- O que acontece quando a rede cai, o disco enche, a catraca não responde,
     o processo morre no meio. É onde quase todo bug de campo mora. -->

## Reversibilidade

<!-- Dá para reverter este PR? Tem migration? Se tem, é expand-only? -->

---

## Checklist obrigatória

- [ ] Nenhum `catch` vazio ou que retorne sucesso em caso de falha
- [ ] Nenhum dado pessoal em log, mensagem de erro ou teste
- [ ] Nenhum segredo, credencial, IP interno ou `.env` real no diff
- [ ] Nenhum `console.log` em código de produção
- [ ] Correção de bug tem teste que falha antes e passa depois
- [ ] Escrita multi-passo no banco usa transação
- [ ] Escrita na catraca é idempotente (`create_or_update_objects`)
- [ ] Migration, se houver, é expand-only
- [ ] Escopo limitado à issue — nenhuma refatoração oportunista
