use axum::{body::{to_bytes,Body},extract::State,http::{Request,StatusCode},response::{IntoResponse,Response},routing::any,Router};
use reqwest::Client; use sqlx::{postgres::PgPoolOptions,PgPool}; use std::{env,sync::Arc}; use tracing_subscriber::{layer::SubscriberExt,util::SubscriberInitExt};
#[derive(Clone)] struct AppState{db:PgPool,http:Client,upstream:String}
async fn proxy(State(s):State<Arc<AppState>>,req:Request<Body>)->Result<Response,StatusCode>{
 let path=req.uri().path_and_query().map(|v|v.as_str()).unwrap_or("/");
 let url=format!("{}{}",s.upstream.trim_end_matches('/'),path);
 let method=req.method().clone(); let mut rb=s.http.request(method,url);
 for name in ["authorization","content-type","accept","x-request-id","idempotency-key","x-correlation-id"]{if let Some(v)=req.headers().get(name){if let Ok(vs)=v.to_str(){rb=rb.header(name,vs);}}}
 let body=to_bytes(req.into_body(),8*1024*1024).await.map_err(|_|StatusCode::BAD_REQUEST)?;
 let response=rb.body(body.to_vec()).send().await.map_err(|e|{tracing::error!(error=?e,"legacy upstream request failed");StatusCode::BAD_GATEWAY})?;
 let status=StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
 let content_type=response.headers().get("content-type").and_then(|v|v.to_str().ok()).map(str::to_owned);
 let bytes=response.bytes().await.map_err(|_|StatusCode::BAD_GATEWAY)?;
 let mut out=Response::new(Body::from(bytes)); *out.status_mut()=status;
 if let Some(ct)=content_type{if let Ok(v)=ct.parse(){out.headers_mut().insert("content-type",v);}}
 Ok(out)
}
async fn health()->Response{Response::new(Body::from(format!(r#"{{"status":"ok","service":"{}","mode":"compatibility-proxy"}}"#,env!("CARGO_PKG_NAME"))))}
async fn ready(State(s):State<Arc<AppState>>)->Response{match sqlx::query_scalar::<_,i32>("SELECT 1").fetch_one(&s.db).await{Ok(1)=>(StatusCode::OK,axum::Json(serde_json::json!({"status":"ready","service":env!("CARGO_PKG_NAME")}))).into_response(),_=>(StatusCode::SERVICE_UNAVAILABLE,axum::Json(serde_json::json!({"status":"not_ready","service":env!("CARGO_PKG_NAME")}))).into_response()}}
#[tokio::main] async fn main()->anyhow::Result<()>{
 tracing_subscriber::registry().with(tracing_subscriber::EnvFilter::from_default_env()).with(tracing_subscriber::fmt::layer().json()).init();
 let db=PgPoolOptions::new().max_connections(10).connect(&env::var("DATABASE_URL")?).await?;
 if env::var("RUN_MIGRATIONS_ON_STARTUP").unwrap_or_else(|_|"true".into()).eq_ignore_ascii_case("true"){sqlx::migrate!("./migrations").run(&db).await?;}
 let state=Arc::new(AppState{db,http:Client::new(),upstream:env::var("LEGACY_UPSTREAM_URL").unwrap_or_else(|_|"http://marketplace_service:8081".into())});
 let app=Router::new().route("/health",any(health)).route("/ready",any(ready)).route("/v1/{*path}",any(proxy)).with_state(state);
 let port:u16=env::var("APP_PORT").unwrap_or_else(|_|"8080".into()).parse()?; axum::serve(tokio::net::TcpListener::bind(format!("0.0.0.0:{}",port)).await?,app).await?; Ok(())
}