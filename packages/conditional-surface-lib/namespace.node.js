import { nodeOnlySecret } from './runtime.node.js'

export const origin =
  nodeOnlySecret() === 'node-only-secret'
    ? 'node-namespace'
    : 'bad-node-namespace'

export const Browser = {
  thing() {
    return 'ok'
  },
}
