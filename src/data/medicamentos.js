// src/data/medicamentos.js
// Base de datos de medicamentos autorizados y comercializados en Guatemala (referencia del MSPAS / IGSS)
export const medicationsDatabase = [
  // Analgésicos y Antiinflamatorios
  { name: "Acetaminofén 500 mg", generic: "Paracetamol", presentation: "Tabletas", category: "Analgésicos" },
  { name: "Acetaminofén 1 g", generic: "Paracetamol", presentation: "Tabletas", category: "Analgésicos" },
  { name: "Acetaminofén 120 mg / 5 mL", generic: "Paracetamol", presentation: "Jarabe", category: "Analgésicos" },
  { name: "Ibuprofeno 400 mg", generic: "Ibuprofeno", presentation: "Tabletas", category: "Analgésicos" },
  { name: "Ibuprofeno 600 mg", generic: "Ibuprofeno", presentation: "Tabletas", category: "Analgésicos" },
  { name: "Ibuprofeno 100 mg / 5 mL", generic: "Ibuprofeno", presentation: "Suspensión", category: "Analgésicos" },
  { name: "Diclofenaco Sódico 75 mg / 3 mL", generic: "Diclofenaco", presentation: "Ampollas", category: "Analgésicos" },
  { name: "Diclofenaco Sódico 100 mg AP", generic: "Diclofenaco", presentation: "Cápsulas", category: "Analgésicos" },
  { name: "Naproxeno 500 mg", generic: "Naproxeno", presentation: "Tabletas", category: "Analgésicos" },
  { name: "Ketorolaco 10 mg", generic: "Ketorolaco", presentation: "Tabletas", category: "Analgésicos" },
  { name: "Ketorolaco 30 mg / mL", generic: "Ketorolaco", presentation: "Ampollas", category: "Analgésicos" },
  { name: "Meloxicam 15 mg", generic: "Meloxicam", presentation: "Tabletas", category: "Analgésicos" },
  { name: "Tramadol Clorhidrato 50 mg", generic: "Tramadol", presentation: "Cápsulas", category: "Analgésicos" },
  { name: "Tramadol Clorhidrato 100 mg / 2 mL", generic: "Tramadol", presentation: "Ampollas", category: "Analgésicos" },
  { name: "Celecoxib 200 mg", generic: "Celecoxib", presentation: "Cápsulas", category: "Analgésicos" },

  // Antibióticos e Infecciosos
  { name: "Amoxicilina 500 mg", generic: "Amoxicilina", presentation: "Cápsulas", category: "Antibióticos" },
  { name: "Amoxicilina 250 mg / 5 mL", generic: "Amoxicilina", presentation: "Suspensión", category: "Antibióticos" },
  { name: "Amoxicilina + Ácido Clavulánico 875/125 mg", generic: "Amoxicilina + Ácido Clavulánico", presentation: "Tabletas", category: "Antibióticos" },
  { name: "Amoxicilina + Ácido Clavulánico 400/57 mg / 5 mL", generic: "Amoxicilina + Ácido Clavulánico", presentation: "Suspensión", category: "Antibióticos" },
  { name: "Azitromicina 500 mg", generic: "Azitromicina", presentation: "Tabletas", category: "Antibióticos" },
  { name: "Azitromicina 200 mg / 5 mL", generic: "Azitromicina", presentation: "Suspensión", category: "Antibióticos" },
  { name: "Ciprofloxacina 500 mg", generic: "Ciprofloxacina", presentation: "Tabletas", category: "Antibióticos" },
  { name: "Cefalexina 500 mg", generic: "Cefalexina", presentation: "Cápsulas", category: "Antibióticos" },
  { name: "Cefalexina 250 mg / 5 mL", generic: "Cefalexina", presentation: "Suspensión", category: "Antibióticos" },
  { name: "Claritromicina 500 mg", generic: "Claritromicina", presentation: "Tabletas", category: "Antibióticos" },
  { name: "Doxiciclina 100 mg", generic: "Doxiciclina", presentation: "Cápsulas", category: "Antibióticos" },
  { name: "Ceftriaxona 1 g (IM/IV)", generic: "Ceftriaxona", presentation: "Ampollas", category: "Antibióticos" },
  { name: "Nitrofurantoína 100 mg", generic: "Nitrofurantoína", presentation: "Cápsulas", category: "Antibióticos" },

  // Antihistamínicos y Antiasmáticos (Respiratorios)
  { name: "Loratadina 10 mg", generic: "Loratadina", presentation: "Tabletas", category: "Respiratorios" },
  { name: "Loratadina 5 mg / 5 mL", generic: "Loratadina", presentation: "Jarabe", category: "Respiratorios" },
  { name: "Cetirizina 10 mg", generic: "Cetirizina", presentation: "Tabletas", category: "Respiratorios" },
  { name: "Cetirizina 5 mg / 5 mL", generic: "Cetirizina", presentation: "Jarabe", category: "Respiratorios" },
  { name: "Desloratadina 5 mg", generic: "Desloratadina", presentation: "Tabletas", category: "Respiratorios" },
  { name: "Clorfeniramina Maleato 4 mg", generic: "Clorfeniramina", presentation: "Tabletas", category: "Respiratorios" },
  { name: "Salbutamol 100 mcg / dosis", generic: "Salbutamol", presentation: "Inhalador", category: "Respiratorios" },
  { name: "Salbutamol 2 mg / 5 mL", generic: "Salbutamol", presentation: "Jarabe", category: "Respiratorios" },
  { name: "Fluticasona Propionato 50 mcg / dosis", generic: "Fluticasona", presentation: "Inhalador", category: "Respiratorios" },
  { name: "Montelukast 10 mg", generic: "Montelukast", presentation: "Tabletas", category: "Respiratorios" },
  { name: "Montelukast 4 mg (Masticable)", generic: "Montelukast", presentation: "Tabletas", category: "Respiratorios" },
  { name: "Ambroxol Clorhidrato 30 mg / 5 mL", generic: "Ambroxol", presentation: "Jarabe", category: "Respiratorios" },
  { name: "Dextrometorfano Bromhidrato 15 mg / 5 mL", generic: "Dextrometorfano", presentation: "Jarabe", category: "Respiratorios" },

  // Cardiovasculares y Antihypertensivos
  { name: "Losartán Potásico 50 mg", generic: "Losartán", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Losartán Potásico 100 mg", generic: "Losartán", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Enalapril Maleato 20 mg", generic: "Enalapril", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Enalapril Maleato 10 mg", generic: "Enalapril", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Amlodipina 5 mg", generic: "Amlodipina", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Amlodipina 10 mg", generic: "Amlodipina", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Atenolol 50 mg", generic: "Atenolol", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Hidroclorotiazida 25 mg", generic: "Hidroclorotiazida", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Irbesartán 150 mg", generic: "Irbesartán", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Irbesartán 300 mg", generic: "Irbesartán", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Carvedilol 6.25 mg", generic: "Carvedilol", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Carvedilol 25 mg", generic: "Carvedilol", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Espironolactona 25 mg", generic: "Espironolactona", presentation: "Tabletas", category: "Cardiovasculares" },
  { name: "Atorvastatina 20 mg", generic: "Atorvastatina", presentation: "Tabletas", category: "Hipolipemiantes" },
  { name: "Atorvastatina 40 mg", generic: "Atorvastatina", presentation: "Tabletas", category: "Hipolipemiantes" },
  { name: "Rosuvastatina 10 mg", generic: "Rosuvastatina", presentation: "Tabletas", category: "Hipolipemiantes" },
  { name: "Gemfibrozilo 600 mg", generic: "Gemfibrozilo", presentation: "Tabletas", category: "Hipolipemiantes" },

  // Antidiabéticos y Endocrinología
  { name: "Metformina Clorhidrato 850 mg", generic: "Metformina", presentation: "Tabletas", category: "Antidiabéticos" },
  { name: "Metformina Clorhidrato 1000 mg", generic: "Metformina", presentation: "Tabletas", category: "Antidiabéticos" },
  { name: "Glibenclamida 5 mg", generic: "Glibenclamida", presentation: "Tabletas", category: "Antidiabéticos" },
  { name: "Sitagliptina 100 mg", generic: "Sitagliptina", presentation: "Tabletas", category: "Antidiabéticos" },
  { name: "Empagliflozina 10 mg", generic: "Empagliflozina", presentation: "Tabletas", category: "Antidiabéticos" },
  { name: "Insulina Glargina 100 UI / mL (Lantus)", generic: "Insulina Glargina", presentation: "Ampollas", category: "Antidiabéticos" },
  { name: "Levotiroxina Sódica 50 mcg", generic: "Levotiroxina", presentation: "Tabletas", category: "Endócrino" },
  { name: "Levotiroxina Sódica 100 mcg", generic: "Levotiroxina", presentation: "Tabletas", category: "Endócrino" },

  // Gastrointestinales
  { name: "Omeprazol 20 mg", generic: "Omeprazol", presentation: "Cápsulas", category: "Gastrointestinales" },
  { name: "Omeprazol 40 mg (IV)", generic: "Omeprazol", presentation: "Ampollas", category: "Gastrointestinales" },
  { name: "Esomeprazol 40 mg", generic: "Esomeprazol", presentation: "Tabletas", category: "Gastrointestinales" },
  { name: "Lansoprazol 30 mg", generic: "Lansoprazol", presentation: "Cápsulas", category: "Gastrointestinales" },
  { name: "Metoclopramida Clorhidrato 10 mg", generic: "Metoclopramida", presentation: "Tabletas", category: "Gastrointestinales" },
  { name: "Metoclopramida Clorhidrato 10 mg / 2 mL", generic: "Metoclopramida", presentation: "Ampollas", category: "Gastrointestinales" },
  { name: "Domperidona 10 mg", generic: "Domperidona", presentation: "Tabletas", category: "Gastrointestinales" },
  { name: "Ondansetrón 8 mg", generic: "Ondansetrón", presentation: "Tabletas", category: "Gastrointestinales" },
  { name: "Trimebutina Maleato 200 mg", generic: "Trimebutina", presentation: "Tabletas", category: "Gastrointestinales" },
  { name: "Subsalicilato de Bismuto 262 mg", generic: "Subsalicilato de Bismuto", presentation: "Tabletas", category: "Gastrointestinales" },
  { name: "Hidróxido de Aluminio y Magnesio (Mylanta)", generic: "Hidróxido de Al y Mg", presentation: "Suspensión", category: "Gastrointestinales" },

  // Neuropsiquiatría
  { name: "Sertralina 50 mg", generic: "Sertralina", presentation: "Tabletas", category: "Neuropsiquiatría" },
  { name: "Sertralina 100 mg", generic: "Sertralina", presentation: "Tabletas", category: "Neuropsiquiatría" },
  { name: "Fluoxetina 20 mg", generic: "Fluoxetina", presentation: "Cápsulas", category: "Neuropsiquiatría" },
  { name: "Clonazepam 2 mg", generic: "Clonazepam", presentation: "Tabletas", category: "Neuropsiquiatría" },
  { name: "Alprazolam 0.5 mg", generic: "Alprazolam", presentation: "Tabletas", category: "Neuropsiquiatría" },
  { name: "Gabapentina 300 mg", generic: "Gabapentina", presentation: "Cápsulas", category: "Neuropsiquiatría" },
  { name: "Pregabalina 75 mg", generic: "Pregabalina", presentation: "Cápsulas", category: "Neuropsiquiatría" },
  { name: "Carbamazepina 200 mg", generic: "Carbamazepina", presentation: "Tabletas", category: "Neuropsiquiatría" },

  // Antimicóticos y Antiparasitarios
  { name: "Fluconazol 150 mg", generic: "Fluconazol", presentation: "Cápsulas", category: "Antiparasitarios" },
  { name: "Ketoconazol 2% (Tópico)", generic: "Ketoconazol", presentation: "Crema/Pomada", category: "Antiparasitarios" },
  { name: "Metronidazol 500 mg", generic: "Metronidazol", presentation: "Tabletas", category: "Antiparasitarios" },
  { name: "Metronidazol 250 mg / 5 mL", generic: "Metronidazol", presentation: "Suspensión", category: "Antiparasitarios" },
  { name: "Albendazol 400 mg", generic: "Albendazol", presentation: "Tabletas", category: "Antiparasitarios" },
  { name: "Ivermectina 6 mg", generic: "Ivermectina", presentation: "Tabletas", category: "Antiparasitarios" },

  // Nutricionales y Suplementos
  { name: "Ácido Fólico 5 mg", generic: "Ácido Fólico", presentation: "Tabletas", category: "Suplementos" },
  { name: "Sulfato Ferroso 300 mg (Hierro)", generic: "Sulfato Ferroso", presentation: "Tabletas", category: "Suplementos" },
  { name: "Vitamina C 500 mg (Masticable)", generic: "Ácido Ascórbico", presentation: "Tabletas", category: "Suplementos" },
  { name: "Complejo B (Neurobión)", generic: "Vitaminas B1, B6, B12", presentation: "Tabletas", category: "Suplementos" },
  { name: "Complejo B Inyectable", generic: "Vitaminas B1, B6, B12", presentation: "Ampollas", category: "Suplementos" },
  { name: "Carbonato de Calcio + Vitamina D3 (600 mg / 400 UI)", generic: "Calcio + Vitamina D3", presentation: "Tabletas", category: "Suplementos" }
];

// Función para buscar medicamentos basados en texto
export function searchMedications(query) {
  if (!query || query.trim().length < 2) return [];
  const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  return medicationsDatabase.filter(m => {
    const nameMatch = m.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(cleanQuery);
    const genericMatch = m.generic.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(cleanQuery);
    const catMatch = m.category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(cleanQuery);
    return nameMatch || genericMatch || catMatch;
  });
}
