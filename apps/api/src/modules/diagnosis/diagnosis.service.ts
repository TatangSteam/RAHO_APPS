import { DiagnosisCategory } from '@prisma/client';

export class DiagnosisService {
  async getCategories() {
    // Return all diagnosis categories from enum
    const categories = Object.values(DiagnosisCategory).map((category) => ({
      value: category,
      label: this.getCategoryLabel(category),
      description: this.getCategoryDescription(category),
    }));

    return categories;
  }

  private getCategoryLabel(category: DiagnosisCategory): string {
    const labels: Record<DiagnosisCategory, string> = {
      HIPERTENSI: 'Hipertensi',
      NEUROLOGI: 'Neurologi',
      DIABETES: 'Diabetes',
      KARDIOVASKULAR: 'Kardiovaskular',
      ORTOPEDI: 'Ortopedi',
      IMUNOLOGI: 'Imunologi',
      HEMATOLOGI: 'Hematologi',
      LAINNYA: 'Lainnya',
    };

    return labels[category];
  }

  private getCategoryDescription(category: DiagnosisCategory): string {
    const descriptions: Record<DiagnosisCategory, string> = {
      HIPERTENSI: 'Penyakit tekanan darah tinggi dan komplikasinya',
      NEUROLOGI: 'Gangguan sistem saraf pusat dan perifer',
      DIABETES: 'Diabetes melitus dan komplikasinya',
      KARDIOVASKULAR: 'Penyakit jantung dan pembuluh darah',
      ORTOPEDI: 'Gangguan muskuloskeletal, tulang, dan sendi',
      IMUNOLOGI: 'Gangguan sistem kekebalan tubuh',
      HEMATOLOGI: 'Gangguan darah dan sistem hematopoietik',
      LAINNYA: 'Kategori diagnosa lainnya',
    };

    return descriptions[category];
  }
}
