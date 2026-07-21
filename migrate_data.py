import pandas as pd
import json
import os
import re

excel_path = r'C:\Users\guill\.gemini\antigravity\scratch\multimedica-system\Hospital_Multimedica_Web_App_Export.xlsx'
xls = pd.ExcelFile(excel_path)

doctor_map = {
    '3isD2pPopLg1FHjR62WAMFEivG53': 'Dr. Carlos Montenegro',
    'VR2kySxGfhMzccEwnNjWjLgVafs1': 'Dra. Lucía Méndez',
    'MEfYjsgx8tQ4l7ZcDEOhCBNc7c72': 'Dr. Manuel Estada',
    '8HMFimsqdNf0T7MpB2nbAF5FL6s1': 'Licda. Sofía López',
    'YBjtlweOscNFLsj8rwzJaRDXsne2': 'Lic. Juan Pérez',
    'Dr. Elias Pa': 'Dr. Elías Pa',
    'Dr. Edgar Tut': 'Dr. Edgar Tut',
    'Dr Randy Rosado': 'Dr. Randy Rosado'
}

def clean_str(val, default=''):
    if pd.isna(val): return default
    s = str(val).strip()
    return default if s in ['nan', 'None', ''] else s

def clean_dpi(val):
    if pd.isna(val): return 'No Presenta Documento'
    try:
        num = int(float(val))
        return str(num)
    except:
        s = str(val).strip()
        return s if s and s != 'nan' else 'No Presenta Documento'

def safe_float(val, default=0.0):
    if pd.isna(val): return default
    try:
        s = str(val).strip().replace(',', '.')
        parts = s.split('.')
        if len(parts) > 2:
            s = parts[0] + '.' + ''.join(parts[1:])
        return float(s)
    except:
        return default

def safe_int(val, default=0):
    if pd.isna(val): return default
    try:
        return int(float(str(val).strip()))
    except:
        return default

def clean_doc_name(name_val):
    s = clean_str(name_val)
    return doctor_map.get(s, s if s else 'Dr. Carlos Montenegro')

def get_clean_sheet(xls, sheet_name, key_words):
    df_raw = pd.read_excel(xls, sheet_name=sheet_name)
    h_idx = 0
    for idx, r in df_raw.iterrows():
        rstr = ' '.join([str(v) for v in r.values if pd.notna(v)])
        if any(k in rstr for k in key_words):
            h_idx = idx + 1
            break
    df = pd.read_excel(xls, sheet_name=sheet_name, header=h_idx)
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    first_col = df.columns[0]
    df = df[df[first_col].notna() & (~df[first_col].astype(str).str.contains('TOTAL'))]
    return df

# 1. PACIENTES
df_p = get_clean_sheet(xls, 'Pacientes', ['ID Paciente'])
patients = []
patient_dict = {}

for _, row in df_p.iterrows():
    pid = clean_str(row['ID Paciente'])
    pname = clean_str(row['Nombre Completo'])
    
    pa_str = clean_str(row.get('PA (mmHg)'), '120/80')
    sys, dia = 120, 80
    if '/' in pa_str:
        try:
            parts = pa_str.split('/')
            sys, dia = int(parts[0]), int(parts[1])
        except: pass
    
    vitals = [{
        'id': 'v-' + pid + '-1',
        'date': clean_str(row.get('Fecha Nacimiento')),
        'bp_systolic': sys if sys > 0 else 120,
        'bp_diastolic': dia if dia > 0 else 80,
        'pulse': safe_int(row.get('FC (bpm)'), 75),
        'oximetry': safe_int(row.get('Sat O2 (%)'), 98),
        'temp': safe_float(row.get('Temp (°C)'), 36.5),
        'weight': safe_float(row.get('Peso (kg)'), 70.0),
        'height': safe_float(row.get('Talla (m)'), 1.65),
        'glucose': safe_float(row.get('Glucemia (mg/dL)'), 95.0),
        'notes': 'Signos vitales registrados en la migración de base de datos'
    }]
    
    patient_obj = {
        'id': pid,
        'name': pname,
        'dpi': clean_dpi(row.get('DPI / CUI')),
        'birthdate': clean_str(row.get('Fecha Nacimiento')),
        'gender': 'Masculino' if clean_str(row.get('Sexo')).upper() in ['H', 'MASCULINO'] else 'Femenino',
        'civilState': clean_str(row.get('Estado Civil'), 'Soltero(a)'),
        'telephone': clean_str(row.get('Teléfono'), '00000000'),
        'email': clean_str(row.get('Email'), 'No provisto'),
        'insurance': clean_str(row.get('Aseguradora'), 'Particular'),
        'address': clean_str(row.get('Dirección / Domicilio'), 'Ciudad de Guatemala'),
        'assignedDoctorId': 'u-med-1',
        'assignedDoctorName': 'Dr. Carlos Montenegro',
        'vitalSigns': vitals,
        'consultations': [],
        'appointments': [],
        'prescriptions': [],
        'labHistory': [],
        'imagingHistory': [],
        'billingHistory': []
    }
    patients.append(patient_obj)
    patient_dict[pid] = patient_obj

# 2. MEDICOS & USUARIOS
df_m = get_clean_sheet(xls, 'Médicos', ['ID Médico'])
df_r = get_clean_sheet(xls, 'Personal_RRHH', ['ID Empleado'])

users = [{
    'id': 'u-admin',
    'name': 'Administrador',
    'role': 'Administrador',
    'password': 'Glol5414',
    'modules': ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion']
}]

user_ids_by_name = {}

idx = 1
for _, row in df_m.iterrows():
    doc_raw = clean_str(row['Nombre Completo'])
    real_name = doctor_map.get(doc_raw, doc_raw)
    spec = clean_str(row.get('Especialidad'), 'Medicina General')
    lic = clean_dpi(row.get('No. Colegiado'))
    phone = clean_str(row.get('Teléfono'), '5555-0000')
    email = clean_str(row.get('Correo Electrónico'), 'medico@multimedica.com')
    
    uid = f'u-med-{idx}'
    user_obj = {
        'id': uid,
        'name': real_name,
        'role': 'medico',
        'specialty': spec,
        'license': lic,
        'phone': phone,
        'email': email,
        'password': 'Glol5414',
        'modules': ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia']
    }
    users.append(user_obj)
    user_ids_by_name[real_name] = uid
    idx += 1

# RRHH non-doctor staff
for _, row in df_r.iterrows():
    emp_name = clean_str(row['Nombre Completo'])
    role_sys = clean_str(row.get('Rol Sistema'), 'usuario').lower()
    puesto = clean_str(row.get('Puesto / Cargo'), 'Personal')
    
    if emp_name not in user_ids_by_name:
        uid = f'u-staff-{len(users)+1}'
        med_role = 'medico' if ('doctor' in role_sys or 'medico' in role_sys) else ('laboratorista' if 'laborat' in role_sys else ('enfermero' if 'enfermer' in role_sys else 'administrador'))
        users.append({
            'id': uid,
            'name': emp_name,
            'role': med_role,
            'specialty': puesto,
            'phone': '5555-0000',
            'email': 'staff@multimedica.com',
            'password': 'Glol5414',
            'modules': ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia']
        })
        user_ids_by_name[emp_name] = uid

# Update assignedDoctorId for patients matching doctors
for p in patients:
    if p['assignedDoctorName'] in user_ids_by_name:
        p['assignedDoctorId'] = user_ids_by_name[p['assignedDoctorName']]

# 3. CITAS
df_c = get_clean_sheet(xls, 'Citas', ['ID Cita'])
appointments = []

for _, row in df_c.iterrows():
    cid = clean_str(row['ID Cita'])
    pid = clean_str(row['ID Paciente'])
    pname = clean_str(row['Nombre Paciente'])
    doc_raw = clean_str(row['Médico Tratante'])
    doc_name = clean_doc_name(doc_raw)
    
    appt = {
        'id': cid,
        'date': clean_str(row.get('Fecha Cita')),
        'time': clean_str(row.get('Hora'), '09:00'),
        'patientId': pid,
        'patientName': pname,
        'doctor': doc_name,
        'doctorId': user_ids_by_name.get(doc_name, 'u-med-1'),
        'specialty': clean_str(row.get('Especialidad'), 'Medicina General'),
        'reason': clean_str(row.get('Motivo Consulta'), 'Chequeo General Preventivo'),
        'status': clean_str(row.get('Estado Cita'), 'Confirmada'),
        'cost': safe_float(row.get('Costo Consulta'), 250.0)
    }
    appointments.append(appt)
    
    if pid in patient_dict:
        patient_dict[pid]['appointments'].append(appt)

# 4. HISTORIAL CLINICO Y RECETAS
df_h = get_clean_sheet(xls, 'Historial_Clínico', ['ID Consulta'])
consultations = []

for _, row in df_h.iterrows():
    con_id = clean_str(row['ID Consulta'])
    pid = clean_str(row['ID Paciente'])
    pname = clean_str(row['Nombre Paciente'])
    doc_raw = clean_str(row['Médico Tratante'])
    doc_name = clean_doc_name(doc_raw)
    diag = clean_str(row.get('Diagnóstico Principal (CIE-10)'), 'Z00.0 - Examen médico general')
    treatment = clean_str(row.get('Plan Tratamiento / Receta'), 'Reposo y dieta balanceada')
    
    diag_code = diag.split(' - ')[0] if ' - ' in diag else 'Z00.0'
    diag_name = diag.split(' - ')[1] if ' - ' in diag else diag

    con_obj = {
        'id': con_id,
        'date': clean_str(row.get('Fecha Atención')),
        'patientId': pid,
        'patientName': pname,
        'doctor': doc_name,
        'specialty': clean_str(row.get('Especialidad'), 'Medicina General'),
        'reason': clean_str(row.get('Motivo Consulta'), 'Chequeo General Preventivo'),
        'diagnosis': diag,
        'treatment': treatment,
        'vitalsSummary': clean_str(row.get('Signos Vitales Resumen')),
        'cost': safe_float(row.get('Costo Honorarios'), 300.0),
        'fee': safe_float(row.get('Costo Honorarios'), 300.0),
        'symptoms': clean_str(row.get('Motivo Consulta'), 'Chequeo médico'),
        'diagnosisCodes': [diag_code],
        'diagnosisNames': [diag_name],
        'diagnoses': [{ 'code': diag_code, 'description': diag_name }],
        'acceptedStudies': { 'labs': [], 'imaging': [] },
        'acceptedMedications': [],
        'acceptedIndications': []
    }
    consultations.append(con_obj)
    
    if pid in patient_dict:
        patient_dict[pid]['consultations'].append(con_obj)
        
        # Generar registro completo de Receta Emitida
        med_parts = treatment.split(',')
        med_name = med_parts[0].strip() if len(med_parts) > 0 else treatment
        indications_text = ', '.join(med_parts[1:]).strip() if len(med_parts) > 1 else 'Tomar según indicación médica.'
        
        rx_obj = {
            'id': 'REC-' + con_id,
            'date': con_obj['date'] or '2026-06-12',
            'doctorName': doc_name,
            'doctorLicense': '10001',
            'medicines': [
                {
                    'name': med_name,
                    'presentation': 'Tabletas',
                    'quantity': '1 caja / frasco',
                    'dosage': '1 cada 8 horas',
                    'duration': indications_text if indications_text else 'Tomar por 7 días'
                }
            ],
            'indications': treatment
        }
        patient_dict[pid]['prescriptions'].append(rx_obj)

# 5. INVENTARIO FARMACIA
df_i = get_clean_sheet(xls, 'Inventario_Farmacia', ['Código SKU'])
medications = []

for idx, row in df_i.iterrows():
    sku = clean_str(row['Código SKU'])
    mname = clean_str(row['Nombre Producto / Medicamento'])
    cat = clean_str(row.get('Categoría / Clasificación'), 'Farmacia')
    stock = safe_int(row.get('Stock Actual'), 100)
    min_stock = safe_int(row.get('Stock Mínimo'), 10)
    cost_p = safe_float(row.get('Precio Compra Unitario'), 15.0)
    sell_p = safe_float(row.get('Precio Venta Unitario'), 25.0)
    venc = clean_str(row.get('Fecha Vencimiento'), '2027-12-31')
    
    med_obj = {
        'id': f'm-{idx+1}',
        'sku': sku,
        'name': mname,
        'category': cat,
        'stock': stock,
        'minStock': min_stock,
        'costPrice': cost_p,
        'price': sell_p,
        'lote': f'L-MED-{1000+idx+1}',
        'vencimiento': venc,
        'status': clean_str(row.get('Estado Stock'), 'OK'),
        'presentation': 'Caja / Frasco',
        'generic': mname.split(' ')[0]
    }
    medications.append(med_obj)

# 6. FACTURACION
df_f = get_clean_sheet(xls, 'Facturación', ['ID Factura / DTE'])
billing = []

for _, row in df_f.iterrows():
    dte_id = clean_str(row['ID Factura / DTE'])
    date_f = clean_str(row.get('Fecha Emisión'))
    client = clean_str(row.get('Cliente / Paciente'))
    nit = clean_dpi(row.get('NIT / CUI'))
    concept = clean_str(row.get('Concepto / Servicio'), 'Servicios Médicos')
    subtotal = safe_float(row.get('Subtotal (Sin IVA)'), 300.0)
    iva = round(subtotal * 0.12, 2)
    total = subtotal + iva
    pay_method = clean_str(row.get('Forma de Pago'), 'Efectivo')
    status = clean_str(row.get('Estado Factura'), 'Pagada')
    
    invoice_obj = {
        'id': dte_id,
        'date': date_f,
        'client': client,
        'nit': nit,
        'concept': concept,
        'subtotal': subtotal,
        'iva': iva,
        'total': total,
        'paymentMethod': pay_method,
        'status': status,
        'details': [{ 'concept': concept, 'total': subtotal }]
    }
    billing.append(invoice_obj)
    
    # Match with patient by name
    for p in patients:
        if p['name'].upper() == client.upper() or client.upper() in p['name'].upper():
            p['billingHistory'].append(invoice_obj)
            break

# Build full Medflow DB state object
full_db_state = {
    'clinicInfo': {
        'name': 'Hospital Multimedica - Medflow',
        'address': 'Calzada Roosevelt 22-43 Zona 11, Ciudad de Guatemala',
        'phone': '+502 2424-9900',
        'email': 'info@multimedica.com.gt',
        'logoText': '🏥'
    },
    'users': users,
    'patients': patients,
    'medications': medications,
    'appointments': appointments,
    'pharmacySales': [
        {
            'id': b['id'],
            'date': b['date'],
            'type': 'receta',
            'patientName': b['client'],
            'total': b['total'],
            'items': [{ 'name': b['concept'], 'qty': 1 }]
        } for b in billing
    ],
    'externalSales': [],
    'blockedDates': [],
    'laboratoryTests': [
        {'id': 'l-1', 'name': 'Hematología Completa', 'category': 'Hematología', 'price': 125.00},
        {'id': 'l-2', 'name': 'Perfil Lipídico', 'category': 'Química Clínica', 'price': 180.00},
        {'id': 'l-3', 'name': 'Glucosa en Ayunas', 'category': 'Química Clínica', 'price': 75.00},
        {'id': 'l-4', 'name': 'Examen General de Orina', 'category': 'Uroanálisis', 'price': 60.00},
        {'id': 'l-5', 'name': 'Prueba PCR COVID-19', 'category': 'Microbiología', 'price': 250.00}
    ],
    'imagingStudies': [
        {'id': 'i-1', 'name': 'Radiografía de Tórax AP/PA', 'category': 'Rayos X', 'price': 250.00},
        {'id': 'i-2', 'name': 'Ultrasonido Abdominal Superior', 'category': 'Ultrasonografía', 'price': 450.00},
        {'id': 'i-3', 'name': 'Tomografía Axial Computarizada (TAC)', 'category': 'Tomografía', 'price': 1200.00},
        {'id': 'i-4', 'name': 'Resonancia Magnética Cerebral', 'category': 'Resonancia', 'price': 2200.00}
    ],
    'consultationTypes': [
        {'id': 'c-1', 'name': 'Consulta General Preventiva', 'specialty': 'Medicina General', 'price': 150.00},
        {'id': 'c-2', 'name': 'Consulta Especializada Hospitalaria', 'specialty': 'Especialista', 'price': 250.00},
        {'id': 'c-3', 'name': 'Consulta de Control Post-Operatorio', 'specialty': 'Control', 'price': 100.00}
    ]
}

# Save JSON file for Medflow DB
for out_json_path in [
    r'C:\Users\guill\.gemini\antigravity\scratch\gestion-consultorio\medflow_db.json',
    r'C:\Users\guill\.gemini\antigravity\scratch\gestion-consultorio\src\data\medflow_db.json'
]:
    with open(out_json_path, 'w', encoding='utf-8') as f:
        json.dump(full_db_state, f, indent=2, ensure_ascii=False)

print("MIGRATION SUMMARY:")
print(f"Total Patients: {len(full_db_state['patients'])}")
print(f"Total Prescriptions Created: {sum(len(p['prescriptions']) for p in full_db_state['patients'])}")
print("Saved JSON files successfully.")
