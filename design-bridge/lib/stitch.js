/**
 * lib/stitch.js — Google Stitch API client
 */
export class StitchClient {
  constructor({ apiKey, projectId, mode }) {
    this.apiKey = apiKey
    this.projectId = projectId
    this.mode = mode || 'experimental'
  }

  isConfigured() {
    return !!(this.apiKey && this.projectId)
  }

  async generate(prompt, platform = 'web') {
    if (!this.isConfigured()) return null
    try {
      const res = await fetch('https://stitch.googleapis.com/v1/designs:generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'x-goog-user-project': this.projectId,
        },
        body: JSON.stringify({
          prompt,
          platform,
          mode: this.mode,
        }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }
}