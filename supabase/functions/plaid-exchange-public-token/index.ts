import { corsHeaders, json } from '../_shared/cors.ts';
import { getServiceClient, requireUser } from '../_shared/auth.ts';
import { plaidRequest } from '../_shared/plaid.ts';

interface ExchangeTokenResponse {
  access_token: string;
  item_id: string;
  request_id?: string;
}

interface ItemResponse {
  item: {
    institution_id?: string | null;
    item_id: string;
  };
}

interface InstitutionResponse {
  institution: {
    name: string;
  };
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
    const { publicToken } = await request.json();

    if (!publicToken) {
      throw new Error('publicToken is required.');
    }

    const exchange = await plaidRequest<ExchangeTokenResponse>('/item/public_token/exchange', {
      public_token: publicToken,
    });

    const item = await plaidRequest<ItemResponse>('/item/get', {
      access_token: exchange.access_token,
    });

    let institutionName: string | null = null;

    if (item.item.institution_id) {
      const institution = await plaidRequest<InstitutionResponse>('/institutions/get_by_id', {
        institution_id: item.item.institution_id,
        country_codes: ['US'],
      });

      institutionName = institution.institution.name;
    }

    const service = getServiceClient();
    const { error } = await service.from('plaid_items').upsert(
      {
        user_id: user.id,
        plaid_item_id: exchange.item_id,
        institution_name: institutionName,
        status: 'active',
      },
      { onConflict: 'plaid_item_id' },
    );

    if (error) {
      throw error;
    }

    return json({
      item_id: exchange.item_id,
      institution_name: institutionName,
      access_token: exchange.access_token,
      request_id: exchange.request_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return json({ error: message }, { status: 400 });
  }
});
