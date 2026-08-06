// src/modules/partogramaChart.js

let chartInstance = null;

/**
 * Initializes or updates the Chart.js instance for the Partogram.
 * @param {HTMLCanvasElement} canvasEl - The canvas element to draw on.
 * @param {Array} records - Array of partogram reading records.
 */
export function initPartogramaChart(canvasEl, records) {
  if (!canvasEl) return;

  // Clean records and sort by time
  const sortedRecords = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));

  if (sortedRecords.length === 0) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  // Calculate relative hours from the first record
  const startTime = new Date(sortedRecords[0].time).getTime();
  const dataDilation = [];
  const dataDescent = [];
  const labels = [];

  sortedRecords.forEach(r => {
    const elapsedHrs = (new Date(r.time).getTime() - startTime) / (1000 * 60 * 60);
    const hrsRounded = Math.round(elapsedHrs * 100) / 100;
    dataDilation.push({ x: hrsRounded, y: r.dilation });
    dataDescent.push({ x: hrsRounded, y: r.descent });
  });

  // Determine the max X value to draw Alert/Action lines properly
  const maxElapsed = dataDilation.length > 0 ? dataDilation[dataDilation.length - 1].x : 0;
  const maxX = Math.max(12, Math.ceil(maxElapsed + 2));

  // Compute WHO Alert and Action Lines
  // Find first record where cervical dilation >= 4 cm (onset of active phase)
  const activePhaseIndex = sortedRecords.findIndex(r => r.dilation >= 4);
  const dataAlert = [];
  const dataAction = [];

  if (activePhaseIndex !== -1) {
    const activeStartRecord = sortedRecords[activePhaseIndex];
    const activeStartHrs = (new Date(activeStartRecord.time).getTime() - startTime) / (1000 * 60 * 60);
    const startDilation = activeStartRecord.dilation;

    // Alert Line: Starts at activeStartHrs, dilation = startDilation. Rises at 1cm/hr up to 10cm.
    const hoursToFullDilation = 10 - startDilation;
    const alertEndHrs = activeStartHrs + hoursToFullDilation;

    dataAlert.push({ x: activeStartHrs, y: startDilation });
    dataAlert.push({ x: alertEndHrs, y: 10 });

    // Action Line: Parallel to Alert line, offset by 4 hours to the right
    dataAction.push({ x: activeStartHrs + 4, y: startDilation });
    dataAction.push({ x: alertEndHrs + 4, y: 10 });
  } else {
    // Fallback: If active phase is not reached yet, draw alert line starting at x=0, y=4 as reference
    dataAlert.push({ x: 0, y: 4 });
    dataAlert.push({ x: 6, y: 10 });

    dataAction.push({ x: 4, y: 4 });
    dataAction.push({ x: 10, y: 10 });
  }

  // Destroy previous instance
  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = canvasEl.getContext('2d');
  
  // Custom design configurations matching MEDFLOW's dark premium aesthetic
  const isDarkMode = document.body.classList.contains('theme-dark') || 
                      document.body.getAttribute('data-theme') === 'dark' ||
                      window.matchMedia('(prefers-color-scheme: dark)').matches;

  const textColor = '#e2e8f0';
  const gridColor = 'rgba(255, 255, 255, 0.08)';

  chartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Dilatación Cervical (cm)',
          data: dataDilation,
          type: 'line',
          showLine: true,
          borderColor: '#06b6d4', // Cyan neon
          backgroundColor: 'rgba(6, 182, 212, 0.2)',
          pointBackgroundColor: '#06b6d4',
          pointBorderColor: '#ffffff',
          pointRadius: 6,
          pointHoverRadius: 8,
          borderWidth: 3.5,
          tension: 0.1,
          yAxisID: 'y'
        },
        {
          label: 'Descenso Fetal (Estación)',
          data: dataDescent,
          type: 'line',
          showLine: true,
          borderColor: '#a855f7', // Purple/Violet
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          pointBackgroundColor: '#a855f7',
          pointBorderColor: '#ffffff',
          pointStyle: 'triangle',
          pointRadius: 7,
          pointHoverRadius: 9,
          borderWidth: 3,
          borderDash: [4, 4],
          tension: 0.1,
          yAxisID: 'y1'
        },
        {
          label: 'Línea de Alerta (OMS)',
          data: dataAlert,
          type: 'line',
          showLine: true,
          borderColor: '#fbbf24', // Amber/Yellow
          backgroundColor: 'transparent',
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 3],
          yAxisID: 'y'
        },
        {
          label: 'Línea de Acción (OMS)',
          data: dataAction,
          type: 'line',
          showLine: true,
          borderColor: '#ef4444', // Red
          backgroundColor: 'transparent',
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 3],
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          min: 0,
          max: maxX,
          title: {
            display: true,
            text: 'Tiempo en Trabajo de Parto (Horas)',
            color: textColor,
            font: { size: 12, weight: 'bold' }
          },
          grid: { color: gridColor },
          ticks: { color: textColor, stepSize: 1 }
        },
        y: {
          type: 'linear',
          position: 'left',
          min: 0,
          max: 10,
          title: {
            display: true,
            text: 'Dilatación Cervical (cm)',
            color: '#06b6d4',
            font: { size: 12, weight: 'bold' }
          },
          grid: { color: gridColor },
          ticks: { color: textColor, stepSize: 1 }
        },
        y1: {
          type: 'linear',
          position: 'right',
          min: -4,
          max: 4,
          reverse: true, // +4 is deeper (bottom), -4 is higher (top)
          title: {
            display: true,
            text: 'Descenso Fetal (Estación / Planos Hodge)',
            color: '#a855f7',
            font: { size: 12, weight: 'bold' }
          },
          grid: { drawOnChartArea: false }, // Only left Y-axis draws grid lines
          ticks: {
            color: textColor,
            stepSize: 1,
            callback: function(value) {
              // Map stations to Hodge planes or clean stations
              if (value === -4) return '-4 (I Hodge)';
              if (value === -2) return '-2 (II Hodge)';
              if (value === 0) return '0 (III Hodge)';
              if (value === 2) return '+2 (IV Hodge)';
              if (value === 4) return '+4 (Coronando)';
              return value > 0 ? `+${value}` : value;
            }
          }
        }
      },
      plugins: {
        legend: {
          labels: { color: textColor, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const xVal = context.raw.x;
              const yVal = context.raw.y;
              if (context.datasetIndex === 0) {
                return `Hora ${xVal}: Dilatación ${yVal} cm`;
              } else if (context.datasetIndex === 1) {
                const stationText = yVal > 0 ? `+${yVal}` : yVal;
                return `Hora ${xVal}: Descenso Fetal ${stationText}`;
              }
              return `${context.dataset.label}: ${yVal}`;
            }
          }
        }
      }
    }
  });
}
