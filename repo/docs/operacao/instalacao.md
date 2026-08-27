# Instalação

**Objetivo:** um `.exe` que uma secretária não-técnica baixa de uma landing page, executa,
aprova o UAC uma vez, preenche três campos, e tem o sistema funcionando — sem que nada morra na
cara dela, e mantível remotamente por alguém que não está lá.

---

## 1. Layout de diretórios

```
C:\ProgramData\SAGE\
├── releases\
│   ├── 1.4.1\          ← versão anterior, mantida
│   └── 1.4.2\          ← nova
├── current  →  junction para releases\1.4.2
├── dados\              ← uploads, exports, backups (NUNCA dentro de releases)
├── config\sage.env     ← ACL restrita
└── logs\
```

**Por que não em `C:\Program Files\SAGE`:** toda atualização feita ali pediria elevação de
administrador — ou seja, dependeria da secretária clicar no UAC a cada release. O sistema de
atualização automática morreria no primeiro dia.

A instalação em `C:\ProgramData\SAGE` recebe as permissões ajustadas **uma única vez**, durante
o setup (o único clique de admin que existe no fluxo). Depois disso, o app escreve na própria
pasta sem nunca mais pedir elevação.

Regra estrutural: nenhum estado gravável mora dentro da pasta de release — senão a atualização
apaga dados ao trocar o código.

---

## 2. Preflight — nada é escrito antes de tudo passar

Dez verificações, nesta ordem, antes do primeiro byte em disco. A justificativa de fundo (por
que o instalador nunca assume o estado da máquina) está em
[ADR-0003 — Estado da máquina é desconhecido](../adr/0003-estado-da-maquina-desconhecido.md).

| # | Verificação | Se falhar |
|---|---|---|
| 1 | Windows 10+ / Server 2016+, x64 | `SYS-01` — versão não suportada |
| 2 | ≥ 5 GB livres em `C:` | `SYS-02` — libere espaço |
| 3 | Escrita em `C:\ProgramData` | `SYS-03` — execute como administrador |
| 4 | Portas 3000 e 33306 livres | `PORT-01` — mostra qual programa ocupa |
| 5 | Internet + detecção de proxy | `NET-01` — instalação precisa de internet |
| 6 | VC++ Redistributable presente | `DEP-01` — instala automaticamente (usa o UAC já concedido) |
| 7 | Relógio do sistema com desvio < 5 min | `TIME-01` — **crítico**: relógio errado quebra JWT e a correlação de logs da catraca |
| 8 | Instalação anterior existe? | Entra em modo upgrade, preserva `dados/` |
| 9 | Defender/antivírus bloqueando? | `AV-01` — orienta exceção de pasta |
| 10 | IP local da máquina | Guarda para configurar callback da catraca |

O passo 2 (MySQL embarcado, baixado no primeiro run) tem requisitos e riscos próprios já
registrados em [ADR-0001 — MySQL embarcado, sem MSI](../adr/0001-mysql-embarcado.md) — não
repetidos aqui.

---

## 3. Ledger de instalação e rollback

`dados/instalacao-ledger.json` registra cada passo como `{passo, inicio, fim, status,
desfazer}`. Falha em qualquer passo aciona o desfazimento na ordem inversa: falhar no passo 7
desfaz 6, 5, 4… até a máquina voltar ao estado anterior à instalação. Nunca deixa entulho.

Ao final de uma instalação bem-sucedida, o mesmo ledger vira o registro de auditoria de quando
e como o sistema foi instalado.

Propriedades exigidas:

- Falha induzida em qualquer passo de 1 a 10 deixa a máquina **idêntica** ao estado inicial
  (árvore de arquivos e registro comparáveis)
- Toda mensagem de erro visível ao usuário é em português, sem stack trace, sem termo técnico
- Todo código de erro é único e rastreável a uma linha do código
- Rodar o instalador duas vezes seguidas é seguro (idempotente)

---

## 4. Download e primeira execução: SmartScreen

O instalador continua **sem assinatura Authenticode**, conforme
[ADR-0002](../adr/0002-assinatura-signpath.md). Isso explica o alerta, mas não prova que o
arquivo é seguro e não autoriza prometer que alertas desaparecerão no futuro. A distribuição
permanece assim até decisão posterior, mesmo que uma rota de assinatura esteja em avaliação.

### Antes de abrir o arquivo

1. Baixe somente da página oficial. Confira versão, commit de origem e SHA-256 publicados.
2. Se o navegador bloquear ou marcar o download, não abra nem desative o Defender. Primeiro
   confirme a página oficial e o hash; se não houver hash publicado ou o arquivo estiver
   incompleto, mantenha-o bloqueado e procure o suporte.
3. Para conferir o arquivo baixado, o suporte pode orientar este comando no PowerShell:

   ```powershell
   Get-FileHash -Algorithm SHA256 -LiteralPath "$env:USERPROFILE\Downloads\SAGE-Setup.exe"
   ```

   O resultado deve ser **idêntico** ao SHA-256 da página, sem aceitar “parecido”. Se não
   coincidir, não execute: preserve a versão e o hash observado para o suporte.

### Cenário A — o navegador alerta ou bloqueia o download

O alerta pode ser de reputação, origem da internet ou política da escola. A pessoa não deve
contorná-lo às cegas. Com origem e hash conferidos, a opção do navegador para conservar o
arquivo só deve ser usada se a política da escola permitir; não altere política, antivírus,
registro ou configurações de segurança. Se a opção não existir, ou se a escola bloquear o
arquivo, pare e envie ao suporte a versão, os dois hashes e o código de instalação, sem
enviar nome, documento, senha ou token.

### Cenário B — “O Windows protegeu o seu PC” ao executar

Mensagem para a pessoa não técnica:

> O Windows mostrou este aviso porque o instalador atual não tem assinatura de código.
> Isso não confirma nem descarta um problema. Confira a página oficial e compare o
> SHA-256 antes de continuar. Se o código não for idêntico, não execute e fale com o
> suporte.

Depois de o hash coincidir e a política da escola permitir a instalação:

1. clique em **Mais informações**;
2. confira que está usando o arquivo e a versão esperados;
3. clique em **Executar assim mesmo** e depois aprove o UAC uma vez.

Se **Executar assim mesmo** não aparecer, se o UAC for negado ou se a mensagem mudar, não
desative a proteção e não tente outro arquivo: pare e acione o suporte. A captura de tela
real ainda é pendência; só será incorporada após captura e validação na versão de Windows
usada pela escola.

### Cenário C — política, hash ou validação indisponível

Política de TI que bloqueie binário não assinado, hash ausente/divergente, página oficial
indisponível ou serviço de validação sem resposta são motivos para **não publicar, não
executar e não recomendar contorno**. O suporte registra a versão, commit, execução de
build, hash publicado/observado e código de instalação. Não se registra dado pessoal.

### Suporte, rollback e incidente

- **Falha na instalação:** o ledger desfaz as etapas na ordem inversa. Em upgrade, a versão
  anterior permanece selecionável; `dados/`, `config/` e `logs/` nunca são removidos pelo
  rollback. A regra de troca de versão é a do [ADR-0011](../adr/0011-atualizacao-blue-green.md).
- **Artefato suspeito após publicação:** bloquear novos downloads e atualizações, conservar
  o manifesto e a evidência rastreável, avisar o mantenedor e só liberar substituto depois
  de verificar novamente origem, hash e assinatura exigida. Não apagar instalações ou
  dados automaticamente.
- **Assinatura futura revogada ou validação indisponível:** fail-closed para publicação e
  promoção. O status do artefato já publicado fica pendente de análise; não se declara que
  ele é válido nem se instrui sua execução. O canal automático continua aceitando somente
  o JSON com Ed25519 válido, independentemente do Authenticode do instalador.

### Estado das evidências

- **Fato versionado:** ADR-0002 mantém a distribuição sem Authenticode; ADR-0011 mantém a
  exigência Ed25519 para atualização. Não há certificado, pedido ao SignPath, resposta da
  escola, screenshot real ou run de CI comprovando assinatura neste repositório.
- **Decisão deste runbook:** exigir origem, SHA-256 e a política de fail-closed; nunca dizer
  para ignorar o alerta e nunca prometer ausência de alertas.
- **Pendente/owner:** dono do produto deve obter a política de TI da escola e a evidência
  do provedor/rota de assinatura; o Engenheiro Pleno deve executar a matriz operacional.
- **Ainda não validado:** download e execução em cada Windows/navegador da escola, hash
  divergente, bloqueio por política, indisponibilidade de validação, incidente pós-publicação,
  rollback e compreensão da mensagem por pessoa não técnica.

---

## 5. Fluxo do assistente — 6 telas, sem jargão

1. **Boas-vindas** — o que vai acontecer, quanto tempo leva (~5 min)
2. **Verificação** — lista do preflight com ✓ / ✗ ao vivo. Falha mostra o que fazer, e o botão
   "Verificar de novo"
3. **Instalação** — barra com etapa nomeada ("Preparando o banco de dados…"). Nunca uma barra
   parada sem texto
4. **Configuração** — só três coisas:
   - Nome da escola
   - Senha do administrador (com medidor de força)
   - Catraca: botão "Procurar catracas na rede", que varre a `/24` local e lista o que
     encontrar — a pessoa não sabe o IP e não deveria precisar saber
5. **Teste** — testa banco, catraca e internet ao vivo, com ✓ / ✗. Falha na catraca **não**
   impede concluir (pode ser cabo solto), mas fica registrada
6. **Pronto** — atalhos criados, e um **código de instalação** grande na tela, para enviar por
   mensagem ao mantenedor. O código informa versão, resultado do preflight e IDs — sem nenhum
   dado pessoal

Três atalhos de área de trabalho, sem mais nada além disso: **SAGE**, **Reiniciar SAGE**,
**Gerar diagnóstico SAGE**.

Critérios de aceite do fluxo:

- Uma pessoa não-técnica completa a instalação sem ajuda — testado com alguém de verdade
- Nenhuma tela mostra caminho de arquivo, porta ou termo técnico
- A varredura de rede encontra a catraca em < 30 s numa `/24`
- Fechar a janela no meio aciona rollback completo
- Instalação completa em < 8 min em HD mecânico

---

## 6. Definição de Pronto — matriz de cenários de teste

O `.exe` só vai para a landing page depois de passar nesta matriz. Use VMs descartáveis —
snapshot antes, restaura depois.

| Cenário | Resultado esperado |
|---|---|
| Windows 10 x64 limpo | Instala e funciona |
| Windows 11 x64 limpo | Instala e funciona |
| Máquina com MySQL em 3306 | Instala sem conflito |
| Máquina sem internet | Recusa com `NET-01`, nada escrito |
| Disco com 2 GB livres | Recusa com `SYS-02`, nada escrito |
| Sem privilégio de admin | Recusa com `SYS-03`, orienta |
| Defender em modo agressivo | Instala ou orienta exceção |
| Instalar sobre versão anterior | Upgrade preserva dados |
| Cancelar no meio | Rollback total, máquina limpa |
| Desligar no botão durante uso | Recupera no próximo boot |
| Catraca desconectada | Instala, avisa, sistema funciona |
| Relógio 3 h adiantado | Detecta e alerta antes de instalar |
| Rodar o instalador 2x | Idempotente |
| Desinstalar | Remove tudo, pergunta sobre os dados |

**Regra de ouro:** todo cenário de falha precisa ser testado com alguém não-técnico olhando a
tela. Se a pessoa não souber o que fazer em 10 segundos lendo a mensagem, a mensagem está
errada.
