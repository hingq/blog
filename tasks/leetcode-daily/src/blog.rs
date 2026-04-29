use crate::models::DailyQuestion;
use anyhow::{Context, Result};
use regex::{Captures, Regex};
use std::fs;
use std::path::{Path, PathBuf};

/// 把每日一题和题解写成一篇博客 MDX 文件。
pub fn write_blog_post(
    project_root: &Path,
    daily: &DailyQuestion,
    solution: &str,
) -> Result<PathBuf> {
    let full_content = render_blog_post(daily, solution);
    let file_name = format!("leetcode-{}.mdx", daily.question.title_slug);
    let output_dir = project_root.join("data/blog");

    fs::create_dir_all(&output_dir)
        .with_context(|| format!("创建博客目录失败: {}", output_dir.display()))?;

    let output_path = output_dir.join(file_name);
    fs::write(&output_path, full_content)
        .with_context(|| format!("写入博客文件失败: {}", output_path.display()))?;

    Ok(output_path)
}

/// 组装完整博客内容：frontmatter、原题链接、题目描述和题解分析。
fn render_blog_post(daily: &DailyQuestion, solution: &str) -> String {
    let frontmatter = format!(
        "---\ntitle: 'LeetCode: {}'\ndate: '{}'\ntags: ['LeetCode', '算法']\ndraft: false\nsummary: '自动生成的 LeetCode 每日一题题解'\n---\n\n",
        daily.question.title, daily.date
    );

    format!(
        "{}## 原文链接\n\n[{}](https://leetcode.cn{})\n\n## 题目描述\n\n{}\n\n## 题解分析\n\n{}",
        frontmatter,
        daily.question.title,
        daily.link,
        format_leetcode_content(&daily.question.content),
        normalize_solution_markdown(solution)
    )
}

/// 将 LeetCode 返回的 HTML 片段转换成博客更容易渲染的 Markdown/MDX。
fn format_leetcode_content(content: &str) -> String {
    let content = sanitize_leetcode_html(content);
    let content = convert_images(&content);
    let content = convert_pre_blocks(&content);
    let content = convert_list_blocks(&content);
    let content = convert_paragraphs(&content);
    let content = inline_html_to_markdown(&content);

    collapse_blank_lines(&content)
}

/// 清理 LeetCode HTML 中对博客无用或容易影响样式的内容。
fn sanitize_leetcode_html(content: &str) -> String {
    let content = content
        .replace("&nbsp;", " ")
        .replace("<p> </p>\n\n", "")
        .replace("<p> </p>", "")
        .trim()
        .to_string();

    strip_html_attribute(&strip_html_attribute(&content, "class"), "style")
}

/// 把 HTML 图片标签转换成 MDX 的 `<Image />` 组件。
fn convert_images(content: &str) -> String {
    let re = Regex::new(r#"<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>"#).unwrap();

    re.replace_all(content, |caps: &Captures| {
        let src = &caps[1];
        format!(r#"<Image src="{src}" alt="Image" />"#)
    })
    .into_owned()
}

/// 把 `<pre>...</pre>` 示例块转换成 Markdown 代码块。
fn convert_pre_blocks(content: &str) -> String {
    replace_blocks(content, "<pre>", "</pre>", |inner| {
        let text = inline_html_to_text(inner).trim().to_string();
        format!("\n\n```text\n{text}\n```\n\n")
    })
}

/// 把 `<ul><li>...</li></ul>` 转换成 Markdown 列表。
fn convert_list_blocks(content: &str) -> String {
    replace_blocks(content, "<ul>", "</ul>", |inner| {
        let mut items = Vec::new();
        let mut rest = inner;

        while let Some(start) = rest.find("<li>") {
            let item_start = start + "<li>".len();
            if let Some(end) = rest[item_start..].find("</li>") {
                let item = inline_html_to_markdown(&rest[item_start..item_start + end]);
                items.push(format!("- {}", item.trim()));
                rest = &rest[item_start + end + "</li>".len()..];
            } else {
                break;
            }
        }

        format!("\n\n{}\n\n", items.join("\n"))
    })
}

/// 把 HTML 段落转换成 Markdown 段落。
fn convert_paragraphs(content: &str) -> String {
    replace_blocks(content, "<p>", "</p>", |inner| {
        let markdown = inline_html_to_markdown(inner).trim().to_string();
        if markdown.is_empty() {
            String::new()
        } else {
            format!("\n\n{markdown}\n\n")
        }
    })
}

/// 通用块替换函数。
///
/// `F: FnMut(&str) -> String` 表示调用方传进来一个“如何转换块内部内容”的函数。
fn replace_blocks<F>(content: &str, open: &str, close: &str, mut convert: F) -> String
where
    F: FnMut(&str) -> String,
{
    let mut output = String::with_capacity(content.len());
    let mut rest = content;

    while let Some(start) = rest.find(open) {
        output.push_str(&rest[..start]);
        let inner_start = start + open.len();
        if let Some(end) = rest[inner_start..].find(close) {
            output.push_str(&convert(&rest[inner_start..inner_start + end]));
            rest = &rest[inner_start + end + close.len()..];
        } else {
            output.push_str(&rest[start..]);
            rest = "";
        }
    }

    output.push_str(rest);
    output
}

/// 转换行内 HTML 标签，保留 Markdown 能表达的强调、代码等语义。
fn inline_html_to_markdown(content: &str) -> String {
    decode_html_entities(content)
        .replace("<code>", "`")
        .replace("</code>", "`")
        .replace("<strong>", "**")
        .replace("</strong>", "**")
        .replace("<em>", "_")
        .replace("</em>", "_")
        .replace("<sup>", "^")
        .replace("</sup>", "")
        .trim()
        .to_string()
}

/// 转换为纯文本，主要用于代码块内部，避免 Markdown 符号污染示例输出。
fn inline_html_to_text(content: &str) -> String {
    decode_html_entities(content)
        .replace("<strong>", "")
        .replace("</strong>", "")
        .replace("<code>", "")
        .replace("</code>", "")
        .replace("<em>", "")
        .replace("</em>", "")
        .replace("<sup>", "^")
        .replace("</sup>", "")
        .trim()
        .to_string()
}

/// 解码常见 HTML 实体，例如 `&lt;` 转成 `<`。
fn decode_html_entities(content: &str) -> String {
    content
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

/// 移除指定 HTML 属性。
///
/// 这里不用正则，是为了同时处理单引号和双引号，并保留其它标签内容。
fn strip_html_attribute(content: &str, attr_name: &str) -> String {
    let mut output = String::with_capacity(content.len());
    let mut rest = content;
    let double_quoted = format!(" {attr_name}=\"");
    let single_quoted = format!(" {attr_name}='");

    while let Some((start, marker_len, quote)) =
        find_next_attribute(rest, &double_quoted, &single_quoted)
    {
        output.push_str(&rest[..start]);
        let value_start = start + marker_len;
        if let Some(value_end) = rest[value_start..].find(quote) {
            rest = &rest[value_start + value_end + quote.len_utf8()..];
        } else {
            output.push_str(&rest[start..]);
            rest = "";
        }
    }

    output.push_str(rest);
    output
}

/// 找出下一个指定属性的位置，并返回属性值使用的引号类型。
fn find_next_attribute(
    content: &str,
    double_quoted: &str,
    single_quoted: &str,
) -> Option<(usize, usize, char)> {
    let double_match = content
        .find(double_quoted)
        .map(|index| (index, double_quoted.len(), '"'));
    let single_match = content
        .find(single_quoted)
        .map(|index| (index, single_quoted.len(), '\''));

    match (double_match, single_match) {
        (Some(double_match), Some(single_match)) => Some(if double_match.0 <= single_match.0 {
            double_match
        } else {
            single_match
        }),
        (Some(double_match), None) => Some(double_match),
        (None, Some(single_match)) => Some(single_match),
        (None, None) => None,
    }
}

/// 清理模型生成的 Markdown，使它能自然嵌入博客正文。
fn normalize_solution_markdown(content: &str) -> String {
    let mut lines = content.trim().lines().peekable();
    if matches!(lines.peek(), Some(line) if line.trim_start().starts_with("# ")) {
        lines.next();
        while matches!(lines.peek(), Some(line) if line.trim().is_empty()) {
            lines.next();
        }
    }

    let without_rules = lines
        .map(|line| {
            let trimmed = line.trim();
            if trimmed == "---" {
                String::new()
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    collapse_blank_lines(&without_rules)
}

/// 合并多余空行，避免生成的 MDX 出现大片空白。
fn collapse_blank_lines(content: &str) -> String {
    let mut output = Vec::new();
    let mut blank_count = 0;

    for line in content.lines() {
        if line.trim().is_empty() {
            blank_count += 1;
            if blank_count <= 1 {
                output.push(String::new());
            }
        } else {
            blank_count = 0;
            output.push(line.to_string());
        }
    }

    output.join("\n").trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{DailyQuestion, Question};

    #[test]
    fn sanitizes_leetcode_html_for_mdx() {
        let html = r#"<p>&nbsp;</p>

<p><strong class="example">示例 1：</strong></p>

<p><img alt="" src="https://example.com/a.png" style="width: 164px; height: 165px;" /></p>

<p><img alt='' src='https://example.com/b.png' style='max-width: 100%; height: auto;' /></p>"#;

        let sanitized = sanitize_leetcode_html(html);

        assert!(!sanitized.contains("&nbsp;"));
        assert!(!sanitized.contains("class=\"example\""));
        assert!(!sanitized.contains("style=\""));
        assert!(sanitized.contains("<strong>示例 1：</strong>"));
    }

    #[test]
    fn strips_html_attribute_without_hardcoded_value() {
        let html = r#"<img style="width: 10px;" /><img style='max-width: 100%; height: auto;' />"#;
        let sanitized = strip_html_attribute(html, "style");

        assert_eq!(sanitized, "<img /><img />");
    }

    #[test]
    fn normalizes_solution_markdown_heading() {
        let markdown = "# 题目标题\n\n### 解题思路\n\n内容\n\n---\n\n### 总结";

        let normalized = normalize_solution_markdown(markdown);

        assert!(!normalized.starts_with("# "));
        assert!(normalized.starts_with("### 解题思路"));
        assert!(!normalized.contains("\n---\n"));
        assert!(!normalized.contains("\n\n\n"));
    }

    #[test]
    fn renders_original_link_section() {
        let daily = DailyQuestion {
            date: "2026-04-28".to_string(),
            link: "/problems/two-sum/".to_string(),
            question: Question {
                title: "两数之和".to_string(),
                title_slug: "two-sum".to_string(),
                content: "<p>题目内容</p>".to_string(),
                difficulty: "Easy".to_string(),
            },
        };

        let content = render_blog_post(&daily, "### 解题思路\n\n内容");

        assert!(
            content.contains("## 原文链接\n\n[两数之和](https://leetcode.cn/problems/two-sum/)")
        );
        assert!(content.find("## 原文链接").unwrap() < content.find("## 题目描述").unwrap());
    }

    #[test]
    fn formats_leetcode_html_as_readable_markdown() {
        let html = r#"<p>给你一个整数 <code>x</code>。</p>

<p><img alt="" src="https://example.com/grid.png" style="width: 164px;" /></p>

<pre>
<strong>输入：</strong>grid = [[1,2]]
<strong>输出：</strong>3
<strong>解释：</strong>第一行
第二行
</pre>

<ul>
  <li><code>1 &lt;= x &lt;= 10<sup>4</sup></code></li>
</ul>"#;

        let formatted = format_leetcode_content(html);

        assert!(formatted.contains("给你一个整数 `x`。"));
        assert!(formatted.contains(r#"<Image src="https://example.com/grid.png" alt="Image" />"#));
        assert!(
            formatted.contains("```text\n输入：grid = [[1,2]]\n输出：3\n解释：第一行\n第二行\n```")
        );
        assert!(formatted.contains("- `1 <= x <= 10^4`"));
        assert!(!formatted.contains("<p>"));
        assert!(!formatted.contains("<pre>"));
    }
}
