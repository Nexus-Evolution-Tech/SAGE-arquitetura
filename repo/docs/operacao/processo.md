# Processo

Ferramenta sem processo vira ferramenta abandonada. Este documento descreve o que sustenta a
manutenção do SAGE ao longo do tempo — não só as ferramentas de um incidente isolado.

---

## Versionamento e canais

**SemVer**: `MAIOR.MENOR.CORREÇÃO`. Correção não muda schema. Menor adiciona coisas
compatíveis. Maior quebra compatibilidade e exige atenção.

**Dois canais**, mesmo com uma instalação só:

- `beta` — aponta para a máquina de teste do mantenedor
- `estavel` — aponta para a escola

Toda versão passa pelo beta por alguns dias antes de chegar ao estável. É o que impede
descobrir um bug na secretaria. Com um arquivo JSON por canal, o custo é zero.

---

## Build reproduzível

**Nunca compilar na própria máquina para mandar para a escola.** O artefato sai do CI, sempre.
Motivo: daqui a meses pode ser preciso reconstruir a 1.4.2 exatamente igual para investigar um
bug, e "estava na minha máquina" não é reconstruível.

Cada release: tag no git, artefato imutável, hash publicado, notas de versão escritas.

---

## Triagem por severidade

Sem isso, tudo vira urgente e nada é resolvido.

| Nível | Significado | Resposta |
|---|---|---|
| **SEV1** | Catraca parada, ninguém entra | Largar tudo |
| **SEV2** | Funciona, mas perde dado (sync falhando) | Mesmo dia |
| **SEV3** | Incômodo com contorno | Próxima versão |
| **SEV4** | Cosmético | Quando der |

> **O SEV2 é o traiçoeiro.** Ninguém reclama, porque a catraca continua girando. Só aparece
> quando alguém pede um relatório e faltam semanas de registros. É exatamente o que o check
> `sage-sync-catraca` do heartbeat existe para pegar — ver
> [manutenção remota](manutencao-remota.md).

---

## Catálogo de erros

Um arquivo com todo código, o que significa, o que causa e como resolver. Cresce a cada
incidente. É o que permite responder em dois minutos daqui a um ano, quando os detalhes já
foram esquecidos.

Mantido em [erros.md](erros.md). O campo "Histórico" de cada entrada é o mais valioso do
documento — é ele que acumula experiência real de campo.

---

## Postmortem sem culpado

Toda vez que o sistema cair: uma página. O que aconteceu, linha do tempo, causa raiz, **como
impedir que a classe inteira de problema volte**. Sem procurar culpado — o objetivo é o
sistema, não a pessoa.

Cinco postmortems bem feitos deixam qualquer software substancialmente mais robusto.

---

## Ciclo de trabalho

Fluxo para um mantenedor solo trabalhando com agentes de código.

1. **Pegar a próxima issue da fila.**
2. **Branch** `wp/NN-nome` (pacote de trabalho) ou `fix/NN-nome` (correção de bug).
3. **Instruir o agente:** "implemente a issue #N, leia `AGENTS.md`, não exceda o escopo."
4. **PR pequeno.** Se o diff passar de ~400 linhas, quebrar em dois PRs.
5. **Revisão** com o prompt do revisor, contra os critérios de aceite da issue.
6. **Merge.**
7. **Se algo aprendido durar,** atualizar o documento correspondente (`erros.md`, um ADR, este
   processo). **Se não durar, não atualizar nada** — documentação que registra detalhe efêmero
   vira ruído que ninguém confia depois.

### Princípios

- **Automação no lugar de disciplina.** Não confiar em "lembrar de fazer X" — transformar X em
  teste, CI, hook ou verificação automática sempre que possível.
- **Revisar no mesmo dia.** PR que envelhece sem revisão diverge do restante do código e fica
  mais caro de revisar amanhã.
- **Não deixar o agente explorar.** Nomear os arquivos que ele deve tocar. Escopo aberto ("dê
  uma olhada por aí") produz diffs grandes e difíceis de revisar.
- **Agrupar trabalho parecido na mesma sessão.** Trocar de contexto entre tarefas não
  relacionadas custa mais do que parece — tanto para quem revisa quanto para o agente.
