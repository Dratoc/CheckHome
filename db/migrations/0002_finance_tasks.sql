-- 0002_finance_tasks.sql
-- Cuentas (ingresos, gastos, obligaciones y sus pagos) y tareas (rutinas, backlog y votos).
-- Idempotente: se puede ejecutar más de una vez sin error.
-- Vehículos y propiedades (fase 4) quedan para una migración posterior.

-- Fuentes de ingreso: se definen una vez (sueldo, arriendo) con su día de pago.
IF OBJECT_ID(N'dbo.income_sources', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.income_sources (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_income_sources PRIMARY KEY,
        household_id    INT               NOT NULL CONSTRAINT fk_income_sources_household REFERENCES dbo.households (id),
        user_id         INT               NOT NULL CONSTRAINT fk_income_sources_user REFERENCES dbo.users (id),
        name            NVARCHAR(100)     NOT NULL,
        pay_day         TINYINT           NOT NULL,
        expected_amount DECIMAL(12,2)     NOT NULL,
        is_private      BIT               NOT NULL CONSTRAINT df_income_sources_is_private DEFAULT 0,
        created_at      DATETIME2         NOT NULL CONSTRAINT df_income_sources_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_income_sources_pay_day CHECK (pay_day BETWEEN 1 AND 31),
        CONSTRAINT ck_income_sources_expected CHECK (expected_amount >= 0)
    );
    CREATE INDEX ix_income_sources_household_id ON dbo.income_sources (household_id);
END;
GO

-- Ingresos: cada pago recibido, anotado a mano en pesos.
IF OBJECT_ID(N'dbo.incomes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.incomes (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_incomes PRIMARY KEY,
        source_id    INT               NOT NULL CONSTRAINT fk_incomes_source REFERENCES dbo.income_sources (id),
        household_id INT               NOT NULL CONSTRAINT fk_incomes_household REFERENCES dbo.households (id),
        user_id      INT               NOT NULL CONSTRAINT fk_incomes_user REFERENCES dbo.users (id),
        amount       DECIMAL(12,2)     NOT NULL,
        received_on  DATE              NOT NULL,
        is_private   BIT               NOT NULL CONSTRAINT df_incomes_is_private DEFAULT 0,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_incomes_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_incomes_amount CHECK (amount > 0)
    );
    CREATE INDEX ix_incomes_household_received ON dbo.incomes (household_id, received_on);
END;
GO

-- Gastos del día a día: siempre visibles para el hogar.
IF OBJECT_ID(N'dbo.expenses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.expenses (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_expenses PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_expenses_household REFERENCES dbo.households (id),
        user_id      INT               NOT NULL CONSTRAINT fk_expenses_user REFERENCES dbo.users (id),
        category_id  INT               NOT NULL CONSTRAINT fk_expenses_category REFERENCES dbo.categories (id),
        amount       DECIMAL(12,2)     NOT NULL,
        description  NVARCHAR(200)     NOT NULL CONSTRAINT df_expenses_description DEFAULT N'',
        spent_on     DATE              NOT NULL,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_expenses_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_expenses_amount CHECK (amount > 0)
    );
    CREATE INDEX ix_expenses_household_spent ON dbo.expenses (household_id, spent_on);
END;
GO

-- Obligaciones: todo lo que vence y se paga (servicios, suscripciones, dividendo, créditos, papeles del auto).
IF OBJECT_ID(N'dbo.obligations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.obligations (
        id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_obligations PRIMARY KEY,
        household_id       INT               NOT NULL CONSTRAINT fk_obligations_household REFERENCES dbo.households (id),
        kind               NVARCHAR(20)      NOT NULL,
        name               NVARCHAR(100)     NOT NULL,
        currency           CHAR(3)           NOT NULL CONSTRAINT df_obligations_currency DEFAULT 'CLP',
        amount             DECIMAL(14,4)     NOT NULL,  -- pesos, o UF con 4 decimales
        next_due_on        DATE              NOT NULL,
        every_months       TINYINT           NOT NULL CONSTRAINT df_obligations_every_months DEFAULT 1,
        account_number     NVARCHAR(50)      NULL,
        last_paid_on       DATE              NULL,
        installments_total SMALLINT          NULL,
        installments_paid  SMALLINT          NULL,
        created_at         DATETIME2         NOT NULL CONSTRAINT df_obligations_created_at DEFAULT SYSUTCDATETIME(),
        updated_at         DATETIME2         NOT NULL CONSTRAINT df_obligations_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_obligations_kind CHECK (kind IN ('subscription', 'utility', 'mortgage', 'loan', 'vehicle_doc', 'other')),
        CONSTRAINT ck_obligations_currency CHECK (currency IN ('CLP', 'UF')),
        CONSTRAINT ck_obligations_amount CHECK (amount > 0),
        CONSTRAINT ck_obligations_every_months CHECK (every_months BETWEEN 1 AND 24)
    );
    CREATE INDEX ix_obligations_household_due ON dbo.obligations (household_id, next_due_on);
END;
GO

-- Pagos de obligaciones: pesos pagados y, si estaba en UF, el valor UF del día.
IF OBJECT_ID(N'dbo.obligation_payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.obligation_payments (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_obligation_payments PRIMARY KEY,
        obligation_id INT               NOT NULL CONSTRAINT fk_obligation_payments_obligation REFERENCES dbo.obligations (id),
        user_id       INT               NOT NULL CONSTRAINT fk_obligation_payments_user REFERENCES dbo.users (id),
        amount_clp    DECIMAL(12,2)     NOT NULL,
        uf_value      DECIMAL(12,2)     NULL,
        paid_on       DATE              NOT NULL,
        created_at    DATETIME2         NOT NULL CONSTRAINT df_obligation_payments_created_at DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX ix_obligation_payments_obligation ON dbo.obligation_payments (obligation_id, paid_on);
END;
GO

-- Rutinas: checklist diario o semanal que da puntos.
IF OBJECT_ID(N'dbo.routines', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.routines (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_routines PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_routines_household REFERENCES dbo.households (id),
        name         NVARCHAR(100)     NOT NULL,
        frequency    NVARCHAR(10)      NOT NULL,
        points       TINYINT           NOT NULL CONSTRAINT df_routines_points DEFAULT 1,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_routines_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_routines_frequency CHECK (frequency IN ('daily', 'weekly')),
        CONSTRAINT ck_routines_points CHECK (points BETWEEN 1 AND 13)
    );
    CREATE INDEX ix_routines_household_id ON dbo.routines (household_id);
END;
GO

-- Marcas de rutina: una por rutina y período (día, o lunes de la semana).
IF OBJECT_ID(N'dbo.routine_checks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.routine_checks (
        routine_id   INT       NOT NULL CONSTRAINT fk_routine_checks_routine REFERENCES dbo.routines (id),
        period_start DATE      NOT NULL,
        user_id      INT       NOT NULL CONSTRAINT fk_routine_checks_user REFERENCES dbo.users (id),
        checked_at   DATETIME2 NOT NULL CONSTRAINT df_routine_checks_checked_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT pk_routine_checks PRIMARY KEY (routine_id, period_start)
    );
END;
GO

-- Backlog: tareas únicas que se estiman por planning poker y alguien toma.
IF OBJECT_ID(N'dbo.backlog_tasks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.backlog_tasks (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_backlog_tasks PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_backlog_tasks_household REFERENCES dbo.households (id),
        title        NVARCHAR(150)     NOT NULL,
        status       NVARCHAR(10)      NOT NULL CONSTRAINT df_backlog_tasks_status DEFAULT 'estimating',
        points       TINYINT           NULL,
        taken_by     INT               NULL CONSTRAINT fk_backlog_tasks_taken_by REFERENCES dbo.users (id),
        done_on      DATE              NULL,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_backlog_tasks_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_backlog_tasks_status CHECK (status IN ('estimating', 'open', 'taken', 'done'))
    );
    CREATE INDEX ix_backlog_tasks_household_id ON dbo.backlog_tasks (household_id);
END;
GO

-- Votos de planning poker: uno por persona y tarea.
IF OBJECT_ID(N'dbo.task_votes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.task_votes (
        task_id    INT       NOT NULL CONSTRAINT fk_task_votes_task REFERENCES dbo.backlog_tasks (id),
        user_id    INT       NOT NULL CONSTRAINT fk_task_votes_user REFERENCES dbo.users (id),
        points     TINYINT   NOT NULL,
        voted_at   DATETIME2 NOT NULL CONSTRAINT df_task_votes_voted_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT pk_task_votes PRIMARY KEY (task_id, user_id),
        CONSTRAINT ck_task_votes_points CHECK (points IN (1, 2, 3, 5, 8, 13))
    );
END;
GO
