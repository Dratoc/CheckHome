-- 0010_expense_refunds.sql
-- Ingresos únicos como gasto negativo (reembolso del seguro, devolución de una compra, etc.).
--   - Un reembolso es una fila de dbo.expenses con monto NEGATIVO: así resta solo en todos los totales
--     (resumen del mes, movimientos, estado de la tarjeta, cierre del mes y gráficos) sin tocar cada consulta.
--   - Cuenta en el mes en que llega la plata (su fecha), no en el del gasto original.
--   - Opcionalmente apunta al gasto que reembolsa (refund_of_id). Si se borra ese gasto, el reembolso queda suelto.
-- Idempotente y no destructiva: amplía una restricción CHECK y agrega una columna que acepta NULL.

-- El monto puede ser negativo (reembolso), pero nunca cero.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'ck_expenses_amount' AND definition LIKE N'%<>%')
BEGIN
    ALTER TABLE dbo.expenses DROP CONSTRAINT ck_expenses_amount;
    ALTER TABLE dbo.expenses ADD CONSTRAINT ck_expenses_amount CHECK (amount <> 0);
END;
GO

-- De qué gasto es el reembolso (opcional).
IF COL_LENGTH(N'dbo.expenses', N'refund_of_id') IS NULL
    ALTER TABLE dbo.expenses ADD refund_of_id INT NULL CONSTRAINT fk_expenses_refund_of REFERENCES dbo.expenses (id);
GO

-- Solo un reembolso (monto negativo) puede apuntar a un gasto.
IF OBJECT_ID(N'dbo.ck_expenses_refund_of', N'C') IS NULL
    ALTER TABLE dbo.expenses ADD CONSTRAINT ck_expenses_refund_of CHECK (refund_of_id IS NULL OR amount < 0);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_expenses_refund_of_id')
    CREATE INDEX ix_expenses_refund_of_id ON dbo.expenses (refund_of_id) WHERE refund_of_id IS NOT NULL;
GO
