# Bastão do Engenheiro Pleno — SAGE

> Escrito em 2026-08-13 pelo arquiteto, para o Engenheiro Pleno que assume a condução da
> implementação. **Leia inteiro antes de fazer qualquer coisa.** Depois `git pull` neste
> repo sempre que voltar — este arquivo e o plano são os únicos que você pode assumir como
> atuais.

---

## 1. Quem é quem agora

A cadeia mudou. São três, não dois:

| Papel | Quem/onde | Faz |
|---|---|---|
| **Arquiteto** (Claude Opus) | macOS, canvas Maestri | Plano, spec, ADR. **Só é chamado no fim de cada release, para validar.** Não conduz o dia a dia |
| **Engenheiro Pleno** (você) | macOS, `~/Projetos/SAGE-WS` | **Conduz a implementação inteira até o fim.** Recorta pacotes, despacha, revisa, aprova, avança |
| **Agente de codificação** (Codex) | Windows `DESKTOP-G2QN9AT`, `C:\SAGE-WS` | Escreve código, teste e PR. Não decide arquitetura |

**Você não escreve código de produção.** Você dirige quem escreve, e responde pela qualidade
do que entra. O Caio te chamou de "pleno que guia o agente de codificação" — é exatamente isso.

---

## 2. O ciclo de trabalho — foi o Caio quem definiu, siga literal

Para cada pacote, na ordem:

1. **Despache um pacote, e só um.** Issue no GitHub com escopo fechado + prompt de entrada
   no agente de codificação apontando para ela.
2. **Suma enquanto ele trabalha.** Não acompanhe, não comente progresso. Ele te chama quando
   termina ou quando trava.
3. **Revise quando ele entregar.** Pelo conteúdo, nunca pelo relato — §6 deste documento.
4. **Se estiver certo:** aprove, faça o merge entrar, e **limpe o contexto dele com `/new`**.
5. **Mande a próxima tarefa.** O prompt de entrada tem que se sustentar sozinho, porque o
   contexto anterior não existe mais.
6. **Repita até o fim da implementação.**

**`/new`, nunca `/clear`.** No Codex CLI, `/clear` cai no menu `/model` e um Enter distraído
troca o modelo. Já aconteceu — foi assim que ele saiu de `medium` para `high` sem ninguém
mandar.

**Quando me chamar (o arquiteto):**
- Ao fim de cada release (R1 inteira, depois R2 inteira...), para validação final
- Quando faltar spec para um pacote — escrever spec é meu trabalho, não seu
- Quando o agente de codificação abrir questão que muda desenho, não só escopo
- Quando você discordar do plano com base em fato do código

Fora disso, conduza. Não me peça permissão para o que já está especificado.

---

## 3. O que é o SAGE, em cinco linhas

Presença e controle de acesso para a ETEC de Taboão da Serra. Catraca Control iD, PC Windows
on-premise dentro da escola, na rede da escola, desligado toda noite. **Uma visita presencial
só** — o que quebrar depois quebra remotamente, sem ninguém técnico no local. Isso explica
quase toda decisão de arquitetura do repositório.

**O achado que define o produto:** o SAGE hoje é um *observador*, não um *controlador*. O
botão "Liberar acesso" só muda a tela — não fala com a catraca. Metade do que a escola pediu
não existe. Isso é a R8, lá na frente.

---

## 4. Onde está cada coisa

Repo privado `Nexus-Evolution-Tech/SAGE-arquitetura`, clonado em
`~/Projetos/SAGE-WS/_arquitetura`:

| O quê | Onde |
|---|---|
| **O plano que manda na execução** | `PLANO-POS-AUDITORIA.md` (381 linhas) |
| Ordem das releases R0–R9 | `ROADMAP-RELEASES.md` (586 linhas) |
| **Spec obrigatória da R1** | `specs/R1-usuarios-e-autorizacao.md` (251 linhas) |
| Estado verificado do código | `ESTADO-VERIFICADO.md` |
| Modelo de domínio | `DOMINIO-E-LACUNAS.md` |
| Auditoria 1 (99 achados) e 2 (92 achados) | `auditoria/` e `auditoria/segunda-auditoria/` |
| ADRs — inclusive 0011 (expand-only) e 0014 | `repo/docs/adr/` |
| Regras para agentes de código | `repo/AGENTS.md` — **espelhado na raiz do SAGE-API** |

Repos de código: `Nexus-Evolution-Tech/SAGE-API` (backend) e `SAGE` (frontend). **Ambos
públicos** — ver §8.

---

## 5. Estado verificado neste momento (2026-08-13)

**R0 fechada e integrada.** `origin/wip/recuperacao-local-pre-auditoria` está em `c562f82` e
contém R-LAB + R0-01 a R0-07 + o job de CI Windows. Verifiquei pelo conteúdo, não pelo estado
dos PRs: `ci.yml:138` tem `runs-on: windows-latest`, `scripts/check-source-observability.js`
e os dois testes existem, `AGENTS.md` está na raiz. Nove PRs fechados, oito issues fechadas,
nenhum PR aberto.

`git diff --stat origin/wip/... origin/fix/32-rotacao-logs` sai com **só** `AGENTS.md` e
`CLAUDE.md` — que existem na `wip` e não na `fix/32`. Isso está **correto**. Não mexa na
`fix/32`.

**R1 começou. Pacote R1-01 despachado — issue #43 do SAGE-API — e está PARADO numa questão
de decisão legítima.** A §7 diz o que fazer.

## 5-bis. Atualização documental verificada (2026-08-26)

O achado de `Adicionar.js` que inventava foto foi corrigido no SAGE pelo commit
[`a342781`](https://github.com/Nexus-Evolution-Tech/SAGE/commit/a3427814dced2bdc560b97c89c970a17f7094eca),
integrado na branch `wip/recuperacao-local-pre-auditoria` pelo merge
[`2e18e95`](https://github.com/Nexus-Evolution-Tech/SAGE/commit/2e18e95f6097dbae20c494f9a94164f63d4bfa97).
O teste é `src/components/pages/Adicionar/Adicionar.contract.test.js`; o CI remoto
[`33012409366`](https://github.com/Nexus-Evolution-Tech/SAGE/actions/runs/33012409366) terminou verde,
com suíte final de 18 suítes/57 testes e build compilado no Windows.

R1-02, R1-03, R1-04, R1-05 e R1-07 possuem os commits e testes já auditados. Isto registra o
estado dos pacotes, sem declarar a R1 inteira ou o produto terminados antes da validação final.

O `AGENTS.md` de `_arquitetura/repo` já foi atualizado no commit
[`1e43eeb`](https://github.com/Nexus-Evolution-Tech/SAGE-arquitetura/commit/1e43eebb8045b92031575d28cd58fd48878071d7),
e o espelho em `SAGE-API/AGENTS.md` já existe no commit
[`25826bd`](https://github.com/Nexus-Evolution-Tech/SAGE-API/commit/25826bd5afaf9b08eb3033f41a767965960bb70c).
Não reescreva `AGENTS.md` neste pacote.

Pendências: **#93** (duplicação de Sala) permanece aberta; **#96** (política/matriz de
`qr_code`/`cartao_rfid`) permanece aberta. A decisão arquitetural consultada é provisória:
manter os campos em fluxos autorizados, sem restrição global a `ADMIN`, até haver matriz
explícita, testes e documentação. **#47** permanece como smoke/ACL Windows a acompanhar; CI
verde não equivale à resolução do problema ambiental.

Candidatos a fechamento, somente com a evidência já comprovada: **#62/#69/#72/#75/#77/#87/#92/#94/#101
e #67**. Nenhuma issue GitHub é fechada por este pacote.

### Atualização específica da issue #2 — R1-06 reconciliada com R1-05F (2026-08-26)

A fonte normativa é `specs/R1-05-fronteira-e-falha-fechada.md` §3.7. Por decisão do Arquiteto,
R1-06 é o recorte adicional de fechamento e rastreabilidade do contrato funcional já entregue
como R1-05F. **R1-06 está fechado documentalmente via R1-05F** porque todos os critérios têm
teste nomeado e CI identificável; isto não fecha a issue, a R1 inteira ou o produto.

As entregas são API [issue #119](https://github.com/Nexus-Evolution-Tech/SAGE-API/issues/119) /
[PR #120](https://github.com/Nexus-Evolution-Tech/SAGE-API/pull/120), merge `b181b704`; frontend
[issue #22](https://github.com/Nexus-Evolution-Tech/SAGE/issues/22) / [PR #23](https://github.com/Nexus-Evolution-Tech/SAGE/pull/23),
merge `1bd694d`, e [PR #25](https://github.com/Nexus-Evolution-Tech/SAGE/pull/25), merge `76f5beb`;
e API R1-05E [PR #118](https://github.com/Nexus-Evolution-Tech/SAGE-API/pull/118), merge `31774dab`.

| Critério | Prova nominal | Execução remota verificada |
|---|---|---|
| `subscribe:*`, allowlist e sem `join`; sala não autorizada/evento fora da lista | API [`test/r1-05e-websocket.test.js`](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/31774dab222a99c566fdb8d58489a48e3b73ed4a/test/r1-05e-websocket.test.js#L61-L80) e [barreira](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/31774dab222a99c566fdb8d58489a48e3b73ed4a/test/r1-05e-websocket.test.js#L109-L117), teste real atrás do proxy [`ci/r1-05f-websocket-proxy.test.js`](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/ci/r1-05f-websocket-proxy.test.js#L147-L162); frontend [`useWebSocket.test.js`](https://github.com/Nexus-Evolution-Tech/SAGE/blob/1bd694dc23eeb17bb0abcb75a7b78a051d084881/src/hooks/useWebSocket.test.js#L45-L66) | [API #120 Ubuntu](https://github.com/Nexus-Evolution-Tech/SAGE-API/actions/runs/32056237263/job/95473036185) e [Windows](https://github.com/Nexus-Evolution-Tech/SAGE-API/actions/runs/32056237263/job/95473075534), 4/4 cada; [frontend CI](https://github.com/Nexus-Evolution-Tech/SAGE/actions/runs/33012672908/job/98322718912) passou a suíte |
| same-origin; `REACT_APP_SOCKET_PATH` `/socket.io`/`/backend/socket.io` | [`WebSocketContext.js`](https://github.com/Nexus-Evolution-Tech/SAGE/blob/76f5beb131de3561407979643482a34e781f5684/src/contexts/WebSocketContext.js#L61-L85) e [`WebSocketContext.test.js`](https://github.com/Nexus-Evolution-Tech/SAGE/blob/76f5beb131de3561407979643482a34e781f5684/src/contexts/WebSocketContext.test.js#L56-L89) | frontend CI acima + os dois jobs API #120 com path correto atrás do proxy |
| `Infinity`, erro persistente e recuperação após queda | testes `mantem o erro visivel...`/`reconecta sem recarregar...` no [`WebSocketContext.test.js`](https://github.com/Nexus-Evolution-Tech/SAGE/blob/76f5beb131de3561407979643482a34e781f5684/src/contexts/WebSocketContext.test.js#L93-L131); cliente real no teste API [L165-L185](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/ci/r1-05f-websocket-proxy.test.js#L165-L185) | frontend CI registrou `WebSocketContext.test.js`/`useWebSocket.test.js` como PASS; API #120 passou nos dois runners |
| proxy Node com rewrite/upgrade e guarda separada do nginx | [`iniciarProxy`/`reescrever`](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/ci/r1-05f-websocket-proxy.test.js#L47-L80), guarda [L188-L197](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/ci/r1-05f-websocket-proxy.test.js#L188-L197) e job explícito [`ci.yml`](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/b181b704328349293267c4ff4158e2546e03272f/.github/workflows/ci.yml#L199-L237) | API #120: 1 arquivo/4 testes passados em Ubuntu e Windows |
| path errado e auth/ACL de R1-05E | `falha de forma visível quando o path não é o contrato` no teste API; `SECRETARIA` recusada em `sync`; R1-05E [`31774dab`](https://github.com/Nexus-Evolution-Tech/SAGE-API/commit/31774dab222a99c566fdb8d58489a48e3b73ed4a) com [`test/r1-05e-websocket.test.js`](https://github.com/Nexus-Evolution-Tech/SAGE-API/blob/31774dab222a99c566fdb8d58489a48e3b73ed4a/test/r1-05e-websocket.test.js#L53-L80) | [CI #118](https://github.com/Nexus-Evolution-Tech/SAGE-API/actions/runs/32050974301/job/95449990404) registrou 8/8; #120 registrou os negativos e a recuperação |

**Limitações que devem acompanhar o handoff:** a guarda do nginx é textual, não execução do
nginx; os testes unitários do frontend mockam Socket.IO, enquanto a prova de transporte é o
cliente real no teste da API; não há E2E de navegador. Os PRs frontend #23 (`1bd694d`) e #25
(`76f5beb`) não tinham check remoto próprio no merge; a prova posterior é o [Frontend CI no
descendente `2e18e95`](https://github.com/Nexus-Evolution-Tech/SAGE/actions/runs/33012672908/job/98322718912),
com 18 suítes/57 testes e build verde. #93, #96 e #47 permanecem pendentes; nenhuma issue é
fechada por este pacote.

---

## 6. Como revisar — a regra que mais custou caro aqui

**Nunca aceite relato de agente sem verificar.** O agente de codificação já disse:

- "PR isolado" — para um PR de 50 arquivos
- "os jobs estão executando" — para dois jobs que já tinham terminado vermelhos
- "estado final real" — para uma integração que não integrou

**As três eram checáveis em um comando.** Ele não mente por má-fé; ele reporta o que espera
que tenha acontecido. Seu trabalho é a diferença entre esperado e real.

**PR fechado não prova conteúdo integrado.** Verifique a branch de destino pelo conteúdo:

```bash
cd ~/Projetos/SAGE-WS/SAGE-API
git fetch origin
git log --oneline -1 origin/wip/recuperacao-local-pre-auditoria
git diff --stat origin/wip/recuperacao-local-pre-auditoria origin/<branch-do-pacote>
git ls-tree -r --name-only origin/wip/recuperacao-local-pre-auditoria | grep -E "<arquivos que a spec exige>"
gh run list --branch <branch> --limit 5          # os dois jobs, ubuntu E windows-latest
gh run view <id> --log-failed
```

Checklist de revisão de pacote:

- [ ] Os arquivos que a spec exige existem na branch de destino, pelo `ls-tree`
- [ ] O CI está verde **nos dois jobs**, pelo log, não pelo relato
- [ ] Cada critério de aceite tem teste que **falha antes** e passa depois
- [ ] O diff não passou de ~300 linhas; se passou, foi porque você autorizou
- [ ] Nada fora do escopo do pacote entrou junto
- [ ] Nenhum teste foi deletado, pulado ou afrouxado para passar

**Três commits seguidos afrouxando o mesmo teste** significa que o desenho do teste está
errado, não que o limite está apertado. Separe mecanismo de configuração.

**Peça o conserto no pacote dono do código.** Eu pedi correção de um teste de rotação durante
a revisão do PR de CI; ele obedeceu, e o conserto ficou no pacote errado — PR de CI verde e
pacote dono vermelho. Erro meu de direção, não repita.

---

## 7. A questão aberta agora — e a resolução

O agente de codificação parou no R1-01 e perguntou, com razão: a issue #43 manda implementar
só a noção de usuário, mas o prompt manda "ler a spec inteira, ela manda mais que a issue" — e
a spec inclui autorização por papel (§4) e trilha de auditoria (§3/§7). Ele se recusou a
escolher sozinho o que ignorar. **Comportamento correto. Elogie e destrave assim:**

> **A spec é o contrato da RELEASE. A issue é o recorte do PACOTE.**
> Onde divergirem em **escopo** (o que construir agora), manda a **issue**.
> Onde divergirem em **desenho** (como construir), manda a **spec**.
> A spec inteira é leitura obrigatória para você não desenhar contra o que vem depois — não
> para você construir tudo de uma vez.

Coloque esse parágrafo em **todo** prompt de pacote da R1, senão a pergunta se repete a cada
despacho.

---

## 8. A R1 — corte em sete pacotes

A R1 do plano é grande demais para um PR: tem a spec, **mais** 13 itens de auditoria, **mais**
frontend, **mais** realtime. Cortei assim. **Um pacote por vez, PR direto na `wip`, merge
antes do próximo. Sem pilha de PRs** — foi a pilha que quebrou na R0.

| # | Pacote | Fonte | Spec? |
|---|---|---|---|
| R1-01 | Usuário e sessão | spec §2.1, §2.3, §2.4, §3, §5, §6 | ✅ issue #43, **parada** |
| R1-02 | Autorização por papel, `exige()`/`publica()` fail-closed, barreira de CI, mata superfície duplicada `[V3][V11][V12]` | spec §4 | ✅ auditado |
| R1-03 | Trilha de auditoria somente-inserção | spec §3, §7 | ✅ auditado |
| R1-04 | Vazamento em resposta e log `[C-001][C-016][C-017][A-002][A-001][C-019][+2A-C10]` | plano R1 | ✅ auditado |
| R1-05 | Superfície que só fecha com auth: uploads, WebSocket, diagnóstico, callback do monitor, rate limit de login `[C-006][C-008][C-009][C-013][C-014][C-015]` | plano R1 | ✅ auditado |
| R1-06 | Contrato de realtime cliente↔servidor `[+2A-E05/E07/E08]` | `specs/R1-05-fronteira-e-falha-fechada.md` §3.7 | ✅ **fechado via R1-05F; reconciliação documental** |
| R1-07 | Frontend: 403 sem deslogar, ocultar ação de admin, troca de senha no 1º login, fallback neutro `[E-003..E-007][+2A-E20]` — **repo `SAGE`** | plano R1 | ✅ auditado |

> Os parágrafos narrativos abaixo preservam a fotografia histórica de 2026-08-13. Para o estado
> posterior, prevalecem a tabela acima e a atualização específica da issue #2; o antigo marcador
> de R1-06 como pendente fica supersedido por essa reconciliação, sem fechar a R1 inteira.

**Os pacotes 04 a 07 não têm spec — só bullets no plano.** Não os despache assim: o agente de
codificação acabaria decidindo arquitetura, que é o que o contrato proíbe. **Me chame quando
chegar no 04** e eu escrevo as specs.

O R1-02 é o que mais escorrega: são 100+ rotas para classificar e a §4.3 da spec é uma regra,
não uma lista. Nos casos de fronteira a instrução é abrir issue de decisão e parar — reforce
isso no prompt, porque agente sob pressão de terminar decide sozinho.

O R1-07 é no outro repo e **nenhuma das 21 telas trata 403 hoje**. Se o R1-02 subir e o R1-07
demorar, a interface quebra de formas estranhas. Eles precisam andar próximos.

---

## 9. O canal entre as máquinas, e as armadilhas

**GitHub é o único canal entre você e o agente de codificação.** Ele está no Windows e não
enxerga seu disco. O Caio foi explícito:

> "se voce mexe aqui tem que subir no github e descer la, se nao fica cada um fazendo
> individual e ninguem faz nada direito"

Editou documento? `commit` + `push`, e faça ele dar `pull`. Documento que só existe no seu
disco **não existe** para ele.

**Como falar com ele:**

```bash
maestri check "Agente de codificacao"              # ler o terminal
maestri ask "Agente de codificacao" --raw "texto"  # COLAR (não envia!)
maestri ask "Agente de codificacao" --raw "\n"     # ENVIAR, comando separado
```

⚠️ **`--raw` cola sem enviar.** Antes de mandar o `\n`, rode `maestri check` e confirme duas
coisas: que apareceu `[Pasted Content N chars]`, e que o terminal está no **Codex**, não num
shell. O arquiteto anterior já mandou 2.300 caracteres de instrução para um prompt de zsh por
não checar. Confira o `N` contra o tamanho real do seu texto — foi assim que confirmei que o
despacho do R1-01 chegou íntegro (1197 chars contra 1198 bytes).

**Repositório certo no Windows:** `C:\SAGE-WS\SAGE-API`. Existe um clone velho em
`C:\Users\Admin\Documents\Projects\SAGE-API` que nem conhece as branches atuais — **não é
aquele.** Todo prompt de entrada deve dizer isso, porque depois do `/new` ele não lembra.

**Registro histórico de 2026-08-13, superado em 2026-08-26:** este bastão dizia que o
`AGENTS.md` §0 descrevia a topologia antiga de duas máquinas e pedia sua atualização e o
espelhamento na raiz do SAGE-API. `_arquitetura/repo/AGENTS.md` já está atualizado (commit
`1e43eeb`) e o espelho em `SAGE-API/AGENTS.md` já existe (commit `25826bd`). Não reescreva
`AGENTS.md` neste pacote.

---

## 10. Bloqueios que não são técnicos, e são do Caio

1. **Os dois repos de código estão PÚBLICOS**, com `pessoas_etec.sql`, `dados_etec_taboao.sql`
   e `PlanilhaPessoas.xlsx` no histórico. Incidente em curso. O Caio é `member` da org; só
   `igorfcfs` (único owner) pode tornar privado. **A R1 adiciona hash de senha e esquema de
   usuários — nasce exposto enquanto isso não fechar.**
2. **A limpeza de histórico reescreve commits** e orfaniza tudo que estiver aberto na hora.
   Foi por isso que a pilha de PRs da R0 foi colapsada. Confira cópias locais antes de
   qualquer reescrita.
3. **Node no PC do agente de codificação é 18.16.1**; o R-LAB e o CI pedem 24. Ambiente de dev
   mais permissivo que o de verificação — inversão perigosa, e a R1 mexe em bcrypt e JWT,
   justamente onde diferença de runtime aparece tarde.
4. **A visita presencial não foi agendada, e não deve ser** até R0/R1 fecharem.
   `auditoria/INVENTARIO.md` §4 tem as 14 perguntas exatas de campo.

---

## 11. Contrato de comportamento

O Caio cobra isto, está no `~/.claude/CLAUDE.md` dele:

- **Par técnico, não torcida.** Se há abordagem melhor que a pedida, diga primeiro, com o
  porquê. Crítica ancorada em fato técnico e na spec.
- **Toda proposta de plano ou decisão termina com `### Onde isto pode dar errado`.** Sem isso
  a resposta está incompleta, e ele nota a ausência.
- **Conversa longa não é acordo.** Não convirja por insistência; reancore no fato e na spec.
- Ele decidiu contra você? É decisão dele. Registre a discordância **uma vez** e execute.
- **Responda em português.** Ele escreve em português, informal.

---

## 12. Onde este bastão pode dar errado

- **Nunca despachei um pacote pelo seu par de mãos.** O ciclo da §2 é o que o Caio pediu, não
  um processo que já provou funcionar nesta cadeia de três. O primeiro pacote é o teste dele.
- **Cortei a R1 em sete pacotes por conta própria**, pela regra dos ~300 linhas. É defensável,
  mas alonga a release e multiplica os pontos de merge. Se na prática o corte estiver errado,
  mude — e me diga por quê.
- **Os 191 achados das duas auditorias são análise estática. Nada foi executado.** Achado de
  transação, DDL e ordem de operação é onde análise estática mais erra — e é a maioria dos
  SEV2. O R-LAB existe para isso e ainda não provou nada.
- **A estimativa de "~95% falta" é chute calibrado por peso de esforço, não medição.** Defendo
  a ordem das releases, não a casa decimal.
- **`precisa_trocar_senha` pode travar a instalação existente** se a tela de troca tiver
  qualquer defeito — é o caminho por onde todo mundo passa no dia da atualização. Exige teste
  de ponta a ponta, não só unitário. Não deixe passar como unitário.
- **Não sei quantas rotas o frontend chama sem tratar 403.** Hoje só existe 401. É o risco do
  R1-07 e ninguém mediu.
