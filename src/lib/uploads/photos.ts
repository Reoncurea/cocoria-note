export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

const ALLOWED_PHOTO_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

type AllowedPhotoType = keyof typeof ALLOWED_PHOTO_TYPES

export function validatePhotoFile(file: File): string | null {
  if (!Object.hasOwn(ALLOWED_PHOTO_TYPES, file.type)) {
    return 'アップロードできる写真はJPEG、PNG、WebPのみです。'
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return '写真のサイズは5MB以下にしてください。'
  }

  return null
}

export function createVisitPhotoPath(userId: string, visitId: string, file: File) {
  const extension = ALLOWED_PHOTO_TYPES[file.type as AllowedPhotoType]
  const randomId = crypto.randomUUID()
  return `${userId}/${visitId}/${randomId}.${extension}`
}

export function createPlanningPhotoPath(userId: string, sessionId: string, file: File) {
  const extension = ALLOWED_PHOTO_TYPES[file.type as AllowedPhotoType]
  const randomId = crypto.randomUUID()
  return `${userId}/${sessionId}/${randomId}.${extension}`
}
