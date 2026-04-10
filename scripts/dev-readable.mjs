import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { getCaseConfig, getCaseName } from './cases.mjs'

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

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(port)
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

async function waitForBundledBuildErrorWindow() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (serverLog.includes('Build error:')) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return serverLog.includes('Build error:')
}

const port = await getFreePort()
const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const baseUrl = `http://127.0.0.1:${port}`
const expectArgIndex = process.argv.indexOf('--expect')
const bundled = process.argv.includes('--bundled')
const expectedMode =
  expectArgIndex === -1 ? 'pass' : process.argv[expectArgIndex + 1]
const caseName = getCaseName()
const caseConfig = getCaseConfig(caseName)
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
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    cwd: caseConfig.dir,
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

  if (bundled && (await waitForBundledBuildErrorWindow())) {
    console.log('\n--- bundled dev result ---')
    console.log(`case=${caseName}`)
    console.log(serverLog.trim())

    if (expectedMode === 'fail') {
      process.exit(0)
    }

    throw new Error('expected bundled dev to work, but vite reported a build error')
  }

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

  page.on('requestfailed', (request) => {
    events.push({
      type: 'requestfailed',
      text: `${request.url()} ${request.failure()?.errorText ?? ''}`.trim(),
    })
  })

  const response = await page.goto(baseUrl, {
    waitUntil: 'load',
    timeout: 3000,
  })
  const appText = await page.locator('#app').textContent()

  console.log('\n--- browser result ---')
  console.log(`case=${caseName}`)
  console.log(`bundled=${bundled}`)
  console.log(`status=${response?.status() ?? 'null'}`)
  console.log(`appText=${JSON.stringify(appText)}`)
  console.log(JSON.stringify(events, null, 2))

  const hardError = events.find(
    (event) =>
      event.type === 'pageerror' &&
      event.text.includes('node:fs.readFileSync'),
  )

  if (expectedMode === 'fail') {
    if (hardError === undefined) {
      throw new Error('expected a hard browser error for node:fs.readFileSync')
    }

    if (appText !== '') {
      throw new Error(`expected empty app text during failure, got ${JSON.stringify(appText)}`)
    }
  } else {
    if (hardError !== undefined) {
      throw new Error(`expected dev to work, got pageerror: ${hardError.text}`)
    }

    if (appText !== 'ok') {
      throw new Error(`expected app text \"ok\", got ${JSON.stringify(appText)}`)
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await browser?.close()
  child.kill('SIGTERM')
}
