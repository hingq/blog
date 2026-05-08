import esbuild from 'esbuild'

const shared = {
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  bundle: false,
  sourcemap: false,
}

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: [
      'tasks/worker/src/cli.ts',
      'tasks/worker/src/config.ts',
      'tasks/worker/src/cron.ts',
      'tasks/worker/src/runner.ts',
      'tasks/worker/src/scheduler.ts',
      'tasks/worker/src/mailer.ts',
      'tasks/worker/src/state.ts',
      'tasks/worker/src/lock.ts',
      'tasks/worker/src/log.ts',
      'tasks/worker/src/paths.ts',
    ],
    outdir: 'tasks/worker/dist',
  }),
  esbuild.build({
    ...shared,
    entryPoints: [
      'tasks/leetcode-daily/src/index.ts',
      'tasks/leetcode-daily/src/blog.ts',
      'tasks/leetcode-daily/src/cache.ts',
      'tasks/leetcode-daily/src/config.ts',
      'tasks/leetcode-daily/src/email.ts',
      'tasks/leetcode-daily/src/gemini.ts',
      'tasks/leetcode-daily/src/leetcode.ts',
    ],
    outdir: 'tasks/leetcode-daily/dist',
  }),
  esbuild.build({
    ...shared,
    entryPoints: ['tasks/fetch-daily-info/src/index.ts'],
    outdir: 'tasks/fetch-daily-info/dist',
  }),
])
