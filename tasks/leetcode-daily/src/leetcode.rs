use crate::models::{DailyQuestion, QuestionResponse, TodayRecordResponse};
use anyhow::{Context, Result};

/// 从 LeetCode 中文站获取每日一题。
///
/// LeetCode 的接口是 GraphQL：第一次请求拿到当天题目的 `titleSlug`，
/// 第二次再用这个 slug 查询完整题目内容。
pub async fn fetch_daily_question() -> Result<DailyQuestion> {
    let client = reqwest::Client::new();

    // GraphQL 查询字符串。这里只请求当前流程真正需要的字段。
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

    // `todayRecord` 是数组，当前程序只取第一条作为今天的题目。
    let today = today_resp
        .data
        .today_record
        .into_iter()
        .next()
        .context("LeetCode 中文站未返回每日一题")?;

    // 第二个查询需要变量 `$titleSlug`，变量值在 `.json(...)` 中传入。
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

    // 把外部接口响应转换成项目内部更好使用的结构。
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
