import { http, HttpResponse } from 'msw';

const apiError = (message: string, status = 400) =>
  HttpResponse.json({ error: message }, { status });

export const storybookDefaultHandlers = [
  http.post(/\/api\/users$/, async ({ request }) => {
    const body = (await request.json()) as { username?: string; full_name?: string; role_id?: number };
    if (!body.username || !body.full_name || !body.role_id) {
      return apiError('username, full_name, and role_id are required');
    }

    return HttpResponse.json(
      {
        id: 999,
        username: body.username,
        full_name: body.full_name,
        role_id: body.role_id,
        created_at: '2026-03-05T10:00:00Z',
      },
      { status: 201 }
    );
  }),

  http.put(/\/api\/users\/\d+$/, () => new HttpResponse(null, { status: 204 })),
  http.delete(/\/api\/users\/\d+$/, () => new HttpResponse(null, { status: 204 })),
  http.post(/\/api\/users\/\d+\/block$/, () => new HttpResponse(null, { status: 204 })),
  http.post(/\/api\/users\/\d+\/unblock$/, () => new HttpResponse(null, { status: 204 })),
];
