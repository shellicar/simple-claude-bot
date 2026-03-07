import { app } from '@azure/functions';

app.http('callback', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'callback/{requestId}',
  handler: async (request, context) => {
    const { handler } = await import('./handlers/callback');
    return await handler(request, context);
  },
});
