# Fatia F — configuração, build e release

## Resumo

Auditoria estática de manifestos, lockfiles, variáveis, CI, builder e instalador Windows. Foram mantidos **14 achados**: **2 SEV1**, **3 SEV2** e **9 SEV3**. Os SEV1 não decorrem de CVSS: decorrem da inexistência de caminho seguro e recuperável para instalar/atualizar na máquina-alvo. Nenhum segredo ou `.env` real foi reproduzido.

## Cobertura

- Manifestos: `SAGE/package*.json`, `SAGE-API/package*.json`, `.env.example`.
- CI: workflows versionados da API e ausência correspondente no frontend.
- Windows: `artifacts.json`, builder, layout, Inno Setup, preparação, estado, serviços, ativação e readiness.
- Runtime: consumidores de `process.env`, setup/migrations, cliente MySQL, Socket/HTTP e dependências literais.
- Régua: AGENTS e ADR-0011/ADR-0013, inclusive preflight, junction, assinatura e limite de readiness.

## Achados

### F-01 — Default divergente de `CATRACA_USER_ID_OFFSET` rompe identidade entre escrita e leitura

- **Arquivo+linhas:** `SAGE-API/src/services/controlIdService.js:11`; `SAGE-API/src/services/accessService.js:8`; `SAGE-API/src/controllers/deviceController.js:105`; `SAGE-API/.env.example:54-56`.
- **Severidade:** **SEV2**.
- **Categoria:** configuração / integridade referencial.
- **Depende do ambiente:** sim — manifesta-se quando a variável não é definida, como permite o exemplo comentado.
- **Confiança:** alta.
- **Sintoma:** escrita usa um default; leitura/diagnóstico usam outro.
- **Evidência real sanitizada:** dois defaults numéricos distintos aparecem em consumidores da mesma identidade; os valores foram omitidos desta evidência.
- **Impacto no dado:** logs podem não resolver a pessoa gravada na catraca ou ser associados incorretamente.
- **Reprodução:** com env ausente, calcular o ID produzido por `controlIdService` e subtraí-lo no consumidor.
- **Direção sem código:** constante única, obrigatória e validada; migração deve reconciliar IDs já gravados após levantamento de campo.
- **Regra/ADR:** AGENTS §9 e §4.1. **Duplicata:** **B-17** (offset divergente); não contar duas vezes na consolidação.

### F-02 — Payload/serviço MySQL contraria o ADR-0001, embora o ADR-0013 o tenha superado

- **Arquivo+linhas:** `SAGE-API/scripts/assemble-windows-layout.js:111-130`; `SAGE-API/installer/windows/provision-services.ps1:15-27,136-152`; `_arquitetura/repo/docs/adr/0013-mysql-embarcado-como-servico.md:1-35`.
- **Severidade:** **SEV3**.
- **Categoria:** arquitetura de distribuição / documentação executável.
- **Depende do ambiente:** sim — instalador Windows.
- **Confiança:** alta.
- **Sintoma:** payload embute MySQL e WinSW e instala `SAGEMySQL`; esse desenho contraria o ADR-0001 e referências herdadas, embora o ADR-0013 posterior declare explicitamente que a implementação vence.
- **Evidência real sanitizada:** builder copia runtime MySQL e segundo WinSW; ADR-0013 registra a superação do contrato antigo e mantém gates de assinatura/licença.
- **Impacto no dado:** automação ou operação baseada no contrato superado pode procurar runtime, porta e supervisor errados; distribuição pública segue bloqueada.
- **Reprodução:** comparar os quatro pontos enumerados no ADR-0013 com os scripts e com qualquer referência ainda baseada no ADR-0001.
- **Direção sem código:** eliminar referências superadas e tornar ADR-0013 a fonte única; não liberar publicamente enquanto seus gates estiverem pendentes.
- **Regra/ADR:** ADR-0013; precedência explícita entre ADRs.

### F-03 — Portas MySQL 3306, 3307 e 33306 coexistem no contrato

- **Arquivo+linhas:** `SAGE-API/.env.example:15-20`; `SAGE-API/src/config/database.js:16-20`; `SAGE-API/scripts/runtime-schema-gate.js:7-12`; `SAGE-API/installer/windows/initialize-state.ps1:199-263`; `_arquitetura/repo/docs/adr/0013-mysql-embarcado-como-servico.md:8-25`.
- **Severidade:** **SEV3**.
- **Categoria:** configuração / banco.
- **Depende do ambiente:** sim — perfil de desenvolvimento, instalação Windows ou operação baseada em documentação antiga.
- **Confiança:** alta.
- **Sintoma:** exemplo e defaults de código usam 3306; instalador gera 3307; o contrato superado registrava 33306.
- **Evidência real sanitizada:** três números literais em fontes contratuais distintas; o instalador só é coerente porque grava override próprio.
- **Impacto no dado:** execução pelo perfil errado conecta a outro servidor, falha setup/backup ou opera schema inesperado.
- **Reprodução:** iniciar cada consumidor com env ausente e comparar a porta resultante com `sage.env` gerado no Windows.
- **Direção sem código:** schema de configuração por perfil, sem default silencioso em produção; marcar 33306 como histórico e 3307 como contrato Windows.
- **Regra/ADR:** ADR-0013; configuração explícita e fail-fast. **Sobreposição:** fatia D (configuração runtime).

### F-04 — Ativação usa marcador JSON e regrava serviço, não junction atômica

- **Arquivo+linhas:** `SAGE-API/installer/windows/complete-install.ps1:9-24,42-73`; `SAGE-API/installer/windows/provision-services.ps1:124-135`; `_arquitetura/repo/docs/adr/0011-atualizacao-blue-green.md:13-39`.
- **Severidade:** **SEV2**.
- **Categoria:** atualização / atomicidade.
- **Depende do ambiente:** sim — upgrade Windows.
- **Confiança:** alta.
- **Sintoma:** o “ponteiro” é `current.json`, mas a execução real depende de editar XML/reprovisionar serviço para caminho versionado; não existe junction `current`.
- **Evidência real sanitizada:** nenhuma criação/troca de junction nos scripts; `Move-Item` só troca o marcador depois que o serviço já foi apontado e iniciado.
- **Impacto no dado:** queda entre reprovisionamento, readiness e marcador deixa fontes de verdade divergentes e rollback não é troca atômica.
- **Reprodução:** interromper o processo após salvar o XML/iniciar serviço e antes de mover `current.json.pending`.
- **Direção sem código:** uma única junction como ponteiro ativo, troca atômica e recuperação baseada nela; marcador apenas informativo.
- **Regra/ADR:** ADR-0011; AGENTS §4.8.

### F-05 — Instalador não faz preflight/ledger antes de parar e sobrescrever

- **Arquivo+linhas:** `SAGE-API/installer/windows/SAGE.iss:31-70`; `SAGE-API/installer/windows/prepare-install.ps1:7-18`; `SAGE-API/installer/windows/complete-install.ps1:26-42`; `SAGE-API/scripts/migration-runner.js:97-135`.
- **Severidade:** **SEV1**.
- **Categoria:** instalação/upgrade / disponibilidade geral.
- **Depende do ambiente:** sim — colisão de porta, ledger inválido, migration incompatível ou estado legado.
- **Confiança:** alta.
- **Sintoma:** `PrepareToInstall` apenas para serviços; Inno copia recursivamente para `{app}`; validações de porta, banco e ledger ocorrem depois, já dentro do provisionamento/setup.
- **Evidência real sanitizada:** `[Files]` precede `ssPostInstall`; ledger só é lido quando `setup-database` aciona o runner; ADR-0013 exige porta no preflight antes de qualquer escrita.
- **Impacto no dado:** uma condição detectável previamente pode deixar sistema inteiro parado/instalação parcialmente sobrescrita, sem caminho seguro para a visita única.
- **Reprodução:** preparar ledger com estado sintético não aplicável ou ocupar a porta, iniciar upgrade e observar parada/cópia antes da recusa.
- **Direção sem código:** preflight somente leitura antes de parar/copiar: plataforma, espaço, porta, estado de serviço, ledger, compatibilidade, backup e rollback ensaiado.
- **Regra/ADR:** ADR-0013 (mitigação obrigatória de porta); ADR-0011 (preparar/verificar antes da virada).

### F-06 — Não existe release público nem canal assinado Ed25519

- **Arquivo+linhas:** `SAGE-API/scripts/assemble-windows-layout.js:146-165`; `SAGE-API/installer/windows/build-installer.ps1:9-18`; `SAGE-API/installer/windows/artifacts.json:18-32`; `_arquitetura/repo/docs/adr/0011-atualizacao-blue-green.md:17-39`.
- **Severidade:** **SEV1**.
- **Categoria:** supply chain / atualização.
- **Depende do ambiente:** não para a ausência; sim para qualquer tentativa de instalar/atualizar fora do protótipo.
- **Confiança:** alta.
- **Sintoma:** layout é forçado a `prototype-only/public:false`; builder recusa público; não há canal, verificador Ed25519, anti-downgrade ou agente de atualização.
- **Evidência real sanitizada:** busca versionada por Ed25519/canal não encontra implementação; manifesto mantém gate de assinatura/licença do MySQL.
- **Impacto no dado:** não há caminho suportado e autenticado para instalar/update; improvisar distribuição expõe toda a escola a pacote adulterado ou a indisponibilidade sem rollback.
- **Reprodução:** tentar produzir layout público ou localizar fluxo “consultar → baixar → verificar assinatura → ativar”; ambos inexistem/recusam.
- **Direção sem código:** concluir gates legais/assinatura e implementar canal estritamente versionado, assinado, anti-downgrade e testado ponta a ponta.
- **Regra/ADR:** ADR-0011 (Ed25519, canal sem shell e rollback); ADR-0013 (gate de redistribuição).

### F-07 — `postinstall` altera estado e engole qualquer falha

- **Arquivo+linhas:** `SAGE-API/package.json:9-14`; `SAGE-API/scripts/check-first-run.js:6-25`; `SAGE-API/.github/workflows/ci.yml:47-50`.
- **Severidade:** **SEV3**.
- **Categoria:** setup / falso sucesso.
- **Depende do ambiente:** sim — permissão, diretórios e presença do exemplo.
- **Confiança:** alta.
- **Sintoma:** todo `npm install` cria diretórios/copia configuração; catch vazio força sucesso, e CI precisa desabilitar scripts.
- **Evidência real sanitizada:** comentário “Silenciar erros no postinstall” e bloco sem registro/rethrow.
- **Impacto no dado:** setup parcial é aceito como instalado; perfis CI/local/Windows deixam de ser equivalentes.
- **Reprodução:** negar escrita ao destino e executar o hook em sandbox; processo não sinaliza a falha.
- **Direção sem código:** setup explícito, idempotente e fail-fast; instalação de dependência sem efeito colateral ambiental.
- **Regra/ADR:** AGENTS §4.2. **Duplicata:** fatia D (postinstall silencioso); consolidar uma vez.

### F-08 — Ranges de dependência permitem árvores diferentes fora do lock

- **Arquivo+linhas:** `SAGE/package.json:10-27,47-49`; `SAGE-API/package.json:19-46`; ambos os `package-lock.json`.
- **Severidade:** **SEV3**.
- **Categoria:** reprodutibilidade / supply chain.
- **Depende do ambiente:** sim — `npm install`, regeneração de lock ou automação que não use `npm ci`.
- **Confiança:** alta.
- **Sintoma:** grande parte das dependências usa `^`; o builder é determinístico com lock, mas outros caminhos aceitam minor/patch novos.
- **Evidência real sanitizada:** ranges no manifesto coexistem com `postinstall` e instruções locais baseadas em install.
- **Impacto no dado:** máquinas/épocas distintas podem receber código transitivo diferente sem revisão, afetando build e runtime.
- **Reprodução:** comparar resolução pelo lock com resolução permitida após regenerá-lo em ambiente descartável.
- **Direção sem código:** política única de lock/`npm ci`, atualização automatizada revisada e provenance do artefato.
- **Regra/ADR:** build reproduzível e verificável.

### F-09 — CI usa imagens/actions flutuantes e não fixa Node 24 exato

- **Arquivo+linhas:** `SAGE-API/.github/workflows/ci.yml:13-23,39-45`; `SAGE-API/.github/workflows/windows-native.yml:20-40`.
- **Severidade:** **SEV3**.
- **Categoria:** CI / reprodutibilidade.
- **Depende do ambiente:** sim — atualização dos tags remotos.
- **Confiança:** alta.
- **Sintoma:** runner `*-latest`, MySQL `8.4`, actions por major e Node `24` mudam sem alteração do repositório, enquanto o payload fixa versão exata.
- **Evidência real sanitizada:** tags literais não imutáveis nos YAML; builder exige apenas major 24.
- **Impacto no dado:** o mesmo commit pode passar/falhar ou produzir binário nativo diferente em datas distintas.
- **Reprodução:** resolver os tags em dois momentos ou comparar Node do CI com `artifacts.json`.
- **Direção sem código:** fixar digests/SHAs e versão exata de Node/MySQL; atualizar por PR controlado.
- **Regra/ADR:** artefato verificável; ADR-0011 (hash/proveniência).

### F-10 — Configuração de ambiente é espalhada e não tem schema central

- **Arquivo+linhas:** `SAGE-API/.env.example:1-144`; `SAGE-API/src/config/database.js:7-22`; `SAGE-API/src/jobs/scheduledJobs.js:14-308`; `SAGE-API/src/services/deviceService.js:24-479`; `SAGE-API/scripts/*.js`.
- **Severidade:** **SEV3**.
- **Categoria:** configuração / validação.
- **Depende do ambiente:** sim — variável ausente, inválida ou default divergente.
- **Confiança:** alta.
- **Sintoma:** dezenas de consumidores fazem parse/default local; não há catálogo tipado único nem prova de cobertura do exemplo.
- **Evidência real sanitizada:** busca encontra 144 ocorrências de `process.env` em `src/scripts/index`; offsets, portas, crons e booleanos têm semânticas locais.
- **Impacto no dado:** erro de digitação/default pode alterar sync, jobs, banco ou timeout sem falha de inicialização.
- **Reprodução:** remover/invalidar variáveis sintéticas e comparar comportamento de consumidores distintos.
- **Direção sem código:** schema único, tipos/limites, required por perfil, erro de boot acionável e geração do exemplo/instalador pela mesma fonte.
- **Regra/ADR:** configuração fail-fast. **Sobreposição:** fatia D (runtime/configuração).

### F-11 — SMTP é anunciado, mas não existe consumidor de runtime

- **Arquivo+linhas:** `SAGE-API/.env.example:117-126`; `SAGE-API/package.json:34`; `SAGE-API/test/dependencias-email-config.test.js:1-12`.
- **Severidade:** **SEV3**.
- **Categoria:** configuração obsoleta / segredo desnecessário.
- **Depende do ambiente:** não para a ausência; sim para o custo de provisionar credenciais.
- **Confiança:** alta.
- **Sintoma:** sete chaves de e-mail são documentadas; `nodemailer` só é carregado por teste.
- **Evidência real sanitizada:** busca versionada não encontra leitura runtime das chaves nem transporte real.
- **Impacto no dado:** operador pode armazenar segredo sem efeito e confiar em recuperação de acesso inexistente.
- **Reprodução:** buscar nomes das chaves/import de `nodemailer` excluindo lock/teste.
- **Direção sem código:** remover contrato/dependência ou implementar requisito completo com configuração validada e sem logar segredo.
- **Regra/ADR:** AGENTS §4.4; minimização de segredo.

### F-12 — Pacotes não usados e ferramentas dev estão classificados como runtime

- **Arquivo+linhas:** `SAGE/package.json:10-26,47-49`; `SAGE-API/package.json:19-46`.
- **Severidade:** **SEV3**.
- **Categoria:** dependências / separação dev-produção.
- **Depende do ambiente:** sim — instalação, scanner e payload.
- **Confiança:** alta para imports literais; média para ausência de carregamento dinâmico.
- **Sintoma:** frontend inclui bibliotecas de teste/servidor no runtime; API declara dois clientes Redis e pacotes sem import de produção demonstrado.
- **Evidência real sanitizada:** comparação entre specifiers literais versionados e chaves dos manifestos.
- **Impacto no dado:** superfície de supply chain, download e alertas maiores; riscos de build são classificados como runtime.
- **Reprodução:** extrair `import/require` literais e confrontar com `dependencies`, preservando peers/scripts.
- **Direção sem código:** remover não usados e separar teste/build/runtime; gate de dependências no CI.
- **Regra/ADR:** dependências mínimas e artefato auditável.

### F-13 — Frontend não possui CI próprio/requerido

- **Arquivo+linhas:** `SAGE/` (ausência de `.github/workflows`); `SAGE-API/.github/workflows/ci.yml:6-13`; `SAGE-API/.github/workflows/windows-native.yml:1-23,89-103`.
- **Severidade:** **SEV2**.
- **Categoria:** CI/CD / integração de release.
- **Depende do ambiente:** não para a ausência.
- **Confiança:** alta.
- **Sintoma:** PR/push do frontend não dispara lint/test/build versionado no próprio repositório; o build cruzado Windows vive na API e não protege toda mudança do SAGE.
- **Evidência real sanitizada:** diretório de workflows ausente no frontend; CI principal da API só conhece sua própria branch/evento.
- **Impacto no dado:** regressão em login, autorização ou UI de operação pode entrar sem gate e só aparecer ao montar release manual.
- **Reprodução:** abrir PR sintético apenas no frontend e listar checks configurados pelo repositório.
- **Direção sem código:** CI obrigatório no frontend e teste de compatibilidade API+web por manifesto de release/SHAs explícitos.
- **Regra/ADR:** quality gate do artefato efetivamente entregue.

### F-14 — Janela de readiness pode chegar a ~150 s, acima dos 90 s do ADR

- **Arquivo+linhas:** `SAGE-API/installer/windows/provision-services.ps1:270-285`; `SAGE-API/installer/windows/complete-install.ps1:42-47`; `_arquitetura/repo/docs/adr/0011-atualizacao-blue-green.md:23-39`.
- **Severidade:** **SEV3**.
- **Categoria:** timeout / rollback operacional.
- **Depende do ambiente:** sim — endpoint indisponível/lento.
- **Confiança:** alta para o teto derivado; duração real varia porque sucesso/falhas rápidas encerram antes.
- **Sintoma:** 60 tentativas podem consumir 2 s de timeout mais 0,5 s de sleep no catch, chegando a ~150 s; depois há nova chamada de 5 s.
- **Evidência real sanitizada:** `for < 60`, `TimeoutSec 2` e `Start-Sleep 500ms`; ADR exige veredito em até 90 s e reversão em menos de 3 min.
- **Impacto no dado:** atualização prolonga indisponibilidade e pode ultrapassar a promessa operacional antes de iniciar rollback.
- **Reprodução:** manter `/ready` aceitando conexão mas sem responder até o timeout e medir a etapa.
- **Direção sem código:** deadline monotônico global de 90 s, tentativas dentro dele e orçamento total de rollback testado.
- **Regra/ADR:** ADR-0011. **Sobreposição:** fatia D (lifecycle/readiness).

## Duplicatas, descartes e limites

- **F-01** é duplicata material de **B-17**; manter apenas a melhor evidência na contagem consolidada.
- **F-07** duplica o postinstall silencioso da fatia D; **F-03/F-10/F-14** têm sobreposição parcial com configuração/lifecycle de D.
- Nenhum achado adicional de vulnerabilidade foi criado apenas por faixa/CVSS: severidade SAGE exige consequência demonstrável.
- Não houve `npm install`, download, build, execução do instalador, alteração de serviço ou uso de `.env` real.
