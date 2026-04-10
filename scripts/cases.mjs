import path from 'node:path'

export const defaultCaseName = 'esm-namespace-node-builtin'

export const caseMatrix = {
  'esm-namespace-node-builtin': {
    description: 'Pure ESM namespace surface with unused Node builtin branch',
    dir: path.resolve('cases/esm-namespace-node-builtin'),
    forbiddenTokens: [
      'readFileSync',
      'node:fs',
      'browser-external:node:fs',
      'getSecret',
    ],
    expectations: {
      build: 'pass',
      dev: 'fail',
      bundledDev: 'fail',
    },
  },
  'esm-namespace-browser-safe-unused': {
    description: 'Pure ESM namespace surface with unused browser-safe branch',
    dir: path.resolve('cases/esm-namespace-browser-safe-unused'),
    forbiddenTokens: ['browser-safe-unused-marker'],
    expectations: {
      build: 'pass',
      dev: 'pass',
      bundledDev: 'pass',
    },
  },
  'flat-barrel-node-builtin': {
    description: 'Flat ESM barrel with unused Node builtin export',
    dir: path.resolve('cases/flat-barrel-node-builtin'),
    forbiddenTokens: [
      'readFileSync',
      'node:fs',
      'browser-external:node:fs',
      'getSecret',
    ],
    expectations: {
      build: 'pass',
      dev: 'fail',
      bundledDev: 'fail',
    },
  },
  'flat-barrel-browser-safe-unused': {
    description: 'Flat ESM barrel with unused browser-safe export',
    dir: path.resolve('cases/flat-barrel-browser-safe-unused'),
    forbiddenTokens: ['browser-safe-unused-marker'],
    expectations: {
      build: 'pass',
      dev: 'pass',
      bundledDev: 'pass',
    },
  },
  'runtime-object-node-builtin': {
    description: 'Runtime object aggregate with Node builtin branch',
    dir: path.resolve('cases/runtime-object-node-builtin'),
    forbiddenTokens: [
      'readFileSync',
      'node:fs',
      'browser-external:node:fs',
      'getSecret',
    ],
    expectations: {
      build: 'fail',
      dev: 'fail',
      bundledDev: 'fail',
    },
  },
}

export function getCaseName() {
  const caseArgIndex = process.argv.indexOf('--case')
  return caseArgIndex === -1
    ? defaultCaseName
    : process.argv[caseArgIndex + 1]
}

export function getCaseConfig(caseName) {
  const config = caseMatrix[caseName]

  if (config === undefined) {
    throw new Error(`unknown case: ${caseName}`)
  }

  return config
}
