#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 KalzTunz Deployment Script${NC}"

# ==================== PRE-CHECKS ====================
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found${NC}"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"

# ==================== ENVIRONMENT SETUP ====================
echo -e "${YELLOW}Setting up environment...${NC}"

if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env with your configuration${NC}"
    exit 1
fi

# ==================== DATABASE SETUP ====================
echo -e "${YELLOW}Setting up database...${NC}"

docker-compose exec -T postgres psql -U kalztunz_user -d kalztunz -c "
    CREATE EXTENSION IF NOT EXISTS uuid-ossp;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
" 2>/dev/null || echo "Extensions already exist"

# ==================== MIGRATIONS ====================
echo -e "${YELLOW}Running migrations...${NC}"

docker-compose exec -T backend alembic upgrade head

# ==================== BUILD & START ====================
echo -e "${YELLOW}Building and starting services...${NC}"

docker-compose build
docker-compose up -d

# ==================== HEALTH CHECKS ====================
echo -e "${YELLOW}Running health checks...${NC}"

sleep 5

# Check backend
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend healthy${NC}"
else
    echo -e "${RED}❌ Backend not responding${NC}"
    exit 1
fi

# Check database
if docker-compose exec -T postgres pg_isready -U kalztunz_user > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database healthy${NC}"
else
    echo -e "${RED}❌ Database not responding${NC}"
    exit 1
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis healthy${NC}"
else
    echo -e "${RED}❌ Redis not responding${NC}"
    exit 1
fi

# ==================== FINAL SETUP ====================
echo -e "${YELLOW}Finalizing setup...${NC}"

# Create admin user if needed
docker-compose exec -T backend python -c "
import sys
sys.path.insert(0, '.')
from backend.database import SessionLocal
from backend.models import User
db = SessionLocal()
if not db.query(User).filter_by(username='admin').first():
    from backend.auth import hash_password
    admin = User(
        username='admin',
        email='admin@kalztunz.com',
        hashed_password=hash_password('ChangeMe123!'),
        is_active=True,
        verified=True
    )
    db.add(admin)
    db.commit()
    print('Admin user created')
else:
    print('Admin user already exists')
"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${YELLOW}Services:${NC}"
echo "  - Backend:      http://localhost:8000"
echo "  - Frontend:     http://localhost:80"
echo "  - API Docs:     http://localhost:8000/docs"
echo "  - RQ Dashboard: http://localhost:9181"
echo "  - Grafana:      http://localhost:3001"
echo "  - Prometheus:   http://localhost:9090"