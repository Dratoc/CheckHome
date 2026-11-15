-- 0008_routine_claims.sql
-- Cada persona elige ("toma") las rutinas que hará hoy o esta semana, sin tener que marcarlas como hechas.
-- Así cada uno ve su propia lista y la de toda la casa. Una rutina la toma una sola persona por período
-- (el día para las diarias, el lunes de la semana para las semanales); al día siguiente vuelve a quedar libre.
-- Idempotente y no destructiva: solo crea una tabla nueva.

IF OBJECT_ID(N'dbo.routine_claims', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.routine_claims (
        routine_id   INT       NOT NULL CONSTRAINT fk_routine_claims_routine REFERENCES dbo.routines (id),
        period_start DATE      NOT NULL,
        user_id      INT       NOT NULL CONSTRAINT fk_routine_claims_user REFERENCES dbo.users (id),
        claimed_at   DATETIME2 NOT NULL CONSTRAINT df_routine_claims_claimed_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT pk_routine_claims PRIMARY KEY (routine_id, period_start)
    );
END;
GO
