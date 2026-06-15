'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'
import Link from '@/components/Link'
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
    <div ref={cardRef} className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-gray-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <Link
          href="/"
          className="hover:text-primary-600 dark:hover:text-primary-400 mr-1 inline-flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300"
        >
          <span aria-hidden="true">←</span> 返回
        </Link>
        <span className="mr-auto text-sm font-semibold text-gray-900 dark:text-gray-100">
          思维导图
        </span>
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

      <div className="relative flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900">
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

      {showUpload && <Upload onFile={handleFile} onClose={() => setShowUpload(false)} />}
    </div>
  )
}
