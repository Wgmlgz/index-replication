# Degree Thesis Workspace

This folder contains the LaTeX setup for the bachelor thesis document using a local template and Docker-based build tooling.

## Contents

- `src/main.tex` - main thesis source file.
- `src/references.bib` - bibliography database.
- `template/gost-7-32/` - local template files (based on `weterans/gost`).
- `simular-works/` - sample thesis references from other students:
  - `*.md` extracted text (preferred for agent work)
  - `*.pdf` originals (fallback/verification)
- `Taskfile.yml` - build/watch/clean task definitions.
- `Dockerfile` - TeX Live container base.
- `build/` - generated artifacts.
- `src/figures/` - thesis figures.
- `AGENTS.md` - agent operating instructions for this folder.

## Reference Base

Template origin:

- `weterans/gost` (GOST 7.32-focused): https://github.com/weterans/gost

The template is vendored locally to keep builds reproducible.

## Important Workflow Rule

PDF build execution is delegated to the user.

Agents should **not** run any PDF generation commands, including:

- `task build`
- `task watch`
- direct `latexmk` commands
- `docker run ... latexmk ...`

Agents should only edit source files and prepare changes for the user to build locally.

## Typical Agent Tasks

- Improve/expand chapter structure in `src/main.tex`.
- Refine academic wording and formatting in LaTeX.
- Add or normalize bibliography entries in `src/references.bib`.
- Align section flow with patterns observed in `simular-works/*.md` (without copying text).
- Keep compatibility with the existing template and task setup.

## Similar Works Workflow

- Prefer `simular-works/*.md` for fast reading/searching and structure analysis.
- Use `simular-works/*.pdf` only when extracted text is unclear or layout details must be checked.
- Treat similar works as style/structure reference only; do not copy text verbatim.

## Notes

- `build/` files are generated outputs and should not be edited manually.
