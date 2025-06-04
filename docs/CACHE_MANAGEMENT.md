# Cache Management Guide

This guide helps prevent and resolve Next.js webpack cache corruption issues that can cause module loading errors and development server problems.

## 🚨 Symptoms of Cache Corruption

If you see any of these errors, your cache is likely corrupted:

```
Cannot find module './447.js'
Cannot find module './548.js'
Missing required error components, refreshing...
GET /_next/static/chunks/app/page.js 500
```

## 🛠️ Quick Fix Commands

### Immediate Solutions

```bash
# Quick cache clean and restart
npm run reset

# Clean cache and start development server
npm run dev:clean

# Safe development start (checks cache first)
npm run dev:safe
```

### Manual Steps (if scripts fail)

```bash
# 1. Kill all Next.js processes
pkill -f "next dev"

# 2. Remove all cache directories
rm -rf .next node_modules/.cache

# 3. Clean npm cache
npm cache clean --force

# 4. Rebuild and restart
npm run build
npm run dev
```

## 🔧 Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Standard development server |
| `npm run dev:clean` | Clean cache then start dev server |
| `npm run dev:safe` | Check cache health then start dev server |
| `npm run clean` | Remove Next.js and Node.js caches |
| `npm run clean:full` | Full cleanup including node_modules |
| `npm run reset` | Emergency reset (kill processes + clean + build) |
| `npm run cache:check` | Check cache health |
| `npm run cache:clean` | Clean all caches |
| `npm run cache:monitor` | Monitor cache continuously |

## 🔍 Cache Monitoring

### Automatic Monitoring

Start the cache monitor to automatically detect and clean corrupted caches:

```bash
npm run cache:monitor
```

The monitor will automatically clean cache if:
- Cache size exceeds 500 MB
- Cache is older than 7 days
- Suspicious webpack files are detected

### Manual Health Check

```bash
npm run cache:check
```

This will show:
- Current cache size
- Cache age
- Health status

## 🛡️ Prevention Strategies

### 1. Use Safe Development Commands

```bash
# Instead of: npm run dev
# Use: npm run dev:safe
npm run dev:safe
```

### 2. Regular Cache Maintenance

```bash
# Weekly cache cleanup
npm run clean

# Monthly full cleanup
npm run clean:full
```

### 3. Configuration Improvements

The project now includes enhanced Next.js configuration that:
- Uses more conservative caching in development
- Reduces memory pressure with smaller chunks
- Implements better cache invalidation

### 4. Best Practices

- **Restart development server regularly** (every few hours of active development)
- **Don't run multiple dev servers** simultaneously
- **Use `npm run reset`** if you encounter any strange behavior
- **Monitor cache size** with `npm run cache:check`

## 🔧 Troubleshooting

### Problem: Module not found errors persist

**Solution:**
```bash
npm run clean:full
```

### Problem: Development server won't start

**Solution:**
```bash
npm run reset
```

### Problem: Browser shows "Missing required error components"

**Solution:**
```bash
# 1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
# 2. If that doesn't work:
npm run dev:clean
```

### Problem: Build succeeds but dev server fails

**Solution:**
```bash
# Check for port conflicts
lsof -i :3000
# Kill conflicting processes
npm run reset
```

## ⚙️ Advanced Configuration

### Cache Monitor Settings

Edit `scripts/cache-monitor.js` to adjust:

```javascript
const MAX_CACHE_SIZE_MB = 500;  // Max cache size before cleanup
const MAX_CACHE_AGE_DAYS = 7;   // Max cache age before cleanup
```

### Next.js Cache Settings

The configuration in `next.config.ts` includes:

- **Filesystem caching** with proper invalidation
- **Smaller chunk sizes** to reduce memory pressure
- **Development-specific optimizations**

## 📊 Monitoring Dashboard

For continuous monitoring, you can run:

```bash
npm run cache:monitor
```

This will:
- Check cache health every 5 minutes
- Automatically clean when thresholds are exceeded
- Log all activities for debugging

## 🆘 Emergency Recovery

If everything breaks:

```bash
# Nuclear option - complete reset
rm -rf .next node_modules package-lock.json
npm install
npm run build
npm run dev
```

## 📝 Contributing

If you encounter new cache corruption patterns:

1. Document the error messages
2. Note what you were doing when it occurred
3. Test the recovery scripts
4. Update this documentation if needed

---

**Remember:** When in doubt, `npm run reset` is your friend! 🚀 