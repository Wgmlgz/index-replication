# AGENTS.md

## Read First

- `README.md` (this folder) for thesis workflow.

## Main App Context

- For main project setup/context, go to parent folder `..` and read:
  - `../README.md`
  - `../api/README.md`
  - `../web/README.md`

## Rules

- Do not run PDF generation commands; this is delegated to the user.
- Do not run `task build`, `task watch`, `latexmk`, or `docker ... latexmk`.
- For similar works, use extracted `simular-works/*.md` files first.
- Use `simular-works/*.pdf` only as fallback/verification when needed.
- Edit source files only (`src/main.tex`, `src/references.bib`, `src/figures/*`); do not edit `build/` artifacts.
