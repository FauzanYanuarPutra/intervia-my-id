#!/bin/sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Checking environment configuration..."

# Function to check if a variable is set
check_var() {
    local var_name=$1
    local var_value=${!var_name}
    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ $var_name is not set${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $var_name is set${NC}"
        return 0
    }
}

# Function to check service connectivity
check_service() {
    local service=$1
    local host=$2
    local port=$3
    
    echo -e "\n${YELLOW}Checking $service connectivity...${NC}"
    if nc -z $host $port; then
        echo -e "${GREEN}✓ $service is reachable at $host:$port${NC}"
        return 0
    else
        echo -e "${RED}❌ Cannot connect to $service at $host:$port${NC}"
        return 1
    }
}

# Check required environment variables
required_vars=(
    "JWT_SECRET"
    "REDIS_PASSWORD"
    "POSTGRES_PASSWORD"
    "SMTP_USER"
    "SMTP_PASS"
    "GA_ID"
)

errors=0

echo -e "\n${YELLOW}Checking environment variables:${NC}"
for var in "${required_vars[@]}"; do
    check_var $var || ((errors++))
done

# Check service connectivity
if [ "$NODE_ENV" = "production" ]; then
    services=(
        "PostgreSQL|postgres_db|5432"
        "Redis|redis_cache|6379"
        "RabbitMQ|rabbitmq|5672"
    )
    
    for service in "${services[@]}"; do
        IFS="|" read -r name host port <<< "$service"
        check_service "$name" "$host" "$port" || ((errors++))
    done
fi

# Check SSL certificates
if [ "$NODE_ENV" = "production" ]; then
    echo -e "\n${YELLOW}Checking SSL certificates...${NC}"
    domains=("www.lajukan.com" "auth.lajukan.com")
    for domain in "${domains[@]}"; do
        if openssl s_client -connect $domain:443 -servername $domain </dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
            echo -e "${GREEN}✓ Valid SSL certificate found for $domain${NC}"
        else
            echo -e "${RED}❌ Invalid or missing SSL certificate for $domain${NC}"
            ((errors++))
        fi
    done
fi

echo -e "\n${YELLOW}Environment check completed with $errors errors${NC}"
exit $errors