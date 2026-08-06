#!/usr/bin/env node
'use strict';

/**
 * SAGE — Supervisor de processo
 * ==============================
 *
 * Mantém a API do SAGE viva num PC de escola sem ninguém técnico por perto.
 *
 * PREMISSAS DE PROJETO (leia antes de mexer):
 *
 *  1. ZERO DEPENDÊNCIAS. Só módulos nativos do Node. Este arquivo precisa rodar
 *     com o node.exe empacotado, sem npm install, sem rede.
 *
 *  2. O SUPERVISOR NUNCA PODE MORRER. Se ele cair, o sistema fica fora do ar até
 *     alguém perceber — e não há ninguém para perceber. Todo caminho de código
 *     aqui é defensivo. Erro de telemetria, de disco ou de rede é engolido.
 *
 *  3. NUNCA DESISTIR. Mesmo em crash loop, ele continua tentando em intervalo
 *     longo. "Desistir" numa máquina sem operador significa sistema morto até
 *     a próxima visita presencial.
 *
 *  4. O PC É DESLIGADO TODA NOITE. No boot, o MySQL pode demorar. Existe um
 *     período de carência inicial para não entrar em crash loop enquanto o
 *     banco ainda está subindo.
 *
 *  5. "DE PÉ" É /ready RESPONDENDO, NÃO O PROCESSO EXISTIR. Um Node vivo com o
 *     banco fora é pior que um Node morto: parece que está tudo bem.
 *
 * USO:
 *   node.exe supervisor.js
 *
 * Registrado no Agendador de Tarefas do Windows com gatilho "Ao iniciar o
 * sistema". Ver registrar-tarefa.cmd.
 */

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ─────────────────────────────────────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────────────────────────────────────

const cfg = {
  // O que executar
  appScript:  process.env.SAGE_APP_SCRIPT  || path.join(__dirname, 'index.js'),
  appCwd:     process.env.SAGE_APP_CWD     || __dirname,
  nodeBin:    process.env.SAGE_NODE_BIN    || process.execPath, // o node.exe empacotado

  // Onde escrever estado e log (FORA da pasta de release — sobrevive a update)
  dataDir:    process.env.SAGE_DATA_DIR    || path.join(__dirname, '..', 'dados'),

  // Health check
  porta:            parseInt(process.env.PORT || '3000', 10),
  rotaReady:        process.env.SAGE_READY_PATH || '/ready',
  carenciaBootMs:   parseInt(process.env.SAGE_BOOT_GRACE_MS   || '120000', 10), // 2 min
  intervaloHealthMs:parseInt(process.env.SAGE_HEALTH_EVERY_MS || '30000',  10), // 30 s
  timeoutHealthMs:  parseInt(process.env.SAGE_HEALTH_TIMEOUT_MS || '10000',10), // 10 s
  falhasParaMatar:  parseInt(process.env.SAGE_HEALTH_FAILS     || '4',     10), // 4x30s = 2 min

  // Reinício
  backoffBaseMs:    parseInt(process.env.SAGE_BACKOFF_BASE_MS || '5000',   10),
  backoffMaxMs:     parseInt(process.env.SAGE_BACKOFF_MAX_MS  || '300000', 10), // 5 min
  janelaLoopMs:     parseInt(process.env.SAGE_LOOP_WINDOW_MS  || '600000', 10), // 10 min
  reinAteLoop:      parseInt(process.env.SAGE_LOOP_THRESHOLD  || '5',      10),
  cooldownLoopMs:   parseInt(process.env.SAGE_LOOP_COOLDOWN_MS|| '900000', 10), // 15 min

  // Encerramento
  timeoutGracefulMs:parseInt(process.env.SAGE_STOP_GRACE_MS   || '15000',  10),

  // Telemetria (opcional — ausência não pode impedir o sistema de funcionar)
  hcVivo:  process.env.HC_URL_VIVO || '',
  hcBoot:  process.env.HC_URL_BOOT || '',

  // Log
  logMaxBytes: parseInt(process.env.SAGE_LOG_MAX_BYTES || '10485760', 10), // 10 MB
  linhasCrash: parseInt(process.env.SAGE_CRASH_TAIL     || '40', 10)
};

const ARQ_LOG    = path.join(cfg.dataDir, 'supervisor.log');
const ARQ_ESTADO = path.join(cfg.dataDir, 'supervisor-estado.json');

// ─────────────────────────────────────────────────────────────────────────────
// Log (com rotação simples, tolerante a falha de disco)
// ─────────────────────────────────────────────────────────────────────────────

function garantirDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* segue */ }
}

function rotacionarSePreciso() {
  try {
    const st = fs.statSync(ARQ_LOG);
    if (st.size < cfg.logMaxBytes) return;
    try { fs.unlinkSync(ARQ_LOG + '.1'); } catch { /* não existia */ }
    fs.renameSync(ARQ_LOG, ARQ_LOG + '.1');
  } catch { /* arquivo não existe ainda, ou disco cheio: segue */ }
}

function log(nivel, msg) {
  const linha = `${new Date().toISOString()} [${nivel}] ${msg}`;
  try { process.stdout.write(linha + '\n'); } catch { /* console pode não existir */ }
  try {
    rotacionarSePreciso();
    fs.appendFileSync(ARQ_LOG, linha + '\n');
  } catch { /* disco cheio ou sem permissão: nunca derruba o supervisor */ }
}

const info  = (m) => log('INFO',  m);
const aviso = (m) => log('AVISO', m);
const erro  = (m) => log('ERRO',  m);

// ─────────────────────────────────────────────────────────────────────────────
// Estado persistido — sobrevive ao supervisor ser reiniciado pelo Agendador
// ─────────────────────────────────────────────────────────────────────────────

function lerEstado() {
  try {
    const bruto = JSON.parse(fs.readFileSync(ARQ_ESTADO, 'utf8'));
    return {
      // só reinícios dentro da janela interessam
      reinicios: (bruto.reinicios || []).filter(t => Date.now() - t < cfg.janelaLoopMs),
      totalHistorico: bruto.totalHistorico || 0
    };
  } catch {
    return { reinicios: [], totalHistorico: 0 };
  }
}

function salvarEstado(estado) {
  try {
    fs.writeFileSync(ARQ_ESTADO, JSON.stringify({
      reinicios: estado.reinicios,
      totalHistorico: estado.totalHistorico,
      atualizadoEm: new Date().toISOString()
    }, null, 2));
  } catch { /* não é crítico */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetria de saída (best-effort, nunca lança, nunca bloqueia)
// ─────────────────────────────────────────────────────────────────────────────

function ping(url, sufixo = '') {
  if (!url) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const alvo = new URL(url + sufixo);
      const mod = alvo.protocol === 'https:' ? require('https') : http;
      const req = mod.request(alvo, { method: 'POST', timeout: 8000 }, (res) => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', () => resolve());   // sem internet: segue a vida
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.end();
    } catch { resolve(); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check — pergunta ao /ready, não ao sistema operacional
// ─────────────────────────────────────────────────────────────────────────────

function checarReady() {
  return new Promise((resolve) => {
    let finalizado = false;
    const fim = (ok, detalhe) => {
      if (finalizado) return;
      finalizado = true;
      resolve({ ok, detalhe });
    };

    try {
      const req = http.request({
        host: '127.0.0.1',
        port: cfg.porta,
        path: cfg.rotaReady,
        method: 'GET',
        timeout: cfg.timeoutHealthMs
      }, (res) => {
        let corpo = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { if (corpo.length < 2000) corpo += c; });
        res.on('end', () => fim(res.statusCode === 200, `HTTP ${res.statusCode} ${corpo.slice(0, 200)}`));
      });
      req.on('error', (e) => fim(false, `conexão: ${e.code || e.message}`));
      req.on('timeout', () => { req.destroy(); fim(false, 'timeout'); });
      req.end();
    } catch (e) {
      fim(false, `exceção: ${e.message}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Encerramento de processo no Windows
//
// child.kill() no Windows não propaga para a árvore de processos e não dá chance
// de shutdown gracioso. Estratégia: tenta educado, depois taskkill /T /F.
// ─────────────────────────────────────────────────────────────────────────────

function matarArvore(pid) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      try { process.kill(pid, 'SIGKILL'); } catch { /* já morreu */ }
      return resolve();
    }
    try {
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => resolve());
    } catch { resolve(); }
  });
}

function encerrarFilho(filho, motivo) {
  return new Promise((resolve) => {
    if (!filho || filho.exitCode !== null || filho.killed) return resolve();

    info(`Encerrando app (${motivo})...`);
    let resolvido = false;
    const pronto = () => { if (!resolvido) { resolvido = true; resolve(); } };

    filho.once('exit', pronto);

    // 1) Educado: dá chance de fechar conexões e liberar o pool do MySQL.
    try { filho.kill('SIGTERM'); } catch { /* segue */ }

    // 2) Bruto, se não saiu no prazo.
    setTimeout(async () => {
      if (resolvido) return;
      aviso(`App não encerrou em ${cfg.timeoutGracefulMs}ms — forçando.`);
      await matarArvore(filho.pid);
      setTimeout(pronto, 2000);
    }, cfg.timeoutGracefulMs);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Supervisor
// ─────────────────────────────────────────────────────────────────────────────

class Supervisor {
  constructor() {
    this.filho = null;
    this.estado = lerEstado();
    this.parando = false;
    this.timerHealth = null;
    this.falhasSeguidas = 0;
    this.caudaStderr = [];   // ring buffer: últimas linhas antes de um crash
    this.iniciadoEm = Date.now();
  }

  registrarStderr(texto) {
    for (const linha of String(texto).split('\n')) {
      if (!linha.trim()) continue;
      this.caudaStderr.push(linha);
      if (this.caudaStderr.length > cfg.linhasCrash) this.caudaStderr.shift();
    }
  }

  /** Backoff exponencial baseado em quantos reinícios houve na janela recente. */
  calcularEspera() {
    const n = this.estado.reinicios.length;
    const espera = Math.min(cfg.backoffBaseMs * Math.pow(2, Math.max(0, n - 1)), cfg.backoffMaxMs);
    // jitter de ±20% evita sincronizar com outro processo que também reinicia
    return Math.round(espera * (0.8 + Math.random() * 0.4));
  }

  emCrashLoop() {
    return this.estado.reinicios.length >= cfg.reinAteLoop;
  }

  iniciarApp() {
    info(`Iniciando app: ${cfg.nodeBin} ${cfg.appScript}`);
    this.caudaStderr = [];
    this.falhasSeguidas = 0;

    try {
      this.filho = spawn(cfg.nodeBin, [cfg.appScript], {
        cwd: cfg.appCwd,
        env: { ...process.env, SAGE_SUPERVISED: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
    } catch (e) {
      erro(`Falha ao criar processo: ${e.message}`);
      this.filho = null;
      return false;
    }

    info(`App iniciado (pid ${this.filho.pid}).`);

    // Repassa a saída do app para o log do supervisor. O app tem o próprio
    // Winston; isto aqui é a rede de captura para o que morre antes dele subir.
    this.filho.stdout.on('data', (d) => {
      const t = String(d).trimEnd();
      if (t) log('APP', t);
    });
    this.filho.stderr.on('data', (d) => {
      const t = String(d).trimEnd();
      if (t) { log('APP-ERR', t); this.registrarStderr(t); }
    });

    this.filho.on('exit', (codigo, sinal) => this.aoSairApp(codigo, sinal));
    this.filho.on('error', (e) => erro(`Erro no processo filho: ${e.message}`));

    this.agendarHealthCheck();
    return true;
  }

  agendarHealthCheck() {
    clearInterval(this.timerHealth);

    // Carência: não checa nada enquanto o app (e o MySQL) sobem. Sem isto,
    // todo boot da máquina vira um falso crash loop.
    info(`Carência de boot: ${Math.round(cfg.carenciaBootMs / 1000)}s antes do primeiro health check.`);

    setTimeout(() => {
      if (this.parando || !this.filho) return;
      this.timerHealth = setInterval(() => this.rodarHealthCheck(), cfg.intervaloHealthMs);
      this.rodarHealthCheck();
    }, cfg.carenciaBootMs);
  }

  async rodarHealthCheck() {
    if (this.parando || !this.filho) return;

    const { ok, detalhe } = await checarReady();

    if (ok) {
      if (this.falhasSeguidas > 0) {
        info(`Health check recuperado após ${this.falhasSeguidas} falha(s).`);
      }
      this.falhasSeguidas = 0;
      ping(cfg.hcVivo);                       // "estou vivo E pronto"
      return;
    }

    this.falhasSeguidas++;
    aviso(`Health check falhou (${this.falhasSeguidas}/${cfg.falhasParaMatar}): ${detalhe}`);

    if (this.falhasSeguidas >= cfg.falhasParaMatar) {
      // Processo vivo mas inútil. Este é o caso perigoso: sem esta checagem,
      // ele ficaria "no ar" e cego por horas.
      erro('App não responde /ready. Reiniciando à força.');
      ping(cfg.hcVivo, '/fail');
      clearInterval(this.timerHealth);
      await encerrarFilho(this.filho, 'health check reprovado');
      // o handler de 'exit' cuida do reinício
    }
  }

  async aoSairApp(codigo, sinal) {
    clearInterval(this.timerHealth);
    this.filho = null;

    if (this.parando) {
      info('App encerrado durante shutdown do supervisor.');
      return;
    }

    const causa = sinal ? `sinal ${sinal}` : `código ${codigo}`;
    erro(`App morreu (${causa}).`);

    if (this.caudaStderr.length) {
      erro(`Últimas ${this.caudaStderr.length} linhas de stderr antes da morte:`);
      for (const l of this.caudaStderr) erro(`  | ${l}`);
    }

    // Contabiliza o reinício
    const agora = Date.now();
    this.estado.reinicios = this.estado.reinicios.filter(t => agora - t < cfg.janelaLoopMs);
    this.estado.reinicios.push(agora);
    this.estado.totalHistorico++;
    salvarEstado(this.estado);

    let espera;
    if (this.emCrashLoop()) {
      // Crash loop confirmado. Alerta e espera bastante — mas NUNCA desiste,
      // porque não há ninguém em campo para reiniciar manualmente.
      espera = cfg.cooldownLoopMs;
      erro(`CRASH LOOP: ${this.estado.reinicios.length} reinícios em ` +
           `${Math.round(cfg.janelaLoopMs / 60000)} min. ` +
           `Aguardando ${Math.round(espera / 60000)} min antes de tentar de novo.`);
      await ping(cfg.hcVivo, '/fail');
    } else {
      espera = this.calcularEspera();
      aviso(`Reiniciando em ${Math.round(espera / 1000)}s ` +
            `(reinício ${this.estado.reinicios.length} na janela atual).`);
    }

    setTimeout(() => {
      if (this.parando) return;
      if (!this.iniciarApp()) {
        // Nem conseguiu criar o processo (binário sumiu? disco?). Tenta de novo
        // em 1 min, indefinidamente.
        erro('Não foi possível iniciar o app. Nova tentativa em 60s.');
        setTimeout(() => { if (!this.parando) this.iniciarApp(); }, 60000);
      }
    }, espera);
  }

  async parar(motivo) {
    if (this.parando) return;
    this.parando = true;
    info(`Supervisor encerrando (${motivo}).`);
    clearInterval(this.timerHealth);
    await encerrarFilho(this.filho, motivo);
    info('Supervisor encerrado.');
    process.exit(0);
  }

  async iniciar() {
    garantirDir(cfg.dataDir);

    info('═'.repeat(70));
    info('SAGE Supervisor iniciando');
    info(`  node:      ${cfg.nodeBin}`);
    info(`  app:       ${cfg.appScript}`);
    info(`  dados:     ${cfg.dataDir}`);
    info(`  ready:     http://127.0.0.1:${cfg.porta}${cfg.rotaReady}`);
    info(`  reinícios no histórico: ${this.estado.totalHistorico}`);
    info('═'.repeat(70));

    // Sinaliza que a máquina ligou e o supervisor subiu. Se este ping não
    // chegar num dia letivo, o PC não ligou.
    ping(cfg.hcBoot);

    // Se o supervisor foi reiniciado pelo Agendador já em crash loop, respeita
    // o cooldown em vez de martelar a máquina.
    if (this.emCrashLoop()) {
      const maisRecente = Math.max(...this.estado.reinicios);
      const restante = cfg.cooldownLoopMs - (Date.now() - maisRecente);
      if (restante > 0) {
        aviso(`Retomando em crash loop. Aguardando ${Math.round(restante / 1000)}s.`);
        await new Promise(r => setTimeout(r, restante));
      }
    }

    this.iniciarApp();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

const sup = new Supervisor();

for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  try { process.on(sinal, () => sup.parar(sinal)); } catch { /* nem todo sinal existe no Windows */ }
}

// Um erro não tratado NO SUPERVISOR não pode derrubá-lo. Loga e segue.
process.on('uncaughtException', (e) => {
  erro(`EXCEÇÃO NÃO TRATADA no supervisor: ${e && e.stack ? e.stack : e}`);
});
process.on('unhandledRejection', (r) => {
  erro(`PROMISE REJEITADA no supervisor: ${r && r.stack ? r.stack : r}`);
});

sup.iniciar().catch((e) => {
  erro(`Falha fatal ao iniciar supervisor: ${e && e.stack ? e.stack : e}`);
  // Sai com código != 0 para o Agendador reiniciar a tarefa.
  process.exit(1);
});
