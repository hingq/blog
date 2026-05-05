use serde::{Deserialize, Serialize};

// 这些结构体用于描述外部接口和本地缓存中的 JSON。
// `Serialize` 表示可以写成 JSON，`Deserialize` 表示可以从 JSON 读出来。

/// LeetCode 每日一题接口的顶层响应。
#[derive(Serialize, Deserialize, Debug)]
pub struct TodayRecordResponse {
    pub data: TodayRecordData,
}

/// `#[serde(rename = "...")]` 用来处理 JSON 字段名和 Rust 字段名不一致的情况。
/// 例如 JSON 里是 `todayRecord`，Rust 里按惯例写成 `today_record`。
#[derive(Serialize, Deserialize, Debug)]
pub struct TodayRecordData {
    #[serde(rename = "todayRecord")]
    pub today_record: Vec<TodayRecord>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TodayRecord {
    pub date: String,
    pub question: TodayRecordQuestion,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TodayRecordQuestion {
    #[serde(rename = "titleSlug")]
    pub title_slug: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct QuestionResponse {
    pub data: QuestionData,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct QuestionData {
    pub question: Question,
}

/// 程序内部使用的“每日一题”完整信息。
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DailyQuestion {
    pub date: String,
    pub link: String,
    pub question: Question,
}

/// 单道 LeetCode 题目的核心字段。
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Question {
    #[serde(rename = "translatedTitle")]
    pub title: String,
    #[serde(rename = "titleSlug")]
    pub title_slug: String,
    #[serde(rename = "translatedContent")]
    pub content: String,
    pub difficulty: String,
}

/// 官方题解缓存格式。
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolutionCache {
    pub date: String,
    pub title_slug: String,
    pub content: String,
}

/// LeetCode 中文站题解文章列表响应。
#[derive(Serialize, Deserialize, Debug)]
pub struct SolutionArticlesResponse {
    pub data: SolutionArticlesData,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SolutionArticlesData {
    #[serde(rename = "questionSolutionArticles")]
    pub question_solution_articles: SolutionArticleConnection,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SolutionArticleConnection {
    pub edges: Vec<SolutionArticleEdge>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SolutionArticleEdge {
    pub node: SolutionArticleSummary,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolutionArticleSummary {
    pub title: String,
    pub slug: String,
    #[serde(rename = "canSee")]
    pub can_see: bool,
    #[serde(rename = "byLeetcode")]
    pub by_leetcode: bool,
}

/// LeetCode 中文站题解文章详情响应。
#[derive(Serialize, Deserialize, Debug)]
pub struct SolutionArticleResponse {
    pub data: SolutionArticleData,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SolutionArticleData {
    #[serde(rename = "solutionArticle")]
    pub solution_article: SolutionArticle,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SolutionArticle {
    pub title: String,
    pub slug: String,
    pub content: String,
}

#[cfg(test)]
mod tests {
    use super::SolutionCache;

    #[test]
    fn reads_legacy_solution_cache_with_model_field() {
        let json = r#"{
            "date": "2026-04-28",
            "title_slug": "two-sum",
            "model": "gemini-2.5-flash",
            "content": "题解内容"
        }"#;

        let cache: SolutionCache = serde_json::from_str(json).unwrap();

        assert_eq!(cache.date, "2026-04-28");
        assert_eq!(cache.title_slug, "two-sum");
        assert_eq!(cache.content, "题解内容");
    }
}
