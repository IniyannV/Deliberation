-- Development-only data for `npm run cloudflare:d1:seed:local`.
-- Do not use these credentials in a deployed database.
INSERT OR REPLACE INTO cases (id, case_number, title, status, data_json)
VALUES (
  'local-case-001',
  '26-CR-0418',
  'The State v. Brennan',
  'active',
  '{"id":"local-case-001","caseNumber":"26-CR-0418","caption":"The State v. Brennan","status":"active","counts":[],"jury":{"seats":[]}}'
);

INSERT OR REPLACE INTO users
  (id, username, login, role, kind, seat, name, case_number, password_hash, active)
VALUES
  ('local-admin', 'admin', 'admin', 'admin', 'admin', NULL, 'Court Administrator', NULL, 'admin-password', 1),
  ('local-clerk', 'clerk', 'clerk', 'clerk', 'clerk', NULL, 'Court Clerk', NULL, 'clerk-password', 1),
  ('local-juror-1', 'juror1', 'juror1', 'juror', 'juror', 1, 'Juror 1', '26-CR-0418', '1234', 1);
