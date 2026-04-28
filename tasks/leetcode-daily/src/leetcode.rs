use crate::models::{DailyQuestion, QuestionResponse, TodayRecordResponse};
use anyhow::{Context, Result};

pub async fn fetch_daily_question() -> Result<DailyQuestion> {
    let client = reqwest::Client::new();
    let today_query = r#"
        query questionOfToday {
          todayRecord {
            date
            question {
              titleSlug
            }
          }
        }
    "#;

    let today_resp: TodayRecordResponse = client
        .post("https://leetcode.cn/graphql")
        .json(&serde_json::json!({ "query": today_query }))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
        .context("解析 LeetCode 中文站每日一题响应失败")?;

    let today = today_resp
        .data
        .today_record
        .into_iter()
        .next()
        .context("LeetCode 中文站未返回每日一题")?;

    let question_query = r#"
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            translatedTitle
            titleSlug
            translatedContent
            difficulty
          }
        }
    "#;

    let question_resp: QuestionResponse = client
        .post("https://leetcode.cn/graphql")
        .json(&serde_json::json!({
            "query": question_query,
            "variables": { "titleSlug": today.question.title_slug }
        }))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
        .context("解析 LeetCode 中文站题目详情响应失败")?;

    Ok(DailyQuestion {
        date: today.date,
        link: format!("/problems/{}/", question_resp.data.question.title_slug),
        question: question_resp.data.question,
    })
}

#[cfg(test)]
mod tests {
    use crate::models::{Question, TodayRecordResponse};

    #[test]
    fn deserializes_chinese_question_fields() {
        let json = r#"{
            "titleSlug": "two-sum",
            "translatedTitle": "两数之和",
            "translatedContent": "<p>给定一个整数数组 nums...</p>",
            "difficulty": "Easy"
        }"#;

        let question: Question = serde_json::from_str(json).unwrap();

        assert_eq!(question.title, "两数之和");
        assert_eq!(question.content, "<p>给定一个整数数组 nums...</p>");
        assert_eq!(question.title_slug, "two-sum");
        assert_eq!(question.difficulty, "Easy");
    }

    #[test]
    fn deserializes_today_record_response() {
        let json = r#"{
            "data": {
                "todayRecord": [
                    {
                        "date": "2026-04-28",
                        "question": {
                            "titleSlug": "minimum-operations-to-make-a-uni-value-grid"
                        }
                    }
                ]
            }
        }"#;

        let resp: TodayRecordResponse = serde_json::from_str(json).unwrap();

        assert_eq!(resp.data.today_record[0].date, "2026-04-28");
        assert_eq!(
            resp.data.today_record[0].question.title_slug,
            "minimum-operations-to-make-a-uni-value-grid"
        );
    }
}
