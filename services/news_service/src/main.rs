use axum::{extract::State,http::StatusCode,response::IntoResponse,routing::get,Json,Router};
use reqwest::Client;
use serde_json::{json,Value};
use sqlx::{postgres::PgPoolOptions,PgPool};
use std::{env,net::SocketAddr,sync::Arc};
use tokio::time::Duration;
use tracing_subscriber::{layer::SubscriberExt,util::SubscriberInitExt};
mod auth;
mod news;
mod outbox;
pub(crate) use auth::{auth_claims_from_headers,user_id_from_auth,AccessClaims};
#[derive(Clone)] pub(crate) struct AppState{pub(crate) db:PgPool,pub(crate) jwt_secret:String,pub(crate) http_client:Client}
pub(crate) fn has_cms_access(claims:&AccessClaims)->bool{claims.roles.iter().any(|r|matches!(r.to_ascii_lowercase().as_str(),"admin"|"content_admin"|"super_admin"))}
pub(crate) async fn push_notification_best_effort(state:&Arc<AppState>,user_id:uuid::Uuid,category:&str,event_type:&str,title:&str,message:&str,data:Value){
 let payload=json!({"user_id":user_id,"category":category,"event_type":event_type,"title":title,"message":message,"data":data});
 let key=format!("notification:{}:{}:{}",user_id,event_type,data.get("content_id").and_then(Value::as_str).unwrap_or("none"));
 let _=sqlx::query("INSERT INTO events.event_outbox(aggregate_type,aggregate_id,event_type,payload,routing_key,event_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING").bind("notification").bind(user_id.to_string()).bind("notification.requested").bind(payload).bind("notifications.requested").bind(key).execute(&state.db).await;
}
async fn health()->impl IntoResponse{Json(json!({"status":"ok","service":"news_service"}))}
async fn ready(State(state):State<Arc<AppState>>)->impl IntoResponse{match sqlx::query_scalar::<_,i32>("SELECT 1").fetch_one(&state.db).await{Ok(1)=>(StatusCode::OK,Json(json!({"status":"ready","service":"news_service"}))),_=>(StatusCode::SERVICE_UNAVAILABLE,Json(json!({"status":"not_ready","service":"news_service"})))}} 
#[tokio::main] async fn main()->anyhow::Result<()>{
 tracing_subscriber::registry().with(tracing_subscriber::EnvFilter::from_default_env()).with(tracing_subscriber::fmt::layer().json()).init();
 let url=env::var("NEWS_DATABASE_URL").or_else(|_|env::var("DATABASE_URL"))?; let pool=PgPoolOptions::new().max_connections(20).connect(&url).await?; sqlx::migrate!("./migrations").run(&pool).await?;
 let state=Arc::new(AppState{db:pool.clone(),jwt_secret:env::var("JWT_SECRET")?,http_client:Client::builder().timeout(Duration::from_secs(10)).build()?});
 let rabbit=env::var("RABBITMQ_URL").unwrap_or_default(); if !rabbit.is_empty(){tokio::spawn(outbox::run_outbox_publisher(pool.clone(),outbox::OutboxPublisherConfig::from_env(rabbit)));}
 let app=Router::new().route("/health",get(health)).route("/ready",get(ready)).merge(news::router()).with_state(state);
 let port:u16=env::var("APP_PORT").unwrap_or_else(|_|"8093".into()).parse()?; axum::serve(tokio::net::TcpListener::bind(SocketAddr::from(([0,0,0,0],port))).await?,app).await?; Ok(())
}