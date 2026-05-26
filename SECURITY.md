# Security

Report security issues to security@lajukan.com.

Public security metadata is published at:
- https://www.lajukan.com/.well-known/security.txt
- https://usaha.lajukan.com/.well-known/security.txt

## Cloudflare Production Checklist

- Set SSL/TLS encryption mode to Full (strict) for all proxied hostnames.
- Enable Always Use HTTPS for `www.lajukan.com`, `usaha.lajukan.com`, and `chat.lajukan.com`.
- Enable HSTS only after every public subdomain is confirmed HTTPS-ready.
- Enable Bot Fight Mode or the preferred Cloudflare bot protection mode for the zone.
- Review AI crawler controls and AI Labyrinth based on the crawl policy you want.
- Re-run Cloudflare Security Center scans after DNS, SSL, and rule changes have propagated.

