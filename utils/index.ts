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

// Thanks to clyzermk1 https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
function djb2(str: string) {
  var hash = 5381
  for (var i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i) /* hash * 33 + c */
  }
  return hash
}

export function hashStringToColor(str: string) {
  var hash = djb2(str)
  var r = (hash & 0xff0000) >> 16
  var g = (hash & 0x00ff00) >> 8
  var b = hash & 0x0000ff
  const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const secColor = brightness > 128 ? '#333' : 'white'
  return {
    primary: 'rgb(' + r + ',' + g + ',' + b + ')',
    secondary: secColor,
  }
}
