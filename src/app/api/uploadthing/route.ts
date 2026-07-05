import { createRouteHandler } from 'uploadthing/server'

import { uploadRouter } from './core'

const handleUploadthingRequest = createRouteHandler({
  router: uploadRouter,
})

export async function GET(request: Request): Promise<Response> {
  return handleUploadthingRequest(request)
}

export async function POST(request: Request): Promise<Response> {
  return handleUploadthingRequest(request)
}
