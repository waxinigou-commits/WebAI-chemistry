import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

const ROOT = process.cwd()
const FLOW_DIR = path.join(ROOT, '.flow')
const FLOW_FILE = path.join(FLOW_DIR, 'feature-flow-state.json')

const FEATURES = [
  {
    id: 'feature-1-flame-toggle',
    name: '功能 1 火焰开关',
    command: ['npm', 'run', 'test:flame-toggle'],
  },
  {
    id: 'feature-2-heat-zone',
    name: '功能 2 热区判定',
    command: ['npm', 'run', 'test:heat-zone'],
  },
  {
    id: 'feature-3-reset-logic',
    name: '功能 3 重置逻辑',
    command: ['npm', 'run', 'test:reset-logic'],
  },
  {
    id: 'feature-4-status-panel',
    name: '功能 4 状态面板一致性',
    command: ['npm', 'run', 'test:status-panel'],
  },
  {
    id: 'feature-5-e2e',
    name: '功能 5 总体验收',
    command: ['npm', 'run', 'test:e2e'],
  },
]

function now() {
  return new Date().toISOString()
}

function defaultState() {
  return {
    version: 1,
    status: 'idle',
    currentIndex: 0,
    maxRetries: 2,
    startedAt: null,
    updatedAt: now(),
    features: FEATURES.map((feature, index) => ({
      index,
      id: feature.id,
      name: feature.name,
      command: feature.command.join(' '),
      status: 'pending',
      attempts: 0,
      lastExitCode: null,
      lastSignal: null,
      lastError: null,
      startedAt: null,
      finishedAt: null,
    })),
    history: [],
  }
}

async function ensureDir() {
  await fs.mkdir(FLOW_DIR, { recursive: true })
}

async function loadState() {
  await ensureDir()
  try {
    const raw = await fs.readFile(FLOW_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    const state = defaultState()
    await saveState(state)
    return state
  }
}

async function saveState(state) {
  state.updatedAt = now()
  await ensureDir()
  await fs.writeFile(FLOW_FILE, JSON.stringify(state, null, 2))
}

function pushHistory(state, entry) {
  state.history.push({ at: now(), ...entry })
  state.history = state.history.slice(-200)
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'pipe',
      shell: process.platform === 'win32',
      ...options,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })

    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }))
  })
}

async function cleanupEnvironment() {
  const script = `lsof -nP -iTCP:4176-4185 -sTCP:LISTEN | awk 'NR>1 {print $2}' | xargs kill -9 2>/dev/null || true`
  await runCommand('bash', ['-lc', script])
}

function printStepSummary(feature) {
  const status = feature.status === 'passed' ? '✅' : feature.status === 'failed' ? '❌' : '⏳'
  console.log(`${status} ${feature.name} | attempts=${feature.attempts} | exit=${feature.lastExitCode} | signal=${feature.lastSignal ?? 'none'}`)
  if (feature.lastError) console.log(`   reason: ${feature.lastError}`)
}

async function runFeature(state, feature) {
  feature.status = 'running'
  feature.attempts += 1
  feature.startedAt = feature.startedAt ?? now()
  feature.finishedAt = null
  feature.lastError = null
  pushHistory(state, { type: 'feature_started', featureId: feature.id, attempt: feature.attempts })
  await saveState(state)

  await cleanupEnvironment()

  const [command, ...args] = FEATURES[feature.index].command
  const result = await runCommand(command, args)

  feature.lastExitCode = result.code
  feature.lastSignal = result.signal
  feature.finishedAt = now()

  if (result.code === 0) {
    feature.status = 'passed'
    pushHistory(state, { type: 'feature_passed', featureId: feature.id, attempt: feature.attempts })
    await saveState(state)
    printStepSummary(feature)
    return { ok: true }
  }

  feature.status = 'failed'
  feature.lastError = summarizeFailure(result)
  pushHistory(state, { type: 'feature_failed', featureId: feature.id, attempt: feature.attempts, error: feature.lastError })
  await saveState(state)
  printStepSummary(feature)
  return { ok: false, retryable: isRetryable(feature.lastError, result.signal) }
}

function summarizeFailure(result) {
  const text = `${result.stderr || ''}\n${result.stdout || ''}`.trim()
  if (!text) return result.signal ? `signal:${result.signal}` : `exit:${result.code}`
  return text.split('\n').slice(-8).join(' | ').slice(0, 800)
}

function isRetryable(message, signal) {
  if (signal === 'SIGKILL') return true
  return /(Port .* is in use|Timeout|timed out|ECONNREFUSED|EADDRINUSE|Target page, context or browser has been closed)/i.test(message)
}

async function runFlow() {
  const state = await loadState()
  if (!state.startedAt) state.startedAt = now()
  state.status = 'running'
  await saveState(state)

  for (let index = state.currentIndex; index < state.features.length; index += 1) {
    state.currentIndex = index
    const feature = state.features[index]

    if (feature.status === 'passed') continue

    let outcome = await runFeature(state, feature)
    while (!outcome.ok && outcome.retryable && feature.attempts <= state.maxRetries) {
      pushHistory(state, { type: 'feature_retrying', featureId: feature.id, nextAttempt: feature.attempts + 1 })
      await saveState(state)
      outcome = await runFeature(state, feature)
    }

    if (!outcome.ok) {
      state.status = 'blocked'
      pushHistory(state, { type: 'flow_blocked', featureId: feature.id })
      await saveState(state)
      console.log(`FLOW_BLOCKED at ${feature.name}`)
      return
    }
  }

  state.status = 'completed'
  pushHistory(state, { type: 'flow_completed' })
  await saveState(state)
  console.log('FLOW_COMPLETED')
}

async function printStatus() {
  const state = await loadState()
  console.log(JSON.stringify(state, null, 2))
}

async function resetFlow() {
  const state = defaultState()
  await saveState(state)
  console.log('FLOW_RESET')
}

const action = process.argv[2] ?? 'run'

if (action === 'status') {
  await printStatus()
} else if (action === 'reset') {
  await resetFlow()
} else if (action === 'run') {
  await runFlow()
} else {
  console.error(`Unknown action: ${action}`)
  process.exitCode = 1
}
