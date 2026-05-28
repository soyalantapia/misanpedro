/**
 * Heurística simple de fortaleza de contraseña (0-4).
 * 0=vacía, 1=muy débil, 2=débil, 3=ok, 4=fuerte.
 *
 * Sin librería externa para no inflar el bundle (zxcvbn pesa 800KB).
 * Esto es un indicador visual — la validación de mínimo 8 chars sigue siendo
 * la regla de aceptación.
 */

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  hint: string | null
}

export function evaluatePassword(pwd: string): PasswordStrength {
  if (pwd.length === 0) return { score: 0, label: '', hint: null }
  if (pwd.length < 6) return { score: 1, label: 'Muy débil', hint: 'Mínimo 8 caracteres' }

  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++

  // Penalty: solo dígitos o solo letras
  if (/^\d+$/.test(pwd) || /^[a-zA-Z]+$/.test(pwd)) score = Math.max(1, score - 1)
  // Penalty: secuencias comunes
  if (/^(12345|abcde|qwerty|password)/i.test(pwd)) score = 1

  const clamped = Math.min(4, Math.max(1, score)) as 1 | 2 | 3 | 4
  const labels = ['', 'Muy débil', 'Débil', 'OK', 'Fuerte'] as const
  const hint =
    clamped < 3
      ? 'Sumá mayúsculas, números o símbolos para hacerla más fuerte'
      : null

  return { score: clamped, label: labels[clamped], hint }
}
