# Catálogo de erros

Todo código de erro visível no SAGE é estável, documentado e único — ver a distinção entre
código de erro e identificador de ocorrência em [diagnóstico](diagnostico.md). Este arquivo é
o catálogo. Ele existe para responder em dois minutos daqui a um ano, quando os detalhes do
incidente original já foram esquecidos.

**Convenção de prefixo:**

| Prefixo | Domínio |
|---|---|
| `SYS` | Sistema operacional / máquina (instalação) |
| `PORT` | Porta de rede ocupada (instalação) |
| `NET` | Conectividade de internet (instalação) |
| `DEP` | Dependência ausente, ex. VC++ Redistributable (instalação) |
| `TIME` | Relógio do sistema (instalação) |
| `AV` | Antivírus / Defender bloqueando (instalação) |
| `CAT` | Catraca Control iD |
| `DB` | Banco de dados |
| `SYNC` | Sincronização com a catraca |
| `UPD` | Atualização remota |

**Modelo de entrada:**

```markdown
### CODIGO-NN — <titulo curto>
**Causa provável:**
**Verificar:**
**Resolver:**
**Histórico:** <data — o que era daquela vez>
```

O campo **Histórico é o mais valioso do documento.** Ele começa vazio ou genérico em toda
entrada nova e cresce a cada incidente real — é o que transforma um catálogo teórico num
registro de campo. Adicione uma linha de histórico toda vez que o código aparecer de verdade,
mesmo que a causa já fosse conhecida.

---

## Instalação

### SYS-01 — Versão do Windows não suportada
**Causa provável:** Windows anterior ao 10, Windows Server anterior ao 2016, ou arquitetura
diferente de x64.
**Verificar:** versão e arquitetura reportadas pelo preflight.
**Resolver:** não há contorno — a máquina precisa atender ao requisito mínimo.
**Histórico:** (nenhum incidente registrado ainda)

### SYS-02 — Espaço em disco insuficiente
**Causa provável:** menos de 5 GB livres em `C:`.
**Verificar:** espaço livre reportado pelo preflight.
**Resolver:** liberar espaço em `C:` e rodar o instalador de novo (idempotente).
**Histórico:** (nenhum incidente registrado ainda)

### SYS-03 — Sem permissão de escrita em `C:\ProgramData`
**Causa provável:** instalador não executado como administrador.
**Verificar:** se o instalador foi aberto com "Executar como administrador".
**Resolver:** reexecutar com privilégio de administrador.
**Histórico:** (nenhum incidente registrado ainda)

### PORT-01 — Porta 3000 ou 33306 ocupada
**Causa provável:** outro programa já está escutando na porta.
**Verificar:** qual processo ocupa a porta (o preflight já identifica e mostra).
**Resolver:** encerrar o programa em conflito ou reiniciar a máquina e tentar de novo.
**Histórico:** (nenhum incidente registrado ainda)

### NET-01 — Sem internet no primeiro run
**Causa provável:** máquina sem conexão, ou proxy não detectado corretamente.
**Verificar:** teste de saída HTTPS do preflight.
**Resolver:** conectar a máquina à internet antes de instalar. A instalação recusa começar sem
escrever nada em disco.
**Histórico:** (nenhum incidente registrado ainda)

### DEP-01 — VC++ Redistributable ausente
**Causa provável:** dependência de sistema não presente na máquina.
**Verificar:** detecção automática do preflight.
**Resolver:** o instalador aplica automaticamente, reaproveitando o UAC já concedido — não
deveria exigir ação manual.
**Histórico:** (nenhum incidente registrado ainda)

### TIME-01 — Relógio do sistema com desvio maior que 5 minutos
**Causa provável:** relógio da máquina errado ou fuso configurado incorretamente.
**Verificar:** desvio calculado pelo preflight contra hora de referência.
**Resolver:** corrigir data/hora do Windows antes de instalar. **Crítico:** relógio errado
quebra a validade de JWT e a correlação de horário dos logs da catraca.
**Histórico:** (nenhum incidente registrado ainda)

### AV-01 — Antivírus ou Defender bloqueando
**Causa provável:** proteção em tempo real interferindo na escrita ou execução do instalador.
**Verificar:** detecção do preflight; testar com a proteção temporariamente pausada.
**Resolver:** orientar exceção de pasta para `C:\ProgramData\SAGE`.
**Histórico:** (nenhum incidente registrado ainda)

### SETUP-NET-01 — Sem internet para baixar o MySQL embarcado
**Causa provável:** o primeiro run do setup do MySQL precisa baixar o ZIP oficial da Oracle e
não encontrou conexão.
**Verificar:** teste de saída específico do passo de aquisição do MySQL.
**Resolver:** conectar a máquina à internet. Nada é extraído nem escrito em disco até o
download e a verificação de hash passarem — ver
[ADR-0001](../adr/0001-mysql-embarcado.md).
**Histórico:** (nenhum incidente registrado ainda)

---

## Catraca

### CAT-CONN-03 — Sem resposta da catraca
**Causa provável:** cabo, catraca desligada, ou IP mudou.
**Verificar:** ping no IP; `/dispositivos/status`.
**Resolver:** conferir cabo; se o IP mudou, reconfigurar em Dispositivos.
**Histórico:** 12/03 — foi o cabo. 07/05 — DHCP trocou o IP.

---

## Atualização

### UPD-READY-FAIL — Atualização não passou no `/ready` e voltou sozinha
**Causa provável:** a versão nova falhou no check de prontidão pós-atualização (banco, catraca
ou app não responderam dentro do prazo).
**Verificar:** log do updater; resultado do `/ready` na tentativa; versão que ficou ativa.
**Resolver:** nenhuma ação imediata é necessária — o sistema já reverteu sozinho para a versão
anterior. Investigar a causa da falha antes de tentar publicar de novo.
**Histórico:** (nenhum incidente registrado ainda)
