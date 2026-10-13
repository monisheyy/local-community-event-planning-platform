-- Local Community Event Planning Platform - Azure SQL Database schema (T-SQL)
-- Run automatically by `npm run db:init` when AZURE_SQL_* settings are present,
-- or paste into the Azure Portal Query Editor.
-- Child rows are deleted explicitly by the API (no ON DELETE CASCADE) to avoid
-- SQL Server "multiple cascade paths" errors and keep deletes auditable.

IF OBJECT_ID('dbo.users', 'U') IS NULL
CREATE TABLE dbo.users (
  id            NVARCHAR(36)  NOT NULL CONSTRAINT PK_users PRIMARY KEY,
  email         NVARCHAR(255) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
  password_hash NVARCHAR(100) NOT NULL,
  name          NVARCHAR(100) NOT NULL,
  role          NVARCHAR(20)  NOT NULL CONSTRAINT DF_users_role DEFAULT 'participant'
                CONSTRAINT CK_users_role CHECK (role IN ('participant','organizer','admin')),
  bio           NVARCHAR(500) NULL,
  created_at    DATETIME2     NOT NULL
);
GO

IF OBJECT_ID('dbo.events', 'U') IS NULL
CREATE TABLE dbo.events (
  id           NVARCHAR(36)  NOT NULL CONSTRAINT PK_events PRIMARY KEY,
  organizer_id NVARCHAR(36)  NOT NULL CONSTRAINT FK_events_users REFERENCES dbo.users(id),
  title        NVARCHAR(150) NOT NULL,
  description  NVARCHAR(MAX) NOT NULL,
  category     NVARCHAR(50)  NOT NULL,
  location     NVARCHAR(200) NOT NULL,
  start_time   DATETIME2     NOT NULL,
  end_time     DATETIME2     NOT NULL,
  capacity     INT           NOT NULL CONSTRAINT CK_events_capacity CHECK (capacity > 0),
  image_url    NVARCHAR(500) NULL,
  status       NVARCHAR(20)  NOT NULL CONSTRAINT DF_events_status DEFAULT 'published'
               CONSTRAINT CK_events_status CHECK (status IN ('published','cancelled')),
  created_at   DATETIME2     NOT NULL,
  updated_at   DATETIME2     NOT NULL,
  CONSTRAINT CK_events_times CHECK (end_time > start_time)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_events_start')
  CREATE INDEX IX_events_start ON dbo.events(start_time);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_events_organizer')
  CREATE INDEX IX_events_organizer ON dbo.events(organizer_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_events_category')
  CREATE INDEX IX_events_category ON dbo.events(category);
GO

IF OBJECT_ID('dbo.registrations', 'U') IS NULL
CREATE TABLE dbo.registrations (
  id         NVARCHAR(36) NOT NULL CONSTRAINT PK_registrations PRIMARY KEY,
  event_id   NVARCHAR(36) NOT NULL CONSTRAINT FK_registrations_events REFERENCES dbo.events(id),
  user_id    NVARCHAR(36) NOT NULL CONSTRAINT FK_registrations_users  REFERENCES dbo.users(id),
  created_at DATETIME2    NOT NULL,
  CONSTRAINT UQ_registrations_event_user UNIQUE (event_id, user_id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_registrations_user')
  CREATE INDEX IX_registrations_user ON dbo.registrations(user_id);
GO

IF OBJECT_ID('dbo.comments', 'U') IS NULL
CREATE TABLE dbo.comments (
  id         NVARCHAR(36)   NOT NULL CONSTRAINT PK_comments PRIMARY KEY,
  event_id   NVARCHAR(36)   NOT NULL CONSTRAINT FK_comments_events REFERENCES dbo.events(id),
  user_id    NVARCHAR(36)   NOT NULL CONSTRAINT FK_comments_users  REFERENCES dbo.users(id),
  body       NVARCHAR(1000) NOT NULL,
  created_at DATETIME2      NOT NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_comments_event')
  CREATE INDEX IX_comments_event ON dbo.comments(event_id);
GO

IF OBJECT_ID('dbo.notifications', 'U') IS NULL
CREATE TABLE dbo.notifications (
  id         NVARCHAR(36)  NOT NULL CONSTRAINT PK_notifications PRIMARY KEY,
  user_id    NVARCHAR(36)  NOT NULL CONSTRAINT FK_notifications_users  REFERENCES dbo.users(id),
  event_id   NVARCHAR(36)  NULL     CONSTRAINT FK_notifications_events REFERENCES dbo.events(id),
  type       NVARCHAR(30)  NOT NULL,
  message    NVARCHAR(500) NOT NULL,
  is_read    INT           NOT NULL CONSTRAINT DF_notifications_is_read DEFAULT 0,
  created_at DATETIME2     NOT NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_notifications_user')
  CREATE INDEX IX_notifications_user ON dbo.notifications(user_id, is_read);
GO
