import { readFileSync } from 'node:fs'

export function getSecret() {
  return readFileSync
}
