import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { getCaseConfig, getCaseName } from './cases.mjs'

const prove = process.argv.includes('--proof')
const expectArgIndex = process.argv.indexOf('--expect')
const expectedMode =
  expectArgIndex === -1 ? 'pass' : process.argv[expectArgIndex + 1]
const caseName = getCaseName()
const caseConfig = getCaseConfig(caseName)

function writeClean(chunk, stream) {
  const text = chunk
    .toString('utf8')
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\r/g, '\n')
  stream.write(text)
}

async function runBuild() {
  const viteBin = path.resolve('node_modules/vite/bin/vite.js')

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [viteBin, 'build', '--clearScreen', 'false'],
      {
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
        },
        cwd: caseConfig.dir,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    child.stdout.on('data', (chunk) => writeClean(chunk, process.stdout))
    child.stderr.on('data', (chunk) => writeClean(chunk, process.stderr))

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`vite build exited with code ${code ?? 'null'}`))
    })
  })
}

async function proveBundle() {
  const assetsDir = path.join(caseConfig.dir, 'dist/assets')
  const assetNames = await readdir(assetsDir)
  const bundleNames = assetNames.filter((name) => name.endsWith('.js'))

  for (const bundleName of bundleNames) {
    const bundlePath = path.join(assetsDir, bundleName)
    const bundle = await readFile(bundlePath, 'utf8')

    console.log(`case=${caseName}`)
    console.log(`bundle=${bundlePath}`)

    const hit = caseConfig.forbiddenTokens.find((token) => bundle.includes(token))
    if (hit !== undefined) {
      throw new Error(`backend token leaked into client bundle: ${hit}`)
    }
  }
}

try {
  await runBuild()

  if (prove) {
    await proveBundle()
  }
} catch (error) {
  if (expectedMode === 'fail') {
    console.log(`case=${caseName}`)
    console.log(String(error instanceof Error ? error.message : error))
    process.exit(0)
  }

  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
