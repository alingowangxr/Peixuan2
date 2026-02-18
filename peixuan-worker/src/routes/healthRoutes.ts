import type { Router } from 'itty-router';

export function createHealthRoutes(router: Router) {
  // 健康檢查
  router.get('/health', () => {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  });

  // 錯誤報告端點
  router.post('/api/error-report', async (request: Request) => {
    try {
      const errorData = await request.json();
      // 記錄錯誤到控制台
      console.error('[ERROR_REPORT]', {
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent'),
        ...errorData
      });

      return new Response(JSON.stringify({
        success: true,
        message: '錯誤報告已記錄'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('[ERROR_REPORT] Failed to process error report:', error);
      return new Response(JSON.stringify({
        success: false,
        error: '無法處理錯誤報告'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });
}
