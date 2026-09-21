/*
    Fork interno (SQLWorks). Archivo nuevo: no toca nada del upstream.

    Siembra la base de prueba de la lista de paridad (FORK.md §13.1) en un servidor de verdad.
    Es el mismo juego de datos que se usó en el contenedor: dos tablas con clave ajena e índice,
    una vista, un procedimiento, un esquema propio, un login, un usuario sin login, dos roles
    encadenados y un DENY de columna.

    Cómo se corre:

        sqlcmd -S <servidor> -E -i 01-sembrar.sql        (autenticación integrada)
        sqlcmd -S <servidor> -U sa -P <clave> -i 01-sembrar.sql

    o pegándolo entero en una ventana de consulta de SQLWorks o de SSMS. No usa sqlcmd
    mode: es T-SQL a secas.

    Hace falta ser sysadmin: crea una base, un login y roles de servidor.
    Para deshacerlo todo: 02-limpiar.sql.
*/

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------------------------
   La contraseña del login de prueba. Cámbiala en la línea de abajo antes de correr esto: el
   script se planta si no. No la guardamos en el repositorio a propósito.
   --------------------------------------------------------------------------------------------- */
DECLARE @clave nvarchar(128) = N'PON-AQUI-UNA-CONTRASENA';

IF @clave = N'PON-AQUI-UNA-CONTRASENA'
BEGIN
    THROW 50000,
        'Edita la primera línea DECLARE de este archivo y pon una contraseña que cumpla la política del servidor.',
        1;
END

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'parity_user')
BEGIN
    EXEC sys.sp_executesql
        N'CREATE LOGIN [parity_user] WITH PASSWORD = @clave, CHECK_POLICY = ON;',
        N'@clave nvarchar(128)',
        @clave = @clave;
END
GO

/* dbcreator: es lo que la seccion de logins del panel muestra en la columna de roles (§19.8). */
IF NOT EXISTS (
    SELECT 1
    FROM sys.server_role_members rm
        JOIN sys.server_principals r ON r.principal_id = rm.role_principal_id
        JOIN sys.server_principals m ON m.principal_id = rm.member_principal_id
    WHERE r.name = N'dbcreator' AND m.name = N'parity_user')
BEGIN
    ALTER SERVER ROLE [dbcreator] ADD MEMBER [parity_user];
END
GO

IF DB_ID(N'ParityDb') IS NULL
BEGIN
    CREATE DATABASE [ParityDb];
END
GO

USE [ParityDb];
GO

IF SCHEMA_ID(N'ventas') IS NULL
BEGIN
    EXEC(N'CREATE SCHEMA [ventas] AUTHORIZATION [dbo];');
END
GO

IF OBJECT_ID(N'ventas.Cliente', N'U') IS NULL
BEGIN
    CREATE TABLE [ventas].[Cliente] (
        [ClienteId] int IDENTITY(1, 1) NOT NULL CONSTRAINT [PK_Cliente] PRIMARY KEY,
        [Nombre] nvarchar(100) NOT NULL,
        [Email] nvarchar(200) NULL,
        [Alta] datetime2(0) NOT NULL CONSTRAINT [DF_Cliente_Alta] DEFAULT (SYSUTCDATETIME())
    );
END
GO

IF OBJECT_ID(N'ventas.Pedido', N'U') IS NULL
BEGIN
    CREATE TABLE [ventas].[Pedido] (
        [PedidoId] int IDENTITY(1, 1) NOT NULL CONSTRAINT [PK_Pedido] PRIMARY KEY,
        [ClienteId] int NOT NULL CONSTRAINT [FK_Pedido_Cliente]
            FOREIGN KEY REFERENCES [ventas].[Cliente] ([ClienteId]),
        [Fecha] date NOT NULL,
        [Total] decimal(10, 2) NOT NULL
    );

    CREATE INDEX [IX_Pedido_ClienteId] ON [ventas].[Pedido] ([ClienteId]);
END
GO

IF NOT EXISTS (SELECT 1 FROM [ventas].[Cliente])
BEGIN
    INSERT INTO [ventas].[Cliente] ([Nombre], [Email])
    VALUES (N'Jane Doe', N'jane.doe@example.com'),
           (N'John Doe', N'john.doe@example.com'),
           (N'Ana Ruiz', N'ana.ruiz@example.com');

    INSERT INTO [ventas].[Pedido] ([ClienteId], [Fecha], [Total])
    VALUES (1, '2026-01-15', 120.50),
           (1, '2026-02-03', 80.00),
           (2, '2026-02-11', 249.99),
           (3, '2026-03-01', 15.25);
END
GO

CREATE OR ALTER VIEW [ventas].[vPedidoCliente]
AS
SELECT p.[PedidoId],
       p.[Fecha],
       p.[Total],
       c.[ClienteId],
       c.[Nombre]
FROM [ventas].[Pedido] AS p
    JOIN [ventas].[Cliente] AS c ON c.[ClienteId] = p.[ClienteId];
GO

CREATE OR ALTER PROCEDURE [ventas].[ObtenerPedidos]
    @ClienteId int
AS
BEGIN
    SET NOCOUNT ON;

    SELECT [PedidoId], [Fecha], [Total]
    FROM [ventas].[Pedido]
    WHERE [ClienteId] = @ClienteId
    ORDER BY [Fecha];
END
GO

/* ---------------------------------------------------------------------------------------------
   Principales de base y la cadena de herencia que tiene que resolver la matriz del panel (§13.1):

       analista  ->  ventas_supervisores  ->  ventas_lectores
                         INSERT en ventas       SELECT en ventas
   --------------------------------------------------------------------------------------------- */

IF DATABASE_PRINCIPAL_ID(N'parity_user') IS NULL
BEGIN
    CREATE USER [parity_user] FOR LOGIN [parity_user];
END
GO

IF DATABASE_PRINCIPAL_ID(N'analista') IS NULL
BEGIN
    CREATE USER [analista] WITHOUT LOGIN;
END
GO

IF DATABASE_PRINCIPAL_ID(N'ventas_lectores') IS NULL
BEGIN
    CREATE ROLE [ventas_lectores];
END
GO

IF DATABASE_PRINCIPAL_ID(N'ventas_supervisores') IS NULL
BEGIN
    CREATE ROLE [ventas_supervisores];
END
GO

ALTER ROLE [ventas_lectores] ADD MEMBER [parity_user];
ALTER ROLE [ventas_lectores] ADD MEMBER [ventas_supervisores];
ALTER ROLE [ventas_supervisores] ADD MEMBER [analista];
GO

GRANT SELECT ON SCHEMA::[ventas] TO [ventas_lectores];
GRANT INSERT ON SCHEMA::[ventas] TO [ventas_supervisores];
GRANT CONNECT TO [parity_user];
GO

/* El DENY de columna: la matriz tiene que pintarlo como denegado sobre Email, no sobre la tabla. */
DENY SELECT ON [ventas].[Cliente] ([Email]) TO [parity_user];
GO

PRINT 'Sembrado: ParityDb, esquema ventas, parity_user, analista, ventas_lectores, ventas_supervisores.';
GO
