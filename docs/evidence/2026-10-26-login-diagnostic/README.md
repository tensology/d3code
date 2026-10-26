# Login diagnostic accuracy

Acceptance: verifying the current account runs WHO only, does not imply a switch, and preserves approval, account allowlist and Plan restrictions for actual switches.

Changed shared tool, CLI help and terminal/browser activity labels. Removed the assumed VERSION verb from this proof; release discovery remains a separate task.

Local TypeScript compilation and 22 focused login/activity/tool-runner/permission checks passed. Eight diagnostic-card captures individually inspected at 390, 768, 1280 and 1440 in both themes: readable label and output, no clipping or horizontal page overflow.

Interaction rationale: factual activity labels follow Nielsen visibility of system status; verification must describe the operation performed.

Production f8607db compiled, all 22 checks passed and customer service restarted healthy. Real DeepSeek/OpenRouter d3_login with no account returned WHO 7 dm dm without VERSION or a switch. Corrected tool-card text asserted in the browser; completed responses captured at 390 and 1440. Six production captures individually inspected, readable and contained. Startup Retry remained functional, anonymous requests returned 401 and the unflagged other customer returned 403. Browsers and temporary Django sessions removed. No D3 data writes. This component does not establish complete IDE readiness.
