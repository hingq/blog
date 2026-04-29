use crate::models::DailyQuestion;
use anyhow::{Context, Result};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use std::env;

/// 发送每日一题邮件通知。
///
/// 邮箱账号、密码、收件人从环境变量读取；SMTP 服务器默认使用 Gmail。
pub fn send_email(question: &DailyQuestion) -> Result<()> {
    let email_user = env::var("EMAIL_USER").context("环境变量 EMAIL_USER 未设置")?;
    let email_pass = env::var("EMAIL_PASS").context("环境变量 EMAIL_PASS 未设置")?;
    let email_to = env::var("EMAIL_RECEIVER").context("环境变量 EMAIL_RECEIVER 未设置")?;
    let smtp_host = env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.gmail.com".to_string());

    let email = Message::builder()
        .from(email_user.parse()?)
        .to(email_to.parse()?)
        .subject(format!("[LeetCode Daily] {}", question.question.title))
        .header(lettre::message::header::ContentType::TEXT_HTML)
        .body(format!(
            "<h3>{} ({})</h3><p><a href='https://leetcode.cn{}'>查看原题链接</a></p><hr/>{}",
            question.question.title,
            question.question.difficulty,
            question.link,
            question.question.content
        ))?;

    // `Credentials` 会在 SMTP 登录时使用，`SmtpTransport` 负责真正发信。
    let creds = Credentials::new(email_user, email_pass);
    let mailer = SmtpTransport::relay(&smtp_host)?.credentials(creds).build();

    mailer.send(&email)?;
    Ok(())
}
