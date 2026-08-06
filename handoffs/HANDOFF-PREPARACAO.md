# HANDOFF — do arquiteto para o agente de preparação

Abra um Claude Code ou Codex na raiz do repositório `SAGE-API` e cole o prompt abaixo.

O agente vai executar três fases **nesta ordem**: limpar os dados vazados, popular a
documentação, criar as issues. A ordem não é negociável — a fase 1 reescreve o histórico
do Git, e fazer isso depois de haver PRs e branches novas custa muito mais caro.

**Pré-requisitos:**
- `gh` (GitHub CLI) autenticado, com permissão de admin nos repositórios
- `git-filter-repo` instalado (`pip install git-filter-repo`)
- Ninguém da equipe com trabalho não commitado — a reescrita invalida todos os clones
- A pasta `SAGE-repo/` deste pacote acessível ao agente

---

## PROMPT

```
Você vai preparar o repositório SAGE-API para uma fase longa de desenvolvimento
orquestrado por agentes. São TRÊS FASES, executadas nesta ordem. NÃO pule nem reordene.

Você NÃO vai escrever código de produção em nenhuma delas.

═══════════════════════════════════════════════════════════════════════
FASE 1 — REMOVER DADOS PESSOAIS DO HISTÓRICO
═══════════════════════════════════════════════════════════════════════

CONTEXTO: a pasta `database/` contém dados reais de alunos e funcionários da ETEC de
Taboão da Serra — arquivos SQL e planilhas com dados escolares e dados pessoais. Os
repositórios foram públicos. Isso é um incidente de dado pessoal envolvendo menores de
idade. É a primeira coisa a resolver.

Siga `docs/operacao/runbooks/limpeza-historico.md` (você vai copiá-lo na Fase 2; leia a
versão em `SAGE-repo/docs/operacao/runbooks/limpeza-historico.md`).

1.1 — INVENTÁRIO. Sem exibir conteúdo, liste os arquivos suspeitos em todo o histórico:

    git log --all --pretty=format: --name-only --diff-filter=A | sort -u \
      | grep -Ei '\.(sql|csv|xlsx|xls|env|pem|key|bak|dump)$|dados|alun|pessoa|funcionario|backup'

    Verifique também se algum `.env` real já foi commitado:
    git log --all --full-history --oneline -- '**/.env' '**/.env.*'

    IMPORTANTE: NÃO imprima o conteúdo dos arquivos. NÃO cole trechos com dado pessoal
    em nenhuma saída, log, issue ou commit. Trabalhe apenas com caminhos.

1.2 — CONFIRME COM O HUMANO. Apresente a lista de caminhos a remover e PARE. Aguarde
     aprovação explícita antes de reescrever qualquer histórico. Esta operação é
     destrutiva e irreversível sem backup.

1.3 — BACKUP. Antes de tocar em qualquer coisa, clone espelhado e guarde cópia local
     fora de qualquer nuvem:

     git clone --mirror <url> sage-api-backup.git

1.4 — SUBSTITUIÇÃO. Antes de remover, prepare o que fica no lugar, senão o
     desenvolvimento trava sem seed:

     - `database/schema.sql` — só estrutura, sem dados (mysqldump --no-data)
     - `database/seed-sintetico.sql` — dados obviamente fictícios: nomes de
       personagens, e-mails @exemplo.local, CPFs com formato válido mas inválidos na
       verificação. Volume parecido com o real: ~200 alunos, 20 professores, 8 turmas
     - `.gitignore` bloqueando os padrões removidos

1.5 — REESCRITA. Use git-filter-repo sobre um clone espelhado, com --invert-paths nos
     caminhos confirmados no passo 1.2. Faça nos DOIS repositórios: SAGE-API e SAGE.

1.6 — VERIFICAÇÃO. Confirme que os caminhos sumiram de todas as refs. Rode gitleaks
     com --redact sobre o resultado.

1.7 — PUBLICAÇÃO. Force push com --mirror.

1.8 — RELATE AO HUMANO o que ele precisa fazer manualmente e você não pode:
     - Tornar os dois repositórios privados
     - Verificar e eliminar forks (fork guarda os objetos de forma independente)
     - Abrir chamado no GitHub Support pedindo garbage collection dos objetos
       inalcançáveis — sem isso, os commits continuam acessíveis por URL de SHA
     - Rotacionar credenciais: senha do MySQL, JWT_SECRET, senha da catraca, SMTP
     - Comunicar a escola, que é a controladora dos dados
     - Apagar e re-clonar o repositório local

1.9 — REGISTRO. Crie `docs/incidentes/2026-08-dados-no-historico.md` com linha do tempo,
     tipos de dado envolvidos (sem os dados), o que foi feito, e o que mudou no processo
     para não repetir. NÃO inclua nenhum dado pessoal neste arquivo.

NÃO PROSSIGA para a Fase 2 sem a Fase 1 concluída e verificada.

═══════════════════════════════════════════════════════════════════════
FASE 2 — INSTALAR A DOCUMENTAÇÃO E A GOVERNANÇA
═══════════════════════════════════════════════════════════════════════

Copie o conteúdo de `SAGE-repo/` para a raiz do repositório, preservando a estrutura:

    AGENTS.md                    regras para agentes de código
    CLAUDE.md                    ponteiro para AGENTS.md
    README.md                    visão geral e como rodar
    eslint.config.js             enforça as regras do AGENTS.md
    .github/ISSUE_TEMPLATE/      3 templates + config
    .github/pull_request_template.md
    .github/workflows/ci.yml     barreiras automáticas
    docs/                        toda a documentação

2.1 — Se já existir README.md, preserve o que for específico do repositório (badges,
      instruções que ainda valem) e integre. Não descarte informação boa.

2.2 — Ajuste `package.json`: adicione os scripts referenciados pelo CI —
      `test:db:setup`, `test:redacao`, `test:unit`, `test:integracao` — como stubs que
      falham com mensagem clara dizendo que serão implementados no WP-00a. Adicione
      `eslint` como devDependency.

2.3 — Verifique que todo link relativo entre documentos resolve. Corrija os quebrados.

2.4 — Commit numa branch `docs/arquitetura`, com mensagem convencional. Abra PR.

═══════════════════════════════════════════════════════════════════════
FASE 3 — CRIAR AS ISSUES
═══════════════════════════════════════════════════════════════════════

Leia, nesta ordem: `AGENTS.md`, `docs/README.md`, `docs/produto/roadmap.md`, os ADRs
citados pelos pacotes, e os três templates em `.github/ISSUE_TEMPLATE/`.

3.1 — MILESTONES (correspondem às fases do roadmap):
      "Fase 0 — Parar o sangramento"
      "Fase 1 — Confiar no dado"

3.2 — LABELS:
      pacote-trabalho, bug, decisao-arquitetura
      sev1, sev2, sev3, sev4
      bloqueante
      precisa-catraca    (só avança com o hardware)
      precisa-escola     (só avança com decisão da direção)
      precisa-visita     (só avança presencialmente)

      Os três últimos são importantes: quando surgir uma janela de acesso à escola,
      filtrar por eles diz exatamente o que fazer lá.

3.3 — ESCOPO: apenas Fase 0 e Fase 1. NÃO crie issues das fases 2 em diante. Backlog
      inteiro aberto vira cemitério e para de ser consultado.

      Fase 0:
      - 1 issue "pacote de trabalho" para WP-00a (harness de teste) — marque como
        BLOQUEANTE de todas as outras. Sem harness, os testes de regressão dos bugs
        não têm onde se apoiar
      - 1 issue "pacote de trabalho" para WP-00 como guarda-chuva, com task list
        apontando para as 7 issues de bug
      - 7 issues "bug", uma por BUG-1 a BUG-7, cada uma autossuficiente

      Classifique a severidade você mesmo, justificando em uma frase. Considere que
      BUG-1, BUG-2 e BUG-3 corrompem dado silenciosamente — releia a seção "Estado
      atual do código" em `docs/arquitetura/sincronizacao.md`.

      Fase 1:
      - 1 issue "pacote de trabalho" por WP (WP-01 a WP-04)
      - WP-03 (pareamento entrada/saída) é o mais subestimado: inclua os cinco casos
        degenerados de `docs/arquitetura/presenca.md` como critérios de aceite separados

3.4 — DECISÕES EM ABERTO. Crie uma issue "decisão de arquitetura" para cada questão
      ainda não resolvida que você encontrar. No mínimo:
      - Formato obrigatório de folha de ponto do Centro Paula Souza
      - Quem mantém o calendário escolar de feriados e recessos
      - Capacidade máxima de usuários do modelo de catraca instalado
      Marque com `precisa-escola` ou `precisa-catraca` conforme o caso.

3.5 — REGRAS DE CONTEÚDO (obrigatórias):
      - Português do Brasil
      - Cada issue autossuficiente: executável lendo só ela e os documentos que ela
        referencia. Não escreva "conforme o roadmap" sem transcrever o que importa
      - Critérios de aceite verificáveis. "Funciona bem" não é critério; "teste X
        falha antes e passa depois" é
      - Referencie documento e seção com caminho relativo no repositório
      - NUNCA inclua log cru, dado de pessoa real, IP interno, credencial ou trecho
        de .env. Use dados sintéticos e códigos de erro
      - Siga a estrutura de campos do template correspondente

3.6 — DEPENDÊNCIAS. Deixe explícito na descrição quando uma issue bloqueia outra.
      Ordem: WP-00a antes de tudo; Fase 0 inteira antes de qualquer coisa da Fase 1.

═══════════════════════════════════════════════════════════════════════
RELATÓRIO FINAL
═══════════════════════════════════════════════════════════════════════

Produza:
- Fase 1: caminhos removidos, confirmação de que sumiram, e a lista do que o humano
  ainda precisa fazer manualmente
- Fase 2: arquivos instalados, links corrigidos, número do PR
- Fase 3: tabela com número, título, tipo, severidade, milestone e labels de cada issue
- A ordem recomendada de execução
- Quais issues estão bloqueadas e pelo quê
- Quais dependem de acesso à escola ou à catraca
- O que você encontrou na documentação que estava ambíguo ou contraditório

═══════════════════════════════════════════════════════════════════════
RESTRIÇÕES
═══════════════════════════════════════════════════════════════════════

- NÃO escreva código de produção
- NÃO altere o conteúdo dos documentos de arquitetura (só corrija links quebrados)
- NÃO mexa nas issues já existentes no repositório — outra equipe cuida delas
- NÃO reescreva histórico sem aprovação explícita no passo 1.2
- NÃO imprima nem cole conteúdo de arquivo com dado pessoal em lugar nenhum
- Se algo no roadmap estiver ambíguo, crie issue de decisão em vez de assumir
```

---

## Depois que o agente terminar

**1. Revise a Fase 1 com atenção.** Confirme você mesmo que os arquivos sumiram:

```bash
git log --all --oneline -- database/dados_etec_taboao.sql   # deve vir vazio
```

E execute o que só você pode fazer: repositórios privados, forks eliminados, chamado no
GitHub Support, credenciais rotacionadas, escola comunicada.

**2. Revise as issues** — principalmente a severidade atribuída e os critérios de aceite.
Confira que nenhuma contém dado real.

**3. Comece pelo WP-00a** (harness de teste). Sem ele, os sete bugs não têm como ser
provados e você fica com check verde que não prova nada.

---

## O ciclo, daqui em diante

```
1. Pegar a próxima issue da fila
2. git checkout -b wp/NN-nome     (ou fix/NN-nome)
3. Agente: "implemente a issue #N, leia AGENTS.md, não exceda o escopo"
4. PR pequeno — passou de ~400 linhas de diff, quebre em dois
5. Revisão com PROMPT-revisor.md
6. Merge
7. Aprendeu algo que dura? Atualiza o doc. Não aprendeu? Não atualiza nada
```

Detalhe em [`docs/operacao/processo.md`](SAGE-repo/docs/operacao/processo.md).

**Fora da fila, faça esta semana:**

- Submeter o pedido ao SignPath Foundation — aprovação leva semanas e não pode ser o
  gargalo do fim ([ADR-0002](SAGE-repo/docs/adr/0002-assinatura-signpath.md))
- Conferir o `CATRACA_USER_ID_OFFSET` no `.env` da máquina da escola e anotar o valor
  atual antes de mudar qualquer coisa

**Uma mudança de ordem que vale considerar:** o roadmap é por camadas até a Fase 2. Da
Fase 3 em diante, entregue **uma tela completa** — a de histórico da pessoa — e mostre
à secretaria antes de construir as outras quatro. Semanas construindo às cegas e
revelando tudo no fim é o jeito mais eficiente de construir a coisa errada com muita
qualidade.
