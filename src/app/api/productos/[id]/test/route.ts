import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[TEST] API called')
    console.log('[TEST] Request URL:', request.url)
    console.log('[TEST] Params object:', params)
    
    // Await params for Next.js 15 compatibility
    const { id: productoId } = await params
    console.log('[TEST] Extracted product ID:', productoId)
    
    // Simple response without any database operations
    const response = {
      success: true,
      message: "Test endpoint working",
      productoId: productoId,
      timestamp: new Date().toISOString(),
      url: request.url
    }
    
    console.log('[TEST] Returning response:', response)
    
    return NextResponse.json(response, { status: 200 })
    
  } catch (error) {
    console.error("[TEST] Error:", error)
    
    return NextResponse.json(
      { 
        error: "Test endpoint error",
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}