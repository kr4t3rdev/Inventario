import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const BANNED_VOSEO_WORDS = [
  'vos',
  'sos',
  'tenés',
  'querés',
  'podés',
  'hacé',
  'probá',
  'elegí',
  'compartí',
  'olvidate',
  'iniciá',
  'registrate',
  'enviá',
  'restablecé',
  'ignorá',
  'guardá',
  'intentá',
  'verificá',
] as const

function containsWholeWord(source: string, word: string): boolean {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapedWord}(?![\\p{L}\\p{N}_])`,
    'iu',
  ).test(source)
}

const FILES = [
  'src/app/login/page.tsx',
  'src/app/forgot-password/page.tsx',
  'src/app/reset-password/page.tsx',
  'src/features/auth/actions-password-reset.ts',
  'src/features/auth/services/password-reset-service.ts',
] as const

describe('auth password reset neutral Spanish copy', () => {
  it('uses neutral Spanish (no voseo) in password reset UI and actions', () => {
    const findings = FILES.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return BANNED_VOSEO_WORDS.flatMap((word) =>
        containsWholeWord(source, word) ? [`${file}: ${word}`] : [],
      )
    })

    expect(findings).toEqual([])
  })
})
