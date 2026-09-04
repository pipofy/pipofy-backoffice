import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Role, RegistrationInput } from '@domain/entities/registration';
import { domainErrorMessage } from '@domain/errors';
import { BrandmarkComponent } from '@shared/ui/brandmark.component';
import { NoticeComponent } from '@shared/ui/notice.component';
import { SiteFooterComponent } from '@shared/ui/site-footer.component';
import { OnboardingFacade } from '../onboarding.facade';
import { OnboardingPersistenceService, OnboardingFormValue } from '../onboarding-persistence.service';
import { passwordsMatch, trimmedMinLength, PHONE_RE } from '../onboarding.validators';
import { EMAIL_RE } from '@shared/validators/email';
import { StepperComponent } from '../components/stepper.component';
import { RoleStepComponent } from '../components/role-step.component';
import { AccountStepComponent } from '../components/account-step.component';
import { ConfirmStepComponent } from '../components/confirm-step.component';

type StepKey = 'role' | 'account' | 'confirm';

const NODE: Record<StepKey, number> = { role: 0, account: 1, confirm: 2 };
const STEP_LABEL: Record<StepKey, string> = { role: 'Rol', account: 'Cuenta', confirm: 'Confirmación' };
const STEP_LABELS = ['Rol', 'Cuenta', 'Confirmar'];

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, BrandmarkComponent, SiteFooterComponent, NoticeComponent,
    StepperComponent, RoleStepComponent, AccountStepComponent, ConfirmStepComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding-wizard.component.html',
  styleUrl: './onboarding-wizard.component.css',
})
export class OnboardingWizardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly facade = inject(OnboardingFacade);
  private readonly persistence = inject(OnboardingPersistenceService);
  protected readonly domainErrorMessage = domainErrorMessage;

  // Guard: jsdom (runner de tests) puede no implementar matchMedia -> no romper el constructor.
  private readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly form = this.fb.group({
    role: this.fb.control<Role | null>(null, [Validators.required]),
    account: this.fb.group({
      nombre:     this.fb.control('', [Validators.required, trimmedMinLength(2)]),
      apellido:   this.fb.control('', [Validators.required, trimmedMinLength(2)]),
      email:      this.fb.control('', [Validators.required, Validators.pattern(EMAIL_RE)]),
      phone:      this.fb.control('', [Validators.required, Validators.pattern(PHONE_RE)]),
      password:   this.fb.control('', [Validators.required, Validators.minLength(8)]),
      confirm:    this.fb.control('', [Validators.required]),
      nombreClub: this.fb.control(''),      // requerido condicional, ver constructor
    }, { validators: [passwordsMatch] }),
    acceptedTerms: this.fb.control(false, [Validators.requiredTrue]),
  });

  protected readonly roleSig = signal<Role | null>(null);
  protected readonly stepIndex = signal(0);
  protected readonly live = signal('');

  protected readonly sequence = computed<StepKey[]>(() => ['role', 'account', 'confirm']);
  protected readonly labels = STEP_LABELS;
  protected readonly stepKey = computed<StepKey>(() => this.sequence()[this.stepIndex()]);
  protected readonly activeNode = computed(() => NODE[this.stepKey()]);
  protected readonly roleLabel = computed(() => (this.roleSig() === 'club' ? 'Dueño de club' : 'Profesor'));

  // getters para pasar sub-grupos/control a los pasos hijos
  protected get accountGroup() { return this.form.controls.account; }
  protected get roleControl() { return this.form.controls.role as FormControl<Role | null>; }

  constructor() {
    this.hydrate();

    // el rol se espeja a un signal para disparar stepper/sequence en zoneless
    this.form.controls.role.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.roleSig.set(r);
        this.syncClubValidator(r);
      });

    // persistir en cada cambio (save() descarta la contraseña)
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.persist());

    // al cambiar de paso: persistir, anunciar y enfocar (salvo el primer montaje: no scrollear)
    let firstMount = true;
    effect(() => {
      const key = this.stepKey();
      this.persist();
      this.live.set(`Paso ${NODE[key] + 1} de 3: ${STEP_LABEL[key]}.`);
      const first = firstMount;
      firstMount = false;
      queueMicrotask(() => this.focusStep(first));
    });
  }

  private hydrate(): void {
    const snap = this.persistence.restore();
    if (snap) {
      this.form.patchValue({
        role: snap.role,
        account: {
          nombre: snap.account.nombre,
          apellido: snap.account.apellido,
          email: snap.account.email,
          phone: snap.account.phone ?? '',
          nombreClub: snap.account.nombreClub,
        },
        acceptedTerms: snap.acceptedTerms,
      });
      this.roleSig.set(snap.role);
      this.syncClubValidator(snap.role);
      const seq: StepKey[] = ['role', 'account', 'confirm'];
      const i = snap.step ? seq.indexOf(snap.step as StepKey) : -1;
      this.stepIndex.set(i >= 0 ? i : snap.role ? 1 : 0);
      return;
    }
    const rol = this.route.snapshot.queryParamMap.get('rol');
    if (rol === 'profesor' || rol === 'club') {
      this.form.controls.role.setValue(rol);
      this.roleSig.set(rol);
      this.syncClubValidator(rol);
      this.stepIndex.set(1);
    }
  }

  // Toggle único del validador condicional de nombreClub. Se llama desde el subscribe de
  // role.valueChanges (cambios en vivo, ej. click en role-step) Y desde hydrate() (restore
  // de snapshot / deep-link ?rol=), porque hydrate() corre ANTES de que exista esa
  // suscripción — sus setValue/patchValue no tienen quién los escuche.
  private syncClubValidator(r: Role | null): void {
    const club = this.form.controls.account.controls.nombreClub;
    if (r === 'club') {
      club.setValidators([Validators.required, trimmedMinLength(2)]);
    } else {
      club.clearValidators();
      club.setValue('');
    }
    club.updateValueAndValidity();
  }

  protected next(): void {
    const key = this.stepKey();
    if (!this.validateStep(key)) { this.focusFirstInvalid(); return; }
    if (this.stepIndex() < this.sequence().length - 1) this.stepIndex.update((i) => i + 1);
  }
  protected back(): void {
    if (this.stepIndex() > 0) this.stepIndex.update((i) => i - 1);
  }
  protected goTo(key: StepKey): void {
    const target = this.sequence().indexOf(key);
    if (target >= 0) this.stepIndex.set(target);
  }
  protected changeRole(): void { this.goTo('role'); }

  private collectInput(): RegistrationInput {
    const v = this.form.getRawValue();
    return {
      role: v.role,
      nombre: v.account.nombre ?? '',
      apellido: v.account.apellido ?? '',
      email: v.account.email ?? '',
      password: v.account.password ?? '',
      phone: v.account.phone ?? '',
      nombreClub: v.account.nombreClub ?? '',
      acceptedTerms: v.acceptedTerms ?? false,
    };
  }

  private validateStep(key: StepKey): boolean {
    const control =
      key === 'role' ? this.form.controls.role
      : key === 'account' ? this.form.controls.account
      : this.form.controls.acceptedTerms;
    control.markAllAsTouched();
    return control.valid;
  }

  protected async onSubmit(): Promise<void> {
    // Validar TODOS los pasos: tras restaurar sesión en 'confirm' la contraseña no se
    // repobló (no se persiste) y 'account' queda inválido; sin esto se crearía un alta
    // con contraseña vacía.
    const firstInvalid = this.sequence().find((key) => !this.validateStep(key));
    if (firstInvalid) { this.goTo(firstInvalid); this.focusFirstInvalid(); return; }
    const email = (this.form.getRawValue().account.email ?? '').trim();
    await this.facade.signup(this.collectInput());
    if (this.facade.error()) return;
    this.persistence.clear();
    // El alta ya se creó y el borrador local ya se limpió: lo que sigue es sólo el redirect.
    // navigate() puede rechazar por motivos ajenos a que la ruta no exista todavía (falla al
    // cargar un chunk lazy, un guard que tira) — sin manejar el rechazo queda como unhandled
    // rejection y no deshace nada de lo que ya pasó.
    await this.router.navigate(['/revisa-tu-mail'], { queryParams: { email } })
      .catch((e) => console.error('[onboarding] redirect a /revisa-tu-mail falló', e));
  }

  private persist(): void {
    this.persistence.save(this.form.getRawValue() as OnboardingFormValue, this.stepKey());
  }

  private focusStep(firstMount: boolean): void {
    const stepEl = this.host.nativeElement.querySelector<HTMLElement>('.step');
    if (!stepEl) return;
    stepEl.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select, [tabindex]')?.focus({ preventScroll: true });
    if (!firstMount) stepEl.scrollIntoView?.({ behavior: this.reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  private focusFirstInvalid(): void {
    queueMicrotask(() => {
      this.host.nativeElement
        .querySelector<HTMLElement>('.step input.ng-invalid, .step textarea.ng-invalid, .step select.ng-invalid')
        ?.focus();
    });
  }
}
