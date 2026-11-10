-- Give the private login-attempt ledger a stable primary key.
ALTER TABLE private.staff_login_attempts
  ADD COLUMN IF NOT EXISTS id bigint GENERATED ALWAYS AS IDENTITY;
ALTER TABLE private.staff_login_attempts
  ADD CONSTRAINT staff_login_attempts_pkey PRIMARY KEY (id);
