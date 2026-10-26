# SB+ candidate discovery correctness

Acceptance: generic native menu/screen/process names cannot establish an SB+ installation; bounded visible-file inspection preserves exact names and failures; reports state uncertainty and scan limits.

The old filename heuristic could return detected:true for native MENU or SCREEN files and treated connection failures as an empty scan. Discovery now reuses listD3Files, including validated hex IDs, sampling and failure checks. Results retain candidate groups and prefixes, with detected:false and verification:unverified. False means no verified detection, not proof of absence. A real installation verifier is still required before enabling framework-specific builders.

TypeScript compilation passed. Discovery plus IDE suite: 46 tests passed. CLI discovery regression: one test passed. Three dedicated regressions failed before the correction. Shared local API and rendered report exercised in Chrome; eight final captures individually inspected at 390, 768, 1280 and 1440 in both themes. Report body uses the existing internal scroller for long output; page controls remain contained.

Interaction rationale: separate candidate evidence from installation claims, following visibility of system status and error prevention. No screen runtime, process, printer or D3 write was invoked.

Production 0b0f802 compiled, passed all 46 server checks and restarted healthy. Through the branded director workspace, actual DeepSeek/OpenRouter called d3_sbplus_discover only and reported installation unverified. The live candidate backgrounds.output was explicitly treated as ambiguous, not proof. Browser asserted the corrected tool title and absence of Detected: yes. Anonymous 401 and unflagged customer 403 remained intact, as did Retry draft preservation. Completed response inspected at 1440 and 390; no horizontal page overflow. Browsers and temporary Django sessions removed. Record structure UI remains awaiting the user's layout answer; it is independent of this correction.
