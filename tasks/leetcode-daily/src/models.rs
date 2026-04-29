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

/// Gemini 生成题解后的缓存格式。
///
/// 缓存中记录模型名称，方便之后排查“这篇题解由哪个模型生成”。
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolutionCache {
    pub date: String,
    pub title_slug: String,
    pub model: String,
    pub content: String,
}
