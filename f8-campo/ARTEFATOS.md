# Artefatos binários do F8 — manifesto

Os binários de `SAGE-WS/f8-windows-work/` não cabem no repositório: o zip do MySQL sozinho passa
do limite de 100 MB por arquivo do GitHub. Eles foram para **assets de release** do
`SAGE-arquitetura` (repositório **privado**), na tag `f8-artefatos-2026-08-03`.

Este arquivo é o que importa preservar mesmo que os assets sumam: **quais versões exatas foram
usadas, e o SHA-256 de cada uma.** Binário de terceiro se rebaixa da origem; o que não se
recupera é saber qual byte foi testado.

## Binários de terceiro

| Arquivo | Bytes | SHA-256 | Origem |
|---|---:|---|---|
| `mysql-8.4.11-winx64.zip` | 281.191.914 | `a492371d687d2bab088b0062581144a0044b8964baefdf4faa579292b423d25c` | dev.mysql.com |
| `node-v24.18.0-win-x64.zip` | 37.176.245 | `0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821` | nodejs.org |
| `WinSW-x64.exe` | 18.243.033 | `05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da` | github.com/winsw/winsw |
| `innosetup-6.7.3.exe` | 10.592.232 | `9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732` | jrsoftware.org |

**As URLs acima são o nome do fornecedor, não a URL exata do download.** Não registrei a URL no
momento em que baixei, e não vou inventá-la agora. Quem reconstruir a partir daqui deve baixar da
página oficial da versão indicada e **conferir o SHA-256 desta tabela antes de usar**. Se não
bater, não é o mesmo artefato que foi testado.

## Payload da sessão de provisionamento

| Arquivo | Bytes | SHA-256 |
|---|---:|---|
| `api.zip` | 3.262.557 | `14b30ee42f673f8a7b6069d6bbdfdd0a69f6b5c07cdd07a0d6b179c93569addb` |
| `web.zip` | 1.324.181 | `e21708858f0b7037490ffdf6da612eb2cfc61a6f9da54e22cd737f57a8c0fc4a` |

Vieram de `session-e0a6070c4c70401b9438165cd584128b/`, de 2026-08-03. **Não sei de qual commit
saíram** — a sessão não registrou o SHA de origem, e é o tipo de coisa que o `[H-001]` do plano
manda consertar: identidade de release real, hoje congelada em `1.0.0`.

## O que não subiu

`node/node-v24.18.0-win-x64/` — é o mesmo zip já descompactado, ~21.500 arquivos. Redundante:
descompacte o zip e confira o hash acima.
