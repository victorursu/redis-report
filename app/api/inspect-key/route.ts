import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const type = await redis.type(key);
    let value: unknown = null;

    switch (type) {
      case 'string':
        value = await redis.get(key);
        break;
      case 'hash':
        value = await redis.hgetall(key);
        break;
      case 'list':
        value = await redis.lrange(key, 0, -1);
        break;
      case 'set':
        value = await redis.smembers(key);
        break;
      case 'zset':
        value = await redis.zrange(key, 0, -1, 'WITHSCORES');
        break;
      default:
        // type could be 'none' if key doesn't exist
        value = null;
    }

    return NextResponse.json({ key, type, value });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
