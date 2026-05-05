mod blog;
mod cache;
mod config;
mod email;
mod leetcode;
mod models;

use anyhow::Result;
use cache::{question_cache_path, read_json, solution_cache_path, write_json};
use chrono::Local;
use config::{cache_root, load_dotenv, project_root};
use models::{DailyQuestion, SolutionCache};
use std::env;

const MISSING_OFFICIAL_SOLUTION_MESSAGE: &str = "官方题解暂不可用。";

#[tokio::main]
async fn main() -> Result<()> {
    // 程序的主流程：
    // 1. 读取配置和缓存路径
    // 2. 获取每日一题
    // 3. 获取官方题解
    // 4. 写入博客文件
    // 5. 按配置发送邮件
    let project_root = project_root()?;
    load_dotenv(&project_root.join(".env"))?;

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
            // 缓存不存在时才访问 LeetCode，避免重复请求外部服务。
            let daily = leetcode::fetch_daily_question().await?;
            write_json(&question_path, &daily)?;
            println!("   请求成功并写入题目缓存: {}", question_path.display());
            daily
        }
    };
    println!("   当前题目: {}", daily.question.title);

    println!("2. 正在获取 LeetCode 中文站官方题解...");
    let solution_path = solution_cache_path(&cache_root, &today);
    let solution = match read_json::<SolutionCache>(&solution_path)? {
        Some(cache) => {
            println!("   命中题解缓存: {}", solution_path.display());
            cache.content
        }
        None => {
            let content =
                match leetcode::fetch_official_solution(&daily.question.title_slug).await? {
                    Some(article) => {
                        println!("   官方题解: {}", article.title);
                        article.content
                    }
                    None => {
                        println!("   未找到可见的官方题解，使用占位内容。");
                        MISSING_OFFICIAL_SOLUTION_MESSAGE.to_string()
                    }
                };
            let cache = SolutionCache {
                date: daily.date.clone(),
                title_slug: daily.question.title_slug.clone(),
                content,
            };
            write_json(&solution_path, &cache)?;
            println!("   题解已写入缓存: {}", solution_path.display());
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
