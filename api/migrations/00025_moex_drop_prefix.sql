-- +goose Up
ALTER TABLE IF EXISTS moex.moex_indexes RENAME TO indexes;
ALTER TABLE IF EXISTS moex.moex_index_collections RENAME TO index_collections;
ALTER TABLE IF EXISTS moex.moex_index_collection_memberships RENAME TO index_collection_memberships;
ALTER TABLE IF EXISTS moex.moex_index_history_daily RENAME TO index_history_daily;
ALTER TABLE IF EXISTS moex.moex_index_composition_daily RENAME TO index_composition_daily;
ALTER TABLE IF EXISTS moex.moex_security_history_daily RENAME TO security_history_daily;
ALTER TABLE IF EXISTS moex.moex_sync_state RENAME TO sync_state;
ALTER TABLE IF EXISTS moex.moex_data_coverage RENAME TO data_coverage;
ALTER TABLE IF EXISTS moex.moex_sync_runs RENAME TO sync_runs;

-- +goose Down
ALTER TABLE IF EXISTS moex.sync_runs RENAME TO moex_sync_runs;
ALTER TABLE IF EXISTS moex.data_coverage RENAME TO moex_data_coverage;
ALTER TABLE IF EXISTS moex.sync_state RENAME TO moex_sync_state;
ALTER TABLE IF EXISTS moex.security_history_daily RENAME TO moex_security_history_daily;
ALTER TABLE IF EXISTS moex.index_composition_daily RENAME TO moex_index_composition_daily;
ALTER TABLE IF EXISTS moex.index_history_daily RENAME TO moex_index_history_daily;
ALTER TABLE IF EXISTS moex.index_collection_memberships RENAME TO moex_index_collection_memberships;
ALTER TABLE IF EXISTS moex.index_collections RENAME TO moex_index_collections;
ALTER TABLE IF EXISTS moex.indexes RENAME TO moex_indexes;
