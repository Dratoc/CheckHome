-- 0005_attachments.sql
-- Documentos digitales (foto o PDF) de vehículos y propiedades: permiso de circulación, revisión técnica, SOAP,
-- escritura, contrato de arriendo, etc. Ver docs/adr/0004-documentos-en-azure-sql.md.
-- Los archivos van en la misma base gratis (no en Blob Storage) para no crear recursos que cobren.
-- Idempotente y no destructiva: solo crea tablas nuevas.

-- Datos del documento. Pertenece a un vehículo o a una propiedad (exactamente uno) y, si es la copia de un
-- papel con vencimiento (revisión técnica, SOAP), también a esa cuenta.
IF OBJECT_ID(N'dbo.attachments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.attachments (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_attachments PRIMARY KEY,
        household_id  INT               NOT NULL CONSTRAINT fk_attachments_household REFERENCES dbo.households (id),
        vehicle_id    INT               NULL     CONSTRAINT fk_attachments_vehicle REFERENCES dbo.vehicles (id),
        property_id   INT               NULL     CONSTRAINT fk_attachments_property REFERENCES dbo.properties (id),
        obligation_id INT               NULL     CONSTRAINT fk_attachments_obligation REFERENCES dbo.obligations (id),
        kind          VARCHAR(20)       NOT NULL,  -- technical_review, soap, circulation_permit, deed, lease, ...
        title         NVARCHAR(100)     NOT NULL,
        expires_on    DATE              NULL,
        file_name     NVARCHAR(200)     NOT NULL,
        content_type  VARCHAR(50)       NOT NULL,
        size_bytes    INT               NOT NULL,
        uploaded_by   INT               NOT NULL CONSTRAINT fk_attachments_user REFERENCES dbo.users (id),
        created_at    DATETIME2         NOT NULL CONSTRAINT df_attachments_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT ck_attachments_owner CHECK ((vehicle_id IS NULL AND property_id IS NOT NULL) OR (vehicle_id IS NOT NULL AND property_id IS NULL)),
        CONSTRAINT ck_attachments_kind CHECK (kind IN ('circulation_permit', 'technical_review', 'soap', 'insurance', 'registration', 'license', 'deed', 'lease', 'property_tax', 'other')),
        CONSTRAINT ck_attachments_content_type CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
        CONSTRAINT ck_attachments_size CHECK (size_bytes BETWEEN 1 AND 4194304)
    );
    CREATE INDEX ix_attachments_household_id ON dbo.attachments (household_id);
END;
GO

-- El archivo va en una tabla aparte para que listar documentos no lea los bytes.
IF OBJECT_ID(N'dbo.attachment_files', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.attachment_files (
        attachment_id INT            NOT NULL CONSTRAINT pk_attachment_files PRIMARY KEY
                                     CONSTRAINT fk_attachment_files_attachment REFERENCES dbo.attachments (id) ON DELETE CASCADE,
        content       VARBINARY(MAX) NOT NULL
    );
END;
GO
