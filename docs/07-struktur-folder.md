# 07 — Struktur Folder

```
simpul/
├── apps/web/src/
│   ├── app/ (App, router, guards, theme)
│   ├── routes/ (dashboards, pages per peran)
│   ├── features/{auth,courses,lessons,labs,assessments,competencies,subnetting}/
│   ├── components/design-system/ (AppShell, primitives teknis)
│   ├── hooks/ lib/ styles/
├── apps/api/src/
│   ├── modules/{auth,users,classes,subjects,courses,health}/
│   ├── middleware/ (auth, RBAC)
│   ├── db/ (schema, connection, migrate, seed)
│   └── config.ts app.ts server.ts
├── packages/shared/src/ (contracts, subnetting, tests)
└── docs/ tooling/
```

Aturan: fitur memiliki direktorinya sendiri; presentasi ≠ aplikasi ≠ domain
≠ persistensi; tanpa repository/service/factory seremonial.
