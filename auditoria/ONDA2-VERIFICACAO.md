# Onda 2 — verificação do orquestrador

Data: 2026-08-06

Status: concluída e pronta para checkpoint.

## Base e método

- `SAGE-API`: `9e3eaba3475c3e9755f341d29bada059cc6fc5db`
- `SAGE`: `06c1ed4e948236c44926ed13fdb96521dd81d269`
- Branch nos dois repositórios: `wip/recuperacao-local-pre-auditoria`
- Método: análise estática e consultas somente leitura ao Dependabot; nenhuma escrita nos
  repositórios auditados.
- Testes, build e instalação não foram executados: o host tem Node `v18.16.1` e o backend
  exige `>=24 <25`. Nenhuma troca de runtime foi tentada.

Os relatórios de fatia preservam a linguagem e a severidade propostas pelos auditores. As
decisões abaixo substituem essas classificações e aplicam a régua única do projeto: SEV1 =
catraca parada/ninguém entra; SEV2 = perda, corrupção ou exposição silenciosa de dado; SEV3 =
incômodo ou risco com contorno; SEV4 = cosmético/preventivo sem falha demonstrada.

## Calibração privada da fatia D

A fatia D foi aprovada, com **3/3** fatos conhecidos de seu território redescobertos sem
acesso ao gabarito:

- logging de produção: 56 ocorrências lexicais de `console.*` em 13 arquivos; 47 chamadas
  executáveis em 10 arquivos. As nove ocorrências comentadas estão em quatro arquivos; três
  desses arquivos só contêm exemplos comentados;
- ausência de redação central efetiva: D-009/D-010 seguem payloads, linhas, PII e segredo em
  query até os sinks e confirmam que o único logger não os sanitiza;
- ausência de rotação intrínseca no logger: D-009 também identificou corretamente a nuance de
  implantação — o logger só usa console, mas o WinSW do pacote limita stdout a oito arquivos
  de 10 MiB. O risco de retenção sem limite fica restrito às execuções fora desse wrapper.

O `catch` vazio de `deviceController.js` já havia sido redescoberto e validado pela fatia C;
ele não era necessário para aprovar D.

## Verificação da fatia D

| ID bruto | Decisão | Sev final | Nota de verificação |
|---|---|---:|---|
| D-001 | aceito | SEV1 | `parseInt` não rejeita `NaN`; timers Node recebem atraso mínimo e podem saturar API, banco e catracas. Depende de configuração inválida. |
| D-002 | duplicata de C-007 | — | Mesmo ACK HTTP 200 para falha total/parcial do callback Monitor. |
| D-003 | aceito | SEV2 | Sem `SAGE_DATA_DIR`, uploads, backups e exports persistem dentro do release substituível. |
| D-004 | aceito | SEV2 | Script apaga o banco original depois do import sem validar a cópia e ignora `SAGE_CONFIG_FILE`. |
| D-005 | aceito | SEV2 | Script chamado de auditoria executa verbos mutáveis reais e aceita qualquer resposta abaixo de 500 como sucesso. |
| D-006 | aceito | SEV3 | Jobs async, tarefas de boot e chamadas manuais não compartilham mutex/no-overlap. |
| D-007 | aceito | SEV3 | Exceção tardia em `iniciarJobs` perde os handles dos jobs já iniciados. |
| D-008 | aceito | SEV3 | Shutdown só para jobs no callback de `server.close`, não drena tarefas e força saída em cinco segundos. |
| D-009 | aceito | SEV3 | Formato do Winston descarta metadata/stack; não há retenção própria fora do WinSW. |
| D-010 | aceito com escopo reduzido | SEV3 | `originalUrl` duplica C-017; permanecem payloads/linhas/SQL, PII e prompt visível em stdout sem redação central. |
| D-011 | duplicata de C-009 | — | Mesma assinatura anônima de eventos globais por WebSocket. |
| D-012 | duplicata de C-005/C-008 | — | Mesmas rotas de monitoring/diagnóstico sem autenticação e fail-open. |
| D-013 | aceito | SEV3 | Três camadas engolem falha de invalidação e devolvem mutação bem-sucedida com cache velho. |
| D-014 | aceito | SEV3 | Cliente Redis permanece em retry após ping falho enquanto o processo alterna para LRU local. |
| D-015 | aceito | SEV3 | `KEYS` é bloqueante; a tradução de glob para regex no fallback não preserva semântica. |
| D-016 | aceito com escopo reduzido | SEV3 | `/health` falso-positivo duplica C-019; permanece `/ready` caro, sem deadline próprio e exposto a sondagem agressiva. |
| D-017 | aceito | SEV3 | Falhas recorrentes de polling/health ficam apenas em `debug`, abaixo do nível padrão `info`. |
| D-018 | aceito | SEV3 | `unhandledRejection` registra e mantém o processo em estado potencialmente parcial. |
| D-019 | duplicata de B-012 | — | Mesmo dump parcial elegível como backup recente. |
| D-020 | aceito | SEV3 | `postinstall` captura qualquer falha de preparação e termina com falso sucesso. |

A fatia D acrescenta **16 achados únicos: 1 SEV1, 3 SEV2 e 12 SEV3**.

## Verificação da fatia E

Contagem requerida para a R1, validada diretamente em `App.js`, nas 21 telas roteadas e em
`services/api.js`:

- 21 módulos de tela distintos: 18 com HTTP e três sem HTTP;
- **zero telas tratam 403 explicitamente além de 401**;
- **zero telas tratam apenas 401 explicitamente**;
- 13 telas com HTTP dependem exclusivamente do tratamento global;
- cinco telas com HTTP o contornam total ou parcialmente com `fetch` direto;
- 108 callsites HTTP: 99 pelo serviço central e nove `fetch` diretos;
- o tratamento global junta 401 e 403, apaga o token e abre o mesmo modal de sessão expirada.

| ID bruto | Decisão | Sev final | Nota de verificação |
|---|---|---:|---|
| E-001 | aceito | SEV3 | “Liberar acesso” muda o estado visual para sucesso sem request, comando ou trilha; há contorno físico/manual e não é pane global da catraca. |
| E-002 | duplicata de C-002 | — | Mesma ausência de usuário individual/papel, observada no login e na árvore React. |
| E-003 | aceito | SEV3 | 403 apaga token e expulsa uma SECRETARIA ainda autenticada; quebra funcionalmente a R1, sem corromper dado por si. |
| E-004 | aceito | SEV2 | Logout não limpa React Query, Zustand nem notificações persistidas; PII pode atravessar identidades na mesma aba. |
| E-005 | aceito com escopo reduzido | SEV2 | WebSocket anônimo no servidor duplica C-009; permanece token capturado uma vez, sem reconexão/limpeza, e snapshot ADMINISTRADOR sem Bearer. |
| E-006 | aceito | SEV3 | Toda a interface administrativa é exibida a SECRETARIA e negações viram logout, OFFLINE ou vazio. |
| E-007 | aceito | SEV2 | Frontend ignora `precisa_trocar_senha` e mantém troca da credencial compartilhada com mínimo seis, inviabilizando autoria individual confiável da R1. |
| E-008 | aceito | SEV3 | Catches vazios, erro só em console e fallbacks falsos confundem ausência, negação e indisponibilidade. |
| E-009 | duplicata/expansão de D-010 | — | Mesma ausência de redação nos consoles; os 50 sinks frontend ampliam a evidência do achado canônico. |
| E-010 | aceito | SEV3 | Cargas de 500/1.000/10.000, N+1 e keys por índice degradam e podem reaproveitar estado visual incorreto. |
| E-011 | duplicata/expansão de F-005 | — | Mesma mistura de dependências build/teste/runtime e módulos mortos, detalhada pela fatia F. |

A fatia E acrescenta **8 achados únicos: 3 SEV2 e 5 SEV3**.

## Verificação da fatia F

### Reconciliação exata do Dependabot

| Bucket do snapshot | Crítico CVSS | Alto CVSS | Médio CVSS | Baixo CVSS | Total |
|---|---:|---:|---:|---:|---:|
| Transitivas exclusivas CRA/build/teste | 2 | 43 | 29 | 6 | 80 |
| Chegam ao bundle (`react-router` e `lodash`) | 0 | 9 | 8 | 0 | 17 |
| Alerta histórico não mais identificável | 0 | 1 | 0 | 0 | 1 |
| **Snapshot informado** | **2** | **53** | **37** | **6** | **98** |

A API do GitHub expôs 97 alertas abertos na coleta: 2 críticos, 52 altos, 37 médios e seis
baixos. A diferença para o snapshot é exatamente um alerta alto; o pacote/GHSA não foi
inventado. Na lock da branch auditada, 70 dos 97 identificáveis ainda satisfazem suas faixas e
27 já não. Os dois críticos são transitivos de build e já estão fora da faixa na branch por
overrides; os três alertas ainda reproduzíveis que chegam ao bundle são de `lodash` via
`recharts`. Criticidade CVSS não foi convertida automaticamente em SEV1 do SAGE.

| ID bruto | Decisão | Sev final | Nota de verificação |
|---|---|---:|---|
| F-001 | aceito com severidade reduzida | SEV3 | Há 70 faixas vulneráveis na lock, mas 80/98 alertas são build/teste; os dois críticos não reproduzem nesta branch e não demonstram catraca parada. |
| F-002 | duplicata de B-001 | — | Mesmos defaults 110.000.000/111.000.000 de `CATRACA_USER_ID_OFFSET`. |
| F-003 | aceito | SEV3 | Extração automática confirma 93 nomes de env na API e 39 ausentes do exemplo. |
| F-004 | aceito | SEV3 | Sete chaves SMTP anunciadas não têm consumidor; `nodemailer` só aparece em teste. |
| F-005 | aceito | SEV3 | Dependências de teste/build e pacotes sem uso estão declarados como runtime nos dois manifestos. |
| F-006 | aceito | SEV3 | Smoke Windows não acompanha `main` e usa SHA fixo antigo do frontend. |
| F-007 | duplicata de D-020 | — | Mesmo `postinstall` com efeito colateral e `catch` vazio. |
| F-008 | aceito | SEV3 | Sync roda a cada minuto em vez dos cinco documentados e promoção fica desligada quando o instalador omite as chaves. |
| F-009 | aceito | SEV3 | `npm run prod` usa atribuição POSIX e falha no `cmd.exe`, embora o WinSW não use esse script. |
| F-010 | aceito com severidade reduzida | SEV4 | Ausência de lint na API e supressão ampla de source-map são lacunas preventivas, sem falha funcional isolada. |

A fatia F acrescenta **8 achados únicos: 7 SEV3 e 1 SEV4**.

## Totais da Onda 2

- Propostas brutas: 41 (D: 20; E: 11; F: 10).
- Duplicatas integrais ou consolidações sem novo ID: nove.
- Achados únicos acrescentados: **32 — 1 SEV1, 6 SEV2, 24 SEV3 e 1 SEV4**.
- Acumulado após duas ondas: **82 achados únicos — 3 SEV1, 47 SEV2, 31 SEV3 e 1 SEV4**.

## Limitações e precisão

- Os relatórios D/E/F não substituem esta verificação; títulos e severidades brutas são
  preservados apenas para rastreabilidade.
- A contagem de 13 arquivos com `console.*` é lexical. A contagem executável correta é 47
  chamadas em 10 arquivos; nove ocorrências comentadas aparecem em quatro arquivos.
- A rotação de stdout do pacote Windows existe no WinSW (oito arquivos de 10 MiB). O logger
  Winston não tem transporte de arquivo, `maxsize` ou `maxFiles` próprios.
- O Dependabot reflete a default branch e mudou entre o snapshot de 98 e a coleta de 97; a
  identidade da unidade histórica não é recuperável com a API disponível.
- Nenhuma suíte foi executada; nenhuma conclusão dinâmica sobre MySQL, hardware Control iD ou
  Windows instalado foi fabricada.
