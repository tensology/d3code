# Changelog

All notable changes to D3 Code will be documented in this file.

## 0.1.0 - 2026-05-30

- Added `/ide` and `d3code ide` to start a local browser-based D3 Code IDE server with profile context, D3 terminal sends, file/dictionary reads, guarded item writes, file listing, and indexed evidence search.
- Removed the old user-facing dashboard/cockpit commands and artifacts from the TUI/CLI path so browser work consolidates around the IDE surface.
- Added a D3-only model tool loop for the interactive terminal session, allowing the model to request registered D3 tools, receive compact evidence, and continue the answer.
- Added Rocket D3 manual/reference search as a read-only D3 tool for manual-grounded answers.
- Reframed the TUI path so normal text goes through the D3-aware session engine instead of plain chat.
- Prepared the project for initial publication at https://github.com/tensology/d3code.
- Documented the repository location in the README.
- Captured the current Rocket D3 agent foundation as the first tracked release.
