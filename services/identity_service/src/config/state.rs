use super::Config;
use deadpool_redis::Pool as RedisPool;
use sqlx::Postgres;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::Pool<Postgres>,
    pub redis: RedisPool,
    pub config: Config,
}
