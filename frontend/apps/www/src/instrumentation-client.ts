export async function register() {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[INSTRUMENTATION] client hooks registered');
  }
}
