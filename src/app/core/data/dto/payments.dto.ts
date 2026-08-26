import * as v from 'valibot';

/**
 * Write-path de las dos escrituras de plata. No hay read-path: ninguno de los dos endpoints
 * tiene un GET que lo devuelva (§2.1 del informe de conexiones), así que lo que responden se
 * descarta y la pantalla re-lee la lista de planes.
 *
 * Los tres campos son STRING del lado del backend, incluido `amount`: `PurchasePlanDto` y
 * `ConfirmPaymentDto` los declaran con `@IsString()` y recién adentro los convierten a
 * `BigInt` y a `Prisma.Decimal`. Mandar un número acá es un 400.
 *
 * `v.object` descarta las claves de más, y eso importa: el ValidationPipe del backend corre
 * con `forbidNonWhitelisted`, así que una clave extra también es un 400.
 */
export const PlanPurchaseRequestSchema = v.object({
  planId: v.string(),
  paymentMethodId: v.string(),
  amount: v.string(),
});
export type PlanPurchaseRequest = v.InferOutput<typeof PlanPurchaseRequestSchema>;

export const ClassPaymentRequestSchema = v.object({
  paymentMethodId: v.string(),
  amount: v.string(),
});
export type ClassPaymentRequest = v.InferOutput<typeof ClassPaymentRequestSchema>;
