# F8 — artefatos de campo do instalador Windows

Dois arquivos resgatados de `SAGE-WS/f8-windows-work/`, que existia **apenas no disco do
macOS** e não estava em repositório nenhum. Datam de 2026-08-03/04, antes da auditoria.

| Arquivo | O que é |
|---|---|
| `run-f8-provision.ps1` | wrapper que encadeia `initialize-state`, `initialize-mysql` e `provision-services -StartApi`, gravando `provision-status.json` num `finally`. Roda contra `C:\Program Files\SAGE\service` |
| `prompt-cli.txt` | prompt de handoff para o agente na VM Windows, com o estado observado na época: `SAGEAPI` em crash loop com exit 1067 do SCM, `provision-services -StartApi` falhando porque `/ready` não respondia, 30/30 contratos Windows passando |

## O que ficou de fora, e por quê

O resto de `f8-windows-work/` são **625 MB de binários de terceiros e cópias dos repos**:
`mysql-8.4.11-winx64.zip` (268 MB), `node-v24.18.0-win-x64.zip` (35 MB) mais a árvore
descompactada, `WinSW-x64.exe` (17 MB), `innosetup-6.7.3.exe` (10 MB) e um snapshot
`api.zip`/`web.zip` de uma sessão de provisionamento.

Nada disso sobe: o zip do MySQL sozinho passa do limite de 100 MB por arquivo do GitHub, e o
snapshot é cópia de código que já está versionado. Binário de terceiro se baixa de novo pela
URL e se confere por SHA-256 — é o que o `[H-007]` do plano manda o CI fazer.

**O conteúdo do `prompt-cli.txt` está superado.** Ele aponta para caminho de pasta compartilhada
do VMware e descreve um estado anterior à R0/R1. Vale como registro do que já se sabia sobre o
crash loop do serviço, não como instrução.
