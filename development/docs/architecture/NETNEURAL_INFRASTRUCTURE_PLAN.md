# NetNeural Supabase Infrastructure Setup

## 🏗️ Three-Environment Strategy

### 1. **Local Development** (Your Windows machine)
- Full Supabase stack running locally
- Hot reload for development
- Local database with seed data

### 2. **Unraid Testing** (192.168.1.45)
- Production-like Supabase environment
- Dedicated NetNeural ports (no conflict with SynapticDrift)
- External validation and testing

### 3. **Production** (Future cloud deployment)
- Managed Supabase or self-hosted production instance
- CI/CD pipeline ready

## 📊 Port Allocation Strategy

### SynapticDrift (Existing):
- Web: 3000, API Gateway: 8181/8443, Auth: 9999, Database: 5432, Redis: 6379
- Traefik: 9090, Storage: Various, Kong: 8000-8001

### NetNeural (New Dedicated Ports):
- **Web App**: 4000
- **Supabase Studio**: 4001  
- **Database (PostgreSQL)**: 4432
- **Auth (GoTrue)**: 4433
- **API (PostgREST)**: 4434
- **Realtime**: 4435
- **Storage API**: 4436
- **Edge Functions**: 4437
- **Redis**: 4379
- **Traefik Dashboard**: 4080

## 🎯 Benefits of This Approach

✅ **Isolated Development**: No conflicts with existing infrastructure  
✅ **Consistent Environments**: Same stack local → testing → production  
✅ **Rapid Iteration**: Develop locally, validate on Unraid, deploy to production  
✅ **Full Supabase Features**: Auth, Database, Storage, Realtime, Edge Functions  
✅ **Scalable Architecture**: Ready for production scaling  

## 🚀 Next Steps

1. **Create Local Development Stack** (docker-compose.local.yml)
2. **Create Unraid Testing Stack** (docker-compose.unraid.yml) 
3. **Set up database migrations and seed data**
4. **Configure environment variables for each stage**
5. **Create deployment scripts**

Ready to build the complete NetNeural Supabase infrastructure! 🔥
