-- 0009_categories_pets.sql
-- Tareas por categoría, mascotas y "fechas clave" de mascotas y vehículos.
--   1. Categorías fijas (lista corta definida en la API) para rutinas y tareas del backlog. Opcionales.
--   2. Mascotas del hogar. Una rutina puede ser de una mascota ("Darle comida a Luna") o de un vehículo.
--   3. Fechas clave (vacuna, antiparasitario, mantención, cambio de aceite): última vez y próxima, con repetición.
--      No son cuentas: no tienen monto. Los papeles con costo del auto siguen siendo obligaciones.
--   4. Los documentos adjuntos (carnet de vacunas, ficha del veterinario) también pueden ser de una mascota.
-- Idempotente y no destructiva: crea tablas, agrega columnas que aceptan NULL y amplía dos restricciones CHECK.

-- Mascotas del hogar.
IF OBJECT_ID(N'dbo.pets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.pets (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_pets PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_pets_household REFERENCES dbo.households (id),
        name         NVARCHAR(50)      NOT NULL,
        species      VARCHAR(10)       NOT NULL CONSTRAINT df_pets_species DEFAULT 'dog',
        birth_date   DATE              NULL,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_pets_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_pets_species CHECK (species IN ('dog', 'cat', 'bird', 'fish', 'rabbit', 'other'))
    );
    CREATE INDEX ix_pets_household_id ON dbo.pets (household_id);
END;
GO

-- Rutinas: categoría y, opcionalmente, de qué mascota o vehículo son (uno solo).
IF COL_LENGTH(N'dbo.routines', N'category') IS NULL
    ALTER TABLE dbo.routines ADD category VARCHAR(20) NULL;
GO

IF COL_LENGTH(N'dbo.routines', N'pet_id') IS NULL
    ALTER TABLE dbo.routines ADD pet_id INT NULL CONSTRAINT fk_routines_pet REFERENCES dbo.pets (id);
GO

IF COL_LENGTH(N'dbo.routines', N'vehicle_id') IS NULL
    ALTER TABLE dbo.routines ADD vehicle_id INT NULL CONSTRAINT fk_routines_vehicle REFERENCES dbo.vehicles (id);
GO

IF OBJECT_ID(N'dbo.ck_routines_category', N'C') IS NULL
    ALTER TABLE dbo.routines ADD CONSTRAINT ck_routines_category
        CHECK (category IS NULL OR category IN ('kitchen', 'cleaning', 'bathroom', 'laundry', 'pets', 'garden', 'vehicles', 'repairs'));
GO

IF OBJECT_ID(N'dbo.ck_routines_subject', N'C') IS NULL
    ALTER TABLE dbo.routines ADD CONSTRAINT ck_routines_subject CHECK (pet_id IS NULL OR vehicle_id IS NULL);
GO

-- Backlog: solo categoría.
IF COL_LENGTH(N'dbo.backlog_tasks', N'category') IS NULL
    ALTER TABLE dbo.backlog_tasks ADD category VARCHAR(20) NULL;
GO

IF OBJECT_ID(N'dbo.ck_backlog_tasks_category', N'C') IS NULL
    ALTER TABLE dbo.backlog_tasks ADD CONSTRAINT ck_backlog_tasks_category
        CHECK (category IS NULL OR category IN ('kitchen', 'cleaning', 'bathroom', 'laundry', 'pets', 'garden', 'vehicles', 'repairs'));
GO

-- Fechas clave de una mascota o un vehículo. next_on NULL = no hay nada pendiente (solo se recuerda la última).
IF OBJECT_ID(N'dbo.key_dates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.key_dates (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_key_dates PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_key_dates_household REFERENCES dbo.households (id),
        pet_id       INT               NULL     CONSTRAINT fk_key_dates_pet REFERENCES dbo.pets (id),
        vehicle_id   INT               NULL     CONSTRAINT fk_key_dates_vehicle REFERENCES dbo.vehicles (id),
        title        NVARCHAR(100)     NOT NULL,
        last_on      DATE              NULL,
        next_on      DATE              NULL,
        every_months TINYINT           NULL,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_key_dates_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_key_dates_owner CHECK ((pet_id IS NULL AND vehicle_id IS NOT NULL) OR (pet_id IS NOT NULL AND vehicle_id IS NULL)),
        CONSTRAINT ck_key_dates_every_months CHECK (every_months IS NULL OR every_months BETWEEN 1 AND 60),
        CONSTRAINT ck_key_dates_some_date CHECK (last_on IS NOT NULL OR next_on IS NOT NULL)
    );
    CREATE INDEX ix_key_dates_household_id ON dbo.key_dates (household_id);
END;
GO

-- Documentos de mascotas: nueva columna y restricciones ampliadas (dueño: exactamente uno de los tres).
IF COL_LENGTH(N'dbo.attachments', N'pet_id') IS NULL
    ALTER TABLE dbo.attachments ADD pet_id INT NULL CONSTRAINT fk_attachments_pet REFERENCES dbo.pets (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'ck_attachments_owner' AND definition LIKE N'%pet_id%')
BEGIN
    ALTER TABLE dbo.attachments DROP CONSTRAINT ck_attachments_owner;
    ALTER TABLE dbo.attachments ADD CONSTRAINT ck_attachments_owner CHECK (
        (CASE WHEN vehicle_id IS NULL THEN 0 ELSE 1 END)
      + (CASE WHEN property_id IS NULL THEN 0 ELSE 1 END)
      + (CASE WHEN pet_id IS NULL THEN 0 ELSE 1 END) = 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'ck_attachments_kind' AND definition LIKE N'%vaccination_card%')
BEGIN
    ALTER TABLE dbo.attachments DROP CONSTRAINT ck_attachments_kind;
    ALTER TABLE dbo.attachments ADD CONSTRAINT ck_attachments_kind CHECK (kind IN (
        'circulation_permit', 'technical_review', 'soap', 'insurance', 'registration', 'license', 'deed', 'lease', 'property_tax',
        'vaccination_card', 'vet_record', 'pet_registry', 'other'));
END;
GO

-- Categoría inicial de lo que ya existe, adivinada por el nombre (la misma idea que usa la app al escribir).
-- Solo toca filas sin categoría; correrlo de nuevo no cambia lo que la familia ya eligió.
UPDATE dbo.routines SET category = CASE
        WHEN n LIKE N'% perr%' OR n LIKE N'% gat%' OR n LIKE N'% mascota%' OR n LIKE N'% pase%' OR n LIKE N'% arena%' OR n LIKE N'% veterinari%' OR n LIKE N'% vacuna%' OR n LIKE N'% antiparasit%' OR n LIKE N'% pecera%' OR n LIKE N'% acuario%' THEN 'pets'
        WHEN n LIKE N'% auto%' OR n LIKE N'% camioneta%' OR n LIKE N'% moto%' OR n LIKE N'% bencina%' OR n LIKE N'% neumatico%' OR n LIKE N'% aceite%' THEN 'vehicles'
        WHEN n LIKE N'% bano%' OR n LIKE N'% ducha%' OR n LIKE N'% inodoro%' OR n LIKE N'% wc%' OR n LIKE N'% lavamanos%' THEN 'bathroom'
        WHEN n LIKE N'% ropa%' OR n LIKE N'% tender%' OR n LIKE N'% planchar%' OR n LIKE N'% doblar%' OR n LIKE N'% sabana%' OR n LIKE N'% toalla%' OR n LIKE N'% lavadora%' THEN 'laundry'
        WHEN n LIKE N'% loza%' OR n LIKE N'% plato%' OR n LIKE N'% cocin%' OR n LIKE N'% almuerzo%' OR n LIKE N'% cena%' OR n LIKE N'% desayuno%' OR n LIKE N'% comida%' OR n LIKE N'% horno%' OR n LIKE N'% refri%' OR n LIKE N'% lavavajilla%' OR n LIKE N'% microondas%' THEN 'kitchen'
        WHEN n LIKE N'% regar%' OR n LIKE N'% planta%' OR n LIKE N'% jardin%' OR n LIKE N'% pasto%' OR n LIKE N'% podar%' OR n LIKE N'% cesped%' OR n LIKE N'% macetero%' THEN 'garden'
        WHEN n LIKE N'% aspirar%' OR n LIKE N'% barrer%' OR n LIKE N'% trapear%' OR n LIKE N'% limpi%' OR n LIKE N'% polvo%' OR n LIKE N'% basura%' OR n LIKE N'% ordenar%' OR n LIKE N'% ventana%' OR n LIKE N'% piso%' OR n LIKE N'% cama%' THEN 'cleaning'
        WHEN n LIKE N'% arregl%' OR n LIKE N'% repar%' OR n LIKE N'% ampolleta%' OR n LIKE N'% pintar%' OR n LIKE N'% tramite%' OR n LIKE N'% gasfiter%' OR n LIKE N'% enchufe%' THEN 'repairs'
    END
  FROM dbo.routines CROSS APPLY (SELECT (N' ' + name) COLLATE Latin1_General_CI_AI AS n) x
 WHERE category IS NULL;
GO

UPDATE dbo.backlog_tasks SET category = CASE
        WHEN n LIKE N'% perr%' OR n LIKE N'% gat%' OR n LIKE N'% mascota%' OR n LIKE N'% pase%' OR n LIKE N'% arena%' OR n LIKE N'% veterinari%' OR n LIKE N'% vacuna%' OR n LIKE N'% antiparasit%' OR n LIKE N'% pecera%' OR n LIKE N'% acuario%' THEN 'pets'
        WHEN n LIKE N'% auto%' OR n LIKE N'% camioneta%' OR n LIKE N'% moto%' OR n LIKE N'% bencina%' OR n LIKE N'% neumatico%' OR n LIKE N'% aceite%' THEN 'vehicles'
        WHEN n LIKE N'% bano%' OR n LIKE N'% ducha%' OR n LIKE N'% inodoro%' OR n LIKE N'% wc%' OR n LIKE N'% lavamanos%' THEN 'bathroom'
        WHEN n LIKE N'% ropa%' OR n LIKE N'% tender%' OR n LIKE N'% planchar%' OR n LIKE N'% doblar%' OR n LIKE N'% sabana%' OR n LIKE N'% toalla%' OR n LIKE N'% lavadora%' THEN 'laundry'
        WHEN n LIKE N'% loza%' OR n LIKE N'% plato%' OR n LIKE N'% cocin%' OR n LIKE N'% almuerzo%' OR n LIKE N'% cena%' OR n LIKE N'% desayuno%' OR n LIKE N'% comida%' OR n LIKE N'% horno%' OR n LIKE N'% refri%' OR n LIKE N'% lavavajilla%' OR n LIKE N'% microondas%' THEN 'kitchen'
        WHEN n LIKE N'% regar%' OR n LIKE N'% planta%' OR n LIKE N'% jardin%' OR n LIKE N'% pasto%' OR n LIKE N'% podar%' OR n LIKE N'% cesped%' OR n LIKE N'% macetero%' THEN 'garden'
        WHEN n LIKE N'% aspirar%' OR n LIKE N'% barrer%' OR n LIKE N'% trapear%' OR n LIKE N'% limpi%' OR n LIKE N'% polvo%' OR n LIKE N'% basura%' OR n LIKE N'% ordenar%' OR n LIKE N'% ventana%' OR n LIKE N'% piso%' OR n LIKE N'% cama%' THEN 'cleaning'
        WHEN n LIKE N'% arregl%' OR n LIKE N'% repar%' OR n LIKE N'% ampolleta%' OR n LIKE N'% pintar%' OR n LIKE N'% tramite%' OR n LIKE N'% gasfiter%' OR n LIKE N'% enchufe%' THEN 'repairs'
    END
  FROM dbo.backlog_tasks CROSS APPLY (SELECT (N' ' + title) COLLATE Latin1_General_CI_AI AS n) x
 WHERE category IS NULL;
GO
