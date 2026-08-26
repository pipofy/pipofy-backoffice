import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { GrupoDetailPageComponent } from './grupo-detail-page.component';
import { GruposFacade } from '../grupos.facade';
import { GroupsRepository } from '@domain/contracts/groups.repository';
import { InMemoryGroupsRepository } from '@data/repositories/in-memory-groups.repository';
import { ToastService } from '@shared/ui/toast/toast.service';
import { SessionCancelledError } from '@domain/errors';
import { SessionStore } from '@data/auth/session-store';

const flushRepo = () => new Promise((r) => setTimeout(r, 0));

function providers(id: string, repo: GroupsRepository) {
  return [
    provideZonelessChangeDetection(),
    provideRouter([]),
    GruposFacade,
    { provide: GroupsRepository, useValue: repo },
    { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) } } },
    // SessionStore está bindeado en root: el TestBed no lo provee solo.
    { provide: SessionStore, useValue: { clubId: signal<string | null>('c1') } },
  ];
}

async function mount(id = '1', repo: GroupsRepository = new InMemoryGroupsRepository(0)) {
  TestBed.configureTestingModule({ providers: providers(id, repo) });
  const fixture = TestBed.createComponent(GrupoDetailPageComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  await flushRepo();
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    toasts: TestBed.inject(ToastService),
  };
}

const botonesSesion = (el: HTMLElement) =>
  el.querySelectorAll<HTMLButtonElement>('app-sessions-table tbody button');

describe('GrupoDetailPageComponent', () => {
  it('renderiza hero, roster, lista de espera y sesiones', async () => {
    const { el } = await mount('1');
    expect(el.querySelector('.stu-hero h2')!.textContent).toContain('7ma+8va · Lunes PM');
    expect(el.querySelector('.stu-hero .st-sub')!.textContent).toContain('Diego A.');
    expect(el.querySelectorAll('app-roster-table tbody tr')).toHaveLength(4);
    expect(el.querySelector('.waitlist-card')!.textContent).toContain('Julián Vera');
    expect(el.querySelectorAll('app-sessions-table tbody tr')).toHaveLength(3);
  });

  it('las 4 fichas del hero, en orden', async () => {
    const { el } = await mount('1');
    const fichas = el.querySelectorAll('.st-fact');
    expect(fichas[0].textContent).toContain('Cupo');
    expect(fichas[1].textContent).toContain('Inscriptos');
    expect(fichas[1].querySelector('.v')!.textContent).toContain('4');
    expect(fichas[2].textContent).toContain('En lista de espera');
    expect(fichas[3].textContent).toContain('Próxima sesión');
    expect(fichas[3].querySelector('.v')!.textContent).toContain('08/07');
  });

  it('la primera entrada de la lista de espera dice "1ro en la fila"', async () => {
    const { el } = await mount('3');
    const entradas = el.querySelectorAll('.waitlist-card .arow');
    expect(entradas[0].textContent).toContain('1ro en la fila');
    expect(entradas[0].textContent).toContain('anotado hace 1 día');
    expect(entradas[1].textContent).not.toContain('1ro en la fila');
  });

  it('lista de espera vacía muestra su mensaje', async () => {
    const { el } = await mount('2');
    expect(el.querySelector('.waitlist-card')!.textContent).toContain('Nadie esperando');
  });

  it('TOMAR ASISTENCIA descuenta los créditos y deja la sesión completada, en la misma pantalla', async () => {
    const { fixture, el, toasts } = await mount('1');
    // botón[0] es 1-s1 ("Ver / editar": ya está completada). La sesión 1-s2 está programada
    // y es la segunda con botón: su botón dice "Tomar asistencia".
    botonesSesion(el)[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('dialog')!.open).toBe(true);

    // Marcar ausente al segundo integrante y confirmar.
    el.querySelectorAll<HTMLButtonElement>('.segp')[3].click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-testid="confirm"]')!.click();
    await fixture.whenStable();
    await flushRepo();
    fixture.detectChanges();

    const creditos = Array.from(el.querySelectorAll('app-roster-table .amt')).map((n) => n.textContent!.trim());
    expect(creditos).toEqual(['5', '2', '7', '3']);          // eran 6, 3, 8, 4 — política prendida
    expect(el.querySelectorAll('app-sessions-table .ss-pill')[1].textContent).toContain('Completada');
    expect(toasts.toasts()[0].type).toBe('ok');
    expect(toasts.toasts()[0].title).toBe('Asistencia registrada');
    expect(toasts.toasts()[0].desc).toContain('4 clase(s) computada(s)');
    // Ningún copy promete features diferidas.
    expect(toasts.toasts()[0].desc).not.toContain('ledger');
    expect(toasts.toasts()[0].desc).not.toContain('WhatsApp');
  });

  it('con la política de descuento APAGADA, el ausente NO pierde crédito', async () => {
    // Es la otra rama de creditsToDiscount y la única en la que presentes y clases computadas
    // difieren. Sin este test, apagar la política podría descontarle igual al ausente.
    const { fixture, el, toasts } = await mount('1');

    botonesSesion(el)[1].click();               // 1-s2, programada → modo tomar
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    el.querySelector<HTMLInputElement>('.att-policy input')!.click();   // destildar la política
    fixture.detectChanges();
    el.querySelectorAll<HTMLButtonElement>('.segp')[3].click();         // 2do integrante AUSENTE
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-testid="confirm"]')!.click();
    await fixture.whenStable();
    await flushRepo();
    fixture.detectChanges();

    const creditos = Array.from(el.querySelectorAll('app-roster-table .amt')).map((n) => n.textContent!.trim());
    expect(creditos).toEqual(['5', '3', '7', '3']);   // eran 6,3,8,4 — el 2do (ausente) NO baja
    expect(toasts.toasts()[0].desc).toContain('3 clase(s) computada(s)');
  });

  it('la ficha "Próxima sesión" se actualiza al completar la que estaba programada', async () => {
    const { fixture, el } = await mount('1');
    // botón[1] = 1-s2, la primera sesión PROGRAMADA (botón[0] es 1-s1, ya completada).
    botonesSesion(el)[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-testid="confirm"]')!.click();
    await fixture.whenStable();
    await flushRepo();
    fixture.detectChanges();

    expect(el.querySelectorAll('.st-fact')[3].querySelector('.v')!.textContent).toContain('15/07');
  });

  it('VER / EDITAR abre con las marcas guardadas y guardar NO cambia créditos', async () => {
    // El grupo 3 tiene la sesión mixta 3-s1 (3 presentes, 1 ausente). Sin ese dato, este test
    // pasaría aunque la restauración de marcas no existiera.
    const { fixture, el, toasts } = await mount('3');
    const creditosAntes = Array.from(el.querySelectorAll('app-roster-table .amt')).map((n) => n.textContent!.trim());

    botonesSesion(el)[0].click();               // 3-s1 está completada → "Ver / editar"
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const segs = el.querySelectorAll<HTMLButtonElement>('.segp');
    expect(segs[0].classList.contains('on-p')).toBe(true);    // Pablo presente
    expect(segs[7].classList.contains('on-a')).toBe(true);    // Iván AUSENTE (marca guardada)
    expect(el.querySelector('.att-policy')).toBeNull();       // política oculta en modo editar

    el.querySelector<HTMLButtonElement>('[data-testid="confirm"]')!.click();
    await fixture.whenStable();
    await flushRepo();
    fixture.detectChanges();

    const creditosDespues = Array.from(el.querySelectorAll('app-roster-table .amt')).map((n) => n.textContent!.trim());
    expect(creditosDespues).toEqual(creditosAntes);
    expect(toasts.toasts()[0].title).toBe('Asistencia actualizada');
  });

  it('CANCELAR y abrir OTRA sesión siembra el modal con la sesión NUEVA, no con la anterior', async () => {
    // El modal se siembra imperativamente en open() leyendo su input target. Si al cancelar el
    // target no se limpia, el @if no se destruye y Angular REUSA la vista embebida: el effect que
    // llama open() corre ANTES de que el binding [target] se refresque, así que el modal se sembraría
    // con la sesión ANTERIOR. Guardar ahí sobrescribe la asistencia de la sesión abierta con las
    // marcas de la otra — borra ausencias registradas en silencio.
    const { fixture, el } = await mount('3');

    botonesSesion(el)[1].click();               // 3-s3 programada → modo tomar, todos presentes
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('dialog h3')!.textContent).toContain('Tomar asistencia');

    el.querySelector<HTMLButtonElement>('.modal-foot .btn-ghost')!.click();   // Cancelar
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    botonesSesion(el)[0].click();               // 3-s1 completada, mixta (3 presentes / 1 ausente)
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('dialog h3')!.textContent).toContain('Editar asistencia');
    const segs = el.querySelectorAll<HTMLButtonElement>('.segp');
    expect(segs[7].classList.contains('on-a')).toBe(true);   // Iván sigue AUSENTE, no todo-presente
  });

  it('una sesión CANCELADA no ofrece botón', async () => {
    const { el } = await mount('3');
    const filas = el.querySelectorAll('app-sessions-table tbody tr');
    expect(filas[1].querySelector('button')).toBeNull();     // 3-s2 está cancelada
  });

  it('MIENTRAS CARGA muestra "Cargando grupo…", NUNCA "No encontramos ese grupo"', async () => {
    // Con el snapshot vacío, groups().find() da undefined para CUALQUIER id. Si la rama de
    // "no existe" fuera antes que la de loading, un deep-link mostraría el error durante toda
    // la latencia y recién después pintaría el grupo.
    TestBed.configureTestingModule({ providers: providers('3', new InMemoryGroupsRepository(50)) });
    const fixture = TestBed.createComponent(GrupoDetailPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cargando grupo…');
    expect(el.textContent).not.toContain('No encontramos ese grupo');
  });

  it('un id inexistente muestra el mensaje y el link a la lista', async () => {
    const { el } = await mount('99');
    expect(el.textContent).toContain('No encontramos ese grupo');
    expect(el.querySelector('a[href="/grupos"]')).toBeTruthy();
  });

  it('si el repo falla al guardar, el modal QUEDA ABIERTO y sale el toast en español', async () => {
    const base = new InMemoryGroupsRepository(0);
    const repo: GroupsRepository = {
      getGroups: (id: string) => base.getGroups(id),
      // Rechaza con un DomainRuleError CRUDO, no con un { kind } ya normalizado: es lo que tira de
      // verdad el repo, y es lo único que prueba que toDomainError haga falta. Con un
      // { kind: 'network' } el test pasaría igual si alguien borrara toDomainError —
      // domainErrorMessage lo acepta tal cual. Con éste, sin normalizar el switch no matchea.
      saveAttendance: () => Promise.reject(new SessionCancelledError()),
    };
    const { fixture, el, toasts } = await mount('1', repo);

    // [1] y no [0]: [0] es 1-s1, que está completed y abre en modo EDITAR. El fallo que importa
    // blindar es el de una TOMA de asistencia, que es la que mueve créditos.
    botonesSesion(el)[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-testid="confirm"]')!.click();
    await fixture.whenStable();
    await flushRepo();
    fixture.detectChanges();

    expect(el.querySelector('dialog')!.open).toBe(true);      // NO se cerró
    expect(el.querySelector<HTMLButtonElement>('[data-testid="confirm"]')!.disabled).toBe(false);
    expect(toasts.toasts()[0].type).toBe('info');
    expect(toasts.toasts()[0].title).toBe('No se pudo guardar');
    expect(toasts.toasts()[0].desc).toBe('No se puede tomar asistencia de una sesión cancelada.');
    // Un guardado fallido no puede mover créditos: siguen los de la semilla.
    const creditos = Array.from(el.querySelectorAll('app-roster-table .amt')).map((n) => n.textContent!.trim());
    expect(creditos).toEqual(['6', '3', '8', '4']);
  });

  it('el roster vacío deshabilita el botón de tomar asistencia', async () => {
    const base = new InMemoryGroupsRepository(0);
    const repo: GroupsRepository = {
      getGroups: async (id) => {
        const snap = await base.getGroups(id);
        return { ...snap, groups: snap.groups.map((g) => (g.id === '1' ? { ...g, roster: [] } : g)) };
      },
      saveAttendance: (id, req) => base.saveAttendance(id, req),
    };
    const { el } = await mount('1', repo);
    expect(el.querySelector('app-roster-table')!.textContent).toContain('Nadie inscripto todavía');
    // botón[0] es 1-s1 ("Ver / editar", nunca deshabilitado); botón[1] es 1-s2 ("Tomar
    // asistencia"), el único con [disabled]="!canTake()".
    expect(botonesSesion(el)[1].disabled).toBe(true);
  });
});
