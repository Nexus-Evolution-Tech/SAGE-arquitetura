# SAGE — Roadmap de releases

> Escrito em 2026-08-05 pelo arquiteto. **Supersede `_arquitetura/repo/docs/produto/roadmap.md`**,
> que foi escrito sobre a premissa falsa de que nada estava implementado.
>
> **Estado deste documento:** estrutural e provisório nos detalhes. A auditoria completa
> ainda não rodou. As releases organizam *estados que o sistema alcança*, e os achados da
> auditoria encaixam dentro delas — não as redesenham. Quando o inventário chegar, o que muda
> é o conteúdo dos pacotes, não a sequência.

---

## 1. O princípio que ordena tudo

Existe uma restrição que manda em todas as outras:

> **Uma visita presencial. Só uma.** O que não estiver funcionando quando você sair pela
> porta vira problema remoto — e problema remoto num sistema sem olhos é problema invisível.

Daí a regra de sequenciamento, que não é intuitiva:

**Antes da visita vem tudo que é impossível ou caro de consertar de longe.** Depois da visita
vem tudo que é interpretação de dado, porque isso se conserta remotamente sem risco.

Isso inverte a intuição normal — normalmente se entrega funcionalidade primeiro. Aqui,
entregar funcionalidade antes de ter olhos remotos significa entregar coisa que você não
consegue consertar.

**Segunda regra, herdada da decisão do dono do produto:** dado antes de controle. Nenhuma
feature é construída sobre registro que pode estar errado.

**Terceira regra:** um pacote por vez até a R4. Os pacotes iniciais mexem nas mesmas
fundações e paralelizar gera conflito garantido.

---

## 2. Mapa das releases

```
────────────────  PORTÃO  ───────────────────────────
AUD Auditoria completa                  saber o que existe de verdade
────────────────── ANTES DA VISITA ──────────────────
R0  Contenção e verdade do schema      não perde nem corrompe dado
R1  Identidade                          toda ação tem autor
R2  Distribuição e primeira execução    a secretária instala sozinha
R3  Olhos remotos                       você sabe que quebrou sem estar lá
────────────────────  VISITA  ───────────────────────
R4  Fundação do tempo                   o sistema sabe o que era esperado
R5  Interpretação                       jornada, pareamento, casos degenerados
R6  O que a secretaria pediu            folha, histórico, dashboard
R7  Ciclo de vida do dado               retenção, arquivo, expurgo
R8  Controle                            híbrido: bloqueio, aprovação, exceções
R9  Inteligência                        montagem assistida, padrões
```

**Nenhuma release depende de uma posterior.** Cada uma termina num estado que se pode
instalar e defender. Se o projeto parar em qualquer ponto, o que existe funciona.

---

## AUD — Auditoria completa `[PORTÃO — nada começa antes]`

**Objetivo:** substituir "eu li 20% do código" por um inventário verificado.

**Não é release.** Nenhum arquivo de código é modificado, nenhum PR é aberto, nenhuma issue é
criada. A saída é conhecimento.

**Por que é portão:** este roadmap foi escrito sobre dez defeitos que o arquiteto verificou
pessoalmente, em cerca de um quinto do código. Não há motivo para supor que os outros quatro
quintos sejam melhores. Começar a corrigir antes de enxergar o todo significa priorizar pelo
que é fácil e descobrir o difícil quando já não dá para reordenar.

**Executor:** Codex, seguindo `handoffs/HANDOFF-AUDITORIA.md` literalmente.

**Oito fatias:** A dados · B sincronização · C HTTP e autorização · D infraestrutura ·
E frontend · F configuração e build · G harness e simulador · H instalador Windows.

**Calibração:** os dez defeitos V1..V10 de `ESTADO-VERIFICADO.md` são gabarito, com dono por
fatia. **Não são repassados aos auditores.** Fatia que não redescobre o gabarito do próprio
território é descartada por inteiro e refeita — quem passou por cima do que sabidamente está
lá também passou por cima do que ninguém sabe.

**Entrega:** `auditoria/INVENTARIO.md` com sumário executivo, tabela mestra ordenada por risco
ao dado, separação **corrigível remotamente vs bloqueado no ambiente** (é ela que define o
plano de visita), candidatos a reescrita justificados por números, cobertura e confiança por
fatia, e achados descartados com motivo.

### Depois da auditoria — o que o arquiteto faz antes de liberar a R0

1. **Calibração** — quantos do gabarito cada fatia redescobriu
2. **Amostragem** — abrir achados e confirmar contra o código real; agente inventa com confiança
3. **Severidade** — inflada? Pior: algum que corrompe dado foi subestimado?
4. **Separação remoto vs ambiente** — define o que vai para o checklist da visita
5. **Cobertura** — o que ficou de fora e se importa
6. **Candidatos a reescrita** — o argumento se sustenta em números ou é preguiça disfarçada?
7. **Coerência** — algum achado contraria decisão tomada por motivo que o auditor não conhecia?

**Só então** os achados são distribuídos pelas releases e as issues são criadas. O mais
provável é que a R0 engorde; a sequência das releases não deve mudar.

---

## R0 — Contenção e verdade do schema

**Objetivo:** o sistema para de perder dado, para de corromper dado, e passa a ter um schema
único e conhecido.

**Por que primeiro:** tudo o mais é construído em cima disto. E há um achado que pode custar
a escola inteira num clique.

### Pacotes

**R0-01 — Cercar o `zerar-tudo` `[V8]` `[PRIMEIRO DE TUDO]`**

`POST /dispositivos/:id/zerar-tudo` executa doze `DELETE` sem `WHERE`, sem transação, sem
backup, sem confirmação e sem autoria. **Não remova o endpoint** — ele provavelmente é usado
em reinstalação. Cerque.

Critérios de aceite:
- [ ] Exige confirmação explícita com valor digitado, não booleano no corpo
- [ ] Backup gerado **e verificado por releitura** antes de qualquer `DELETE`
- [ ] Toda a operação em transação única; falha parcial não deixa estado misto
- [ ] Registra o que foi apagado, quanto, quando e por quem
- [ ] Teste: falha no meio da sequência não apaga nada
- [ ] Teste: sem backup verificado, a rota recusa executar

**R0-02 — Unificar o offset `[V1]`**

Constante em módulo único, sem default divergente. Tratar a transição: quem já está gravado
na catraca com o offset antigo continua órfão depois da unificação.

- [ ] Teste: offset é o mesmo nos três módulos, com e sem variável de ambiente
- [ ] Teste: usuário gravado com offset antigo é reconhecido ou reportado, nunca ignorado em silêncio
- [ ] Nenhum módulo lê `CATRACA_USER_ID_OFFSET` diretamente

**R0-03 — Corrigir o descarte por `MIN_LOG_ID` `[V2]`**

O filtro é global e roda antes da conversão. Foi a causa medida dos 48.057 logs.

- [ ] Marca d'água por dispositivo, não global
- [ ] Teste: log com `id` abaixo da marca de outro dispositivo não é descartado
- [ ] Teste que reproduz o cenário dos 48.057 contra o simulador
- [ ] Contador de descarte por motivo, observável

**R0-04 — Rotação e teto de log `[V10]`**

- [ ] `maxsize` e `maxFiles` configurados; teto total em disco documentado
- [ ] Teste: log excede o teto e o arquivo mais antigo é removido
- [ ] Teste: disco cheio produz erro visível, não falha silenciosa

**R0-05 — Schema único e versionado `[D4]` `[D5]`**

Hoje o schema vive em `sage.sql`, `melhorias_sistema.sql` e dez `migration_*.sql`, com
tabelas definidas em mais de um lugar. Duas instalações podem divergir.

- [ ] Um único ponto de verdade, com todas as migrations no ledger `schema_migrations`
- [ ] `HorarioAula.horario` deixa de ser `VARCHAR(11)` e vira tipo de tempo
- [ ] Teste: instalação limpa e instalação existente convergem para o mesmo schema
- [ ] Teste: `runtime-schema-gate` recusa subir com schema incompatível

**R0-06 — Barreira de expand-only no migration-runner**

O código volta em milissegundos; o schema não. Uma migration que remove coluna quebra o
rollback e derruba o sistema remotamente.

- [ ] `migration-runner` recusa migration que remove ou renomeia coluna
- [ ] CI reprova o PR que contiver `DROP COLUMN`
- [ ] Teste: migration destrutiva é rejeitada com erro claro

**R0-07 — `catch` vazio e `console.log` `[V4]` `[V5]`**

- [ ] Nenhum `catch` vazio em `src/` (verificável por lint)
- [ ] Nenhum `console.log` em `src/` (verificável por lint)
- [ ] CI reprova ambos

**Estado ao fim da R0:** o dado que entra é o dado certo, nada apaga a escola por acidente, o
disco não enche em silêncio, e existe um schema só.

---

## R1 — Identidade

**Objetivo:** toda ação do sistema tem autor identificável.

**Por que agora:** é pré-requisito de três coisas que vêm depois — a conta admin do assistente
de instalação (R2), a autoria das liberações (R8) e o modelo de responsabilidade da folha de
ponto (R6). E porque o V8 só fica realmente cercado quando "quem executou" existe.

**Escopo esclarecido:** mono-escola, multi-usuário. Cada instalação é uma escola. Não há
multi-tenant, não há escopo por unidade nas consultas.

### Pacotes

**R1-01 — Usuário do sistema `[V9]`**

Hoje o login é `UnidadeEscolar.login` + `senha` — uma credencial para a escola inteira.

- [ ] Tabela de usuário com credencial individual
- [ ] Papéis: administrador e secretaria, no mínimo
- [ ] Sessão, expiração, bloqueio por tentativa
- [ ] Desligamento de usuário que deixa a escola, preservando o histórico do que ele fez
- [ ] Migração: a credencial única existente vira a primeira conta admin
- [ ] Teste: dois usuários distintos produzem registros com autores distintos

**R1-02 — Autorização por papel `[V3]`**

Hoje `autenticar.js` valida o JWT e nada mais. Zero verificação de perfil em qualquer rota.

- [ ] Toda rota declara o papel exigido; ausência de declaração **nega** (fail-closed)
- [ ] Rotas destrutivas exigem administrador
- [ ] Teste: token de secretaria é recusado em rota de administrador
- [ ] Teste: rota nova sem declaração de papel é recusada pelo CI

**R1-03 — Trilha de auditoria de ação administrativa**

- [ ] Quem, o quê, quando, sobre qual registro, para toda operação destrutiva ou de correção
- [ ] Trilha é somente-inserção
- [ ] Teste: tentativa de alterar a trilha é rejeitada

**Estado ao fim da R1:** cada secretária entra com a própria conta, e nenhuma ação relevante
é anônima.

---

## R2 — Distribuição e primeira execução

**Objetivo:** a secretária baixa, instala e chega sozinha até "o sistema está registrando".

**Por que antes da visita:** é o que você não consegue consertar de longe. Se o instalador
falhar depois que você sair, o projeto para.

### Pacotes

**R2-01 — Assinatura de código `[FAZER HOJE, FORA DE ORDEM]`**

O `.exe` não assinado dispara o SmartScreen: *"O Windows protegeu o seu PC"*, com o botão de
prosseguir escondido atrás de "Mais informações". Uma pessoa não-técnica para ali, **e você
não fica sabendo.**

- [ ] Pedido ao SignPath Foundation submetido — leva semanas, não pode ser o gargalo do fim
- [ ] Pergunta enviada à escola: existe política de TI que bloqueia binário não assinado?
- [ ] Enquanto não houver assinatura: instrução visual explícita sobre a tela do SmartScreen

**R2-02 — Assistente de primeira execução, etapa 1**

A ordem é ditada pelas chaves estrangeiras, não é escolha: escola e conta admin → área →
catraca (varredura da rede) → curso → turma → empresa → sala → pessoas.

- [ ] Varredura automática da rede; nunca pedir IP (o `networkDiscoveryService` já existe —
      confirmar que a tela o usa)
- [ ] Cada passo salva e permite retomar; fechar o navegador não perde progresso
- [ ] Ao fim da etapa 1 a catraca conhece as pessoas e os acessos aparecem na tela
- [ ] Teste de ponta a ponta: máquina limpa até primeiro acesso registrado

**R2-03 — Importação completa, incluindo a grade**

Hoje o importador traz o "quem" e nunca o "quando": não importa `Empresa`, `Sala`, `Materia`,
`Aula`, `HorarioAula` nem `FuncionarioHorario`.

Se a grade for digitada à mão, a secretaria refaz no SAGE o trabalho que fazia no Excel — e
eliminar esse trabalho era o motivo do pedido.

- [ ] `Empresa` importada antes de `Terceirizado` (hoje entra com `empresa_id` NULL)
- [ ] Grade e horários fixos importados
- [ ] Importação é transacional (AGENTS.md §4.7); interrupção não deixa a escola pela metade
- [ ] Relatório de importação por linha, com erro acionável
- [ ] **Pré-requisito:** obter a planilha real de horários da escola antes de especificar

**R2-04 — Assistente etapa 2, remota**

Matérias, aulas, grade e horários fixos. Feita pela secretaria, sem você presente, ao longo
de dias. Entre a etapa 1 e a 2 o sistema **já entrega valor** — registro bruto de quem entrou
e saiu, que é mais do que ela tem hoje.

**Estado ao fim da R2:** o instalador roda em máquina desconhecida e a secretária chega
sozinha ao primeiro acesso registrado.

---

## R3 — Olhos remotos

**Objetivo:** você descobre que quebrou sem que ninguém te avise.

**Por que antes da visita:** sair da escola sem isto é ficar cego. O modo de falha mais grave
deste projeto é o sistema estar "no ar" e não registrar nada — e ninguém percebe até faltarem
três semanas num relatório.

**Princípio:** nada entra, tudo sai. A escola não hospeda nada, não tem domínio, não configura
nada. A máquina faz HTTPS de saída na 443 para um endereço seu.

**ADR-0012 vale inteiro:** telemetria nunca é requisito. Sem internet, a catraca ainda gira e
o SAGE ainda registra.

### Pacotes

**R3-01 — Redação de PII `[V6]` `[PORTÃO DE TUDO NESTA RELEASE]`**

`src/config/redact.js` não existe — o `AGENTS.md` afirmava que existia. Nada sai antes disto.

Não é exigência legal: **é que o canal é seu e você não quer receber dado de aluno sem ter
pedido.** Nome aparece em mensagem de erro do MySQL, em caminho de foto, em payload de
requisição. Filtro por campo não pega tudo.

- [ ] Teste adversarial: CPF, RG, e-mail, nome e JWT sintéticos reprovam o build se vazarem
- [ ] Cobre log, telemetria, mensagem de erro e bundle
- [ ] Nenhum canal de saída existe antes deste pacote passar

**R3-02 — Heartbeat**

- [ ] Sinal periódico de saída; ausência do sinal alerta você em minutos
- [ ] Cobre os três estados: processo vivo, banco acessível, catraca respondendo
- [ ] Falta de internet não afeta o funcionamento local

**R3-03 — Erro com contexto**

- [ ] Erro sai redigido, com código estável e identificador de ocorrência
- [ ] **Decisão pendente:** endpoint próprio ou serviço de terceiro. Recomendo endpoint
      próprio — menos risco de receber o que não pediu, ao custo de infra sua para manter

**R3-04 — Código de erro e indicador legível**

- [ ] Catálogo de códigos estáveis (`CAT-CONN-03`) e identificador de ocorrência na tela
- [ ] Indicador que uma secretária entende: "não estou registrando", não "ERR 500"

**R3-05 — Support bundle**

- [ ] Determinístico, com manifesto, redigido, gerado por um clique
- [ ] Contém o suficiente para reproduzir no ambiente de simulação

**Estado ao fim da R3:** você pode sair da escola e continuar enxergando.

---

## ▶ A VISITA

Não é release. É coleta do que não se obtém remotamente. Detalhe em
`docs/operacao/runbooks/visita-presencial.md`.

O de maior valor e menor custo: **rodar o Wireshark enquanto usa o software oficial da
Control iD.** Cinco minutos lá, impossível daqui, e cada resposta capturada vira fixture
permanente.

Medir, além do que o runbook já lista:
- [ ] Tempo do MySQL do boot até aceitar conexão **naquele HD** → calibra `SAGE_BOOT_GRACE_MS`
- [ ] Tempo real do `destroy_objects` → calibra `CATRACA_ZERAR_LOGS_TIMEOUT_MS`
- [ ] **A catraca aceita ordem de liberar uma passagem específica sob demanda?** Decide se a
      aprovação da R8 é instantânea ou vale para o próximo giro
- [ ] **Quantos grupos e faixas de horário a catraca comporta?** O desenho híbrido pressupõe
      que cabe a escola inteira. Se houver teto baixo, a R8 muda
- [ ] Política de TI bloqueia binário não assinado?
- [ ] A saída HTTPS passa? Há proxy?

---

## R4 — Fundação do tempo

**Objetivo:** o sistema sabe o que era esperado de cada pessoa, e registra o que aconteceu de
forma imutável.

**Por que é a maior alavanca:** quase tudo que falta fica fácil depois disto, e quase tudo
continua difícil sem.

### Pacotes

**R4-01 — Expectativa materializada por slot**

Hoje a expectativa é recalculada a cada requisição de relatório, por seis funções auxiliares.
E a unidade é o dia — mas as regras de negócio são por aula: *"só conta se ele saiu tendo aula
no nome dele naquele horário"*.

Proposta: a expectativa de cada pessoa em cada dia é uma lista de slots (pessoa × data ×
faixa × origem), derivada da grade para aluno e professor, e de `FuncionarioHorario` para
administrativo e terceirizado.

O que destrava de graça:
- professor que sai e volta entre aulas → não há falta, porque não há slot descoberto
- aluno com janela no meio do dia → mesmo tratamento, sem regra especial
- "faltou na terceira aula" → pergunta respondível, hoje impossível
- relatório vira leitura de tabela em vez de recomputação

- [ ] Teste: professor com janela entre aulas não gera falta ao sair e voltar
- [ ] Teste: alteração da grade recompõe os slots futuros e **não** altera os passados
- [ ] Teste: 500 pessoas × 200 dias letivos gera slots em tempo aceitável

**R4-02 — Registro de presença imutável `[V7]`**

ADR-0007: registro imutável, correção sempre em novo registro apontando para o anterior.

- [ ] `UPDATE` e `DELETE` rejeitados no nível do banco
- [ ] Correção cria novo registro; view retorna a versão vigente
- [ ] Correção sem justificativa é rejeitada
- [ ] Consulta de 12 meses de uma pessoa responde em < 500 ms com 500 mil registros

**R4-03 — Tolerância e horário de funcionamento**

Granularidade **global**, em `ConfigSistema` — decisão do dono do produto. Cadastro por turma
seria trabalho repetitivo, e trabalho repetitivo é do que a secretaria reclamou.

- [ ] Abertura, fechamento e tolerância de atraso configuráveis
- [ ] Gancho para refinar por turno depois, sem migração

**Estado ao fim da R4:** existe uma verdade sobre o que deveria ter acontecido, e um registro
inalterável do que aconteceu.

---

## R5 — Interpretação

**Objetivo:** eventos brutos viram jornadas confiáveis.

**Aviso do roadmap anterior, que mantenho:** este é o pacote que mais gera bug em sistema de
presença. O mundo real não coopera.

### Pacotes

**R5-01 — Pareamento entrada/saída**

Casos degenerados explícitos: entrada sem saída, saída sem entrada, entrada duplicada, saída
duplicada, intervalo implausível.

**Nunca inventa dado.** Órfão vira pendência para a secretaria resolver — jamais horário
estimado. Isto alimenta folha de ponto.

- [ ] Teste para cada um dos cinco casos degenerados
- [ ] Teste: nenhum horário é inventado ou estimado em nenhum caminho
- [ ] Teste: dia com 200 pessoas e 600 eventos pareado em < 2 s
- [ ] Pendências aparecem com contagem visível

**R5-02 — Exceção como entidade, face de dado**

A tabela inteira nasce aqui; só a face de dado é ligada. A face de controle acende na R8, sem
migração.

Sem isto, a folha de presença acusa 30 faltas no dia do passeio e a secretaria corrige 30
linhas à mão — o trabalho repetitivo que motivou o pedido.

- [ ] `Excecao(escopo, alvo, efeito, janela, criada_por, motivo)`
- [ ] Escopo: pessoa, turma, todos
- [ ] Teste: turma em passeio não gera falta

**R5-03 — Relatórios reconstruídos sobre a nova base**

`relatorioController` já entrega resumo, detalhes e histórico por pessoa. Reapontar para
slots e registro imutável.

- [ ] Paridade com o comportamento atual, provada por teste
- [ ] Filtros por dia, semana, mês, período personalizado, ano
- [ ] Faltantes, atrasados, saídas antecipadas, faixa de horário

---

## R6 — O que a secretaria pediu

**Objetivo:** as entregas que ela usa no mesmo dia.

- **R6-01 — Folha de presença de alunos.** Presença por aula cruzando slot com grade.
- **R6-02 — Folha de ponto.** Atestação com humano no circuito: o sistema propõe, a
  secretaria confirma, a responsabilidade é dela.
  - Pendência de pareamento **bloqueia** o fechamento
  - Período fechado é imutável; reabertura exige justificativa e fica registrada
  - `.docx` é gerado **a partir** do período fechado, nunca é a planilha de trabalho
  - Marca d'água "RASCUNHO — NÃO CONFIRMADO" antes do fechamento
  - **Não implementar cálculo de saldo legal.** Banco de horas e hora extra têm regra
    trabalhista e convenção coletiva. Entregue registro fiel e totais brutos
  - Confirmar antes: formato obrigatório do Centro Paula Souza, se o funcionário assina,
    ciclo de fechamento
- **R6-03 — Histórico da pessoa.** Todos os dias, filtrável, ordenável, exportável.
- **R6-04 — Dashboard.** Cada número clicável leva à lista que o originou.

---

## R7 — Ciclo de vida do dado

**Objetivo:** o sistema roda por anos sem encher o disco e sem intervenção sua.

**Enquadramento decidido:** o SAGE entrega **mecanismo**, a escola define **política**. As
travas são contra acidente.

- [ ] Recorte por **classe de registro**, não por tipo de pessoa (log de catraca é ~90% do
      volume e o menos consultado; recortar por "aluno/professor" apaga o cadastro e mantém o lixo)
- [ ] Exportador de arquivo morto próprio — `exportarDados` exporta o que não precisa
      arquivar e ignora `Acesso`, `Presenca` e a grade. E `.xlsx` tem teto de ~1.048.576 linhas
- [ ] Exportar → **verificar lendo de volta** → só então apagar
- [ ] Simulação obrigatória: *"isto vai apagar 48.312 registros de 312 pessoas"*
- [ ] Apagamento é evento auditável
- [ ] Teto rígido em qualquer retenção configurável
- [ ] Destino escolhido pela escola: pasta local, HD externo, ou nuvem que eles conectem
- [ ] `Aluno.status` como chave do ciclo de vida — já existe

---

## R8 — Controle

**Objetivo:** a metade do produto que motivou o pedido da escola.

**Não comece sem os fatos da visita.**

### O desenho híbrido

> O SAGE é a fonte da verdade da política. A catraca carrega uma projeção dela, válida para o
> dia. O tempo real é acréscimo sobre a base, não a base.

| Estado | Controle predefinido | Controle personalizado | Monitoramento |
|---|---|---|---|
| SAGE no ar | funciona | funciona | funciona |
| SAGE fora | **funciona** | nega | acumula, sincroniza depois |

- **R8-00 — ADR que supersede o 0008.** A decisão nova é replicação de política com fonte
  única, não exclusividade. Escrever antes de qualquer código.
- **R8-01 — Escrita diária da grade na catraca.** **A operação mais arriscada do sistema.**
  Roda todo dia; um erro tranca a escola. Idempotência (AGENTS.md §4.5) e reconciliação
  (ADR-0009) valem inteiras. Precisa de plano de rollback próprio: falha no meio deixa a
  catraca em estado misto, que é pior que falhar inteiro.
- **R8-02 — Bloqueio e notificação em tempo real.** Fora do ar = bloqueado. Nunca o contrário.
- **R8-03 — Aprovação com autoria.** Depende da R1. Registra quem liberou e por quê.
- **R8-04 — Liberação em massa.** Face de controle da `Excecao` da R5-02. Liberar uma turma é
  **um registro**, não trezentas operações.
- **R8-05 — Visitantes e exceções programadas.** Mesma entidade, outros escopos.
- **R8-06 — A decisão carrega o porquê.** *"Aluno da turma 1B, aula até 15:30, tentou sair às
  14:12. Nenhuma exceção vigente."* **É isto que separa o SAGE do sistema genérico que a
  escola achou complicado demais.** O genérico diz "negado". O SAGE diz por quê e mostra o
  botão que resolve.

---

## R9 — Inteligência

- **R9-01 — Montagem assistida de grade.** A validação de conflito já existe e está correta
  (`horarioAulaController.js:48`). O caminho realista: sugestão de encaixe → preenchimento
  assistido com aceite humano → só então, se ainda fizer sentido, otimização automática.
  Grade escolar completa é problema NP-difícil com décadas de literatura. Os dois primeiros
  passos entregam quase todo o valor por uma fração do custo; o último pode nunca ser preciso.
- **R9-02 — Exportação da grade** para impressão e distribuição aos alunos.
- **R9-03 — Detecção de padrão.** *"Esse funcionário atrasa toda sexta."* Mostre o dado e
  deixe a conclusão para o humano. Nada de pontuação automática de pessoas.

---

## 3. Invariantes — valem em toda release

Quebrar qualquer uma reprova o PR, mesmo com a funcionalidade perfeita.

1. **Nunca invente dado.** Lacuna vira pendência para humano
2. **Nunca engula erro.** Falha parcial é falha, nunca sucesso com aviso
3. **Nunca dado pessoal em log, issue, PR ou commit**
4. **Escrita na catraca é idempotente**
5. **Decisão de segurança falha fechada.** Configuração ausente nega
6. **Escrita multi-passo usa transação**
7. **O atualizador nunca toca em `dados/`**
8. **Correção de bug exige teste que falha antes e passa depois**
9. **Operação irreversível exige backup verificado por releitura antes**
10. **Migrations só expandem**

---

## 4. Disciplina de entrega

- Uma issue por pacote, uma branch por issue, um PR por branch
- **PR ≤ ~300 linhas.** Se o pacote estoura, quebre o pacote
- Um pacote por vez até a R4
- Cada release termina em estado instalável e defensável
- Versionamento: release fechada vira tag; o instalador só distribui tag

---

## 5. Onde isto pode dar errado

- **A auditoria não rodou.** Este roadmap foi escrito sobre dez defeitos que eu verifiquei
  pessoalmente e sobre ~20% do código revisado. Os 80% restantes podem conter algo que
  reordene as releases — mais provavelmente algo que **engorde** a R0.
- **R2 depende da R0 ter funcionado.** A etapa 1 do assistente sincroniza pessoas para a
  catraca — exatamente a área do V1 e do V2. Se não estiverem corrigidos, o assistente falha
  no lugar onde você não pode falhar.
- **R8-01 é o maior risco técnico do projeto** e eu não sei se é viável. Depende de a catraca
  comportar a escola inteira em grupos e faixas de horário. Se houver teto baixo, o desenho
  híbrido inteiro precisa ser repensado — e isso só se descobre na visita.
- **A R4 pode ser mais cara do que parece.** Materializar slot para uma escola inteira, com
  recomposição quando a grade muda, sem alterar o passado, é a parte mais sutil do sistema.
  É onde eu colocaria mais tempo de especificação antes de uma linha de código.
- **Não li o frontend.** Todo o assistente da R2 e todo o dashboard da R6 são interface, e eu
  não olhei uma linha. Essas estimativas são as mais frágeis do documento.
- **A planilha de horários pode inviabilizar a R2-03.** Se o Excel dela for layout visual —
  turmas em colunas, células mescladas — importar é muito mais difícil que ler abas. Preciso
  ver o arquivo real antes de tratar esse pacote como especificado.
- **A ordem "olhos antes da visita" custa tempo antes de entregar valor visível.** A escola vai
  esperar mais para ver funcionalidade. É a decisão certa, mas tem custo político com o cliente.
