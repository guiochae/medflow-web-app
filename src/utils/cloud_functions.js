import { getAppState, saveAppState } from '../main.js';

/**
 * SIMULACIÓN EN FRONTEND (Para pruebas locales en vivo)
 * Ejecuta en segundo plano las acciones que haría la Cloud Function tras registrar una Compra.
 * @param {Object} purchase - La compra registrada
 * @param {Object} state - El estado de la aplicación
 */
export function simulateOnPurchaseCreated(purchase, state) {
  console.log("☁️ [Local Cloud Function] Ejecutando simulateOnPurchaseCreated...");
  
  let stockUpdated = false;
  
  // 1. Integración con Inventario de Farmacia
  if (Array.isArray(purchase.items)) {
    purchase.items.forEach(item => {
      const categoryLower = String(item.category || '').toLowerCase();
      // Si incluye medicamentos o material médico quirúrgico, actualizar inventario
      if (categoryLower.includes('medicamento') || categoryLower.includes('material') || categoryLower.includes('farmacia') || categoryLower.includes('bodega')) {
        const med = (state.medications || []).find(m => m.id === item.id || m.name.toLowerCase() === item.name.toLowerCase());
        if (med) {
          med.stock = (parseInt(med.stock) || 0) + (parseInt(item.qty) || 0);
          console.log(`📦 Stock actualizado para ${med.name}: +${item.qty} (Nuevo stock: ${med.stock})`);
          stockUpdated = true;
        } else {
          // Si no existe, crear un nuevo item de inventario en Farmacia
          const newMed = {
            id: item.id || 'med-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: item.name,
            generic: item.generic || item.name,
            presentation: item.presentation || 'Caja/Unidades',
            price: item.price * 1.3, // Margen de ganancia sugerido del 30%
            precio_presentacion: item.price * 1.3,
            unidades_por_presentacion: item.unitsPerBox || 10,
            stock: parseInt(item.qty) || 0,
            es_fraccionable: false,
            lote: item.lote || 'N/A',
            category: categoryLower.includes('material') ? 'Bodega General' : 'Farmacia'
          };
          state.medications.push(newMed);
          console.log(`📦 Creado nuevo artículo en inventario de Farmacia: ${item.name}`);
          stockUpdated = true;
        }
      }
    });
  }

  // 2. Generación automática de Partida Doble en Contabilidad
  const amountBeforeTax = purchase.total / 1.12;
  const ivaAmount = purchase.total - amountBeforeTax;

  const journalEntry = {
    id: 'PART-COMPRA-' + Date.now(),
    date: purchase.date || new Date().toISOString(),
    concept: `Compra de Inventario / Insumos - Fac. No. ${purchase.invoiceNumber} (Proveedor: ${purchase.provider})`,
    totalDebits: purchase.total,
    totalCredits: purchase.total,
    details: [
      { account: 'Inventario de Mercaderías', type: 'Debe', amount: amountBeforeTax },
      { account: 'IVA por Cobrar (Crédito Fiscal)', type: 'Debe', amount: ivaAmount }
    ]
  };

  if (purchase.type === 'contado') {
    // Al contado, se debita de Caja y Bancos
    journalEntry.details.push({ account: 'Caja y Bancos', type: 'Haber', amount: purchase.total });
  } else {
    // Al crédito, se envía a Cuentas por Pagar
    journalEntry.details.push({ account: 'Cuentas por Pagar (Proveedores)', type: 'Haber', amount: purchase.total });

    // Insertar en la cola de Cuentas por Pagar de la Caja
    state.administracion_caja = state.administracion_caja || [];
    state.administracion_caja.unshift({
      id: 'CX-PAGAR-' + Date.now(),
      date: purchase.date || new Date().toISOString(),
      type: 'cuentas_por_pagar',
      concept: `Compra al Crédito - Proveedor: ${purchase.provider} (Fac. No: ${purchase.invoiceNumber})`,
      amount: purchase.total,
      status: 'Pendiente',
      refId: purchase.id
    });
    console.log(`💳 Cuenta por pagar registrada para el proveedor ${purchase.provider}: Q${purchase.total.toFixed(2)}`);
  }

  state.administracion_contabilidad = state.administracion_contabilidad || [];
  state.administracion_contabilidad.unshift(journalEntry);
  console.log(`📋 Partida contable de compra registrada en Libro Diario: ${journalEntry.concept}`);

  return stockUpdated;
}

/**
 * SIMULACIÓN EN FRONTEND (Para pruebas locales en vivo)
 * Ejecuta en segundo plano las acciones que haría la Cloud Function tras generar la Nómina.
 * @param {Object} payroll - El registro de nómina mensual
 * @param {Object} state - El estado de la aplicación
 */
export function simulateOnPayrollGenerated(payroll, state) {
  console.log("☁️ [Local Cloud Function] Ejecutando simulateOnPayrollGenerated...");

  // 1. Generación de las transacciones de pago de cheques/transferencias en Caja
  state.administracion_caja = state.administracion_caja || [];
  
  let totalBaseSalary = 0;
  let totalBonus = 0;
  let totalIgssLaboral = 0;
  let totalNetSalary = 0;

  payroll.employees.forEach(emp => {
    totalBaseSalary += emp.salary;
    totalBonus += 250; // Bonificación de ley mensual en Guatemala
    
    const igssLaboral = emp.salary * 0.0483; // 4.83% Retención laboral IGSS
    totalIgssLaboral += igssLaboral;

    const netSalary = emp.salary + 250 - igssLaboral;
    totalNetSalary += netSalary;

    // Crear registro individual de pago de sueldo en Caja
    state.administracion_caja.unshift({
      id: `PAY-EMP-${emp.id}-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'nomina',
      concept: `Pago de Nómina Mensual (${payroll.month}) - ${emp.name} (${emp.position})`,
      amount: netSalary,
      status: 'Pendiente',
      refId: payroll.id,
      employeeId: emp.id
    });
  });

  // 2. Generación automática de Partida Doble en Contabilidad
  // Carga Patronal del 10.67% IGSS en Guatemala
  const totalIgssPatronal = totalBaseSalary * 0.1067;
  
  const journalEntry = {
    id: 'PART-NOMINA-' + Date.now(),
    date: new Date().toISOString(),
    concept: `Provisión de Nómina Mensual de Empleados - Periodo: ${payroll.month}`,
    totalDebits: totalBaseSalary + totalBonus + totalIgssPatronal,
    totalCredits: totalBaseSalary + totalBonus + totalIgssPatronal,
    details: [
      { account: 'Gastos de Administración (Sueldos)', type: 'Debe', amount: totalBaseSalary },
      { account: 'Gastos de Administración (Bonificación Incentivo)', type: 'Debe', amount: totalBonus },
      { account: 'Gastos de Administración (Cuota Patronal IGSS)', type: 'Debe', amount: totalIgssPatronal },
      { account: 'Retenciones por Pagar (IGSS Laboral)', type: 'Haber', amount: totalIgssLaboral },
      { account: 'Retenciones por Pagar (IGSS Patronal)', type: 'Haber', amount: totalIgssPatronal },
      { account: 'Cuentas por Pagar (Nómina Neta)', type: 'Haber', amount: totalNetSalary }
    ]
  };

  state.administracion_contabilidad = state.administracion_contabilidad || [];
  state.administracion_contabilidad.unshift(journalEntry);
  console.log(`📋 Partida contable de nómina registrada en Libro Diario: ${journalEntry.concept}`);
}


/**
 * CÓDIGO DE PRODUCCIÓN: CLOUD FUNCTIONS PARA IMPLEMENTACIÓN EN EL BACKEND DE FIREBASE
 * (Este código está preparado para ser copiado directamente a index.js de Firebase Functions)
 */
/*
const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// 1. Cloud Function ejecutada al crear una compra
exports.onPurchaseCreated = functions.firestore
  .document('multimedica_administracion_compras/{purchaseId}')
  .onCreate(async (snap, context) => {
    const purchase = snap.data();
    const batch = db.batch();

    // Actualizar inventario de medicamentos en farmacia
    if (purchase.items && Array.isArray(purchase.items)) {
      for (const item of purchase.items) {
        const categoryLower = String(item.category || '').toLowerCase();
        if (categoryLower.includes('medicamento') || categoryLower.includes('material') || categoryLower.includes('farmacia')) {
          // Buscar artículo en catálogo
          const medRef = db.collection('multimedica').doc('catalog_medications');
          const medDoc = await medRef.get();
          if (medDoc.exists) {
            let list = medDoc.data().list || [];
            let med = list.find(m => m.id === item.id || m.name.toLowerCase() === item.name.toLowerCase());
            if (med) {
              med.stock = (parseInt(med.stock) || 0) + (parseInt(item.qty) || 0);
              batch.update(medRef, { list: list });
            }
          }
        }
      }
    }

    // Provisión contable de partida doble
    const amountBeforeTax = purchase.total / 1.12;
    const ivaAmount = purchase.total - amountBeforeTax;
    const entryId = 'PART-COMPRA-' + Date.now();
    const entryRef = db.collection('multimedica_administracion_contabilidad').doc(entryId);

    const journalEntry = {
      id: entryId,
      date: purchase.date || admin.firestore.Timestamp.now().toDate().toISOString(),
      concept: `Compra de Inventario / Insumos - Fac. No. ${purchase.invoiceNumber} (Proveedor: ${purchase.provider})`,
      totalDebits: purchase.total,
      totalCredits: purchase.total,
      details: [
        { account: 'Inventario de Mercaderías', type: 'Debe', amount: amountBeforeTax },
        { account: 'IVA por Cobrar (Crédito Fiscal)', type: 'Debe', amount: ivaAmount }
      ]
    };

    if (purchase.type === 'contado') {
      journalEntry.details.push({ account: 'Caja y Bancos', type: 'Haber', amount: purchase.total });
    } else {
      journalEntry.details.push({ account: 'Cuentas por Pagar (Proveedores)', type: 'Haber', amount: purchase.total });

      // Registrar Cuenta por Pagar
      const cxpId = 'CX-PAGAR-' + Date.now();
      const cxpRef = db.collection('multimedica_administracion_caja').doc(cxpId);
      batch.set(cxpRef, {
        id: cxpId,
        date: purchase.date || admin.firestore.Timestamp.now().toDate().toISOString(),
        type: 'cuentas_por_pagar',
        concept: `Compra al Crédito - Proveedor: ${purchase.provider} (Fac. No: ${purchase.invoiceNumber})`,
        amount: purchase.total,
        status: 'Pendiente',
        refId: purchase.id
      });
    }

    batch.set(entryRef, journalEntry);
    return batch.commit();
  });

// 2. Cloud Function ejecutada al cerrar una nómina
exports.onPayrollGenerated = functions.firestore
  .document('multimedica_administracion_rrhh_nominas/{payrollId}')
  .onCreate(async (snap, context) => {
    const payroll = snap.data();
    const batch = db.batch();

    let totalBaseSalary = 0;
    let totalBonus = 0;
    let totalIgssLaboral = 0;
    let totalNetSalary = 0;

    // Crear cobros individuales en Caja (Cheques de Nómina)
    for (const emp of payroll.employees) {
      totalBaseSalary += emp.salary;
      totalBonus += 250;

      const igssLaboral = emp.salary * 0.0483;
      totalIgssLaboral += igssLaboral;

      const netSalary = emp.salary + 250 - igssLaboral;
      totalNetSalary += netSalary;

      const payId = `PAY-EMP-${emp.id}-${Date.now()}`;
      const payRef = db.collection('multimedica_administracion_caja').doc(payId);
      batch.set(payRef, {
        id: payId,
        date: admin.firestore.Timestamp.now().toDate().toISOString(),
        type: 'nomina',
        concept: `Pago de Nómina Mensual (${payroll.month}) - ${emp.name} (${emp.position})`,
        amount: netSalary,
        status: 'Pendiente',
        refId: payroll.id,
        employeeId: emp.id
      });
    }

    // Partida Doble
    const totalIgssPatronal = totalBaseSalary * 0.1067;
    const entryId = 'PART-NOMINA-' + Date.now();
    const entryRef = db.collection('multimedica_administracion_contabilidad').doc(entryId);

    const journalEntry = {
      id: entryId,
      date: admin.firestore.Timestamp.now().toDate().toISOString(),
      concept: `Provisión de Nómina Mensual de Empleados - Periodo: ${payroll.month}`,
      totalDebits: totalBaseSalary + totalBonus + totalIgssPatronal,
      totalCredits: totalBaseSalary + totalBonus + totalIgssPatronal,
      details: [
        { account: 'Gastos de Administración (Sueldos)', type: 'Debe', amount: totalBaseSalary },
        { account: 'Gastos de Administración (Bonificación Incentivo)', type: 'Debe', amount: totalBonus },
        { account: 'Gastos de Administración (Cuota Patronal IGSS)', type: 'Debe', amount: totalIgssPatronal },
        { account: 'Retenciones por Pagar (IGSS Laboral)', type: 'Haber', amount: totalIgssLaboral },
        { account: 'Retenciones por Pagar (IGSS Patronal)', type: 'Haber', amount: totalIgssPatronal },
        { account: 'Cuentas por Pagar (Nómina Neta)', type: 'Haber', amount: totalNetSalary }
      ]
    };

    batch.set(entryRef, journalEntry);
    return batch.commit();
  });
*/
