from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Profile:
    name: str
    type: str = "local"
    host: str | None = None
    port: int | None = None
    username: str | None = None
    account: str | None = None
    entry_command: str | None = None
    startup_input: str | None = None
    prompt_pattern: str | None = None
    session_mode: str | None = None
    safety_default: str | None = None


@dataclass(frozen=True)
class D3CodeConfig:
    version: int
    default_model: str
    default_safety: str
    default_profile: str | None
    profiles: list[Profile]


def config_home() -> Path:
    return Path(os.environ.get("D3CODE_HOME", Path.home() / ".d3code"))


def config_path() -> Path:
    return config_home() / "config.jsonc"


def strip_jsonc(text: str) -> str:
    output: list[str] = []
    in_string = False
    escape = False
    index = 0
    while index < len(text):
        char = text[index]
        nxt = text[index + 1] if index + 1 < len(text) else ""
        if in_string:
            output.append(char)
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
            output.append(char)
            index += 1
            continue
        if char == "/" and nxt == "/":
            index += 2
            while index < len(text) and text[index] not in "\r\n":
                index += 1
            continue
        if char == "/" and nxt == "*":
            index += 2
            while index + 1 < len(text) and not (text[index] == "*" and text[index + 1] == "/"):
                index += 1
            index += 2
            continue
        output.append(char)
        index += 1
    without_comments = "".join(output)
    return _strip_trailing_commas(without_comments)


def _strip_trailing_commas(text: str) -> str:
    output: list[str] = []
    in_string = False
    escape = False
    index = 0
    while index < len(text):
        char = text[index]
        if in_string:
            output.append(char)
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
            output.append(char)
            index += 1
            continue
        if char == ",":
            lookahead = index + 1
            while lookahead < len(text) and text[lookahead].isspace():
                lookahead += 1
            if lookahead < len(text) and text[lookahead] in "}]":
                index += 1
                continue
        output.append(char)
        index += 1
    return "".join(output)


def load_raw_config(path: Path | None = None) -> dict[str, Any]:
    target = path or config_path()
    if not target.exists():
        return {
            "version": 1,
            "defaultModel": "ollama/muse-glimmer:30b-mlx",
            "defaultSafety": "ask",
            "profiles": [],
            "modelSecrets": {},
        }
    return json.loads(strip_jsonc(target.read_text(encoding="utf8")))


def profile_from_raw(raw: dict[str, Any]) -> Profile:
    return Profile(
        name=str(raw.get("name") or ""),
        type=str(raw.get("type") or "local"),
        host=raw.get("host"),
        port=raw.get("port"),
        username=raw.get("username"),
        account=raw.get("account"),
        entry_command=raw.get("entryCommand"),
        startup_input=raw.get("startupInput"),
        prompt_pattern=raw.get("promptPattern"),
        session_mode=raw.get("sessionMode"),
        safety_default=raw.get("safetyDefault"),
    )


def load_config(path: Path | None = None) -> D3CodeConfig:
    raw = load_raw_config(path)
    profiles = [profile_from_raw(item) for item in raw.get("profiles", []) if isinstance(item, dict) and item.get("name")]
    return D3CodeConfig(
        version=int(raw.get("version", 1)),
        default_model=str(raw.get("defaultModel") or "ollama/muse-glimmer:30b-mlx"),
        default_safety=str(raw.get("defaultSafety") or "ask"),
        default_profile=raw.get("defaultProfile"),
        profiles=profiles,
    )


def select_profile(config: D3CodeConfig, name: str | None = None) -> Profile | None:
    selected = name or config.default_profile
    if selected:
        for profile in config.profiles:
            if profile.name == selected:
                return profile
    return config.profiles[0] if config.profiles else None
