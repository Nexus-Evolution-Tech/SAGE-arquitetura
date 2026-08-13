# Bastão do arquiteto — SAGE

> Escrito em 2026-08-13 pelo arquiteto que sai, para o que entra.
> **Leia inteiro antes de responder qualquer coisa ao Caio.** Depois `git pull` neste repo
> sempre que voltar — este arquivo é o único que você pode assumir como atual.

---

## 1. Seu papel, e o contrato de trabalho

Você é **arquiteto e tech lead** do SAGE. Não escreve código de produção. O Codex escreve.

**A regra que o Caio repetiu duas vezes, e que vale acima de qualquer impulso de ajudar:**

> "você só entra com o planejamento e sai com a revisão no fim"

Não fique acompanhando o Codex trabalhar. Não comente progresso. Entra para planejar, some,
volta para revisar. Ele te chama.

**Contrato de comportamento** (está no `~/.claude/CLAUDE.md` dele, e ele cobra):

- Par técnico, não torcida. Se há abordagem melhor que a pedida, diga primeiro, com o porquê.
- **Toda proposta de plano ou decisão termina com `### Onde isto pode dar errado`.** Sem isso a
  resposta está incompleta. Ele nota a ausência.
- Conversa longa não é acordo. Não convirja por insistência; reancore no fato.
- Ele decidiu contra você? É decisão dele. Registre a discordância uma vez e execute.

**Ele fala português.** Responda em português.

---

## 2. A topologia — e o erro que ela causa

| Quem | Onde | Faz |
|---|---|---|
| **Você** | macOS, `/Users/caioamaraldepieri/Projetos/SAGE-WS` | Plano, spec, ADR, revisão |
| **Codex** | Windows `DESKTOP-G2QN9AT`, `C:\SAGE-WS` | Código, teste, PR |

**GitHub é o único canal.** O Caio foi explícito:

> "se voce mexe aqui tem que subir no github e descer la, se nao fica cada um fazendo
> individual e ninguem faz nada direito"

Editou documento? `commit` + `push` + fazer o Codex dar `pull`. Documento que só existe no seu
disco **não existe** para ele.

**Acesso ao Windows:** `ssh meu-windows` funciona sem senha (chave `id_sage_windows`, sem
passphrase). Você fala com o Codex pelo Maestri: `maestri check "Shell"` para ler,
`maestri ask "Shell" --raw "texto"` para escrever.

⚠️ **Armadilha do Maestri:** `--raw` cola o texto **sem enviar**. Você precisa mandar `"\n"`
depois, num comando separado. **Sempre confirme que apareceu `[Pasted Content N chars]` antes
de mandar o Enter** — e confirme que o terminal está no Codex e não num shell do Mac. Eu já
mandei 2.300 caracteres de instrução para um prompt de zsh por não checar.

---

## 3. Onde está cada coisa

| O quê | Onde |
|---|---|
| **O plano que manda** | `_arquitetura/PLANO-POS-AUDITORIA.md` |
| Estado verificado do código | `_arquitetura/ESTADO-VERIFICADO.md` |
| Modelo de domínio | `_arquitetura/DOMINIO-E-LACUNAS.md` |
| Releases R0–R9 | `_arquitetura/ROADMAP-RELEASES.md` |
| Auditoria 1 (99 achados, 8 fatias) | `_arquitetura/auditoria/` |
| Auditoria 2 (92 achados, 6 fatias) | `_arquitetura/auditoria/segunda-auditoria/` |
| ADRs, inclusive 0013 e 0014 | `_arquitetura/repo/docs/adr/` |
| Regras para agentes | `_arquitetura/repo/AGENTS.md` — **espelhado no SAGE-API** |

Repos: `Nexus-Evolution-Tech/SAGE-API` (backend, **público**), `SAGE` (frontend, **público**),
`SAGE-arquitetura` (privado, este).

---

## 4. O que é o SAGE, em cinco linhas

Presença e controle de acesso para a ETEC de Taboão da Serra. Catraca Control iD, PC Windows
on-premise, rede da escola, desligado toda noite. **Uma visita presencial só** — o que quebrar
depois quebra remotamente, sem ninguém técnico no local.

**O achado que define o produto:** o SAGE hoje é um *observador*, não um *controlador*. O
"Liberar acesso" só muda a tela — não fala com a catraca. Metade do que a escola pediu não
existe. Isso é a R8.

---

## 5. Estado em 2026-08-13

**Auditoria:** duas, independentes, mesmo snapshot. Concordam no diagnóstico — "não instalar
hoje". A segunda achou 12 coisas que a primeira não; já enxertadas no plano com marca `[+2A-*]`.

**Implementação:** R-LAB e R0-01 a R0-07 escritos, com CI verde individual. Nove PRs criados
e todos fechados; as 8 issues de pacote fechadas.

**⚠️ PENDÊNCIA ABERTA NO MOMENTO DESTA ENTREGA:** o colapso da pilha ficou pela metade. O Codex
mergeou cada PR no seu pai, mas subiu o `#34` para a `wip` antes de o pai receber os filhos.
Resultado: `wip/recuperacao-local-pre-auditoria` (`f46ae28`) tem **só a R-LAB**;
`fix/32-rotacao-logs` (`96a3434`) tem **tudo** — 59 arquivos a mais. Mandei ele fazer um merge
de `fix/32` na `wip` e **provar pelo conteúdo**. Confira se foi feito:

```bash
git diff --stat origin/wip/recuperacao-local-pre-auditoria origin/fix/32-rotacao-logs
# tem que sair VAZIO
```

**Próximo pacote:** R1 — identidade e autorização. Spec pronta em
`_arquitetura/specs/R1-usuarios-e-autorizacao.md`. **Não deixe começar antes de a R0 estar
provada integrada.**

---

## 6. Bloqueios que não são técnicos, e são do Caio

1. **Os dois repos de código estão PÚBLICOS**, com `pessoas_etec.sql`,
   `dados_etec_taboao.sql` e `PlanilhaPessoas.xlsx` no histórico. Incidente em curso.
   Ele é `member` da org; só `igorfcfs` (único owner) pode tornar privado.
2. **A limpeza de histórico reescreve commits** e vai orfanizar tudo que estiver aberto na
   hora. Por isso a pilha foi colapsada. Confira as cópias locais antes de qualquer reescrita.
3. **Node no PC do Codex é 18.16.1**; o R-LAB e o CI pedem 24. Ambiente de dev mais permissivo
   que o de verificação — inversão perigosa.
4. **A visita não foi agendada, e não deve ser** até a R0/R1 fecharem.
   `auditoria/INVENTARIO.md` §4 tem as 14 perguntas exatas de campo.

---

## 7. O que aprendi apanhando — não repita

- **Nunca aceite relato de agente sem verificar.** Ele já disse "PR isolado" para 50 arquivos,
  "os jobs estão executando" para dois jobs vermelhos, e "estado final real" para uma
  integração que não integrou. **Todas as três eram checáveis em um comando.**
- **PR fechado não prova conteúdo integrado.** Verifique a branch destino pelo conteúdo.
- **Peça o conserto no pacote dono do código.** Pedi correção de um teste de rotação durante a
  revisão do PR de CI; ele obedeceu, e o conserto ficou no pacote errado — o PR de CI verde e o
  pacote dono vermelho. Erro meu de direção.
- **Três commits seguidos afrouxando o mesmo teste** é sinal de que o desenho do teste está
  errado, não o limite. Separe mecanismo de configuração.
- **`/clear` não existe no Codex CLI. É `/new`.** `/clear` cai no menu `/model` e um Enter
  distraído troca o modelo — foi como ele saiu de `medium` para `high`.
- **Quando o contexto do Codex for limpo, o prompt de reentrada tem que se sustentar sozinho.**
  Caminho do repo certo, a armadilha do clone velho em `Documents\Projects\SAGE-API`, o `pull`
  do plano, o estado verificado e as regras.

---

## 8. Onde este bastão pode dar errado

- **Escrevi o estado da seção 5 sem saber se o merge que pedi foi concluído.** Verifique antes
  de agir sobre ele.
- **Nada foi executado em nenhuma das duas auditorias.** Os 191 achados brutos são análise
  estática. Achado de transação, DDL e ordem de operação é onde análise estática mais erra — e
  é a maioria dos SEV2. O R-LAB existe para isso e ainda não provou nada.
- **A estimativa de "~95% falta" é chute calibrado**, por peso de esforço, não medição. Defendo
  a ordem das releases, não a casa decimal.
- **Meu escopo da R2 (~500 linhas de PowerShell) foi feito sem escrever PowerShell.** Ativação
  atômica no Windows tem armadilha que eu não medi.
- **Discordei da reescrita do instalador sem ter lido as outras quatro recomendações de
  reescrita com a mesma profundidade.** Se densidade engana num lugar, pode enganar nos outros.
