const assert = require('node:assert/strict')
const test = require('node:test')

const { createRuntimeState, triggerDueJobs } = require('../tasks/worker/dist/scheduler.js')

test('triggerDueJobs skips a task that is already running', async () => {
  const job = { name: 'daily', enabled: true, cron: '* * * * *', command: 'echo' }
  const state = createRuntimeState([job], new Date('2026-05-07T08:00:00.000Z'))
  state.jobs.daily.running = true
  state.jobs.daily.nextRun = '2026-05-07T08:00:00.000Z'
  const messages = []

  await triggerDueJobs({
    jobs: [job],
    state,
    now: new Date('2026-05-07T08:00:00.000Z'),
    runTask: async () => {
      throw new Error('should not run')
    },
    notifyFailure: async () => {},
    log: (_level, message) => messages.push(message),
  })

  assert.match(messages.join('\n'), /任务 daily 仍在运行，跳过本次触发/)
})

test('triggerDueJobs records a failed task and continues with later jobs', async () => {
  const jobs = [
    { name: 'first', enabled: true, cron: '* * * * *', command: 'first' },
    { name: 'second', enabled: true, cron: '* * * * *', command: 'second' },
  ]
  const state = createRuntimeState(jobs, new Date('2026-05-07T08:00:00.000Z'))
  for (const job of jobs) state.jobs[job.name].nextRun = '2026-05-07T08:00:00.000Z'
  const ran = []

  await triggerDueJobs({
    jobs,
    state,
    now: new Date('2026-05-07T08:00:00.000Z'),
    runTask: async (job) => {
      ran.push(job.name)
      return job.name === 'first'
        ? { ok: false, exitCode: 1, error: 'failed' }
        : { ok: true, exitCode: 0 }
    },
    notifyFailure: async () => {},
    log: () => {},
  })

  assert.deepEqual(ran, ['first', 'second'])
  assert.equal(state.jobs.first.lastExit?.ok, false)
  assert.equal(state.jobs.second.lastExit?.ok, true)
})
