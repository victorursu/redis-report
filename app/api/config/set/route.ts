import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = body as Record<string, string>;

    // Validate required fields
    if (!config.REDIS_URL && !config.REDIS_HOST) {
      return NextResponse.json(
        { ok: false, error: "Either REDIS_URL or REDIS_HOST must be provided" },
        { status: 400 }
      );
    }

    // Build .env.local content
    const envLines: string[] = [];
    
    // Redis config - only include if value is provided
    if (config.REDIS_URL && config.REDIS_URL.trim()) envLines.push(`REDIS_URL=${config.REDIS_URL.trim()}`);
    if (config.REDIS_HOST && config.REDIS_HOST.trim()) envLines.push(`REDIS_HOST=${config.REDIS_HOST.trim()}`);
    if (config.REDIS_PORT && config.REDIS_PORT.trim()) envLines.push(`REDIS_PORT=${config.REDIS_PORT.trim()}`);
    // Only update password if it's not the masked value
    if (config.REDIS_PASSWORD && config.REDIS_PASSWORD.trim() && config.REDIS_PASSWORD !== '***') {
      envLines.push(`REDIS_PASSWORD=${config.REDIS_PASSWORD.trim()}`);
    }
    if (config.REDIS_USERNAME && config.REDIS_USERNAME.trim()) envLines.push(`REDIS_USERNAME=${config.REDIS_USERNAME.trim()}`);
    if (config.REDIS_TLS && config.REDIS_TLS.trim()) envLines.push(`REDIS_TLS=${config.REDIS_TLS.trim()}`);
    if (config.REDIS_CLUSTER && config.REDIS_CLUSTER.trim()) envLines.push(`REDIS_CLUSTER=${config.REDIS_CLUSTER.trim()}`);

    // Drupal config
    if (config.DRUPAL_REDIS_PREFIX && config.DRUPAL_REDIS_PREFIX.trim()) envLines.push(`DRUPAL_REDIS_PREFIX=${config.DRUPAL_REDIS_PREFIX.trim()}`);
    if (config.DRUPAL_SCAN_LIMIT && config.DRUPAL_SCAN_LIMIT.trim()) envLines.push(`DRUPAL_SCAN_LIMIT=${config.DRUPAL_SCAN_LIMIT.trim()}`);
    if (config.DRUPAL_TOP_LIMIT && config.DRUPAL_TOP_LIMIT.trim()) envLines.push(`DRUPAL_TOP_LIMIT=${config.DRUPAL_TOP_LIMIT.trim()}`);

    // Top keys config
    if (config.TOP_KEYS_SAMPLE_COUNT && config.TOP_KEYS_SAMPLE_COUNT.trim()) envLines.push(`TOP_KEYS_SAMPLE_COUNT=${config.TOP_KEYS_SAMPLE_COUNT.trim()}`);
    if (config.TOP_KEYS_LIMIT && config.TOP_KEYS_LIMIT.trim()) envLines.push(`TOP_KEYS_LIMIT=${config.TOP_KEYS_LIMIT.trim()}`);

    // Write to .env.local
    const envPath = join(process.cwd(), '.env.local');
    const envContent = envLines.join('\n') + '\n';

    try {
      await writeFile(envPath, envContent, 'utf-8');
    } catch (writeError: any) {
      // If file write fails, return error but note that in production you might want to use a different storage
      return NextResponse.json(
        { 
          ok: false, 
          error: `Failed to write config file: ${writeError.message}. Note: In production, you may need to update environment variables through your hosting platform.` 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Configuration saved. Please restart the application for changes to take effect.' 
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

