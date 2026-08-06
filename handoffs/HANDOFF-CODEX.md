# HANDOFF — Codex como executor do SAGE

Para o Codex rodando no PC Windows, alcançado pelo console do Maestri.
Escrito pelo arquiteto. O Codex executa; não decide arquitetura.

---

## Ordem das missões

O Codex faz três coisas, **nesta ordem, sem sobrepor**:

| # | Missão | Entrega | Só começa depois de |
|---|---|---|---|
| M1 | Auditoria completa | `auditoria/INVENTARIO.md` + arquivos por fatia | — |
| M2 | Cadastro de issues | issues no GitHub, uma por achado aceito | arquiteto revisar M1 |
| M3 | Correções, uma por vez | um PR por issue | roadmap re-baselinado |

O roadmap completo é `_arquitetura/ROADMAP-RELEASES.md` — dez releases, da contenção à
inteligência, com critérios de aceite por pacote. **A auditoria (M1) é o portão dele:**
nenhuma release começa antes que o inventário exista e o arquiteto o tenha verificado.

**M1 não modifica nenhum arquivo de código.** Auditoria que corrige contamina o
levantamento: você perde a visão do todo e prioriza pelo que era fácil.

**M2 não começa antes da revisão humana.** Issue gerada a partir de achado não verificado
vira trabalho inventado.

---

## M1 — Auditoria

O prompt completo está em `_arquitetura/handoffs/HANDOFF-AUDITORIA.md`. Siga-o literalmente.

Antes dele, leia obrigatoriamente:

1. `_arquitetura/ESTADO-VERIFICADO.md` — **primeiro de tudo.** Corrige premissas falsas dos
   demais documentos
2. `_arquitetura/DOMINIO-E-LACUNAS.md` — o domínio escolar validado contra o código, o que
   existe, o que falta, e as decisões já tomadas. É a régua de "isto deveria estar aqui?"
2. `_arquitetura/repo/AGENTS.md` — as regras invioláveis. Violação é achado
3. `_arquitetura/repo/docs/adr/` — as 12 decisões. Código que contraria ADR é achado
4. `SAGE-API/docs/` — conhecimento de campo. **Precedência sobre a documentação de
   arquitetura** quando falar de comportamento observado do hardware

Branch a auditar nos dois repos: `wip/recuperacao-local-pre-auditoria`.

---

## M3 — Ordem de correção

Definida pelo arquiteto, não pelo Codex:

1. **V8 — cercar o `zerar-tudo`.** É o único achado que pode custar a escola inteira num
   clique, e a correção mínima não depende de nada: exigir confirmação explícita, transação,
   backup verificado antes, e registro de quem executou. **Não remova o endpoint** — ele
   provavelmente é usado em reinstalação. Cerque
2. **V1 + V2 juntos** — offset divergente e `CATRACA_MIN_LOG_ID` global. Dois defeitos com o
   mesmo sintoma; corrigir um só não destrava a ingestão. Commits separados, testes separados
3. **V10** — rotação de log com teto rígido. Barato, e evita o modo de morte mais provável
4. **V4, V5** — `catch` vazio e `console.log` em produção. Mecânicos
5. **V9 + V3 juntos** — criar a noção de usuário e a camada de autorização. São o mesmo
   pacote: não há autorização sem identidade. **É construção, não correção.** Exige
   especificação própria, escrita pelo arquiteto, antes de uma linha de código
6. **V6** — redação de PII. Pré-requisito técnico de qualquer telemetria (WP-05)
7. **V7** — modelo de presença auditável. Depende da decisão de slot (`DOMINIO-E-LACUNAS.md`
   §6.1). Não comece sem a especificação
8. O que a auditoria trouxer, na ordem que o arquiteto definir depois de revisar

**Restrição não negociável:** um pacote por vez até a Fase 2. Os pacotes iniciais mexem nas
mesmas fundações e paralelizar gera conflito garantido.

---

## Regras de execução

- Correção de bug **exige** teste que falha antes e passa depois. O harness já existe
  (`test/`, `test/fakes/controlid/`) — não há desculpa de "não dá para testar"
- Um PR por issue, `Closes #N`, diff mínimo
- Achou outro bug? **Issue separada.** Não corrija junto. Mencione: "encontrado durante #42"
- Dúvida de arquitetura? Abra issue de decisão e **pare**. Não decida sozinho
- Nunca invente dado. Lacuna vira pendência para humano
- Nunca dado pessoal em log, issue, PR ou commit

---

## Higiene de contexto — como manter o Codex limpo sem perder trabalho

O pedido original era um agente que limpasse o contexto do Codex periodicamente. **Não
recomendo, e o motivo importa mais que a recomendação.**

Limpar contexto é perigoso quando o estado do trabalho vive na conversa, e é gratuito
quando vive em arquivo. O problema real não é o contexto encher — é a continuidade estar no
lugar errado. Um agente que limpa contexto de fora não resolve isso; ele só escolhe o
momento de perder informação.

A solução é tornar a limpeza barata, e aí ela não precisa de agente nenhum:

**Ledger de progresso.** O Codex mantém `auditoria/PROGRESSO.md`, atualizado ao fim de cada
unidade de trabalho, com: o que foi concluído, o que está em andamento, qual o próximo
passo, e o que foi decidido e por quê. Uma sessão nova lê esse arquivo e o `git log` e
retoma sem perguntar nada.

**Ponto de corte natural.** Limpar entre missões e entre pacotes, nunca no meio de um.
Antes de limpar: commitar ou registrar no ledger. Depois de limpar: reler `AGENTS.md`,
`ESTADO-VERIFICADO.md`, `PROGRESSO.md` e a issue atual. Só isso.

**O teste que prova que está funcionando:** se limpar o contexto no meio de um pacote e o
Codex não conseguir retomar lendo os arquivos, o ledger está incompleto — e isso é um
defeito de processo a corrigir naquele momento, não uma fatalidade a contornar com mais
automação.

Se ainda assim você quiser um terceiro agente nesse papel, ele deve **auditar o ledger**
("isto permite retomar do zero?"), não gerenciar contexto. Esse é um trabalho útil e barato,
e o Gemini/OpenCode dá conta. Gerenciar contexto de fora não é.

---

## Divisão de modelos

O split que você descreveu — um modelo orquestrando e outro codificando — é o certo, e bate
com a alocação do seu `CLAUDE.md` global: julgamento no modelo capaz, execução especificável
no barato.

Mapeando para as missões:

| Trabalho | Perfil de modelo |
|---|---|
| Orquestrar a auditoria, verificar achado contra o código, consolidar, reclassificar severidade | Capaz. É julgamento, e julgamento errado aqui contamina tudo |
| Auditar uma fatia | Médio. Especificável, mas exige leitura cuidadosa |
| Aplicar correção já especificada, escrever teste de regressão | Barato/médio |
| Decidir arquitetura | **Nenhum.** Volta para o arquiteto |

Não vou fixar nomes de modelo aqui: quem sabe o que o Codex expõe hoje é você. A regra que
dura é a coluna da direita.

---

## O que o Codex NÃO faz

- Não altera nada em `docs/` nem em `SAGE-API/docs/`
- Não decide arquitetura
- Não aprova o próprio trabalho
- Não faz force-push, não reescreve histórico
- Não torna repositório público nem privado
- Não toca em `database/` enquanto o incidente de dado pessoal estiver aberto
