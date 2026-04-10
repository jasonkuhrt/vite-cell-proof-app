import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { readdir, readFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const appDir = path.resolve('apps/package-conditions-app')
const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const expectedBrowserText = 'browser-runtime browser-namespace ok'
const expectedNodeText = 'node-runtime node-namespace ok'
const forbiddenTokens = [
  'readFileSync',
  'node:fs',
  'browser-external:node:fs',
  'node-only-secret',
  'node-runtime',
  'node-namespace',
]

const modeArgIndex = process.argv.indexOf('--mode')
const mode = modeArgIndex === -1 ? 'all' : process.argv[modeArgIndex + 1]

function writeClean(chunk, stream) {
  const text = chunk
    .toString('utf8')
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\r/g, '\n')
  stream.write(text)
  return text
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()

      if (address === null || typeof address === 'string') {
        reject(new Error('could not determine free port'))
        return
      }

      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(address.port)
      })
    })
  })
}

async function waitForServer(baseUrl) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/`)
      if (response.ok) {
        return
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error('vite dev server did not become ready')
}

async function proveNodeConditions() {
  const runtime = await import('@proof/conditional-surface-lib/runtime')
  const namespace = await import('@proof/conditional-surface-lib/namespace')
  const value = [
    runtime.describeRuntime(),
    namespace.origin,
    namespace.Browser.thing(),
  ].join(' ')

  console.log('\n--- package conditions / node ---')
  console.log(value)

  if (value !== expectedNodeText) {
    throw new Error(`expected node text ${JSON.stringify(expectedNodeText)}, got ${JSON.stringify(value)}`)
  }
}

async function runBuild() {
  await rm(path.join(appDir, 'dist'), { recursive: true, force: true })

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [viteBin, 'build', '--clearScreen', 'false'],
      {
        cwd: appDir,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
        },
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

  const assetsDir = path.join(appDir, 'dist/assets')
  const assetNames = await readdir(assetsDir)
  const bundleNames = assetNames.filter((name) => name.endsWith('.js'))

  console.log('\n--- package conditions / build ---')

  for (const bundleName of bundleNames) {
    const bundlePath = path.join(assetsDir, bundleName)
    const bundle = await readFile(bundlePath, 'utf8')

    console.log(`bundle=${bundlePath}`)

    const hit = forbiddenTokens.find((token) => bundle.includes(token))
    if (hit !== undefined) {
      throw new Error(`package conditions bundle leaked token: ${hit}`)
    }
  }
}

async function runDev({ bundled }) {
  const port = await getFreePort()
  const baseUrl = `http://127.0.0.1:${port}`
  let serverLog = ''

  const child = spawn(
    process.execPath,
    [
      viteBin,
      ...(bundled ? ['--experimentalBundle'] : []),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
      '--clearScreen',
      'false',
    ],
    {
      cwd: appDir,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  child.stdout.on('data', (chunk) => {
    serverLog += writeClean(chunk, process.stdout)
  })
  child.stderr.on('data', (chunk) => {
    serverLog += writeClean(chunk, process.stderr)
  })

  let browser

  try {
    await waitForServer(baseUrl)

    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const events = []

    page.on('console', (message) => {
      events.push({
        type: 'console',
        text: message.text(),
      })
    })

    page.on('pageerror', (error) => {
      events.push({
        type: 'pageerror',
        text: error.message,
      })
    })

    const response = await page.goto(baseUrl, {
      waitUntil: 'load',
      timeout: 3000,
    })
    const appText = await page.locator('#app').textContent()

    console.log(`\n--- package conditions / ${bundled ? 'bundled-dev' : 'dev'} ---`)
    console.log(`status=${response?.status() ?? 'null'}`)
    console.log(`appText=${JSON.stringify(appText)}`)
    console.log(JSON.stringify(events, null, 2))

    const pageError = events.find((event) => event.type === 'pageerror')
    if (pageError !== undefined) {
      throw new Error(`expected no pageerror, got ${pageError.text}`)
    }

    if (appText !== expectedBrowserText) {
      throw new Error(`expected browser text ${JSON.stringify(expectedBrowserText)}, got ${JSON.stringify(appText)}`)
    }

    if (bundled && serverLog.includes('Build error:')) {
      throw new Error('expected bundled dev to work, but vite reported a build error')
    }
  } finally {
    await browser?.close()
    child.kill('SIGTERM')
  }
}

const jobs = {
  node: proveNodeConditions,
  build: runBuild,
  dev: () => runDev({ bundled: false }),
  'bundled-dev': () => runDev({ bundled: true }),
}

for (const name of mode === 'all' ? ['node', 'build', 'dev', 'bundled-dev'] : [mode]) {
  const job = jobs[name]

  if (job === undefined) {
    console.error(`unknown mode: ${name}`)
    process.exit(1)
  }

  await job()
}
