import fs from 'node:fs'

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function acquireLock(lockPath: string): () => void {
  if (fs.existsSync(lockPath)) {
    const pid = Number(fs.readFileSync(lockPath, 'utf8').trim())
    if (Number.isInteger(pid) && pid > 0 && isProcessAlive(pid)) {
      throw new Error(`调度器已在运行，锁文件: ${lockPath}`)
    }
    fs.rmSync(lockPath, { force: true })
  }

  const fd = fs.openSync(lockPath, 'wx')
  fs.writeFileSync(fd, `${process.pid}\n`)
  fs.closeSync(fd)

  return () => fs.rmSync(lockPath, { force: true })
}
