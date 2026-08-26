import { describe, it, expect } from 'vitest';
import {
  createPlanPurchaseDraft,
  createClassPaymentDraft,
} from './payment';
import { InvalidPaymentError } from '../errors';

describe('createPlanPurchaseDraft', () => {
  const ok = { planId: '7', paymentMethodId: '2', amount: '96000' };

  it('devuelve el draft con el monto normalizado', () => {
    expect(createPlanPurchaseDraft({ ...ok, amount: '  96000,50 ' })).toEqual({
      planId: '7',
      paymentMethodId: '2',
      amount: '96000.50',
    });
  });

  it('exige el plan', () => {
    expect(() => createPlanPurchaseDraft({ ...ok, planId: '' })).toThrow(InvalidPaymentError);
  });

  it('exige el medio de pago', () => {
    expect(() => createPlanPurchaseDraft({ ...ok, paymentMethodId: '' })).toThrow(InvalidPaymentError);
  });
});

describe('el monto', () => {
  const draft = (amount: string) => createClassPaymentDraft({ paymentMethodId: '2', amount });

  it('acepta cero: un plan de cortesía se registra como una compra de $0', () => {
    expect(draft('0').amount).toBe('0');
  });

  it('rechaza vacío', () => {
    expect(() => draft('   ')).toThrow(InvalidPaymentError);
  });

  it('rechaza lo que no es número: del otro lado es un new Prisma.Decimal que tira 400', () => {
    expect(() => draft('gratis')).toThrow(InvalidPaymentError);
  });

  it('rechaza negativo: una devolución no es una venta', () => {
    expect(() => draft('-100')).toThrow(InvalidPaymentError);
  });

  it('no pasa por Number: manda el texto para no perder precisión del Decimal', () => {
    expect(draft('12345678901234567.89').amount).toBe('12345678901234567.89');
  });

  /**
   * El agujero que más caro salía: la tabla muestra "$96.000" (separador de miles es-AR) y
   * `Number('96.000')` es 96. Escribir lo que se ve cobraba mil veces menos, en silencio.
   */
  it('rechaza el separador de miles en vez de cobrar mil veces menos', () => {
    expect(() => draft('96.000')).toThrow(InvalidPaymentError);
    expect(() => draft('1.234.567')).toThrow(InvalidPaymentError);
  });

  it('rechaza notación que Number acepta pero un campo de plata no', () => {
    expect(() => draft('0x1a')).toThrow(InvalidPaymentError);  // Number lo lee como 26
    expect(() => draft('1e3')).toThrow(InvalidPaymentError);   // Number lo lee como 1000
  });

  it('rechaza más de dos decimales', () => {
    expect(() => draft('10,555')).toThrow(InvalidPaymentError);
  });
});
