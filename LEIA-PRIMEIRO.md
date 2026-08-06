# LEIA PRIMEIRO

Entrega de arquitetura do SAGE. Tudo está em [`_arquitetura/`](_arquitetura/).

> **Este documento foi parcialmente superado em 2026-08-05.** Leia
> [`_arquitetura/ESTADO-VERIFICADO.md`](_arquitetura/ESTADO-VERIFICADO.md) antes deste.
> Duas afirmações abaixo estão erradas e foram corrigidas lá: a causa atribuída ao caso dos
> 48.057 logs, e a premissa de que "zero por cento do roadmap está implementado".

---

## ⚠️ Achado urgente — o BUG-1 está ativo agora

Verifiquei nesta máquina. `CATRACA_USER_ID_OFFSET` está **comentado** no `.env`
(linha 56 de `SAGE-API/.env`), então valem os defaults do código — e eles divergem:

| Arquivo | Default | Papel |
|---|---|---|
| `src/services/controlIdService.js:11` | **110000000** | **escreve** o usuário na catraca |
| `src/services/accessService.js:8` | 111000000 | **lê** o log da catraca |
| `src/controllers/deviceController.js:105` | 111000000 | **lê** o log da catraca |

O sistema cria o usuário na catraca com `110000000 + pessoa_id` e depois tenta decodificar
o log subtraindo `111000000`. A diferença é exatamente 1.000.000 — o `pessoa_id` calculado
não existe, e o acesso é descartado.

**~~Isso provavelmente explica o caso registrado em
`SAGE-API/docs/ANALISE_SYNC_CONTROL_ID.md`: 48.057 logs na catraca com zero inseridos no
banco.~~ ERRADO — corrigido em 2026-08-05.**

O bug de offset é real, mas **não** é a causa daquele caso. Os contadores registrados na
ocorrência foram `ignoradosPessoa=0`. Se o offset fosse a causa, os 48.057 logs teriam sido
convertidos para um `pessoa_id` inexistente e apareceriam ali — não em zero. Eles foram
descartados antes, no filtro de `CATRACA_MIN_LOG_ID`. São dois defeitos independentes com o
mesmo sintoma. Ver `_arquitetura/ESTADO-VERIFICADO.md`, seção 0.

Mitigação imediata, antes de qualquer refatoração: descomente a linha 56 do `.env`. Isso
faz os três módulos concordarem em `111000000`.

Atenção — se já existem usuários gravados na catraca com o offset `110000000`, mudar a
variável não conserta o que já está lá. Os usuários antigos precisam ser recriados, ou o
mapeamento precisa tratar os dois offsets durante a transição. Confirme o que está gravado
na catraca antes de decidir.

---

## O que tem aqui

```
_arquitetura/
├── repo/          → copiar para dentro do repositório
├── handoffs/      → prompts para os agentes
└── codigo/        → artefatos prontos, já testados
```

### `repo/` — para copiar no repositório

```
AGENTS.md               regras para agentes de código (Claude Code e Codex)
CLAUDE.md               ponteiro para AGENTS.md
README.md               visão geral       ⚠️ COLIDE com o README.md existente
LICENSE
eslint.config.js        enforça as regras do AGENTS.md
.github/
  ISSUE_TEMPLATE/       3 templates + config
  pull_request_template.md
  workflows/ci.yml      ⚠️ COLIDE com o ci.yml existente
docs/
  README.md             índice e ordem de leitura
  produto/              visao, requisitos, roadmap
  adr/                  12 decisões de arquitetura numeradas
  arquitetura/          sincronizacao, presenca, atualizacao
  operacao/             instalacao, manutencao-remota, diagnostico, processo, erros
    runbooks/           visita-presencial, limpeza-historico
```

### `handoffs/` — prompts prontos

| Arquivo | Para quê | Quando |
|---|---|---|
| `HANDOFF-AUDITORIA.md` | Auditoria completa do código existente | **Agora** |
| `HANDOFF-PREPARACAO.md` | Limpeza do histórico, instalar docs, criar issues | Depois da auditoria |
| `PROMPT-revisor.md` | Revisão de PR antes do merge | A cada PR |

### `codigo/` — artefatos testados

| Arquivo | O que é |
|---|---|
| `supervisor.js` | Mantém o SAGE vivo. Zero dependências. Testado em crash loop e app zumbi |
| `registrar-tarefa.cmd` | Registra o supervisor no Agendador de Tarefas do Windows |

---

## ⚠️ Três colisões a resolver antes de copiar

**1. `docs/` já tem 13 arquivos com conteúdo real** — `PRD.md`, `ROADMAP.md`,
`ARQUITETURA-PROPOSTA.md`, `MANUTENCAO-REMOTA.md`, `ANALISE_SYNC_CONTROL_ID.md`,
`ORDEM_SYNC_CATRACA.md`, entre outros.

**Não sobrescreva.** Alguns deles têm conhecimento de campo que a nova documentação não
tem — o `ORDEM_SYNC_CATRACA.md` e o `ANALISE_SYNC_CONTROL_ID.md` em especial descrevem
comportamento real observado. A reconciliação precisa ser manual ou pedida explicitamente
a um agente, comparando os dois conjuntos.

**2. `.github/workflows/ci.yml` já existe.** Compare antes de substituir; o novo adiciona
barreiras de regra, mas o existente pode ter etapas que ainda importam.

**3. `README.md` já existe.** Integre o que ainda vale em vez de descartar.

---

## Ordem sugerida

**1. Agora — auditoria.** Abra o Claude Code na raiz do workspace e use
`_arquitetura/handoffs/HANDOFF-AUDITORIA.md`. Só levantamento, nada é corrigido.

**2. Volte com o inventário** para revisão contra o contexto arquitetural.

**3. Depois — preparação do repositório** com `HANDOFF-PREPARACAO.md`: limpeza do
histórico (a pasta `database/` tem dados reais), instalação da documentação, criação das
issues.

**4. Então — correção**, um pacote por vez, PR pequeno, CI verde, revisão, merge.

---

## Fora da fila, vale fazer logo

- **Descomentar `CATRACA_USER_ID_OFFSET` no `.env`** e verificar o que já está gravado na
  catraca (ver o achado no topo)
- **Perguntar à escola se existe política de TI que bloqueia executável não assinado.** O
  projeto decidiu distribuir sem assinatura de código
  ([ADR-0002](_arquitetura/repo/docs/adr/0002-assinatura-signpath.md)); se houver política,
  a decisão precisa ser revista antes de construir o instalador, não depois

---

## Nota sobre a visita

O plano é: sanear tudo que depende só do código, ir à escola com um beta sólido, cumprir o
checklist de mapeamento, voltar e fechar o alfa remotamente.

O checklist está em
[`_arquitetura/repo/docs/operacao/runbooks/visita-presencial.md`](_arquitetura/repo/docs/operacao/runbooks/visita-presencial.md).

Dois números para medir lá, que hoje são estimativa e viram configuração:

- Tempo do MySQL do boot até aceitar conexão **naquele HD mecânico** → calibra o
  `SAGE_BOOT_GRACE_MS` do supervisor
- Tempo real do `destroy_objects` na catraca → calibra o `CATRACA_ZERAR_LOGS_TIMEOUT_MS`

E o item de maior valor e menor custo: **rodar o Wireshark enquanto usa o software oficial
da Control iD.** Cinco minutos lá, impossível de obter daqui, e cada resposta capturada
vira fixture permanente.
