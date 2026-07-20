// Base de datos de todos los estudios de laboratorio e imagenología comunes para todas las patologías
export const laboratoryTests = [
  { id: "l1", name: "Hemograma completo (Biometría Hemática)", category: "Hematología" },
  { id: "l2", name: "Glucosa en ayunas", category: "Química Clínica" },
  { id: "l3", name: "Hemoglobina Glicosilada (HbA1c)", category: "Química Clínica" },
  { id: "l4", name: "Creatinina sérica", category: "Función Renal" },
  { id: "l5", name: "Nitrógeno de Urea (BUN)", category: "Función Renal" },
  { id: "l6", name: "Ácido Úrico", category: "Química Clínica" },
  { id: "l7", name: "Colesterol Total", category: "Perfil Lipídico" },
  { id: "l8", name: "Triglicéridos", category: "Perfil Lipídico" },
  { id: "l9", name: "Colesterol HDL", category: "Perfil Lipídico" },
  { id: "l10", name: "Colesterol LDL", category: "Perfil Lipídico" },
  { id: "l11", name: "Perfil Lipídico Completo", category: "Perfil Lipídico" },
  { id: "l12", name: "Transaminasas (TGO / AST)", category: "Función Hepática" },
  { id: "l13", name: "Transaminasas (TGP / ALT)", category: "Función Hepática" },
  { id: "l14", name: "Bilirrubinas (Total, Directa e Indirecta)", category: "Función Hepática" },
  { id: "l15", name: "Fosfatasa Alcalina", category: "Función Hepática" },
  { id: "l16", name: "Albúmina en suero", category: "Función Hepática" },
  { id: "l17", name: "Perfil Hepático Completo", category: "Función Hepática" },
  { id: "l18", name: "Hormona Estimulante de la Tiroides (TSH)", category: "Endocrinología / Tiroides" },
  { id: "l19", name: "T4 Libre (Tiroxina libre)", category: "Endocrinología / Tiroides" },
  { id: "l20", name: "T3 Libre (Triyodotironina libre)", category: "Endocrinología / Tiroides" },
  { id: "l21", name: "Examen General de Orina (EGO)", category: "Uroanálisis" },
  { id: "l22", name: "Urocultivo con antibiograma", category: "Microbiología" },
  { id: "l23", name: "Examen coprológico (Heces por parásitos)", category: "Coprología" },
  { id: "l24", name: "Sangre oculta en heces (Guayaco / Inmunológica)", category: "Coprología" },
  { id: "l25", name: "Coprocultivo", category: "Microbiología" },
  { id: "l26", name: "Proteína C Reactiva (PCR) Cuantitativa", category: "Inmunología / Inflamación" },
  { id: "l27", name: "Velocidad de Sedimentación Globular (VSG)", category: "Hematología" },
  { id: "l28", name: "Tiempo de Protrombina (TP) e INR", category: "Coagulación" },
  { id: "l29", name: "Tiempo de Tromboplastina Parcial (TPT)", category: "Coagulación" },
  { id: "l30", name: "Electrólitos Séricos (Sodio, Potasio, Cloro)", category: "Química Clínica" },
  { id: "l31", name: "Calcio, Fósforo y Magnesio séricos", category: "Química Clínica" },
  { id: "l32", name: "Depuración de Creatinina en Orina de 24 horas", category: "Función Renal" },
  { id: "l33", name: "Microalbuminuria en Orina", category: "Función Renal" },
  { id: "l34", name: "Gasometría Arterial", category: "Gases Arteriales" },
  { id: "l35", name: "Factor Reumatoide (FR)", category: "Inmunología" },
  { id: "l36", name: "Antígeno Prostático Específico (PSA) Total", category: "Marcadores Tumorales" },
  { id: "l37", name: "Antígeno Prostático Específico (PSA) Libre", category: "Marcadores Tumorales" },
  { id: "l38", name: "Prueba de Embarazo en Sangre (Beta-hCG Cuantitativa)", category: "Hormonas / Obstetricia" },
  { id: "l39", name: "Prueba de Embarazo Cualitativa (Orina / Sangre)", category: "Hormonas / Obstetricia" },
  { id: "l40", name: "VDRL / RPR (Descarte de Sífilis)", category: "Inmunología / Serología" },
  { id: "l41", name: "Pruebas de VIH 1 y 2 (Antígenos y Anticuerpos)", category: "Serología" },
  { id: "l42", name: "Anticuerpos Antinucleares (ANA)", category: "Inmunología / Autoanticuerpos" },
  { id: "l43", name: "Amilasa sérica", category: "Enzimas Pancreáticas" },
  { id: "l44", name: "Lipasa sérica", category: "Enzimas Pancreáticas" },
  { id: "l45", name: "Cultivo de Secreción Faríngea", category: "Microbiología" },
  { id: "l46", name: "Antígenos Febriles", category: "Serología" },
  { id: "l47", name: "Helicobacter pylori en Heces", category: "Microbiología" },
  { id: "l48", name: "Dímero D", category: "Coagulación / Trombosis" },
  { id: "l49", name: "Troponina I (Alta Sensibilidad)", category: "Marcadores Cardíacos" },
  { id: "l50", name: "Ferritina sérica", category: "Hematología / Hierro" },
  { id: "l51", name: "Hierro Sérico y Capacidad de Fijación (TIBC)", category: "Hematología / Hierro" },
  { id: "l52", name: "Electroforesis de Proteínas en Suero", category: "Química Clínica" }
];

export const imagingStudies = [
  { id: "i1", name: "Rayos X (Rx) de Tórax (PA y Lateral)", category: "Radiología Convencional" },
  { id: "i2", name: "Rayos X (Rx) de Columna Cervical (AP y Lateral)", category: "Radiología Convencional" },
  { id: "i3", name: "Rayos X (Rx) de Columna Dorsal (AP y Lateral)", category: "Radiología Convencional" },
  { id: "i4", name: "Rayos X (Rx) de Columna Lumbosacra (AP y Lateral)", category: "Radiología Convencional" },
  { id: "i5", name: "Rayos X (Rx) de Abdomen Simple (De pie y decúbito)", category: "Radiología Convencional" },
  { id: "i6", name: "Rayos X (Rx) de Senos Paranasales (Caldwell y Waters)", category: "Radiología Convencional" },
  { id: "i7", name: "Rayos X (Rx) de Mano o Muñeca (Edad Ósea / Trauma)", category: "Radiología Convencional" },
  { id: "i8", name: "Rayos X (Rx) de Cadera Bilateral o Pelvis (AP)", category: "Radiología Convencional" },
  { id: "i9", name: "Rayos X (Rx) de Rodilla (AP y Lateral / Con carga)", category: "Radiología Convencional" },
  { id: "i10", name: "Ultrasonido abdominal completo", category: "Ultrasonografía" },
  { id: "i11", name: "Ultrasonido de abdomen superior (Hígado y vías biliares)", category: "Ultrasonografía" },
  { id: "i12", name: "Ultrasonido renal y vesical (Vías Urinarias)", category: "Ultrasonografía" },
  { id: "i13", name: "Ultrasonido pélvico ginecológico (Suprapúbico)", category: "Ultrasonografía" },
  { id: "i14", name: "Ultrasonido transvaginal", category: "Ultrasonografía" },
  { id: "i15", name: "Ultrasonido obstétrico básico", category: "Ultrasonografía" },
  { id: "i16", name: "Ultrasonido obstétrico anatómico (Detalle fetal)", category: "Ultrasonografía" },
  { id: "i17", name: "Ultrasonido obstétrico con Doppler color de vasos fetales", category: "Ultrasonografía" },
  { id: "i18", name: "Ultrasonido de cuello y glándula tiroides", category: "Ultrasonografía" },
  { id: "i19", name: "Ultrasonido mamario bilateral", category: "Ultrasonografía" },
  { id: "i20", name: "Ultrasonido testicular con Doppler color", category: "Ultrasonografía" },
  { id: "i21", name: "Ultrasonido Doppler venoso de miembros inferiores (Doble pierna)", category: "Ultrasonografía" },
  { id: "i22", name: "Ultrasonido Doppler arterial de miembros inferiores (Doble pierna)", category: "Ultrasonografía" },
  { id: "i23", name: "Mamografía digital bilateral", category: "Mamografía" },
  { id: "i24", name: "Tomografía Computarizada (TC) de cráneo simple", category: "Tomografía" },
  { id: "i25", name: "Tomografía Computarizada (TC) de cráneo con contraste", category: "Tomografía" },
  { id: "i26", name: "Tomografía Computarizada (TC) de tórax de alta resolución", category: "Tomografía" },
  { id: "i27", name: "Tomografía Computarizada (TC) de abdomen y pelvis con doble contraste", category: "Tomografía" },
  { id: "i28", name: "Angiotomografía (Angio-TC) de arterias coronarias", category: "Tomografía" },
  { id: "i29", name: "Resonancia Magnética (RMN) de cerebro simple", category: "Resonancia Magnética" },
  { id: "i30", name: "Resonancia Magnética (RMN) de cerebro con gadolinio", category: "Resonancia Magnética" },
  { id: "i31", name: "Resonancia Magnética (RMN) de columna lumbar simple", category: "Resonancia Magnética" },
  { id: "i32", name: "Resonancia Magnética (RMN) de articulación de rodilla", category: "Resonancia Magnética" },
  { id: "i33", name: "Resonancia Magnética (RMN) de articulación de hombro", category: "Resonancia Magnética" },
  { id: "i34", name: "Ecocardiograma transtorácico con Doppler color", category: "Estudios Cardiológicos" },
  { id: "i35", name: "Densitometría ósea central (Columna lumbar y cadera)", category: "Densitometría" },
  { id: "i36", name: "Endoscopia de vías digestivas altas (EVDA)", category: "Procedimientos Diagnósticos" },
  { id: "i37", name: "Colonoscopia completa diagnóstica", category: "Procedimientos Diagnósticos" }
];

// Función para buscar laboratorios
export function searchLabs(query) {
  if (!query) return [];
  const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return laboratoryTests.filter(lab => {
    const cleanName = lab.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanCat = lab.category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return cleanName.includes(cleanQuery) || cleanCat.includes(cleanQuery);
  });
}

// Función para buscar estudios de imagen
export function searchImaging(query) {
  if (!query) return [];
  const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return imagingStudies.filter(img => {
    const cleanName = img.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanCat = img.category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return cleanName.includes(cleanQuery) || cleanCat.includes(cleanQuery);
  });
}
