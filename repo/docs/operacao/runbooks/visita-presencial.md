# Runbook — Visita presencial

**Premissa:** esta pode ser a única visita por muito tempo. Tudo aqui é coisa que **só dá para
fazer estando lá**. Depurar código é trabalho remoto; medir, capturar e fotografar, não.

Imprima e leve. Vá riscando.

---

## Antes de sair de casa

- [ ] Pendrive com: Wireshark portable, o instalador do SAGE, a sonda de reconhecimento
- [ ] Bloco de notas (papel mesmo) para anotar o que não couber em log
- [ ] Celular carregado — vai ser preciso fotografar bastante
- [ ] Combinar a janela: fora do horário de aula, com autorização de quem manda
- [ ] Avisar que a catraca pode parar por alguns minutos durante os testes

---

## 1. Captura de protocolo `[PRIORIDADE MÁXIMA]`

**Faça isso primeiro, antes de mexer em qualquer outra coisa.** É o item mais valioso e o mais
impossível de fazer remotamente.

- [ ] Wireshark aberto, filtro `ip.addr == <IP-da-catraca>`
- [ ] Abrir o software oficial da Control iD e usar **normalmente**, exercitando tudo:
  - [ ] Login
  - [ ] Listar usuários
  - [ ] Cadastrar um usuário de teste
  - [ ] Cadastrar cartão / QR para ele
  - [ ] Listar cartões e QR codes
  - [ ] Listar portais e regras de acesso
  - [ ] Puxar logs de acesso (com e sem filtro de data)
  - [ ] Passar pela catraca de verdade e ver o log chegar
  - [ ] Editar e apagar o usuário de teste
- [ ] Salvar a captura: `captura-controlid-AAAA-MM-DD.pcapng`
- [ ] **Copiar o arquivo para o pendrive antes de sair** (o mais esquecido da lista)

> Cada requisição capturada vira fixture. Isso transforma "acho que funciona" em teste
> automatizado.

---

## 2. Identificação do hardware

- [ ] Modelo exato da catraca (foto da etiqueta)
- [ ] Número de série
- [ ] Versão de firmware (aparece no software oficial ou na interface web)
- [ ] Tem módulo facial? Leitor biométrico? Só cartão/QR?
- [ ] Fotografar a catraca inteira, a etiqueta, e a parte de trás com o cabo de rede

---

## 3. Rede — anotar tudo

| Item | Valor |
|---|---|
| IP da catraca | |
| Porta da interface (80? 82?) | |
| IP do PC | |
| Máscara de sub-rede | |
| Gateway | |
| DNS | |
| IP fixo ou DHCP? | |
| Tem proxy? Qual? | |

- [ ] `ipconfig /all` — salvar a saída num arquivo
- [ ] `arp -a` — salvar a saída (mostra o que a máquina já conhece)
- [ ] **Testar saída para a internet**, no navegador ou por `curl`:
  - [ ] `https://github.com`
  - [ ] `https://hc-ping.com`
  - [ ] `https://sentry.io`
  - [ ] `https://logs-prod-*.grafana.net`
- [ ] Se algum falhar: anotar **exatamente** a mensagem de erro (proxy? DNS? bloqueio?)

> Se a saída estiver bloqueada, todo o desenho de telemetria e auto-update precisa do plano B
> por arquivo. Melhor descobrir agora.

---

## 4. A máquina

- [ ] Versão e **edição** do Windows (`winver`) — anotar se é **Home ou Pro**
  - Home não tem BitLocker; muda o plano de proteção de dados
- [ ] Processador, RAM
- [ ] **HD mecânico ou SSD?** — define o `SAGE_BOOT_GRACE_MS`
- [ ] Espaço livre em disco
- [ ] Já tem MySQL instalado? Versão? Que porta? Tem dado dentro?
- [ ] Já tem Node instalado? Versão?
- [ ] Antivírus além do Defender?
- [ ] **Relógio do sistema está certo?** (compare com o celular)
- [ ] Tem nobreak? Se não, vale sugerir — é o único item de hardware que vale pedir
- [ ] O PC é desligado à noite? Por quem, e a que horas?

---

## 5. Instalação e teste de recuperação

Instale o SAGE e **quebre de propósito**. Estando lá é o único momento seguro para isso.

- [ ] Instalar do zero e cronometrar quanto demora
- [ ] **Cronometrar quanto o MySQL leva do boot até aceitar conexão** — anote, é o número que
  calibra a carência do supervisor
- [ ] Rodar a sonda de reconhecimento (somente leitura) e guardar o zip
- [ ] Testar a varredura de rede — ela encontra a catraca?

Agora quebre:

- [ ] `taskkill /F` no processo do app → o supervisor reergue? Em quanto tempo?
- [ ] Parar o MySQL à força → `/ready` reprova? O supervisor reage?
- [ ] **Desligar o PC no botão** durante uso → volta inteiro no próximo boot?
- [ ] Tirar o cabo de rede da catraca → o sistema avisa direito? Que código de erro aparece?
- [ ] Tirar a internet → o sistema continua girando a catraca?
- [ ] Reiniciar o Windows → tudo sobe sozinho sem ninguém logar?

> Cada um desses é um cenário que será enfrentado remotamente mais tarde. Vê-los acontecer
> agora, com a máquina na frente, vale mais que qualquer teste em VM.

---

## 6. Operações perigosas — só com o mantenedor presente

- [ ] Backup completo da catraca, **verificado** (abrir o arquivo e conferir)
- [ ] Backup do banco, verificado por restauração
- [ ] Se for zerar logs: só **depois** dos dois backups acima, e observando cada passo
- [ ] Cronometrar quanto demora o `destroy_objects` — calibra o
  `CATRACA_ZERAR_LOGS_TIMEOUT_MS`
- [ ] Anotar quantos logs havia antes (já houve caso de 48 mil registros com zero
  sincronizados)

---

## 7. A pessoa

Provavelmente o item mais subestimado da lista.

- [ ] **Sentar do lado dela e assistir ela usar o sistema.** Não explicar — observar. Onde ela
  trava, o que ela não acha, o que ela faz diferente do esperado
- [ ] Perguntar como é o dia normal: quantos alunos, que horários têm fila, o que já deu errado
  antes
- [ ] Entregar a folha impressa do runbook de operação e **fazer ela executar** cada item uma
  vez
- [ ] Ensinar os três atalhos: abrir, reiniciar, gerar diagnóstico
- [ ] Fazer ela gerar um diagnóstico e enviar por e-mail — teste real, com o mantenedor olhando
- [ ] Trocar contato. Combinar prazo de resposta que dá para **cumprir de verdade**
- [ ] Perguntar quem mais mexe no computador

---

## 8. Combinados institucionais

- [ ] Confirmar horário letivo e quando indisponibilidade é aceitável
- [ ] Apresentar (e se possível deixar assinado) o documento de uma página: o que o sistema
  faz, quais dados trata, que existe atualização automática e o que ela pode e não pode fazer,
  quem responde por quê
- [ ] Perguntar se existe política de TI sobre software instalado
- [ ] Definir quanto tempo de registro de acesso deve ser guardado
- [ ] Deixar claro o que é responsabilidade do mantenedor e o que não é, para quando algo na
  rede quebrar

---

## Antes de ir embora — confira o pendrive

Se a saída for sem isso, a visita rendeu metade:

- [ ] `captura-controlid-*.pcapng`
- [ ] Zip da sonda de reconhecimento
- [ ] Saída do `ipconfig /all` e do `arp -a`
- [ ] Backup completo da catraca
- [ ] Backup do banco
- [ ] Fotos: catraca, etiqueta, cabeamento, tela do sistema
- [ ] Anotações de papel, fotografadas

---

## Depois, ainda no mesmo dia

Enquanto está fresco na memória:

- [ ] Passar as anotações de papel para `docs/VISITA-AAAA-MM-DD.md`
- [ ] Commitar as fixtures da captura
- [ ] Ajustar `SAGE_BOOT_GRACE_MS` e os timeouts da catraca com os números reais medidos
- [ ] Registrar em [`../erros.md`](../erros.md) os códigos que apareceram nos testes de quebra
- [ ] Anotar o que **não** deu tempo de fazer — é a pauta da próxima visita

---

## As três coisas que não podem faltar

Se o tempo acabar e for preciso escolher:

1. **A captura do Wireshark** — impossível de obter remotamente, valiosa para sempre
2. **Os testes de quebra** — a única chance de ver a recuperação acontecer ao vivo
3. **Assistir a secretária usar** — nenhum log conta o que se vê em cinco minutos ao lado dela
