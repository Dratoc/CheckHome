-- 0007_shopping_items.sql
-- Lista de compras compartida del hogar (supermercado y otras cosas por comprar).
-- Cualquiera del hogar agrega cosas, las marca como compradas y limpia las compradas.
-- Idempotente y no destructiva: solo crea una tabla nueva.

IF OBJECT_ID(N'dbo.shopping_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.shopping_items (
        id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_shopping_items PRIMARY KEY,
        household_id INT               NOT NULL CONSTRAINT fk_shopping_items_household REFERENCES dbo.households (id),
        name         NVARCHAR(100)     NOT NULL,
        -- Texto libre opcional: "2 kg", "1 paquete", "la marca de siempre"
        quantity     NVARCHAR(40)      NULL,
        added_by     INT               NOT NULL CONSTRAINT fk_shopping_items_added_by REFERENCES dbo.users (id),
        bought_by    INT               NULL CONSTRAINT fk_shopping_items_bought_by REFERENCES dbo.users (id),
        bought_at    DATETIME2         NULL,
        created_at   DATETIME2         NOT NULL CONSTRAINT df_shopping_items_created_at DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX ix_shopping_items_household_id ON dbo.shopping_items (household_id);
END;
GO
