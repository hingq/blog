'use client'

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useRef, useState } from 'react'

interface UploadProps {
  onFile: (file: File) => void
  onClose: () => void
}

export default function Upload({ onFile, onClose }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const pick = (file?: File | null) => {
    if (file) onFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files?.[0])
  }

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
          <button
            type="button"
            className="absolute top-4 right-4 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="1,1 15,15" />
                <polyline points="15,1 1,15" />
              </g>
            </svg>
          </button>

          <DialogTitle className="mb-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            上传 Markdown
          </DialogTitle>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            选择或拖入一个 Markdown 文件，自动解析为思维导图。
          </p>

          <button
            type="button"
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'hover:border-primary-500 border-gray-300 dark:border-gray-600'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
              <g
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-500"
              >
                <polyline points="7 12 12 7 17 12" />
                <line x1="12" y1="7" x2="12" y2="17" />
                <path d="M5 19h14" />
              </g>
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              点击选择文件，或拖拽到此处
            </span>
            <span className="text-xs text-gray-400">支持 .md / .markdown</span>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".md,.markdown,text/markdown"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </DialogPanel>
      </div>
    </Dialog>
  )
}
