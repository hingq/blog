type Field = Set<number>

const ranges = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
] as const

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

function parseField(raw: string, min: number, max: number): Field {
  const values = new Set<number>()
  for (const part of raw.split(',')) {
    if (!part) throw new Error('empty field')
    const [base, stepRaw] = part.split('/')
    const step = stepRaw == null ? 1 : Number(stepRaw)
    if (!Number.isInteger(step) || step <= 0) throw new Error('bad step')

    let start: number
    let end: number
    if (base === '*') {
      start = min
      end = max
    } else if (base.includes('-')) {
      const [a, b] = base.split('-').map(Number)
      start = a
      end = b
    } else {
      start = Number(base)
      end = Number(base)
    }

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < min ||
      end > max ||
      start > end
    ) {
      throw new Error('bad range')
    }
    for (let value = start; value <= end; value += step) values.add(value)
  }
  return values
}

export function parseCron(expression: string): Field[] {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`非法 cron: ${expression}`)
  }

  try {
    return parts.map((part, index) => parseField(part, ranges[index][0], ranges[index][1]))
  } catch {
    throw new Error(`非法 cron: ${expression}`)
  }
}

function matches(fields: Field[], date: Date): boolean {
  const beijingDate = new Date(date.getTime() + BEIJING_OFFSET_MS)
  return (
    fields[0].has(beijingDate.getUTCMinutes()) &&
    fields[1].has(beijingDate.getUTCHours()) &&
    fields[2].has(beijingDate.getUTCDate()) &&
    fields[3].has(beijingDate.getUTCMonth() + 1) &&
    fields[4].has(beijingDate.getUTCDay())
  )
}

export function nextCronDate(expression: string, after: Date): Date {
  const fields = parseCron(expression)
  const candidate = new Date(after.getTime())
  candidate.setUTCSeconds(0, 0)
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)

  const maxMinutes = 366 * 24 * 60 * 5
  for (let i = 0; i < maxMinutes; i += 1) {
    if (matches(fields, candidate)) return new Date(candidate)
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)
  }

  throw new Error(`无法计算下次运行时间: ${expression}`)
}
