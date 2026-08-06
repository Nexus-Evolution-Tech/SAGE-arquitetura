// ESLint flat config — enforça as regras do AGENTS.md
// Regra que não é enforçada apodrece.

module.exports = [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
        console: 'readonly',
        global: 'writable',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    rules: {
      // ── AGENTS.md §4.2 — nunca engula erro ──────────────────────────────
      // Bloco vazio, inclusive catch. Já causou bug em produção.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // ── AGENTS.md §7 — sem console em produção ──────────────────────────
      'no-console': 'error',

      // ── Higiene geral ───────────────────────────────────────────────────
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],

      // Promise sem await em loop de sync é fonte de bug silencioso
      'require-atomic-updates': 'error',
      'no-return-await': 'error',

      // ── Padrões proibidos específicos deste projeto ─────────────────────
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/create_objects\\.fcgi/]",
          message:
            'Use create_or_update_objects.fcgi. AGENTS.md §4.5: escrita na catraca é idempotente ' +
            'porque a rede cai no meio da requisição e reenviamos.'
        },
        {
          selector: "CatchClause > BlockStatement:has(ReturnStatement Property[key.name='sucesso'][value.value=true])",
          message:
            'catch retornando sucesso:true. AGENTS.md §4.2: falha parcial é falha. ' +
            'Foi exatamente este padrão que gerou o BUG-3.'
        }
      ]
    }
  },

  // O offset da catraca só pode ser lido em src/config/catraca.js.
  // Foi a leitura duplicada, com defaults divergentes, que gerou o BUG-1.
  {
    files: ['src/**/*.js'],
    ignores: ['src/config/catraca.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='CATRACA_USER_ID_OFFSET']",
          message:
            'Importe de src/config/catraca.js. Ler process.env.CATRACA_USER_ID_OFFSET em ' +
            'mais de um lugar foi o que causou o BUG-1 (defaults divergentes, log atribuído à pessoa errada).'
        }
      ]
    }
  },

  // Testes podem usar console e dados sintéticos
  {
    files: ['test/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },

  // Scripts de instalação e supervisor rodam fora do logger
  {
    files: ['scripts/**/*.js', 'supervisor.js'],
    rules: {
      'no-console': 'off'
    }
  }
];
