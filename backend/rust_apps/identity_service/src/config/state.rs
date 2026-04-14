use super::Config;
use deadpool_redis::Pool as RedisPool;
use lapin::Connection;
use sqlx::Postgres;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::Pool<Postgres>,
    pub redis: RedisPool,
    pub rabbitmq: Arc<Connection>,
    pub config: Config,
}
