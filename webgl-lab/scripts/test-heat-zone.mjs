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
    lamp: await page.locator('#status-lamp').textContent(),
    tube: await page.locator('#status-tube').textContent(),
    relation: await page.locator('#status-relation').textContent(),
    hint: await page.locator('#hint-text').textContent(),
    debug: await page.locator('#heat-debug').textContent(),
  })

  const results = []

  const initial = await read()
  results.push({
    id: 'T-HEAT-1',
    pass: initial.tube?.includes('未加热') && initial.relation?.includes('未进入火焰上方') && initial.debug?.includes('heating=false'),
    detail: initial,
  })

  await page.locator('#move-lamp-test').dispatchEvent('click')
  await page.locator('#move-tube-heat-test').dispatchEvent('click')
  await page.waitForTimeout(300)
  const heated = await read()
  results.push({
    id: 'T-HEAT-2',
    pass: heated.tube?.includes('加热中') && heated.relation?.includes('已进入火焰上方') && heated.debug?.includes('heating=true'),
    detail: heated,
  })

  await page.locator('#move-tube-outside-heat-test').dispatchEvent('click')
  await page.waitForFunction(() => {
    const text = document.querySelector('#heat-debug')?.textContent || ''
    return text.includes('probe=(1.69, -0.93)')
  })
  await page.waitForTimeout(120)
  const outside = await read()
  results.push({
    id: 'T-HEAT-3',
    pass: outside.tube?.includes('未加热') && outside.relation?.includes('未进入火焰上方') && outside.debug?.includes('heating=false'),
    detail: outside,
  })

  await page.locator('#move-tube-heat-test').dispatchEvent('click')
  await page.waitForTimeout(200)
  await page.locator('#set-flame-off-test').dispatchEvent('click')
  await page.waitForFunction(() => document.querySelector('#flame-flag')?.getAttribute('data-flame-on') === 'false')
  await page.waitForTimeout(120)
  const flameOff = await read()
  results.push({
    id: 'T-HEAT-4',
    pass: flameOff.lamp?.includes('已熄灭') && flameOff.tube?.includes('未加热') && flameOff.debug?.includes('flameOn=false') && flameOff.debug?.includes('heating=false'),
    detail: flameOff,
  })

  await page.locator('#reset-scene').dispatchEvent('click')
  await page.waitForTimeout(300)
  const afterReset = await read()
  results.push({
    id: 'T-HEAT-5',
    pass: afterReset.lamp?.includes('点燃中') && afterReset.tube?.includes('未加热') && afterReset.debug?.includes('flameOn=true') && afterReset.debug?.includes('heating=false'),
    detail: afterReset,
  })

  await browser.close()
  previewServer.kill('SIGTERM')

  const failed = results.filter((item) => !item.pass)
  console.log(JSON.stringify({ subfeature: 'heat-zone', results, summary: { passed: results.length - failed.length, failed: failed.length, success: failed.length === 0 } }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
