import type { Router } from 'itty-router';

export function createPurpleStarRoutes(router: Router) {
  // POST /api/v1/purple-star/calculate
  router.post('/api/v1/purple-star/calculate', async (req: any) => {
    try {
      const { PurpleStarController } = await import('../controllers/purpleStarController');
      const purpleStarController = new PurpleStarController();
      const input = await req.json();
      
      const result = await purpleStarController.calculate(input);
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });
}
