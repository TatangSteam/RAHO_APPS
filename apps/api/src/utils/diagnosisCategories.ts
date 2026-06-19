import { DiagnosisCategory } from '@prisma/client';

type DiagnosisCategoryInput = {
  kategoriDiagnosa?: DiagnosisCategory | null;
  kategoriDiagnosaList?: DiagnosisCategory[] | null;
};

const DIAGNOSIS_CATEGORIES = new Set<string>(Object.values(DiagnosisCategory));

export function normalizeDiagnosisCategories(input: DiagnosisCategoryInput) {
  const categories: DiagnosisCategory[] = [];

  if (Array.isArray(input.kategoriDiagnosaList)) {
    for (const category of input.kategoriDiagnosaList) {
      if (category && DIAGNOSIS_CATEGORIES.has(category)) {
        categories.push(category);
      }
    }
  }

  if (input.kategoriDiagnosa && DIAGNOSIS_CATEGORIES.has(input.kategoriDiagnosa)) {
    categories.unshift(input.kategoriDiagnosa);
  }

  const uniqueCategories = [...new Set(categories)];

  return {
    primaryCategory: uniqueCategories[0] ?? null,
    categoryList: uniqueCategories.length > 0 ? uniqueCategories : null,
  };
}

export function getDiagnosisCategoryList(input: {
  kategoriDiagnosa?: DiagnosisCategory | string | null;
  kategoriDiagnosaList?: unknown;
}) {
  if (Array.isArray(input.kategoriDiagnosaList)) {
    return input.kategoriDiagnosaList.filter(
      (category): category is DiagnosisCategory =>
        typeof category === 'string' && DIAGNOSIS_CATEGORIES.has(category),
    );
  }

  return input.kategoriDiagnosa && DIAGNOSIS_CATEGORIES.has(input.kategoriDiagnosa)
    ? [input.kategoriDiagnosa as DiagnosisCategory]
    : [];
}
