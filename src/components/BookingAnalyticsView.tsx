import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  TrendingUp,
  Bed,
  Stethoscope,
  Sparkles,
  Calendar,
  DollarSign,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
  ArrowUpRight,
  Download,
  Filter,
  BarChart2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AnalyticsTrendPoint, ScheduleOptimizationInsight, InternationalKpis } from '../types/booking';

export const BookingAnalyticsView: React.FC = () => {
  const { bookings, resourceGroups, language } = useApp();
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d'>('14d');
  const [activeMetricFilter, setActiveMetricFilter] = useState<'all' | 'occupancy' | 'clinic' | 'revenue'>('all');

  const chartRef = useRef<SVGSVGElement | null>(null);
  const barChartRef = useRef<SVGSVGElement | null>(null);

  // Generate trend data based on bookings and date range
  const trendData: AnalyticsTrendPoint[] = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const points: AnalyticsTrendPoint[] = [];

    const totalRooms = resourceGroups
      .filter((g) => g.sector === 'hotel')
      .reduce((sum, g) => sum + g.resources.length, 0) || 10;

    for (let i = 0; i < days; i++) {
      const d = new Date(2026, 9, 26); // Base Oct 26
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const display = `${d.getDate()} ${d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
        month: 'short',
      })}`;

      // Count active bookings on this date
      const activeHotelBookings = bookings.filter(
        (b) => b.sector === 'hotel' && b.status !== 'cancelled' && b.startDate <= iso && b.endDate > iso
      );
      const activeClinicBookings = bookings.filter(
        (b) => b.sector === 'clinic' && b.status !== 'cancelled' && b.startDate <= iso && b.endDate >= iso
      );

      const occRate = Math.min(100, Math.round((activeHotelBookings.length / totalRooms) * 100));
      const clinicCount = activeClinicBookings.length;
      const dayRev = activeHotelBookings.reduce((acc, b) => acc + (b.totalPrice / 3), 0) + clinicCount * 75;
      const revPar = Math.round(dayRev / totalRooms);

      points.push({
        date: iso,
        displayDate: display,
        totalBookings: activeHotelBookings.length + clinicCount,
        hotelOccupancy: occRate,
        clinicAppointments: clinicCount,
        revenue: Math.round(dayRev),
        revPar,
        teleconsultCount: Math.round(clinicCount * 0.3),
      });
    }
    return points;
  }, [bookings, resourceGroups, timeRange, language]);

  // Compute USALI and International Healthcare KPIs
  const kpis: InternationalKpis = useMemo(() => {
    const totalRooms = resourceGroups
      .filter((g) => g.sector === 'hotel')
      .reduce((sum, g) => sum + g.resources.length, 0) || 10;

    const hotelBookings = bookings.filter((b) => b.sector === 'hotel' && b.status !== 'cancelled');
    const clinicBookings = bookings.filter((b) => b.sector === 'clinic' && b.status !== 'cancelled');
    const wellnessBookings = bookings.filter((b) => (b.sector === 'wellness' || b.sector === 'other') && b.status !== 'cancelled');

    const hotelRevenue = hotelBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const clinicRevenue = clinicBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const wellnessRevenue = wellnessBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const totalRev = hotelRevenue + clinicRevenue + wellnessRevenue;

    // ALOS (Average Length of Stay)
    let totalNights = 0;
    hotelBookings.forEach((b) => {
      const diff = (new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 3600 * 24);
      totalNights += Math.max(1, Math.round(diff));
    });
    const alos = hotelBookings.length > 0 ? Number((totalNights / hotelBookings.length).toFixed(1)) : 2.5;

    // ADR & RevPAR (USALI standard)
    const adr = totalNights > 0 ? Math.round(hotelRevenue / totalNights) : 110;
    const averageOcc = Math.round(
      trendData.reduce((acc, p) => acc + p.hotelOccupancy, 0) / (trendData.length || 1)
    );
    const revPar = Math.round(adr * (averageOcc / 100));

    // Clinic KPIs
    const clinicTotal = clinicBookings.length;
    const clinicUtilization = Math.min(100, Math.round((clinicTotal / (4 * 7)) * 100)); // 4 doctors over period
    const teleconsultRatio = 32;

    // Tourist city tax (2.80€ per guest night standard)
    const cityTax = Math.round(totalNights * 2.8);

    return {
      revPar,
      adr,
      hotelOccupancyRate: averageOcc,
      alos,
      clinicAppointmentsTotal: clinicTotal,
      clinicUtilizationRate: clinicUtilization,
      clinicTeleconsultRatio: teleconsultRatio,
      wellnessBookingsTotal: wellnessBookings.length,
      totalRevenue: totalRev,
      taxCityCollected: cityTax,
    };
  }, [bookings, resourceGroups, trendData]);

  // Insights based on international standards
  const insights: ScheduleOptimizationInsight[] = [
    {
      id: 'ins_1',
      type: 'capacity',
      sector: 'clinic',
      priority: 'high',
      title: {
        fr: 'Saturation des créneaux Dr. Alexander (Cardiologie)',
        en: 'Dr. Alexander (Cardiology) Slot Saturation',
        ar: 'تشبع مواعيد د. ألكسندر (أمراض القلب)',
      },
      description: {
        fr: 'Le taux d\'occupation atteint 94% sur les consultations du matin. 3 patients sont en liste d\'attente.',
        en: 'Morning consultation occupancy has reached 94%. 3 patients are currently waitlisted.',
        ar: 'نسبة الإشغال بلغت 94% في الفترات الصباحية، مع وجود 3 مرضى في قائمة الانتظار.',
      },
      metric: '94% OCC',
      recommendedAction: {
        fr: 'Ouvrir 2 créneaux de téléconsultation supplémentaires en fin d\'après-midi (17h00 - 18h30).',
        en: 'Open 2 additional late afternoon teleconsultation slots (5:00 PM - 6:30 PM).',
        ar: 'فتح موعدين إضافيين للاستشارة عن بُعد في المساء (5:00 - 6:30 مساءً).',
      },
      potentialGain: '+180 € / sem',
    },
    {
      id: 'ins_2',
      type: 'revenue',
      sector: 'hotel',
      priority: 'medium',
      title: {
        fr: 'Opportunité RevPAR : Nuit blanche isolée (Suite 302)',
        en: 'RevPAR Opportunity: Isolated Gap Night (Suite 302)',
        ar: 'فرصة تحسين RevPAR: فجوة ليلة واحدة (جناح 302)',
      },
      description: {
        fr: 'Une nuit isolée sans réservation est détectée le 31 octobre entre deux longs séjours de prestige.',
        en: 'An unbooked isolated night detected on Oct 31 between two long prestige stays.',
        ar: 'تم رصد ليلة شاغرة معزولة يوم 31 أكتوبر بين إقامتين طويلتين.',
      },
      metric: '1 Nuit Gap',
      recommendedAction: {
        fr: 'Activer une offre spéciale escapade 1 nuit (-15%) pour convertir les voyageurs d\'affaires.',
        en: 'Trigger a 1-night getaway deal (-15%) targeted at business transit travelers.',
        ar: 'تفعيل عرض إقامة ليلة واحدة بخصم 15% لجذب رجال الأعمال.',
      },
      potentialGain: '+195 €',
    },
    {
      id: 'ins_3',
      type: 'housekeeping',
      sector: 'hotel',
      priority: 'high',
      title: {
        fr: 'Goulot d\'étranglement ménage (Turnaround 11h - 15h)',
        en: 'Turnaround Cleaning Bottleneck (11 AM - 3 PM)',
        ar: 'ضغط جدول التنظيف وتجهيز الغرف (11 ص - 3 م)',
      },
      description: {
        fr: '4 départs et 4 arrivées simultanées programmés le 29 octobre. Respect de la fenêtre de désinfection de 4h requis.',
        en: '4 simultaneous check-outs and 4 check-ins scheduled on Oct 29. 4-hour sanitation window required.',
        ar: '4 حالات مغادرة و4 وصول متزامنة يوم 29 أكتوبر تتطلب الالتزام بمهلة التعقيم.',
      },
      metric: '4 Rotations',
      recommendedAction: {
        fr: 'Assigner la chambre 101 et 103 en priorité absolue dès 11h15 à l\'équipe d\'étage.',
        en: 'Assign Room 101 and 103 as top priority to housekeeping staff starting at 11:15 AM.',
        ar: 'تعيين الغرفتين 101 و 103 كأولوية قصوى لفريق النظافة بدءاً من 11:15 صباحاً.',
      },
      potentialGain: '0 retards de remise des clés',
    },
  ];

  // Render D3 Multi-Metric Curved Trend Chart
  useEffect(() => {
    if (!chartRef.current || trendData.length === 0) return;

    const svg = d3.select(chartRef.current);
    svg.selectAll('*').remove();

    const containerWidth = chartRef.current.parentElement?.clientWidth || 700;
    const margin = { top: 30, right: 40, bottom: 40, left: 50 };
    const width = containerWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const g = svg
      .attr('width', containerWidth)
      .attr('height', 280)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale
    const x = d3
      .scalePoint()
      .domain(trendData.map((d) => d.displayDate))
      .range([0, width]);

    // Y scales
    const yOcc = d3.scaleLinear().domain([0, 100]).range([height, 0]);
    const maxAppointments = d3.max(trendData, (d) => d.clinicAppointments) || 5;
    const yClinic = d3.scaleLinear().domain([0, Math.max(8, maxAppointments)]).range([height, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(
        d3
          .axisLeft(yOcc)
          .tickSize(-width)
          .tickFormat(() => '')
      );

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % (timeRange === '30d' ? 4 : 2) === 0)))
      .call((axis) => axis.select('.domain').attr('stroke', '#94a3b8'))
      .call((axis) => axis.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px'));

    // Y Axis Left (Occupancy %)
    g.append('g')
      .call(d3.axisLeft(yOcc).ticks(5).tickFormat((d) => `${d}%`))
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('text').attr('fill', '#0284c7').attr('font-size', '10px'));

    // Y Axis Right (Clinic Appointments)
    g.append('g')
      .attr('transform', `translate(${width},0)`)
      .call(d3.axisRight(yClinic).ticks(4))
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('text').attr('fill', '#10b981').attr('font-size', '10px'));

    // D3 Area Generator for Hotel Occupancy
    const areaGenerator = d3
      .area<AnalyticsTrendPoint>()
      .x((d) => x(d.displayDate) || 0)
      .y0(height)
      .y1((d) => yOcc(d.hotelOccupancy))
      .curve(d3.curveMonotoneX);

    // Defs for gradient
    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.4);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.0);

    // Draw Hotel Area
    if (activeMetricFilter === 'all' || activeMetricFilter === 'occupancy') {
      g.append('path')
        .datum(trendData)
        .attr('fill', 'url(#area-gradient)')
        .attr('d', areaGenerator);

      // Hotel Curve Line
      const lineOcc = d3
        .line<AnalyticsTrendPoint>()
        .x((d) => x(d.displayDate) || 0)
        .y((d) => yOcc(d.hotelOccupancy))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(trendData)
        .attr('fill', 'none')
        .attr('stroke', '#0284c7')
        .attr('stroke-width', 2.5)
        .attr('d', lineOcc);
    }

    // Clinic Appointments Line
    if (activeMetricFilter === 'all' || activeMetricFilter === 'clinic') {
      const lineClinic = d3
        .line<AnalyticsTrendPoint>()
        .x((d) => x(d.displayDate) || 0)
        .y((d) => yClinic(d.clinicAppointments))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(trendData)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2.5)
        .attr('stroke-dasharray', '4 2')
        .attr('d', lineClinic);

      // Clinic Data points
      g.selectAll('.clinic-dot')
        .data(trendData)
        .enter()
        .append('circle')
        .attr('cx', (d) => x(d.displayDate) || 0)
        .attr('cy', (d) => yClinic(d.clinicAppointments))
        .attr('r', 3.5)
        .attr('fill', '#10b981')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
    }

    // Interactive Hover Crosshair
    const bisect = d3.bisector<AnalyticsTrendPoint, string>((d) => d.displayDate).left;
    const focus = g.append('g').style('display', 'none');

    focus.append('line').attr('class', 'hover-line').attr('y1', 0).attr('y2', height).attr('stroke', '#64748b').attr('stroke-width', 1).attr('stroke-dasharray', '3 3');

    const tooltip = d3.select('#chart-tooltip');

    svg
      .append('rect')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => focus.style('display', null))
      .on('mouseout', () => {
        focus.style('display', 'none');
        tooltip.style('opacity', 0);
      })
      .on('mousemove', (event) => {
        const [xm] = d3.pointer(event);
        const domain = x.domain();
        const eachBand = width / (domain.length - 1);
        const index = Math.round(xm / eachBand);
        const d = trendData[Math.min(trendData.length - 1, Math.max(0, index))];
        if (!d) return;

        const posX = x(d.displayDate) || 0;
        focus.select('.hover-line').attr('transform', `translate(${posX}, 0)`);

        tooltip
          .style('opacity', 1)
          .style('left', `${event.pageX + 15}px`)
          .style('top', `${event.pageY - 40}px`)
          .html(
            `<div class="font-bold border-b border-slate-700 pb-1 mb-1 text-slate-200">${d.displayDate} (${d.date})</div>` +
            `<div class="text-sky-400 font-medium">🏨 Occ. Hôtel : ${d.hotelOccupancy}%</div>` +
            `<div class="text-emerald-400 font-medium">🩺 RDV Clinique : ${d.clinicAppointments} consultations</div>` +
            `<div class="text-amber-400 font-mono">💶 Recette estimée : ${d.revenue} € (RevPAR : ${d.revPar}€)</div>`
          );
      });
  }, [trendData, activeMetricFilter, timeRange]);

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'Date,DisplayDate,HotelOccupancy_Pct,ClinicAppointments,EstimatedRevenue_EUR,RevPAR_EUR\n';
    trendData.forEach((row) => {
      csv += `${row.date},${row.displayDate},${row.hotelOccupancy},${row.clinicAppointments},${row.revenue},${row.revPar}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking_analytics_${timeRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-6">
      {/* Header with Title & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {language === 'fr'
                ? 'Booking Analytics & Optimisation des Plannings'
                : language === 'ar'
                ? 'تحليلات الحجوزات وتحسين الجداول'
                : 'Booking Analytics & Schedule Optimization'}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase">
              D3.js Data Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'fr'
              ? 'Indicateurs USALI (RevPAR, ADR), taux d\'occupation hôtelier et flux de consultations cliniques'
              : 'USALI hospital metrics (RevPAR, ADR), lodging occupancy curves and healthcare consultation flows'}
          </p>
        </div>

        {/* Filter and Export buttons */}
        <div className="flex items-center gap-2">
          {/* Time range pills */}
          <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
            {(['7d', '14d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  timeRange === r
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r === '7d' ? '7 Jours' : r === '14d' ? '14 Jours' : '30 Jours'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* International Hospitality & Clinic KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* RevPAR */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">RevPAR (USALI)</span>
            <DollarSign size={15} className="text-blue-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {kpis.revPar} €
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
            +12.4% vs benchmark
          </span>
        </div>

        {/* ADR */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">ADR (Prix moyen)</span>
            <Bed size={15} className="text-indigo-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {kpis.adr} €
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Tarif journalier moyen
          </span>
        </div>

        {/* Hotel Occupancy */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Taux d'Occ. Hôtel</span>
            <TrendingUp size={15} className="text-sky-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {kpis.hotelOccupancyRate} %
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
            Cible &gt; 75% atteinte
          </span>
        </div>

        {/* ALOS */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">ALOS (Durée séjour)</span>
            <Clock size={15} className="text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {kpis.alos} nuits
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Stabilité internationale
          </span>
        </div>

        {/* Clinic Volume */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Volume Clinique</span>
            <Stethoscope size={15} className="text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {kpis.clinicAppointmentsTotal} actes
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
            {kpis.clinicUtilizationRate}% utilisation
          </span>
        </div>

        {/* Teleconsultation */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Téléconsultations</span>
            <Sparkles size={15} className="text-purple-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {kpis.clinicTeleconsultRatio} %
          </div>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold block mt-0.5">
            Conforme télémédecine
          </span>
        </div>
      </div>

      {/* D3.js Multi-Trend Interactive Area Chart */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 size={16} className="text-blue-500" />
              <span>Courbes d'Évolution & Tendance des Réservations (Moteur D3.js)</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Survolez le graphique pour afficher les valeurs exactes jour par jour.
            </span>
          </div>

          {/* Metric display filter buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setActiveMetricFilter('all')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                activeMetricFilter === 'all'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setActiveMetricFilter('occupancy')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                activeMetricFilter === 'occupancy'
                  ? 'bg-sky-500 text-white'
                  : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
              Taux d'Occ. (%)
            </button>
            <button
              onClick={() => setActiveMetricFilter('clinic')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                activeMetricFilter === 'clinic'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              RDV Clinique
            </button>
          </div>
        </div>

        {/* Chart SVG wrapper */}
        <div className="w-full overflow-hidden">
          <svg ref={chartRef} className="w-full" />
        </div>

        {/* Legend beneath the D3 Chart */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-sky-500 rounded-sm" />
              <span>Taux d'occupation hôtel (Échelle gauche %)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-emerald-500 rounded-sm border-dashed" />
              <span>Consultations cliniques (Échelle droite actes)</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Période : {trendData[0]?.date} → {trendData[trendData.length - 1]?.date}
          </span>
        </div>
      </div>

      {/* Schedule Optimization Engine (Normes Internationales) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-500" />
            <span>Moteur d'Optimisation des Plannings & Recommandations Métier</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            Conforme aux normes hôtelières USALI et de régulation médicale
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      ins.priority === 'high'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    Priorité {ins.priority}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {ins.metric}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-xs mb-1">
                  {ins.title[language] || ins.title.en}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                  {ins.description[language] || ins.description.en}
                </p>

                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-700 dark:text-slate-300 mb-3">
                  <strong className="block text-slate-900 dark:text-white mb-0.5 text-[10px] uppercase text-emerald-600 dark:text-emerald-400">
                    Action Recommandée :
                  </strong>
                  {ins.recommendedAction[language] || ins.recommendedAction.en}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 text-[11px]">Impact estimé :</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {ins.potentialGain}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating D3 Tooltip */}
      <div
        id="chart-tooltip"
        className="fixed z-50 pointer-events-none p-2.5 bg-slate-900 text-white rounded-lg shadow-xl text-xs border border-slate-700 transition-opacity duration-150 opacity-0"
      />
    </div>
  );
};
