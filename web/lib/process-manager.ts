import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'

export type JobStatus = 'running' | 'done' | 'failed'
export type JobType = 'upload' | 'voiceover' | 'render' | 'studio'

interface LineListener {
  onLine: (line: string) => void
  onDone: (status: JobStatus) => void
}

interface Job {
  id: string
  type: JobType
  process: ChildProcess
  outputLines: string[]
  status: JobStatus
  listeners: LineListener[]
  startedAt: number
}

const g = globalThis as typeof globalThis & { __jobs?: Map<string, Job> }
if (!g.__jobs) g.__jobs = new Map()
const jobs = g.__jobs

function evictStale(): void {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [id, job] of jobs) {
    if (job.status !== 'running' && job.startedAt < cutoff) {
      jobs.delete(id)
    }
  }
}

function dispatch(job: Job, line: string): void {
  for (const l of job.listeners) {
    try { l.onLine(line) } catch { /* ignore */ }
  }
}

function dispatchDone(job: Job): void {
  for (const l of job.listeners) {
    try { l.onDone(job.status) } catch { /* ignore */ }
  }
  job.listeners = []
}

export class DuplicateJobError extends Error {
  constructor(public readonly existingJobId: string) {
    super(`A job of this type is already running: ${existingJobId}`)
    this.name = 'DuplicateJobError'
  }
}

export interface SpawnOptions {
  cmd: string
  args: string[]
  cwd: string
  env?: Record<string, string>
  shell?: boolean
}

export function spawnJob(type: JobType, options: SpawnOptions): string {
  evictStale()

  for (const job of jobs.values()) {
    if (job.type === type && job.status === 'running') {
      throw new DuplicateJobError(job.id)
    }
  }

  const jobId = randomUUID()

  const child = spawn(options.cmd, options.args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: options.shell ?? false,
  })

  const job: Job = {
    id: jobId,
    type,
    process: child,
    outputLines: [],
    status: 'running',
    listeners: [],
    startedAt: Date.now(),
  }

  jobs.set(jobId, job)

  const handleData = (data: Buffer) => {
    const text = data.toString('utf-8')
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      job.outputLines.push(trimmed)
      dispatch(job, trimmed)
    }
  }

  child.stdout?.on('data', handleData)
  child.stderr?.on('data', handleData)

  child.on('close', (code) => {
    job.status = code === 0 ? 'done' : 'failed'
    dispatchDone(job)
  })

  child.on('error', (err) => {
    job.outputLines.push(`[spawn error] ${err.message}`)
    dispatch(job, `[spawn error] ${err.message}`)
    job.status = 'failed'
    dispatchDone(job)
  })

  return jobId
}

export function subscribeToJob(
  jobId: string,
  onLine: (line: string) => void,
  onDone: (status: JobStatus) => void
): void {
  const job = jobs.get(jobId)
  if (!job) {
    onDone('failed')
    return
  }

  for (const line of job.outputLines) {
    try { onLine(line) } catch { /* ignore */ }
  }

  if (job.status !== 'running') {
    onDone(job.status)
    return
  }

  job.listeners.push({ onLine, onDone })
}

export interface JobSummary {
  id: string
  type: JobType
  status: JobStatus
  lineCount: number
  startedAt: number
}

export function getJob(jobId: string): JobSummary | null {
  const job = jobs.get(jobId)
  if (!job) return null
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    lineCount: job.outputLines.length,
    startedAt: job.startedAt,
  }
}

export function getJobByType(type: JobType): JobSummary | null {
  // Return the most recently started job of this type
  let latest: Job | null = null
  for (const job of jobs.values()) {
    if (job.type === type) {
      if (!latest || job.startedAt > latest.startedAt) {
        latest = job
      }
    }
  }
  if (!latest) return null
  return {
    id: latest.id,
    type: latest.type,
    status: latest.status,
    lineCount: latest.outputLines.length,
    startedAt: latest.startedAt,
  }
}

export function killJob(jobId: string): boolean {
  const job = jobs.get(jobId)
  if (!job || job.status !== 'running') return false
  job.process.kill('SIGTERM')
  if (process.platform === 'win32' && job.process.pid) {
    spawn('taskkill', ['/PID', String(job.process.pid), '/F', '/T'], {
      windowsHide: true,
      stdio: 'ignore',
    })
  }
  return true
}
