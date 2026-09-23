use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, patch},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, Row};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    auth::{auth_claims_from_headers, user_id_from_auth},
    has_cms_access, AppState,
};

const MAX_PUBLIC_OFFSET: i64 = 10_000;
const MAX_TITLE_LEN: usize = 180;
const MAX_SUMMARY_LEN: usize = 1_000;
const MAX_BODY_LEN: usize = 20_000;
const MAX_RICH_BODY_LEN: usize = 60_000;
const MAX_CATEGORY_LEN: usize = 80;
const MAX_AUTHOR_LEN: usize = 120;
const MAX_TOPIC_LEN: usize = 40;
const ALLOWED_CATEGORIES: &[&str] = &[
    "UMKM","Bisnis","Supplier","Operasional","Teknologi","AI","Pemasaran","Keuangan","Produksi","Inspirasi",
];

#[derive(Debug, Serialize, FromRow, Clone)]
struct BlogRow {
    id: Uuid,
    owner_id: Uuid,
    slug: Option<String>,
    title: String,
    summary: Option<String>,
    body: String,
    tags: Option<Vec<String>>,
    cover_image: Option<String>,
    metadata: Value,
    content_status: String,
    published_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Default)]
struct PublicBlogQuery {
    category: Option<String>,
    topic: Option<String>,
    language: Option<String>,
    q: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct SubmissionPayload {
    title: String,
    summary: String,
    body: String,
    rich_body: Option<String>,
    category: Option<String>,
    language: Option<String>,
    topics: Option<Vec<String>>,
    cover_image: Option<String>,
    author_name: Option<String>,
    publication_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EditorialPayload {
    action: String,
    note: Option<String>,
}

#[derive(Debug, Serialize)]
struct BlogListResponse { items: Vec<BlogRow>, limit: i64, offset: i64, has_more: bool }

#[derive(Debug, Serialize)]
struct EditorialResponse { items: Vec<BlogRow> }

fn error(status: StatusCode, message: impl Into<String>) -> impl IntoResponse {
    (status, Json(json!({ "error": message.into() })))
}

fn clean(value: Option<String>) -> Option<String> {
    value.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn normalize_language(value: Option<String>) -> Result<String, &'static str> {
    let language = clean(value).unwrap_or_else(|| "id".to_string()).to_lowercase();
    if language == "id" || language == "en" { Ok(language) } else { Err("language must be id or en") }
}

fn normalize_category(value: Option<String>) -> Result<String, &'static str> {
    let category = clean(value).unwrap_or_else(|| "UMKM".to_string());
    if category.len() > MAX_CATEGORY_LEN { return Err("category is too long"); }
    if ALLOWED_CATEGORIES.iter().any(|item| item.eq_ignore_ascii_case(&category)) {
        Ok(category)
    } else { Err("unsupported blog category") }
}

fn normalize_topics(value: Option<Vec<String>>) -> Result<Vec<String>, &'static str> {
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();
    for raw in value.unwrap_or_default() {
        let topic = raw.trim().to_lowercase();
        if topic.is_empty() || topic.len() > MAX_TOPIC_LEN || !seen.insert(topic.clone()) { continue; }
        result.push(topic);
        if result.len() >= 8 { break; }
    }
    Ok(result)
}

fn sanitize_rich_body(value: &str) -> String {
    let mut output = value.replace('\0', "");
    for tag in ["script","iframe","object","embed","style","form"] {
        loop {
            let lower = output.to_lowercase();
            let Some(start) = lower.find(&format!("<{tag}")) else { break; };
            let Some(end_rel) = lower[start..].find(&format!("</{tag}>")) else {
                output.replace_range(start.., "");
                break;
            };
            let end = start + end_rel + tag.len() + 3;
            output.replace_range(start..end, "");
        }
    }
    for value in ["javascript:","vbscript:","onerror=","onclick=","onload=","onmouseover="] {
        output = output.replace(value, "");
    }
    output
}

fn metadata_blog(
    category: &str, language: &str, topics: &[String], author_name: &str,
    rich_body: &str, publication_mode: &str, editorial_status: &str,
) -> Value {
    json!({"blog":{
        "category":category,"language":language,"topics":topics,"author_name":author_name,
        "rich_body":rich_body,"publication_mode":publication_mode,"editorial_status":editorial_status,
        "is_indexable":editorial_status=="published","updated_at":Utc::now().to_rfc3339()
    }})
}

fn slug_base(title: &str) -> String {
    let mut slug = title.chars().map(|c| if c.is_ascii_alphanumeric(){c.to_ascii_lowercase()}else{'-'}).collect::<String>();
    while slug.contains("--") { slug = slug.replace("--","-"); }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() { "artikel".to_string() } else { slug.chars().take(90).collect() }
}

async fn unique_slug(db: &sqlx::PgPool, base: &str) -> Result<String, sqlx::Error> {
    let base = slug_base(base);
    for n in 0..1000 {
        let candidate = if n == 0 { base.clone() } else { format!("{base}-{n}") };
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM content_items WHERE content_type='article' AND slug=$1 AND content_status<>'deleted')")
            .bind(&candidate).fetch_one(db).await?;
        if !exists { return Ok(candidate); }
    }
    Ok(format!("{}-{}", base, Uuid::new_v4().simple()))
}

fn editorial_status(row: &BlogRow) -> String {
    row.metadata.get("blog").and_then(|v|v.get("editorial_status")).and_then(Value::as_str)
        .unwrap_or(if row.content_status=="active"{"published"}else{"draft"}).to_string()
}

fn public_filter_sql() -> &'static str {
    "content_type='article' AND content_status='active' AND COALESCE(metadata->'blog'->>'editorial_status','published')='published' AND (published_at IS NULL OR published_at<=NOW())"
}

async fn list_blog(State(state): State<Arc<AppState>>, Query(query): Query<PublicBlogQuery>) -> impl IntoResponse {
    let limit=query.limit.unwrap_or(24).clamp(1,100);
    let offset=query.offset.unwrap_or(0);
    if !(0..=MAX_PUBLIC_OFFSET).contains(&offset) { return error(StatusCode::BAD_REQUEST,"offset is outside the supported range").into_response(); }
    let category=clean(query.category);
    let topic=clean(query.topic).map(|v|v.to_lowercase());
    let language=clean(query.language).map(|v|v.to_lowercase());
    if language.as_deref().is_some_and(|v|v!="id"&&v!="en") { return error(StatusCode::BAD_REQUEST,"language must be id or en").into_response(); }
    let q=clean(query.q);
    let sql=format!("SELECT id,owner_id,slug,title,summary,body,tags,cover_image,metadata,content_status,published_at,created_at,updated_at FROM content_items WHERE {} AND ($1::text IS NULL OR metadata->'blog'->>'category'=$1) AND ($2::text IS NULL OR $2=ANY(tags)) AND ($3::text IS NULL OR metadata->'blog'->>'language'=$3) AND ($4::text IS NULL OR title ILIKE ('%'||$4||'%') OR COALESCE(summary,'') ILIKE ('%'||$4||'%') OR body ILIKE ('%'||$4||'%') OR COALESCE(array_to_string(tags,' '),'') ILIKE ('%'||$4||'%')) ORDER BY COALESCE(published_at,created_at) DESC,id DESC LIMIT $5 OFFSET $6", public_filter_sql());
    match sqlx::query_as::<_,BlogRow>(&sql).bind(category).bind(topic).bind(language).bind(q).bind(limit+1).bind(offset).fetch_all(&state.db).await {
        Ok(mut items)=>{
            let has_more=items.len() as i64>limit;
            if has_more {items.truncate(limit as usize);}
            for item in &mut items {
                if let Some(meta)=item.metadata.as_object_mut() { if let Some(blog)=meta.get_mut("blog").and_then(Value::as_object_mut) { blog.remove("rich_body"); } }
            }
            (StatusCode::OK,Json(BlogListResponse{items,limit,offset,has_more})).into_response()
        },
        Err(e)=>{tracing::error!("list_blog error: {:?}",e);error(StatusCode::INTERNAL_SERVER_ERROR,"failed to load blog").into_response()}
    }
}

async fn get_blog(State(state): State<Arc<AppState>>, Path(slug): Path<String>) -> impl IntoResponse {
    let item=sqlx::query_as::<_,BlogRow>(&format!("SELECT id,owner_id,slug,title,summary,body,tags,cover_image,metadata,content_status,published_at,created_at,updated_at FROM content_items WHERE {} AND slug=$1 LIMIT 1",public_filter_sql())).bind(slug.trim()).fetch_optional(&state.db).await;
    match item { Ok(Some(item))=>(StatusCode::OK,Json(item)).into_response(), Ok(None)=>error(StatusCode::NOT_FOUND,"blog article not found").into_response(), Err(e)=>{tracing::error!("get_blog error: {:?}",e);error(StatusCode::INTERNAL_SERVER_ERROR,"failed to load blog article").into_response()} }
}

async fn create_submission(State(state): State<Arc<AppState>>, headers: HeaderMap, Json(payload): Json<SubmissionPayload>) -> impl IntoResponse {
    let owner_id=match user_id_from_auth(&headers,&state.jwt_secret){Some(id)=>id,None=>return error(StatusCode::UNAUTHORIZED,"unauthorized").into_response()};
    let title=payload.title.trim().to_string(); let summary=payload.summary.trim().to_string(); let body=payload.body.trim().to_string();
    if title.len()<10||title.len()>MAX_TITLE_LEN {return error(StatusCode::BAD_REQUEST,"title must be 10-180 characters").into_response();}
    if summary.len()<20||summary.len()>MAX_SUMMARY_LEN {return error(StatusCode::BAD_REQUEST,"summary must be 20-1000 characters").into_response();}
    if body.len()<120||body.len()>MAX_BODY_LEN {return error(StatusCode::BAD_REQUEST,"body must be 120-20000 characters").into_response();}
    let category=match normalize_category(payload.category){Ok(v)=>v,Err(m)=>return error(StatusCode::BAD_REQUEST,m).into_response()};
    let language=match normalize_language(payload.language){Ok(v)=>v,Err(m)=>return error(StatusCode::BAD_REQUEST,m).into_response()};
    let topics=match normalize_topics(payload.topics){Ok(v)=>v,Err(m)=>return error(StatusCode::BAD_REQUEST,m).into_response()};
    let publication_mode=clean(payload.publication_mode).unwrap_or_else(||"review".to_string()).to_lowercase();
    if publication_mode!="review"&&publication_mode!="instant" {return error(StatusCode::BAD_REQUEST,"publication_mode must be review or instant").into_response();}
    let can_instant=auth_claims_from_headers(&headers,&state.jwt_secret).is_some_and(|claims| has_cms_access(&claims));
    if publication_mode=="instant" && !can_instant {return error(StatusCode::FORBIDDEN,"instant publication requires editorial access").into_response();}
    let author_name=clean(payload.author_name).unwrap_or_else(||"Lajukan Community".to_string()).chars().take(MAX_AUTHOR_LEN).collect::<String>();
    let rich_body=sanitize_rich_body(payload.rich_body.as_deref().unwrap_or(&format!("<p>{}</p>",body)));
    if rich_body.len()>MAX_RICH_BODY_LEN {return error(StatusCode::BAD_REQUEST,"rich_body is too long").into_response();}
    let duplicate:bool=match sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM content_items WHERE owner_id=$1 AND content_type='article' AND content_status<>'deleted' AND created_at>=NOW()-interval '14 days' AND (lower(title)=lower($2) OR body=$3))").bind(owner_id).bind(&title).bind(&body).fetch_one(&state.db).await {Ok(v)=>v,Err(e)=>{tracing::error!("blog duplicate check error: {:?}",e);return error(StatusCode::INTERNAL_SERVER_ERROR,"failed to validate duplicate article").into_response()}};
    if duplicate {return error(StatusCode::CONFLICT,"duplicate blog submission").into_response();}
    let slug=match unique_slug(&state.db,&title).await {Ok(v)=>v,Err(e)=>{tracing::error!("blog slug error: {:?}",e);return error(StatusCode::INTERNAL_SERVER_ERROR,"failed to generate slug").into_response()}};
    let is_instant=publication_mode=="instant"; let content_status=if is_instant{"active"}else{"draft"}; let status=if is_instant{"published"}else{"pending_review"};
    let metadata=metadata_blog(&category,&language,&topics,&author_name,&rich_body,&publication_mode,status);
    let mut tags=vec!["blog".to_string(),category.to_lowercase()]; tags.extend(topics.iter().cloned());
    let published_at=if is_instant {Some(Utc::now())} else {None};
    let inserted=sqlx::query_as::<_,BlogRow>("INSERT INTO content_items (id,owner_id,content_type,slug,title,summary,body,tags,cover_image,metadata,content_status,listing_status,published_at,created_at,updated_at) VALUES ($1,$2,'article',$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,NOW(),NOW()) RETURNING id,owner_id,slug,title,summary,body,tags,cover_image,metadata,content_status,published_at,created_at,updated_at")
        .bind(Uuid::new_v4()).bind(owner_id).bind(slug).bind(title).bind(summary).bind(body).bind(tags).bind(clean(payload.cover_image)).bind(metadata).bind(content_status).bind(published_at).fetch_one(&state.db).await;
    match inserted {
        Ok(inserted)=>{let _=sqlx::query("INSERT INTO blog_editorial_events(content_id,actor_id,actor_role,action,to_status) VALUES($1,$2,'contributor',$3,$4)").bind(inserted.id).bind(owner_id).bind(if is_instant{"auto_publish"}else{"submit_review"}).bind(status).execute(&state.db).await;(StatusCode::CREATED,Json(inserted)).into_response()},
        Err(e)=>{tracing::error!("blog insert error: {:?}",e);error(StatusCode::INTERNAL_SERVER_ERROR,"failed to create blog article").into_response()}
    }
}

async fn list_my_submissions(State(state): State<Arc<AppState>>, headers: HeaderMap) -> impl IntoResponse {
    let owner_id=match user_id_from_auth(&headers,&state.jwt_secret){Some(id)=>id,None=>return error(StatusCode::UNAUTHORIZED,"unauthorized").into_response()};
    match sqlx::query_as::<_,BlogRow>("SELECT id,owner_id,slug,title,summary,body,tags,cover_image,metadata,content_status,published_at,created_at,updated_at FROM content_items WHERE content_type='article' AND owner_id=$1 AND content_status<>'deleted' ORDER BY updated_at DESC,id DESC LIMIT 100").bind(owner_id).fetch_all(&state.db).await {
        Ok(items)=>(StatusCode::OK,Json(json!({"items":items}))).into_response(),
        Err(e)=>{tracing::error!("list_my_blog_submissions error: {:?}",e);error(StatusCode::INTERNAL_SERVER_ERROR,"failed to load submissions").into_response()}
    }
}

async fn update_submission(State(state): State<Arc<AppState>>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<SubmissionPayload>) -> impl IntoResponse {
    let owner_id=match user_id_from_auth(&headers,&state.jwt_secret){Some(id)=>id,None=>return error(StatusCode::UNAUTHORIZED,"unauthorized").into_response()};
    let content_id=match Uuid::parse_str(id.trim()){Ok(v)=>v,Err(_)=>return error(StatusCode::BAD_REQUEST,"invalid article id").into_response()};
    let current=match sqlx::query_as::<_,BlogRow>("SELECT id,owner_id,slug,title,summary,body,tags,cover_image,metadata,content_status,published_at,created_at,updated_at FROM content_items WHERE id=$1 AND content_type='article' AND content_status<>'deleted' LIMIT 1").bind(content_id).fetch_optional(&state.db).await {
        Ok(Some(v))=>v,Ok(None)=>return error(StatusCode::NOT_FOUND,"article not found").into_response(),Err(e)=>{tracing::error!("blog update load error: {:?}",e);return error(StatusCode::INTERNAL_SERVER_ERROR,"failed to load article").into_response()}
    };
    if current.owner_id!=owner_id {return error(StatusCode::FORBIDDEN,"forbidden").into_response();}
    if editorial_status(&current)=="published" {return error(StatusCode::CONFLICT,"published blog cannot be edited as a pending submission").into_response();}
    let title=payload.title.trim().to_string(); let summary=payload.summary.trim().to_string(); let body=payload.body.trim().to_string();
    if title.len()<10||title.len()>MAX_TITLE_LEN||summary.len()<20||summary.len()>MAX_SUMMARY_LEN||body.len()<120||body.len()>MAX_BODY_LEN {return error(StatusCode::BAD_REQUEST,"invalid article fields").into_response();}
    let category=match normalize_category(payload.category){Ok(v)=>v,Err(m)=>return error(StatusCode::BAD_REQUEST,m).into_response()};
    let language=match normalize_language(payload.language){Ok(v)=>v,Err(m)=>return error(StatusCode::BAD_REQUEST,m).into_response()};
    let topics=match normalize_topics(payload.topics){Ok(v)=>v,Err(m)=>return error(StatusCode::BAD_REQUEST,m).into_response()};
    let publication_mode=clean(payload.publication_mode).unwrap_or_else(||"review".to_string()).to_lowercase();
    if publication_mode!="review"&&publication_mode!="instant" {return error(StatusCode::BAD_REQUEST,"publication_mode must be review or instant").into_response();}
    let author_name=clean(payload.author_name).unwrap_or_else(||"Lajukan Community".to_string()).chars().take(MAX_AUTHOR_LEN).collect::<String>();
    let rich_body=sanitize_rich_body(payload.rich_body.as_deref().unwrap_or(&format!("<p>{}</p>",body)));
    let is_instant=publication_mode=="instant"; let next_status=if is_instant{"published"}else{"pending_review"}; let content_status=if is_instant{"active"}else{"draft"};
    let meta=metadata_blog(&category,&language,&topics,&author_name,&rich_body,&publication_mode,next_status);
    let mut tags=vec!["blog".to_string(),category.to_lowercase()]; tags.extend(topics.iter().cloned());
    let slug=match unique_slug(&state.db,&title).await {Ok(v)=>v,Err(_)=>current.slug.clone().unwrap_or_else(||slug_base(&title))};
    let updated=sqlx::query_as::<_,BlogRow>("UPDATE content_items SET slug=$2,title=$3,summary=$4,body=$5,tags=$6,cover_image=$7,metadata=$8,content_status=$9,listing_status=$9,published_at=CASE WHEN $9='active' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$1 RETURNING id,owner_id,slug,title,summary,body,tags,cover_image,metadata,content_status,published_at,created_at,updated_at")
        .bind(content_id).bind(slug).bind(title).bind(summary).bind(body).bind(tags).bind(clean(payload.cover_image)).bind(meta).bind(content_status).fetch_one(&state.db).await;
    match updated {
        Ok(updated)=>{let _=sqlx::query("INSERT INTO blog_editorial_events(content_id,actor_id,actor_role,action,from_status,to_status) VALUES($1,$2,'contributor','resubmit',$3,$4)").bind(content_id).bind(owner_id).bind(editorial_status(&current)).bind(next_status).execute(&state.db).await;(StatusCode::OK,Json(updated)).into_response()},
        Err(e)=>{tracing::error!("blog update error: {:?}",e);error(StatusCode::INTERNAL_SERVER_ERROR,"failed to update article").into_response()}
    }
}

async fn editorial_queue(State(state): State<Arc<AppState>>, headers: HeaderMap, Query(query): Query<std::collections::HashMap<String,String>>) -> impl IntoResponse {
    let claims=match auth_claims_from_headers(&headers,&state.jwt_secret){Some(v) if has_cms_access(&v)=>v,_=>return error(StatusCode::FORBIDDEN,"cms access required").into_response()};
    let _=claims;
    let requested_status=query.get("status").cloned().unwrap_or_else(||"pending_review".to_string());
    let valid=["pending_review","needs_revision","published","rejected","retracted","all"];
    if !valid.contains(&requested_status.as_str()){return error(StatusCode::BAD_REQUEST,"invalid editorial status").into_response();}
    let items=sqlx::query_as::<_,BlogRow>("SELECT id,owner_id,slug,title,summary,body,tags,cover_image,metadata,content_status,published_at,created_at,updated_at FROM content_items WHERE content_type='article' AND content_status<>'deleted' AND ($1='all' OR COALESCE(metadata->'blog'->>'editorial_status',CASE WHEN content_status='active' THEN 'published' ELSE 'draft' END)=$1) ORDER BY updated_at DESC,id DESC LIMIT 200")
        .bind(&requested_status).fetch_all(&state.db).await;
    match items {Ok(items)=>(StatusCode::OK,Json(EditorialResponse{items})).into_response(),Err(e)=>{tracing::error!("blog editorial queue error: {:?}",e);error(StatusCode::INTERNAL_SERVER_ERROR,"failed to load editorial queue").into_response()}}
}

async fn moderate(State(state): State<Arc<AppState>>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<EditorialPayload>) -> impl IntoResponse {
    let claims=match auth_claims_from_headers(&headers,&state.jwt_secret){Some(v) if has_cms_access(&v)=>v,_=>return error(StatusCode::FORBIDDEN,"cms access required").into_response()};
    let reviewer_id=Uuid::parse_str(&claims.sub).unwrap_or(Uuid::nil());
    let content_id=match Uuid::parse_str(id.trim()){Ok(v)=>v,Err(_)=>return error(StatusCode::BAD_REQUEST,"invalid article id").into_response()};
    let current=match sqlx::query_as::<_,BlogRow>("SELECT id,owner_id,slug,title,summary,body,tags,cover_image,metadata,content_status,published_at,created_at,updated_at FROM content_items WHERE id=$1 AND content_type='article' LIMIT 1").bind(content_id).fetch_optional(&state.db).await {
        Ok(Some(v))=>v,Ok(None)=>return error(StatusCode::NOT_FOUND,"article not found").into_response(),Err(_)=>return error(StatusCode::INTERNAL_SERVER_ERROR,"failed to load article").into_response()
    };
    let action=payload.action.trim().to_lowercase();
    let current_status=editorial_status(&current);
    let (next_status,content_status)=match action.as_str(){ "approve"|"correct"=>("published","active"),"needs_revision"=>("needs_revision","draft"),"reject"=>("rejected","archived"),"retract"=>("retracted","archived"), _=>return error(StatusCode::BAD_REQUEST,"unsupported editorial action").into_response() };
    if action!="approve"&&action!="correct"&&payload.note.as_deref().unwrap_or("").trim().is_empty(){return error(StatusCode::BAD_REQUEST,"note is required").into_response();}
    let mut metadata=current.metadata.clone(); if !metadata.is_object(){metadata=json!({});}
    let blog=metadata.as_object_mut().unwrap().entry("blog").or_insert_with(||json!({})); if !blog.is_object(){*blog=json!({});}
    let blog=blog.as_object_mut().unwrap(); blog.insert("editorial_status".into(),Value::String(next_status.into())); blog.insert("is_indexable".into(),Value::Bool(next_status=="published")); blog.insert("updated_at".into(),Value::String(Utc::now().to_rfc3339()));
    if let Some(note)=payload.note.as_deref().map(str::trim).filter(|v|!v.is_empty()){blog.insert("editor_note".into(),Value::String(note.into()));}
    let published_at=if next_status=="published"{Some(Utc::now())}else{None};
    let updated=sqlx::query_as::<_,BlogRow>("UPDATE content_items SET metadata=$2,content_status=$3,listing_status=$3,published_at=$4,updated_at=NOW() WHERE id=$1 RETURNING id,owner_id,slug,title,summary,body,tags,cover_image,metadata,content_status,published_at,created_at,updated_at")
        .bind(content_id).bind(metadata).bind(content_status).bind(published_at).fetch_one(&state.db).await;
    match updated {
        Ok(updated)=>{let _=sqlx::query("INSERT INTO blog_editorial_events(content_id,actor_id,actor_role,action,from_status,to_status,note) VALUES($1,$2,'editor',$3,$4,$5,$6)").bind(content_id).bind(reviewer_id).bind(&action).bind(current_status).bind(next_status).bind(payload.note).execute(&state.db).await;(StatusCode::OK,Json(updated)).into_response()},
        Err(e)=>{tracing::error!("blog moderation error: {:?}",e);error(StatusCode::INTERNAL_SERVER_ERROR,"failed to moderate article").into_response()}
    }
}

async fn history(State(state): State<Arc<AppState>>, headers: HeaderMap, Path(id): Path<String>) -> impl IntoResponse {
    let claims=match auth_claims_from_headers(&headers,&state.jwt_secret){Some(v) if has_cms_access(&v)=>v,_=>return error(StatusCode::FORBIDDEN,"cms access required").into_response()};
    let _=claims;
    let content_id=match Uuid::parse_str(id.trim()){Ok(v)=>v,Err(_)=>return error(StatusCode::BAD_REQUEST,"invalid article id").into_response()};
    let rows=sqlx::query("SELECT id,actor_id,actor_role,action,from_status,to_status,note,created_at FROM blog_editorial_events WHERE content_id=$1 ORDER BY created_at DESC LIMIT 100").bind(content_id).fetch_all(&state.db).await;
    match rows {
        Ok(rows)=>{let items=rows.into_iter().map(|row|json!({"id":row.get::<Uuid,_>("id"),"actor_id":row.get::<Uuid,_>("actor_id"),"actor_role":row.get::<String,_>("actor_role"),"action":row.get::<String,_>("action"),"from_status":row.get::<Option<String>,_>("from_status"),"to_status":row.get::<String,_>("to_status"),"note":row.get::<Option<String>,_>("note"),"created_at":row.get::<DateTime<Utc>,_>("created_at")})).collect::<Vec<_>>();(StatusCode::OK,Json(json!({"items":items}))).into_response()},
        Err(e)=>{tracing::error!("blog history error: {:?}",e);error(StatusCode::INTERNAL_SERVER_ERROR,"failed to load blog history").into_response()}
    }
}

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/v1/blog", get(list_blog).post(create_submission))
        .route("/v1/blog/submissions/mine", get(list_my_submissions))
        .route("/v1/blog/submissions/{id}", patch(update_submission))
        .route("/v1/blog/editorial/queue", get(editorial_queue))
        .route("/v1/blog/{id}/editorial", get(history).patch(moderate))
        .route("/v1/blog/{slug}", get(get_blog))
}
