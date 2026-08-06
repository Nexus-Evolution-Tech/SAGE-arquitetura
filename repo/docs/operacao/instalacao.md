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

## 4. O aviso do Windows antes de instalar

O SAGE **não tem certificado de assinatura de código** — ver
[ADR-0002](../adr/0002-assinatura-signpath.md). Consequência: ao executar o instalador, o
Windows mostra a tela azul "O Windows protegeu o seu PC".

Isso é esperado e precisa ser tratado com transparência, não escondido.

### Como a página de download e o guia impresso explicam

O texto abaixo é o modelo. Ele nunca diz "ignore o aviso" — diz o que o aviso significa e
por que aparece neste caso:

> **Você vai ver um aviso do Windows. Isso é normal, e aqui está o porquê.**
>
> O Windows avisa sempre que um programa não tem um "certificado digital" — uma espécie de
> selo pago que empresas compram para identificar seus programas. O SAGE é mantido sem fins
> lucrativos e não tem esse certificado, então o aviso aparece.
>
> O aviso não significa que o programa tenha problema. Significa que o Windows não conhece
> quem o publicou.
>
> **Como continuar:**
> 1. Clique em **Mais informações**
> 2. Clique em **Executar assim mesmo**
>
> **Se quiser conferir que o arquivo é o original**, compare o código abaixo com o do
> arquivo que você baixou (clique com o botão direito → Propriedades → Hashes):
>
> `SHA-256: <publicado a cada versão>`

Acompanhado da captura de tela real, com seta indicando onde clicar.

### Obrigações que isso cria

- O CI **publica o SHA-256** de todo artefato de release. Sem assinatura, o hash é a única
  verificação de integridade que existe — deixa de ser opcional
- A captura de tela precisa ser da versão do Windows que a escola usa. Print de outra
  versão confunde mais do que ajuda
- **Verifique com a escola se existe política de TI que bloqueia executável não assinado.**
  Se existir, esta decisão precisa ser revista antes da entrega, não durante
- O canal de atualização automática continua exigindo assinatura Ed25519 própria
  ([ADR-0011](../adr/0011-atualizacao-blue-green.md)). São camadas diferentes: não ter
  Authenticode não autoriza aceitar pacote não verificado

### Limitação registrada

Isto é estado temporário, não final. Reavaliar quando houver orçamento para certificado, ou
quando o repositório puder voltar a ser público e se qualificar ao SignPath Foundation.

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
