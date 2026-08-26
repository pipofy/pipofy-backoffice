import { describe, it, expect } from 'vitest';
import { toStudent, toStudentRequest } from './student.mapper';
import { StudentDraft } from '@domain/entities/student';

const dto = {
  id: '1', phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: '2001-05-03T00:00:00.000Z', categoryId: '4', studentStatusId: '2',
  dominantHand: 'diestro', ranking: 12, notes: null, deletedAt: null,
};

const draft: StudentDraft = {
  phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: '2001-05-03', categoryId: '4', studentStatusId: '2',
  dominantHand: 'diestro', ranking: 12, notes: null,
};

describe('toStudent', () => {
  it('recorta la fecha ISO a yyyy-MM-dd', () => {
    // La columna es @db.Date pero Prisma la devuelve como DateTime ISO completo, y
    // <input type="date"> sólo acepta yyyy-MM-dd: sin el recorte el campo queda vacío.
    expect(toStudent(dto).birthDate).toBe('2001-05-03');
  });

  it('la fecha null queda null', () => {
    expect(toStudent({ ...dto, birthDate: null }).birthDate).toBeNull();
  });

  it('los nombres null se toleran como cadena vacía', () => {
    const s = toStudent({ ...dto, firstName: null, lastName: null });
    expect(s.firstName).toBe('');
    expect(s.lastName).toBe('');
  });

  it('mapea el resto tal cual', () => {
    expect(toStudent(dto)).toEqual({
      id: '1', phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
      birthDate: '2001-05-03', categoryId: '4', studentStatusId: '2',
      dominantHand: 'diestro', ranking: 12, notes: null,
    });
  });
});

describe('toStudentRequest', () => {
  it('OMITE categoryId cuando es null', () => {
    // students.service hace BigInt(dto.categoryId) apenas la clave está presente, y
    // BigInt(null) tira TypeError → 500 (§3.2). Verificado con node.
    expect('categoryId' in toStudentRequest({ ...draft, categoryId: null })).toBe(false);
  });

  it('OMITE birthDate cuando es null', () => {
    // El service hace `dto.birthDate ? new Date(dto.birthDate) : undefined`: mandarlo en
    // null no lo vacía, deja el campo intacto. Omitirlo tiene el mismo efecto y es honesto.
    expect('birthDate' in toStudentRequest({ ...draft, birthDate: null })).toBe(false);
  });

  it('SÍ manda null en los que se pueden vaciar', () => {
    const body = toStudentRequest({
      ...draft, firstName: null, lastName: null, dominantHand: null, ranking: null, notes: null,
    });
    expect(body.firstName).toBeNull();
    expect(body.lastName).toBeNull();
    expect(body.dominantHand).toBeNull();
    expect(body.ranking).toBeNull();
    expect(body.notes).toBeNull();
  });

  it('manda phone aunque el backend lo ignore en el PATCH', () => {
    // students.service.update() NO incluye phone en el data: de Prisma (§3.1). Se manda
    // igual para no tener dos schemas; el valor es el original porque el campo es readonly.
    expect(toStudentRequest(draft).phone).toBe('1155667788');
  });

  it('OMITE studentStatusId cuando es null', () => {
    // Es lo que pasa en el ALTA: CreateStudentDto no declara la clave, así que mandarla
    // haría rebotar la request entera con el ValidationPipe en whitelist.
    expect('studentStatusId' in toStudentRequest({ ...draft, studentStatusId: null })).toBe(false);
  });

  it('manda exactamente las claves del DTO del backend', () => {
    expect(Object.keys(toStudentRequest(draft)).sort())
      .toEqual(['birthDate', 'categoryId', 'dominantHand', 'firstName', 'lastName', 'notes', 'phone', 'ranking', 'studentStatusId']);
  });
});
