use crate::models::{DailyQuestion, GeminiResponse};
use anyhow::{bail, Context, Result};
use reqwest::StatusCode;

pub async fn generate_solution(
    question: &DailyQuestion,
    api_key: &str,
    models: &[String],
) -> Result<(String, String)> {
    let mut last_error = None;

    for model in models {
        match generate_solution_with_model(question, api_key, model).await {
            Ok(content) => return Ok((content, model.clone())),
            Err(err) if is_retryable_model_error(&err.to_string()) => {
                eprintln!(
                    "   模型 {} 因配额或限流失败，尝试下一个模型: {}",
                    model, err
                );
                last_error = Some(err);
            }
            Err(err) => return Err(err),
        }
    }

    match last_error {
        Some(err) => Err(err),
        None => bail!("未配置可用的 Gemini 模型"),
    }
}

async fn generate_solution_with_model(
    question: &DailyQuestion,
    api_key: &str,
    model: &str,
) -> Result<String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        model
    );

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

    let body = serde_json::json!({
        "contents": [{ "parts": [{ "text": prompt }] }]
    });

    let resp = client
        .post(url)
        .header("x-goog-api-key", api_key)
        .json(&body)
        .send()
        .await?;

    let status = resp.status();
    let body = resp.text().await?;
    if !status.is_success() {
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

fn is_retryable_model_error(error_message: &str) -> bool {
    let message = error_message.to_ascii_lowercase();
    let retryable_markers = [
        StatusCode::TOO_MANY_REQUESTS.as_str(),
        "resource_exhausted",
        "quota",
        "rate limit",
        "rate_limit",
        "too many requests",
    ];

    retryable_markers
        .iter()
        .any(|marker| message.contains(marker))
}

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
        .context("未能从 Gemini API 获取到有效响应内容，请检查 API Key、模型名称或配额")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_retryable_model_errors() {
        assert!(is_retryable_model_error("HTTP 429: Too Many Requests"));
        assert!(is_retryable_model_error("status: RESOURCE_EXHAUSTED"));
        assert!(is_retryable_model_error("quota exceeded"));
        assert!(!is_retryable_model_error("HTTP 400: invalid argument"));
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
