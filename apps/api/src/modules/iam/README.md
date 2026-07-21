# IAM Sprint 1

## Effective access

Access is evaluated on the server in this order:

1. an explicit active role template assigned to the user;
2. otherwise, the active system template matching the user's base `Role`;
3. global user `ALLOW`/`DENY` overrides;
4. branch-specific user overrides for the requested branch.

Branch scope is independent from permission. A request must pass both checks. `BRANCH.ACCESS_ALL` is the only permission that bypasses branch filtering.

## Sensitive endpoints

- `GET /iam/me` — current effective permission and branch context.
- `GET /iam/permissions` — permission catalog.
- `GET|POST|PATCH /iam/role-templates` — role template management.
- `PUT /iam/role-templates/:id/permissions` — replace template permissions.
- `GET /iam/users/:userId/access` — inspect a user access snapshot.
- `PUT /iam/users/:userId/role-template` — assign a custom/default template.
- `PUT /iam/users/:userId/overrides` — replace user overrides.
- `PUT /iam/users/:userId/branches` — replace branch scope.

Every mutation above writes an audit event. An actor cannot mutate their own role template assignment, overrides, branch scope, password reset, activation state, or managed-branch assignment. An actor also cannot grant permissions or branches outside their own effective access.

## Deployment

Run Prisma migration `20260721120000_add_granular_permissions` before deploying API code. It creates and seeds the permission catalog and default templates for all existing base roles. Do not edit a deployed migration; make a follow-up migration for corrections.
