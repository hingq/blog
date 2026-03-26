import * as jsxRuntime from 'react/jsx-runtime'
import type { MDXComponents } from 'mdx/types'

interface MDXRendererProps {
  code: string
  components?: MDXComponents
  [key: string]: unknown
}

function getMDXComponent(code: string) {
  const fn = new Function(code)
  return fn(jsxRuntime).default
}

export default function MDXRenderer({ code, components, ...rest }: MDXRendererProps) {
  const Content = getMDXComponent(code)
  return <Content components={components} {...rest} />
}
