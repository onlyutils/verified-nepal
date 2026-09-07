export function isHashOnlyNavigation(previousUrl: string, nextUrl: string): boolean {
  const previous = new URL(previousUrl, "http://localhost");
  const next = new URL(nextUrl, "http://localhost");

  return previous.pathname + previous.search === next.pathname + next.search && previous.hash !== next.hash;
}
