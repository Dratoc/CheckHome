-- 0003_vehicles_properties.sql
-- Fase 4 del MVP: vehículos (con sus papeles) y propiedades (dividendo y arriendo).
-- Los papeles del auto y el dividendo siguen siendo obligaciones; aquí solo se agrupan por vehículo o propiedad.
-- El arriendo recibido es una fuente de ingreso ligada a la propiedad.
-- Idempotente y no destructiva: solo crea tablas y agrega columnas que aceptan NULL.

-- Vehículos del hogar.
IF OBJECT_ID(N'dbo.vehicles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.vehicles (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_vehicles PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_vehicles_household REFERENCES dbo.households (id),
        name         NVARCHAR(100)     NOT NULL,  -- "Auto de Hernán", "Camioneta"
        plate        NVARCHAR(10)      NULL,      -- patente
        model        NVARCHAR(100)     NULL,      -- marca y modelo
        year         SMALLINT          NULL,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_vehicles_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_vehicles_year CHECK (year IS NULL OR year BETWEEN 1950 AND 2100)
    );
    CREATE INDEX ix_vehicles_household_id ON dbo.vehicles (household_id);
END;
GO

-- Propiedades: casa propia o casas arrendadas a otros.
IF OBJECT_ID(N'dbo.properties', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.properties (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_properties PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_properties_household REFERENCES dbo.households (id),
        name         NVARCHAR(100)     NOT NULL,  -- "Depto Ñuñoa"
        address      NVARCHAR(200)     NULL,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_properties_created_at DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX ix_properties_household_id ON dbo.properties (household_id);
END;
GO

-- Papeles del auto y dividendos quedan ligados a su vehículo o propiedad.
IF COL_LENGTH(N'dbo.obligations', N'vehicle_id') IS NULL
    ALTER TABLE dbo.obligations ADD vehicle_id INT NULL CONSTRAINT fk_obligations_vehicle REFERENCES dbo.vehicles (id);
GO

IF COL_LENGTH(N'dbo.obligations', N'property_id') IS NULL
    ALTER TABLE dbo.obligations ADD property_id INT NULL CONSTRAINT fk_obligations_property REFERENCES dbo.properties (id);
GO

-- El arriendo recibido es una fuente de ingreso ligada a la propiedad.
IF COL_LENGTH(N'dbo.income_sources', N'property_id') IS NULL
    ALTER TABLE dbo.income_sources ADD property_id INT NULL CONSTRAINT fk_income_sources_property REFERENCES dbo.properties (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_obligations_vehicle_id')
    CREATE INDEX ix_obligations_vehicle_id ON dbo.obligations (vehicle_id) WHERE vehicle_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_obligations_property_id')
    CREATE INDEX ix_obligations_property_id ON dbo.obligations (property_id) WHERE property_id IS NOT NULL;
GO
