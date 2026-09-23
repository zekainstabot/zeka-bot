CREATE TABLE IF NOT EXISTS download_strategy_experiment_results (
    id BIGSERIAL PRIMARY KEY,

    experiment_id BIGINT NOT NULL
        REFERENCES download_strategy_experiments(id)
        ON DELETE CASCADE,

    job_id BIGINT
        REFERENCES jobs(id)
        ON DELETE SET NULL,

    strategy_id BIGINT
        REFERENCES platform_download_strategies(id)
        ON DELETE SET NULL,

    variant VARCHAR(30) NOT NULL,

    status VARCHAR(30) NOT NULL,

    duration_ms INTEGER,

    output_size_bytes BIGINT,

    success BOOLEAN NOT NULL DEFAULT FALSE,

    error_type VARCHAR(100),

    error_code VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiment_results_experiment
    ON download_strategy_experiment_results(experiment_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiment_results_job
    ON download_strategy_experiment_results(job_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiment_results_strategy
    ON download_strategy_experiment_results(strategy_id);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiment_results_variant
    ON download_strategy_experiment_results(variant);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiment_results_status
    ON download_strategy_experiment_results(status);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiment_results_success
    ON download_strategy_experiment_results(success);

CREATE INDEX IF NOT EXISTS idx_download_strategy_experiment_results_created
    ON download_strategy_experiment_results(created_at);
