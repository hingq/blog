import type { DailyQuestion } from './types'

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 90_000
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

export function parseModelRequestTimeoutMs(value: string | undefined): number {
  const seconds = Number(value?.trim())
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_MODEL_REQUEST_TIMEOUT_MS
}

export function parseMaxOutputTokens(value: string | undefined): number {
  const tokens = Number(value?.trim())
  return Number.isFinite(tokens) && tokens > 0 ? tokens : DEFAULT_MAX_OUTPUT_TOKENS
}

export function buildGenerateContentRequest(
  prompt: string,
  maxOutputTokens = parseMaxOutputTokens(process.env.GEMINI_MAX_OUTPUT_TOKENS)
) {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens, temperature: 1.0 },
  }
}

export function extractGeminiText(response: unknown): string {
  const candidates =
    (response as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      .candidates ?? []
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text?.trim()) return part.text
    }
  }
  throw new Error('未能从 Gemini API 获取到有效响应内容，请检查 API Key、模型名称或配额')
}

export async function generateSolution(
  question: DailyQuestion,
  apiKey: string,
  models: string[]
): Promise<[string, string]> {
  const errors: string[] = []
  for (const model of models) {
    console.error(`   正在尝试模型 ${model} ...`)
    try {
      return [await generateSolutionWithModel(question, apiKey, model), model]
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`   模型 ${model} 失败，尝试下一个模型: ${message}`)
      errors.push(`${model}: ${message}`)
    }
  }
  throw new Error(
    errors.length ? `所有 Gemini 模型均失败:\n${errors.join('\n')}` : '未配置可用的 Gemini 模型'
  )
}

async function generateSolutionWithModel(
  question: DailyQuestion,
  apiKey: string,
  model: string
): Promise<string> {
  const prompt = `你是一个算法专家。请为 LeetCode 每日一题编写高质量题解。\n\n题目: ${question.question.title}\n难度: ${question.question.difficulty}\n内容: ${question.question.content}\n\n要求:\n1. 使用中文，语言专业简洁。\n2. 包含解题思路分析。\n3. 提供复杂度分析 (时间/空间)。\n4. 提供一份清晰的代码实现，优先使用 TypeScript 或 Python。\n5. 直接输出 Markdown 内容，不需要包裹最外层的 \`\`\`markdown 标签。`
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    parseModelRequestTimeoutMs(process.env.GEMINI_MODEL_TIMEOUT_SECS)
  )
  try {
    const response = await fetch(`${GEMINI_API_BASE_URL}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildGenerateContentRequest(prompt)),
      signal: controller.signal,
    })
    const body = await response.text()
    if (!response.ok)
      throw new Error(`Gemini API 请求失败(model=${model}): HTTP ${response.status}: ${body}`)
    return extractGeminiText(JSON.parse(body))
  } finally {
    clearTimeout(timeout)
  }
}
