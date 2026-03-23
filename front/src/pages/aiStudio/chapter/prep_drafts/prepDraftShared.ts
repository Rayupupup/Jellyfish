import { StudioEntitiesApi } from '../../../../services/studioEntities'

export type PrepDraftStudioEntityType = 'actor' | 'character' | 'scene' | 'prop' | 'costume'

export type PrepDraftAssetCard = {
  id: string
  name: string
  description?: string | null
  thumbnail?: string
}

export function makePrepDraftId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/** 创建接口返回的 id 可能缺失、在 data 外层、或为异常空串 */
export function resolveCreatedEntityId(created: unknown, fallbackId: string): string {
  const pick = (obj: Record<string, unknown>): string | null => {
    const id = obj.id
    if (typeof id === 'string' && id.trim()) return id.trim()
    if (typeof id === 'number' && Number.isFinite(id)) return String(Math.trunc(id))
    return null
  }
  if (created !== null && typeof created === 'object') {
    const o = created as Record<string, unknown>
    const data = o.data
    if (data !== null && typeof data === 'object') {
      const inner = pick(data as Record<string, unknown>)
      if (inner) return inner
    }
    const top = pick(o)
    if (top) return top
  }
  return fallbackId.trim() || fallbackId
}

export async function waitUntilStudioEntityReadable(
  entityType: PrepDraftStudioEntityType,
  entityId: string,
  errorMessage: string,
): Promise<void> {
  const delaysMs = [0, 40, 80, 120, 200, 320, 500]
  let lastErr: unknown
  for (const ms of delaysMs) {
    if (ms) await new Promise((r) => setTimeout(r, ms))
    try {
      const r = await StudioEntitiesApi.get(entityType, entityId)
      const data = r.data as Record<string, unknown> | undefined | null
      if (data && typeof data.id === 'string' && data.id === entityId) return
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(errorMessage)
}
