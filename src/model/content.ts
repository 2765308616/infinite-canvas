const maxImageBytes = 20 * 1024 * 1024
const allowedMime = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export async function validateImage(file: File): Promise<void> {
  if (!allowedMime.has(file.type)) throw new Error('仅支持 PNG、JPEG、WebP 或 GIF 图片')
  if (file.size === 0 || file.size > maxImageBytes) throw new Error('图片大小须在 1 字节到 20 MB 之间')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  const valid = file.type === 'image/png' ? starts(137, 80, 78, 71, 13, 10, 26, 10)
    : file.type === 'image/jpeg' ? starts(255, 216, 255)
      : file.type === 'image/gif' ? starts(71, 73, 70, 56, 55) || starts(71, 73, 70, 56, 57)
        : starts(82, 73, 70, 70) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80
  if (!valid) throw new Error('图片内容与格式不符')
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap
    try { bitmap = await createImageBitmap(file) } catch { throw new Error('图片无法解码，文件可能已损坏') }
    bitmap.close()
  }
}

export function normalizeHttpUrl(input: string): string {
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new Error('请输入完整的 HTTP 或 HTTPS 地址') }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('仅支持 HTTP 或 HTTPS 链接')
  return url.toString()
}
