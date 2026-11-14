-- 0004_payment_methods_closing.sql
-- Medios de pago y cierre del mes.
-- - Cada gasto (y cada pago de cuenta) dice con qué se pagó: tarjeta de crédito, débito o efectivo.
-- - Pagar la tarjeta no es un gasto: es un pago de deuda y cuenta como aporte de quien la pagó.
-- - Cada gasto es del hogar (se reparte según el % de cada uno) o personal de alguien.
-- - Ahorro en común con una meta mensual; cada depósito cuenta como aporte.
-- - El cierre del mes guarda quién le transfirió a quién.
-- Idempotente y no destructiva: solo crea tablas y agrega columnas que aceptan NULL.

-- Medios de pago del hogar. La tarjeta de crédito lleva día de corte y de vencimiento.
IF OBJECT_ID(N'dbo.payment_methods', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.payment_methods (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_payment_methods PRIMARY KEY,
        household_id  INT               NOT NULL CONSTRAINT fk_payment_methods_household REFERENCES dbo.households (id),
        owner_user_id INT               NOT NULL CONSTRAINT fk_payment_methods_owner REFERENCES dbo.users (id),
        kind          NVARCHAR(10)      NOT NULL,
        name          NVARCHAR(100)     NOT NULL,  -- "Visa Hernán", "Débito Cami", "Efectivo"
        cut_day       TINYINT           NULL,      -- solo crédito: día de corte (facturación)
        due_day       TINYINT           NULL,      -- solo crédito: día de vencimiento del pago
        is_archived   BIT               NOT NULL CONSTRAINT df_payment_methods_is_archived DEFAULT 0,
        created_at    DATETIME2         NOT NULL CONSTRAINT df_payment_methods_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_payment_methods_kind CHECK (kind IN ('credit', 'debit', 'cash')),
        CONSTRAINT ck_payment_methods_days CHECK (
            (kind = 'credit' AND cut_day BETWEEN 1 AND 31 AND due_day BETWEEN 1 AND 31)
            OR (kind <> 'credit' AND cut_day IS NULL AND due_day IS NULL))
    );
    CREATE INDEX ix_payment_methods_household_id ON dbo.payment_methods (household_id);
END;
GO

-- Gastos: con qué se pagaron y, si es personal, de quién es (NULL = del hogar).
IF COL_LENGTH(N'dbo.expenses', N'payment_method_id') IS NULL
    ALTER TABLE dbo.expenses ADD payment_method_id INT NULL CONSTRAINT fk_expenses_payment_method REFERENCES dbo.payment_methods (id);
GO

IF COL_LENGTH(N'dbo.expenses', N'personal_user_id') IS NULL
    ALTER TABLE dbo.expenses ADD personal_user_id INT NULL CONSTRAINT fk_expenses_personal_user REFERENCES dbo.users (id);
GO

-- Cuentas por pagar: con qué se pagan normalmente (luz con la tarjeta, por ejemplo).
IF COL_LENGTH(N'dbo.obligations', N'payment_method_id') IS NULL
    ALTER TABLE dbo.obligations ADD payment_method_id INT NULL CONSTRAINT fk_obligations_payment_method REFERENCES dbo.payment_methods (id);
GO

-- Cada pago de una cuenta guarda con qué se pagó.
IF COL_LENGTH(N'dbo.obligation_payments', N'payment_method_id') IS NULL
    ALTER TABLE dbo.obligation_payments ADD payment_method_id INT NULL CONSTRAINT fk_obligation_payments_payment_method REFERENCES dbo.payment_methods (id);
GO

-- Pagos de la tarjeta de crédito: pago de deuda, no gasto. statement_end es el corte que se está pagando.
IF OBJECT_ID(N'dbo.card_payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.card_payments (
        id                INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_card_payments PRIMARY KEY,
        payment_method_id INT               NOT NULL CONSTRAINT fk_card_payments_payment_method REFERENCES dbo.payment_methods (id),
        user_id           INT               NOT NULL CONSTRAINT fk_card_payments_user REFERENCES dbo.users (id),
        amount            DECIMAL(12,2)     NOT NULL,
        paid_on           DATE              NOT NULL,
        statement_end     DATE              NOT NULL,
        created_at        DATETIME2         NOT NULL CONSTRAINT df_card_payments_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_card_payments_amount CHECK (amount > 0)
    );
    CREATE INDEX ix_card_payments_method_statement ON dbo.card_payments (payment_method_id, statement_end);
END;
GO

-- Depósitos a la cuenta de ahorro en común.
IF OBJECT_ID(N'dbo.savings_deposits', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.savings_deposits (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_savings_deposits PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_savings_deposits_household REFERENCES dbo.households (id),
        user_id      INT               NOT NULL CONSTRAINT fk_savings_deposits_user REFERENCES dbo.users (id),
        amount       DECIMAL(12,2)     NOT NULL,
        deposited_on DATE              NOT NULL,
        note         NVARCHAR(200)     NOT NULL CONSTRAINT df_savings_deposits_note DEFAULT N'',
        created_at   DATETIME2         NOT NULL CONSTRAINT df_savings_deposits_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_savings_deposits_amount CHECK (amount > 0)
    );
    CREATE INDEX ix_savings_deposits_household_on ON dbo.savings_deposits (household_id, deposited_on);
END;
GO

-- Ajustes del mes del hogar: día de corte del ciclo (NULL = mes calendario) y meta de ahorro mensual.
IF COL_LENGTH(N'dbo.households', N'cycle_cut_day') IS NULL
    ALTER TABLE dbo.households ADD cycle_cut_day TINYINT NULL CONSTRAINT ck_households_cycle_cut_day CHECK (cycle_cut_day BETWEEN 1 AND 31);
GO

IF COL_LENGTH(N'dbo.households', N'savings_goal') IS NULL
    ALTER TABLE dbo.households ADD savings_goal DECIMAL(12,2) NULL CONSTRAINT ck_households_savings_goal CHECK (savings_goal >= 0);
GO

-- Porcentaje fijo de cada miembro. Si nadie lo fija, se calcula con los sueldos registrados.
IF COL_LENGTH(N'dbo.household_members', N'share_pct') IS NULL
    ALTER TABLE dbo.household_members ADD share_pct DECIMAL(5,2) NULL CONSTRAINT ck_household_members_share_pct CHECK (share_pct BETWEEN 0 AND 100);
GO

-- Cierres del mes: uno por hogar y ciclo, con la foto de lo que se transfirió.
IF OBJECT_ID(N'dbo.month_closings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.month_closings (
        household_id INT           NOT NULL CONSTRAINT fk_month_closings_household REFERENCES dbo.households (id),
        cycle_end    DATE          NOT NULL,
        closed_by    INT           NOT NULL CONSTRAINT fk_month_closings_closed_by REFERENCES dbo.users (id),
        closed_at    DATETIME2     NOT NULL CONSTRAINT df_month_closings_closed_at DEFAULT SYSUTCDATETIME(),
        snapshot     NVARCHAR(MAX) NOT NULL,  -- JSON con totales, aportes y transferencias al momento de cerrar
        CONSTRAINT pk_month_closings PRIMARY KEY (household_id, cycle_end)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_expenses_payment_method_id')
    CREATE INDEX ix_expenses_payment_method_id ON dbo.expenses (payment_method_id) WHERE payment_method_id IS NOT NULL;
GO
