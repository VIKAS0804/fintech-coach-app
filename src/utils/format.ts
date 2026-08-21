export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function truncateToken(token: string) {
  if (token.length <= 20) {
    return token;
  }

  return `${token.slice(0, 12)}...${token.slice(-4)}`;
}
