import { DiagnosisCategory } from '@prisma/client';

export class DiagnosisService {
  private readonly activeCategories: DiagnosisCategory[] = [
    DiagnosisCategory.HIPERTENSI,
    DiagnosisCategory.NEUROLOGI,
    DiagnosisCategory.DIABETES,
    DiagnosisCategory.KARDIOVASKULAR,
    DiagnosisCategory.ORTOPEDI,
    DiagnosisCategory.IMUNOLOGI,
    DiagnosisCategory.HEMATOLOGI,
    DiagnosisCategory.ONKOLOGI,
    DiagnosisCategory.LAINNYA,
  ];

  async getCategories() {
    const categories = this.activeCategories.map((category) => ({
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
      STROKE: 'Stroke',
      JANTUNG_KARDIOVASKULAR: 'Jantung Kardiovascular',
      SINDROM_METABOLIK: 'Sindrom Metabolik',
      KANKER: 'Kanker',
      DEGENERATIF: 'Degeneratif',
      AUTO_IMUN: 'Auto Imun',
      ONKOLOGI: 'Onkologi',
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
      STROKE: 'Gangguan pembuluh darah otak dan pasca stroke',
      JANTUNG_KARDIOVASKULAR: 'Penyakit jantung dan pembuluh darah',
      SINDROM_METABOLIK: 'Obesitas, resistensi insulin, dislipidemia, dan hipertensi terkait metabolik',
      KANKER: 'Kondisi kanker dan pendampingan terapi terkait',
      DEGENERATIF: 'Penyakit degeneratif dan penurunan fungsi organ atau jaringan',
      AUTO_IMUN: 'Gangguan sistem imun yang menyerang jaringan tubuh sendiri',
      ONKOLOGI: 'Kondisi kanker, tumor, dan pendampingan terapi onkologi',
      LAINNYA: 'Kategori diagnosa lainnya',
    };

    return descriptions[category];
  }
}
