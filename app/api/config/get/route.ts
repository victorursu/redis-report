import { NextResponse } from "next/server";

export async function GET() {
  // Return sanitized config (no passwords in plain text, but show if set)
  // Include all config options so users can see what's available
  const config: Record<string, string> = {};

  // Redis config - always include all options
  config.REDIS_URL = process.env.REDIS_URL || '';
  config.REDIS_HOST = process.env.REDIS_HOST || '';
  config.REDIS_PORT = process.env.REDIS_PORT || '';
  config.REDIS_PASSWORD = process.env.REDIS_PASSWORD ? '***' : ''; // Mask password if set
  config.REDIS_USERNAME = process.env.REDIS_USERNAME || '';
  config.REDIS_TLS = process.env.REDIS_TLS || '';
  config.REDIS_CLUSTER = process.env.REDIS_CLUSTER || '';

  // Drupal config
  config.DRUPAL_REDIS_PREFIX = process.env.DRUPAL_REDIS_PREFIX || '';
  config.DRUPAL_SCAN_LIMIT = process.env.DRUPAL_SCAN_LIMIT || '';
  config.DRUPAL_TOP_LIMIT = process.env.DRUPAL_TOP_LIMIT || '';

  // Top keys config
  config.TOP_KEYS_SAMPLE_COUNT = process.env.TOP_KEYS_SAMPLE_COUNT || '';
  config.TOP_KEYS_LIMIT = process.env.TOP_KEYS_LIMIT || '';

  return NextResponse.json({ ok: true, config });
}

