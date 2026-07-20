// Base de datos de códigos CIE-10 más comunes con sus palabras clave y recomendaciones de estudios y tratamientos
export const cie10Database = [
  {
    code: "I21.9",
    description: "Infarto agudo de miocardio, sin otra especificación",
    keywords: ["dolor de pecho", "brazo izquierdo", "infarto", "dolor de pecho y brazo izquierdo", "dificultad para respirar", "sudoracion fria", "opresion en pecho", "pecho apretado"],
    labs: ["Troponina I", "CK-MB", "Hemograma completo", "Electrólitos séricos (Sodio, Potasio, Magnesio)"],
    imaging: ["Electrocardiograma (EKG) de 12 derivaciones", "Radiografía de tórax AP"],
    medications: [
      { name: "Aspirina 100 mg", dosage: "3 tabletas masticadas inmediatamente (dosis de carga)", presentation: "Tabletas", quantity: "3 tabletas", duration: "1 día" },
      { name: "Clopidogrel 75 mg", dosage: "4 tabletas vía oral inmediatamente (dosis de carga)", presentation: "Tabletas", quantity: "4 tabletas", duration: "1 día" },
      { name: "Atorvastatina 40 mg", dosage: "2 tabletas vía oral inmediatamente", presentation: "Tabletas", quantity: "2 tabletas", duration: "1 día" }
    ],
    indications: [
      "Oxígeno suplementario si saturación es menor de 90%",
      "Monitoreo cardíaco y de signos vitales continuo",
      "Traslado de emergencia inmediato a hospital de tercer nivel con hemodinamia"
    ],
    genderRestriction: null,
    ageMin: 18,
    ageMax: null
  },
  {
    code: "I20.9",
    description: "Angina de pecho, no especificada",
    keywords: ["angina", "dolor de pecho", "brazo izquierdo", "opresion de pecho", "angina de pecho", "dolor precordial", "pecho"],
    labs: ["Troponina I", "Perfil lipídico completo", "Glucosa en ayunas", "Creatinina en suero"],
    imaging: ["Electrocardiograma (EKG) en reposo", "Prueba de esfuerzo cardíaco", "Ecocardiograma transtorácico"],
    medications: [
      { name: "Nitroglicerina 0.5 mg sublingual", dosage: "1 tableta debajo de la lengua ante dolor (repetir max 3 veces)", presentation: "Tabletas", quantity: "4 tabletas", duration: "Según necesidad" },
      { name: "Atenolol 50 mg", dosage: "1 tableta diaria por la mañana", presentation: "Tabletas", quantity: "30 tabletas", duration: "Continuo" }
    ],
    indications: [
      "Reposo absoluto durante los episodios de dolor",
      "Dieta hiposódica y baja en grasas saturadas",
      "Evitar situaciones de estrés emocional y esfuerzos físicos intensos"
    ],
    genderRestriction: null,
    ageMin: 18,
    ageMax: null
  },
  {
    code: "R07.4",
    description: "Dolor en el pecho, no especificado",
    keywords: ["dolor en pecho", "dolor toracico", "punzada de pecho", "pecho apretado", "dolor de pecho"],
    labs: ["Troponina I", "Hemograma completo", "Creatinina"],
    imaging: ["Electrocardiograma (EKG) de 12 derivaciones", "Radiografía de tórax AP y Lateral"],
    medications: [
      { name: "Acetaminofén 500 mg", dosage: "1 tableta cada 8 horas si hay dolor leve", presentation: "Tabletas", quantity: "20 tabletas", duration: "3 días" }
    ],
    indications: [
      "Reposo y control de signos vitales en observación",
      "Acudir inmediatamente a urgencias si el dolor se irradia a brazo izquierdo, cuello o mandíbula"
    ],
    genderRestriction: null,
    ageMin: null,
    ageMax: null
  },
  {
    code: "J00",
    description: "Rinofaringitis aguda (Resfriado común)",
    keywords: ["gripe", "resfriado", "tos", "fiebre", "congestion", "mocos", "estornudo", "garganta"],
    labs: ["Hemograma completo", "Proteína C Reactiva (PCR)"],
    imaging: ["Radiografía de tórax (solo si hay complicación respiratoria)"],
    medications: [
      { name: "Acetaminofén 500 mg", dosage: "1 tableta cada 6-8 horas si hay fiebre o dolor", presentation: "Tabletas", quantity: "30 tabletas", duration: "3-5 días" },
      { name: "Loratadina 10 mg", dosage: "1 tableta diaria por la noche", presentation: "Tabletas", quantity: "10 tabletas", duration: "10 días" }
    ],
    indications: [
      "Abundante hidratación oral",
      "Reposo relativo por 3 días"
    ],
    genderRestriction: null,
    ageMin: null,
    ageMax: null
  },
  {
    code: "J18.9",
    description: "Neumonía, no especificada",
    keywords: ["dificultad para respirar", "tos con flema", "dolor de pecho", "fiebre alta", "crepitantes", "neumonia", "pulmonia"],
    labs: ["Hemograma completo", "Cultivo de esputo", "Proteína C Reactiva (PCR)"],
    imaging: ["Radiografía de tórax AP y Lateral", "Tomografía Computarizada (TC) de tórax (sospecha de derrame)"],
    medications: [
      { name: "Amoxicilina 1 g", dosage: "1 tableta cada 8 horas", presentation: "Tabletas", quantity: "21 tabletas", duration: "7 días" },
      { name: "Claritromicina 500 mg", dosage: "1 tableta cada 12 horas", presentation: "Tabletas", quantity: "14 tabletas", duration: "7 días" }
    ],
    indications: [
      "Nebulizaciones con Solución Salina",
      "Control de oximetría de pulso y reposo absoluto"
    ],
    genderRestriction: null,
    ageMin: null,
    ageMax: null
  },
  {
    code: "E11.9",
    description: "Diabetes mellitus tipo 2, sin mención de complicación",
    keywords: ["poliuria", "polidipsia", "perdida de peso", "fatiga", "glucosa alta", "azucar", "diabetes", "sed", "orina frecuente"],
    labs: ["Glucosa en ayunas", "Hemoglobina Glicosilada (HbA1c)", "Creatinina en suero", "Examen General de Orina (EGO)", "Microalbuminuria"],
    imaging: ["Ultrasonido renal y de vías urinarias (tamizaje de nefropatía)", "Fondo de ojo (evaluación anual de retina)"],
    medications: [
      { name: "Metformina 850 mg", dosage: "1 tableta con la cena o almuerzo", presentation: "Tabletas", quantity: "60 tabletas", duration: "Continuo" },
      { name: "Glibenclamida 5 mg", dosage: "1 tableta en ayunas si lo requiere", presentation: "Tabletas", quantity: "30 tabletas", duration: "Continuo" }
    ],
    indications: [
      "Plan de alimentación bajo en carbohidratos simples",
      "Ejercicio aeróbico moderado (150 minutos semanales)"
    ],
    genderRestriction: null,
    ageMin: 12,
    ageMax: null
  },
  {
    code: "I10",
    description: "Hipertensión esencial (primaria)",
    keywords: ["presion alta", "cefalea", "dolor de cabeza", "tinnitus", "mareo", "zumbido", "hipertension", "presion"],
    labs: ["Perfil Lipídico completo (Colesterol, Triglicéridos, HDL, LDL)", "Creatinina", "Electrólitos séricos (Sodio, Potasio)", "Examen General de Orina (EGO)"],
    imaging: ["Electrocardiograma (EKG) de 12 derivaciones", "Ecocardiograma transtorácico"],
    medications: [
      { name: "Losartán Potásico 50 mg", dosage: "1 tableta cada 24 horas por la mañana", presentation: "Tabletas", quantity: "30 tabletas", duration: "Continuo" },
      { name: "Amlodipina 5 mg", dosage: "1 tableta diaria por la mañana", presentation: "Tabletas", quantity: "30 tabletas", duration: "Continuo" }
    ],
    indications: [
      "Dieta hiposódica (baja en sal)",
      "Monitoreo diario de la presión arterial en casa"
    ],
    genderRestriction: null,
    ageMin: 12,
    ageMax: null
  },
  {
    code: "U07.1",
    description: "COVID-19, virus identificado",
    keywords: ["covid", "coronavirus", "perdida de olfato", "anosmia", "perdida de gusto", "disgeusia", "tos seca", "fiebre", "cansancio"],
    labs: ["Prueba rápida de antígeno para COVID-19", "RT-PCR para SARS-CoV-2", "Dímero D", "Ferritina"],
    imaging: ["Radiografía de tórax", "Tomografía Computarizada (TC) de tórax de alta resolución"],
    medications: [
      { name: "Acetaminofén 1 g", dosage: "1 tableta cada 8 horas si hay fiebre o dolor", presentation: "Tabletas", quantity: "20 tabletas", duration: "5 días" },
      { name: "Vitamina C 500 mg + Zinc", dosage: "1 tableta diaria por la mañana", presentation: "Tabletas", quantity: "30 tabletas", duration: "30 días" }
    ],
    indications: [
      "Aislamiento domiciliar por 5-7 días",
      "Control de oximetría (consultar al médico si es menor de 93%)"
    ],
    genderRestriction: null,
    ageMin: null,
    ageMax: null
  },
  {
    code: "K21.9",
    description: "Enfermedad del reflujo gastroesofágico sin esofagitis",
    keywords: ["acidez", "reflujo", "dolor de estomago", "quemazon", "pirosis", "gastritis", "agruras", "ardor de pecho"],
    labs: ["Helicobacter pylori en heces", "Sangre oculta en heces"],
    imaging: ["Endoscopia de vías digestivas altas (EVDA)", "Serie esófago-gastroduodenal"],
    medications: [
      { name: "Omeprazol 20 mg", dosage: "1 cápsula en ayunas 30 minutos antes del desayuno", presentation: "Cápsulas", quantity: "28 cápsulas", duration: "28 días" },
      { name: "Trimebutina 200 mg", dosage: "1 tableta antes de cada comida (3 veces al día)", presentation: "Tabletas", quantity: "30 tabletas", duration: "10 días" }
    ],
    indications: [
      "Evitar comidas grasas, picantes, café y tabaco",
      "No acostarse inmediatamente después de comer (esperar 2 horas)"
    ],
    genderRestriction: null,
    ageMin: null,
    ageMax: null
  },
  {
    code: "N39.0",
    description: "Infección de vías urinarias, sitio no especificado",
    keywords: ["dolor al orinar", "disuria", "orina turbia", "fiebre", "dolor lumbar", "infeccion urinaria", "cistitis", "mal de orin"],
    labs: ["Examen General de Orina (EGO)", "Urocultivo con antibiograma"],
    imaging: ["Ultrasonido renal y vesical (si hay sospecha de litiasis o recurrencia)"],
    medications: [
      { name: "Nitrofurantoína 100 mg", dosage: "1 cápsula cada 12 horas con alimentos", presentation: "Cápsulas", quantity: "14 cápsulas", duration: "7 días" },
      { name: "Ciprofloxacina 500 mg", dosage: "1 tableta cada 12 horas", presentation: "Tabletas", quantity: "6 tabletas", duration: "3 días" }
    ],
    indications: [
      "Abundante ingesta de agua (2 a 3 litros diarios)",
      "Evitar retener la orina"
    ],
    genderRestriction: null,
    ageMin: null,
    ageMax: null
  },
  {
    code: "M54.5",
    description: "Lumbago no especificado (Lumbalgia)",
    keywords: ["dolor lumbar", "dolor de espalda", "lumbalgia", "ciatica", "dolor de cadera", "tiron", "espalda baja"],
    labs: [],
    imaging: ["Radiografía de columna lumbosacra (AP y Lateral)", "Resonancia Magnética (RMN) de columna lumbar"],
    medications: [
      { name: "Ibuprofeno 400 mg", dosage: "1 tableta cada 8 horas", presentation: "Tabletas", quantity: "15 tabletas", duration: "5 días" },
      { name: "Complejo B", dosage: "1 tableta cada 12 horas", presentation: "Tabletas", quantity: "20 tabletas", duration: "10 días" }
    ],
    indications: [
      "Calor local seco en la zona lumbar baja por 20 minutos",
      "Evitar levantar cargas pesadas y guardar reposo en cama firme"
    ],
    genderRestriction: null,
    ageMin: null,
    ageMax: null
  },
  {
    code: "J45.9",
    description: "Asma, no especificada",
    keywords: ["silbido de pecho", "sibilancias", "ahogo", "dificultad para respirar", "disnea", "asma", "alergia"],
    labs: ["IgE total sérica", "Hemograma (conteo de eosinófilos)"],
    imaging: ["Radiografía de tórax (descarte de infecciones)", "Espirometría simple y con broncodilatador"],
    medications: [
      { name: "Salbutamol inhalador 100 mcg", dosage: "2 atomizaciones cada 4-6 horas en caso de crisis", presentation: "Inhalador", quantity: "1 dispositivo", duration: "Según necesidad" },
      { name: "Fluticasona Propionato 50 mcg", dosage: "2 inhalaciones cada 12 horas", presentation: "Inhalador", quantity: "1 dispositivo", duration: "Continuo" }
    ],
    indications: [
      "Evitar alérgenos conocidos (polvo, mascotas, humo de tabaco)",
      "Control estricto de crisis con flujómetro"
    ],
    genderRestriction: null,
    ageMin: null,
    ageMax: null
  },
  {
    code: "K29.7",
    description: "Gastritis, no especificada",
    keywords: ["gastritis", "dolor de estomago", "nauseas", "vomito", "indigestión", "dispepsia", "dolor en epigastrio"],
    labs: ["Prueba de aliento para Helicobacter pylori", "Hemograma (para evaluar anemia)"],
    imaging: ["Endoscopia de vías digestivas altas (EVDA)"],
    medications: [
      { name: "Esomeprazol 40 mg", dosage: "1 tableta diaria en ayunas", presentation: "Tabletas", quantity: "28 tabletas", duration: "28 días" },
      { name: "Hidróxido de Aluminio y Magnesio", dosage: "1 cucharada (15 mL) 1 hora después de las comidas", presentation: "Suspensión", quantity: "1 frasco", duration: "10 días" }
    ],
    indications: [
      "Dieta blanda y fraccionada (comer 5 veces al día en porciones pequeñas)",
      "Evitar consumo de AINEs (como Ibuprofeno, Aspirina o Diclofenaco)"
    ],
    genderRestriction: null,
    ageMin: null,
    ageMax: null
  },
  {
    code: "N93.9",
    description: "Hemorragia vaginal y uterina anormal, no especificada",
    keywords: ["sangrado vaginal", "hemorragia vaginal", "menstruacion abundante", "sangrado uterino", "flujo rojo", "manchado vaginal", "sangrado de 3 dias", "sangrado menstrual"],
    labs: ["Prueba de embarazo (Beta-hCG cuantitativa)", "Hemograma completo (evaluación de anemia)", "Tiempos de coagulación (TP y TPT)"],
    imaging: ["Ultrasonido pélvico transvaginal", "Ultrasonido obstétrico (sospecha de gestación)"],
    medications: [
      { name: "Ácido Tranexámico 500 mg", dosage: "1 tableta cada 8 horas", presentation: "Tabletas", quantity: "10 tabletas", duration: "3 días" },
      { name: "Suplemento de Hierro", dosage: "1 tableta diaria con alimentos", presentation: "Tabletas", quantity: "30 tabletas", duration: "30 días" }
    ],
    indications: [
      "Reposo físico y evitar esfuerzo pesado",
      "Evitar relaciones sexuales durante el sangrado activo"
    ],
    genderRestriction: "Femenino",
    ageMin: 9,
    ageMax: 60
  },
  {
    code: "O20.0",
    description: "Amenaza de aborto (embarazo con sangrado)",
    keywords: ["amenaza de aborto", "embarazo con sangrado", "sangrado en embarazo", "gestacion con sangrado", "dolor bajo vientre embarazo"],
    labs: ["Beta-hCG cuantitativa seriada", "Hemograma completo", "Clasificación de grupo sanguíneo y factor Rh (Coombs indirecto)"],
    imaging: ["Ultrasonido obstétrico transvaginal/pélvico para verificar viabilidad fetal"],
    medications: [
      { name: "Progesterona micronizada 200 mg", dosage: "1 cápsula vía vaginal cada 24 horas por la noche", presentation: "Cápsulas", quantity: "15 cápsulas", duration: "15 días" }
    ],
    indications: [
      "Reposo absoluto en cama",
      "Abstinencia sexual estricta",
      "Consultar de urgencia ante incremento de dolor o sangrado vaginal"
    ],
    genderRestriction: "Femenino",
    ageMin: 10,
    ageMax: 50
  },
  {
    code: "N94.6",
    description: "Dismenorrea, no especificada (cólicos menstruales)",
    keywords: ["dolor menstrual", "colicos menstruales", "dismenorrea", "dolor de regla", "regla dolorosa", "dolor bajo vientre periodo"],
    labs: ["Examen General de Orina (EGO) (descarte de infección urinaria)"],
    imaging: ["Ultrasonido pélvico ginecológico (descarte de miomas o endometriosis)"],
    medications: [
      { name: "Ibuprofeno 400 mg", dosage: "1 tableta cada 8 horas con alimentos al iniciar dolor", presentation: "Tabletas", quantity: "10 tabletas", duration: "3 días" }
    ],
    indications: [
      "Calor local en vientre bajo por 20 minutos",
      "Infusiones calientes de manzanilla o té de hierbas"
    ],
    genderRestriction: "Femenino",
    ageMin: 9,
    ageMax: 55
  },
  {
    code: "N76.0",
    description: "Vaginitis aguda",
    keywords: ["flujo vaginal", "picazon vaginal", "prurito vulvar", "descarga vaginal", "olor vaginal", "flujo blanco", "flujo amarillo", "infeccion vaginal"],
    labs: ["Frotis vaginal con tinción de Gram y cultivo", "Examen general de orina"],
    imaging: [],
    medications: [
      { name: "Metronidazol 500 mg", dosage: "1 tableta cada 12 horas", presentation: "Tabletas", quantity: "14 tabletas", duration: "7 días" },
      { name: "Fluconazol 150 mg", dosage: "1 cápsula dosis única vía oral", presentation: "Cápsulas", quantity: "1 cápsula", duration: "1 día" },
      { name: "Óvulos de Clotrimazol 100 mg", dosage: "1 óvulo vaginal diario por la noche", presentation: "Cápsulas", quantity: "6 óvulos", duration: "6 días" }
    ],
    indications: [
      "Evitar relaciones sexuales durante el tratamiento",
      "Tratamiento en pareja para evitar reinfección"
    ],
    genderRestriction: "Femenino",
    ageMin: 2,
    ageMax: 90
  }
];

// Función para sugerir diagnósticos y estudios basados en el texto, género y edad
export function searchDiagnosticSuggestions(text, gender, age) {
  if (!text || text.trim().length < 3) return [];
  
  const query = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Normalizar acentos
  const words = query.split(/\s+/).filter(w => w.length > 2);
  
  if (words.length === 0) return [];
  
  const results = [];
  
  for (const item of cie10Database) {
    // 1. Filtrado por género
    if (item.genderRestriction && gender && gender !== "Otro" && item.genderRestriction.toLowerCase() !== gender.toLowerCase()) {
      continue;
    }
    
    // 2. Filtrado por edad
    if (age !== undefined && age !== null) {
      if (item.ageMin !== null && age < item.ageMin) continue;
      if (item.ageMax !== null && age > item.ageMax) continue;
    }

    let score = 0;
    
    // Normalizar campos de búsqueda
    const normCode = item.code.toLowerCase();
    const normDesc = item.description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Coincidencia exacta con el código
    if (normCode.includes(query)) {
      score += 100;
    }
    
    // Coincidencia exacta de frases completas en palabras clave o descripción
    item.keywords.forEach(kw => {
      const normKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (query.includes(normKw) || normKw.includes(query)) {
        score += 50; 
      }
    });

    if (normDesc.includes(query)) {
      score += 40;
    }
    
    // Coincidencia por palabras individuales únicas (sin acumulación duplicada)
    const matchedWords = new Set();
    const allTextToSearch = normDesc + " " + item.keywords.map(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")).join(" ");
    
    words.forEach(word => {
      if (allTextToSearch.includes(word)) {
        matchedWords.add(word);
      }
    });

    // Puntuación según cantidad de palabras únicas de consulta encontradas en el diagnóstico
    score += matchedWords.size * 10;

    if (score > 0) {
      results.push({
        ...item,
        score
      });
    }
  }
  
  // Ordenar por puntaje descendente
  return results.sort((a, b) => b.score - a.score);
}
