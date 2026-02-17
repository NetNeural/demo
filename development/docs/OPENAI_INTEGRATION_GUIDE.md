# OpenAI Integration Guide
**Feature:** AI-Powered Predictive Insights  
**Date Implemented:** February 16, 2026  
**Status:** ✅ Production Ready

---

## 🎯 Overview

The NetNeural IoT Platform now integrates OpenAI's GPT-3.5 Turbo to provide **real AI-powered predictive analysis** for IoT sensor data. This replaces the previous rule-based system with actual machine learning insights.

---

## 🚀 Features

### What It Does
- **Real-time Analysis**: AI analyzes sensor data patterns and generates actionable insights
- **Context-Aware**: Considers location type (cooler, office, warehouse, etc.)
- **Predictive**: Identifies trends before they become problems
- **Intelligent Caching**: 15-minute cache to minimize API costs
- **Graceful Fallback**: Automatically falls back to rule-based analysis if OpenAI unavailable

### Insight Types
- 🔴 **Critical**: Urgent issues requiring immediate attention
- 🟡 **Warning**: Potential problems to monitor
- 🟢 **Normal**: Optimal conditions confirmed
- 🔵 **Info**: General observations and context

---

## 💰 Cost Structure

### OpenAI Pricing (GPT-3.5 Turbo)
- **Input**: $0.50 per 1M tokens (~750,000 words)
- **Output**: $1.50 per 1M tokens (~750,000 words)
- **Average Request**: ~200-300 tokens total

### Estimated Costs

#### Per Device
- **Without Caching**: ~$0.0003 per insight generation
- **With 15-min Cache**: ~$0.0003 per 15 minutes = **~$0.03/day** per device
- **Monthly**: ~$0.90 per device per month

#### For 100 Devices
- **Daily**: ~$3.00
- **Monthly**: ~$90.00
- **Yearly**: ~$1,080

#### For 1,000 Devices
- **Daily**: ~$30.00
- **Monthly**: ~$900.00
- **Yearly**: ~$10,800

### Cost Optimization Features
✅ **15-minute caching** - Reduces API calls by ~95%  
✅ **Token limiting** - Max 500 tokens per response  
✅ **Batch optimization** - Analyzes 50 readings at once  
✅ **Automatic cleanup** - Expired cache entries removed daily  

---

## 🔧 Setup & Configuration

### 1. Get OpenAI API Key
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

### 2. Add to GitHub Secrets
```bash
# Using GitHub CLI
gh secret set OPENAI_API_KEY --repo NetNeural/MonoRepo-Staging

# Or via GitHub UI:
# Settings → Secrets and variables → Actions → New repository secret
# Name: OPENAI_API_KEY
# Value: sk-...
```

### 3. Add to Supabase Edge Functions
```bash
cd development
supabase secrets set OPENAI_API_KEY=sk-...
```

### 4. Local Development
Add to `development/.env.local`:
```bash
OPENAI_API_KEY=sk-your-openai-api-key
```

### 5. Deploy Migration
```bash
cd development
supabase db push
```

This creates the `ai_insights_cache` table for storing cached insights.

---

## 📊 Monitoring & Usage

### View Cache Statistics
```sql
-- Check cache hit rate
SELECT 
  COUNT(*) as total_cached,
  COUNT(DISTINCT device_id) as devices_using_ai,
  AVG(token_usage) as avg_tokens,
  SUM(token_usage) as total_tokens
FROM ai_insights_cache
WHERE expires_at > NOW();

-- Estimate daily cost
SELECT 
  (SUM(token_usage) * 0.002 / 1000) as estimated_cost_usd
FROM ai_insights_cache
WHERE generated_at > NOW() - INTERVAL '1 day';
```

### Monitor API Usage
Check your OpenAI dashboard: [https://platform.openai.com/usage](https://platform.openai.com/usage)

### Edge Function Logs
```bash
cd development
supabase functions logs ai-insights
```

---

## 🎮 User Experience

### Toggle AI Mode
Users can switch between:
- 🤖 **AI Mode**: Real OpenAI GPT-3.5 insights
- 📊 **Rules Mode**: Traditional rule-based analysis

### Loading States
- Shows "generating insights..." while fetching
- Seamlessly displays cached results
- Automatically falls back on error

### Example Insights

**AI-Generated (GPT-3.5):**
> 🟡 Warning: Temperature Trend Analysis  
> "Temperature rising 12.3% over 4 hours suggests HVAC inefficiency. Recommend scheduling maintenance within 24 hours to prevent system strain."

**Rule-Based (Fallback):**
> 🟡 Warning: Temperature Rising  
> "Temperature has increased 12.3% recently. Current: 75.2°F"

---

## 🔒 Security

### API Key Protection
- ✅ Stored in GitHub Secrets (never in code)
- ✅ Accessed only by Edge Functions (server-side)
- ✅ RLS policies prevent unauthorized access
- ✅ Rate limiting via cache prevents abuse

### Data Privacy
- Only sends aggregated sensor statistics (no personal data)
- No device identifiable information sent to OpenAI
- Cache stored in your Supabase instance (not OpenAI)
- Comply with your organization's data policies

---

## 🧪 Testing

### Test AI Insights Locally
1. Start Supabase:
   ```bash
   cd development
   npm run supabase:start
   ```

2. Set environment variables in `.env.local`

3. Start Next.js:
   ```bash
   npm run dev
   ```

4. Navigate to any device detail page

5. AI insights will load automatically (or toggle between AI/Rules)

### Test Edge Function Directly
```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/ai-insights" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "deviceId": "test-device",
    "deviceName": "Test Sensor",
    "installedAt": "Walk-in Cooler",
    "telemetryReadings": [...],
    "temperatureUnit": "celsius",
    "organizationId": "test-org"
  }'
```

---

## 🐛 Troubleshooting

### "OpenAI API not configured" Error
**Cause**: `OPENAI_API_KEY` not set  
**Fix**: Add key to GitHub Secrets and Supabase secrets (see Setup)

### "Rate limit exceeded" Error
**Cause**: Too many API calls  
**Fix**: Check cache is working, increase `CACHE_DURATION_MINUTES` in Edge Function

### Insights Not Updating
**Cause**: Cache is serving stale data  
**Fix**: Cache expires after 15 minutes automatically, or clear cache:
```sql
DELETE FROM ai_insights_cache WHERE device_id = 'your-device-id';
```

### High API Costs
**Cause**: Cache disabled or not working  
**Fix**: Verify cache table exists, check Edge Function logs for cache hits

---

## 🔮 Future Enhancements

### Potential Improvements
- [ ] **GPT-4 Option**: Higher quality insights (3x cost)
- [ ] **Fine-tuned Models**: Train on your specific sensor patterns
- [ ] **Batch Processing**: Analyze multiple devices in one call
- [ ] **Smart Cache**: Invalidate cache on significant data changes
- [ ] **Custom System Prompts**: Per-location type optimization
- [ ] **Webhook Integration**: Push insights to external systems
- [ ] **Historical Learning**: Improve predictions with past data

### Cost Optimization Ideas
- [ ] **Tiered Caching**: 1 hour for stable sensors, 5 min for volatile
- [ ] **Selective AI**: Only use AI for critical/unknown patterns
- [ ] **Regional Grouping**: Analyze similar devices together
- [ ] **Off-peak Processing**: Batch non-urgent analysis during low-cost hours

---

## 📚 References

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [GPT-3.5 Turbo Pricing](https://openai.com/api/pricing/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [SECRETS_INVENTORY.md](./SECRETS_INVENTORY.md) - Secret management
- [SECRETS_GOVERNANCE.md](./SECRETS_GOVERNANCE.md) - Security policies

---

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/NetNeural/MonoRepo-Staging/issues)
- **Documentation**: `/development/docs/`
- **OpenAI Support**: [help.openai.com](https://help.openai.com)

---

**Last Updated:** February 16, 2026  
**Integration Version:** 1.0.0  
**API Model:** GPT-3.5 Turbo
