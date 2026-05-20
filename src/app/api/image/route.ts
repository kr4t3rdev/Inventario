import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import formidable from 'formidable'
import { Readable } from 'stream'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const form = formidable()
  // Convert the NextRequest's body (ReadableStream) to a Node.js Readable stream
  const nodeReq = Object.assign(Readable.fromWeb(req.body as any), {
    headers: Object.fromEntries(req.headers.entries()),
    method: req.method,
    url: req.url,
  })

  return new Promise<NextResponse>((resolve) => {
    form.parse(nodeReq as any, (err, fields, files) => {
      if (err) {
        resolve(NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 }))
        return
      }
      const file = Array.isArray(files.avatar) ? files.avatar[0] : files.avatar
      if (!file?.filepath) {
        resolve(NextResponse.json({ error: 'No se encontró el archivo subido' }, { status: 400 }))
        return
      }
      const data = fs.readFileSync(file.filepath)
      const fileName = `${Date.now()}_${file.originalFilename}`
      const savePath = path.join(process.cwd(), 'public', 'avatars', fileName)
      fs.writeFileSync(savePath, data)
      resolve(NextResponse.json({ url: `/public/avatars/${fileName}` }))
    })
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const file = searchParams.get('file')
  if (!file) {
    return NextResponse.json({ error: 'Falta el parámetro file' }, { status: 400 })
  }
  const filePath = path.join(process.cwd(), 'public', 'avatars', file)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }
  const imageBuffer = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  let contentType = 'image/jpeg'
  if (ext === '.png') contentType = 'image/png'
  if (ext === '.webp') contentType = 'image/webp'
  if (ext === '.svg') contentType = 'image/svg+xml'
  return new NextResponse(new Uint8Array(imageBuffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${file}"`
    }
  })
}