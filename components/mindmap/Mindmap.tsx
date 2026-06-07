'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import 'jsmind/style/jsmind.css'
import jsMind from 'jsmind'
import read from './flieRead'
import Upload from './Upload'

const ROOT = { id: 'root', isroot: true, topic: 'Markdown' }

const META = {
  meta: { name: 'jsmind', author: '', version: '0.2' },
  format: 'node_array' as const,
}

const buttonClass =
  'hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200'

export default function Mindmap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  // jsMind 实例，避免引入额外类型依赖
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instanceRef = useRef<any>(null)
  const { resolvedTheme } = useTheme()
  const [hasData, setHasData] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const jmTheme = resolvedTheme === 'dark' ? 'asphalt' : 'primary'

  const ensureInstance = useCallback(() => {
    if (!instanceRef.current && containerRef.current) {
      // jsMind 运行时支持部分 options，其构造类型却要求完整对象，故以 any 传入
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = {
        container: containerRef.current,
        editable: true,
        theme: jmTheme,
        view: { line_width: 2, node_overflow: 'wrap' },
      }
      instanceRef.current = new jsMind(options)
    }
    return instanceRef.current
  }, [jmTheme])

  // 主题跟随站点明/暗色切换
  useEffect(() => {
    instanceRef.current?.set_theme(jmTheme)
  }, [jmTheme])

  // 同步浏览器全屏状态
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === cardRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const handleFile = (file: File) => {
    const result = read(file)
    if (!result) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.then((nodes: any[]) => {
      const instance = ensureInstance()
      if (!instance) return
      instance.show({ ...META, data: [ROOT, ...nodes] })
      setHasData(true)
      setShowUpload(false)
    })
  }

  const handleClear = () => {
    instanceRef.current?.show({ ...META, data: [ROOT] })
    setHasData(false)
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      cardRef.current?.requestFullscreen()
    }
  }

  return (
    <div className="space-y-4">
      <div
        ref={cardRef}
        className={`flex flex-col gap-3 bg-white dark:bg-gray-950 ${
          isFullscreen
            ? 'h-screen w-screen p-4'
            : 'rounded-md border-2 border-gray-200/60 p-4 dark:border-gray-700/60'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass} onClick={() => setShowUpload(true)}>
            上传 Markdown
          </button>
          <button type="button" className={buttonClass} onClick={handleClear} disabled={!hasData}>
            清空
          </button>
          <button type="button" className={buttonClass} onClick={toggleFullscreen}>
            {isFullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>

        <div
          className={`relative w-full overflow-hidden rounded-md bg-gray-50 dark:bg-gray-900 ${
            isFullscreen ? 'flex-1' : 'h-[70vh]'
          }`}
        >
          <div ref={containerRef} id="jsmind_container" className="h-full w-full" />
          {!hasData && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                上传一个 Markdown 文件，自动生成思维导图
              </p>
              <button
                type="button"
                className={`${buttonClass} pointer-events-auto`}
                onClick={() => setShowUpload(true)}
              >
                选择文件
              </button>
            </div>
          )}
        </div>
      </div>

      {showUpload && <Upload onFile={handleFile} onClose={() => setShowUpload(false)} />}
    </div>
  )
}
