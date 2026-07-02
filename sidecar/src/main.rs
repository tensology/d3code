use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use std::io::{self, BufRead, Write};

#[derive(Debug, Deserialize, Serialize)]
struct Request {
    op: Option<String>,
    text: Option<String>,
    width: Option<usize>,
    height: Option<usize>,
}

fn print_json(value: Value) -> io::Result<()> {
    let mut stdout = io::stdout().lock();
    serde_json::to_writer(&mut stdout, &value)?;
    writeln!(stdout)?;
    stdout.flush()
}

fn compact_text(text: &str) -> String {
    let compacted = text.split_whitespace().collect::<Vec<_>>().join(" ");
    const LIMIT: usize = 24_000;
    if compacted.len() <= LIMIT {
        compacted
    } else {
        format!("{}...", &compacted[..LIMIT])
    }
}

fn health() -> io::Result<()> {
    print_json(json!({
        "ready": true,
        "engine": "d3code-sidecar",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

fn serve() -> io::Result<()> {
    let context = env::var("D3CODE_SIDECAR_CONTEXT")
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .unwrap_or_else(|| json!({}));
    let profile_name = context
        .get("profile")
        .and_then(|profile| profile.get("name"))
        .and_then(Value::as_str);
    print_json(json!({
        "type": "ready",
        "ready": true,
        "engine": "d3code-sidecar",
        "version": env!("CARGO_PKG_VERSION"),
        "profile": profile_name
    }))?;

    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim() == "__quit__" {
            break;
        }
        let request = serde_json::from_str::<Request>(&line).unwrap_or(Request {
            op: Some("unknown".to_string()),
            text: None,
            width: None,
            height: None,
        });
        match request.op.as_deref() {
            Some("health") => health()?,
            Some("compact") => print_json(json!({
                "type": "result",
                "op": "compact",
                "text": compact_text(request.text.as_deref().unwrap_or(""))
            }))?,
            Some("screen-parse") => {
                let text = request.text.unwrap_or_default();
                let lines = text.lines().count();
                print_json(json!({
                    "type": "result",
                    "op": "screen-parse",
                    "width": request.width.unwrap_or(80),
                    "height": request.height.unwrap_or(24),
                    "lineCount": lines,
                    "charCount": text.chars().count()
                }))?
            }
            _ => print_json(json!({
                "type": "error",
                "message": "unknown sidecar request"
            }))?,
        }
    }
    Ok(())
}

fn run_compact() -> io::Result<()> {
    let mut text = String::new();
    for line in io::stdin().lock().lines() {
        text.push_str(&line?);
        text.push('\n');
    }
    print_json(json!({
        "type": "result",
        "op": "compact",
        "text": compact_text(&text)
    }))
}

fn classify_scope(text: &str) -> Value {
    let value = text.to_lowercase();
    let has_ops = ["d3code", "harness-doctor", "profile-doctor", "sidecar", "rag", "skill-coverage"]
        .iter()
        .any(|term| value.contains(term));
    let has_reference = ["manual", "reference", "user guide", "rocket d3", "mvbasic", "system builder", "sb+", "create-file"]
        .iter()
        .any(|term| value.contains(term));
    let has_code = ["basic", "flashbasic", "mv basic", "subroutine", "catalog", "compile", "bp", "program", "migration", "bundle", "screen"]
        .iter()
        .any(|term| value.contains(term));
    let has_runtime = ["d3", "rocket", "tcl", "account", "logto", "list md", "dict", "dictionary", "aql", "select", "locks", "indexes", "vme"]
        .iter()
        .any(|term| value.contains(term));

    let (scope, allowed) = if has_ops {
        ("d3code-ops", true)
    } else if has_reference {
        ("d3-reference", true)
    } else if has_code {
        ("d3-code", true)
    } else if has_runtime {
        ("d3-runtime", true)
    } else {
        ("out-of-scope", false)
    };

    json!({
        "scope": scope,
        "allowed": allowed,
        "engine": "d3code-sidecar",
        "version": env!("CARGO_PKG_VERSION")
    })
}

fn run_scope_check(args: Vec<String>) -> io::Result<()> {
    print_json(classify_scope(&args.join(" ")))
}

fn main() -> io::Result<()> {
    let command = env::args().nth(1).unwrap_or_else(|| "health".to_string());
    match command.as_str() {
        "health" => health(),
        "serve" => serve(),
        "compact" => run_compact(),
        "scope-check" => run_scope_check(env::args().skip(2).collect()),
        _ => {
            print_json(json!({
                "ready": false,
                "engine": "d3code-sidecar",
                "version": env!("CARGO_PKG_VERSION"),
                "error": format!("unknown command: {command}")
            }))?;
            std::process::exit(2);
        }
    }
}
