# Fatia E — frontend

## Resumo

Auditoria estática do `SAGE/src/**`, configuração de entrega web e contratos consumidos em `SAGE-API`. Foram mantidos **26 achados**: **16 SEV2** e **10 SEV3**; nenhum SEV1. O caminho Docker foi tratado como secundário ao alvo Windows. Evidências com identidade, endereço, contato ou credencial aparentes foram deliberadamente sanitizadas.

## Cobertura

- Bootstrap/entrega: `Dockerfile`, `nginx.conf`, `src/App.js`, `src/services/api.js`.
- Autenticação/realtime: `ProtectedRoute`, `AuthInterceptor`, `WebSocketContext`, `useWebSocket` e contrato de `SAGE-API/src/websocket/wsServer.js`.
- Fluxos: monitoramento, início, dispositivos, horários/aulas, pessoa, configuração, cadastro e notificações.
- Dados e dependências: `src/data/*.json`, imagens importadas e `package.json`.
- Método: leitura estática e buscas versionadas; nenhum código, dado ou documentação foi alterado.

## Achados

### E-01 — Docker só roteia `/backend`, mas login e setup usam URLs absolutas na raiz

- **Arquivo+linhas:** `SAGE/Dockerfile:6-10,27`; `SAGE/nginx.conf:13-21`; `SAGE/src/components/pages/Login/Login.js:35-61,82-117`.
- **Severidade:** **SEV3**.
- **Categoria:** integração HTTP / empacotamento Docker.
- **Depende do ambiente:** sim — manifesta-se no perfil Docker; não é o caminho Windows prioritário.
- **Confiança:** alta.
- **Sintoma:** a API central usa o prefixo de build, porém login, setup e recuperação fazem `fetch("/...")` fora de `/backend`.
- **Evidência real sanitizada:** o nginx encaminha somente `location /backend/`; os quatro `fetch` do login começam na raiz da origem.
- **Impacto no dado:** impede autenticação/onboarding nesse perfil; não há corrupção demonstrada.
- **Reprodução:** construir com os argumentos padrão, abrir a SPA e observar que `/setup/status` e `/escolas` caem no fallback da SPA, não no proxy da API.
- **Direção sem código:** usar um único cliente/origin resolver para todas as chamadas e testar o artefato Docker publicado.
- **Regra/ADR:** configuração coerente entre build e runtime; falha deve ser explícita.

### E-02 — Tráfego operacional é anunciado e servido em HTTP puro

- **Arquivo+linhas:** `SAGE/nginx.conf:19-35`; `SAGE-API/installer/windows/SAGE.iss:35-36`.
- **Severidade:** **SEV2**.
- **Categoria:** segurança de transporte.
- **Depende do ambiente:** sim — risco material quando o acesso não fica estritamente no loopback/host confiável.
- **Confiança:** alta.
- **Sintoma:** proxy e atalho operacional usam `http://`; não há terminação TLS ou política de redirecionamento no produto.
- **Evidência real sanitizada:** `proxy_pass http://...` no Docker e atalho Windows para `http://localhost:3000`.
- **Impacto no dado:** em rede não confiável, token e PII podem ser observados ou alterados em trânsito.
- **Reprodução:** inspecionar o esquema da URL no atalho e no DevTools; não há negociação TLS.
- **Direção sem código:** decidir e documentar a fronteira de confiança; limitar a loopback ou provisionar TLS com identidade verificável.
- **Regra/ADR:** AGENTS §4.3; ADR-07 (dado com peso legal).

### E-03 — Token de sessão fica acessível a qualquer script da origem

- **Arquivo+linhas:** `SAGE/src/services/api.js:10-12`; `SAGE/src/components/ProtectedRoute/ProtectedRoute.js:4-16`; `SAGE/src/components/pages/Login/Login.js:99-117`.
- **Severidade:** **SEV3**.
- **Categoria:** autenticação / armazenamento no cliente.
- **Depende do ambiente:** sim — exige execução de script na origem, extensão comprometida ou acesso local ao perfil.
- **Confiança:** alta.
- **Sintoma:** login grava Bearer em `localStorage`; guarda e cliente o leem diretamente.
- **Evidência real sanitizada:** `localStorage.setItem/getItem('token')`; a guarda verifica apenas a existência da string.
- **Impacto no dado:** roubo do valor permite operar com a sessão até expirar; não há vazamento comprovado isoladamente.
- **Reprodução:** após login sintético, ler a chave pelo console da mesma origem.
- **Direção sem código:** adotar sessão protegida contra leitura por JavaScript ou formalizar mitigação, expiração curta e CSP estrita.
- **Regra/ADR:** R1 (identidade individual); princípio de minimização de credencial.

### E-04 — Resposta 403 é convertida em expiração de sessão

- **Arquivo+linhas:** `SAGE/src/services/api.js:20-38`; `SAGE/src/components/AuthInterceptor/AuthInterceptor.js:12-39`.
- **Severidade:** **SEV2**.
- **Categoria:** autorização / semântica HTTP.
- **Depende do ambiente:** não.
- **Confiança:** alta.
- **Sintoma:** 401 e 403 removem o token, disparam o mesmo evento e exibem a mesma mensagem de sessão expirada.
- **Evidência real sanitizada:** condição literal `status === 401 || status === 403` antecede `removeItem`.
- **Impacto no dado:** interrompe trabalho válido e mascara negação por papel como falha de identidade.
- **Reprodução:** devolver 403 a qualquer chamada central com token válido; a aplicação encerra a sessão.
- **Direção sem código:** separar autenticação de autorização; 403 deve preservar sessão e apresentar “sem permissão”.
- **Regra/ADR:** R1 (401 ≠ 403); ADR-05 (postura de falha por fluxo).

### E-05 — URL `/backend` é interpretada como namespace, não como `path` do Socket.IO

- **Arquivo+linhas:** `SAGE/Dockerfile:6-10`; `SAGE/nginx.conf:32-35`; `SAGE/src/contexts/WebSocketContext.js:23-35`.
- **Severidade:** **SEV3**.
- **Categoria:** realtime / configuração de proxy.
- **Depende do ambiente:** sim — perfil Docker com `REACT_APP_SOCKET_URL=/backend`.
- **Confiança:** alta.
- **Sintoma:** o cliente passa `/backend` como primeiro argumento de `io`, mas não configura `path`; o nginx espera `/backend/socket.io/`.
- **Evidência real sanitizada:** `io(SOCKET_URL, options)` sem propriedade `path`, contraposto ao `location /backend/socket.io/`.
- **Impacto no dado:** eventos não chegam à UI; polling vira única fonte e aumenta atraso/carga.
- **Reprodução:** abrir a versão Docker e verificar handshake em `/socket.io`/namespace divergente do proxy.
- **Direção sem código:** distinguir origem, namespace e path; fixar contrato e testá-lo atrás do proxy real.
- **Regra/ADR:** contrato de integração explícito e testado.

### E-06 — Socket nasce antes da autenticação e não acompanha login/logout

- **Arquivo+linhas:** `SAGE/src/App.js:96-106`; `SAGE/src/contexts/WebSocketContext.js:19-75`; `SAGE/src/components/layout/Navbar/Navbar.js:49-52`.
- **Severidade:** **SEV2**.
- **Categoria:** autenticação realtime / ciclo de sessão.
- **Depende do ambiente:** não para o ciclo; impacto depende da validação do servidor.
- **Confiança:** alta.
- **Sintoma:** provider monta na tela pública, captura token uma vez (`[]`) e não reconecta ao entrar nem desconecta por logout lógico.
- **Evidência real sanitizada:** leitura única do storage no efeito; logout apenas remove a chave e navega.
- **Impacto no dado:** realtime pode permanecer sem identidade ou ligado à identidade anterior em estação compartilhada.
- **Reprodução:** carregar sem token, autenticar sem reload e comparar `socket.auth`; depois sair e observar o socket existente.
- **Direção sem código:** tornar sessão reativa, conectar só autenticado e destruir/limpar conexão na troca de identidade.
- **Regra/ADR:** R1 (identidade por operação); AGENTS §4.6.

### E-07 — Cliente emite `join`, servidor aceita apenas `subscribe:*`

- **Arquivo+linhas:** `SAGE/src/hooks/useWebSocket.js:72-99`; `SAGE-API/src/websocket/wsServer.js:59-75`.
- **Severidade:** **SEV3**.
- **Categoria:** contrato realtime.
- **Depende do ambiente:** não.
- **Confiança:** alta.
- **Sintoma:** cliente tenta entrar em `acessos` com dois payloads de evento `join`; servidor não registra esse evento.
- **Evidência real sanitizada:** frontend emite `join`; backend escuta `subscribe:acessos`, `subscribe:dispositivos`, `subscribe:sync` e `subscribe:stats`.
- **Impacto no dado:** atualizações deixam de chegar e a tela trabalha com polling/cache potencialmente atrasado.
- **Reprodução:** conectar com token sintético e observar que o socket não entra na room após as emissões do cliente.
- **Direção sem código:** definir protocolo único versionado e teste de contrato cliente-servidor.
- **Regra/ADR:** integração deve ter contrato verificável.

### E-08 — Reconexão realtime cessa após cinco tentativas

- **Arquivo+linhas:** `SAGE/src/contexts/WebSocketContext.js:31-35,59-67`.
- **Severidade:** **SEV3**.
- **Categoria:** resiliência / operação on-premise.
- **Depende do ambiente:** sim — queda superior à janela de cinco tentativas.
- **Confiança:** alta.
- **Sintoma:** após `reconnectionAttempts: 5`, a aplicação apenas registra falha e não agenda nova tentativa.
- **Evidência real sanitizada:** limite literal e handler `reconnect_failed` sem recuperação.
- **Impacto no dado:** UI deixa de receber eventos até reload; registro de backend não é perdido por esse defeito isolado.
- **Reprodução:** manter API indisponível além das cinco tentativas e depois restaurá-la; socket não volta sozinho.
- **Direção sem código:** usar reconexão contínua com backoff limitado e sinal operacional, respeitando troca de sessão.
- **Regra/ADR:** operação remota deve se recuperar de falhas transitórias.

### E-09 — “Liberar acesso” mostra sucesso sem executar operação

- **Arquivo+linhas:** `SAGE/src/components/pages/Home/Home.js:130-180,224-250`.
- **Severidade:** **SEV2**.
- **Categoria:** falso sucesso / segurança física.
- **Depende do ambiente:** não.
- **Confiança:** alta.
- **Sintoma:** clique muda estado local para `liberar` e renderiza “Liberado”; nenhum request/comando é enviado.
- **Evidência real sanitizada:** `handleLiberar` só chama `setUserChoice`; comentário `TODO` confirma endpoint ausente.
- **Impacto no dado:** operador acredita ter autorizado a passagem, sem efeito físico nem trilha de autoria.
- **Reprodução:** seguir o `onClick` até o ramo de renderização; não há I/O entre ambos.
- **Direção sem código:** sucesso somente após confirmação autenticada e auditada; manter pendente/erro enquanto não confirmado.
- **Regra/ADR:** AGENTS §4.2; R1 (autoria); ADR-07.

### E-10 — Monitor inventa área, dispositivo e sentido quando a origem não informa

- **Arquivo+linhas:** `SAGE/src/components/pages/Home/Home.js:22-31,210-220`.
- **Severidade:** **SEV2**.
- **Categoria:** integridade de dado exibido.
- **Depende do ambiente:** não.
- **Confiança:** alta.
- **Sintoma:** todo acesso recebe os mesmos rótulos fixos de área/dispositivo e qualquer status diferente de `SAIDA` vira entrada.
- **Evidência real sanitizada:** objeto `baseAccess` contém rótulos literais; operador ternário usa entrada como default amplo.
- **Impacto no dado:** tela apresenta como fato uma localização/origem/direção não comprovada, afetando decisão e auditoria.
- **Reprodução:** alimentar acesso sem metadados ou com status desconhecido; UI mostra valores definidos pelo frontend.
- **Direção sem código:** exibir “não informado/desconhecido” e resolver metadados apenas de fonte autoritativa.
- **Regra/ADR:** AGENTS §4.1 (nunca invente dado); ADR-07.

### E-11 — Polling de 2 s dispara enriquecimento N+1 por acesso

- **Arquivo+linhas:** `SAGE/src/components/pages/Home/Home.js:22-47,69-93`.
- **Severidade:** **SEV3**.
- **Categoria:** desempenho / carga na API.
- **Depende do ambiente:** sim — cresce com volume e tamanho de página.
- **Confiança:** alta.
- **Sintoma:** cada poll busca a lista e, para cada item, faz duas chamadas adicionais em `Promise.all`.
- **Evidência real sanitizada:** `refetchInterval: 2000` combinado com `sorted.map(enrichAccess)`; enriquecimento chama pessoa e foto.
- **Impacto no dado:** sobrecarga aumenta timeout e estados obsoletos; não altera o banco diretamente.
- **Reprodução:** com página de N acessos, contar aproximadamente `1 + 2N` requests a cada dois segundos.
- **Direção sem código:** retornar projeção já enriquecida/paginada, cachear entidades e evitar polling quando realtime estiver saudável.
- **Regra/ADR:** operação previsível em hardware on-premise.

### E-12 — Falha de status vira OFFLINE e o parser espera shape incompatível

- **Arquivo+linhas:** `SAGE/src/components/pages/Dispositivos/Dispositivos.js:42-58,103-129`.
- **Severidade:** **SEV3**.
- **Categoria:** estado falso / contrato de resposta.
- **Depende do ambiente:** sim — qualquer falha de transporte, autorização ou shape.
- **Confiança:** alta.
- **Sintoma:** carga inicial trata `statusData` como array direto; recarga individual lê `response.data.status`; no catch grava `OFFLINE`.
- **Evidência real sanitizada:** três shapes distintos no mesmo arquivo e fallback explícito para estado de domínio.
- **Impacto no dado:** operador confunde falha da API com catraca fora do ar e pode tomar ação desnecessária.
- **Reprodução:** retornar wrapper diferente ou 403/timeout no endpoint de status; UI marca OFFLINE.
- **Direção sem código:** normalizar contrato uma vez e representar erro/indeterminado separadamente de OFFLINE confirmado.
- **Regra/ADR:** AGENTS §4.2; ADR-03 (estado da máquina desconhecido).

### E-13 — Catches de dispositivo ocultam falhas de listagem e criação

- **Arquivo+linhas:** `SAGE/src/components/pages/Dispositivos/Dispositivos.js:42-68,142-161`.
- **Severidade:** **SEV3**.
- **Categoria:** tratamento de erro.
- **Depende do ambiente:** não.
- **Confiança:** alta.
- **Sintoma:** catches vazios deixam lista/formulário sem explicação quando leitura ou criação falha.
- **Evidência real sanitizada:** blocos `catch (err) {}` nas linhas indicadas.
- **Impacto no dado:** falso silêncio e repetição de operação; persistência parcial do servidor não é distinguida de falha total.
- **Reprodução:** rejeitar GET ou POST; não aparece estado acionável.
- **Direção sem código:** erro explícito, correlação sanitizada, estado de retry e reconciliação após resultado incerto.
- **Regra/ADR:** AGENTS §4.2 (nunca engula erro).

### E-14 — Totais do painel são calculados sobre páginas truncadas

- **Arquivo+linhas:** `SAGE/src/components/pages/Inicio/Inicio.js:67-105`; `SAGE/src/components/pages/Home/Home.js:77-88`.
- **Severidade:** **SEV2**.
- **Categoria:** relatório/indicador incorreto.
- **Depende do ambiente:** sim — quando o total excede os limites 500/10.000 ou o backend pagina.
- **Confiança:** alta.
- **Sintoma:** pessoas e acessos do dia são contados no cliente a partir de uma página limitada; fallback usa comprimento da lista.
- **Evidência real sanitizada:** requests com `limit=10000` e `limit=500`; filtragem e contagem locais.
- **Impacto no dado:** painel subconta pessoas/acessos e apresenta indicador incompleto como total.
- **Reprodução:** criar mais registros que o limite ou simular resposta paginada; comparar card com `total` autoritativo.
- **Direção sem código:** endpoints de contagem/agregação autoritativos, com período e paginação explícitos.
- **Regra/ADR:** AGENTS §4.1; ADR-07.

### E-15 — Falha da validação de horário permite salvar mesmo assim

- **Arquivo+linhas:** `SAGE/src/components/pages/Horarios/Horarios.js:267-304`.
- **Severidade:** **SEV2**.
- **Categoria:** validação fail-open.
- **Depende do ambiente:** sim — 404, timeout, 5xx ou erro de contrato na validação.
- **Confiança:** alta.
- **Sintoma:** apenas conflito 409 bloqueia; 404 e demais erros geram warning e o PUT/POST continua.
- **Evidência real sanitizada:** catches nas linhas 270-287 não retornam; execução segue para atualizar/criar.
- **Impacto no dado:** horários conflitantes ou inválidos podem ser persistidos quando o validador está indisponível.
- **Reprodução:** fazer `/validar` responder 404/500; observar chamada de escrita subsequente.
- **Direção sem código:** validação de integridade obrigatória no backend/transação; indisponibilidade deve bloquear a escrita.
- **Regra/ADR:** AGENTS §4.6; ADR-05.

### E-16 — Falha de “detach” aciona deleção total da aula

- **Arquivo+linhas:** `SAGE/src/components/pages/Aulas/Aulas.js:189-207`; `SAGE/src/services/api.js:155-157`.
- **Severidade:** **SEV2**.
- **Categoria:** deleção destrutiva / compensação indevida.
- **Depende do ambiente:** sim — qualquer falha do modo detach.
- **Confiança:** alta.
- **Sintoma:** timeout, 403 ou 5xx no detach é interpretado como motivo para repetir DELETE sem o modo.
- **Evidência real sanitizada:** catch interno chama `deletarAula(id)` e o texto informa “deleção total”.
- **Impacto no dado:** falha transitória pode ampliar a operação e apagar a entidade, não apenas desvincular horários.
- **Reprodução:** rejeitar a primeira requisição e aceitar a segunda; a deleção total ocorre.
- **Direção sem código:** não ampliar escopo destrutivo em fallback; exigir escolha explícita e resultado idempotente/reconciliável.
- **Regra/ADR:** AGENTS §4.2 e disciplina de integridade; ADR-07.

### E-17 — Falha ao ler horário fixo habilita PUT de lista vazia

- **Arquivo+linhas:** `SAGE/src/components/Relatorios/HorarioFixoForm.jsx:24-76`.
- **Severidade:** **SEV2**.
- **Categoria:** perda de dado por fallback.
- **Depende do ambiente:** sim — falha na leitura seguida de clique em salvar.
- **Confiança:** alta.
- **Sintoma:** GET falho substitui o estado por seis linhas vazias e encerra loading; salvar filtra tudo e envia `horarios: []`.
- **Evidência real sanitizada:** catch das linhas 45-46 e PUT das linhas 66-69.
- **Impacto no dado:** horários existentes podem ser removidos apesar de nunca terem sido carregados.
- **Reprodução:** falhar GET, aguardar formulário vazio e salvar.
- **Direção sem código:** manter formulário bloqueado em erro de leitura; exigir reload bem-sucedido/versão antes de substituir coleção.
- **Regra/ADR:** AGENTS §4.1 e §4.2; ADR-07.

### E-18 — Salvar pessoa é multi-etapas, sem atomicidade, e pode aparentar sucesso parcial

- **Arquivo+linhas:** `SAGE/src/components/pages/Formulario/Formulario.js:238-325`.
- **Severidade:** **SEV2**.
- **Categoria:** escrita multi-passo / feedback falso.
- **Depende do ambiente:** sim — falha entre QR, PATCH, upload e releitura.
- **Confiança:** alta.
- **Sintoma:** QR pode ser persistido e modal de sucesso aberto antes do PATCH; PATCH pode concluir e upload falhar; catches só registram no console.
- **Evidência real sanitizada:** sequência de chamadas independentes e `setShowSuccessModal(true)` antes de `salvarDados`.
- **Impacto no dado:** pessoa, QR e foto podem divergir; operador não recebe estado fiel nem sabe o que repetir.
- **Reprodução:** fazer a segunda ou terceira etapa falhar após a anterior responder sucesso.
- **Direção sem código:** operação composta no backend com transação/compensação e resposta única; UI confirma só o estado final reconciliado.
- **Regra/ADR:** AGENTS §4.2 e §4.7.

### E-19 — Abrir aluno para consulta sobrescreve o ano no formulário

- **Arquivo+linhas:** `SAGE/src/components/pages/Formulario/Formulario.js:140-150`.
- **Severidade:** **SEV2**.
- **Categoria:** mutação implícita de dado.
- **Depende do ambiente:** sim — alunos cujo ano persistido difere do relógio local.
- **Confiança:** alta.
- **Sintoma:** ao carregar, `ano`/`ano_letivo` é substituído pelo ano corrente antes de qualquer edição.
- **Evidência real sanitizada:** `new Date().getFullYear()` é gravado no estado carregado se a chave existir.
- **Impacto no dado:** um salvar posterior pode alterar histórico/matrícula sem decisão explícita.
- **Reprodução:** abrir registro sintético com ano anterior e inspecionar o payload de PATCH.
- **Direção sem código:** preservar valor autoritativo; promoção de ano deve ser fluxo de domínio explícito e auditável.
- **Regra/ADR:** AGENTS §4.1; ADR-07.

### E-20 — Falha da API exibe identidade real aparente hardcoded como fallback

- **Arquivo+linhas:** `SAGE/src/components/pages/Settings/Settings.js:33-48,98-120`.
- **Severidade:** **SEV2**.
- **Categoria:** PII/configuração versionada / identidade incorreta.
- **Depende do ambiente:** sim — leitura de `/unidade` falha e não há override local válido.
- **Confiança:** alta para o fallback; identidade tratada apenas como aparente.
- **Sintoma:** o bundle contém e usa como estado inicial nome, identificadores, endereço e contato de uma unidade aparente.
- **Evidência real sanitizada:** objeto `DADOS_UNIDADE_INICIAL` possui campos completos; valores reais não são reproduzidos neste relatório.
- **Impacto no dado:** outra instalação pode exibir ou reenviar identidade de terceiro e PII operacional versionada.
- **Reprodução:** bloquear `/unidade`, limpar a chave local e abrir Configurações; observar preenchimento pelo fallback.
- **Direção sem código:** fallback neutro/vazio; configuração por onboarding, nunca por identidade versionada.
- **Regra/ADR:** AGENTS §4.1, §4.3 e §4.4.

### E-21 — Cadastro injeta nome de arquivo de foto fictícia

- **Arquivo+linhas:** `SAGE/src/components/pages/Adicionar/Adicionar.js:94-128`.
- **Severidade:** **SEV2**.
- **Categoria:** dado inventado.
- **Depende do ambiente:** não.
- **Confiança:** alta.
- **Sintoma:** ausência de foto é convertida em string de arquivo fictício e enviada como se fosse dado da pessoa.
- **Evidência real sanitizada:** `if (!payload.foto) payload.foto = "foto_exemplo.png"`.
- **Impacto no dado:** banco passa a afirmar uma foto inexistente; UI e integrações não distinguem ausência de placeholder.
- **Reprodução:** cadastrar pessoa sem foto e inspecionar payload/persistência.
- **Direção sem código:** persistir `null`/ausente; placeholder é apenas apresentação e nunca dado de domínio.
- **Regra/ADR:** AGENTS §4.1; ADR-07.

### E-22 — Notificações potencialmente pessoais persistem sem segregação de usuário

- **Arquivo+linhas:** `SAGE/src/contexts/NotificationContext.js:14-75`; `SAGE/src/App.js:96-106`.
- **Severidade:** **SEV2**.
- **Categoria:** privacidade / isolamento de sessão.
- **Depende do ambiente:** sim — contas sucessivas no mesmo perfil de navegador.
- **Confiança:** alta.
- **Sintoma:** payloads de notificação são serializados em uma chave global do `localStorage`; provider atravessa login/logout.
- **Evidência real sanitizada:** chave única `sage_notifications`, carga no mount e `setItem(JSON.stringify(...))` sem identidade.
- **Impacto no dado:** usuário seguinte pode ver estado/notificação do anterior; conteúdo pode permanecer no disco do perfil.
- **Reprodução:** gerar notificação sintética, sair, entrar com outra conta sem limpar storage.
- **Direção sem código:** minimizar conteúdo, segmentar por identidade e limpar no logout/troca; preferir não persistir PII.
- **Regra/ADR:** AGENTS §4.3; R1; ADR-12.

### E-23 — Corpo bruto de erro é propagado para console e interface

- **Arquivo+linhas:** `SAGE/src/services/api.js:45-68`; `SAGE/src/contexts/ReactQueryProvider.js:26-38`; `SAGE/src/components/pages/Home/Home.js:55-64,193-195`.
- **Severidade:** **SEV2**.
- **Categoria:** vazamento de detalhe / observabilidade.
- **Depende do ambiente:** sim — conteúdo retornado pela API.
- **Confiança:** alta para o sink; PII exata depende da resposta.
- **Sintoma:** resposta JSON/texto vira `err.data`/`err.message`; objetos inteiros são enviados ao console e mensagens são renderizadas.
- **Evidência real sanitizada:** atribuição de body bruto ao erro e handlers globais `console.error(error)`; nenhum payload real é reproduzido.
- **Impacto no dado:** PII, SQL ou detalhe interno devolvido por engano pode persistir no console e chegar ao operador.
- **Reprodução:** responder erro sintético com campo sensível marcador e seguir o objeto até console/UI.
- **Direção sem código:** envelope de erro allowlisted, código de ocorrência e redação central antes de qualquer sink.
- **Regra/ADR:** AGENTS §4.3; ADR-12. **Sobreposição:** fatia D (logging/redação).

### E-24 — Rota pública de cadastro é cenográfica e seus cartões navegam para login

- **Arquivo+linhas:** `SAGE/src/App.js:43-63`; `SAGE/src/components/pages/Cadastro/Cadastro.js:5-73`; `SAGE/src/components/pages/Pessoas/Pessoas.js:16-74`.
- **Severidade:** **SEV3**.
- **Categoria:** fluxo quebrado / superfície pública.
- **Depende do ambiente:** não.
- **Confiança:** alta.
- **Sintoma:** formulário não tem estado/submit; “CADASTRAR” é link para `/`; todos os cartões de Pessoas também apontam para `/`.
- **Evidência real sanitizada:** inputs não controlados, nenhum handler, e `to="/"`/`href="/"` literais.
- **Impacto no dado:** usuário acredita haver cadastro/navegação, mas nenhuma gravação ocorre e a sessão pode ser desviada.
- **Reprodução:** acessar `/cadastro`, preencher e clicar; não há request e volta ao login.
- **Direção sem código:** remover superfície falsa ou ligá-la a fluxo autenticado/autorizado com critérios claros.
- **Regra/ADR:** AGENTS §4.2; R1 (gestão administrativa de usuários).

### E-26 — Dependências de teste/servidor e módulos mortos estão no runtime do frontend

- **Arquivo+linhas:** `SAGE/package.json:10-26`; `SAGE/src/hooks/useCachedApi.js:1-4`; `SAGE/src/components/common/CacheDebugger.js:1-7`.
- **Severidade:** **SEV3**.
- **Categoria:** dependências / build.
- **Depende do ambiente:** sim — instalação, scanner e manutenção do bundle.
- **Confiança:** alta para declarações/imports literais; média para ausência de uso dinâmico.
- **Sintoma:** bibliotecas de teste e servidor aparecem em `dependencies`; módulos mortos importam arquivos/contextos ausentes.
- **Evidência real sanitizada:** manifesto e grafo de imports versionados; não há consumidor de produção demonstrado para parte dos pacotes.
- **Impacto no dado:** amplia supply chain e ruído de vulnerabilidade; ativar módulo morto quebra build/runtime.
- **Reprodução:** comparar imports literais com o manifesto e resolver dependências dos módulos citados.
- **Direção sem código:** separar dev/runtime, remover não usados e validar grafo/lock no CI.
- **Regra/ADR:** dependências mínimas e build reproduzível.

### E-27 — JSON versionado contém PII aparente e credenciais aparentes

- **Arquivo+linhas:** `SAGE/src/data/usuarios_exemplo.json:1-971`; `SAGE/src/data/db.json:1-12`.
- **Severidade:** **SEV2**.
- **Categoria:** privacidade / segredo versionado.
- **Depende do ambiente:** não para a exposição no repositório; autenticidade não foi confirmada.
- **Confiança:** média.
- **Sintoma:** arquivos em `src/data` contêm registros com aparência de dados pessoais e pares com aparência de credenciais.
- **Evidência real sanitizada:** foram observados campos de identidade/contato e campos de autenticação; nenhum valor, nome, endereço ou segredo é reproduzido aqui.
- **Impacto no dado:** se reais, há exposição no histórico Git e possível reutilização indevida; se sintéticos, ainda normalizam padrão inseguro e podem ir ao bundle.
- **Reprodução:** revisar localmente os nomes de campos e padrões, sem copiar valores para issue/log/relatório.
- **Direção sem código:** preservar evidência sob acesso controlado, determinar origem, rotacionar credenciais aparentes e substituir por fixtures inequivocamente sintéticas.
- **Regra/ADR:** AGENTS §4.3 e §4.4; ADR-12. **Sobreposição:** fatia D (PII/segredos em artefatos).

## Descartados

- **E-25 — retry global do backfill:** descartado. No código atual não ficou demonstrado efeito adicional material além do modelo de `Presenca` já reportado em outra fatia; mantê-lo duplicaria risco sem evidência independente.

## Duplicatas e limites

- E-23 e E-27 sobrepõem o território D (logging, redação, PII e segredos); permanecem aqui porque o sink/artefato é do frontend, sem duplicar a causa-raiz de infraestrutura.
- Não foi afirmada autenticidade para os dados de E-27; a classificação usa somente “PII aparente/credenciais aparentes”.
- Não foram executados login real, catraca, instalação, build ou tráfego com dados reais.
