# Redis Report - Drupal Redis Monitoring Dashboard

A comprehensive Next.js dashboard for monitoring Redis performance and health, specifically designed for Drupal applications. This tool helps diagnose why Redis instances go down and provides detailed insights into cache patterns and performance bottlenecks.

## 🎯 Features

### Real-time Redis Monitoring
- **Server Information**: Version, uptime, role, client connections
- **Memory Analysis**: Usage, fragmentation, eviction monitoring
- **Performance Metrics**: Operations per second, latency tracking
- **Health Alerts**: Memory pressure, blocked clients, connection issues

### Drupal-Specific Analysis
- **Cache Bin Breakdown**: Detailed analysis of Drupal cache bins
- **Route-based Memory Usage**: Top routes consuming memory
- **Theme & Language Analysis**: Cache patterns by theme and language
- **Authentication Patterns**: Auth vs anonymous user cache distribution
- **TTL Analysis**: Time-to-live monitoring for cache entries

### Key Inspection
- **Clickable Keys**: Click any Redis key to inspect its contents
- **Cache Tag Extraction**: View and filter Drupal cache tags
- **Data Type Analysis**: String, hash, list, set, and zset support
- **Raw Data View**: Full JSON response for debugging

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Redis instance (local or remote)
- Drupal application (optional, for Drupal-specific features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/victorursu/redis-report.git
   cd redis-report
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env.local` file:
   ```env
   # Redis Connection
   REDIS_URL=redis://localhost:6379
   # OR individual settings:
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your_password
   REDIS_USERNAME=your_username
   REDIS_TLS=false
   REDIS_CLUSTER=false

   # Drupal Configuration
   DRUPAL_REDIS_PREFIX=pantheon-redis-json
   DRUPAL_SCAN_LIMIT=3000
   DRUPAL_TOP_LIMIT=25

   # Top Keys Configuration
   TOP_KEYS_SAMPLE_COUNT=2000
   TOP_KEYS_LIMIT=25
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📊 Dashboard Sections

### Main Dashboard
- **Summary Cards**: Version, uptime, clients, ops/sec, keys count
- **Memory Health**: Real-time memory usage chart with alerts
- **Keyspace Overview**: Database statistics and key distribution
- **Command Mix**: Most frequently used Redis commands
- **Top Keys**: Largest keys by memory usage (clickable for inspection)
- **Slowlog & Latency**: Performance bottleneck identification

### Drupal Cache Report
- **Cache Bins**: Breakdown by Drupal cache bin (render, dynamic_page_cache, etc.)
- **Top Routes**: Routes consuming the most memory
- **Theme Analysis**: Cache usage by theme
- **Language Distribution**: Cache patterns by content language
- **Authentication Stats**: Auth vs anonymous cache distribution

### Key Inspection
- **Data Type Detection**: Automatic Redis data type identification
- **Cache Tag Extraction**: Parse and filter Drupal cache tags
- **Raw Data View**: Complete JSON response for debugging
- **Copy to Clipboard**: Export cache tags for further analysis

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Full Redis connection URL | - |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `REDIS_PASSWORD` | Redis password | - |
| `REDIS_USERNAME` | Redis username | - |
| `REDIS_TLS` | Enable TLS | false |
| `REDIS_CLUSTER` | Enable cluster mode | false |
| `DRUPAL_REDIS_PREFIX` | Drupal Redis key prefix | pantheon-redis-json |
| `DRUPAL_SCAN_LIMIT` | Max keys to scan for Drupal analysis | 3000 |
| `DRUPAL_TOP_LIMIT` | Top routes to display | 25 |
| `TOP_KEYS_SAMPLE_COUNT` | Keys to sample for top keys analysis | 2000 |
| `TOP_KEYS_LIMIT` | Top keys to display | 25 |

### Redis Cluster Support
For Redis clusters, set `REDIS_CLUSTER=true` and provide comma-separated hosts in `REDIS_HOST`:
```env
REDIS_CLUSTER=true
REDIS_HOST=redis-node1:6379,redis-node2:6379,redis-node3:6379
```

## 🚨 Health Alerts

The dashboard automatically detects and alerts on:

- **Memory Pressure**: Evictions occurring near maxmemory limit
- **Blocked Clients**: BLPOP/FSYNC stalls
- **Connection Issues**: Rejected connections
- **High Fragmentation**: Memory fragmentation ratio > 1.8
- **Replication Lag**: Replica synchronization delays

## 🛠️ Development

### Project Structure
```
redis-report/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── config/        # Redis configuration
│   │   ├── drupal/        # Drupal cache analysis
│   │   ├── inspect-key/   # Key inspection
│   │   └── metrics/       # Redis metrics
│   ├── inspect-key/       # Key inspection page
│   └── page.tsx           # Main dashboard
├── components/            # React components
│   ├── DrupalStats.tsx    # Drupal cache analysis
│   └── RedisConfigSummary.tsx
└── lib/                   # Utilities
    └── redis.ts           # Redis client configuration
```

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Redis client powered by [ioredis](https://github.com/luin/ioredis)
- Charts rendered with [Recharts](https://recharts.org/)
- Data fetching with [SWR](https://swr.vercel.app/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

**Made with ❤️ for the Drupal and Redis communities**
