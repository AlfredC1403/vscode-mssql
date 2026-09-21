/*
    Fork interno (SQLWorks). Archivo nuevo: no toca nada del upstream.

    Deshace lo que sembró 01-sembrar.sql: borra ParityDb entera y el login parity_user.

        sqlcmd -S <servidor> -E -i 02-limpiar.sql

    Aviso: esto tira la base de prueba con todo lo que tenga dentro, incluidos los principales
    que hayas creado tú durante el recorrido de M5 y M6 si los creaste dentro de ParityDb. Los
    logins de servidor que hayas creado en el recorrido (los de ámbito de servidor) no los
    conoce este script: bórralos desde el panel, que es justo otra comprobación de la lista.
*/

SET NOCOUNT ON;
GO

IF DB_ID(N'ParityDb') IS NOT NULL
BEGIN
    ALTER DATABASE [ParityDb] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [ParityDb];
    PRINT 'ParityDb borrada.';
END
GO

IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'parity_user')
BEGIN
    DROP LOGIN [parity_user];
    PRINT 'Login parity_user borrado.';
END
GO
