import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { caseMatrix } from './cases.mjs'

const modeArgIndex = process.argv.indexOf('--mode')
const mode = modeArgIndex === -1 ? 'all' : process.argv[modeArgIndex + 1]

const buildScript = path.resolve('scripts/build-readable.mjs')
const devScript = path.resolve('scripts/dev-readable.mjs')

function writeClean(chunk, stream) {
  const text = chunk
    .toString('utf8')
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\r/g, '\n')
  stream.write(text)
}

async function runNodeScript(args) {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''

    child.stdout.on('data', (chunk) => {
      output += writeClean(chunk, process.stdout)
    })
    child.stderr.on('data', (chunk) => {
      output += writeClean(chunk, process.stderr)
    })
    child.on('exit', (code) => resolve({ code: code ?? 1, output }))
  })
}

const checks = {
  build: async (caseName, expected) =>
    await runNodeScript([
      buildScript,
      '--proof',
      '--case',
      caseName,
      '--expect',
      expected,
    ]),
  dev: async (caseName, expected) =>
    await runNodeScript([
      devScript,
      '--case',
      caseName,
      '--expect',
      expected,
    ]),
  bundledDev: async (caseName, expected) =>
    await runNodeScript([
      devScript,
      '--bundled',
      '--case',
      caseName,
      '--expect',
      expected,
    ]),
}

const checkLabel = {
  build: 'build',
  dev: 'dev',
  bundledDev: 'bundled-dev',
}

const order =
  mode === 'all'
    ? ['build', 'dev', 'bundledDev']
    : [mode]

const summary = []

for (const [caseName, caseConfig] of Object.entries(caseMatrix)) {
  console.log(`\n=== ${caseName} ===`)
  console.log(caseConfig.description)

  for (const checkName of order) {
    const expected = caseConfig.expectations[checkName]
    const result = await checks[checkName](caseName, expected)

    summary.push({
      caseName,
      checkName,
      expected,
      ok: result.code === 0,
    })
  }
}

console.log('\n=== summary ===')
for (const row of summary) {
  console.log(
    [
      row.caseName.padEnd(32),
      checkLabel[row.checkName].padEnd(12),
      `expected=${row.expected}`.padEnd(16),
      row.ok ? 'ok' : 'failed',
    ].join('  '),
  )
}
