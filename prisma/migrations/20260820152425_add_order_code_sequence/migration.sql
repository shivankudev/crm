-- Sequential, collision-free source for human-readable order codes
-- (GATTI-ORD-000123), mirroring lead_code_seq / dealer_code_seq.
CREATE SEQUENCE IF NOT EXISTS "order_code_seq" START WITH 1;
