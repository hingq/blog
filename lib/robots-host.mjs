export function getRobotsHost(siteUrl) {
  const { hostname } = new URL(siteUrl)
  return hostname
}
