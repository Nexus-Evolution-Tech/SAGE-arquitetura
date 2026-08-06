# SAGE

Sistema de Automação e Gerenciamento Escolar — ETEC de Taboão da Serra.

Plataforma de presença e autorização escolar. Registra entrada e saída de alunos e
funcionários por catraca Control iD, gera folha de ponto e folha de presença, controla
autorizações e apresenta indicadores à secretaria.

**A catraca é um sensor e um atuador — não é o produto.** O produto é a interpretação do
que acontece no portão.

> 🟠 **Alfa em homologação. Não distribuir.**

---

## Para começar

| Você é | Comece por |
|---|---|
| Pessoa nova no projeto | [`docs/README.md`](docs/README.md) |
| Agente de código | [`AGENTS.md`](AGENTS.md) |
| Quem vai instalar | [`docs/operacao/instalacao.md`](docs/operacao/instalacao.md) |
| Quem vai manter remotamente | [`docs/operacao/manutencao-remota.md`](docs/operacao/manutencao-remota.md) |

---

## Stack

Node.js 24 · Express 5 · MySQL 8.4 · Knex · React 19 · Socket.IO · Winston · Vitest

Roda **on-premise**, num PC Windows dentro da escola, desligado toda noite, operado por
uma secretária não-técnica, mantido remotamente sem VPN e sem porta aberta na rede.
Praticamente toda decisão de arquitetura deste repositório deriva dessas restrições — veja
[`docs/adr/`](docs/adr/).

---

## Ambiente de desenvolvimento

```bash
npm ci                    # nunca npm install
cp .env.example .env      # preencha DB_PASSWORD e JWT_SECRET
npm run setup:db          # provisiona o schema
npm run dev               # servidor com hot reload
```

Testes:

```bash
npm run test:db:setup     # banco de teste efêmero
npm test                  # suíte completa
npm run test:redacao      # reprova se PII vazar no log
```

Swagger em `http://localhost:3000/docs` · Saúde em `/health` · Prontidão em `/ready`

---

## Regras que valem para todo código

Detalhe e justificativa em [`AGENTS.md`](AGENTS.md). Resumo:

1. **Nunca invente dado.** Lacuna vira pendência para humano, jamais estimativa
2. **Nunca engula erro.** `catch` vazio é proibido; falha parcial é falha
3. **Nunca registre dado pessoal em log.** `pessoa_id=4821`, jamais `pessoa=João Silva`
4. **Escrita na catraca é idempotente.** `create_or_update_objects`, nunca `create_objects`
5. **Decisão de segurança falha fechada.** Configuração ausente nega
6. **Escrita multi-passo usa transação**
7. **O atualizador nunca toca em `dados/`**

O CI reprova o PR quando alguma delas é quebrada.

---

## Contribuindo

Um pacote por vez, uma branch por pacote, um PR por branch.

```bash
git checkout -b wp/00-emergencia
# ... trabalho ...
# PR referenciando a issue com "Closes #N"
```

Ciclo completo em [`docs/operacao/processo.md`](docs/operacao/processo.md).

---

## Dados

Este sistema trata dados pessoais de menores de idade. A escola é a **controladora**; a
manutenção é **operadora**.

- Nenhum dado real entra no repositório. Desenvolvimento usa apenas seed sintético
- Log, telemetria, issue e PR passam por redação de PII
- Ver [`docs/operacao/manutencao-remota.md`](docs/operacao/manutencao-remota.md)

---

## Licença

MIT — ver [`LICENSE`](LICENSE).
