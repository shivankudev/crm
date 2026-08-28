-- Sequential, collision-free source for human-readable lead codes
-- (GATTI-000123). Prisma has no native "auto-increment formatted string"
-- field type, so this is raw SQL — the app reads it with nextval() in
-- lead.repository.ts.
CREATE SEQUENCE IF NOT EXISTS "lead_code_seq" START WITH 1;
