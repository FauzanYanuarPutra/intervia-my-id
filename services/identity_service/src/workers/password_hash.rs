// // src/workers/password_hash.rs (Worker yang diperbaiki)
// use argon2::{Argon2, password_hash::SaltString, PasswordHasher};
// use rand::rngs::OsRng;
// use sqlx::PgPool;
// use tokio::task;

// // Fungsi ini akan dipanggil dari handler API
// pub async fn hash_and_insert_user(pool: PgPool, email: String, password: String) {
//     // 1. Pindahkan Hashing (CPU-heavy) ke Blocking Thread
//     let hash_result = task::spawn_blocking(move || {
//         let salt = SaltString::generate(&mut OsRng);
//         Argon2::default()
//             .hash_password(password.as_bytes(), &salt)
//             .map(|h| h.to_string())
//     })
//     .await;

//     let hash = match hash_result {
//         Ok(Ok(h)) => h,
//         _ => {
//             eprintln!("Failed to generate password hash for {}", email);
//             return; // Keluar jika hashing gagal
//         }
//     };

//     // 2. Jalankan Insert (I/O) di Async Runtime Utama (Non-blocking)
//     let _ = sqlx::query!(
//         "INSERT INTO core.users (email, password_hash, is_active) VALUES ($1, $2, TRUE)",
//         email,
//         hash
//     )
//     .execute(&pool)
//     .await;

//     // NOTE: Karena ini di worker/thread terpisah, Anda harus menangani transaction
//     // (insert user dan profile) di sini jika perlu.
// }
