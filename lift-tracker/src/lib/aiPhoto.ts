// Photo-based meal estimation via the Anthropic API, called directly from the
// browser with the user's own on-device key. This is a convenience layer only —
// estimates are always shown for confirmation/correction before logging, never
// treated as authoritative. Mirrors the approach used in the Project Ascend app.

export interface PhotoEstimate {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: string
  notes: string
}

export const DEFAULT_MODEL = 'claude-sonnet-5'

/** Downscale an image file and return base64-encoded JPEG (no data: prefix). */
export function fileToBase64Jpeg(file: File, maxDim = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const cv = document.createElement('canvas')
        cv.width = w
        cv.height = h
        cv.getContext('2d')!.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(cv.toDataURL('image/jpeg', quality).split(',')[1])
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Couldn’t read that image'))
    }
    img.src = url
  })
}

const PHOTO_PROMPT = `You are a nutrition estimation assistant. Analyze the meal in this photo and estimate its nutrition for the full portion shown. Respond with ONLY a JSON object and nothing else, in exactly this shape:
{"description":"short name of the meal, e.g. Grilled chicken salad with avocado","calories":<number>,"protein_g":<number>,"carbs_g":<number>,"fat_g":<number>,"confidence":"low|medium|high","notes":"one short caveat, or empty string"}`

function parseEstimate(text: string): PhotoEstimate {
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Couldn’t read the analysis — try again')
    obj = JSON.parse(m[0])
  }
  const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0))
  return {
    name: String(obj.description || 'Meal'),
    calories: n(obj.calories),
    protein: n(obj.protein_g),
    carbs: n(obj.carbs_g),
    fat: n(obj.fat_g),
    confidence: String(obj.confidence || 'medium'),
    notes: String(obj.notes || ''),
  }
}

export async function analyzeMealPhoto(
  base64Jpeg: string,
  apiKey: string,
  model = DEFAULT_MODEL,
): Promise<PhotoEstimate> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg } },
            { type: 'text', text: PHOTO_PROMPT },
          ],
        },
      ],
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  if (data?.stop_reason === 'refusal') throw new Error('The model declined this request.')
  const text = (data?.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
  return parseEstimate(text)
}
