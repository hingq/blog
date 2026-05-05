use crate::models::{
    DailyQuestion, QuestionResponse, SolutionArticle, SolutionArticleResponse,
    SolutionArticleSummary, SolutionArticlesResponse, TodayRecordResponse,
};
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

/// 从 LeetCode 中文站获取指定题目的官方题解。
///
/// 中文站题解需要先查文章列表，再用文章 slug 查询正文。
pub async fn fetch_official_solution(title_slug: &str) -> Result<Option<SolutionArticle>> {
    let client = reqwest::Client::new();
    fetch_official_solution_with_client(&client, title_slug).await
}

async fn fetch_official_solution_with_client(
    client: &reqwest::Client,
    title_slug: &str,
) -> Result<Option<SolutionArticle>> {
    let articles_query = r#"
        query questionSolutionArticles($questionSlug: String!, $first: Int!) {
          questionSolutionArticles(
            questionSlug: $questionSlug
            first: $first
            orderBy: DEFAULT
          ) {
            edges {
              node {
                title
                slug
                canSee
                byLeetcode
              }
            }
          }
        }
    "#;

    let articles_resp: SolutionArticlesResponse = client
        .post("https://leetcode.cn/graphql")
        .json(&serde_json::json!({
            "query": articles_query,
            "variables": {
                "questionSlug": title_slug,
                "first": 10
            }
        }))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
        .context("解析 LeetCode 中文站题解列表响应失败")?;

    let Some(article) = select_official_solution_article(
        articles_resp
            .data
            .question_solution_articles
            .edges
            .into_iter()
            .map(|edge| edge.node),
    ) else {
        return Ok(None);
    };

    let article_query = r#"
        query solutionArticle($slug: String!) {
          solutionArticle(slug: $slug, orderBy: DEFAULT) {
            title
            slug
            content
          }
        }
    "#;

    let article_resp: SolutionArticleResponse = client
        .post("https://leetcode.cn/graphql")
        .json(&serde_json::json!({
            "query": article_query,
            "variables": { "slug": article.slug }
        }))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
        .context("解析 LeetCode 中文站官方题解响应失败")?;

    Ok(Some(article_resp.data.solution_article))
}

fn select_official_solution_article<I>(articles: I) -> Option<SolutionArticleSummary>
where
    I: IntoIterator<Item = SolutionArticleSummary>,
{
    articles
        .into_iter()
        .find(|article| article.can_see && article.by_leetcode)
}

#[cfg(test)]
mod tests {
    use super::select_official_solution_article;
    use crate::models::{
        Question, SolutionArticleResponse, SolutionArticleSummary, SolutionArticlesResponse,
        TodayRecordResponse,
    };

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

    #[test]
    fn deserializes_solution_articles_response() {
        let json = r#"{
            "data": {
                "questionSolutionArticles": {
                    "edges": [
                        {
                            "node": {
                                "title": "官方题解",
                                "slug": "two-sum-solution",
                                "canSee": true,
                                "byLeetcode": true
                            }
                        }
                    ]
                }
            }
        }"#;

        let resp: SolutionArticlesResponse = serde_json::from_str(json).unwrap();
        let article = &resp.data.question_solution_articles.edges[0].node;

        assert_eq!(article.slug, "two-sum-solution");
        assert!(article.can_see);
        assert!(article.by_leetcode);
    }

    #[test]
    fn selects_visible_leetcode_solution_article() {
        let selected = select_official_solution_article(vec![
            SolutionArticleSummary {
                title: "社区题解".to_string(),
                slug: "community".to_string(),
                can_see: true,
                by_leetcode: false,
            },
            SolutionArticleSummary {
                title: "官方题解".to_string(),
                slug: "official".to_string(),
                can_see: true,
                by_leetcode: true,
            },
        ])
        .unwrap();

        assert_eq!(selected.slug, "official");
    }

    #[test]
    fn returns_none_without_visible_leetcode_solution_article() {
        let selected = select_official_solution_article(vec![SolutionArticleSummary {
            title: "隐藏官方题解".to_string(),
            slug: "hidden".to_string(),
            can_see: false,
            by_leetcode: true,
        }]);

        assert!(selected.is_none());
    }

    #[test]
    fn deserializes_solution_article_response() {
        let json = r#"{
            "data": {
                "solutionArticle": {
                    "title": "两数之和官方题解",
                    "slug": "two-sum-solution",
                    "content": "<p>使用哈希表。</p>"
                }
            }
        }"#;

        let resp: SolutionArticleResponse = serde_json::from_str(json).unwrap();

        assert_eq!(resp.data.solution_article.title, "两数之和官方题解");
        assert_eq!(resp.data.solution_article.content, "<p>使用哈希表。</p>");
    }
}
