# Segunda auditoria — independente, 2026-08-11

Auditoria feita por outro agente, sobre **o mesmo snapshot** que a primeira:
`wip/recuperacao-local-pre-auditoria`, backend `9e3eaba`, frontend `06c1ed4`.

- **92 achados** consolidados de 119 brutos: 4 SEV1, 65 SEV2, 23 SEV3
- **6 fatias (A–F)**. Não tem fatia G (harness de teste) nem H (instalador Windows)
- **Não alterou código.** Os dois clones estavam limpos nos commits acima
- Análise estática; o próprio relatório registra que Node/npm não estavam disponíveis

## Como usar isto

**Não é a fonte do plano.** A fonte continua sendo `PLANO-POS-AUDITORIA.md`, que já recebeu
o enxerto do que valia aqui — os itens marcados `[+2A-*]` naquele documento apontam para cá.

Consulte estes arquivos quando precisar da **evidência completa** de um achado enxertado:
`file:line`, sintoma, reprodução e regra violada estão detalhados nas fatias.

## O que ela pegou e a primeira não

| ID dela | O quê | Foi para |
|---|---|---|
| B-14 / M-002 | `DELETE /dispositivos` apaga todo usuário com prefixo `11` de todas as catracas — **SEV1** | R0-05 |
| E-16 | Falha de detach escala para deleção total da aula | R0-05 |
| E-17 | GET falho habilita `PUT horarios: []` | R0-05 |
| E-21 | `payload.foto = "foto_exemplo.png"` — dado inventado | R0-07 |
| C-10 | Caminho de foto sem contenção antes de `unlinkSync` | R1 |
| E-20 | Identidade real de unidade no bundle como fallback | R1 |
| E-05 / E-07 / E-08 | Contrato Socket.IO quebrado — realtime pode não funcionar | R1 |
| E-02 | HTTP puro, sem TLS em lugar nenhum | R2 (decisão de arquitetura em aberto) |
| A-04 | Saída sobrescreve a chegada do dia — **dado já corrompido no banco** | R4 |
| A-09 | Mesma coluna com UTC ingênuo e UTC−03 | R4 |
| B-24 | Importação da catraca deduplica pessoa por nome | R4 |
| B-11 | Todo mundo vai para `group_id: 1`, "libera todo mundo" | R8 + pergunta de campo |

Verificados na fonte pelo arquiteto antes do enxerto: **B-14, B-11, A-04**. Os demais entraram
pela evidência apresentada.

## O que a primeira tem e esta não

- **A-008** — `DELIMITER $` em `database/sage.sql:321` quebra a instalação limpa. O `[BLOQUEIA TUDO]`
- **H-001** — versão congelada em `1.0.0`; duas builds na mesma pasta
- **H-002** — contrato de faixa de schema; o rollback morre justamente na atualização que muda schema
- **Fatia G** inteira — o harness de teste como assunto, base do R-LAB

## Achado que nenhuma das duas pegou

`src/utils/controlId-utils.js:236` — `catch (err)` cujo corpo referencia `error`. O caminho de
erro lança `ReferenceError` e destrói a causa original. Registrado em R0-07.
