/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable complexity */
/* eslint-disable no-unused-vars */
/* eslint-disable no-useless-escape */
// @ts-nocheck
/**
 * Peixuan Worker v1.0.1 (2025-11-30)
 * Include annual fortune calculation modules
 */
import { ChartController } from './controllers/chartController';
import { drizzle } from 'drizzle-orm/d1';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';
import { createUnifiedRoutes } from './routes/unifiedRoutes';
import { createAnalyzeRoutes } from './routes/analyzeRoutes';
import { createChartRoutes } from './routes/chartRoutes';
import { createDailyReminderRoutes } from './routes/dailyReminderRoutes';
import { createHealthRoutes } from './routes/healthRoutes';
import { createPurpleStarRoutes } from './routes/purpleStarRoutes';
import { AutoRouter } from 'itty-router';

export interface Env {
	DB: D1Database;
	CACHE?: KVNamespace;
	// Gemini API Configuration
	GEMINI_API_KEY?: string;
	// Azure OpenAI Configuration
	AZURE_OPENAI_API_KEY?: string;
	AZURE_OPENAI_ENDPOINT?: string;
	AZURE_OPENAI_DEPLOYMENT?: string;
	AZURE_OPENAI_API_VERSION?: string;
	// AI Service Configuration
	AI_PROVIDER_TIMEOUT_MS?: number;
	ENABLE_AI_FALLBACK?: boolean;
}

// 確保 anonymous 用戶存在
async function ensureAnonymousUser(db: D1Database): Promise<void> {
	const orm = drizzle(db);
	const existing = await orm.select().from(users).where(eq(users.id, 'anonymous')).get();
	
	if (!existing) {
		await orm.insert(users).values({
			id: 'anonymous',
			email: 'anonymous@peixuan.app',
			password: 'none',
			name: 'Anonymous User'
		}).run();
	}
}

async function handleAPI(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	// Register all routes with AutoRouter
	const router = AutoRouter();
	
	// Add middleware to ensure anonymous user exists
	router.all('*', async () => {
		await ensureAnonymousUser(env.DB);
	});

	createHealthRoutes(router);
	createUnifiedRoutes(router);
	createAnalyzeRoutes(router, env, ctx);
	createChartRoutes(router);
	createDailyReminderRoutes(router, env);
	createPurpleStarRoutes(router);

	// Log incoming request for debugging
	const url = new URL(request.url);
	console.log(`[handleAPI] ${request.method} ${url.pathname}`);

	return router.fetch(request, env);
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// API 路由
		if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
			try {
				return await handleAPI(request, env, ctx);
			} catch (e: any) {
				return new Response(JSON.stringify({ error: e.message || 'Internal Server Error' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// 靜態資源由 Wrangler assets 自動處理
		// 如果到達這裡，表示不是 API 路由，返回 404 或讓 assets 處理
		return new Response('Not Found', {
			status: 404,
			headers: { 'Content-Type': 'text/plain' }
		});
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		// Cleanup chart_records older than 6 months
		// Runs daily at 2:00 AM UTC
		try {
			const orm = drizzle(env.DB);
			const sixMonthsAgo = new Date();
			sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
			const cutoffDate = sixMonthsAgo.toISOString();

			// Using raw SQL since Drizzle ORM doesn't have direct support for SQLite datetime functions
			const result = await env.DB.prepare(
				`DELETE FROM chart_records WHERE created_at < datetime('now', '-6 months')`
			).run();

			console.log(`[scheduled] Cleanup completed: ${result.meta.changes} chart records deleted (older than ${cutoffDate})`);
		} catch (error: any) {
			console.error('[scheduled] Chart cleanup failed:', error.message);
		}
	},
} satisfies ExportedHandler<Env>;
