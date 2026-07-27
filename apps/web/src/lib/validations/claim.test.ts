import { describe, it, expect } from 'vitest'
import { validateClaim, type ClaimForm } from './claim'

const valido: ClaimForm = {
  nombre: 'María González',
  email: 'maria@mail.com',
  telefono: '3329 42-1234',
  acceptedTc: true,
}

describe('validateClaim — alta del vecino', () => {
  it('acepta un formulario válido', () => {
    expect(validateClaim(valido)).toEqual({})
  })

  it('exige el nombre', () => {
    expect(validateClaim({ ...valido, nombre: 'A' }).nombre).toBeTruthy()
  })

  it('exige un email con forma de email', () => {
    expect(validateClaim({ ...valido, email: '' }).email).toBeTruthy()
    expect(validateClaim({ ...valido, email: 'maria' }).email).toBeTruthy()
    expect(validateClaim({ ...valido, email: 'maria@mail' }).email).toBeTruthy()
  })

  it('acepta el email con espacios o mayúsculas (se limpia después)', () => {
    expect(validateClaim({ ...valido, email: '  MARIA@Mail.com ' }).email).toBeUndefined()
  })

  it('exige el celular con código de área', () => {
    expect(validateClaim({ ...valido, telefono: '421234' }).telefono).toBeTruthy()
  })

  it('exige aceptar los términos', () => {
    expect(validateClaim({ ...valido, acceptedTc: false }).acceptedTc).toBeTruthy()
  })
})
