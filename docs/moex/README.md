# MOEX ISS Docs Cache

This folder stores a cached copy of the official MOEX ISS reference pages so
developers can browse the API docs offline.

Artifacts:

- `html/index.html` (reference index page)
- `md/index.md` (reference index page)
- `html/<id>.html` (endpoint pages)
- `md/<id>.md` (endpoint pages)
- `MOEX-INDEXES-PAGE.md` (frontend page and component guide)

To refresh the cache:

```bash
task moex:docs
```

Primary source: https://iss.moex.com/iss/reference/
