import { spawn } from 'node:child_process'
import process from 'node:process'
import { chromium } from 'playwright'

const PORT = 4176
const URL = `http://127.0.0.1:${PORT}`

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await wait(400)
  }
  throw new Error(`Timeout waiting for ${url}`)
}

function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'pipe', shell: process.platform === 'win32' })
  child.stdout.on('data', (chunk) => process.stdout.write(chunk))
  child.stderr.on('data', (chunk) => process.stderr.write(chunk))
  return child
}

async function run() {
  const cwd = process.cwd()
  const previewServer = start('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PORT)], cwd)
  await waitForHttp(URL)

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  })

  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } })
  await page.goto(URL, { waitUntil: 'networkidle' })

  const read = async () => ({
    button: await page.locator('#toggle-flame').textContent(),
    lamp: await page.locator('#status-lamp').textContent(),
    tube: await page.locator('#status-tube').textContent(),
    relation: await page.locator('#status-relation').textContent(),
    hint: await page.locator('#hint-text').textContent(),
    debug: await page.locator('#flame-debug').textContent(),
  })

  const results = []

  const initial = await read()
  results.push({
    id: 'T-FLAME-1',
    pass: initial.button?.includes('熄灭火焰') && initial.lamp?.includes('点燃中'),
    detail: initial,
  })

  await page.locator('#move-lamp-test').dispatchEvent('click')
  await page.locator('#move-tube-heat-test').dispatchEvent('click')
  await page.waitForTimeout(300)
  const heated = await read()
  results.push({
    id: 'T-FLAME-2-preheat',
    pass: heated.tube?.includes('加热中') && heated.relation?.includes('已进入火焰上方'),
    detail: heated,
  })

  await page.locator('#set-flame-off-test').dispatchEvent('click')
  await page.waitForFunction(() => document.querySelector('#flame-flag')?.getAttribute('data-flame-on') === 'false')
  await page.waitForTimeout(120)
  const afterOff = await read()
  results.push({
    id: 'T-FLAME-2',
    pass: afterOff.tube?.includes('未加热') && afterOff.relation?.includes('未进入火焰上方'),
    detail: afterOff,
  })

  results.push({
    id: 'T-FLAME-3',
    pass: afterOff.button?.includes('点燃火焰') && afterOff.lamp?.includes('已熄灭') && afterOff.hint?.includes('火焰已关闭'),
    detail: afterOff,
  })

  await page.locator('#reset-scene').dispatchEvent('click')
  await page.waitForTimeout(400)
  const afterReset = await read()
  results.push({
    id: 'T-FLAME-4',
    pass: afterReset.button?.includes('熄灭火焰') && afterReset.lamp?.includes('点燃中') && afterReset.tube?.includes('未加热'),
    detail: afterReset,
  })

  await browser.close()
  previewServer.kill('SIGTERM')

  const failed = results.filter((item) => !item.pass)
  console.log(JSON.stringify({ subfeature: 'flame-toggle', results, summary: { passed: results.length - failed.length, failed: failed.length, success: failed.length === 0 } }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
