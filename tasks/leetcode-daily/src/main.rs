mod blog;
mod cache;
mod config;
mod email;
mod gemini;
mod leetcode;
mod models;

use anyhow::{Context, Result};
use cache::{question_cache_path, read_json, solution_cache_path, write_json};
use chrono::Local;
use config::{cache_root, load_dotenv, project_root};
use models::{DailyQuestion, SolutionCache};
use std::env;

fn read_required_env_trimmed(keys: &[&str]) -> Result<String> {
    for key in keys {
        if let Ok(value) = env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }
    }

    anyhow::bail!("环境变量未设置或为空: {}", keys.join(" / "))
}

fn read_gemini_models() -> Vec<String> {
    let configured =
        env::var("GEMINI_MODEL").unwrap_or_else(|_| "gemini-3.1-pro-preview,gemini-3-flash".to_string());

    let mut models = Vec::new();
    for model in configured.split(',') {
        let trimmed = model.trim();
        if !trimmed.is_empty() && !models.iter().any(|existing| existing == trimmed) {
            models.push(trimmed.to_string());
        }
    }

    models
}

#[tokio::main]
async fn main() -> Result<()> {
    let project_root = project_root()?;
    load_dotenv(&project_root.join(".env"))?;

    let gemini_models = read_gemini_models();
    let send_email = env::var("SEND_EMAIL")
        .map(|value| value != "false" && value != "0")
        .unwrap_or(true);
    let today = Local::now().format("%Y-%m-%d").to_string();
    let cache_root = cache_root(&project_root);

    println!("1. 正在获取 LeetCode 每日一题数据...");
    let question_path = question_cache_path(&cache_root, &today);
    let daily: DailyQuestion = match read_json(&question_path)? {
        Some(daily) => {
            println!("   命中题目缓存: {}", question_path.display());
            daily
        }
        None => {
            let daily = leetcode::fetch_daily_question().await?;
            write_json(&question_path, &daily)?;
            println!("   请求成功并写入题目缓存: {}", question_path.display());
            daily
        }
    };
    println!("   当前题目: {}", daily.question.title);

    println!("2. 正在准备 Google Gemini 题解...");
    println!("   候选模型: {}", gemini_models.join(" -> "));
    let solution_path = solution_cache_path(&cache_root, &today);
    let solution = match read_json::<SolutionCache>(&solution_path)? {
        Some(cache) => {
            println!("   命中题解缓存: {}", solution_path.display());
            cache.content
        }
        None => {
            let gemini_key = read_required_env_trimmed(&["GEMINI_API_KEY", "GOOGLE_API_KEY"])
                .context("Gemini API Key 未设置，请检查 CI secrets 或本地 .env")?;
            let (content, used_model) =
                gemini::generate_solution(&daily, &gemini_key, &gemini_models).await?;
            let cache = SolutionCache {
                date: daily.date.clone(),
                title_slug: daily.question.title_slug.clone(),
                model: used_model,
                content,
            };
            write_json(&solution_path, &cache)?;
            println!("   题解生成成功并写入缓存: {}", solution_path.display());
            cache.content
        }
    };

    println!("3. 正在写入本地博客文件...");
    let output_path = blog::write_blog_post(&project_root, &daily, &solution)?;
    println!("   文件已保存至: {:?}", output_path);

    if send_email {
        println!("4. 正在发送邮件通知...");
        match email::send_email(&daily) {
            Ok(_) => println!("   邮件已成功发送至收件箱。"),
            Err(e) => eprintln!("   邮件发送失败: {}", e),
        }
    } else {
        println!("4. 跳过邮件发送。");
    }

    println!("任务全部完成。");
    Ok(())
}
