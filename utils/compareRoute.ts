export function isSameRoute(url1: string, url2: string) {
  try {
    const u1 = new URL(url1);
    const u2 = new URL(url2);
    
    return u1.hostname === u2.hostname && u1.pathname === u2.pathname;
  } catch {
    return false;
  }
}