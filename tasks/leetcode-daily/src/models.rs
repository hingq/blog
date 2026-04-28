use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct TodayRecordResponse {
    pub data: TodayRecordData,
}

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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DailyQuestion {
    pub date: String,
    pub link: String,
    pub question: Question,
}

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

#[derive(Serialize, Deserialize, Debug)]
pub struct GeminiResponse {
    pub candidates: Vec<GeminiCandidate>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GeminiCandidate {
    pub content: GeminiContent,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GeminiContent {
    pub parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GeminiPart {
    pub text: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SolutionCache {
    pub date: String,
    pub title_slug: String,
    pub model: String,
    pub content: String,
}
