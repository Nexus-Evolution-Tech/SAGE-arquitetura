# SAGE — Domínio, validação contra o código e lacunas

> Escrito em 2026-08-05 a partir do relato do dono do produto sobre o pedido original da
> secretaria da ETEC de Taboão da Serra, validado linha a linha contra o código real.
>
> Marcação usada em todo o documento:
> **[EXISTE]** verifiquei no código · **[PARCIAL]** existe pela metade · **[FALTA]** não
> existe em nenhuma forma · **[AMBÍGUO]** precisa de decisão do dono do produto

---

## 1. Por que o SAGE existe

O sistema da própria Control iD é genérico demais. Controlar entrada e saída nele é trabalho
repetitivo: a operação da escola tem regras que o fabricante não modela — aula, turma,
grade, turno, divisão, professor com horário variável.

**O SAGE não compete com a catraca. Ele traduz a operação escolar para a catraca, e traduz
o log da catraca de volta para a linguagem da escola.** A catraca é sensor e atuador; o
produto é a interpretação.

O pedido tem duas metades, e elas têm pesos diferentes no código de hoje:

| Metade | O que é | Estado |
|---|---|---|
| **Controlar** | não deixar sair antes da aula acabar, não deixar entrar fora de hora, notificar antes, liberar rápido | **[FALTA] quase inteira** |
| **Entender** | faltantes, atrasados, saídas antecipadas, filtros por período, folha de ponto | **[PARCIAL] bem avançada** |

Este desequilíbrio é o achado central deste documento.

---

## 2. O modelo de domínio

### 2.1 Estrutura organizacional

```
UnidadeEscolar
 └── Curso                    (Desenvolvimento de Sistemas, Técnico em X, ...)
      └── [Período?]          [AMBÍGUO] — ver §5.1
           └── Turma          turno: MATUTINO | VESPERTINO | NOTURNO | INTEGRAL
                └── Divisão   INT | DIV A | DIV B
                     └── Aluno
```

**[EXISTE]** `Curso`, `Turma` com `turno`, `Aluno.divisao`, `HorarioAula.divisao`.
A divisão A/B está modelada nos dois lados — turma e grade. Isso está certo e é sutil:
uma aula pode valer para a turma inteira (`INT`) ou só para metade dela.

**[AMBÍGUO]** Não existe nível "Período" entre Curso e Turma. Ver §5.1.

### 2.2 Pessoas

```
Pessoa (tipo: ALUNO | RESPONSAVEL | PROFESSOR | ADMINISTRADOR | TERCEIRIZADO | PROFADM)
 ├── Aluno          → turma, divisão, RA, RM, status de matrícula
 ├── Responsavel    → vinculado a aluno
 └── Funcionario    → matrícula, admissão, contrato
      ├── Professor      → horário VARIÁVEL, derivado da grade de aulas
      ├── Administrador  → horário FIXO
      └── Terceirizado   → horário FIXO, vinculado a Empresa, com função
```

**[EXISTE]** toda a hierarquia, inclusive `Terceirizado.funcao` com nove valores e
`Empresa`. O "mais algum que eu não lembro" que você mencionou está no código: **`PROFADM`**
— professor que também é administrador.

**[PARCIAL]** `PROFADM` existe como valor de `Pessoa.tipo` mas **não tem tabela própria**.
O caso é tratado por uma flag `Professor.usar_horario_fixo`, que aparece só em
`melhorias_sistema.sql`. Funciona, mas é meia-modelagem: uma pessoa que dá aula *e* cumpre
expediente tem duas expectativas simultâneas, e a flag força escolher uma.

### 2.3 Tempo — a espinha dorsal

```
Aluno       → expectativa vem da GRADE:  HorarioAula(turma, divisão, dia, horário)
Professor   → expectativa vem da GRADE:  Aula(professor) × HorarioAula
Admin/Terc  → expectativa vem do FIXO:   FuncionarioHorario(dia, entrada, saída)
```

**[EXISTE]** `Aula`, `HorarioAula`, `FuncionarioHorario`, `Materia`, `Sala`.

**[EXISTE]** validação de conflito de grade — `horarioAulaController.js:48`,
`validarConflitoProfessor`, com um comentário que mostra que quem escreveu entendeu o
problema: *"Checamos conflito SEM considerar a divisão — apenas dia + horário (um professor
não é dois)"*. Está correto. É exatamente o trabalho que hoje é feito conferindo 6 turmas
no Excel.

**[FALTA]** montagem assistida — sugerir quais professores cabem num vazio, preencher com
aceite humano. Hoje valida, não sugere. Ver §6.2.

**[FALTA]** exportação da grade pronta para impressão e distribuição aos alunos.

---

## 3. As regras de negócio, uma a uma

### 3.1 Aluno

| Regra | Estado |
|---|---|
| Entrada depois do início da primeira aula → **atrasado** | **[PARCIAL]** calculado em relatório, não no momento do acesso |
| Tentativa de saída antes do fim da última aula → **bloqueia** | **[FALTA]** |
| Bloqueio gera **notificação em tempo real** "fulano tentando sair, aprovar?" | **[FALTA]** |
| Secretaria pode **liberar preventivamente** uma pessoa | **[FALTA]** |
| Toda liberação **registra em nome de quem liberou** | **[FALTA]** — não há campo `aprovado_por` |
| Entrada permitida numa **tolerância** ao redor do funcionamento da escola | **[FALTA]** — não há horário de funcionamento nem tolerância modelados |
| **Liberação em massa** ("hoje o 1B sai mais cedo, professor faltou") | **[FALTA]** — o conceito não existe |
| Futuro: avisar responsável quando o aluno sai mais cedo | **[FALTA]** — `Responsavel` existe, canal não |

### 3.2 Funcionário

| Regra | Estado |
|---|---|
| Registrar entrada e saída para folha de ponto | **[PARCIAL]** eventos brutos existem em `Acesso` |
| Professor: expectativa vem da grade, não de horário fixo | **[EXISTE]** |
| Admin/terceirizado: horário fixo por dia da semana | **[EXISTE]** `FuncionarioHorario` |
| **Sair e voltar entre aulas NÃO conta como saída** | **[FALTA]** — não há pareamento de jornada |
| Só conta como falta se saiu **tendo aula no nome dele naquele horário** | **[FALTA]** — ver §6.1, é a regra mais fina do sistema |
| Chegou com a aula dele já iniciada → atrasado | **[PARCIAL]** em relatório |
| Documento de folha de ponto, impresso, conferido e assinado pela secretaria | **[FALTA]** |
| Secretaria pode alterar, com registro | **[FALTA]** |

### 3.3 Inteligência sobre o dado

**[EXISTE]** e é a parte mais madura. `relatorioController.js` já entrega `resumo`,
`detalhes`, `historicoPessoa`, com filtros por período (dia, semana, mês, personalizado),
por turma, por tipo de funcionário. Já calcula esperados no dia, esperados por slot, horário
previsto por pessoa **e horário de saída previsto por pessoa**.

**[PARCIAL]** o que falta aqui é menos funcionalidade e mais fundação — ver §6.1.

---

## 4. O que está errado na modelagem hoje

### 4.1 `Presenca` é tabela mutável e não tem saída

```sql
Presenca (pessoa_id, data, dia_semana, aulas_perdidas,
          horario_previsto, horario_chegada, atrasado)
```

Três problemas:

1. **Não tem nenhum campo de saída.** Todo o pedido sobre saída antecipada não tem onde
   morar. Hoje isso é recalculado em tempo de consulta pelo relatório.
2. **É mutável.** `UPDATE` e `DELETE` livres, sem trilha. Contradiz o ADR-0007, que exige
   registro imutável com correção rastreável — e isso alimenta folha de ponto.
3. **A unidade é o dia.** Mas a regra que você descreveu para professor é por *aula*: "só
   conta se saiu tendo aula no nome dele naquele horário". Ver §6.1.

### 4.2 Horário guardado como texto

`HorarioAula.horario VARCHAR(11)` — a string `"07:30-08:20"`. Todo o produto compara
horários: atraso, saída antecipada, faixa, tolerância. Comparar texto funciona por acidente
(`HH:MM` zero-padded ordena lexicalmente) até o primeiro formato divergente entrar.

Pior: `migration_horario_aula_horario.sql` mostra que **existem instalações com `inicio`/`fim`
e outras com `horario`**, e o próprio arquivo é um comentário pedindo execução manual. Duas
escolas podem ter schemas diferentes.

### 4.3 O schema está fragmentado em três lugares

`sage.sql`, `melhorias_sistema.sql` e dez `migration_*.sql`. `Sala`, `HorarioAula`,
`Presenca`, `FuncionarioHorario` e `ConfigSistema` aparecem em **mais de um arquivo**, com
definições que precisam ser conferidas entre si. `FuncionarioHorario` — que é requisito de
folha de ponto — só existe em `melhorias_sistema.sql`.

Para um produto instalado por uma secretária numa máquina que ninguém conhece, **não saber
qual é o schema verdadeiro é risco operacional de primeira ordem.**

### 4.4 `SolicitacaoAcesso` é uma casca

- Só aceita `aluno_id`. Funcionário e visitante não cabem.
- **Não registra quem aprovou.** É o oposto do que você pediu.
- Não se liga ao `Acesso` que resultou dela.
- Aprovar não produz efeito nenhum no mundo físico.

### 4.5 Dois caminhos para saber o professor de uma aula

`Materia.professor_id` **e** `Aula.professor_id`. Quando divergirem, qual vale? Isso decide
de quem é a falta.

---

## 5. Decisões — tomadas em 2026-08-05

### 5.1 "Período" é o turno — RESOLVIDO, nada a construir

Confirmado pelo dono do produto: quando ele diz "período", quer dizer turno. Isso já existe
em `Turma.turno` (`MATUTINO | VESPERTINO | NOTURNO | INTEGRAL`).

**Consequência:** a hierarquia do código está correta e completa. `Curso → Turma(turno) →
Aluno` é o modelo, e não falta nível nenhum.

**Ponta solta que fica registrada:** `promocaoAlunosService.js` promove alunos, e promoção
pressupõe alguma noção de série ou ano. Se hoje isso está codificado no nome da turma
(`"1B"` → `"2B"` por manipulação de texto), é frágil e vai quebrar em nome fora do padrão.
**Item para a auditoria confirmar**, não para reabrir a decisão.

### 5.2 A catraca consegue bloquear e perguntar em tempo real?

**Esta é a pergunta que decide se metade do produto é construível.** O fluxo que você
descreveu — catraca bloqueia, SAGE notifica, secretaria aprova, catraca libera — exige que o
equipamento delegue a decisão ao servidor no instante do giro.

É **DESCONHECIDO** e não se responde daqui. Depende do modelo, do firmware e da latência da
rede da escola. É o WP-12 do roadmap e o item de maior valor da visita presencial.

Se a resposta for não, o produto ainda existe, mas o desenho muda: o bloqueio vira
**preventivo** (o SAGE decide de antemão quem pode sair e escreve isso na catraca antes) em
vez de **reativo**. Funciona, é menos flexível, e a notificação passa a ser depois do fato.

Não construa nada da metade "controlar" antes disso estar respondido.

### 5.3 Ordem mantida: dado antes de controle — RESOLVIDO

Decisão do dono do produto: **manter a ordem do roadmap.** Fase 3 (folha de ponto, folha de
presença, histórico, dashboard) antes da Fase 4 (bloqueio, aprovação em tempo real).

O argumento que sustenta: a Fase 3 inteira depende só de registro fiel. Não depende da
catraca cooperar, não depende do firmware, não depende da visita. É entrega garantida. A
Fase 4 pode descobrir que o hardware não delega decisão — e aí o desenho muda.

**Consequência que NÃO é óbvia e precisa ser dita:** a entidade `Excecao` (§6.2) tem duas
faces, e só uma delas é da Fase 4.

| Face | O que faz | Fase |
|---|---|---|
| **Dado** | passeio da turma vira ausência justificada; feriado não conta falta | **Fase 3** — sem isso a folha de presença conta falta errada |
| **Controle** | liberar saída, autorizar visitante, abrir evento | Fase 4 |

Se a face de dado não existir na Fase 3, a folha de presença vai acusar 30 faltas no dia do
passeio, e a secretaria vai corrigir 30 linhas à mão — exatamente o trabalho repetitivo que
motivou o pedido. **Construa a tabela `Excecao` inteira na Fase 3, e ligue só a face de
dado.** A face de controle acende depois, sem migração.

### 5.4 Tolerância global da escola — RESOLVIDO

Decisão do dono do produto: **granularidade global**, em `ConfigSistema`. Abertura,
fechamento e tolerância de atraso valem para a escola inteira.

Razão que reforça a escolha: cadastro por turma seria trabalho repetitivo para a secretaria
— e trabalho repetitivo é precisamente do que ela reclamou no sistema da Control iD. A
solução não pode reproduzir o problema.

Fica o gancho para refinar por turno depois, se a operação pedir, sem quebrar nada.

---

## 6. O que eu mudaria para o sistema ficar mais inteligente

Três mudanças de fundação. Nenhuma é feature; todas destravam features.

### 6.1 A unidade de verdade deve ser o SLOT, não o dia

Hoje `Presenca` é por dia. Mas as regras que você descreveu são por aula:

- "só conta se ele saiu **tendo aula no nome dele naquele horário**"
- "chegou e **a aula dele** já tinha começado"
- `aulas_perdidas` já existe na tabela — o modelo está pedindo isso

**Proposta:** a expectativa materializada de cada pessoa em cada dia é uma lista de slots
(pessoa × data × faixa de horário × origem). Presença, atraso, saída antecipada e falta
passam a ser propriedades do slot, e o dia é uma agregação.

O que isso destrava de graça:
- professor que sai e volta entre aulas → não há falta porque não há slot descoberto
- aluno com janela no meio do dia → mesmo tratamento, sem regra especial
- "faltou na terceira aula" → pergunta respondível, hoje impossível
- toda consulta de relatório vira leitura de uma tabela em vez de recomputar a expectativa
  a cada requisição, como `relatorioController` faz hoje com seis funções auxiliares

### 6.2 "Exceção" precisa ser entidade de primeira classe

Hoje não existe. E é o mesmo conceito por trás de quatro pedidos diferentes:

| Pedido | É uma exceção com... |
|---|---|
| "hoje o 1B sai mais cedo" | escopo = turma, efeito = permitir saída, janela = hoje |
| visitante | escopo = pessoa, efeito = permitir entrada, janela = validade |
| passeio da turma | escopo = turma, efeito = ausência justificada |
| evento aberto ao público | escopo = todos, efeito = permitir entrada |

Uma tabela `Excecao(escopo, alvo, efeito, janela, criada_por, motivo)` cobre WP-14, WP-15 e
a liberação em massa que a secretaria pediu — que hoje está lá na Fase 4 e deveria ser
central.

E resolve o "de forma muito rápida" que você enfatizou: liberar uma turma é **um registro**,
não trezentas operações.

### 6.3 Toda decisão precisa carregar o porquê

Quando a secretaria perguntar "por que bloqueou?", o sistema deve responder em português:

> *Aluno da turma 1B, aula até 15:30, tentou sair às 14:12. Nenhuma exceção vigente.*

Guarde o motivo junto da decisão, não só o resultado. **É isso que separa o SAGE do sistema
genérico da Control iD que a escola achou complicado demais.** O sistema genérico diz
"negado". O SAGE diz por quê, e mostra o botão que resolve.

---

## 7. Ambiente, catraca híbrida, usuários e longevidade

Acrescentado em 2026-08-05 a partir de novo relato do dono do produto.

### 7.1 A máquina — deixa de ser desconhecida

Windows 11 · i5 de 7ª geração · 8 GB RAM · HD de 500 GB · rede totalmente controlada.

Três consequências:

- **8 GB é o orçamento apertado.** MySQL, Node, e o painel dividem isso. Redis é a primeira
  coisa a sair — e sai de graça: `src/config/redis.js` já tem fallback para LRU em memória
  e `lru-cache` já é dependência. `REDIS_ENABLED=false` remove um daemon inteiro sem tocar
  em código. **[EXISTE]**, só falta decidir.
- **i5 de 7ª geração não é suportado oficialmente pelo Windows 11** (o mínimo é a 8ª). A
  máquina provavelmente recebeu instalação com contorno. Isso não afeta o SAGE hoje, mas
  significa que o sistema operacional pode parar de receber atualização. É risco de
  ambiente, fora do código, e vale registrar no runbook da visita.
- **Rede controlada** valida o desenho de descoberta automática e torna o push viável.

### 7.2 Descobrir a catraca sozinho — já existe

**[EXISTE]** `src/services/networkDiscoveryService.js`: deriva o CIDR das interfaces locais,
expande a faixa, varre as portas 80 e 82 com concorrência de 64 e identifica Control iD por
resposta (`isControlId`). Não precisa pedir IP.

O que falta verificar na auditoria: se a tela realmente usa isso ou se ainda pede IP na mão,
e se a varredura respeita o tempo de uma rede escolar sem travar a interface.

### 7.3 A catraca híbrida — RESOLVE a contradição do ADR-0008

O desenho relatado pelo dono do produto:

> A catraca é programada com as regras do dia. Se o SAGE cai, ela continua aplicando o que
> foi predefinido. Não notifica, mas quando o sistema volta, sincroniza e a vida segue. Se
> alguém tenta sair fora de hora com o sistema no ar, aparece o pedido de liberação. Com o
> sistema fora do ar, o pedido não aparece, ninguém libera, e a catraca fica travada.

**Isto resolve a §5.2 e o D3 do `ESTADO-VERIFICADO.md`, e resolve melhor que qualquer das
duas opções que eu havia colocado.** Não é "política no SAGE" nem "política na catraca". É:

> **O SAGE é a fonte da verdade da política. A catraca carrega uma projeção dela, válida
> para o dia. O tempo real é um acréscimo sobre a base, não a base.**

Degradação por camada, que é o desenho certo para este ambiente:

| Estado | Controle predefinido | Controle personalizado | Monitoramento |
|---|---|---|---|
| SAGE no ar | funciona | funciona | funciona |
| SAGE fora | **funciona** | não funciona → **nega** | acumula, sincroniza depois |

A postura de falha bate com o ADR-0005: entrada segue o programado, saída fora de hora sem
aprovação **nega**. Fail-closed onde precisa, e sem depender do servidor estar vivo.

**O ADR-0008 precisa ser supersedido**, não corrigido. A decisão nova é replicação de
política com fonte única, não exclusividade.

**O que isto acrescenta de trabalho, e não é pequeno:** o SAGE passa a ter que **escrever a
grade do dia dentro da catraca** — grupos, faixas de horário, vínculos. É a escrita mais
arriscada do sistema, roda todo dia, e o ADR-0009 (reconciliação em vez de fila) e a regra
de idempotência do AGENTS.md §4.5 valem inteiros aqui. Um erro nessa escrita tranca a escola.

**O que continua DESCONHECIDO e só a visita responde:** se a catraca aceita a ordem de
liberar uma passagem específica sob demanda. Sem isso o "aprovar agora" não fecha o ciclo —
o resto do desenho híbrido sobrevive, mas a aprovação em tempo real vira aprovação para o
próximo giro.

### 7.4 Não existe usuário do sistema — e isso quebra o modelo de responsabilidade

**[FALTA]** Não há tabela de usuário. O login é `UnidadeEscolar.login` + `senha`: **uma
credencial para a escola inteira**. O JWT aceita qualquer payload (`gerarToken(payload)`,
sem estrutura) e `autenticar.js` só faz `req.user = payload`.

Consequência direta e grave: **"toda liberação registra em nome de quem liberou" é
impossível hoje.** Se todas as secretárias entram com a mesma credencial, não existe "quem".

E isso não é só o controle de acesso. É o modelo de responsabilidade inteiro da folha de
ponto: alguém confere, assina e se responsabiliza. Sem identidade individual, a assinatura
não tem lastro e a trilha do ADR-0007 não fecha.

**Escopo esclarecido:** uma escola por instalação. Outra escola usa outra instalação com o
próprio cadastro. Portanto **não é multi-tenant** — é mono-escola, multi-usuário. Isso
simplifica bastante: nada de escopo por unidade nas consultas, `UnidadeEscolar` é
essencialmente configuração.

Isto reposiciona o V3: não é "adicionar autorização por perfil" a um sistema que tem
usuários. É **criar a noção de usuário**, e a autorização vem junto.

### 7.5 Longevidade — o que realmente mata sistema on-premise

O pedido é rodar muito tempo sem manutenção. A stack não é o problema; a operação é.

**[FALTA] Nada controla o crescimento de disco.** `src/config/logger.js` não tem `maxsize`
nem `maxFiles`. `backupBanco.js` não tem retenção. `Acesso` cresce para sempre. Num HD de
500 GB isso demora, mas o fim é certo, e o modo de morrer é o pior possível: disco cheio →
MySQL para de escrever → a catraca continua girando → **semanas de registro perdidas em
silêncio**, exatamente o cenário que o AGENTS.md chama de falha mais grave.

As cinco coisas que compram anos, em ordem de retorno:

1. **Rotação e retenção de log com teto rígido**, e o mesmo para backup. Barato, e é a
   causa número um de morte de sistema desatendido
2. **Menos daemons.** Desligar o Redis tira um processo, um ponto de falha e memória de uma
   máquina de 8 GB, sem perder função
3. **Falha barulhenta.** O sistema já tem `readinessService` e supervisor. Falta o degrau
   que uma secretária entende: um indicador na tela que diz "não estou registrando"
4. **Plano de crescimento do dado.** `Acesso` e a expectativa por slot (§6.1) crescem
   linearmente com alunos × dias. Definir arquivamento antes de doer
5. **Runtime congelado** — já decidido no ADR-0004. Mantém.

Nenhum desses cinco é feature. Todos são a diferença entre um sistema que dura e um que
precisa de você.

---

## 8. Instalação e primeira execução

### 8.1 A ordem de cadastro não é opinião — as FKs a determinam

Derivada das chaves estrangeiras do schema. Cada item só pode existir depois do que está
acima dele:

```
1. UnidadeEscolar          ← raiz; dados da escola + conta admin
2. Area                    ← precisa de unidade
3. Dispositivo (catraca)   ← precisa de area          [varredura da rede entra aqui]
4. Curso                   ← independente
5. Turma                   ← precisa de curso + unidade
6. Empresa                 ← independente, mas OBRIGATÓRIA antes de terceirizado
7. Sala                    ← precisa de unidade
8. Pessoa
   ├── Aluno               ← precisa de Turma
   ├── Responsavel         ← precisa de Aluno
   └── Funcionario
        ├── Professor
        ├── Administrador
        └── Terceirizado   ← precisa de Empresa
9. Materia                 ← precisa de Professor + Curso
10. Aula                   ← precisa de Professor + Materia
11. HorarioAula (a grade)  ← precisa de Turma + Aula + Sala
12. FuncionarioHorario     ← precisa de Funcionario
```

**Repare onde a grade cai: no fim.** Ela depende de tudo. E é a grade que gera a
expectativa, que é o que produz atraso, saída antecipada e falta. Ou seja: **o sistema não
interpreta nada até o passo 11.**

### 8.2 Duas etapas, não uma — e isso decide o sucesso da visita

Um assistente linear com doze passos é um assistente que a secretária abandona no sexto. E
há uma restrição dura: **uma visita presencial só.** O que não funcionar antes de você sair
pela porta vira problema remoto.

A quebra natural:

**ETAPA 1 — "o sistema já está registrando"** (passos 1 a 8). Ao fim dela a catraca conhece
as pessoas, gira, e os acessos aparecem na tela. **Isto tem que estar concluído e provado
durante a visita.** É o que você não consegue consertar de longe.

**ETAPA 2 — "o sistema já está entendendo"** (passos 9 a 12: matérias, aulas, grade,
horários fixos). Produz a interpretação. **Pode ser feita remotamente, ao longo de dias**,
pela secretaria, sem você presente — e é justamente o trabalho que ela já faz hoje no Excel.

Vantagem que não é óbvia: entre a Etapa 1 e a 2 o sistema **já entrega valor** — registro
bruto de quem entrou e saiu, que é mais do que ela tem hoje. Ela não fica olhando para uma
tela vazia esperando terminar o cadastro.

### 8.3 O importador para nas pessoas — e é aí que dói

**[EXISTE]** `importService.importarPlanilha` na ordem: `ESCOLA → CURSOS → TURMAS →
CATRACAS → ALUNO → RESPONSAVEL → PROFESSOR → ADMINISTRADOR → TERCEIRIZADO`. Trata serial de
data do Excel, normaliza turno e divisão, e reporta erro por linha.

**[FALTA]** o importador **não importa** `Empresa`, `Sala`, `Materia`, `Aula`,
`HorarioAula` nem `FuncionarioHorario`.

Duas consequências:

1. **Terceirizado entra com `empresa_id` NULL**, porque `Empresa` nunca é importada e ela é
   pré-requisito. Achado a confirmar na auditoria.
2. **A planilha traz o "quem", nunca o "quando".** A grade e os horários fixos ficam de fora
   — exatamente os passos 9 a 12, que são a Etapa 2 inteira. O "importar tudo de uma vez"
   que você descreveu importa metade.

Se a Etapa 2 for digitação manual da grade de todas as turmas, a secretaria vai reproduzir
no SAGE o trabalho que fazia no Excel — e o motivo do pedido era eliminar esse trabalho.
**Importar a grade a partir da planilha que ela já usa é requisito, não conveniência.**

**[VERIFICAR]** se `importarPlanilha` é transacional. As inserções parecem ser linha a linha
com `try/catch` individual. Se for, uma importação interrompida deixa a escola pela metade —
e o AGENTS.md §4.7 exige transação em escrita multi-passo.

### 8.4 O executável sem assinatura é um muro no meio do "próximo, próximo, próximo"

O fluxo que você descreveu — landing page, baixar o `.exe`, instalar como qualquer software
— colide de frente com o ADR-0002, que decidiu distribuir **sem assinatura de código**.

O que a secretária vai ver ao abrir o instalador baixado:

> **O Windows protegeu o seu PC**
> O Microsoft Defender SmartScreen impediu a inicialização de um aplicativo não reconhecido.

O botão "Executar assim mesmo" fica **escondido atrás de "Mais informações"**. Uma pessoa
não-técnica, orientada a não instalar coisa estranha, para exatamente ali. E se houver
política de TI da escola bloqueando binário não assinado, nem esse caminho existe.

Isto não é detalhe de acabamento: **é o primeiro passo do produto, e ele falha em silêncio
do lado do usuário** — você não fica sabendo que ela não conseguiu.

Duas ações, ambas com prazo longo, e por isso urgentes:

- **Submeter o pedido ao SignPath Foundation agora.** O roadmap já diz isso ("fazer hoje,
  fora de ordem"), leva semanas, e não pode ser o gargalo do fim
- **Perguntar à escola se existe política de TI que bloqueia executável não assinado.** Já
  está listado como pendência aberta desde o início e continua sem resposta

Enquanto não houver assinatura, o instalador precisa vir acompanhado de instrução visual
explícita sobre a tela do SmartScreen. É contorno, não solução.

### 8.5 Conserto remoto — o desenho já existe e é coerente

Uma visita só, tudo o mais remoto. Isso não é novidade para a arquitetura: ADR-0011
(blue/green com rollback por `/ready`), o canal só de saída, e o `supervisor.js` já testado
cobrem o caminho.

O que falta para o conserto remoto ser real é o que já está mapeado: telemetria com redação
de PII (WP-05), support bundle e código de erro estável (WP-06). Sem eles, "consertar
remotamente" é adivinhar por telefone com uma secretária lendo a tela.

---

## 9. Ciclo de vida do dado — retenção, arquivamento e expurgo

### 9.1 Enquadramento — decidido pelo dono do produto em 2026-08-05

O `PROMPT-ARQUITETO.md` afirmava que o dono do produto é "operador de dados de menores sob
a LGPD". **Essa premissa foi contestada por ele e não se sustenta enquanto o sistema for
puramente local.** Software que roda inteiro na máquina do cliente, sem dado voltando, é
fornecimento de ferramenta — não tratamento por conta de terceiro.

**Decisão que vale daqui para frente: o SAGE entrega mecanismo, a escola define política.**
Nenhum recurso é bloqueado por argumento jurídico. As travas que existem são contra
**acidente**, e são de engenharia.

**A única fronteira que permanece**, e ela é consequência de um requisito do próprio dono do
produto, não de lei: no instante em que telemetria (WP-05) e support bundle (WP-06)
existirem, dado passa a sair da escola em direção a ele. Log de erro e bundle carregam nome,
foto, caminho de arquivo e payload — por acidente, que é como sempre acontece. Por isso a
redação continua sendo **pré-requisito técnico do canal de saída**: o canal é dele, e ele
não quer receber isso.

Enquanto o sistema for só local, a questão não se coloca.

### 9.2 O que já existe

**[EXISTE]** `backupBanco.js` com `gerarBackup`, `verificarBackup`, `listarBackups` e
`aplicarRetencao()` — esta última agendada em `scheduledJobs.js:282`. A retenção de **backup**
está resolvida.

**[EXISTE]** `Pessoa.visivel` como soft delete (`people-db-utils.js:370`).

**[EXISTE]** `Aluno.status` com `CONCLUIDO`, `TRANSFERENCIA EXPEDIDA`, `CANCELADO`,
`DESISTENTE`, `RETIDO`, `TRANCADO`, `SUSPENSO`. **É a chave natural do ciclo de vida** —
"turma que saiu fica um ano e depois vai para o frio" sai quase de graça a partir daqui.

**[FALTA]** rotação de log em `src/config/logger.js` — sem `maxsize`, sem `maxFiles`
(reconferido em português e inglês). Continua sendo o caminho mais provável para disco cheio.

**[FALTA]** qualquer noção de retenção, arquivamento ou expurgo de **dado de negócio**.

### 9.3 O achado mais perigoso do repositório

`POST /dispositivos/:id/zerar-tudo` (`deviceRoutes.js:23` → `deviceController.js:545`), com
`apagarPessoasNoSistema: true`, executa doze `DELETE` sem `WHERE`:

```
Presenca · SolicitacaoAcesso · HorarioAula · Aula · Professor · Administrador
Terceirizado · Funcionario · Aluno · Responsavel · Acesso · sync_pendente · Pessoa
```

**Sem transação. Sem backup prévio. Sem confirmação. Sem registro de quem executou.** A rota
é protegida apenas por `autenticar` — e como existe uma senha única para a escola inteira
(§7.4), qualquer pessoa que a conheça apaga a escola numa chamada.

Some `DELETE /dispositivos` → `limparUsuarios` na mesma família. E o `catch` vazio do V4 está
exatamente aqui, na linha 557.

**Isto é perda total de dado a um clique de distância, e não depende de decisão de ninguém
para ser cercado.** Severidade acima dos sete defeitos do WP-00.

**[VERIFICAR] na auditoria:** o endpoint provavelmente é usado hoje em teste e reinstalação.
Não é código morto para remover — é para cercar.

### 9.4 O eixo do recorte

O recorte de retenção deve ser por **classe de registro**, não por tipo de pessoa. Não por
razão jurídica, mas porque volume e utilidade diferem em ordens de grandeza:

| Classe | Volume | Consultado depois de fechado o mês |
|---|---|---|
| Log de acesso da catraca | ~90% do disco | quase nunca |
| Presença e jornada | médio | sim, por período |
| Cadastro (pessoa, turma, grade) | pequeno | sempre |

Recortar por "dados de aluno / dados de professor" apaga o cadastro — que é pequeno e útil —
e mantém o log, que é grande e frio. É o inverso do desejado.

### 9.5 Propriedades inegociáveis do expurgo

1. **Exportar → verificar lendo de volta → só então apagar.** Mesma regra que o AGENTS.md §9
   já exige para `destroy_objects`. Nunca apagar confiando que a exportação deu certo
2. **O apagamento é evento auditável** — o quê, quanto, quando, por quem
3. **Simulação obrigatória antes de executar** — *"isto vai apagar 48.312 registros de 312
   pessoas entre 2024-01 e 2024-12"*
4. **Destino do arquivo é escolha da escola** — pasta local, HD externo, ou nuvem que eles
   conectem. O sistema escreve onde mandarem e não opina
5. **Teto rígido em qualquer retenção configurável.** Um campo livre "apagar com mais de X
   meses" numa tela é como se perde uma década por erro de digitação

### 9.6 O exportador atual não serve como arquivo morto

**[FALTA]** `exportService.exportarDados` monta planilha para **reimportação**: escola,
cursos, turmas, catracas e pessoas. **Não exporta `Acesso`, `Presenca` nem a grade.**

Ou seja: exporta exatamente o que **não** precisa ser arquivado, e não exporta o que precisa.
Arquivamento exige exportador próprio.

E `.xlsx` tem teto de ~1.048.576 linhas por planilha. Anos de log de catraca de uma escola
passam disso. **Arquivo morto quer formato de dado, não de planilha.**

---

## 10. Resumo executivo

**O que está pronto e bom:** hierarquia organizacional completa, divisão A/B, tipos de
funcionário incluindo o caso PROFADM, horário fixo para admin e terceirizado, validação de
conflito de grade, e uma camada de relatórios bem mais avançada do que a documentação
sugeria.

**O que está pela metade:** presença (sem saída, mutável, granularidade errada), folha de
ponto (dados brutos existem, nada acima disso), atraso e saída antecipada (calculados em
consulta, não registrados).

**O que não existe:** bloqueio, notificação em tempo real, aprovação com autoria, liberação
em massa, exceções, tolerância de entrada, pareamento de jornada, documento de folha de
ponto, aviso a responsável.

**O que não existe e eu não sabia até o relato do dono do produto:** noção de usuário do
sistema. Uma senha para a escola inteira. Sem isso, nada "registra em nome de quem fez".

**O maior risco não é mais o hardware.** O desenho híbrido (§7.3) sobrevive à catraca não
delegar decisão — só perde a aprovação instantânea. O maior risco passou a ser a **escrita
diária da grade dentro da catraca**: roda todo dia, é a operação mais arriscada do sistema,
e um erro nela tranca a escola.

**O que mata primeiro, se ninguém olhar:** disco cheio. Não há rotação de log, não há
retenção de backup, e `Acesso` cresce para sempre. O sistema morre registrando nada e sem
avisar.

**As duas maiores alavancas:**
1. **Materializar a expectativa por slot** (§6.1) — quase tudo que falta fica fácil depois,
   e quase tudo continua difícil sem
2. **Criar a noção de usuário** (§7.4) — destrava autorização, autoria de liberação e o
   modelo de responsabilidade da folha de ponto de uma vez só
