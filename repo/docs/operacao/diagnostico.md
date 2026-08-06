# Diagnóstico

O que este documento descreve tem nome consolidado na indústria: **support bundle** (ou
*diagnostic bundle*). Não é gambiarra específica do SAGE — é padrão: Kubernetes tem
`support-bundle`, Cisco tem `show tech-support`, Datadog chama de *flare*, Atlassian de
*support zip*, VMware de *support bundle*. Todo software sério que roda na infraestrutura do
cliente tem um.

Um relato profissional de problema tem **três camadas**. A maioria dos projetos implementa só
a primeira.

---

## Camada 1 — Automática, contínua, anônima

O sistema relata sozinho, sem ninguém pedir: heartbeat, logs redigidos, erros no Sentry (ver
[manutenção remota](manutencao-remota.md)). Cobre a maior parte dos problemas, porque o
mantenedor fica sabendo antes de a secretária perceber.

Conceito central aqui: **agrupamento por assinatura**. O Sentry agrupa erros pela pilha de
chamada, então mil ocorrências do mesmo bug viram um item com contador. Sem isso, o ruído
afoga qualquer sinal.

---

## Camada 2 — O código de referência

Todo erro visível a quem usa o sistema carrega um identificador curto. Isso é universal em
software profissional: Oracle tem `ORA-01017`, Windows tem `0x80070005`, HTTP tem `404`.

```
┌─────────────────────────────────────────────┐
│  ⚠ Não foi possível conectar à catraca      │
│                                             │
│  O sistema continua funcionando e vai       │
│  tentar de novo automaticamente.            │
│                                             │
│  O que fazer: confira o cabo de rede da     │
│  catraca. Se persistir, avise o suporte.    │
│                                             │
│  Código: CAT-CONN-03                        │
│  Referência: 7K2M-9XQ4                      │
└─────────────────────────────────────────────┘
```

Duas coisas diferentes aparecem ali, e a distinção importa:

- **`CAT-CONN-03`** é o **código do erro** — estável, documentado, sempre o mesmo para essa
  causa. Mantido no [catálogo de erros](erros.md). Lido ao telefone, já identifica do que se
  trata.
- **`7K2M-9XQ4`** é o **identificador da ocorrência** — único daquele evento específico.
  Aparece no log e no Sentry. Com ele, é possível localizar exatamente aquele momento, com todo
  o contexto.

Esse par transforma "não tá funcionando" em diagnóstico preciso, sem a pessoa precisar
descrever nada.

---

## Camada 3 — O support bundle

Entra em jogo quando as duas primeiras não bastam — tipicamente quando a internet estava fora
justo na hora da falha.

Um atalho na área de trabalho, **"Gerar diagnóstico SAGE"**, produz um `.zip` num clique.

### O que um bundle profissional contém

| Seção | Conteúdo |
|---|---|
| Manifesto | O que tem dentro, quando foi gerado, ID do bundle |
| Versões | App, schema, Node, MySQL, Windows |
| Saúde | Snapshot de `/health` e `/ready` |
| Configuração | O `.env` **com todo segredo mascarado** |
| Logs | Últimos 3 dias, redigidos |
| Erros | Últimas exceções com pilha |
| Catraca | Teste de conexão, últimas respostas, contagem de logs |
| Banco | Versão do schema, contagem por tabela (números, não linhas) |
| Sistema | Disco, memória, uptime, relógio |
| Rede | Testes de saída, detecção de proxy |
| Instalação | O ledger — o que foi instalado e quando |

### As quatro propriedades que fazem dele profissional

**1. Determinístico.** Sempre coleta as mesmas coisas. Nunca "às vezes vem o log, às vezes
não".

**2. Redigido na coleta, não depois.** A redação acontece enquanto o arquivo é montado, não
como limpeza posterior — limpeza posterior sempre esquece um campo.

**3. Auditável.** Um `LEIA-ME.txt` dentro do zip lista o que foi coletado e afirma que nenhum
dado pessoal está incluído. Se a direção da escola ou um técnico de rede abrir, entende na
hora.

**4. Anônimo por construção.** Contagens em vez de linhas. IDs em vez de nomes. `pessoa_id=4821`,
nunca `João Silva`.

> **Sobre senha no bundle:** senha é remendo para dado que não deveria estar ali. Se a redação
> é boa, senha é teatro; se a redação é ruim, senha só atrasa o vazamento. O controle correto é
> a redação — com teste automatizado que reprova o build se um CPF sintético atravessar. O
> bundle sai sem senha.
