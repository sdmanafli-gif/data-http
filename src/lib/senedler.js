import { supabase } from './supabase'

export const SENEDLER_BUCKET = 'Mobideal'

export function parseSenedler(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((f) => f && f.path)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((f) => f && f.path) : []
    } catch {
      return []
    }
  }
  return []
}

export function senedlerPublicUrl(path) {
  if (!path) return ''
  return supabase.storage.from(SENEDLER_BUCKET).getPublicUrl(path).data.publicUrl
}

function safeFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Upload files under folder/{recordId}/...
 * @returns {{ files: Array<{name,path,size?}>, error: string|null }}
 */
export async function uploadSenedlerFiles(folder, recordId, fileList) {
  const files = Array.from(fileList || [])
  if (!files.length) return { files: [], error: null }
  if (!recordId) return { files: [], error: 'Əvvəlcə qeydi saxlayın, sonra sənəd yükləyin.' }

  const uploaded = []
  let lastError = null
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const path = `${folder}/${recordId}/${Date.now()}_${i}_${safeFileName(file.name)}`
    const { error } = await supabase.storage.from(SENEDLER_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    })
    if (error) {
      lastError = error.message
    } else {
      uploaded.push({
        name: file.name,
        path,
        size: file.size || null,
      })
    }
  }
  return {
    files: uploaded,
    error: lastError
      ? uploaded.length
        ? `Bəzi fayllar yüklənmədi: ${lastError}`
        : `Fayl yüklənmədi: ${lastError}`
      : null,
  }
}

export async function removeSenedlerFile(path) {
  if (!path) return null
  const { error } = await supabase.storage.from(SENEDLER_BUCKET).remove([path])
  return error?.message || null
}

export function formatSenedlerCount(value) {
  const n = parseSenedler(value).length
  if (!n) return '—'
  return `${n} fayl`
}
