# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal expense tracker: Spring Boot 4.1 / Java 21 backend, Angular 22 frontend, PostgreSQL 17,
wired together by Docker Compose. Single-user-per-account model — every row is owned by a `User`.

The UI is in Slovak and `LOCALE_ID` is `sk`; code, identifiers and comments are English. `README.md`
is written in Slovak and holds the product-level detail (default categories, PrimeNG licence, George
CSV format, known gaps).

## Commands

Full stack (needs `.env`, copy from `.env.example` and fill `JWT_SECRET` + `POSTGRES_PASSWORD`):

```bash
docker compose up --build          # frontend :4200, backend :8080, postgres :5432
```

Backend (JDK 21 required; the machine's default JDK may be older — use `JAVA_HOME` or IntelliJ SDK):

```bash
docker compose up -d postgres      # backend expects a live DB, Flyway runs at startup
cd backend
./mvnw spring-boot:run             # :8080
./mvnw test                        # all tests
./mvnw test -Dtest=GeorgeCsvParserTest             # one class
./mvnw test -Dtest=CategoryMatcherTest#methodName  # one method
./mvnw clean package               # jar in target/
```

Frontend:

```bash
cd frontend
npm install
npm start                          # ng serve :4200, /api proxied to :8080 via proxy.conf.json
npm run build                      # production build (see budgets in angular.json)
npm test                           # ng test -> @angular/build:unit-test, vitest runner
npx prettier --write "src/**/*.ts" # printWidth 100, single quotes
```

Useful URLs while the backend runs: `/swagger-ui.html`, `/v3/api-docs`, `/actuator/health`.

## Architecture

### Backend — feature packages

`backend/src/main/java/com/expensetracker/<feature>/` where feature is one of `auth`, `user`,
`account`, `category`, `transaction`, `income`, `imports`, `report`, plus `common` and `config`.
Each feature package holds its entity, repository, service, controller and a `dto/` package. The
import package is named `imports` because `import` is a Java keyword.

Layering per feature: Controller (thin, validation + `ResponseEntity`) → Service (`@Transactional`,
all business rules) → Repository (Spring Data JPA). DTOs live in one final holder class per feature
(`AccountDtos`, `TransactionDtos`, …) as nested records, with a static `from(entity)` factory on the
response record. Entities extend `common/BaseEntity` (UUID id, auditing `createdAt`/`updatedAt`).

**Ownership is enforced in the repository query, not in a filter.** Services resolve the caller via
`CurrentUser.requireId()` / `requireReference()` and call finders that take the user id
(`findByIdAndUserId`, `findByUserId…`); a service that loads by id alone is a bug. `CurrentUser`
reads the principal that `JwtAuthenticationFilter` puts in the security context — a bare `UUID`, not
a `UserDetails`.

Security: stateless, CSRF off, JWT bearer only. Public paths are listed in `SecurityConfig`
(`/api/auth/register`, `/api/auth/login`, springdoc, `/actuator/health/**`); everything else needs
`Authorization: Bearer <token>`. There is no refresh token — a JWT is valid for
`JWT_EXPIRATION_MINUTES` (24 h default) and then the user logs in again.

Errors: throw `NotFoundException` / `ConflictException` / `IllegalArgumentException` from services;
`GlobalExceptionHandler` turns them into RFC 7807 `ProblemDetail` responses. Do not build error
bodies in controllers.

Schema: Flyway migrations in `backend/src/main/resources/db/migration/V<n>__<name>.sql`, and JPA is
`ddl-auto: validate`. Any entity change needs a matching new migration — never edit an applied one.

### Categorisation and import

`CategoryMatcher` is the single place transactions get a category, shared by import preview, import,
and `POST /api/transactions/categorise` (re-runs rules over uncategorised rows), so preview and
saved result can never disagree. It matches accent-folded substrings (`common/TextNormalizer`)
against the description first and the bank's own `bankType` second, restricted to rules whose
category faces the same direction as the transaction; highest priority wins, longer pattern breaks
ties.

`DefaultCategories` (19 categories) and `DefaultCategoryRules` (merchant patterns) are seeded at
registration and can be topped up idempotently via `POST /api/categories/defaults` — matching by
lower-cased name, so renamed categories and repeat calls are safe.

`GeorgeCsvParser` (Slovenská sporiteľňa export) maps columns **by header name**, sniffs the
delimiter, encoding (UTF-8 with BOM, falling back to Windows-1250), date format and decimal
separator. A bad row gets an `error` and is shown in the preview then skipped on import rather than
failing the file. PDF statements are deliberately unsupported — font-level encoding corrupts digits
inside amounts. Extend by implementing `BankStatementParser`.

### Frontend — `frontend/src/app/`

- `core/` — `auth/` (service with signal-held token in `localStorage`, `authGuard`/`guestGuard`,
  `authInterceptor` that attaches the bearer and logs out on a non-auth 401), `api/` (one injectable
  per backend feature, all built on `environment.apiUrl` = `/api`), `models.ts` (TS mirrors of the
  backend DTOs), `date-utils.ts`.
- `layout/shell.component.ts` — authenticated shell with the sidebar; all feature routes are its
  children.
- `features/` — one standalone component per screen: `auth`, `dashboard`, `year`, `incomes`,
  `transactions`, `categories`, `accounts`, `import`.

Conventions: standalone components only, `inject()` over constructor injection, signals +
`computed()` for state (no `BehaviorSubject`), inline templates, every route lazily loaded via
`loadComponent` in `app.routes.ts`. PrimeNG modules are imported per component.

Theming: dark-only. `app/theme.ts` defines an Aura preset ("brass on deep petrol"); `.app-dark` is
set on `<html>` in `index.html` and used as `darkModeSelector`. Colour carries meaning — expense =
ember, income = tide, kept = brass — so reuse the `et-*` utility classes in `styles.scss` rather
than inventing colours.

PrimeNG 22 is commercial. The key comes from `environment.ts` for `ng serve`, and from the
`PRIMENG_LICENSE` build arg for Docker, which `sed`s it into `environment.production.ts` at image
build time (`frontend/Dockerfile`). It is omitted from `providePrimeNG` entirely when empty.

## Notes

- `.env` is gitignored; never commit real secrets into `.env.example` or `docker-compose.yml`.
- Tests today cover `GeorgeCsvParser`, `CategoryMatcher` and `LinearTrend` — pure-logic units, no
  Spring context. The frontend has no spec files yet.
- `category_rules` has no CRUD endpoint yet; rules can only be seeded from `DefaultCategoryRules`.
