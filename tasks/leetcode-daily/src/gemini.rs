use crate::models::{DailyQuestion, GeminiResponse};
use anyhow::{bail, Context, Result};

pub async fn generate_solution(
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
        bail!("Gemini API 请求失败: HTTP {}: {}", status, body);
    }

    let resp: GeminiResponse = serde_json::from_str(&body).context("解析 Gemini API 响应失败")?;
    extract_gemini_text(resp)
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
