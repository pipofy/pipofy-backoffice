import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/** Una marca del reloj, con su posición ya resuelta en % de la caja (que es cuadrada). */
interface Tick {
  readonly value: number;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

/** Radios en % desde el centro. El anillo de adentro es el de 13-00, como el reloj de Material. */
const R_OUT = 40;
const R_IN = 26;

/**
 * Las 12 posiciones de un reloj, arrancando arriba y en sentido horario. `values[i]` es el
 * número que va en la posición i, así que el orden del array ES la posición: no reordenarlo.
 */
function ring(values: readonly number[], radius: number, pad: boolean): Tick[] {
  return values.map((value, i) => {
    const rad = ((i * 30 - 90) * Math.PI) / 180;
    return {
      value,
      label: pad ? String(value).padStart(2, '0') : String(value),
      x: 50 + radius * Math.cos(rad),
      y: 50 + radius * Math.sin(rad),
    };
  });
}

// 24 horas en dos anillos: afuera 12 y 1-11 (el mediodía arriba), adentro 00 y 13-23.
const HOUR_TICKS: readonly Tick[] = [
  ...ring([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], R_OUT, false),
  ...ring([0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], R_IN, true),
];
// Los minutos de a 5, un solo anillo. Un horario de club no necesita el minuto 47.
const MINUTE_TICKS: readonly Tick[] = ring([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], R_OUT, true);

/** 'HH:mm' de 00:00 a 23:59, el mismo contrato que `<input type="time">` y que el dominio. */
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * La carátula del reloj, al estilo del `showTimePicker` de Flutter: se elige la hora, la vista
 * pasa sola a los minutos, y listo. Presentacional y CONTROLADO — no sabe de popups ni guarda
 * la hora: la recibe por `value` y emite la nueva. Eso es lo que lo deja embeber en cualquier
 * lado, no sólo en `TimePickerFieldComponent`.
 *
 * Es propio y no una librería: el único reloj para Angular 20 (`ngx-mat-timepicker`) arrastra
 * `@angular/material` + `cdk` + `animations`, y este repo no tiene NINGUNA dependencia de UI.
 * El timepicker oficial de Material tampoco servía — es una lista desplegable, no un reloj.
 *
 * Sin estado propio salvo la vista (hora/minutos): las dos mitades se derivan de `value` en
 * cada render. Un signal interno sembrado desde el input sería el bug clásico de este repo —
 * un effect sobre un input no se re-dispara cuando el valor es Object.is-igual, así que dos
 * aperturas seguidas con la misma hora reabrirían con lo elegido la vez anterior.
 *
 * ponytail: sin arrastrar la aguja y con los minutos de a 5. Se elige tocando. Salida: si
 * alguna vez hace falta el minuto exacto, un `<input type="time">` al pie.
 */
@Component({
  selector: 'app-time-dial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './time-dial.component.css',
  template: `
    <div class="dial-head">
      <button type="button" class="unit" [class.on]="view() === 'h'" (click)="view.set('h')">{{ hh() }}</button>
      <span class="sep">:</span>
      <button type="button" class="unit" [class.on]="view() === 'm'" (click)="view.set('m')">{{ mm() }}</button>
      <span class="hint">{{ view() === 'h' ? 'Elegí la hora' : 'Elegí los minutos' }}</span>
    </div>

    <div class="dial-face">
      @if (hand(); as h) {
        <span class="hand" aria-hidden="true"
              [style.height.%]="h.len"
              [style.transform]="'translateX(-50%) rotate(' + h.angle + 'deg)'"></span>
      }
      <span class="pin" aria-hidden="true"></span>
      @for (t of ticks(); track t.value) {
        <button type="button" class="tick" [class.on]="t.value === current()"
                [style.left.%]="t.x" [style.top.%]="t.y" (click)="pick(t.value)">{{ t.label }}</button>
      }
    </div>
  `,
})
export class TimeDialComponent {
  /** 'HH:mm', o '' cuando todavía no hay hora. Mismo contrato que `<input type="time">`. */
  readonly value = input.required<string>();
  /** Se llama `valueChange` a propósito: habilita el `[(value)]` de quien lo consuma. */
  readonly valueChange = output<string>();

  protected readonly view = signal<'h' | 'm'>('h');

  /** null = `value` vacío o mal formado. No se puede colapsar a 0: 00:00 es una hora real. */
  private readonly parsed = computed(() => {
    const m = HHMM.exec(this.value());
    return m === null ? null : { h: Number(m[1]), m: Number(m[2]) };
  });
  private readonly hour = computed(() => this.parsed()?.h ?? null);
  private readonly minute = computed(() => this.parsed()?.m ?? null);

  protected readonly ticks = computed(() => (this.view() === 'h' ? HOUR_TICKS : MINUTE_TICKS));
  protected readonly current = computed(() => (this.view() === 'h' ? this.hour() : this.minute()));

  protected readonly hh = computed(() => pad(this.hour()));
  protected readonly mm = computed(() => pad(this.minute()));

  /**
   * La aguja entera, o null cuando no hay nada que señalar. UN solo computed y no un par
   * ángulo/largo: los dos ramificaban por `view()` y tenían que coincidir en cuándo NO hay
   * aguja; separados, el ángulo necesitaba un `?? 0` que en realidad nunca corría.
   *
   * El ángulo va en grados desde las 12, horario. Los minutos usan 6°/min y no 30° por marca:
   * así una hora guardada fuera de la grilla de 5 (18:47) pone la aguja donde está, no donde
   * redondea. El largo dice en qué anillo cae: el de adentro es 00 y 13-23.
   */
  protected readonly hand = computed<{ angle: number; len: number } | null>(() => {
    if (this.view() === 'm') {
      const m = this.minute();
      return m === null ? null : { angle: m * 6, len: R_OUT };
    }
    const h = this.hour();
    if (h === null) return null;
    return { angle: (h % 12) * 30, len: h === 0 || h >= 13 ? R_IN : R_OUT };
  });

  /**
   * La mitad que no se tocó cae en 00 cuando todavía no hay nada: emitir siempre un 'HH:mm'
   * completo es lo que deja al componente controlado. Un 'HH:--' a medio armar obligaría a
   * cada consumidor a saber qué hacer con él.
   */
  protected pick(n: number): void {
    if (this.view() === 'h') {
      this.valueChange.emit(`${pad2(n)}:${pad2(this.minute() ?? 0)}`);
      this.view.set('m');
      return;
    }
    this.valueChange.emit(`${pad2(this.hour() ?? 0)}:${pad2(n)}`);
  }
}

function pad(n: number | null): string {
  return n === null ? '--' : pad2(n);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
