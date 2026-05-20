import { pathToFileURL } from 'node:url'

export function runFetchDailyInfo() {
  console.log('fetch-daily-info is ready')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFetchDailyInfo()
}
