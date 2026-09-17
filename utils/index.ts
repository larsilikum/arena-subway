export function isSameRoute(url1: string, url2: string) {
  try {
    const u1 = new URL(url1)
    const u2 = new URL(url2)

    return (
      removeWWWSubdomain(u1.hostname) === removeWWWSubdomain(u2.hostname) &&
      u1.pathname === u2.pathname
    )
  } catch {
    return false
  }
}

function removeWWWSubdomain(domain: string) {
  return domain.replace(/^www\./, '')
}

export function convertToTime(value: number): string {
  const seconds = value % 60
  const minutes = Math.floor(value / 60)
  const secondsString = pad(seconds)
  const minutesString = pad(minutes)
  return `${minutesString}:${secondsString}`
}

function pad(n: number): string {
  if (n < 10) {
    return '0' + n.toString()
  }
  return n.toString()
}

// Source - https://stackoverflow.com/a/47480429
// Posted by Etienne Martin, modified by community. See post 'Timeline' for change history
// Retrieved 2026-09-16, License - CC BY-SA 4.0

export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))
