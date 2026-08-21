type PlaidEnvironment = 'sandbox' | 'development' | 'production';

function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is not set.`);
  }

  return value;
}

export function getPlaidBaseUrl() {
  const environment = (Deno.env.get('PLAID_ENV') ?? 'sandbox') as PlaidEnvironment;

  switch (environment) {
    case 'development':
      return 'https://development.plaid.com';
    case 'production':
      return 'https://production.plaid.com';
    default:
      return 'https://sandbox.plaid.com';
  }
}

export async function plaidRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getPlaidBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PLAID-CLIENT-ID': requireEnv('PLAID_CLIENT_ID'),
      'PLAID-SECRET': requireEnv('PLAID_SECRET'),
      'Plaid-Version': Deno.env.get('PLAID_VERSION') ?? '2020-09-14',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Plaid request failed for ${path}: ${errorBody}`);
  }

  return (await response.json()) as T;
}
