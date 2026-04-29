use crate::models::DailyQuestion;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::env;
use std::time::Duration;

const GEMINI_API_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL_REQUEST_TIMEOUT_SECS: u64 = 90;
const DEFAULT_MAX_OUTPUT_TOKENS: u64 = 4096;

/// 按顺序尝试多个 Gemini 模型，返回第一份成功生成的题解和使用的模型名。
///
/// 这样配置多个候选模型时，某个模型不可用不会直接导致整个任务失败。
pub async fn generate_solution(
    question: &DailyQuestion,
    api_key: &str,
    models: &[String],
) -> Result<(String, String)> {
    let mut errors = Vec::new();

    for model in models {
        eprintln!("   正在尝试模型 {} ...", model);
        match generate_solution_with_model(question, api_key, model).await {
            Ok(content) => return Ok((content, model.clone())),
            Err(err) => {
                eprintln!("   模型 {} 失败，尝试下一个模型: {}", model, err);
                errors.push(format!("{}: {}", model, err));
            }
        }
    }

    if errors.is_empty() {
        bail!("未配置可用的 Gemini 模型")
    } else {
        bail!("所有 Gemini 模型均失败:\n{}", errors.join("\n"))
    }
}

/// 使用默认 Gemini API 地址生成题解。
async fn generate_solution_with_model(
    question: &DailyQuestion,
    api_key: &str,
    model: &str,
) -> Result<String> {
    generate_solution_with_model_base_url(
        question,
        api_key,
        model,
        GEMINI_API_BASE_URL,
        model_request_timeout(),
    )
    .await
}

/// 实际发送 HTTP 请求的函数。
///
/// 单独传入 `base_url` 和 `timeout`，主要是为了测试时可以替换外部依赖。
async fn generate_solution_with_model_base_url(
    question: &DailyQuestion,
    api_key: &str,
    model: &str,
    base_url: &str,
    timeout: Duration,
) -> Result<String> {
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .context("创建 Gemini HTTP 客户端失败")?;
    let url = format!(
        "{}/models/{}:generateContent",
        base_url.trim_end_matches('/'),
        model
    );

    // prompt 是给模型的完整指令，决定生成内容的语言、结构和代码偏好。
    let prompt = format!(
        "你是一个算法专家。请为 LeetCode 每日一题编写高质量题解。\n\n\
        题目: {}\n\
        难度: {}\n\
        内容: {}\n\n\
        要求:\n\
        1. 使用中文，语言专业简洁。\n\
        2. 包含解题思路分析。\n\
        3. 提供复杂度分析 (时间/空间)。\n\
        4. 提供一份清晰的代码实现 (优先使用 Rust 或 Python)。\n\
        5. 直接输出 Markdown 内容，不需要包裹最外层的 ```markdown 标签。",
        question.question.title, question.question.difficulty, question.question.content
    );

    let body = generate_content_request_body(&prompt);

    let resp = client
        .post(url)
        .header("x-goog-api-key", api_key)
        .json(&body)
        .send()
        .await
        .map_err(|err| {
            if err.is_timeout() {
                anyhow::anyhow!("Gemini API 请求超时(model={}): {}", model, err)
            } else {
                err.into()
            }
        })?;

    let status = resp.status();
    let body = resp.text().await?;
    if !status.is_success() {
        // 非 2xx 响应也要保留响应体，里面通常包含配额、模型名或权限错误。
        bail!(
            "Gemini API 请求失败(model={}): HTTP {}: {}",
            model,
            status,
            body
        );
    }

    let resp: GeminiResponse = serde_json::from_str(&body).context("解析 Gemini API 响应失败")?;
    extract_gemini_text(resp)
}

/// 从环境变量读取单个模型请求的超时时间。
fn model_request_timeout() -> Duration {
    let configured = env::var("GEMINI_MODEL_TIMEOUT_SECS").ok();
    parse_model_request_timeout(configured.as_deref())
}

/// 解析超时时间；非法、空值、0 都回退到默认值。
fn parse_model_request_timeout(value: Option<&str>) -> Duration {
    let seconds = value
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|seconds| *seconds > 0)
        .unwrap_or(DEFAULT_MODEL_REQUEST_TIMEOUT_SECS);

    Duration::from_secs(seconds)
}

/// 从环境变量读取模型最多输出的 token 数。
fn max_output_tokens() -> u64 {
    let configured = env::var("GEMINI_MAX_OUTPUT_TOKENS").ok();
    parse_max_output_tokens(configured.as_deref())
}

/// 解析最大输出 token 数；非法、空值、0 都回退到默认值。
fn parse_max_output_tokens(value: Option<&str>) -> u64 {
    value
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|tokens| *tokens > 0)
        .unwrap_or(DEFAULT_MAX_OUTPUT_TOKENS)
}

/// 构造 Gemini `generateContent` 接口需要的 JSON 请求体。
fn generate_content_request_body(prompt: &str) -> serde_json::Value {
    serde_json::json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "maxOutputTokens": max_output_tokens(),
            "temperature": 1.0
        },
    })
}

/// 从 Gemini 响应中取出真正的文本内容。
///
/// API 返回结构比较深，所以这里逐层取第一条 candidate、content、part。
fn extract_gemini_text(resp: GeminiResponse) -> Result<String> {
    resp.candidates
        .into_iter()
        .next()
        .and_then(|candidate| {
            candidate
                .content
                .parts
                .into_iter()
                .find_map(|part| part.text)
        })
        .filter(|content| !content.trim().is_empty())
        .context("未能从 Gemini API 获取到有效响应内容，请检查 API Key、模型名称或配额")
}

#[derive(Deserialize, Debug)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize, Debug)]
struct GeminiCandidate {
    content: GeminiContent,
}

#[derive(Deserialize, Debug)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Deserialize, Debug)]
struct GeminiPart {
    text: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_model_request_timeout() {
        assert_eq!(
            parse_model_request_timeout(Some("10")),
            Duration::from_secs(10)
        );
        assert_eq!(
            parse_model_request_timeout(Some("0")),
            Duration::from_secs(DEFAULT_MODEL_REQUEST_TIMEOUT_SECS)
        );
        assert_eq!(
            parse_model_request_timeout(Some("invalid")),
            Duration::from_secs(DEFAULT_MODEL_REQUEST_TIMEOUT_SECS)
        );
        assert_eq!(
            parse_model_request_timeout(None),
            Duration::from_secs(DEFAULT_MODEL_REQUEST_TIMEOUT_SECS)
        );
    }

    #[test]
    fn parses_max_output_tokens() {
        assert_eq!(parse_max_output_tokens(Some("2048")), 2048);
        assert_eq!(
            parse_max_output_tokens(Some("0")),
            DEFAULT_MAX_OUTPUT_TOKENS
        );
        assert_eq!(
            parse_max_output_tokens(Some("invalid")),
            DEFAULT_MAX_OUTPUT_TOKENS
        );
        assert_eq!(parse_max_output_tokens(None), DEFAULT_MAX_OUTPUT_TOKENS);
    }

    #[test]
    fn builds_gemini_generate_content_request_with_completion_token_limit() {
        let body = generate_content_request_body("写一段题解");

        assert_eq!(body["contents"][0]["parts"][0]["text"], "写一段题解");
        assert_eq!(
            body["generationConfig"]["maxOutputTokens"],
            serde_json::json!(DEFAULT_MAX_OUTPUT_TOKENS)
        );
        assert!(body.get("model").is_none());
        assert!(body.get("messages").is_none());
        assert!(body.get("max_completion_tokens").is_none());
    }

    #[test]
    fn extracts_gemini_text() {
        let json = r#"{
            "candidates": [
                {
                    "content": {
                        "parts": [
                            { "text": "题解内容" }
                        ]
                    }
                }
            ]
        }"#;
        let resp: GeminiResponse = serde_json::from_str(json).unwrap();

        assert_eq!(extract_gemini_text(resp).unwrap(), "题解内容");
    }
}
