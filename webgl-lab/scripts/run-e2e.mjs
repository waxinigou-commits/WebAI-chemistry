import { spawn } from 'node:child_process'
import process from 'node:process'
import { chromium } from 'playwright'

const VITE_PORT = 4175
const PREVIEW_PORT = 4176
const appUrl = `http://127.0.0.1:${PREVIEW_PORT}`

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // ignore
    }
    await wait(500)
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
  const devServer = start('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(VITE_PORT)], cwd)
  await waitForHttp(`http://127.0.0.1:${VITE_PORT}`)

  const previewServer = start('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)], cwd)
  await waitForHttp(appUrl)

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  })

  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } })
  await page.goto(appUrl, { waitUntil: 'networkidle' })

  const tests = []
  const status = async () => ({
    selected: await page.locator('#status-selected').textContent(),
    lamp: await page.locator('#status-lamp').textContent(),
    tube: await page.locator('#status-tube').textContent(),
    relation: await page.locator('#status-relation').textContent(),
    hint: await page.locator('#hint-text').textContent(),
  })

  tests.push({
    id: 'T1',
    name: '结构测试',
    pass:
      (await page.locator('canvas').count()) > 0 &&
      (await page.locator('#reset-scene').isVisible()) &&
      (await page.locator('#toggle-flame').isVisible()) &&
      (await page.locator('#status-selected').isVisible()) &&
      (await page.locator('#status-lamp').isVisible()) &&
      (await page.locator('#status-tube').isVisible()) &&
      (await page.locator('#status-relation').isVisible()),
  })

  const hintBefore = await status()
  await page.click('#move-lamp-test')
  await page.click('#move-tube-heat-test')
  const hintAfterDrag = await status()
  tests.push({
    id: 'T2',
    name: '拖动交互测试',
    pass: hintBefore.selected !== hintAfterDrag.selected && hintAfterDrag.selected?.includes('试管'),
    detail: hintAfterDrag,
  })

  tests.push({
    id: 'T3',
    name: '热区逻辑测试',
    pass: hintAfterDrag.tube?.includes('加热中') && hintAfterDrag.relation?.includes('已进入火焰上方'),
    detail: hintAfterDrag,
  })

  await page.locator('#toggle-flame-test').click()
  await page.waitForTimeout(300)
  const afterFlameOff = await status()
  const flameButtonText = await page.locator('#toggle-flame').textContent()
  await page.locator('#reset-scene').click()
  await page.waitForTimeout(300)
  const afterReset = await status()
  tests.push({
    id: 'T4',
    name: '边界状态测试',
    pass:
      flameButtonText?.includes('点燃火焰') &&
      afterFlameOff.lamp?.includes('已熄灭') &&
      afterFlameOff.tube?.includes('未加热') &&
      afterReset.selected?.includes('酒精灯') &&
      afterReset.lamp?.includes('点燃中') &&
      afterReset.tube?.includes('未加热'),
    detail: { flameButtonText, afterFlameOff, afterReset },
  })

  const mobilePage = await browser.newPage({ viewport: { width: 768, height: 1024 } })
  await mobilePage.goto(appUrl, { waitUntil: 'networkidle' })
  const sceneBox = await mobilePage.locator('.scene-panel').boundingBox()
  const sideBox = await mobilePage.locator('.side-panel').boundingBox()
  const hudVisible = await mobilePage.locator('.hud-left').isVisible()
  const canvasVisible = await mobilePage.locator('canvas').isVisible()
  tests.push({
    id: 'T5',
    name: '响应式与视觉测试',
    pass: !!sceneBox && !!sideBox && !!canvasVisible && !!hudVisible && sideBox.y > sceneBox.y,
    detail: { sceneBox, sideBox, hudVisible, canvasVisible },
  })

  await page.screenshot({ path: 'test-report-desktop.png', fullPage: true })
  await mobilePage.screenshot({ path: 'test-report-tablet.png', fullPage: true })
  await mobilePage.close()
  await browser.close()
  previewServer.kill('SIGTERM')
  devServer.kill('SIGTERM')

  const failed = tests.filter((test) => !test.pass)
  const report = {
    environment: {
      appUrl,
      viewport: '1440x980 + 768x1024',
      browser: 'Google Chrome via Playwright',
    },
    results: tests,
    summary: {
      passed: tests.length - failed.length,
      failed: failed.length,
      success: failed.length === 0,
    },
  }

  console.log(JSON.stringify(report, null, 2))

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
