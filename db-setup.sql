-- ============================================
-- StreamVault - users table setup
-- Run this in Azure SQL (Query Editor or sqlcmd)
-- ============================================

CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

-- ============================================
-- Sample users (passwords are bcrypt-hashed)
-- Plain-text password shown in the comment for reference only
-- ============================================

-- Username: Muhammad Zohan | Password: Abcd123
INSERT INTO users (username, password_hash)
VALUES ('Muhammad Zohan', '$2b$10$tPA3tFOM7dVdBdhJrqbkv.YihvrJxy7Hj6Nm5mnhdo3MEi7gYuo0m');
GO

-- Username: Umair | Password: abcd123
INSERT INTO users (username, password_hash)
VALUES ('Umair', '$2b$10$kcA36UnE8sF7.JLxQ3ehruAffv9pMBswnnGVjXtRIReo7Ehi.57ga');
GO

-- Username: Zoraiz | Password: MyPass456
INSERT INTO users (username, password_hash)
VALUES ('Zoraiz', '$2b$10$DGqw6EANnYK1Bx2j86rFGOYsT6h24Um9FCquXzcsHAW3GhJfRQ3tm');
GO

-- Username: demo_user | Password: Test@123
-- (generate a hash with: node -e "console.log(require('bcryptjs').hashSync('Test@123', 10))")

-- ============================================
-- Verify
-- ============================================
SELECT id, username, created_at FROM users;
GO
