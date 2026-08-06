# Auditoria independente — FATIA E (frontend)

> **Nota do orquestrador:** este é o relatório bruto da fatia. A escala
> crítico/alto/médio/baixo foi substituída pela régua SEV1–SEV4 do SAGE em
> `ONDA2-VERIFICACAO.md`; essa verificação prevalece.

## Resultado executivo

**Status: REPROVADA para R1.** O frontend atual não implementa a identidade individual prevista pela R1, não conhece `papel` nem `precisa_trocar_senha`, confunde 403 com expiração de sessão, oferece superfícies administrativas a qualquer token e chega a exibir **“Liberado” sem realizar request**. Além disso, dados pessoais mantidos em React Query/Zustand/localStorage não são eliminados no logout e podem atravessar contas no mesmo processo de página.

Foram registrados 11 achados: **1 crítico, 5 altos, 4 médios e 1 baixo**. Não houve alteração em `SAGE` nem em `SAGE-API`.

## Escopo, contrato e método

- Repositório auditado: `C:\SAGE-WS\SAGE`.
- Branch: `wip/recuperacao-local-pre-auditoria`.
- Commit: `06c1ed4e948236c44926ed13fdb96521dd81d269`.
- Escopo de código: `SAGE/src/**` inteiro; `package.json` foi lido apenas para a auditoria de dependências/fronteira produção-dev pedida.
- Contrato único: `C:\SAGE-WS\SAGE-arquitetura\specs\R1-usuarios-e-autorizacao.md`, lido integralmente.
- Não foram consultados `C:\SAGE-WS\auditoria`, `ESTADO-VERIFICADO.md`, handoffs, relatórios prévios nem outros documentos de arquitetura.
- A análise foi estática: manifesto, chamadas HTTP, fluxo de token, rotas React, caches/stores, WebSocket, formulários, mensagens, consoles, listas/chaves e dependências.
- Não foram executados testes, build, start ou instalação. `node --version` confirmou `v18.16.1`, incompatível com a faixa do backend (`>=24 <25`) indicada para esta auditoria.

### Escala estrita de severidade

- **Crítica:** ação de segurança/negócio aparenta sucesso sem ocorrer, bypass efetivo, perda material ou exposição ampla diretamente explorável.
- **Alta:** quebra bloqueadora do contrato R1, autorização/sessão incorreta ou exposição entre identidades com impacto material.
- **Média:** falha funcional, privacidade, desempenho ou observabilidade relevante, mas sem bypass direto demonstrado.
- **Baixa:** dívida de produção/manutenção com impacto limitado e correção não bloqueadora isoladamente.

## Manifesto e LOC físicos reproduzíveis

Definição: linha física é cada elemento de `File.ReadAllLines`, incluindo linhas em branco e comentários. Arquivos binários (`.png`, `.jpg`) não recebem LOC; são inventariados por bytes. SVG e JSON contam como texto porque são conteúdo textual versionado em `src`.

Comando reproduzível em PowerShell, a partir de `C:\SAGE-WS\SAGE`:

```powershell
$root = (Resolve-Path '.').Path
$textExt = @('.css','.js','.jsx','.json','.svg')
$files = @(rg --files (Join-Path $root 'src') | Sort-Object)
$rows = foreach ($f in $files) {
  $ext = [IO.Path]::GetExtension($f).ToLowerInvariant()
  $bytes = (Get-Item -LiteralPath $f).Length
  if ($textExt -contains $ext) {
    [pscustomobject]@{ Ext=$ext; Lines=[IO.File]::ReadAllLines($f).Length; Bytes=$bytes; Path=$f.Substring($root.Length+1) }
  } else {
    [pscustomobject]@{ Ext=$ext; Lines=$null; Bytes=$bytes; Path=$f.Substring($root.Length+1) }
  }
}
$rows | Group-Object Ext | Sort-Object Name
```

Resumo fechado:

| Extensão | Arquivos | LOC físicas | Bytes |
|---|---:|---:|---:|
| `.css` | 47 | 6.838 | 114.449 |
| `.js` | 67 | 10.681 | 382.479 |
| `.jsx` | 7 | 687 | 22.959 |
| `.json` | 2 | 983 | 33.970 |
| `.svg` | 7 | 597 | 106.490 |
| **Texto** | **130** | **19.786** | **660.347** |
| `.png`/`.jpg` binários | 12 | n/a | 925.666 |
| **Total** | **142** | **19.786 textuais** | **1.586.013** |

Manifesto completo (`LOC`, `bytes`, `caminho`; `BIN` para binário):

```text
111 4599 src\App.js
43 1284 src\components\AuthInterceptor\AuthInterceptor.js
86 2824 src\components\common\CacheDebugger.js
0 0 src\components\common\ErrorMessage.module.css
6 299 src\components\common\index.js
0 0 src\components\common\LoadingSpinner.module.css
89 3416 src\components\common\SkeletonLoader.js
171 3035 src\components\common\SkeletonLoader.module.css
52 1819 src\components\common\SystemStatusBadge\SystemStatusBadge.js
62 1235 src\components\common\SystemStatusBadge\SystemStatusBadge.module.css
204 6244 src\components\examples\ExemploComponente.js
25 707 src\components\layout\BackButton\BackButton.js
24 522 src\components\layout\BackButton\BackButton.module.css
11 250 src\components\layout\Container\Container.js
19 274 src\components\layout\Container\Container.module.css
17 535 src\components\layout\Footer\Footer.js
37 523 src\components\layout\Footer\Footer.module.css
12 260 src\components\layout\LinkButton\LinkButton.js
14 251 src\components\layout\LinkButton\LinkButton.module.css
12 305 src\components\layout\Loader\Loading.js
11 161 src\components\layout\Loader\Loading.module.css
34 672 src\components\layout\Message\Message.js
21 366 src\components\layout\Message\Message.module.css
140 4411 src\components\layout\Navbar\Navbar.js
175 2906 src\components\layout\Navbar\Navbar.module.css
15 788 src\components\layout\Navbar\NavLinks.js
13 562 src\components\layout\NotificationPanel\NotificationPanel.contract.test.js
131 4160 src\components\layout\NotificationPanel\NotificationPanel.js
206 3334 src\components\layout\NotificationPanel\NotificationPanel.module.css
53 1418 src\components\layout\Table\Table.js
81 1335 src\components\layout\Table\Table.module.css
61 2013 src\components\layout\ToolBar\ToolBar.js
107 1794 src\components\layout\ToolBar\ToolBar.module.css
382 13852 src\components\pages\Adicionar\Adicionar.js
233 3629 src\components\pages\Adicionar\Adicionar.module.css
470 18929 src\components\pages\Areas\Areas.js
382 6557 src\components\pages\Areas\Areas.module.css
480 16563 src\components\pages\Aulas\Aulas.js
277 4475 src\components\pages\Aulas\Aulas.module.css
80 2681 src\components\pages\Cadastro\Cadastro.js
82 1395 src\components\pages\Cadastro\Cadastro.module.css
14 632 src\components\pages\Dados\DadosEscolares.contract.test.js
427 16335 src\components\pages\Dados\DadosEscolares.js
159 2508 src\components\pages\Dados\DadosEscolares.module.css
647 24212 src\components\pages\Departamentos\Departamentos.js
321 5899 src\components\pages\Departamentos\Departamentos.module.css
342 12013 src\components\pages\Departamentos\DepartamentosExample.js
527 19164 src\components\pages\Dispositivos\Dispositivos.js
491 8610 src\components\pages\Dispositivos\Dispositivos.module.css
321 10488 src\components\pages\Dispositivos\DispositivosRealTime.js
31 2538 src\components\pages\EsqueciSenha\EsqueciSenha.js
114 1856 src\components\pages\EsqueciSenha\EsqueciSenha.module.css
766 25221 src\components\pages\Formulario\Formulario.js
261 4062 src\components\pages\Formulario\Formulario.module.css
368 13622 src\components\pages\Home\Home.js
480 8704 src\components\pages\Home\Home.module.css
604 25870 src\components\pages\Horarios\Horarios.js
375 6361 src\components\pages\Horarios\Horarios.module.css
353 13200 src\components\pages\Inicio\Inicio.js
423 7064 src\components\pages\Inicio\Inicio.module.css
27 1419 src\components\pages\Login\Login.firstRun.test.js
197 9120 src\components\pages\Login\Login.js
166 2717 src\components\pages\Login\Login.module.css
228 8766 src\components\pages\Monitoring\Monitoring.js
288 4381 src\components\pages\Monitoring\Monitoring.module.css
80 2534 src\components\pages\Pessoas\Pessoas.js
51 899 src\components\pages\Pessoas\Pessoas.module.css
116 1902 src\components\pages\RedefinirSenha\RedefinirSenha.module.css
9 126 src\components\pages\Regras\Regras.js
0 0 src\components\pages\Regras\Regras.module.css
229 8382 src\components\pages\Relatorios\PessoaHistorico.js
207 3158 src\components\pages\Relatorios\PessoaHistorico.module.css
125 4183 src\components\pages\Relatorios\Relatorios.jsx
178 2853 src\components\pages\Relatorios\Relatorios.module.css
247 8187 src\components\pages\Relatorios\RelatoriosAcesso.js
747 30239 src\components\pages\Settings\Settings.js
419 6954 src\components\pages\Settings\Settings.module.css
380 11653 src\components\pages\Tabelas\Tabelas.js
181 2893 src\components\pages\Tabelas\Tabelas.module.css
177 5947 src\components\pages\Turmas\Turmas.js
124 2081 src\components\pages\Turmas\Turmas.module.css
19 609 src\components\ProtectedRoute\ProtectedRoute.js
17 744 src\components\Relatorios\FiltrosAcesso.js
169 5357 src\components\Relatorios\FiltrosAcesso.jsx
124 1958 src\components\Relatorios\FiltrosAcesso.module.css
2 286 src\components\Relatorios\GraficosLinha.js
59 2544 src\components\Relatorios\GraficosLinha.jsx
36 621 src\components\Relatorios\GraficosLinha.module.css
2 282 src\components\Relatorios\GraficosPizza.js
73 2358 src\components\Relatorios\GraficosPizza.jsx
36 621 src\components\Relatorios\GraficosPizza.module.css
140 4440 src\components\Relatorios\HorarioFixoForm.jsx
85 1287 src\components\Relatorios\HorarioFixoForm.module.css
9 488 src\components\Relatorios\MetricasCard.js
10 351 src\components\Relatorios\MetricasCard.jsx
3 339 src\components\Relatorios\MetricasCard.module.css
4 249 src\components\Relatorios\TabelaDetalhes.js
111 3726 src\components\Relatorios\TabelaDetalhes.jsx
154 2440 src\components\Relatorios\TabelaDetalhes.module.css
20 614 src\components\SessionExpiredModal\SessionExpiredModal.js
48 825 src\components\SessionExpiredModal\SessionExpiredModal.module.css
115 3373 src\contexts\NotificationContext.js
52 1771 src\contexts\ReactQueryProvider.js
110 3074 src\contexts\WebSocketContext.js
40 1020 src\contexts\WebSocketContext.test.js
12 221 src\data\db.json
971 33749 src\data\usuarios_exemplo.json
16 690 src\envFiles.test.js
19 525 src\form\Input\Input.js
20 320 src\form\Input\Input.module.css
17 596 src\form\Select\Select.js
17 264 src\form\Select\Select.module.css
11 261 src\form\SubmitButton\SubmitButton.js
21 353 src\form\SubmitButton\SubmitButton.module.css
316 9831 src\hooks\useCachedApi.js
137 4248 src\hooks\useWebSocket.js
BIN 160756 src\img\catraca.png
34 1870 src\img\catraca.svg
BIN 565254 src\img\entrada.png
BIN 26536 src\img\grafico.png
BIN 13294 src\img\image.png
6 679 src\img\loading.svg
BIN 15052 src\img\logo.png
68 4627 src\img\Pessoas\adm.svg
29 1720 src\img\Pessoas\aluno.svg
27 1542 src\img\Pessoas\professores.svg
384 92868 src\img\Pessoas\third.svg
49 3184 src\img\Pessoas\visitor.svg
BIN 1559 src\img\qr.png
BIN 1716 src\img\qrcode.png
BIN 2569 src\img\rfid.png
BIN 105178 src\img\rg.png
BIN 12370 src\img\user.jpg
BIN 9113 src\img\user.png
BIN 12269 src\img\user2.png
38 727 src\index.css
17 277 src\index.js
304 8945 src\services\api.js
60 2153 src\services\api.test.js
103 2835 src\stores\monitoringStore.js
19 518 src\utils\qrCode.js
24 831 src\utils\qrCode.test.js
```

## Inventário de telas, HTTP e tratamento 401/403

### Definição operacional de “tela”

“Tela” é um módulo fonte único renderizado diretamente por um `<Route element={...}>` em `src/App.js:59-85`. Duas rotas que usam o mesmo módulo contam uma vez (`Tabelas`); componentes filhos, variantes não roteadas, exemplos, layouts e providers não contam. O universo tem **21 arquivos de tela**:

- Públicas (3): `Login/Login.js`, `Cadastro/Cadastro.js`, `EsqueciSenha/EsqueciSenha.js`.
- Protegidas (18): `Pessoas/Pessoas.js`, `Inicio/Inicio.js`, `Departamentos/Departamentos.js`, `Dispositivos/Dispositivos.js`, `Home/Home.js`, `Tabelas/Tabelas.js`, `Formulario/Formulario.js`, `Turmas/Turmas.js`, `Adicionar/Adicionar.js`, `Regras/Regras.js`, `Horarios/Horarios.js`, `Relatorios/RelatoriosAcesso.js`, `Relatorios/PessoaHistorico.js`, `Settings/Settings.js`, `Aulas/Aulas.js`, `Areas/Areas.js`, `Dados/DadosEscolares.js`, `Monitoring/Monitoring.js`.

### Mecanismos globais

| Mecanismo | Evidência | Comportamento |
|---|---|---|
| Token HTTP | `src/services/api.js:10-12,74-86` | lê `localStorage.token` a cada chamada e envia Bearer |
| Transporte central | `src/services/api.js:89-138` | seis primitivas `fetch`: GET, POST, PATCH, multipart POST, PUT e DELETE |
| Resposta global | `src/services/api.js:17-71` | JSON/texto; 401 **e 403** removem token e emitem `auth-expired` |
| UI global de auth | `src/components/AuthInterceptor/AuthInterceptor.js:12-39` | notificação + modal e navegação para `/` ao fechar |
| Guarda de rota | `src/components/ProtectedRoute/ProtectedRoute.js:4-16` | verifica apenas existência de string no localStorage |
| WebSocket | `src/contexts/WebSocketContext.js:19-75` | captura o token uma vez no mount e não acompanha login/logout |
| Cache HTTP | `src/contexts/ReactQueryProvider.js:9-41` | cliente singleton; stale padrão 10 min; sem limpeza por identidade |
| Estado realtime | `src/stores/monitoringStore.js:3-100` | Zustand global; existe `clearData`, mas logout não o chama |
| Notificações | `src/contexts/NotificationContext.js:14-44` | persistência global `sage_notifications`, não segmentada por usuário |

### Callsites HTTP fechados

Definição: expressão estática de tela que inicia request diretamente (`fetch`), chama `api.*`, chama função exportada do serviço ou passa tal função como `queryFn`. As seis primitivas internas do serviço não são recontadas por tela. Resultado: **108 callsites em 18 telas com HTTP** — **99** passam pelo serviço central e **9** são `fetch` diretos.

| Tela | Serviço | `fetch` direto | Total | Destinos/ações |
|---|---:|---:|---:|---|
| Login | 0 | 4 | 4 | `/escolas`, `/setup/status`, `/setup/initialize`, `/escolas/login/:id` |
| EsqueciSenha | 0 | 1 | 1 | `/escolas/recuperar-acesso` |
| Inicio | 10 | 0 | 10 | pessoas, dispositivos/status, acessos, health, unidade, relatórios |
| Departamentos | 4 | 2 | 6 | pessoas/empresa/foto, importar, modelo, exportar |
| Dispositivos | 9 | 0 | 9 | CRUD/status/logs/zerar/toggle-sync |
| Home | 3 | 0 | 3 | acessos, pessoa, foto |
| Tabelas | 5 | 0 | 5 | pessoas por tipo e empresa |
| Formulario | 12 | 0 | 12 | pessoa/foto/turma/curso/responsável/QR/upload |
| Turmas | 2 | 0 | 2 | alunos e turma |
| Adicionar | 5 | 0 | 5 | turmas/cursos/empresas/escolas/pessoas |
| Horarios | 7 | 0 | 7 | horários, turmas, validar e CRUD |
| RelatoriosAcesso | 4 | 0 | 4 | turmas, resumo, detalhes, backfill |
| PessoaHistorico | 1 | 0 | 1 | histórico individual |
| Settings | 9 | 1 | 10 | unidade/config/dispositivos/senha/sync/backup/monitor |
| Aulas | 12 | 0 | 12 | aulas/professores/salas/matérias e CRUD |
| Areas | 9 | 0 | 9 | áreas/upload e configuração de dispositivos |
| DadosEscolares | 7 | 0 | 7 | escolas/cursos/turmas/salas e CRUD |
| Monitoring | 0 | 1 | 1 | `/monitoring/state` |
| **Total** | **99** | **9** | **108** | |

Telas sem HTTP (3):

- `src/components/pages/Cadastro/Cadastro.js`
- `src/components/pages/Pessoas/Pessoas.js`
- `src/components/pages/Regras/Regras.js`

### Classificação exata 401/403 por arquivo de tela

Critério de “tratar explicitamente”: o próprio arquivo testa `response.status`/`error.status` para 401 e/ou 403 e decide estado/mensagem/navegação. Testar apenas `response.ok` não é tratamento explícito de status.

| Grupo mutuamente exclusivo | Quantidade | Caminhos |
|---|---:|---|
| Trata 403 explicitamente além de 401 | **0** | nenhum |
| Trata apenas 401 explicitamente | **0** | nenhum |
| Tem HTTP e depende **exclusivamente** do interceptor/global | **13** | `Adicionar/Adicionar.js`; `Areas/Areas.js`; `Aulas/Aulas.js`; `Dados/DadosEscolares.js`; `Dispositivos/Dispositivos.js`; `Formulario/Formulario.js`; `Home/Home.js`; `Horarios/Horarios.js`; `Inicio/Inicio.js`; `Relatorios/PessoaHistorico.js`; `Relatorios/RelatoriosAcesso.js`; `Tabelas/Tabelas.js`; `Turmas/Turmas.js` |
| Tem HTTP, mas contorna total/parcialmente o global com `fetch` direto | **5** | `Departamentos/Departamentos.js`; `EsqueciSenha/EsqueciSenha.js`; `Login/Login.js`; `Monitoring/Monitoring.js`; `Settings/Settings.js` |
| Sem HTTP | **3** | `Cadastro/Cadastro.js`; `Pessoas/Pessoas.js`; `Regras/Regras.js` |
| **Total de telas** | **21** | totais fechados |

Entre as 5 que contornam o global, `Departamentos` e `Settings` são mistas; `Login`, `EsqueciSenha` e `Monitoring` usam apenas `fetch` direto.

### Telas que quebram ou mostram estado incorreto com negação por papel R1

Há **7 telas com impacto determinístico** pela classificação R1 (as demais também encerrariam a sessão se recebessem qualquer 403 pelo serviço global):

| Tela | Operação ADMINISTRADOR | Efeito estático da negação |
|---|---|---|
| `Areas/Areas.js` | criar/configurar/vincular dispositivo | 403 global encerra sessão; lista de dispositivos vira vazia no catch (`51-60`) |
| `Dados/DadosEscolares.js` | configuração/CRUD escolar | 403 global encerra sessão e mantém dados/seleções anteriores; alerta manda olhar console (`27-55`) |
| `Departamentos/Departamentos.js` | importação/exportação | importação via serviço encerra sessão; downloads diretos reduzem 403 a erro genérico (`231-320`) |
| `Dispositivos/Dispositivos.js` | configuração, exclusão, `zerar-logs`, sync | 403 encerra sessão; catches vazios e fallback podem deixar skeleton ou marcar OFFLINE (`42-68,103-129,142-161`) |
| `Inicio/Inicio.js` | leitura/configuração de dispositivo exposta no dashboard | query falha e 403 encerra sessão (`75-93`), ainda que o restante seja permitido à SECRETARIA |
| `Settings/Settings.js` | unidade/configuração, dispositivo, backup e ferramentas | 403 pelo serviço encerra sessão; backup direto mostra erro no corpo da tela (`169-298`) |
| `Monitoring/Monitoring.js` | monitoramento, explicitamente ADMINISTRADOR na R1 | request nem envia Bearer; passa a falhar com 401 e a tela conserva defaults/store anterior (`25-43`) |

## Achados

### E-001 — “Liberar acesso” confirma sucesso sem request nem trilha

- **Arquivo:linhas:** `src/components/pages/Home/Home.js:130-181,224-250`.
- **Severidade:** **Crítica**.
- **Categoria:** integridade de operação / trilha de auditoria / estado após ação.
- **Depende do ambiente:** **Não**.
- **Confiança:** **Alta**.
- **Sintoma:** clicar em `L` troca a interface para `Liberado`, mas nenhuma chamada de rede, comando à catraca ou persistência é executada.
- **Evidência:** `handleLiberar` somente executa `setUserChoice("liberar")`; o comentário imediatamente abaixo é `TODO: acionar endpoint`. O ramo de renderização mostra o rótulo `Liberado` quando esse estado local é selecionado.
- **Impacto:** o operador recebe confirmação falsa de uma liberação de segurança física; o acesso continua negado e não existe autor/registro para a trilha. É exatamente a consequência que a identidade individual da R1 pretende eliminar.
- **Reprodução estática:** seguir `onClick={handleLiberar}` em `Home.js:232` até `Home.js:174-177`; não há `api.*`, `fetch`, `emit` ou mutation antes de `Home.js:247-250` renderizar sucesso.
- **Correção sugerida:** implementar mutation autenticada de liberação; manter estado `pending`; exibir sucesso apenas após resposta confirmada; em 403 preservar sessão e indicar falta de permissão; o backend deve derivar o autor de `usuario_id` autenticado e criar a trilha atomicamente.
- **Regra violada:** R1 §1 (toda liberação em nome de quem liberou), §3 (trilha), §4.3 (aprovar liberação é escrita SECRETARIA) e §7 (autores distintos e trilha).

### E-002 — Frontend continua autenticando a escola, não usuários individuais

- **Arquivo:linhas:** `src/components/pages/Login/Login.js:18-27,35-42,99-118,176-190`; `src/components/ProtectedRoute/ProtectedRoute.js:4-16`; `src/App.js:59-85`; `src/components/layout/Navbar/NavLinks.js:3-13`.
- **Severidade:** **Alta**.
- **Categoria:** autenticação / identidade / autorização.
- **Depende do ambiente:** **Não**.
- **Confiança:** **Alta**.
- **Sintoma:** o login carrega escolas, seleciona `UnidadeEscolar.login` e chama `/escolas/login/:id`; depois considera autenticado qualquer valor presente em `localStorage.token`. Não há tela/rota de gestão de `Usuario`, papel, nome de exibição ou identidade atual.
- **Evidência:** o estado se chama `schools`; o payload é `{ usuario: selectedSchoolLogin, senha }`; a busca em `src` não encontra referências de autenticação a `usuario_id`, `papel`, `nome_exibicao` ou `precisa_trocar_senha`. As ocorrências de `ADMINISTRADOR` no frontend representam tipos de Pessoa, não papel de acesso.
- **Impacto:** a R1 não consegue produzir autores individuais, administrar secretárias, ocultar superfícies por papel nem apresentar a identidade que responde por uma operação. Quando o backend remover a credencial escolar como caminho de auth, o login quebra.
- **Reprodução estática:** abrir `Login.js:35-42` e `99-115`; observar que o ID de escola compõe a URL. Seguir `ProtectedRoute.js:6-16`: uma string arbitrária no storage libera toda a árvore visual protegida.
- **Correção sugerida:** trocar para login de `Usuario`; manter contexto de sessão tipado com `usuario_id`, `papel`, `nome_exibicao` e `precisa_trocar_senha`; adicionar administração de usuários apenas para ADMINISTRADOR; deixar o backend como autoridade final.
- **Regra violada:** R1 §§2.1-2.4, §3, §5, §6.4-6.5 e critérios de identidade do §7.

### E-003 — 403 é tratado como 401: token é apagado e usuário é expulso

- **Arquivo:linhas:** `src/services/api.js:14-43`; `src/components/AuthInterceptor/AuthInterceptor.js:12-39`; `src/components/SessionExpiredModal/SessionExpiredModal.js:4-14`.
- **Severidade:** **Alta**.
- **Categoria:** autorização / semântica HTTP / sessão.
- **Depende do ambiente:** **Não**; manifesta-se assim que o backend emitir 403.
- **Confiança:** **Alta**.
- **Sintoma:** qualquer 403 remove o token, emite `auth-expired`, cria notificação “Sessão expirada”, abre modal com título “Sessão Expirada” e leva ao login.
- **Evidência:** a condição é literalmente `response.status === 401 || response.status === 403`; ambos executam `localStorage.removeItem('token')`. Não há outro ramo para 403.
- **Impacto:** SECRETARIA autenticada é desconectada ao tentar operação ADMINISTRADOR; perde contexto/formulário e não recebe orientação correta. Isso torna autorização por papel operacionalmente hostil e mascara erros de classificação de rota.
- **Reprodução estática:** simular conceitualmente `api.get('/rota-admin')` retornando status 403; seguir `api.js:22-42` e o listener em `AuthInterceptor.js:13-35`.
- **Correção sugerida:** 401 deve encerrar/renovar estado de sessão; 403 deve preservar token e sessão, lançar erro com `status=403` e gerar mensagem de permissão insuficiente na tela/global apropriado. Não usar o mesmo evento/modal para ambos.
- **Regra violada:** R1 §4 e §7: SECRETARIA em rota ADMINISTRADOR recebe **403**; ausência de token recebe **401**. A especificação distingue expressamente os dois.

### E-004 — Logout não elimina caches/stores com PII entre usuários

- **Arquivo:linhas:** `src/components/layout/Navbar/Navbar.js:49-52`; `src/contexts/ReactQueryProvider.js:9-24,43-51`; `src/stores/monitoringStore.js:15-16,57-64,79-99`; `src/contexts/NotificationContext.js:14-44,46-75`; `src/components/pages/Home/Home.js:21-94,117-126`; `src/components/pages/Relatorios/PessoaHistorico.js:43-93`.
- **Severidade:** **Alta**.
- **Categoria:** privacidade / isolamento de sessão / PII.
- **Depende do ambiente:** **Sim** — dois usuários sucessivos na mesma aba/processo, cenário natural on-premise.
- **Confiança:** **Alta**.
- **Sintoma:** logout remove apenas o token. React Query, o store de monitoramento e notificações permanecem vivos fora das rotas; dados como nome, foto, tipo, turma e histórico de acesso do usuário A podem ser reutilizados/renderizados após login do usuário B.
- **Evidência:** providers envolvem toda a aplicação em `App.js:96-107`; o `QueryClient` é singleton com `staleTime` de 10 minutos e `refetchOnMount:false`; as query keys não contêm `usuario_id`; Zustand conserva `recentAccesses`; `clearData` existe mas não é chamado; notificações são salvas sob chave global `sage_notifications`. Busca estática encontra zero chamadas a `queryClient.clear/removeQueries/resetQueries` no logout.
- **Impacto:** exposição cruzada de PII e de estado operacional entre identidades individuais, especialmente em máquina compartilhada. Também permite decisão com dados obsoletos do operador anterior.
- **Reprodução estática:** usuário A abre Home/Histórico, logout (`Navbar.js:49-52`), usuário B entra sem reload completo (`Login.js:114-115`); providers não desmontam e as mesmas query keys/stores continuam disponíveis.
- **Correção sugerida:** um controlador de sessão deve, em logout/401/troca de usuário, desconectar socket, `queryClient.clear()`, limpar Zustand, notificações sensíveis e qualquer estado de formulário; alternativamente instanciar providers sob uma key de `usuario_id` e segmentar persistência.
- **Regra violada:** R1 §§2.3 e 5 (estado/identidade efetivos por requisição) e critérios de identidade do §7; princípio de separação entre usuários individuais introduzido pela R1.

### E-005 — WebSocket captura token antes do login e não acompanha login/logout; Monitoring omite Bearer

- **Arquivo:linhas:** `src/App.js:96-107`; `src/contexts/WebSocketContext.js:19-35,38-75`; `src/hooks/useWebSocket.js:72-117`; `src/components/layout/Navbar/Navbar.js:49-52`; `src/components/pages/Monitoring/Monitoring.js:25-43`.
- **Severidade:** **Alta**.
- **Categoria:** autenticação realtime / autorização / estado obsoleto.
- **Depende do ambiente:** **Sim** — depende da validação de handshake/rooms no servidor, mas o ciclo de token no cliente é determinístico.
- **Confiança:** **Alta** para o defeito de ciclo; **Média-alta** para o impacto exato do servidor.
- **Sintoma:** ao carregar a página de login sem token, o provider abre socket com token vazio; após login não reconecta. Se a aplicação nasce com token, logout não desconecta nem atualiza auth. A tela ADMINISTRADOR `/monitoring` ainda busca `/monitoring/state` sem `Authorization`.
- **Evidência:** `WebSocketProvider` monta acima das rotas; seu `useEffect` tem dependências `[]` e lê localStorage apenas uma vez. O logout só remove localStorage. `Monitoring.js:29` usa `fetch('/monitoring/state')` sem headers e não consome `isError`; o Zustand pode conservar snapshot anterior.
- **Impacto:** realtime pode ficar inutilizável após login, permanecer associado à identidade antiga após logout ou receber eventos fora da sessão atual. Com a R1, `/monitoring/state` passa a exigir ADMINISTRADOR e o request direto falha sempre por falta de token.
- **Reprodução estática:** comparar o mount em `App.js:98-105`, a leitura única em `WebSocketContext.js:19-30`, o logout em `Navbar.js:49-52` e o fetch sem headers em `Monitoring.js:29-31`.
- **Correção sugerida:** sessão deve ser fonte reativa do token; conectar apenas autenticado; desconectar e limpar subscriptions no logout/401; renovar conexão ao trocar token; usar o cliente HTTP central para snapshot e tratar 403 sem logout; rooms privilegiadas devem ser autorizadas no backend.
- **Regra violada:** R1 §§2.3, 4.1, 4.3 (dez rotas de monitoring ADMINISTRADOR), 5 e critérios de monitoramento do §7.

### E-006 — Superfícies ADMINISTRADOR são exibidas a qualquer token e falham de forma incorreta

- **Arquivo:linhas:** `src/components/ProtectedRoute/ProtectedRoute.js:4-16`; `src/App.js:65-85`; `src/components/layout/Navbar/NavLinks.js:3-11`; `src/components/pages/Dispositivos/Dispositivos.js:142-220,241-305,309-318,429-453`; `src/components/pages/Settings/Settings.js:169-298,604-707`; `src/components/pages/Areas/Areas.js:174-224`; `src/components/pages/Dados/DadosEscolares.js:85-139`.
- **Severidade:** **Alta**.
- **Categoria:** autorização de interface / estado após 403.
- **Depende do ambiente:** **Não** para a exposição; **Sim** para a resposta final do backend.
- **Confiança:** **Alta**.
- **Sintoma:** SECRETARIA vê links, botões e formulários para dispositivo, configuração, exclusão, `zerar-logs`, sync, backup e dados escolares. Não existe guard de papel por rota/controle. Ao backend negar, o global encerra a sessão; alguns catches ainda transformam erro em estado vazio/OFFLINE.
- **Evidência:** toda a árvore usa o mesmo `ProtectedRoute`, que só testa token. `NavLinks` é lista fixa. As telas renderizam ações administrativas incondicionalmente. Os 7 impactos por tela estão fechados na tabela anterior.
- **Impacto:** interface induz tentativas proibidas, interrompe trabalho da secretaria e pode apresentar dispositivo OFFLINE ou lista vazia quando o problema real é autorização. O backend continua sendo a barreira obrigatória, mas o pacote frontend da R1 não acompanha a política.
- **Reprodução estática:** colocar qualquer string em `localStorage.token`; todas as rotas protegidas e ações aparecem. Com token SECRETARIA válido, qualquer chamada ADMINISTRADOR cai em E-003.
- **Correção sugerida:** mapear rotas/ações a papel no frontend para UX (sem substituir o backend), ocultar ou desabilitar controles ADMINISTRADOR, ter página 403/estado “sem permissão” e nunca converter negação em OFFLINE/vazio/sessão expirada.
- **Regra violada:** R1 §§2.2, 4.1, 4.3 e critérios de autorização do §7.

### E-007 — Troca obrigatória de senha inexiste e a única troca aceita 6 caracteres

- **Arquivo:linhas:** `src/components/pages/Login/Login.js:99-118`; `src/components/pages/Settings/Settings.js:184-214,542-599`; `src/App.js:59-85`.
- **Severidade:** **Média**.
- **Categoria:** credencial / validação de formulário / migração.
- **Depende do ambiente:** **Não**.
- **Confiança:** **Alta**.
- **Sintoma:** após qualquer login bem-sucedido, a navegação vai direto a `/inicio`; não existe rota/tela para `precisa_trocar_senha`. A troca manual ainda chama `/unidade/trocar-senha` e valida mínimo 6, inclusive no placeholder.
- **Evidência:** `Login.js:114-115` só salva token e navega; `Settings.js:191-204` usa `< 6` e endpoint da unidade; não há referência a `precisa_trocar_senha` em `src`.
- **Impacto:** a credencial migrada não pode ser forçada a trocar antes de qualquer ação; o frontend permite enviar senha abaixo do mínimo R1 de 8 e continua vinculado à credencial compartilhada.
- **Reprodução estática:** resposta de login contendo `precisa_trocar_senha:true` é ignorada; uma nova senha de 6 ou 7 caracteres passa pela validação local.
- **Correção sugerida:** interpretar o estado retornado da sessão, bloquear a árvore protegida com uma rota exclusiva de troca obrigatória, validar mínimo 8 e trocar a senha do `Usuario` atual; testar o caminho migrado ponta a ponta quando houver Node compatível.
- **Regra violada:** R1 §5 (mínimo 8), §6.2-6.4 e critério de login migrado do §7.

### E-008 — Falhas de request são engolidas, viram estado falso ou deixam rejeição não tratada

- **Arquivo:linhas:** `src/components/pages/Dispositivos/Dispositivos.js:42-68,103-129,142-161,237-239`; `src/components/pages/Formulario/Formulario.js:299-319`; `src/components/pages/Monitoring/Monitoring.js:25-43`; `src/components/pages/EsqueciSenha/EsqueciSenha.js:10-16`; `src/components/pages/Settings/Settings.js:126-141`.
- **Severidade:** **Média**.
- **Categoria:** requests sem tratamento / estado após falha / mensagens.
- **Depende do ambiente:** **Não**.
- **Confiança:** **Alta**.
- **Sintoma:** falha ao listar/criar dispositivo é ignorada; falha de status vira `OFFLINE`; lista vazia mostra skeleton infinito; salvar Pessoa falha apenas no console; Monitoring não renderiza erro de query; recuperação de acesso não tem `try/catch` para falha de rede; `/config` vira `{}` silenciosamente.
- **Evidência:** catches vazios em `Dispositivos.js:57-58,160-161`; catch de status grava OFFLINE em `123-128`; `Formulario.js:317-319` só faz console; `Monitoring` desestrutura apenas `data`; `EsqueciSenha.enviar` aguarda fetch fora de qualquer catch.
- **Impacto:** operador confunde negação, indisponibilidade e ausência de dados; formulários mantêm estado sem feedback; promises podem rejeitar sem tratamento; troubleshooting depende do console.
- **Reprodução estática:** fazer cada request rejeitar/retornar não-ok e seguir os catches indicados; não existe transição para mensagem fiel ou rollback consistente.
- **Correção sugerida:** padronizar estados `idle/loading/success/error/forbidden`; nunca mapear erro de transporte para estado de domínio; mostrar erro recuperável, preservar formulário e oferecer retry; envolver fetch direto em tratamento completo ou removê-lo.
- **Regra violada:** R1 §9 (frontend pode quebrar quando backend negar por papel) e distinção 401/403 do §7.

### E-009 — Console e UI expõem identificadores/erros técnicos em produção

- **Arquivo:linhas:** `src/components/pages/Home/Home.js:55-59`; `src/services/api.js:62-68`; `src/components/pages/Areas/Areas.js:162-165`; `src/components/pages/Adicionar/Adicionar.js:52-59,130-133`; `src/contexts/ReactQueryProvider.js:26-38`.
- **Severidade:** **Média**.
- **Categoria:** PII em console / mensagens técnicas / fronteira produção-dev.
- **Depende do ambiente:** **Sim** — conteúdo exato depende do erro/backend; os sinks são incondicionais.
- **Confiança:** **Alta**.
- **Sintoma:** há 50 chamadas `console.error/warn` não guardadas em 15 arquivos (51 chamadas totais contando o único `console.log` protegido por desenvolvimento). Home escreve `pessoa_id`; erros enriquecidos podem carregar `err.data`; mensagens de backend são exibidas, e Areas orienta usuário final a rodar `migration_area_foto.sql`.
- **Evidência:** contagem reproduzível: `rg -n --glob '*.js' --glob '*.jsx' 'console\.(error|warn|debug|info)' src`. `api.js` anexa corpo bruto ao erro; vários componentes fazem console do objeto inteiro e/ou exibem `err.message`. Não foi encontrado `dangerouslySetInnerHTML`, `innerHTML`, `eval` ou `new Function` em `src`.
- **Impacto:** console compartilhado pode revelar identificadores pessoais e respostas internas; usuários recebem SQL/nomes de migration e detalhes técnicos em vez de orientação operacional. Não foi observada impressão direta de token ou CPF, portanto a severidade não foi elevada.
- **Reprodução estática:** provocar erro no enriquecimento de acesso e observar a interpolação de `pessoa_id`; devolver mensagem técnica/objeto no backend e seguir `handleResponse` até os consoles/mensagens.
- **Correção sugerida:** logger com redação e desativação em produção; registrar apenas código/correlação sem PII; normalizar erros em mensagens de domínio; nunca anexar/exibir body bruto sem allowlist.
- **Regra violada:** R1 §3 (redação: sem dado pessoal no detalhe) como princípio explícito de minimização e R1 §9 (falhas do frontend diante de negações).

### E-010 — Cargas em massa, N+1 e chaves por índice escalam mal e favorecem re-render incorreto

- **Arquivo:linhas:** `src/components/pages/Inicio/Inicio.js:67-70,95-105,116-165`; `src/components/pages/Departamentos/Departamentos.js:53-82,107-143`; `src/components/pages/Tabelas/Tabelas.js:47-63,80-147`; `src/components/pages/Turmas/Turmas.js:16-52`; `src/components/layout/Table/Table.js:25-45`; `src/components/pages/Relatorios/PessoaHistorico.js:174-191`; `src/components/pages/Monitoring/Monitoring.js:176-188`.
- **Severidade:** **Média**.
- **Categoria:** listas / performance / chaves React / re-render em massa.
- **Depende do ambiente:** **Sim** — agrava com volume real.
- **Confiança:** **Alta**.
- **Sintoma:** dashboard pede até 10.000 pessoas e 500 acessos para contar no cliente; Departamentos faz seis lotes de 1.000 e requests por pessoa/foto/empresa; Tabelas percorre todas as páginas; Turmas baixa 1.000 alunos e faz um request por turma. Tabelas e históricos usam índice como `key`.
- **Evidência:** limites e loops estão nas linhas citadas; `Table.js:32-35`, `PessoaHistorico.js:175-176`, `Departamentos.js:392-393` e `Monitoring.js:181-182` usam índices em coleções dinâmicas.
- **Impacto:** explosão de latência/memória/requests, rajadas concorrentes, logout repetido quando um dos N requests recebe 403 e reutilização incorreta de DOM/estado quando listas são filtradas, paginadas ou reordenadas.
- **Reprodução estática:** para `N` pessoas, seguir `Promise.all(map(...buscarFoto))`; o número de requests cresce linearmente além do request de lista. Reordenar lista que usa índice mantém a mesma key para entidade diferente.
- **Correção sugerida:** endpoints agregados/counts e paginação server-side; incluir foto/empresa/turma na projeção quando necessário; limitar concorrência/cancelar requests; usar IDs de domínio estáveis como key.
- **Regra violada:** não há critério numérico de performance na R1; viola a obrigação da fatia E de revisar listas/chaves/re-render e aumenta a fragilidade destacada em R1 §9.

### E-011 — Dependências de teste/servidor/debug estão em produção e artefatos dev estão quebrados/mortos

- **Arquivo:linhas:** `package.json:5-27`; `src/components/common/CacheDebugger.js:1-7`; `src/hooks/useCachedApi.js:1-5`; `src/components/pages/Departamentos/DepartamentosExample.js:15-18`.
- **Severidade:** **Baixa**.
- **Categoria:** dependências / fronteira produção-dev / código morto.
- **Depende do ambiente:** **Não**.
- **Confiança:** **Alta**.
- **Sintoma:** `@testing-library/*`, `json-server`, `cors` e `@tanstack/react-query-devtools` estão em `dependencies`; não há import em código de produção para devtools/cors/json-server. `uuid`, `web-vitals` e `@fortawesome/fontawesome-svg-core` também não têm import direto em `src`. O componente de debug referencia `./CacheDebugger.module.css` inexistente, e `useCachedApi` importa `../contexts/CacheContext`, também inexistente; hoje permanecem fora das rotas.
- **Evidência:** busca literal por cada nome de pacote em `src`; imports ausentes para os pacotes citados. O manifesto não contém os dois arquivos requeridos. `DepartamentosExample` é o único consumidor de `useCachedApi`, e não é roteado/importado por `App`.
- **Impacto:** superfície e lockfile de produção maiores, manutenção confusa e código “exemplo/debug” que quebra assim que alguém o conecta. O impacto atual é limitado porque os módulos mortos não entram na árvore de entrada observada.
- **Reprodução estática:** `rg -l -F '<pacote>' src`; comparar imports de `CacheDebugger.js`/`useCachedApi.js` com o manifesto; seguir imports a partir de `App.js` e constatar ausência desses módulos.
- **Correção sugerida:** mover bibliotecas de teste para `devDependencies`; remover dependências diretas realmente não usadas após confirmar lockfile; excluir ou reparar/disciplinar artefatos de exemplo/debug; usar uma checagem de dependências e grafo de imports em CI.
- **Regra violada:** não há regra específica de dependência na R1; viola a fronteira produção/dev solicitada nesta fatia e eleva risco de regressão do frontend que deve acompanhar a R1.

## Síntese por tópico solicitado

- **Token/localStorage:** token Bearer é centralizado para 99 callsites, mas guard visual só testa existência; 9 fetches contornam o serviço. Não foi encontrado sink DOM perigoso conhecido, porém o token permanece acessível a qualquer script da origem. O defeito comprovado é o ciclo 401/403 e a ausência de limpeza de sessão/caches.
- **Autenticação/autorização:** identidade ainda é a escola; não há `Usuario`, papel, troca obrigatória ou gestão de usuários; todas as rotas protegidas usam a mesma guarda booleana.
- **401/403:** nenhuma tela trata explicitamente qualquer um; o global trata ambos como logout. Totais fechados acima.
- **PII em console:** nenhum token/CPF foi impresso diretamente; há `pessoa_id` e objetos de erro em 50 sinks não guardados.
- **Requests/estado após falha:** há catches vazios, fallback OFFLINE, skeleton infinito, erro só em console, promise sem catch e snapshots persistentes.
- **Listas/chaves/re-render:** cargas de 500/1.000/10.000, paginação exaurida no cliente, N+1 e keys por índice em listas mutáveis.
- **Validação:** setup e recuperação usam mínimo 8, mas Settings usa 6; formulários de Pessoa dependem amplamente do backend e expõem mensagens técnicas. A rota pública `Cadastro` é um formulário cenográfico sem submit real (`Cadastro.js:5-73`) e está fora do modelo de gestão ADMINISTRADOR.
- **Dependências:** runtime principal usado: React, React DOM, Router, React Query, FontAwesome, react-icons, QRCode, Recharts, Socket.IO e Zustand. Há dependências dev/servidor e diretas sem uso em produção, conforme E-011.
- **Produção/dev:** somente o log de base URL é guardado por `NODE_ENV`; os outros 50 consoles não são. Exemplos/debug mortos permanecem em `src`.

## Limitações e estado dos worktrees

- Testes/build deliberadamente não executados: Node `v18.16.1`; nenhuma tentativa de instalar/trocar Node.
- Auditoria estática não confirma o conteúdo dinâmico exato de respostas nem o enforcement WebSocket do backend; achados dependentes disso estão marcados.
- Estado inicial observado: `SAGE` e `SAGE-API` limpos na branch `wip/recuperacao-local-pre-auditoria`.
- Este relatório é o único arquivo gravado pela fatia E.
