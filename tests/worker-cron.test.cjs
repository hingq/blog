const assert = require('node:assert/strict')
const test = require('node:test')

const { nextCronDate } = require('../tasks/dist/worker-cron.cjs')

test('nextCronDate computes the next matching Beijing minute', () => {
  const next = nextCronDate('30 8 * * *', new Date('2026-05-07T00:00:00.000Z'))

  assert.equal(next.toISOString(), '2026-05-07T00:30:00.000Z')
})

test('nextCronDate treats cron fields as Beijing time', () => {
  const next = nextCronDate('0 8 * * *', new Date('2026-05-07T00:00:00.000Z'))

  assert.equal(next.toISOString(), '2026-05-08T00:00:00.000Z')
})

test('nextCronDate advances to the following Beijing day after the scheduled time', () => {
  const next = nextCronDate('0 8 * * *', new Date('2026-05-07T08:00:00.000Z'))

  assert.equal(next.toISOString(), '2026-05-08T00:00:00.000Z')
})

test('nextCronDate rejects invalid cron expressions', () => {
  assert.throws(() => nextCronDate('not a cron', new Date()), /非法 cron/)
})
