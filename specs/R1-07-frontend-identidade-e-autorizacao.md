# R1-07 — Frontend: identidade, status HTTP e fallback neutro

**Repo alvo:** `SAGE` (frontend). **Branch:** `wip/recuperacao-local-pre-auditoria`.
**Estado medido em:** `SAGE@76f5beb` e `SAGE-API@b181b704`.
**Achados cobertos:** `[E-003]` `[E-004]` `[E-005]` `[E-006]` `[E-007]` `[+2A-E20]`.

Este é o **sétimo e último pacote de implementação da R1**. Ele não acrescenta superfície: ele
faz o frontend obedecer aos contratos que a própria R1 já integrou no servidor.

---

## 1. Por que este pacote é obrigatório, e não dívida

A R1 produziu o problema que o R1-07 resolve. Três acoplamentos medidos:

1. **O R1-02 subiu autorização fail-closed por papel.** A secretaria agora recebe `403` legítimo
   em rota de administrador. E `src/services/api.js:22-24` faz `localStorage.removeItem('token')`
   em `403`. **A R1 tornou o produto inutilizável para o papel não-administrador.**
2. **O R1-01 subiu `precisa_trocar_senha`.** `SAGE-API/src/middlewares/autenticar.js:17` recusa
   **toda rota** com `428` enquanto a flag for verdadeira, liberando apenas
   `PATCH /unidade/trocar-senha`. `grep '428'` no `src/` do `SAGE` não retorna nenhum arquivo de
   código. **O mecanismo existe no servidor e é inoperável pela tela.**
3. **O repo `SAGE` é público** (`gh repo view` → `private=false`) e `Settings.js:33-47` carrega
   nome, CNPJ `62823257000109`, endereço, telefone e login `admin` da escola real dentro do
   bundle. Isso é exposição corrente.

Nenhum dos três se resolve sozinho, e os três pioram com o tempo de operação.

## 2. A API já entrega tudo. Este pacote é só do `SAGE`.

Verificado em `b181b704`, para que ninguém abra PR na API:

| O que o frontend precisa | Onde já está |
|---|---|
| Papel do usuário logado | dentro do JWT — `schoolController.js:196` faz `gerarToken({ usuario_id, papel, emitido_em })` |
| Flag de primeira troca | `schoolController.js:207` devolve `precisa_trocar_senha` no corpo do login |
| Barreira de troca de senha | `autenticar.js:17` responde `428` em toda rota, exceto `PATCH /unidade/trocar-senha` |
| Rota de troca | `PATCH /unidade/trocar-senha`, já consumida por `Settings.js:205` |

**Fora de escopo, terminante: nenhuma alteração no `SAGE-API`.** Se o pacote parecer precisar de
mudança na API, **pare e abra decisão** — é sinal de que li o servidor errado.

### 2.1 Invariante que governa o pacote inteiro

> **O papel lido no cliente serve para decidir o que desenhar. Nunca para decidir o que
> autorizar.** O servidor é a única autoridade, e continua sendo depois deste pacote.

Ocultar um botão não protege nada — o R1-02 é que protege. Ocultar é para a secretaria não
esbarrar em parede o dia inteiro. Se algum teste deste pacote sugerir que esconder o botão
substitui a autorização, o teste está errado.

Corolário: o JWT é decodificado **sem verificação de assinatura** (não há `jwt-decode` no
`package.json`; é `atob` do segundo segmento). Isso é aceitável **porque a decisão é cosmética**.
Token malformado ou ilegível → tratar como "sem papel" e desenhar o mínimo, nunca o máximo.

---

## 3. Contratos

### 3.1 `[E-003]` — o contrato de status HTTP

`api.js:17` (`handleResponse`) é o ponto de estrangulamento de todos os verbos — 9 chamadas
medidas no arquivo. A mudança é ali, e **só** ali, mais o duplicado de `getPessoaFotoUrl:107`.

| Status | Hoje | Contrato |
|---|---|---|
| `401` | apaga token, evento `auth-expired`, modal, volta ao login | **mantém** |
| `403` | **idem 401** | **preserva a sessão.** Erro normal, com `err.status = 403` e a mensagem do servidor. Quem chamou trata |
| `428` | cai no `!response.ok` genérico, vira erro sem sentido na tela | evento próprio (`auth-troca-senha`). **Não apaga token** |
| demais | `err.status` + `err.data` | **mantém** |

`403` deixa de disparar `auth-expired`. O `AuthInterceptor` (`AuthInterceptor.js:24`) e o
`WebSocketContext` (`:49`) ouvem esse evento; nenhum dos dois muda — eles passam a receber menos.

**Não invente tela de erro global para 403.** A tela que chamou já tem `catch`. Mensagem local,
sessão intacta.

### 3.2 `[E-006]` — primeira troca de senha

Estado medido: `Login.js:113-116` grava o token, dispara `auth-changed` e navega para `/inicio`
**ignorando `precisa_trocar_senha` do corpo**.

**Contrato.**

1. O login guarda a flag junto da sessão.
2. Enquanto a flag for verdadeira, a **única** tela alcançável é a de troca de senha. O ponto de
   corte é o `ProtectedRoute` (`ProtectedRoute.js`, 19 linhas — é lá, não espalhado).
3. Trocar com sucesso baixa a flag e libera a navegação, **sem exigir novo login**.
4. O evento `auth-troca-senha` da §3.1 leva ao mesmo lugar, para o caso de a flag chegar no meio
   da sessão.
5. **Alinhar o mínimo de senha.** `Settings.js:196` valida `novaSenha.length < 6`;
   `schoolController.js:70` exige 8. Hoje a tela aprova e o servidor recusa. Passa a 8.

**Fora de escopo:** política de expiração, força de senha, histórico, 2FA.

### 3.3 `[E-004]` `[E-007]` — cache e WebSocket por identidade

**Medido, e corrige o item do plano:** o cache real do produto é o **TanStack React Query**.
`contexts/ReactQueryProvider.js` cria um `queryClient` **singleton de módulo, exportado**, com
`cacheTime` de 15 minutos. Trocar de usuário no mesmo navegador entrega ao segundo o que o
primeiro carregou.

`hooks/useCachedApi.js` e `pages/Departamentos/DepartamentosExample.js` importam
`../contexts/CacheContext`, que **não existe** — nenhum dos dois é alcançável a partir do
`App.js`. São órfãos. **Não conserte, não delete: registre.** Ver §7.

**Contrato.** Troca de identidade (login, logout, troca de token) limpa o cache de consultas
antes de a primeira consulta da nova identidade sair.

**O WebSocket já está correto e é contrato integrado — não reabra.** `WebSocketContext.js:30-55`
já deriva a conexão de `sessionToken` e já ouve `auth-changed`/`auth-expired`. O `R1-05E`
(`SAGE@41dd6ab`) e o `R1-05F` (`1bd694d` + hotfix `76f5beb`) fecharam handshake, protocolo,
`path` e reconexão. **Este pacote não toca `WebSocketContext.js` nem `useWebSocket.js`**, exceto
se o teste de identidade provar vazamento — e aí é decisão, não conserto silencioso.

### 3.4 `[E-005]` — ocultar ação de administrador

**Superfície medida no servidor**, e é pequena — 7 declarações `exige('ADMINISTRADOR')` em
`b181b704`, contra 11 de `SECRETARIA`:

| Área ADMIN-only | Arquivo na API | Onde aparece no `SAGE` |
|---|---|---|
| Dispositivos / catracas | `deviceRoutes.js:4` | `NavLinks.js:7`, `pages/Dispositivos/*` |
| Monitoramento técnico | `monitoringRoutes.js:15,191` | `pages/Monitoring/Monitoring.js` |
| Usuários | `usuarioRoutes.js:2` | — (sem tela hoje) |
| Unidade escolar | `schoolRoutes.js:4` | `pages/Settings/Settings.js` |
| Importar / exportar planilha | `dataRoutes.js:5` | `pages/Departamentos/Departamentos.js` |
| Promoção de turmas | `promocaoRoutes.js:3` | — (sem tela hoje) |

**Contrato.** Para `SECRETARIA`: a entrada some do menu (`NavLinks.js`, 15 linhas), a rota
correspondente não renderiza a tela, e a ação dentro de tela compartilhada fica oculta. Para
`ADMINISTRADOR`: tudo como hoje.

Duas armadilhas nomeadas:

- **`Settings.js` é tela mista** — 752 linhas com dados da unidade (ADMIN) e a troca de senha da
  própria conta (todo mundo). Não esconda a tela: esconda a seção da unidade e as ferramentas de
  catraca. A secretaria precisa chegar na troca de senha, ou o §3.2 fica inalcançável para ela.
- **`Departamentos.js` é tela mista** — listar pessoas é `SECRETARIA`; importar/exportar planilha
  é `ADMINISTRADOR`. Esconda os botões, não a tela.

**Fora de escopo:** telas para as duas áreas que não existem hoje (usuários, promoção). Ausência
de tela não é bug deste pacote.

### 3.5 `[+2A-E20]` — fallback neutro

`Settings.js:33-47` sai do bundle. O estado inicial e o fallback de `/unidade` passam a ser
**vazios**; a identidade vem do servidor ou do onboarding, e enquanto não vier a tela mostra
campo vazio, não a escola de outra pessoa.

**Medido, e reduz o escopo pedido:** `pages/Dados/DadosEscolares.js` já inicializa tudo vazio
(`useState([])` / `useState("")`, linhas 9-24). **Não há nada a fazer lá.** O item do plano dizia
"Settings/Dados"; a metade "Dados" já está neutra.

**Guard obrigatório**, senão volta: teste que reprova se CNPJ, logradouro, bairro, CEP ou
telefone da unidade reaparecerem como literal em `src/`.

**Fora de escopo, com razão registrada:** `Footer.js:12` e `public/index.html:27` trazem "ETEC de
Taboão da Serra" como marca. Não há CNPJ, endereço nem telefone — é rótulo, não identidade
estruturada, e neutralizá-lo exige configuração em tempo de build que este pacote não vai
inventar. Vai para dívida (§7).

---

## 4. O gate não existe hoje, e isso entra no pacote

**`gh` e `git ls-tree` confirmam: o repo `SAGE` não tem `.github/`. Nenhum CI.** As oito suítes
que já existem (`api.test.js`, `WebSocketContext.test.js`, `useWebSocket.test.js`,
`envFiles.test.js`, `Login.firstRun.test.js`, `DadosEscolares.contract.test.js`,
`NotificationPanel.contract.test.js`, `qrCode.test.js`) **não rodam em lugar nenhum
automaticamente**.

Foi exatamente assim que o defeito do R1-05F passou: o teste do `WebSocketContext` afirmava a
forma errada da chamada e ninguém o executava.

**Portanto o R1-07A inclui um workflow mínimo no `SAGE`:** `npm ci`, `npm test` e `npm run build`
em `ubuntu-latest`, disparando em `pull_request` e em push para a branch de integração. Sem isso,
todo critério de aceite abaixo é decorativo.

Isto é ampliação de escopo consciente e eu assumo: é a condição de possibilidade do gate, não um
extra.

## 5. Recorte em pacotes

Todos com **diff ≤ 300 linhas**. `A` é pré-requisito de `B` e `D`.

| Pacote | Cobre | Entrega |
|---|---|---|
| **R1-07A** | `[E-003]` + gate | contrato de status em `handleResponse` e `getPessoaFotoUrl`; módulo único de identidade da sessão (papel + `usuario_id` do JWT, tolerante a token ilegível); **workflow de CI no `SAGE`** |
| **R1-07B** | `[E-006]` | flag no login, corte no `ProtectedRoute`, tela de troca alcançável, mínimo alinhado em 8 |
| **R1-07C** | `[E-004]` `[E-007]` | limpeza do `queryClient` por identidade |
| **R1-07D** | `[E-005]` | menu, rotas e ações por papel, com as duas telas mistas tratadas |
| **R1-07E** | `[+2A-E20]` | fallback neutro do `Settings` + guard de literal |

Ordem: **A → B → C → D → E.** `C` e `E` são independentes de `B`/`D` e podem trocar de lugar
entre si; `A` não pode sair da frente.

## 6. Critérios de aceite

**R1-07A**
- [ ] `403` **não** apaga o token, **não** dispara `auth-expired` e chega ao chamador com `err.status = 403`
- [ ] `401` continua deslogando, com o modal atual
- [ ] `428` não apaga o token e emite evento próprio
- [ ] `getPessoaFotoUrl` segue a mesma regra — não pode ficar com o comportamento antigo
- [ ] Token ausente, malformado ou ilegível → papel indefinido, e a UI desenha o mínimo
- [ ] CI roda `npm test` e `npm run build` e **reprova** com teste vermelho (prove com um vermelho intencional antes de subir)

**R1-07B**
- [ ] Login com `precisa_trocar_senha: true` leva à troca e **não** a `/inicio`
- [ ] Com a flag ativa, nenhuma outra rota protegida renderiza
- [ ] Troca bem-sucedida libera a navegação sem novo login
- [ ] Senha de 6 e 7 caracteres é recusada **pela tela**, com a mesma regra do servidor

**R1-07C**
- [ ] Dados carregados pela identidade A não aparecem para a identidade B após troca no mesmo navegador
- [ ] Logout limpa o cache
- [ ] Nenhuma alteração em `WebSocketContext.js` / `useWebSocket.js`

**R1-07D**
- [ ] `SECRETARIA` não vê entrada de Dispositivos nem de Monitoramento no menu
- [ ] `SECRETARIA` **vê** `Settings` e **alcança** a troca de senha; não vê a seção da unidade nem as ferramentas de catraca
- [ ] `SECRETARIA` **vê** `Departamentos`; não vê importar/exportar
- [ ] `ADMINISTRADOR` vê tudo o que via antes — teste de não-regressão
- [ ] Um `403` que ainda chegue **não desloga** (amarra em A)

**R1-07E**
- [ ] `DADOS_UNIDADE_INICIAL` não contém identidade real
- [ ] `/unidade` falhando mostra campo vazio, não escola alheia
- [ ] Guard reprova CNPJ/endereço/telefone literais em `src/`

**Todos**
- [ ] Suíte inteira verde no CI novo; nenhum teste existente apagado ou desabilitado
- [ ] `npm run build` passa
- [ ] Diff ≤ 300 linhas por pacote

## 7. Fora de escopo e dívidas

**Não faça neste pacote:**

- Qualquer alteração no `SAGE-API`.
- Reabrir contrato integrado: `R1-05D2` (mídia privada), `R1-05E` (handshake e salas),
  `R1-05F` (protocolo, `path`, reconexão), `R1-04B1` (corpos de escrita explícitos).
- Redesenho visual, rota nova, tela nova, refatoração de `Settings.js` ou `Departamentos.js`
  além do necessário para esconder o que a §3.4 manda.
- Gerenciador de estado global novo. O `queryClient` já existe e já é exportado.

**Dívidas registradas — cada uma vira issue própria, nenhuma entra aqui:**

| Dívida | Onde | Por que fora |
|---|---|---|
| `/uploads` público fora de foto de pessoa — planilha importada fica baixável | `SAGE-API/src/routes/dataRoutes.js:14-24` + `app.js:151` | é backend, e o recorte do `C-014` na spec R1-05 §5 foi meu; corrigir aqui seria mudar contrato integrado por emenda |
| `/docs` (Swagger) montado sem declaração e sem auth | `SAGE-API/src/app.js:136` | backend; fora da barreira do R1-02 por ser `app.use`, não rota |
| `emitToAll` emite cru, sem `projetarEvento` | `SAGE-API/src/websocket/wsServer.js:122` | código morto sem chamadores; reabre o `C-009` se alguém usar |
| `dispositivo:status` e `sync:fila` sem produtor no servidor | assinados em `SAGE/src/hooks/useWebSocket.js:98,103` | dois painéis nunca atualizam; é funcionalidade ausente, não contrato quebrado |
| `useCachedApi.js` + `DepartamentosExample.js` importam `CacheContext` inexistente | `SAGE/src/hooks/`, `SAGE/src/components/pages/Departamentos/` | código morto pré-existente; a regra é apontar, não deletar |
| Marca "ETEC de Taboão da Serra" em `Footer.js:12` e `index.html:27` | `SAGE` | rótulo sem identidade estruturada; neutralizar exige config de build |
| Testes do frontend com `jest.mock('socket.io-client')` não exercitam a biblioteca real | `SAGE/src/contexts/WebSocketContext.test.js` | foi a causa do defeito do R1-05F; a instância foi corrigida em `76f5beb`, a classe não |

## 8. Aviso permanente

Vale o mesmo que ficou escrito na R1-05 §8, e vale mais aqui porque este pacote nasceu de uma
auditoria minha: **qualquer afirmação minha sobre conteúdo de arquivo que não venha acompanhada
do comando que a produziu deve ser tratada como suspeita.** Nesta spec, tudo que está afirmado
foi medido em `SAGE@76f5beb` e `SAGE-API@b181b704`. Se o agente encontrar divergência entre o que
está escrito aqui e o que está no disco, **a divergência ganha: pare e abra decisão.**

Três vezes nesta release o agente parou diante de contradição e nas três estava certo.
