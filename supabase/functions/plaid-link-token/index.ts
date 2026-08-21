import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { plaidRequest } from '../_shared/plaid.ts';

interface LinkTokenResponse {
  expiration: string;
  link_token: string;
  request_id?: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, { status: 405 });
  }

  try {
    const { user } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const platform = body.platform === 'android' ? 'android' : 'ios';

    const payload = await plaidRequest<LinkTokenResponse>('/link/token/create', {
      client_name: 'Impulse Coach',
      country_codes: ['US'],
      language: 'en',
      products: ['transactions'],
      user: {
        client_user_id: user.id,
      },
      android_package_name: platform === 'android' ? 'com.vikas.impulsecoach' : undefined,
      redirect_uri: Deno.env.get('PLAID_REDIRECT_URI') ?? undefined,
    });

    return json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return json({ error: message }, { status: 400 });
  }
});
