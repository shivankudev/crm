-- Sequential, collision-free source for human-readable dealer codes
-- (GATTI-DLR-000123), mirroring lead_code_seq. Read with nextval() in
-- dealer.repository.ts — only issued once a dealer reaches AGREEMENT
-- (see dealer.service.ts), per the dealer lifecycle in 01-architecture.md §5.
CREATE SEQUENCE IF NOT EXISTS "dealer_code_seq" START WITH 1;
