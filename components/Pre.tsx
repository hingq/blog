'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

interface PreProps {
  children?: ReactElement<{ className?: string }>
  [key: string]: unknown
}

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  tsx: 'TSX',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  css: 'CSS',
  scss: 'SCSS',
  html: 'HTML',
  md: 'Markdown',
  mdx: 'MDX',
  py: 'Python',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  sql: 'SQL',
  text: 'Text',
}

const Pre = ({ children, ...rest }: PreProps) => {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const rawLang = String(children?.props?.className ?? '').match(/language-(\w+)/)?.[1]
  const lang = rawLang && rawLang !== 'text' ? (LANGUAGE_LABELS[rawLang] ?? rawLang) : undefined

  const onCopy = () => {
    const text = preRef.current?.textContent ?? ''
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="group relative">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {lang && (
          <span className="rounded-md bg-gray-700/80 px-2 py-1 font-mono text-xs font-medium tracking-wide text-gray-300 select-none dark:bg-gray-900/80">
            {lang}
          </span>
        )}
        <button
          type="button"
          aria-label={copied ? 'Copied' : 'Copy code'}
          onClick={onCopy}
          className={`flex h-8 w-8 items-center justify-center rounded-md border bg-gray-700/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-gray-600 focus:outline-none dark:bg-gray-900/80 dark:hover:bg-gray-800 ${
            copied
              ? 'border-green-400 text-green-400'
              : 'border-gray-600 text-gray-300 hover:text-white'
          }`}
        >
          {copied ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-full w-full"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-full w-full"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      <pre ref={preRef} {...rest}>
        {children}
      </pre>
    </div>
  )
}

export default Pre
