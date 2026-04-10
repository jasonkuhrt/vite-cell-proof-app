import { readFileSync } from 'node:fs'

export function describeRuntime() {
  return readFileSync ? 'node-runtime' : 'bad-node-runtime'
}

export function nodeOnlySecret() {
  return 'node-only-secret'
}
