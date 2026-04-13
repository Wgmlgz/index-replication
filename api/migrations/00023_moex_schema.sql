-- +goose Up
CREATE SCHEMA IF NOT EXISTS moex;

ALTER TABLE IF EXISTS public.moex_indexes SET SCHEMA moex;
ALTER TABLE IF EXISTS public.moex_index_collections SET SCHEMA moex;
ALTER TABLE IF EXISTS public.moex_index_collection_memberships SET SCHEMA moex;
ALTER TABLE IF EXISTS public.moex_index_history_daily SET SCHEMA moex;
ALTER TABLE IF EXISTS public.moex_index_composition_daily SET SCHEMA moex;
ALTER TABLE IF EXISTS public.moex_security_history_daily SET SCHEMA moex;
ALTER TABLE IF EXISTS public.moex_sync_state SET SCHEMA moex;
ALTER TABLE IF EXISTS public.moex_data_coverage SET SCHEMA moex;
ALTER TABLE IF EXISTS public.moex_sync_runs SET SCHEMA moex;

-- +goose Down
ALTER TABLE IF EXISTS moex.moex_sync_runs SET SCHEMA public;
ALTER TABLE IF EXISTS moex.moex_data_coverage SET SCHEMA public;
ALTER TABLE IF EXISTS moex.moex_sync_state SET SCHEMA public;
ALTER TABLE IF EXISTS moex.moex_security_history_daily SET SCHEMA public;
ALTER TABLE IF EXISTS moex.moex_index_composition_daily SET SCHEMA public;
ALTER TABLE IF EXISTS moex.moex_index_history_daily SET SCHEMA public;
ALTER TABLE IF EXISTS moex.moex_index_collection_memberships SET SCHEMA public;
ALTER TABLE IF EXISTS moex.moex_index_collections SET SCHEMA public;
ALTER TABLE IF EXISTS moex.moex_indexes SET SCHEMA public;

DROP SCHEMA IF EXISTS moex;
