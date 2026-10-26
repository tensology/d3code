# Selected-program actions

Acceptance: browse an owned BASIC item, edit and save it with exact readback, compile, review Run, cancel without execution, then approve Run and see output beside the source. Drafts must be saved first. Compile, Catalog and Run must refuse missing or stale connection snapshots in an embedded workspace. Ask requires approval; Plan cannot execute. Duplicate clicks must not run twice, and keyboard cancellation must return focus to the action.

The shared app adds Run beside Compile and Catalog. The typed `d3_run_basic` tool validates names and executes the existing native `RUN file item (AN` path. It captures output from non-interactive compiled programs. Interactive screens, runtime arguments and background-job management are outside this change.

Local evidence:

- TypeScript compilation passed.
- 146 relevant regression tests passed. The final confirmation text and focus correction also passed 51 focused tests and browser checks.
- Fixture browser journey passed at 390, 768, 1280 and 1440 in light and dark themes: real UI browsing, cancelled and approved saves with exact fixture readback, unsaved Run refusal, compilation, cancelled Run and approved output.
- All 24 source/review/output screens were individually inspected. Final modal wording was rendered and reinspected in all eight viewport/theme combinations. Keyboard output and its visible Run focus ring were inspected separately.
- Enter opens review, Cancel receives focus, Escape closes review and restores Run focus, Tab reaches approval, and Enter executes. The browser reproduced a focus-return defect before the fix.
- Native tool tests cover identifier injection, unknown arguments, Ask approval and Plan denial. HTTP tests cover the three actions' missing/stale snapshots and actual Run permission errors. A VM regression covers duplicate execution and focus returning from a hidden dialog.

Interaction rationale:

- Run stays with the selected program: Gestalt proximity and the user's requirement to work without assembling terminal commands.
- Output uses the existing editor pane: preserves source context and reuses the product's component (Nielsen #6).
- The confirmation names the connection, file and item and states the non-interactive limit: prevents wrong-target actions (Nielsen #5).
- Unsaved drafts cannot run, and active actions disable duplicate submissions: error prevention (Nielsen #5).
- Cancellation restores keyboard focus after controls are enabled: user control and WCAG keyboard operation.

Scoped local rubric: 87/100. States 16/20, CRUD safety 13/15, validation 8/10, hierarchy 13/15, tokens 10/10, accessibility 13/15, responsive 9/10, rationale 5/5. This score applies to the changed program actions, not the complete IDE. Deployment and live native verification remain outstanding at this checkpoint.
