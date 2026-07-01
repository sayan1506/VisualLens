// Parent side of the sandbox: spawn the worker, enforce a wall-clock backstop
// on top of the vm's own timeout, and normalize the result. Always resolves
// (never rejects) with { ok, steps, overflow, error? } so the caller can turn
// failures into repair messages for the host LLM.
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const workerPath = resolve(here, 'sandboxWorker.mjs')

export function runInstrumentedCode(code, input = {}, limits = {}) {
  const timeoutMs = limits.timeoutMs ?? 2000
  const maxSteps = limits.maxSteps ?? 40
  const backstopMs = timeoutMs + 1500

  return new Promise((resolvePromise) => {
    const worker = new Worker(workerPath, {
      workerData: { code, input, limits: { timeoutMs, maxSteps } },
    })
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      resolvePromise(result)
    }
    const timer = setTimeout(() => {
      finish({
        ok: false,
        error: `execution exceeded ${backstopMs}ms — likely an infinite loop`,
        steps: [],
        overflow: false,
      })
    }, backstopMs)

    worker.on('message', (msg) => finish(msg))
    worker.on('error', (err) => finish({ ok: false, error: err.message, steps: [], overflow: false }))
    worker.on('exit', (exitCode) => {
      if (!settled) finish({ ok: false, error: `worker exited early (code ${exitCode})`, steps: [], overflow: false })
    })
  })
}
