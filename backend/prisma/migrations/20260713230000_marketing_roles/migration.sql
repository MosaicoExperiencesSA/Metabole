-- Nuovi ruoli RBAC per il reparto Marketing (backlog / STATO).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'marketing';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'head_marketing';
