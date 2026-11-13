-- 0001_core.sql
-- Núcleo de CheckHome: usuarios, hogares ("salas"), membresías, categorías y caché diario de la UF.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- Ver docs/mvp.md y docs/adr/0002-valor-uf-mindicador.md.

-- Usuarios: una cuenta por persona, con correo validado.
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id                INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_users PRIMARY KEY,
        email             NVARCHAR(254)     NOT NULL,
        email_verified_at DATETIME2         NULL,
        username          NVARCHAR(50)      NOT NULL,
        display_name      NVARCHAR(100)     NOT NULL,
        password_hash     NVARCHAR(255)     NOT NULL,
        created_at        DATETIME2         NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSUTCDATETIME(),
        updated_at        DATETIME2         NOT NULL CONSTRAINT df_users_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uq_users_email    UNIQUE (email),
        CONSTRAINT uq_users_username UNIQUE (username)
    );
END;
GO

-- Hogares: raíz de todos los datos. invite_code permite unirse a otro hogar.
IF OBJECT_ID(N'dbo.households', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.households (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_households PRIMARY KEY,
        name        NVARCHAR(100)     NOT NULL,
        invite_code CHAR(8)           NOT NULL,
        currency    CHAR(3)           NOT NULL CONSTRAINT df_households_currency DEFAULT 'CLP',
        created_at  DATETIME2         NOT NULL CONSTRAINT df_households_created_at DEFAULT SYSUTCDATETIME(),
        updated_at  DATETIME2         NOT NULL CONSTRAINT df_households_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT uq_households_invite_code UNIQUE (invite_code)
    );
END;
GO

-- Membresías: un usuario puede pertenecer a varios hogares (N a N).
IF OBJECT_ID(N'dbo.household_members', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.household_members (
        household_id INT          NOT NULL CONSTRAINT fk_household_members_household REFERENCES dbo.households (id),
        user_id      INT          NOT NULL CONSTRAINT fk_household_members_user REFERENCES dbo.users (id),
        role         NVARCHAR(10) NOT NULL CONSTRAINT df_household_members_role DEFAULT 'member',
        color        CHAR(7)      NULL,  -- color del miembro en la UI, formato #RRGGBB
        joined_at    DATETIME2    NOT NULL CONSTRAINT df_household_members_joined_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT pk_household_members PRIMARY KEY (household_id, user_id),
        CONSTRAINT ck_household_members_role CHECK (role IN ('admin', 'member'))
    );
END;
GO

-- Para listar rápido los hogares de un usuario (pantalla "Elegir hogar").
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_household_members_user_id' AND object_id = OBJECT_ID(N'dbo.household_members'))
    CREATE INDEX ix_household_members_user_id ON dbo.household_members (user_id);
GO

-- Categorías de ingresos y gastos, propias de cada hogar.
IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.categories (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_categories PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_categories_household REFERENCES dbo.households (id),
        kind         NVARCHAR(10)      NOT NULL,
        name         NVARCHAR(50)      NOT NULL,
        icon         NVARCHAR(50)      NULL,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_categories_created_at DEFAULT SYSUTCDATETIME(),
        updated_at   DATETIME2         NOT NULL CONSTRAINT df_categories_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_categories_kind CHECK (kind IN ('income', 'expense')),
        CONSTRAINT uq_categories_household_kind_name UNIQUE (household_id, kind, name)
    );
END;
GO

-- Valor diario de la UF en pesos. Se llena una vez al día desde mindicador.cl, o a mano como respaldo.
IF OBJECT_ID(N'dbo.uf_values', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.uf_values (
        value_date DATE          NOT NULL CONSTRAINT pk_uf_values PRIMARY KEY,
        value_clp  DECIMAL(12,2) NOT NULL,
        source     NVARCHAR(20)  NOT NULL CONSTRAINT df_uf_values_source DEFAULT 'mindicador',
        fetched_at DATETIME2     NOT NULL CONSTRAINT df_uf_values_fetched_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_uf_values_source CHECK (source IN ('mindicador', 'manual')),
        CONSTRAINT ck_uf_values_positive CHECK (value_clp > 0)
    );
END;
GO
