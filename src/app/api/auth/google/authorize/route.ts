import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

/**
 * @description Genera la URL de autorización de Google y redirige al usuario
 * @param {NextRequest} request - Request de Next.js
 * @returns {NextResponse} Redirección a Google OAuth
 */
export async function GET(request: NextRequest) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ]

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    })

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Error en Google authorize:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
