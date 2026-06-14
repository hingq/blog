'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'
import Upload from './Upload'

// markmap-lib 内部基于 remark 解析 Markdown，复用成熟管线，无需自造解析器
const transformer = new Transformer()
const EMPTY_ROOT = { content: 'Markdown', children: [] }

const buttonClass =
  'hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200'

export default function Mindmap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<Markmap | null>(null)
  const [hasData, setHasData] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const ensureInstance = useCallback(() => {
    if (!instanceRef.current && svgRef.current) {
      instanceRef.current = Markmap.create(svgRef.current, { autoFit: true })
    }
    return instanceRef.current
  }, [])

  // 同步浏览器全屏状态
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === cardRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // 窗口尺寸变化时重新适配画布
  useEffect(() => {
    const onResize = () => instanceRef.current?.fit()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 全屏切换后重新适配
  useEffect(() => {
    instanceRef.current?.fit()
  }, [isFullscreen])

  // 卸载时销毁实例
  useEffect(() => {
    return () => instanceRef.current?.destroy()
  }, [])

  const handleFile = async (file: File) => {
    const markdown = await file.text()
    const { root } = transformer.transform(markdown)
    const instance = ensureInstance()
    if (!instance) return
    await instance.setData(root)
    await instance.fit()
    setHasData(true)
    setShowUpload(false)
  }

  const handleClear = () => {
    instanceRef.current?.setData(EMPTY_ROOT)
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
            : 'relative left-1/2 w-screen -translate-x-1/2 border-y-2 border-gray-200/60 p-4 sm:px-6 xl:px-8 dark:border-gray-700/60'
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
            isFullscreen ? 'flex-1' : 'h-[78vh]'
          }`}
        >
          <svg ref={svgRef} className="h-full w-full" />
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
