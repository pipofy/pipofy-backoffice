import { describe, it, expect } from 'vitest';
import { createStudentDraft, studentDisplayName, StudentInput, Student } from './student';
import { InvalidStudentError, InvalidNumberError } from '../errors';

const base: StudentInput = {
  phone: '1155667788',
  firstName: 'Ana',
  lastName: 'Pérez',
  birthDate: '2001-05-03',
  categoryId: '4',
  studentStatusId: '2',
  dominantHand: 'diestro',
  ranking: '12',
  notes: 'Zurda para el revés',
};

const student: Student = {
  id: '1', phone: '1155667788', firstName: 'Ana', lastName: 'Pérez',
  birthDate: '2001-05-03', categoryId: '4', studentStatusId: '2',
  dominantHand: 'diestro', ranking: 12, notes: null,
};

describe('createStudentDraft', () => {
  it('arma el draft completo', () => {
    expect(createStudentDraft(base)).toEqual({
      phone: '1155667788',
      firstName: 'Ana',
      lastName: 'Pérez',
      birthDate: '2001-05-03',
      categoryId: '4',
      studentStatusId: '2',
      dominantHand: 'diestro',
      ranking: 12,
      notes: 'Zurda para el revés',
    });
  });

  it('exige teléfono', () => {
    expect(() => createStudentDraft({ ...base, phone: '  ' })).toThrow(InvalidStudentError);
    expect(() => createStudentDraft({ ...base, phone: '' })).toThrow('El teléfono es obligatorio.');
  });

  it('los opcionales vacíos quedan en null', () => {
    const draft = createStudentDraft({
      ...base, firstName: '', lastName: '  ', birthDate: '', categoryId: '',
      studentStatusId: '', dominantHand: '', ranking: '', notes: '   ',
    });
    expect(draft.firstName).toBeNull();
    expect(draft.lastName).toBeNull();
    expect(draft.birthDate).toBeNull();
    expect(draft.categoryId).toBeNull();
    expect(draft.dominantHand).toBeNull();
    expect(draft.ranking).toBeNull();
    expect(draft.notes).toBeNull();
  });

  it('rechaza un ranking decimal', () => {
    expect(() => createStudentDraft({ ...base, ranking: '1.5' })).toThrow(InvalidNumberError);
  });
});

describe('studentDisplayName', () => {
  it('apellido, nombre', () => {
    expect(studentDisplayName(student)).toBe('Pérez, Ana');
  });

  it('sólo lo que hay', () => {
    expect(studentDisplayName({ ...student, firstName: '' })).toBe('Pérez');
    expect(studentDisplayName({ ...student, lastName: '' })).toBe('Ana');
  });

  it('sin nombre cargado cae al teléfono', () => {
    // El backend sólo exige phone: hay alumnos que existen sin nombre.
    expect(studentDisplayName({ ...student, firstName: '', lastName: '' })).toBe('1155667788');
  });
});
