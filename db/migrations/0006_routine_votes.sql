-- 0006_routine_votes.sql
-- Las rutinas también se valoran entre todos antes de habilitarse, igual que el backlog: cada miembro del hogar
-- vota sus puntos y, cuando votaron todos, la rutina queda activa con el voto más alto.
-- Idempotente y no destructiva: agrega una columna con valor por defecto y una tabla nueva.
-- Las rutinas que ya existen quedan 'active' con los puntos que tenían (no se vuelven a votar).
-- Además, las rutinas diarias pueden repetirse solo algunos días de la semana (columna weekdays).

IF COL_LENGTH(N'dbo.routines', N'status') IS NULL
BEGIN
    ALTER TABLE dbo.routines ADD status NVARCHAR(10) NOT NULL
        CONSTRAINT df_routines_status DEFAULT 'active' WITH VALUES;
END;
GO

IF OBJECT_ID(N'dbo.ck_routines_status', N'C') IS NULL
BEGIN
    ALTER TABLE dbo.routines ADD CONSTRAINT ck_routines_status CHECK (status IN ('estimating', 'active'));
END;
GO

-- Días de la semana en que toca una rutina diaria, como máscara de bits: lunes = 1, martes = 2, miércoles = 4,
-- jueves = 8, viernes = 16, sábado = 32, domingo = 64. 127 = todos los días (lo que tenían las rutinas existentes).
-- Las rutinas semanales ('weekly', una vez en cualquier día de la semana) no lo usan.
IF COL_LENGTH(N'dbo.routines', N'weekdays') IS NULL
BEGIN
    ALTER TABLE dbo.routines ADD weekdays TINYINT NOT NULL
        CONSTRAINT df_routines_weekdays DEFAULT 127 WITH VALUES;
END;
GO

IF OBJECT_ID(N'dbo.ck_routines_weekdays', N'C') IS NULL
BEGIN
    ALTER TABLE dbo.routines ADD CONSTRAINT ck_routines_weekdays CHECK (weekdays BETWEEN 1 AND 127);
END;
GO

-- Votos de cada persona por rutina (mientras está en 'estimating'). Se guardan después como respaldo de la valoración.
IF OBJECT_ID(N'dbo.routine_votes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.routine_votes (
        routine_id INT       NOT NULL CONSTRAINT fk_routine_votes_routine REFERENCES dbo.routines (id),
        user_id    INT       NOT NULL CONSTRAINT fk_routine_votes_user REFERENCES dbo.users (id),
        points     TINYINT   NOT NULL,
        voted_at   DATETIME2 NOT NULL CONSTRAINT df_routine_votes_voted_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT pk_routine_votes PRIMARY KEY (routine_id, user_id),
        CONSTRAINT ck_routine_votes_points CHECK (points IN (1, 2, 3, 5, 8, 13))
    );
END;
GO
