import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Database, ref, onValue } from '@angular/fire/database';
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit {
  mensajesAgrupados: { [fecha: string]: { panel: string, voltaje: number | null, tiempo: string }[] } = {};
  promediosPorFecha: { [fecha: string]: { panel: string, promedio: number }[] } = {};

  constructor(private database: Database) {
    Chart.register(...registerables);
  }

  ngOnInit() {
    const ruta = ref(this.database, 'voltaje/voltios');
    onValue(ruta, (snapshot) => {
      const valores_db = snapshot.val();
      const mensajes: { panel: string, voltaje: number | null, tiempo: string, tiempoOrdenable: Date }[] = [];
      this.mensajesAgrupados = {};
      this.promediosPorFecha = {};
  
      // Recopilamos los mensajes en un array
      for (const key in valores_db) {
        if (valores_db.hasOwnProperty(key)) {
          const { message, sender } = valores_db[key];
          const parts = message.split('"');
          const voltagePart = parts.length > 1 ? parts[1].trim() : '';
          const regex = /\d+$/;
          const match = voltagePart.match(regex);
          const voltajeRaw = match ? parseInt(match[0], 10) : null;
          const voltaje = voltajeRaw !== null ? this.mapVoltaje(voltajeRaw) : null;
          const tiempo = parts.length > 0 ? parts[0].trim() : '';
  
          // Convertimos el tiempo a un objeto Date para ordenar
          const tiempoOrdenable = this.convertirATiempoOrdenable(tiempo);
          const panel = this.getPanelFromSender(sender);
  
          mensajes.push({ panel, voltaje, tiempo, tiempoOrdenable });
        }
      }
  
      // Ordenamos los mensajes por el campo `tiempoOrdenable`
      mensajes.sort((a, b) => a.tiempoOrdenable.getTime() - b.tiempoOrdenable.getTime());
  
      // Agrupamos los mensajes por fecha
      mensajes.forEach(mensaje => {
        const fecha = this.extraerFecha(mensaje.tiempo);
        if (!this.mensajesAgrupados[fecha]) {
          this.mensajesAgrupados[fecha] = [];
        }
        this.mensajesAgrupados[fecha].push(mensaje);
      });
  
      this.calcularPromedios();
    });
  }
  
  // Función para convertir la cadena de tiempo a un objeto Date
  convertirATiempoOrdenable(tiempo: string): Date {
    // Ejemplo de formato: "24/08/18,22:48:08-20"
    const regex = /(\d{2})\/(\d{2})\/(\d{2}),(\d{2}):(\d{2}):(\d{2})/;
    const match = tiempo.match(regex);
  
    if (match) {
      const [_, dia, mes, ano, hora, minuto, segundo] = match;
      const fecha = new Date(`20${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`);
      return fecha;
    }
  
    return new Date(); // En caso de no poder parsear, devolvemos la fecha actual
  }
  
  

  ngAfterViewInit() {
    this.generarGraficas();
  }

  extraerFecha(tiempo: string): string {
    const regex = /\d{2}\/\d{2}\/\d{2}/;
    const match = tiempo.match(regex);
    return match ? match[0] : 'Fecha desconocida';
  }

  mapVoltaje(voltajeRaw: number): number {
    const mappedVoltaje = voltajeRaw * 0.065;
    return parseFloat(mappedVoltaje.toFixed(2));
  }

  getPanelFromSender(sender: string): string {
    switch (sender) {
      case '+593982138667':
        return 'Panel TUGULA';
      case '+593996002370':
        return 'Panel CALEDONIA';
      default:
        return 'Panel desconocido';
    }
  }

  calcularPromedios() {
    for (const fecha in this.mensajesAgrupados) {
      if (this.mensajesAgrupados.hasOwnProperty(fecha)) {
        const voltajesPorPanel: { [panel: string]: number[] } = {};

        this.mensajesAgrupados[fecha].forEach(mensaje => {
          if (!voltajesPorPanel[mensaje.panel]) {
            voltajesPorPanel[mensaje.panel] = [];
          }
          if (mensaje.voltaje !== null) {
            voltajesPorPanel[mensaje.panel].push(mensaje.voltaje);
          }
        });

        this.promediosPorFecha[fecha] = [];

        for (const panel in voltajesPorPanel) {
          if (voltajesPorPanel.hasOwnProperty(panel)) {
            const voltajes = voltajesPorPanel[panel];
            const promedio = this.calcularPromedio(voltajes);
            this.promediosPorFecha[fecha].push({ panel, promedio });
          }
        }
      }
    }
  }

  calcularPromedio(voltajes: number[]): number {
    if (voltajes.length === 0) return 0;
    const suma = voltajes.reduce((acc, val) => acc + val, 0);
    return parseFloat((suma / voltajes.length).toFixed(2));
  }

  generarGraficas() {
    setTimeout(() => {
      for (const fecha in this.promediosPorFecha) {
        if (this.promediosPorFecha.hasOwnProperty(fecha)) {
          this.promediosPorFecha[fecha].forEach(panelData => {
            this.generarGrafica(`chart-${fecha}-${panelData.panel}`, panelData.panel, panelData.promedio);
          });
        }
      }
    }, 500); // Asegurar que las gráficas se generen después de que el DOM esté listo.
  }

  generarGrafica(canvasId: string, label: string, promedio: number) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (canvas) {
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: [label],
          datasets: [{
            label: 'Promedio de Voltaje (V)',
            data: [promedio],
            backgroundColor: ['#3e95cd'],
            borderColor: ['#3e95cd'],
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              max: 250
            }
          }
        }
      });
    }
  }

  getFechas(): string[] {
    return Object.keys(this.mensajesAgrupados);
  }

  getPanelMessages(fecha: string, panel: string) {
    return this.mensajesAgrupados[fecha].filter(mensaje => mensaje.panel === panel);
  }
}









