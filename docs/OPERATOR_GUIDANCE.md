# Operator guidance maintenance

The operator manual, module help and downloadable PDFs use `src/content/operatorGuides.json`. Module titles and grouping come from `src/policies/modules.json`. The catalog covers every registered module; guidance is read-only and its navigation callbacks never call operational write APIs.

## Updating a procedure

1. Inspect the current screen, form validation, action handler, API permissions and backend state transitions. The `sources` field records the implementation files used for review, not a guarantee that future changes remain compatible.
2. Update the module's tasks, prerequisites, ordered steps, success evidence, stop rules and troubleshooting. Use the current UI labels. Distinguish observation, proposed scope, submission and actual execution. Describe uncertainty and state changes explicitly.
3. Update the catalog edition. Do not put customer records, tokens or credentials in examples.
4. Run `python scripts/build_operator_guides.py` with ReportLab and pypdf installed. This regenerates all 32 module PDFs, the complete/Nexus/custody manuals, legacy HTML manual URLs and the content manifest. The old custody generator delegates to this command so it cannot restore outdated text.
5. Run `npm run docs:check`, the operator-companion/custody tests, TypeScript checking and the normal production build. `npm run build` checks documentation freshness before compiling.
6. Render the changed PDFs and inspect pagination, heading placement, character rendering and clipping. Check desktop/mobile, both themes, keyboard navigation, downloads and access-aware workspace links in the browser.

## Entry points

- Existing Guide buttons now open the shared task-based Operator companion. Reporting has the same entry point and starts at its current workspace when permitted.
- Funds Custody retains its embedded Operating guide and lane navigation. It uses the same catalog and presentation as the other modules.
- `/manual` is the searchable library. Guides can be read without granting operation authority; links to modules outside current access are disabled. Operational APIs still enforce their own permissions.
- `/manual/modules/<module_key>.pdf` provides each module's portable reference.
- Existing complete manual, Nexus manual and funds custody PDF URLs remain stable and now serve regenerated content.

The PDF is a dated reference copy. Updating code does not automatically make prose correct: the feature owner must review affected procedures. The manifest detects catalog/download drift and module coverage; it cannot validate business meaning.

## Review boundaries

No database migrations, SMTP settings, role rules, control gates, financial mutations, queue recoveries or monitoring processes are changed by this documentation work. Browser verification uses isolated synthetic data and exercises guide navigation only. Production action outcomes must continue to be verified through the existing application controls and custody evidence.
