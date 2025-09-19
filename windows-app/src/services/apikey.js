// 取得授權標頭：
// - 若設了 VITE_TOKEN_ENDPOINT（Realtime 專用）可改為取 session token。
// - 目前本專案主要分兩路：
//   1) 有 VITE_TRANSCRIBE_URL（推薦）：呼叫你的代理，不帶 Authorization。
//   2) 無代理（開發用）：使用者貼 API Key，直連 OpenAI。
export async function getAuthHeader(userKey) {
  const tokenEndpoint = import.meta.env.VITE_TOKEN_ENDPOINT
  if (tokenEndpoint) {
    const r = await fetch(tokenEndpoint, { credentials: 'include' })
    if (!r.ok) throw new Error('Failed to fetch ephemeral token')
    const { token } = await r.json()
    return `Bearer ${token}`
  }
  if (!userKey) throw new Error('No token endpoint and no user key provided')
  return `Bearer ${userKey.trim()}`
}
