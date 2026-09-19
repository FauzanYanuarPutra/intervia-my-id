use axum::{body::{to_bytes,Body},extract::State,http::{HeaderName,HeaderValue,Request,StatusCode},response::Response,routing::any,Router};
use reqwest::Client; use sqlx::{postgres::PgPoolOptions,PgPool}; use std::{env,sync::Arc}; use tracing_subscriber::{layer::SubscriberExt,util::SubscriberInitExt};

#[derive(Clone)] struct AppState{db:PgPool,http:Client,upstream:String}
fn forward_headers(req:&Request<Body>)->reqwest::header::HeaderMap{
 let mut out=reqwest::header::HeaderMap::new();
 for name in ["authorization","content-type","accept","x-request-id","idempotency-key","x-correlation-id"]{
  if let Ok(n)=HeaderName::from_bytes(name.as_bytes()){if let Some(v)=req.headers().get(&n){if let Ok(v)=HeaderValue::from_bytes(v.as_bytes()){out.insert(reqwest::header::HeaderName::from_bytes(name.as_bytes()).unwrap(),v);}}}
 }
 out
}
async fn proxy(State(s):State<Arc<AppState>>,req:Request<Body>)->Result<Response,StatusCode>{
 let path=req.uri().path_and_query().map(|v|v.as_str()).unwrap_or("/");
 let url=format!("{}{}",s.upstream.trim_end_matches('/'),path);
 let method=req.method().clone();
 let headers=forward_headers(&req);
 let body=to_bytes(req.into_body(),8*1024*1024).await.map_err(|_|StatusCode::BAD_REQUEST)?;
 let mut rb=s.http.request(method,url).headers(headers).body(body.to_vec());
 let response=rb.send().await.map_err(|e|{tracing::error!(error=?e,"legacy upstream request failed");StatusCode::BAD_GATEWAY})?;
 let status=StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
 let bytes=response.bytes().await.map_err(|_|StatusCode::BAD_GATEWAY)?;
 let mut out=Response::new(Body::from(bytes));
 *out.status_mut()=status;
 if let Some(ct)=response.headers().get("content-type"){if let Ok(v)=HeaderValue::from_bytes(ct.as_bytes()){out.headers_mut().insert("content-type",v);}}
 Ok(out)
}
async fn health()->Response{Response::new(Body::from(format!(r#"{{"status":"ok","service":"{}"}}"#,env!("CARGO_PKG_NAME"))))}
async fn ready(State(s):State<Arc<AppState>>)->Response{match sqlx::query_scalar::<_,i32>("SELECT 1").fetch_one(&s.db).await{Ok(1)=>Response::new(Body::from(format!(r#"{{"status":"ready","service":"{}"}}"#,env!("CARGO_PKG_NAME")))),_=>(StatusCode::SERVICE_UNAVAILABLE.into_response())}}
use axum::response::IntoResponse;
#[tokio::main] async fn main()->anyhow::Result<()>{
 tracing_subscriber::registry().with(tracing_subscriber::EnvFilter::from_default_env()).with(tracing_subscriber::fmt::layer().json()).init();
 let db_url=env::var("DATABASE_URL")?; let db=PgPoolOptions::new().max_connections(10).connect(&db_url).await?;
 if env::var("RUN_MIGRATIONS_ON_STARTUP").unwrap_or_else(|_|"true".into()).eq_ignore_ascii_case("true"){sqlx::migrate!("./migrations").run(&db).await?;}
 let http=Client::builder().build()?; let upstream=env::var("LEGACY_UPSTREAM_URL").unwrap_or_else(|_|"http://marketplace_service:8081".into()); let state=Arc::new(AppState{db,http,upstream});
 let app=Router::new().route("/health",any(health)).route("/ready",any(ready)).route("/v1/{*path}",any(proxy)).with_state(state);
 let port:u16=env::var("APP_PORT").unwrap_or_else(|_|"8080".into()).parse()?; let addr=format!("0.0.0.0:{}",port).parse()?; axum::serve(tokio::net::TcpListener::bind(addr).await?,app).await?; Ok(())
}