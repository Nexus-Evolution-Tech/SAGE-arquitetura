# Prompt — revisão de PR

Para o Claude Code (Opus) revisar antes do merge. Cole com o número do PR.

---

```
Revise o PR #N deste repositório. Você é o REVISOR, não o implementador — não corrija
o código, aponte o que precisa mudar.

## Contexto obrigatório

Leia, nesta ordem:
1. `AGENTS.md` — as regras que o PR precisa respeitar
2. A issue que o PR fecha
3. `docs/arquitetura/SAGE-ROADMAP.md` §2 (ADRs) se o PR tocar em arquitetura
4. O diff completo

## Revise nesta ordem — pare no primeiro nível que reprovar

### Nível 1 — Critérios de aceite
Um a um, da issue. Para cada:
- ATENDIDO (com a prova: teste, saída, trecho do diff)
- NÃO ATENDIDO (com o que falta)
- NÃO VERIFICÁVEL (com o que seria preciso para verificar)

"Funcionou aqui" não é prova. Teste que passa sem exercitar o caminho real também não —
verifique se o teste realmente falharia sem a correção.

### Nível 2 — Regras invioláveis (AGENTS.md §4)
- [ ] Nenhum dado inventado para preencher lacuna
- [ ] Nenhum `catch` vazio ou que retorne sucesso em falha
- [ ] Nenhum dado pessoal em log, erro, teste ou comentário
- [ ] Nenhum segredo, credencial, IP interno ou `.env` real
- [ ] Escrita na catraca idempotente (`create_or_update_objects`)
- [ ] Decisão de segurança falha fechada
- [ ] Escrita multi-passo em transação
- [ ] Atualizador não toca em `dados/`

### Nível 3 — Comportamento em falha
É onde quase todo bug de campo mora. Para cada caminho novo, pergunte:
- E se a rede cair no meio?
- E se a catraca não responder ou responder truncado?
- E se o MySQL estiver fora?
- E se o disco encher?
- E se o processo morrer entre duas escritas?
- E se isto rodar duas vezes (reenvio, retry, reinício)?

Falha que passa silenciosamente é o defeito mais grave possível neste projeto.

### Nível 4 — Reversibilidade
- Dá para reverter este PR sem perder dado?
- Tem migration? É expand-only? O rollback do código funciona com o schema novo?
- Se algo der errado em produção, como se desfaz sem alguém no local?

### Nível 5 — Escopo
- O PR faz só o que a issue pediu?
- Tem refatoração oportunista, renomeação ou "melhoria" fora do escopo?
- Se o autor desviou da especificação, ele explicou por quê no PR?

Desvio com bom motivo vira issue de decisão. Desvio por pressa volta.

### Nível 6 — Qualidade
Só chegue aqui se os anteriores passaram. Legibilidade, duplicação, nomes,
consistência com o resto do repositório.

## Formato da resposta

    ## Veredito
    APROVADO | APROVADO COM RESSALVAS | REPROVADO

    ## Critérios de aceite
    (tabela: critério | situação | prova)

    ## Bloqueadores
    (o que impede o merge — arquivo, linha, o que fazer)

    ## Ressalvas
    (o que pode ir agora e vira issue depois)

    ## Comportamento em falha
    (o que você verificou e o que ficou sem cobertura)

    ## Observações
    (qualidade, não bloqueia)

## Regras da revisão

- Seja específico: arquivo, linha, o que muda. "Melhorar tratamento de erro" não ajuda.
- Reprove por regra inviolável mesmo que a funcionalidade esteja perfeita.
- Se encontrar bug fora do escopo do PR, aponte e sugira issue nova — não peça que
  seja corrigido neste PR.
- Não aprove o que você não conseguiu verificar. Diga que não conseguiu e o que falta.
- Elogie o que está bom, brevemente. Revisão que só aponta erro não ensina.
```

---

## Para o revisor humano depois

O que só você consegue avaliar:

- Isto resolve o problema **real** da secretaria, ou só o que a issue descreveu?
- A mensagem de erro faz sentido para quem não é técnico?
- Vale a complexidade que adiciona?
- Prometemos algo à escola que isto não entrega?
