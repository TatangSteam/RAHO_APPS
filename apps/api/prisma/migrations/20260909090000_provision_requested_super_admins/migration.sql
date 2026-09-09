-- Provision the requested production Super Admin accounts.
-- Passwords are stored only as bcrypt hashes (cost factor 12).
INSERT INTO "users" (
    "id",
    "email",
    "password",
    "role",
    "branchId",
    "roleTemplateId",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES
    (
        'seed_super_admin_afianadaaa18',
        'afianadaaa18@gmail.com',
        '$2a$12$G4nWdB6eH12k0.07gkxQcO/1CQQ3SHkgjixlAhNdnSGlje4wjgUgS',
        'SUPER_ADMIN',
        NULL,
        NULL,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'seed_super_admin_tamfan40',
        'tamfan40@gmail.com',
        '$2a$12$eXq43ApddzCtu6YY07yAw.Ne9kKHqH6veeww644HgxyDgR6NNhkZ.',
        'SUPER_ADMIN',
        NULL,
        NULL,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("email") DO UPDATE
SET
    "password" = EXCLUDED."password",
    "role" = 'SUPER_ADMIN',
    "branchId" = NULL,
    "roleTemplateId" = NULL,
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "user_profiles" (
    "id",
    "userId",
    "fullName",
    "createdAt",
    "updatedAt"
)
SELECT
    'profile_' || "id",
    "id",
    CASE "email"
        WHEN 'afianadaaa18@gmail.com' THEN 'Afianadaaa18'
        WHEN 'tamfan40@gmail.com' THEN 'Tamfan40'
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users"
WHERE "email" IN ('afianadaaa18@gmail.com', 'tamfan40@gmail.com')
ON CONFLICT ("userId") DO UPDATE
SET
    "fullName" = EXCLUDED."fullName",
    "updatedAt" = CURRENT_TIMESTAMP;

