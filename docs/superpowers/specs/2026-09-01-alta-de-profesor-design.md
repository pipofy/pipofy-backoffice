# Alta de profesor — diseño

Fecha: 2026-09-01
Estado: aprobado, listo para plan de implementación

## 1. Contexto

La pantalla `/configuracion/profesores` lista profesores y edita su `description`, y nada más.
Tres archivos del repo documentan por qué, con la misma razón:

| Archivo | Lo que dice hoy |
|---|---|
| `core/domain/entities/coach.ts` | «Crear un profesor es imposible contra este backend: el coachProfile lo crea POST /users cuando el rol se llama 'profesor', y ese endpoint exige un roleId que no hay forma de obtener porque no existe GET /roles (§3.10)» |
| `core/domain/contracts/coaches.repository.ts` | «El slice B agrega update(): sólo `description`, que es lo único que el backend escribe» |
| `features/configuracion/profesores/profesores.facade.ts` | «Sin create ni remove: contra este backend un profesor no se puede crear (POST /users pide un roleId y no existe GET /roles) ni borrar» |

**Esa premisa ya no es cierta.** `pipofy-backend` tiene hoy `src/roles/roles.controller.ts` con
`GET /roles`, y devuelve `{ id, name }` filtrado por el club del JWT. Es el único dato que
faltaba para que `POST /users` sea usable.

Esto importa más allá de la comodidad: el backend **no tiene `POST /coaches`** — sólo `GET`,
`GET /:id` y `PATCH /:id`. `POST /users` es la única puerta que existe para crear un profesor,
porque `users.service.createUser()` crea el `CoachProfile` como efecto de asignar el rol
`profesor`. Sin esta pantalla, un club no puede incorporar un profesor por ningún medio que no
sea tocar la base a mano.

## 2. Alcance

**Adentro:** un botón *Nuevo profesor* en `/configuracion/profesores` que abre un modal con
email, nombre y apellido. Al guardar: `GET /roles` → se busca el rol llamado `profesor` →
`POST /users` con ese `roleId` → relectura de `GET /coaches`.

**Afuera, y por qué:**

- **Selector de rol.** El alcance es dar de alta profesores, no administrar el equipo. El rol
  se resuelve por nombre y la persona no ve un select.
- **Listar, editar o dar de baja usuarios.** No hay `GET /users` ni `DELETE /users/:id`.
- **Reenviar la contraseña temporal.** No hay endpoint.
- **Arreglar la atomicidad de `POST /users`** (§3.2). Es del backend, y el backend no se toca
  desde este repo.

## 3. Decisiones y sus techos

### 3.1 Los roles no se siembran, y no todos los clubes tienen `profesor`

`prisma/seed.ts` siembra 16 catálogos y **ningún rol**. Los roles nacen por club en
`auth.service.ts:46-62`, durante el signup:

- `tipo === 'club'` → crea `admin`, y además siembra `encargado` y `profesor`.
- `tipo === 'particular'` → crea **sólo `superprofesor`**.

De ahí salen dos poblaciones para las que esta pantalla no puede funcionar:

1. **Las cuentas `particular`** (un profesor independiente, sin club). Nunca van a tener un rol
   llamado `profesor`.
2. **Los clubes anteriores al bootstrap.** El `if (!existente)` de ese bloque sólo corre en
   signups nuevos: no hay migración que cure a los clubes ya creados.

Por eso «no existe el rol profesor» **no es un borde teórico**, y por eso el mensaje de error de
ese caso es específico y no genérico (§7). Y por eso también los roles se piden **al guardar** y
no al abrir la pantalla: no hay forma de saber si el rol existe sin preguntar, y preguntar en
cada visita a Profesores es una request por visita para un botón que se usa cinco veces en la
vida de un club.

**Techo:** la persona se entera después de llenar el formulario, no antes. **Salida:** que el
backend siembre los roles faltantes en una migración, o que exponga el rol en `/users/me`.

### 3.2 `POST /users` no es atómico con el mail

`users.service.createUser()` crea `user`, `userRole` y `coachProfile` **sin transacción**, y
recién después hace `await this.emailService.send(...)`. `EmailService.send()` no tiene catch:
si el SMTP está caído o sin credenciales, `sendMail` rechaza, `createUser` tira, y la request
devuelve **500 con el profesor ya creado** y una contraseña temporal que nadie llegó a ver.

El front no puede evitarlo, pero sí puede no mentir sobre ello: `crear()` relee `GET /coaches`
**también en el camino de error**, así la tabla muestra lo que hay en vez de lo que se supone
que pasó. Es la misma forma que ya tiene `AlumnoPlanesFacade.comprar()`, y es exactamente para
lo que existe el `setLoading` protegido de `SignalStore`.

**Techo:** el profesor queda creado con una clave que nadie conoce, y la única salida por
producto es el flujo de "olvidé mi contraseña". **Salida real:** transacción en el backend, con
el envío del mail fuera del camino crítico.

### 3.3 El 403 del backend es inalcanzable acá

`createUser` tira `ForbiddenException('El rol indicado no pertenece a tu club')` cuando el
`roleId` es de otro club. `to-domain-error.ts` mapea 403 → `{kind:'forbidden'}`, cuyo copy
genérico («No tenés permisos para hacer esto») taparía ese mensaje.

No hay que hacer nada: el `roleId` sale de `GET /roles`, que ya filtra por el club del JWT, así
que la condición no se puede dar por esta vía. Queda escrito para que nadie "arregle" el mapeo
de 403 apoyándose en este caso — ese mapeo tiene su propia razón, documentada en §4.7 del spec
de reservas.

### 3.4 `roles()` no se memoiza

`GET /roles` devuelve exactamente `{ id, name }`: la misma forma que `/catalogs/*`, y por eso
reusa `CatalogListDtoSchema` sin schema nuevo.

Pero **no va en `CatalogsRepository`**. Los catálogos son globales; los roles son **del club**.
`CatalogsRepository` es singleton de root y memoiza la promesa por sesión: meter ahí una lista
club-scoped reintroduce el bug que `UsersRepository.me()` ya documenta que evita — un logout
seguido de un login con otro club en la misma pestaña serviría los roles del club anterior.

Va en `UsersRepository`, sin cache, al lado del `POST /users` que lo consume. Una request por
alta, que es la frecuencia correcta para el dato.

### 3.5 Modal nuevo, no un modo en el existente

`ProfesorFormModalComponent` es de edición: un solo campo (`description`), y su `open(coach:
Coach)` está construido alrededor de un coach no-null. Los campos del alta son **disjuntos**
(email, nombre, apellido — ninguno de los cuales `PATCH /coaches/:id` escribe). Un flag `mode`
ramificaría template, siembra, título y tipo emitido: más código que un segundo modal chico.

## 4. Arquitectura

Slice vertical estándar, con una particularidad: **no hay contrato abstracto nuevo**.
`UsersRepository` ya vive fuera de esa convención a propósito (lo dice su propio docstring, con
el mismo criterio que `CatalogsRepository`), y hay nueve archivos de `features/` que ya inyectan
un repositorio concreto de `data`.

### 4.1 Dominio

**`core/domain/entities/new-user.ts`** (nuevo)

```ts
export interface NewUserInput {   // lo que emite el form: strings crudos
  readonly email: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly roleId: string;
}

export interface NewUser {        // el draft validado
  readonly email: string;
  readonly nombre: string | null;
  readonly apellido: string | null;
  readonly roleId: string;
}

export function createNewUserDraft(input: NewUserInput): NewUser;
```

Invariantes que exige, tirando `InvalidUserError`:

- `email` no vacío tras `trim()`.
- `roleId` no vacío. Es lo que atrapa el caso de §3.1 si la facade lo dejara pasar.

Y una normalización: `nombre` y `apellido` recortados, `''` → `null`.

El **formato** del email no se revalida acá. Lo valida el formulario con `EMAIL_RE` de
`@shared/validators/email`, que es el mismo reparto que ya hace `createRegistration`: la entidad
es un backstop de invariantes estructurales, no un segundo validador de formato. Y `domain` no
puede importar de `shared` (boundaries), así que duplicar el regex crearía dos criterios de qué
es un email válido.

El `trim()` sí vive en el dominio, por el argumento que ya está escrito en `createRegistration`:
así "el nombre no puede ser espacios en blanco" es una invariante y no depende de que la UI se
acuerde de limpiar.

**`core/domain/errors.ts`** (tocado): se agrega

```ts
export class InvalidUserError extends DomainRuleError { … }
```

Extiende `DomainRuleError`, así que `toDomainError` la normaliza a `{kind: 'domain', message}`.
**No agrega un `kind` nuevo a la unión**, y por lo tanto no toca el `switch` exhaustivo de
`domainErrorMessage()`.

### 4.2 Data

**`core/data/dto/users.dto.ts`** (tocado):

```ts
export const CreateUserRequestSchema = v.object({
  email: v.string(),
  nombre: v.optional(v.string()),
  apellido: v.optional(v.string()),
  roleId: v.string(),
});
```

Sin `clubId`: el backend lo saca del JWT. Mandarlo activaría la comparación de `ClubScopeGuard`,
que hoy pasa de largo justamente porque el body no lo lleva.

Los roles **no llevan schema propio**: reusan `CatalogItemDtoSchema` / `CatalogListDtoSchema` de
`catalogs.dto.ts` (import dentro de `data`, permitido). `RolesService.list()` serializa a mano
`{ id: r.id.toString(), name: r.nombre }`, que es esa forma exacta.

**`core/data/mappers/user.mapper.ts`** (nuevo): `toCreateUserRequest(draft: NewUser)`.

**Omite** `nombre` y `apellido` cuando son `null`, en vez de mandarlos en null. `@IsOptional()`
de class-validator los dejaría pasar igual, pero omitir no depende de ese detalle de una
librería del otro repo. Es la misma forma que `toCourtRequest`, por una razón distinta —
conviene no "unificarlas".

**`core/data/repositories/users.repository.ts`** (tocado): dos métodos nuevos.

- `roles(): Promise<CatalogItem[]>` → `GET /roles`, sin cache (§3.4).
- `create(draft: NewUser): Promise<void>` → `POST /users`. Devuelve `void` y la facade relee, que
  es la regla de escritura del repo. La respuesta real es `{ id, email }` y se descarta: no
  alcanza para armar un `Coach` (falta `description`) y la relectura la trae completa.

Los dos con `v.parse` dentro de un `try/catch` que normaliza con `toDomainError`, como todos.

### 4.3 Feature

**`features/configuracion/profesores/profesor-nuevo-modal.component.ts`** (nuevo)

Modal de alta con tres campos: email (requerido, `EMAIL_RE`), nombre y apellido. Sigue las
reglas de modal ya establecidas: siembra imperativa en cada apertura vía `open()`, `autofocus`
en el primer control, error dentro del modal y no en la página (el `.notice` de la página queda
detrás del `::backdrop`, que tiene scrim + blur), y guard de doble submit **en código**, no sólo
`.btn.loading`.

Lleva un `.hint` visible que avise que esto **manda un mail real** con una contraseña temporal.
No es un alta silenciosa, y la persona que lo usa tiene que saberlo antes de apretar Guardar.

**`features/configuracion/profesores/profesores.facade.ts`** (tocado): se agrega `crear()`.

```
crear(input: NewUserInput): Promise<boolean>
  1. roles ← usersRepo.roles()
  2. rol ← roles.find(r => r.name === 'profesor')
     si no está → InvalidUserError con el copy de §7
  3. usersRepo.create(createNewUserDraft({ ...input, roleId: rol.id }))
  4. SIEMPRE: setData(await coachesRepo.list())    ← también si (3) falló, por §3.2
```

No usa `run()`: `run()` no escribe `data` cuando la promesa falla, y acá hay que releer en las
dos ramas. Usa `setLoading`/`setError`/`setData`, que es para lo que existen — mismo patrón que
`AlumnoPlanesFacade.comprar()`. Devuelve `boolean` para que la página sepa si cerrar el modal.

El docstring de la clase se corrige: hoy afirma que crear un profesor es imposible.

**`features/configuracion/profesores/profesores-page.component.{ts,html}`** (tocados): botón
*+ Nuevo profesor* en el `.panel-head`, el modal nuevo, y el handler que cierra en éxito y deja
abierto con el error en fallo.

El botón va en el `.panel-head` junto al `<h3>`, que es donde ya lo pone Canchas
(`+ Nueva cancha`): mismo primitivo, misma posición, ningún estilo nuevo. `ToastService` ya está
inyectado en este componente para el toast de edición, así que el de alta no agrega dependencias.

**Providers: ningún cambio.** `UsersRepository` ya está bindeado en root (`app.config.ts`), y
`CoachesRepository` ya está en `CONFIGURACION_PROVIDERS`.

### 4.4 Colateral en código existente

Los tres comentarios del §1 quedan falsos con este slice y se corrigen en el mismo cambio:
`entities/coach.ts`, `contracts/coaches.repository.ts` y el docstring de `ProfesoresFacade`. Un
comentario que explica por qué algo es imposible, al lado del código que lo hace, es peor que no
tener comentario.

Y hay un cuarto, que **no es un comentario sino copy visible**, en
`profesores-page.component.html`:

> «Los profesores se crean al dar de alta un usuario con rol de profesor. Acá se edita su
> descripción.»

Esa frase le explica a la persona por qué la pantalla no puede hacer lo que necesita. Con el
botón puesto, pasa de ser una disculpa a ser una contradicción, y hay que reescribirla — o
borrarla, si el botón se explica solo. Es la única de las cuatro correcciones que el usuario
final ve.

`CoachesRepository` **no** gana un `create()`: crear un profesor es crear un usuario, y ese
verbo no le pertenece a ese contrato. La asimetría (se lista y edita por `CoachesRepository`,
se crea por `UsersRepository`) es la del backend, y esconderla detrás de un método haría creer
que existe un `POST /coaches`.

## 5. Flujo de la pantalla

1. La persona abre `/configuracion/profesores`. Nada cambia respecto de hoy: la lista se pide
   una vez y sobrevive al cambio de tab, porque `ProfesoresFacade` vive en la ruta padre.
2. Click en *Nuevo profesor* → el modal abre vacío.
3. Completa email (obligatorio), nombre y apellido (opcionales). El botón Guardar valida el
   email con `EMAIL_RE` antes de emitir.
4. Guardar → `crear()`. Mientras está en vuelo, el botón queda deshabilitado por el guard de
   doble submit.
5. Éxito → el modal cierra, la tabla ya tiene al profesor nuevo (la relectura entra en el mismo
   `crear()`), y sale un toast de confirmación que menciona el mail enviado.
6. Fallo → el modal queda abierto con el mensaje de §7 adentro. La tabla de atrás **también se
   releyó**: si el profesor terminó creándose igual (§3.2), está ahí.

## 6. Por qué el profesor nuevo aparece en la relectura

`coaches.service.list()` hace `coachProfile.findMany({ where: { clubId }, include: { user: … } })`.
El `coachProfile` se crea dentro del mismo `POST /users`, con el `clubId` del que pide, y el
`user` ya tiene `nombre`, `apellido` y `email`. Así que un `GET /coaches` inmediatamente después
lo devuelve, y `toCoach` le arma el `displayName` con la cadena de fallback que ya tiene. No hace
falta ningún parche optimista en memoria.

## 7. Errores

| Caso | Origen | Qué ve la persona |
|---|---|---|
| Email vacío o mal formado | `EMAIL_RE` en el form | Validación inline, no se emite |
| Email vacío que igual llegó | `createNewUserDraft` → `InvalidUserError` | `kind:'domain'` con el mensaje de la entidad |
| El club no tiene rol `profesor` (§3.1) | `InvalidUserError` en la facade | «Tu cuenta no tiene configurado el rol de profesor. Sólo las cuentas de club pueden dar de alta profesores.» |
| Email repetido | 409 del backend | `kind:'domain'` con «Ya existe un usuario con ese email» |
| Falla el envío del mail (§3.2) | 500 | Copy genérico de `unknown`. La lista se releyó igual: el profesor aparece si se creó. Un reintento choca con el 409, que es informativo. |
| Rol de otro club | 403 | Inalcanzable por construcción (§3.3) |
| Sin red | status 0 | `kind:'network'` |

Ningún caso agrega un `kind` a `DomainError`, así que el `switch` exhaustivo de
`domainErrorMessage()` no se toca.

## 8. Tests

Vitest + `TestBed`, `provideZonelessChangeDetection()` en todos, dobles como objetos planos
casteados al contrato con un array de `calls`. TDD: el rojo primero.

| Spec | Qué verifica |
|---|---|
| `new-user.spec.ts` | email vacío tira; `roleId` vacío tira; `''` → `null` en nombre/apellido; el `trim()` |
| `user.mapper.spec.ts` | `nombre`/`apellido` **ausentes** del body cuando son null, no en null |
| `users.repository.spec.ts` | `roles()` pega a `/roles` y parsea; **dos llamadas hacen dos requests** (no memoiza); `create()` manda el body exacto y sin `clubId` |
| `profesores.facade.spec.ts` | encuentra el rol por nombre; relee en éxito; **relee también cuando `create()` falla**; mensaje específico sin rol `profesor`; el 409 sale con el texto del backend |
| `profesor-nuevo-modal.component.spec.ts` | email inválido no emite; el segundo click no reemite; el error se muestra adentro |
| `profesores-page.component.spec.ts` | el botón abre el modal; el éxito lo cierra; el fallo lo deja abierto |

## 9. Techos, con su salida

| Techo | Salida |
|---|---|
| Se descubre que falta el rol `profesor` recién al guardar (§3.1) | Migración en el backend que siembre los roles faltantes |
| Un fallo de mail deja al profesor creado con clave desconocida (§3.2) | Transacción en `createUser` + envío del mail fuera del camino crítico |
| Una request de `GET /roles` por cada alta (§3.4) | Ninguna: es la frecuencia correcta. Cachear sería el bug de identidad de club |
| No se puede dar de baja un profesor | `DELETE /coaches/:id` o `DELETE /users/:id` en el backend; no existen |
