import type { Monaco } from '@monaco-editor/react';

/**
 * Register Covenant as a first-class language inside Monaco:
 *   - Monarch tokenizer for syntax highlighting
 *   - Language configuration (comments, brackets, auto-closing pairs)
 *   - A paper/violet theme matching the rest of the site
 *
 * Safe to call multiple times — Monaco silently no-ops on re-registration.
 */
export function registerCovenantLanguage(monaco: Monaco): void {
  const LANG_ID = 'covenant';

  // Idempotency guard — Monaco's language registry is a global singleton
  // but does throw on duplicate tokenizer registration. The simplest
  // defence is to check the list before touching it.
  if (monaco.languages.getLanguages().some((l) => l.id === LANG_ID)) {
    return;
  }

  monaco.languages.register({
    id: LANG_ID,
    extensions: ['.cov'],
    aliases: ['Covenant', 'covenant'],
    mimetypes: ['text/x-covenant'],
  });

  // Language configuration: comments start with `--` in Covenant
  // (same as Haskell / Lua), brackets and auto-closing pairs.
  monaco.languages.setLanguageConfiguration(LANG_ID, {
    comments: {
      lineComment: '--',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string', 'comment'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });

  const keywords = [
    // Declarations
    'record',
    'token',
    'ballot',
    'vault',
    'registry',
    'board',
    'market',
    'bridge',
    'ceremony',
    'module',
    'contract',
    'struct',
    'tuple',
    // Members
    'field',
    'event',
    'error',
    'constant',
    'action',
    'view',
    'reveal',
    'helper',
    // Visibility / modifiers
    'public',
    'private',
    'encrypted',
    'sealed',
    // Clauses
    'only',
    'when',
    'given',
    'verified_by',
    'anchored_on',
    'upgradeable_by',
    'version',
    'returns',
    // Control flow
    'if',
    'else',
    'match',
    'for',
    'in',
    'return',
    'let',
    'mut',
    // Literals / identifiers that are keyword-like
    'true',
    'false',
    'self',
    'caller',
    'deployer',
    'owner',
    // Built-in ops
    'destroy',
    'freeze',
    'fhe_encrypt',
    'fhe_decrypt',
    'fhe_add',
    'fhe_mul',
    'zk_prove',
    'zk_verify',
    'emit',
    'revert',
    'require',
  ];

  const types = [
    'bool',
    'amount',
    'address',
    'time',
    'duration',
    'bytes',
    'hash',
    'text',
    'map',
    'ciphertext',
    'pq_key',
    'shares',
    'choice',
    'u8',
    'u16',
    'u32',
    'u64',
    'u128',
    'u256',
    'i8',
    'i16',
    'i32',
    'i64',
    'i128',
    'i256',
  ];

  monaco.languages.setMonarchTokensProvider(LANG_ID, {
    defaultToken: '',
    tokenPostfix: '.covenant',
    keywords,
    typeKeywords: types,
    operators: [
      '=',
      '>',
      '<',
      '!',
      '?',
      ':',
      '==',
      '<=',
      '>=',
      '!=',
      '&&',
      '||',
      '+',
      '-',
      '*',
      '/',
      '%',
      '&',
      '|',
      '^',
      '~',
      '<<',
      '>>',
      '->',
      '=>',
      '..',
    ],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4})/,

    tokenizer: {
      root: [
        // Annotations: @pq_signed, @batch_up_to(...), @precompute
        [/@[a-zA-Z_][\w]*/, 'annotation'],

        // Type identifiers (PascalCase) — e.g. HelloCoin, Address
        [/[A-Z][\w$]*/, 'type.identifier'],

        // Identifiers & keywords
        [
          /[a-z_$][\w$]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier',
            },
          },
        ],

        // Whitespace
        { include: '@whitespace' },

        // Delimiters & operators
        [/[{}()[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [
          /@symbols/,
          {
            cases: {
              '@operators': 'operator',
              '@default': '',
            },
          },
        ],

        // Numbers — hex, decimal with underscore separators,
        // optional SI-style suffix (tokens, ether, weeks…).
        [/0[xX][0-9a-fA-F_]+/, 'number.hex'],
        [/\d[\d_]*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d[\d_]*/, 'number'],

        // Delimiter after number
        [/[;,.]/, 'delimiter'],

        // Strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'], // missing close quote
        [/"/, 'string', '@string_double'],

        // Char literal
        [/'[^\\']'/, 'string'],
        [/'/, 'string.invalid'],
      ],

      string_double: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],

      whitespace: [
        [/[ \t\r\n]+/, ''],
        [/--.*$/, 'comment'],
        [/\{-/, 'comment', '@blockComment'],
      ],

      blockComment: [
        [/[^-{]+/, 'comment'],
        [/\{-/, 'comment', '@push'],
        [/-\}/, 'comment', '@pop'],
        [/[-{]/, 'comment'],
      ],
    },
  });

  // Paper / violet theme — matches the main site aesthetic.
  monaco.editor.defineTheme('covenant-paper', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '7C3AED', fontStyle: 'bold' },
      { token: 'type', foreground: '1A5F3F' },
      { token: 'type.identifier', foreground: '1A5F3F' },
      { token: 'annotation', foreground: 'B91C1C', fontStyle: 'italic' },
      { token: 'comment', foreground: '888888', fontStyle: 'italic' },
      { token: 'string', foreground: 'CA6000' },
      { token: 'string.escape', foreground: 'CA6000', fontStyle: 'bold' },
      { token: 'number', foreground: 'C2410C' },
      { token: 'number.hex', foreground: 'C2410C' },
      { token: 'number.float', foreground: 'C2410C' },
      { token: 'operator', foreground: '4A4A4A' },
      { token: 'delimiter', foreground: '4A4A4A' },
      { token: 'identifier', foreground: '1A1A1A' },
    ],
    colors: {
      'editor.background': '#FCFBF8',
      'editor.foreground': '#1A1A1A',
      'editor.lineHighlightBackground': '#F5F4F0',
      'editor.lineHighlightBorder': '#00000000',
      'editorLineNumber.foreground': '#888888',
      'editorLineNumber.activeForeground': '#1A1A1A',
      'editorCursor.foreground': '#7C3AED',
      'editor.selectionBackground': '#EDE9FE',
      'editor.inactiveSelectionBackground': '#EDE9FE80',
      'editor.findMatchBackground': '#EDE9FE',
      'editor.findMatchHighlightBackground': '#EDE9FE80',
      'editorWidget.background': '#FCFBF8',
      'editorWidget.border': 'rgba(26,26,26,0.1)',
      'editorSuggestWidget.background': '#FCFBF8',
      'editorSuggestWidget.border': 'rgba(26,26,26,0.1)',
      'editorSuggestWidget.selectedBackground': '#EDE9FE',
      'scrollbarSlider.background': 'rgba(26,26,26,0.1)',
      'scrollbarSlider.hoverBackground': 'rgba(26,26,26,0.2)',
      'scrollbarSlider.activeBackground': 'rgba(124,58,237,0.3)',
    },
  });
}
