import path from 'node:path'

export const defaultCaseName = 'namespace-node-builtin'

export const caseMatrix = {
  'namespace-browser-safe': {
    description: 'Namespace barrel with an unused browser-safe branch',
    dir: path.resolve('cases/namespace-browser-safe'),
    forbiddenTokens: ['browser-safe-unused-marker'],
    expectations: {
      build: 'pass',
      dev: 'pass',
      bundledDev: 'pass',
    },
  },
  'namespace-node-builtin': {
    description: 'Namespace barrel with an unused Node builtin branch',
    dir: path.resolve('cases/namespace-node-builtin'),
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
  'barrel-browser-safe': {
    description: 'Flat barrel with an unused browser-safe export',
    dir: path.resolve('cases/barrel-browser-safe'),
    forbiddenTokens: ['browser-safe-unused-marker'],
    expectations: {
      build: 'pass',
      dev: 'pass',
      bundledDev: 'pass',
    },
  },
  'barrel-node-builtin': {
    description: 'Flat barrel with an unused Node builtin export',
    dir: path.resolve('cases/barrel-node-builtin'),
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
  'runtime-object-node-builtin': {
    description: 'Runtime object aggregate with a Node builtin branch',
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
