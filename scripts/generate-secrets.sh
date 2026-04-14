#!/bin/sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "🔐 Generating secure secrets for Lajukan..."

# Generate JWT Secret
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}Generated JWT Secret${NC}"

# Generate Redis Password
REDIS_PASSWORD=$(openssl rand -base64 24)
echo -e "${GREEN}Generated Redis Password${NC}"

# Generate PostgreSQL Password
POSTGRES_PASSWORD=$(openssl rand -base64 24)
echo -e "${GREEN}Generated PostgreSQL Password${NC}"

# Create .env file
cat > .env << EOF
# Auto-generated secrets - $(date)
# DO NOT COMMIT THIS FILE

# Domain Configuration
DOMAIN=www.lajukan.com
API_DOMAIN=auth.lajukan.com

# Security & Credentials
JWT_SECRET=$JWT_SECRET
REDIS_PASSWORD=$REDIS_PASSWORD
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# SMTP Configuration
# Get these values from: https://myaccount.google.com/apppasswords
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password

# Google Analytics
# Get this from: https://analytics.google.com
GA_ID=UA-XXXXXXXXX-X

# Environment
ENV NODE_ENV=development
RUST_LOG=info

# Features
ENABLE_MFA=true
ENABLE_OAUTH=true
ENABLE_EMAIL_VERIFICATION=true

# Performance
CACHE_TTL=3600
DB_POOL_SIZE=5
WORKER_THREADS=4

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
EOF

echo -e "\n${GREEN}✅ Configuration file generated at .env${NC}"
echo -e "\n⚠️  IMPORTANT NEXT STEPS:"
echo -e "1. Set up SMTP credentials:"
echo -e "   - Go to ${RED}https://myaccount.google.com/apppasswords${NC}"
echo -e "   - Generate a new app password for 'Mail'"
echo -e "   - Update SMTP_USER and SMTP_PASS in .env"
echo -e "\n2. Set up Google Analytics:"
echo -e "   - Go to ${RED}https://analytics.google.com${NC}"
echo -e "   - Create a new property"
echo -e "   - Get the Tracking ID (UA-XXXXXXXXX-X)"
echo -e "   - Update GA_ID in .env"
echo -e "\n3. Update any other configuration values as needed"
echo -e "\n4. Make sure to keep this file secure and never commit it to version control"