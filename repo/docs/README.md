# Documentação do SAGE

Índice e ordem de leitura. Se você é um agente de código, comece por
[`../AGENTS.md`](../AGENTS.md).

---

## Regra que organiza tudo

> **Isso ainda importa depois de feito?**
> Se sim, é documento. Se não, é issue.

A issue **referencia** o documento, nunca duplica. No momento em que a especificação é
copiada para dentro da issue, as duas versões começam a divergir e você para de confiar
nas duas.

---

## Por onde começar

**Primeira vez no projeto** — leia nesta ordem, dá uma hora:

1. [`produto/visao.md`](produto/visao.md) — o que é o SAGE e por que existe
2. [`produto/requisitos.md`](produto/requisitos.md) — o que a secretaria pediu
3. [`produto/roadmap.md`](produto/roadmap.md) — fases, pacotes e ordem
4. [`../AGENTS.md`](../AGENTS.md) — as regras que valem para todo código

**Vai mexer em código** — leia o acima mais o ADR relevante e o documento de arquitetura
da área que você vai tocar.

---

## Estrutura

```
docs/
├── produto/        o que construir e por quê
├── adr/            decisões tomadas — imutáveis, numeradas
├── arquitetura/    como o sistema funciona por dentro
├── operacao/       como instalar, manter e diagnosticar
└── incidentes/     o que já deu errado e o que mudou depois
```

---

## produto/

| Documento | Conteúdo |
|---|---|
| [`visao.md`](produto/visao.md) | Definição, quatro pilares, restrições, o que o SAGE não é |
| [`requisitos.md`](produto/requisitos.md) | Pedido original da secretaria, por tema, com a fase de cada item |
| [`roadmap.md`](produto/roadmap.md) | Fases 0 a 6, pacotes de trabalho, ordem e critérios de aceite |

---

## adr/ — decisões de arquitetura

ADR é **imutável**. Se a decisão mudar, cria-se um novo que supersede o antigo — o
histórico de por que pensávamos diferente fica visível.

| ADR | Decisão | Leia antes de |
|---|---|---|
| [0001](adr/0001-mysql-embarcado.md) | MySQL portable da Oracle, porta 33306, só 127.0.0.1 | Mexer no instalador |
| [0002](adr/0002-assinatura-signpath.md) | Assinatura de código via SignPath Foundation | Empacotar o `.exe` |
| [0003](adr/0003-estado-da-maquina-desconhecido.md) | Instalador detecta e se adapta; preflight obrigatório | Mexer no instalador |
| [0004](adr/0004-runtime-congelado.md) | `node.exe` empacotado, versões exatas, `npm ci` | Mexer em dependência |
| [0005](adr/0005-postura-de-falha-por-fluxo.md) | Entrada libera; saída de menor e visitante bloqueiam | Mexer em autorização |
| [0006](adr/0006-bloqueio-e-controle-administrativo.md) | O bloqueio torna visível, não impede — há passagem lateral | Mexer em autorização |
| [0007](adr/0007-dado-com-peso-legal.md) | Registro imutável, correção rastreável | Mexer em presença ou ponto |
| [0008](adr/0008-politica-no-sage-identidade-na-catraca.md) | Política no SAGE; catraca guarda só identidade | Mexer em sincronização |
| [0009](adr/0009-reconciliacao-em-vez-de-fila.md) | Estado desejado vs observado, não fila de eventos | Mexer em sincronização |
| [0010](adr/0010-voltar-para-knex.md) | Abandonar o query builder caseiro | Mexer em acesso a banco |
| [0011](adr/0011-atualizacao-blue-green.md) | Código descartável, dado sagrado, rollback por `/ready` | Mexer no atualizador |
| [0012](adr/0012-telemetria-nunca-e-requisito.md) | Sem internet, a catraca ainda gira | Mexer em telemetria |

---

## arquitetura/

| Documento | Conteúdo |
|---|---|
| [`sincronizacao.md`](arquitetura/sincronizacao.md) | Replicação de estado com a catraca, reconciliação, e o que está errado no código hoje |
| [`presenca.md`](arquitetura/presenca.md) | Registro imutável, pareamento entrada/saída, fechamento de período |
| [`atualizacao.md`](arquitetura/atualizacao.md) | Blue/green, migrations expand-only, rollback automático |

---

## operacao/

| Documento | Conteúdo |
|---|---|
| [`manutencao-remota.md`](operacao/manutencao-remota.md) | Nada entra, tudo sai: heartbeat, logs redigidos, canal de atualização |
| [`instalacao.md`](operacao/instalacao.md) | Layout de diretórios, preflight, ledger, assistente, matriz de teste |
| [`diagnostico.md`](operacao/diagnostico.md) | Três camadas de relato, código de erro, support bundle |
| [`processo.md`](operacao/processo.md) | Versionamento, canais, severidade, ciclo de trabalho com agentes |
| [`erros.md`](operacao/erros.md) | **Catálogo de códigos de erro — cresce a cada incidente** |
| [`runbooks/visita-presencial.md`](operacao/runbooks/visita-presencial.md) | O que só dá para fazer estando na escola |
| [`runbooks/limpeza-historico.md`](operacao/runbooks/limpeza-historico.md) | Remoção de dado pessoal do histórico do Git |

---

## incidentes/

Um arquivo por incidente, nomeado `AAAA-MM-titulo.md`. Linha do tempo, causa raiz, o que
foi feito, o que mudou no processo para não repetir. Sem procurar culpado — o objetivo é
o sistema, não a pessoa.

---

## Como manter isto vivo

O único passo que depende de disciplina humana, porque não dá para automatizar:

> **Ao fechar um pacote de trabalho: se você aprendeu algo que dura, atualize o documento.
> Se não aprendeu, não atualize nada.**

Documentação que se atualiza por obrigação vira ruído. Documentação que se atualiza por
aprendizado vira memória — e memória é o que falta a um agente que começa do zero toda sessão.

**Onde registrar cada tipo de aprendizado:**

| Aprendeu | Vai para |
|---|---|
| Uma decisão nova | `adr/` — novo arquivo numerado |
| Um erro novo em produção | `operacao/erros.md` — inclusive o campo Histórico |
| Como algo funciona por dentro | `arquitetura/` |
| Algo que a escola pediu ou mudou | `produto/requisitos.md` |
| Um incidente | `incidentes/` |
| Nada que dure | Lugar nenhum. Fecha a issue e segue |
