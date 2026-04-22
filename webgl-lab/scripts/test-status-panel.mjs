import { spawn } from 'node:child_process'
import process from 'node:process'
import { chromium } from 'playwright'

const PORT = 4176
const URL = `http://127.0.0.1:${PORT}`

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok) return } catch {}
    await wait(400)
  }
  throw new Error(`Timeout waiting for ${url}`)
}
function start(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'pipe', shell: process.platform === 'win32' })
  child.stdout.on('data', (c) => process.stdout.write(c))
  child.stderr.on('data', (c) => process.stderr.write(c))
  return child
}

async function run() {
  const cwd = process.cwd()
  const previewServer = start('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PORT)], cwd)
  await waitForHttp(URL)
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } })
  await page.goto(URL, { waitUntil: 'networkidle' })

  const read = async () => ({
    selected: await page.locator('#status-selected').textContent(),
    lamp: await page.locator('#status-lamp').textContent(),
    tube: await page.locator('#status-tube').textContent(),
    relation: await page.locator('#status-relation').textContent(),
    debug: await page.locator('#heat-debug').textContent(),
  })

  const results = []
  const initial = await read()
  results.push({ id: 'T-STATUS-1', pass: initial.selected?.includes('酒精灯') && initial.lamp?.includes('点燃中') && initial.tube?.includes('未加热') && initial.relation?.includes('未进入火焰上方'), detail: initial })

  await page.locator('#move-lamp-test').dispatchEvent('click')
  await page.waitForTimeout(200)
  await page.locator('#move-tube-heat-test').dispatchEvent('click')
  await page.locator('#select-tube-test').dispatchEvent('click')
  await page.waitForTimeout(300)
  const heated = await read()
  results.push({ id: 'T-STATUS-2', pass: heated.selected?.includes('试管') && heated.lamp?.includes('点燃中') && heated.tube?.includes('加热中') && heated.relation?.includes('已进入火焰上方'), detail: heated })

  await page.locator('#set-flame-off-test').dispatchEvent('click')
  await page.waitForFunction(() => document.querySelector('#flame-flag')?.getAttribute('data-flame-on') === 'false')
  await page.waitForTimeout(120)
  const flameOff = await read()
  results.push({ id: 'T-STATUS-3', pass: flameOff.selected?.includes('试管') && flameOff.lamp?.includes('已熄灭') && flameOff.tube?.includes('未加热') && flameOff.relation?.includes('未进入火焰上方') && flameOff.debug?.includes('flameOn=false') && flameOff.debug?.includes('heating=false'), detail: flameOff })

  await page.locator('#reset-scene-test').dispatchEvent('click')
  await page.locator('#select-lamp-test').dispatchEvent('click')
  await page.waitForTimeout(300)
  const afterReset = await read()
  results.push({ id: 'T-STATUS-4', pass: afterReset.selected?.includes('酒精灯') && afterReset.lamp?.includes('点燃中') && afterReset.tube?.includes('未加热') && afterReset.relation?.includes('未进入火焰上方'), detail: afterReset })

  await browser.close()
  previewServer.kill('SIGTERM')
  const failed = results.filter((item) => !item.pass)
  console.log(JSON.stringify({ subfeature: 'status-panel-consistency', results, summary: { passed: results.length - failed.length, failed: failed.length, success: failed.length === 0 } }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
