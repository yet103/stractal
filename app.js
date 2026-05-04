// ===== Organization Chart App =====
(function () {
  'use strict';

  // ===== Data Model =====
  const state = {
    persons: [],
    regions: [],
    roles: [],
    connectors: [],
    textAnnotations: [],
    scheduleBars: [],
    timelines: [],
    shapes: [],
    layers: [{ id: 1, name: 'メイン', visible: true, locked: false }],
    activeLayerId: 1,
    tabs: [],
    activeTabId: null,
    viewMode: 'square', // 'square' | 'quarter'
    tool: 'select',     // 'select' | 'region' | 'connector' | 'text' | 'scheduleBar'
    selectedId: null,
    selectedType: null,  // 'person' | 'region' | 'connector' | 'text' | 'scheduleBar'
    dragging: null,
    regionDraw: null,
    connectorDraw: null, // { fromRegionId, fromSide, currentX, currentY }
    rangeSelect: null,
    multiSelection: { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] },
    shiftHeld: false,
    prevTool: null, // for shift-key temp connector mode
    addingWaypoints: false, // show "+" handles for adding waypoints
    searchQuery: '',
    nextId: 1,
    gridSize: 40,
    canvasOffset: { x: 0, y: 0 },
    zoom: 1.0,
    zoomMin: 0.25,
    zoomMax: 3.0,
    undoStack: [],
    redoStack: [],
    undoMax: 50,
    // Resource plan configuration
    planConfig: {
      startDate: new Date().getFullYear() + '-04',  // YYYY-MM
      periodCount: 12,
      periodUnit: 'month', // 'month' | 'quarter' | 'week'
    },
  };

  // ===== Period Helpers =====
  function generatePeriodLabels() {
    const cfg = state.planConfig;
    const labels = [];
    const [startY, startM] = cfg.startDate.split('-').map(Number);
    for (let i = 0; i < cfg.periodCount; i++) {
      if (cfg.periodUnit === 'month') {
        const m = ((startM - 1 + i) % 12) + 1;
        const y = startY + Math.floor((startM - 1 + i) / 12);
        labels.push(`${y}/${String(m).padStart(2, '0')}`);
      } else if (cfg.periodUnit === 'quarter') {
        const totalM = (startM - 1) + i * 3;
        const y = startY + Math.floor(totalM / 12);
        const q = Math.floor((totalM % 12) / 3) + 1;
        labels.push(`${y}/Q${q}`);
      } else if (cfg.periodUnit === 'week') {
        const d = new Date(startY, startM - 1, 1);
        d.setDate(d.getDate() + i * 7);
        labels.push(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}W${Math.ceil(d.getDate() / 7)}`);
      }
    }
    return labels;
  }

  function migratePlanConfig(data) {
    if (!data.planConfig) {
      data.planConfig = {
        startDate: new Date().getFullYear() + '-04',
        periodCount: 12,
        periodUnit: 'month',
      };
    }
    return data.planConfig;
  }

  // ===== DOM References =====
  const canvas = document.getElementById('main-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('canvas-container');
  const personListEl = document.getElementById('person-list');

  const btnAddPerson = document.getElementById('btn-add-person');
  const btnAddItem = document.getElementById('btn-add-item');
  const btnSquareView = document.getElementById('btn-square-view');
  const btnQuarterView = document.getElementById('btn-quarter-view');
  const btnToolSelect = document.getElementById('btn-tool-select');
  const btnToolRegion = document.getElementById('btn-tool-region');
  const btnToolConnector = document.getElementById('btn-tool-connector');
  const btnDelete = document.getElementById('btn-delete');
  const btnBulkCreate = document.getElementById('btn-bulk-create');
  const btnRoleManage = document.getElementById('btn-role-manage');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const zoomLabel = document.getElementById('zoom-label');
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const btnAlignTop = document.getElementById('btn-align-top');
  const btnAlignBottom = document.getElementById('btn-align-bottom');
  const btnAlignLeft = document.getElementById('btn-align-left');
  const btnAlignRight = document.getElementById('btn-align-right');
  const btnAlignCenterH = document.getElementById('btn-align-center-h');
  const btnAlignCenterV = document.getElementById('btn-align-center-v');

  // New feature buttons
  const btnExportPng = document.getElementById('btn-export-png');
  const btnImportCsv = document.getElementById('btn-import-csv');
  const csvImportInput = document.getElementById('csv-import-input');
  const btnPrint = document.getElementById('btn-print');
  const btnDarkMode = document.getElementById('btn-dark-mode');
  const btnShareUrl = document.getElementById('btn-share-url');
  const btnToolText = document.getElementById('btn-tool-text');
  const personSearch = document.getElementById('person-search');

  const connectorProps = document.getElementById('connector-props');
  const propConnectorLabel = document.getElementById('prop-connector-label');
  const propConnectorDirection = document.getElementById('prop-connector-direction');
  const propConnectorLinetype = document.getElementById('prop-connector-linetype');

  const noSelectionMsg = document.getElementById('no-selection-msg');
  const personProps = document.getElementById('person-props');
  const regionProps = document.getElementById('region-props');
  const textProps = document.getElementById('text-props');

  const propName = document.getElementById('prop-name');
  const propRole = document.getElementById('prop-role');
  const propAffiliation = document.getElementById('prop-affiliation');
  const propColor = document.getElementById('prop-color');
  const propEmail = document.getElementById('prop-email');
  const propPhone = document.getElementById('prop-phone');
  const propJoindate = document.getElementById('prop-joindate');
  const propEffectiveDate = document.getElementById('prop-effective-date');
  const propPhotoUrl = document.getElementById('prop-photo-url');
  const propRegionName = document.getElementById('prop-region-name');
  const propRegionColor = document.getElementById('prop-region-color');
  const propRegionFontsize = document.getElementById('prop-region-fontsize');
  const propRegionTextalign = document.getElementById('prop-region-textalign');
  const propRolesContainer = document.getElementById('prop-roles-container');
  const propTextContent = document.getElementById('prop-text-content');
  const propTextFontsize = document.getElementById('prop-text-fontsize');
  const propTextColor = document.getElementById('prop-text-color');

  // Z-order buttons
  const btnZFront = document.getElementById('btn-z-front');
  const btnZForward = document.getElementById('btn-z-forward');
  const btnZBackward = document.getElementById('btn-z-backward');
  const btnZBack = document.getElementById('btn-z-back');

  // Bulk modal
  const bulkModal = document.getElementById('bulk-modal');
  const bulkTextarea = document.getElementById('bulk-textarea');
  const bulkBtnCreate = document.getElementById('bulk-btn-create');
  const bulkBtnCancel = document.getElementById('bulk-btn-cancel');
  const testPersonCount = document.getElementById('test-person-count');
  const testOrgCount = document.getElementById('test-org-count');
  const testBtnGenerate = document.getElementById('test-btn-generate');

  // Role modal
  const roleModal = document.getElementById('role-modal');
  const roleBtnClose = document.getElementById('role-btn-close');
  const roleList = document.getElementById('role-list');
  const roleAddName = document.getElementById('role-add-name');
  const roleAddColor = document.getElementById('role-add-color');
  const roleAddIcon = document.getElementById('role-add-icon');
  const roleBtnAdd = document.getElementById('role-btn-add');

  // ===== Isometric Helpers =====
  function toIso(x, y) {
    return {
      x: (x - y) * 0.866,
      y: (x + y) * 0.5,
    };
  }

  function fromIso(ix, iy) {
    return {
      x: ix / 0.866 / 2 + iy,
      y: iy - ix / 0.866 / 2,
    };
  }

  function worldToScreen(wx, wy) {
    const cx = canvas.width / 2 + state.canvasOffset.x;
    const cy = canvas.height / 3 + state.canvasOffset.y;
    const z = state.zoom;
    if (state.viewMode === 'quarter') {
      const iso = toIso(wx, wy);
      return { x: iso.x * z + cx, y: iso.y * z + cy };
    }
    return { x: wx * z + cx, y: wy * z + cy };
  }

  function screenToWorld(sx, sy) {
    const cx = canvas.width / 2 + state.canvasOffset.x;
    const cy = canvas.height / 3 + state.canvasOffset.y;
    const z = state.zoom;
    if (state.viewMode === 'quarter') {
      return fromIso((sx - cx) / z, (sy - cy) / z);
    }
    return { x: (sx - cx) / z, y: (sy - cy) / z };
  }

  // ===== Canvas Resize =====
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  // ===== Drawing =====
  function render() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    drawGrid(w, h);
    drawTimelines();
    drawConnectors();
    drawRegions();
    drawRegionPreview();
    drawScheduleBars();
    drawShapes();
    drawTextAnnotations();
    drawPersons();
    drawConnectorPreview();
    drawConnectionPoints();
    drawRangeSelect();
    drawScheduleBarPreview();
    drawShapePreview();
  }

  function drawTextAnnotations() {
    state.textAnnotations.forEach(t => {
      if (!isOnVisibleLayer(t)) return;
      const s = worldToScreen(t.x, t.y);
      const isSelected = (state.selectedType === 'text' && state.selectedId === t.id) || (state.multiSelection.textIds || []).includes(t.id);
      const fontSize = (t.fontSize || 9) * state.zoom;
      ctx.font = `${fontSize}px "Segoe UI", "Meiryo", sans-serif`;
      ctx.fillStyle = t.color || '#2c3e50';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const lines = (t.text || '').split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, s.x, s.y + i * fontSize * 1.3);
      });
      if (isSelected) {
        const maxW = Math.max(...lines.map(l => ctx.measureText(l).width), 20);
        const totalH = lines.length * fontSize * 1.3;
        ctx.strokeStyle = '#4a8acf';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(s.x - 2, s.y - 2, maxW + 4, totalH + 4);
        ctx.setLineDash([]);
      }
    });
  }

  // ===== Schedule Bar Drawing =====
  function drawScheduleBarShape(ctx, x, y, w, h, tipShape, color, isSelected) {
    const tipW = Math.min(h * 0.5, w * 0.3);
    ctx.beginPath();
    switch (tipShape) {
      case 'chevron': // right end pointed
        ctx.moveTo(x, y);
        ctx.lineTo(x + w - tipW, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w - tipW, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      case 'doubleChevron': // both ends pointed
        ctx.moveTo(x + tipW, y);
        ctx.lineTo(x + w - tipW, y);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w - tipW, y + h);
        ctx.lineTo(x + tipW, y + h);
        ctx.lineTo(x, y + h / 2);
        ctx.closePath();
        break;
      case 'flat': // rectangle
        ctx.rect(x, y, w, h);
        break;
      case 'diamond': // diamond shape
        const cx = x + w / 2, cy = y + h / 2;
        ctx.moveTo(cx, y);
        ctx.lineTo(x + w, cy);
        ctx.lineTo(cx, y + h);
        ctx.lineTo(x, cy);
        ctx.closePath();
        break;
      case 'arrow': // filled arrow tip
        ctx.moveTo(x, y);
        ctx.lineTo(x + w - tipW, y);
        ctx.lineTo(x + w - tipW, y - h * 0.15);
        ctx.lineTo(x + w, y + h / 2);
        ctx.lineTo(x + w - tipW, y + h + h * 0.15);
        ctx.lineTo(x + w - tipW, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        break;
      default:
        ctx.rect(x, y, w, h);
    }
    ctx.fillStyle = color || '#4a8acf';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ff6b35' : darkenColor(color || '#4a8acf', 0.2);
    ctx.lineWidth = isSelected ? 2.5 : 1;
    ctx.stroke();
  }

  function darkenColor(hex, amount) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const num = parseInt(c, 16);
    let r = (num >> 16) & 0xFF, g = (num >> 8) & 0xFF, b = num & 0xFF;
    r = Math.max(0, Math.round(r * (1 - amount)));
    g = Math.max(0, Math.round(g * (1 - amount)));
    b = Math.max(0, Math.round(b * (1 - amount)));
    return `rgb(${r},${g},${b})`;
  }

  function drawScheduleBars() {
    state.scheduleBars.forEach(bar => {
      if (!isOnVisibleLayer(bar)) return;
      const s = worldToScreen(bar.x, bar.y);
      const e = worldToScreen(bar.x + bar.w, bar.y + bar.h);
      const sw = e.x - s.x;
      const sh = e.y - s.y;
      if (sw < 1 || sh < 1) return;

      const isSelected = (state.selectedType === 'scheduleBar' && state.selectedId === bar.id)
        || (state.multiSelection.scheduleBarIds || []).includes(bar.id);

      ctx.save();
      drawScheduleBarShape(ctx, s.x, s.y, sw, sh, bar.tipShape || 'chevron', bar.color || '#4a8acf', isSelected);

      // Label
      if (bar.label) {
        const fontSize = Math.min(sh * 0.6, 14 * state.zoom);
        ctx.font = `bold ${fontSize}px "Segoe UI", "Meiryo", sans-serif`;
        ctx.fillStyle = getContrastColor(bar.color || '#4a8acf');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = s.x + sw / 2;
        const cy = s.y + sh / 2;
        const maxTextW = sw * 0.85;
        const text = bar.label;
        const measured = ctx.measureText(text).width;
        if (measured > maxTextW && text.length > 3) {
          // Truncate
          let truncated = text;
          while (ctx.measureText(truncated + '…').width > maxTextW && truncated.length > 1) {
            truncated = truncated.slice(0, -1);
          }
          ctx.fillText(truncated + '…', cx, cy);
        } else {
          ctx.fillText(text, cx, cy);
        }
      }
      ctx.restore();

      // Resize handles when selected
      if (isSelected) {
        const handleSize = 6;
        ctx.fillStyle = '#ff6b35';
        // Left handle
        ctx.fillRect(s.x - handleSize/2, s.y + sh/2 - handleSize/2, handleSize, handleSize);
        // Right handle
        ctx.fillRect(e.x - handleSize/2, s.y + sh/2 - handleSize/2, handleSize, handleSize);
        // Top-left
        ctx.fillRect(s.x - handleSize/2, s.y - handleSize/2, handleSize, handleSize);
        // Bottom-right
        ctx.fillRect(e.x - handleSize/2, e.y - handleSize/2, handleSize, handleSize);
      }
    });
  }

  function drawScheduleBarPreview() {
    if (state.tool !== 'scheduleBar' || !state.scheduleBarDraw) return;
    const d = state.scheduleBarDraw;
    const s = worldToScreen(d.x, d.y);
    const e = worldToScreen(d.x + d.w, d.y + d.h);
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawScheduleBarShape(ctx, s.x, s.y, e.x - s.x, e.y - s.y, 'chevron', '#4a8acf', false);
    ctx.restore();
  }

  function getContrastColor(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const num = parseInt(c, 16);
    const r = (num >> 16) & 0xFF, g = (num >> 8) & 0xFF, b = num & 0xFF;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#2c3e50' : '#ffffff';
  }

  function hitTestScheduleBar(sx, sy) {
    const w = screenToWorld(sx, sy);
    for (let i = state.scheduleBars.length - 1; i >= 0; i--) {
      const bar = state.scheduleBars[i];
      if (w.x >= bar.x && w.x <= bar.x + bar.w && w.y >= bar.y && w.y <= bar.y + bar.h) {
        return bar;
      }
    }
    return null;
  }

  function hitTestScheduleBarResize(sx, sy) {
    if (state.selectedType !== 'scheduleBar') return null;
    const bar = state.scheduleBars.find(b => b.id === state.selectedId);
    if (!bar) return null;
    const s = worldToScreen(bar.x, bar.y);
    const e = worldToScreen(bar.x + bar.w, bar.y + bar.h);
    const handleSize = 8;
    // Right edge
    if (Math.abs(sx - e.x) < handleSize && sy > s.y - handleSize && sy < e.y + handleSize) return 'right';
    // Left edge
    if (Math.abs(sx - s.x) < handleSize && sy > s.y - handleSize && sy < e.y + handleSize) return 'left';
    // Bottom-right corner
    if (Math.abs(sx - e.x) < handleSize && Math.abs(sy - e.y) < handleSize) return 'bottom-right';
    return null;
  }

  // ===== Shape Drawing Engine =====
  const SHAPE_TYPES = [
    { type: 'rect',          label: '矩形',       icon: '■' },
    { type: 'roundedRect',   label: '角丸',       icon: '▢' },
    { type: 'ellipse',       label: '楕円',       icon: '●' },
    { type: 'triangle',      label: '三角形',     icon: '▲' },
    { type: 'diamond',       label: 'ひし形',     icon: '◆' },
    { type: 'hexagon',       label: '六角形',     icon: '⬡' },
    { type: 'pentagon',      label: '五角形',     icon: '⬠' },
    { type: 'star',          label: '星',         icon: '★' },
    { type: 'arrow',         label: '矢印(右)',   icon: '➡' },
    { type: 'chevronRight',  label: 'シェブロン→', icon: '▷' },
    { type: 'chevronLeft',   label: 'シェブロン←', icon: '◁' },
    { type: 'callout',       label: '吹き出し',   icon: '💬' },
    { type: 'cross',         label: '十字',       icon: '✚' },
    { type: 'pill',          label: 'カプセル',    icon: '⊂⊃' },
    { type: 'parallelogram', label: '平行四辺形',  icon: '▱' },
  ];

  function buildShapePath(ctx, type, w, h) {
    const hw = w / 2, hh = h / 2;
    ctx.beginPath();
    switch (type) {
      case 'rect':
        ctx.rect(-hw, -hh, w, h);
        break;
      case 'roundedRect': {
        const r = Math.min(w, h) * 0.15;
        ctx.moveTo(-hw + r, -hh);
        ctx.lineTo(hw - r, -hh);
        ctx.arcTo(hw, -hh, hw, -hh + r, r);
        ctx.lineTo(hw, hh - r);
        ctx.arcTo(hw, hh, hw - r, hh, r);
        ctx.lineTo(-hw + r, hh);
        ctx.arcTo(-hw, hh, -hw, hh - r, r);
        ctx.lineTo(-hw, -hh + r);
        ctx.arcTo(-hw, -hh, -hw + r, -hh, r);
        ctx.closePath();
        break;
      }
      case 'ellipse':
        ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
        break;
      case 'triangle':
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
        break;
      case 'diamond':
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(0, hh);
        ctx.lineTo(-hw, 0);
        ctx.closePath();
        break;
      case 'hexagon': {
        const sx = hw * 0.5;
        ctx.moveTo(-sx, -hh);
        ctx.lineTo(sx, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(sx, hh);
        ctx.lineTo(-sx, hh);
        ctx.lineTo(-hw, 0);
        ctx.closePath();
        break;
      }
      case 'pentagon':
        for (let i = 0; i < 5; i++) {
          const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
          const px = Math.cos(a) * hw;
          const py = Math.sin(a) * hh;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      case 'star': {
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI / 5) - Math.PI / 2;
          const r2 = i % 2 === 0 ? 1 : 0.4;
          const px = Math.cos(a) * hw * r2;
          const py = Math.sin(a) * hh * r2;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'arrow': {
        const tipW = Math.min(hh, hw * 0.4);
        const bodyH = hh * 0.5;
        ctx.moveTo(-hw, -bodyH);
        ctx.lineTo(hw - tipW, -bodyH);
        ctx.lineTo(hw - tipW, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(hw - tipW, hh);
        ctx.lineTo(hw - tipW, bodyH);
        ctx.lineTo(-hw, bodyH);
        ctx.closePath();
        break;
      }
      case 'chevronRight': {
        const tipW = Math.min(hh, hw * 0.35);
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw - tipW, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(hw - tipW, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
        break;
      }
      case 'chevronLeft': {
        const tipW = Math.min(hh, hw * 0.35);
        ctx.moveTo(-hw + tipW, -hh);
        ctx.lineTo(hw, -hh);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw + tipW, hh);
        ctx.lineTo(-hw, 0);
        ctx.closePath();
        break;
      }
      case 'callout': {
        const r = Math.min(w, h) * 0.1;
        const tailW = w * 0.12, tailH = h * 0.2;
        // Body (rounded rect without bottom-left corner)
        ctx.moveTo(-hw + r, -hh);
        ctx.lineTo(hw - r, -hh);
        ctx.arcTo(hw, -hh, hw, -hh + r, r);
        ctx.lineTo(hw, hh - r);
        ctx.arcTo(hw, hh, hw - r, hh, r);
        // Tail
        ctx.lineTo(-hw + tailW * 2, hh);
        ctx.lineTo(-hw + tailW * 0.5, hh + tailH);
        ctx.lineTo(-hw + tailW, hh);
        ctx.lineTo(-hw + r, hh);
        ctx.arcTo(-hw, hh, -hw, hh - r, r);
        ctx.lineTo(-hw, -hh + r);
        ctx.arcTo(-hw, -hh, -hw + r, -hh, r);
        ctx.closePath();
        break;
      }
      case 'cross': {
        const armW = hw * 0.35;
        const armH = hh * 0.35;
        ctx.moveTo(-armW, -hh);
        ctx.lineTo(armW, -hh);
        ctx.lineTo(armW, -armH);
        ctx.lineTo(hw, -armH);
        ctx.lineTo(hw, armH);
        ctx.lineTo(armW, armH);
        ctx.lineTo(armW, hh);
        ctx.lineTo(-armW, hh);
        ctx.lineTo(-armW, armH);
        ctx.lineTo(-hw, armH);
        ctx.lineTo(-hw, -armH);
        ctx.lineTo(-armW, -armH);
        ctx.closePath();
        break;
      }
      case 'pill':
        ctx.moveTo(-hw + hh, -hh);
        ctx.lineTo(hw - hh, -hh);
        ctx.arc(hw - hh, 0, hh, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-hw + hh, hh);
        ctx.arc(-hw + hh, 0, hh, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        break;
      case 'parallelogram': {
        const skew = hw * 0.25;
        ctx.moveTo(-hw + skew, -hh);
        ctx.lineTo(hw, -hh);
        ctx.lineTo(hw - skew, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
        break;
      }
      default:
        ctx.rect(-hw, -hh, w, h);
    }
  }

  function drawShapes() {
    state.shapes.forEach(shape => {
      if (!isOnVisibleLayer(shape)) return;
      const isSelected = (state.selectedType === 'shape' && state.selectedId === shape.id);
      const isMulti = state.multiSelection.shapeIds && state.multiSelection.shapeIds.includes(shape.id);

      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const origin = worldToScreen(cx, cy);
      const sw = shape.w * state.zoom;
      const sh = shape.h * state.zoom;
      const rot = shape.rotation || 0;

      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.rotate(rot);

      // Draw shape path
      buildShapePath(ctx, shape.type, sw, sh);
      ctx.fillStyle = shape.color || '#4a90d9';
      ctx.globalAlpha = shape.opacity != null ? shape.opacity : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = (isSelected || isMulti) ? '#ff6b35' : (shape.borderColor || '#2c3e50');
      ctx.lineWidth = (isSelected || isMulti) ? 2.5 : (shape.borderWidth || 1);
      ctx.stroke();

      // Label
      if (shape.label) {
        const fs = (shape.fontSize || 12) * state.zoom;
        ctx.font = `${Math.max(8, fs)}px "Segoe UI", "Meiryo", sans-serif`;
        ctx.fillStyle = shape.fontColor || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shape.label, 0, 0);
      }

      ctx.restore();

      // Resize handles (drawn in screen space, not rotated)
      if (isSelected) {
        const corners = getShapeCorners(shape);
        const hs = 6;
        ctx.fillStyle = '#ff6b35';
        corners.forEach(c => {
          ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
        });
        // Rotation handle
        const topCenter = worldToScreen(
          cx + Math.sin(rot) * (shape.h / 2 + 25),
          cy - Math.cos(rot) * (shape.h / 2 + 25)
        );
        ctx.beginPath();
        ctx.arc(topCenter.x, topCenter.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Connector line to shape
        const topEdge = worldToScreen(
          cx + Math.sin(rot) * (shape.h / 2),
          cy - Math.cos(rot) * (shape.h / 2)
        );
        ctx.beginPath();
        ctx.moveTo(topEdge.x, topEdge.y);
        ctx.lineTo(topCenter.x, topCenter.y);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  function getShapeCorners(shape) {
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    const hw = shape.w / 2, hh = shape.h / 2;
    const rot = shape.rotation || 0;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const offsets = [
      { dx: -hw, dy: -hh }, { dx: hw, dy: -hh },
      { dx: hw, dy: hh }, { dx: -hw, dy: hh },
      { dx: 0, dy: -hh }, { dx: hw, dy: 0 },
      { dx: 0, dy: hh }, { dx: -hw, dy: 0 },
    ];
    return offsets.map(o => {
      const rx = o.dx * cos - o.dy * sin + cx;
      const ry = o.dx * sin + o.dy * cos + cy;
      return worldToScreen(rx, ry);
    });
  }

  function hitTestShape(sx, sy) {
    const w = screenToWorld(sx, sy);
    for (let i = state.shapes.length - 1; i >= 0; i--) {
      const shape = state.shapes[i];
      if (!isOnVisibleLayer(shape)) continue;
      // Transform point into shape's local space (unrotate)
      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const rot = -(shape.rotation || 0);
      const dx = w.x - cx, dy = w.y - cy;
      const lx = dx * Math.cos(rot) - dy * Math.sin(rot);
      const ly = dx * Math.sin(rot) + dy * Math.cos(rot);
      if (Math.abs(lx) <= shape.w / 2 && Math.abs(ly) <= shape.h / 2) {
        return shape;
      }
    }
    return null;
  }

  function hitTestShapeResize(sx, sy) {
    if (state.selectedType !== 'shape') return null;
    const shape = state.shapes.find(s => s.id === state.selectedId);
    if (!shape) return null;
    const corners = getShapeCorners(shape);
    const dirs = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
    const tol = 10;
    for (let i = 0; i < corners.length; i++) {
      if (Math.abs(sx - corners[i].x) < tol && Math.abs(sy - corners[i].y) < tol) {
        return { shape, dir: dirs[i] };
      }
    }
    return null;
  }

  function hitTestShapeRotation(sx, sy) {
    if (state.selectedType !== 'shape') return null;
    const shape = state.shapes.find(s => s.id === state.selectedId);
    if (!shape) return null;
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    const rot = shape.rotation || 0;
    const handleWorld = {
      x: cx + Math.sin(rot) * (shape.h / 2 + 25),
      y: cy - Math.cos(rot) * (shape.h / 2 + 25),
    };
    const handleScreen = worldToScreen(handleWorld.x, handleWorld.y);
    if (Math.abs(sx - handleScreen.x) < 12 && Math.abs(sy - handleScreen.y) < 12) {
      return shape;
    }
    return null;
  }

  function createShape(config) {
    const shape = {
      id: state.nextId++,
      type: config.type || 'rect',
      x: config.x || 0,
      y: config.y || 0,
      w: config.w || 120,
      h: config.h || 80,
      rotation: 0,
      color: config.color || '#4a90d9',
      borderColor: '#2c3e50',
      borderWidth: 1,
      opacity: 1,
      label: '',
      fontSize: 12,
      fontColor: '#ffffff',
      layerId: state.activeLayerId,
    };
    pushUndo();
    state.shapes.push(shape);
    selectItem('shape', shape.id);
    saveState();
    render();
    return shape;
  }

  function drawShapePreview() {
    if (!state.shapeDraw) return;
    const d = state.shapeDraw;
    const x = Math.min(d.startX, d.currentX);
    const y = Math.min(d.startY, d.currentY);
    const w = Math.abs(d.currentX - d.startX);
    const h = Math.abs(d.currentY - d.startY);
    if (w < 2 && h < 2) return;

    const cx = x + w / 2;
    const cy = y + h / 2;
    const origin = worldToScreen(cx, cy);
    const sw = w * state.zoom;
    const sh = h * state.zoom;

    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.globalAlpha = 0.5;
    buildShapePath(ctx, state.activeShapeType, sw, sh);
    ctx.fillStyle = '#4a90d9';
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ===== Timeline Grid Drawing =====
  const MONTH_NAMES_JA = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const QUARTER_COLORS = ['#e3f2fd','#e8f5e9','#fff3e0','#fce4ec']; // Q1-Q4 background

  function drawTimelines() {
    state.timelines.forEach(tl => {
      if (!isOnVisibleLayer(tl)) return;
      const isSelected = (state.selectedType === 'timeline' && state.selectedId === tl.id);

      const startYear = tl.startYear || 2026;
      const startMonth = tl.startMonth || 4; // 1-based
      const monthCount = tl.monthCount || 12;
      const monthW = (tl.monthWidth || 80) * state.zoom;
      const rowH = (tl.rowHeight || 30) * state.zoom;
      const rowCount = tl.rowCount || 5;
      const headerH = (tl.headerHeight || 50) * state.zoom;
      const fontSize = tl.fontSize || 11;

      const origin = worldToScreen(tl.x, tl.y);
      const totalW = monthW * monthCount;
      const totalH = headerH + rowH * rowCount;

      ctx.save();

      // NO opaque background — transparent

      // Quarter background bands (semi-transparent)
      for (let m = 0; m < monthCount; m++) {
        const absMonth = startMonth + m;
        const q = Math.floor(((absMonth - 1) % 12) / 3);
        ctx.fillStyle = QUARTER_COLORS[q] + '30'; // very light
        ctx.fillRect(origin.x + m * monthW, origin.y + headerH, monthW, rowH * rowCount);
      }

      // Year headers
      const yearFontSize = Math.max(10, (fontSize + 2) * state.zoom);
      ctx.fillStyle = '#2c3e50';
      ctx.font = `bold ${yearFontSize}px "Segoe UI", "Meiryo", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let curYear = startYear;
      let yearStart = 0;
      for (let m = 0; m <= monthCount; m++) {
        const absMonth = startMonth + m;
        const yr = startYear + Math.floor((absMonth - 1) / 12);
        if (yr !== curYear || m === monthCount) {
          const x1 = origin.x + yearStart * monthW;
          const x2 = origin.x + m * monthW;
          // Year header band
          ctx.fillStyle = '#34495e';
          ctx.fillRect(x1, origin.y, x2 - x1, headerH * 0.45);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${curYear}年`, (x1 + x2) / 2, origin.y + headerH * 0.22);
          curYear = yr;
          yearStart = m;
        }
      }

      // Month headers
      const monthFontSize = Math.max(9, fontSize * state.zoom);
      ctx.font = `${monthFontSize}px "Segoe UI", "Meiryo", sans-serif`;
      for (let m = 0; m < monthCount; m++) {
        const absMonth = startMonth + m;
        const displayMonth = ((absMonth - 1) % 12) + 1;
        const mx = origin.x + m * monthW;

        // Month header cell
        const q = Math.floor((displayMonth - 1) / 3);
        ctx.fillStyle = QUARTER_COLORS[q] + 'a0';
        ctx.fillRect(mx, origin.y + headerH * 0.45, monthW, headerH * 0.55);

        // Month name
        ctx.fillStyle = '#2c3e50';
        ctx.textAlign = 'center';
        ctx.fillText(MONTH_NAMES_JA[displayMonth - 1], mx + monthW / 2, origin.y + headerH * 0.72);
      }

      // Vertical grid lines
      for (let m = 0; m <= monthCount; m++) {
        const absMonth = startMonth + m;
        const displayMonth = ((absMonth - 1) % 12) + 1;
        const lx = origin.x + m * monthW;

        if (displayMonth === 1 || m === 0) {
          ctx.strokeStyle = '#2c3e50';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);
        } else if (displayMonth === 4 || displayMonth === 7 || displayMonth === 10) {
          ctx.strokeStyle = '#7f8c8d';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = '#bdc3c7';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([4, 4]);
        }

        ctx.beginPath();
        ctx.moveTo(lx, origin.y + headerH);
        ctx.lineTo(lx, origin.y + totalH);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Horizontal row lines
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([]);
      for (let r = 0; r <= rowCount; r++) {
        const ry = origin.y + headerH + r * rowH;
        ctx.beginPath();
        ctx.moveTo(origin.x, ry);
        ctx.lineTo(origin.x + totalW, ry);
        ctx.stroke();
      }

      // Outer border
      ctx.strokeStyle = isSelected ? '#ff6b35' : '#34495e';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(origin.x, origin.y, totalW, totalH);

      // Row labels (left side)
      if (tl.rowLabels && tl.rowLabels.length > 0) {
        ctx.font = `${monthFontSize}px "Segoe UI", "Meiryo", sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#2c3e50';
        tl.rowLabels.forEach((label, i) => {
          if (i < rowCount && label) {
            ctx.fillText(label, origin.x - 5, origin.y + headerH + i * rowH + rowH / 2);
          }
        });
      }

      ctx.restore();

      // Selection resize handles
      if (isSelected) {
        const hs = 7;
        ctx.fillStyle = '#ff6b35';
        // Right-mid handle (drag to change monthWidth)
        ctx.fillRect(origin.x + totalW - hs/2, origin.y + headerH + (rowH * rowCount)/2 - hs/2, hs, hs);
        // Bottom-mid handle (drag to change rowHeight)
        ctx.fillRect(origin.x + totalW/2 - hs/2, origin.y + totalH - hs/2, hs, hs);
        // Bottom-right corner handle (drag both)
        ctx.fillRect(origin.x + totalW - hs/2, origin.y + totalH - hs/2, hs, hs);
      }
    });
  }

  function hitTestTimeline(sx, sy) {
    const w = screenToWorld(sx, sy);
    for (let i = state.timelines.length - 1; i >= 0; i--) {
      const tl = state.timelines[i];
      const totalW = (tl.monthWidth || 80) * (tl.monthCount || 12);
      const totalH = (tl.headerHeight || 50) + (tl.rowHeight || 30) * (tl.rowCount || 5);
      if (w.x >= tl.x && w.x <= tl.x + totalW && w.y >= tl.y && w.y <= tl.y + totalH) {
        return tl;
      }
    }
    return null;
  }

  function hitTestTimelineResize(sx, sy) {
    if (state.selectedType !== 'timeline') return null;
    const tl = state.timelines.find(t => t.id === state.selectedId);
    if (!tl) return null;
    const mw = tl.monthWidth || 80;
    const mc = tl.monthCount || 12;
    const rh = tl.rowHeight || 30;
    const rc = tl.rowCount || 5;
    const hh = tl.headerHeight || 50;
    const totalW = mw * mc;
    const totalH = hh + rh * rc;

    const origin = worldToScreen(tl.x, tl.y);
    const tol = 12;

    const rightEdge = origin.x + totalW * state.zoom;
    const bottomEdge = origin.y + totalH * state.zoom;
    const midY = origin.y + (hh + rh * rc / 2) * state.zoom;
    const midX = origin.x + (totalW / 2) * state.zoom;

    // Bottom-right corner
    if (Math.abs(sx - rightEdge) < tol && Math.abs(sy - bottomEdge) < tol) {
      return { tl, dir: 'bottom-right' };
    }
    // Right edge
    if (Math.abs(sx - rightEdge) < tol && sy > origin.y && sy < bottomEdge) {
      return { tl, dir: 'right' };
    }
    // Bottom edge
    if (Math.abs(sy - bottomEdge) < tol && sx > origin.x && sx < rightEdge) {
      return { tl, dir: 'bottom' };
    }
    return null;
  }

  function createTimeline(config) {
    const tl = {
      id: state.nextId++,
      x: config.x || 100,
      y: config.y || 100,
      startYear: config.startYear || new Date().getFullYear(),
      startMonth: config.startMonth || 4,
      monthCount: config.monthCount || 12,
      monthWidth: config.monthWidth || 80,
      rowHeight: config.rowHeight || 30,
      rowCount: config.rowCount || 5,
      headerHeight: config.headerHeight || 50,
      rowLabels: config.rowLabels || [],
      layerId: state.activeLayerId,
    };
    pushUndo();
    state.timelines.push(tl);
    selectItem('timeline', tl.id);
    saveState();
    render();
    return tl;
  }

  // ===== Connector Helpers =====
  function getConnectionPoint(region, side) {
    const s = worldToScreen(region.x, region.y);
    const e = worldToScreen(region.x + region.w, region.y + region.h);
    const cx = (s.x + e.x) / 2;
    const cy = (s.y + e.y) / 2;
    switch (side) {
      case 'top': return { x: cx, y: s.y };
      case 'bottom': return { x: cx, y: e.y };
      case 'left': return { x: s.x, y: cy };
      case 'right': return { x: e.x, y: cy };
    }
    return { x: cx, y: cy };
  }

  function getConnectionPointWorld(region, side) {
    const cx = region.x + region.w / 2;
    const cy = region.y + region.h / 2;
    switch (side) {
      case 'top': return { x: cx, y: region.y };
      case 'bottom': return { x: cx, y: region.y + region.h };
      case 'left': return { x: region.x, y: cy };
      case 'right': return { x: region.x + region.w, y: cy };
    }
    return { x: cx, y: cy };
  }

  function routeConnector(from, to, fromSide, toSide, waypoints) {
    // If waypoints provided, route through them with right-angle segments
    if (waypoints && waypoints.length > 0) {
      const points = [from];
      let prev = from;
      for (const wp of waypoints) {
        // Route each segment as horizontal then vertical
        points.push({ x: wp.x, y: prev.y });
        points.push({ x: wp.x, y: wp.y });
        prev = wp;
      }
      // Final leg to destination
      points.push({ x: to.x, y: prev.y });
      points.push(to);
      return points;
    }

    // Auto-route: build waypoints for a right-angle connector
    const points = [from];
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const offset = 30;

    if ((fromSide === 'right' && toSide === 'left') || (fromSide === 'left' && toSide === 'right')) {
      points.push({ x: midX, y: from.y });
      points.push({ x: midX, y: to.y });
    } else if ((fromSide === 'top' && toSide === 'bottom') || (fromSide === 'bottom' && toSide === 'top')) {
      points.push({ x: from.x, y: midY });
      points.push({ x: to.x, y: midY });
    } else if (fromSide === 'right' && toSide === 'right') {
      const x = Math.max(from.x, to.x) + offset;
      points.push({ x, y: from.y });
      points.push({ x, y: to.y });
    } else if (fromSide === 'left' && toSide === 'left') {
      const x = Math.min(from.x, to.x) - offset;
      points.push({ x, y: from.y });
      points.push({ x, y: to.y });
    } else if (fromSide === 'top' && toSide === 'top') {
      const y = Math.min(from.y, to.y) - offset;
      points.push({ x: from.x, y });
      points.push({ x: to.x, y });
    } else if (fromSide === 'bottom' && toSide === 'bottom') {
      const y = Math.max(from.y, to.y) + offset;
      points.push({ x: from.x, y });
      points.push({ x: to.x, y });
    } else {
      // Mixed: e.g. right→top, left→bottom etc
      if (fromSide === 'right' || fromSide === 'left') {
        points.push({ x: to.x, y: from.y });
      } else {
        points.push({ x: from.x, y: to.y });
      }
    }
    points.push(to);
    return points;
  }

  function drawRoundedPolyline(points, radius) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const r = Math.min(radius, Math.hypot(curr.x - prev.x, curr.y - prev.y) / 2,
        Math.hypot(next.x - curr.x, next.y - curr.y) / 2);
      ctx.arcTo(curr.x, curr.y, next.x, next.y, r);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  }

  function drawArrowHead(tipX, tipY, fromX, fromY, size) {
    const angle = Math.atan2(tipY - fromY, tipX - fromX);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - size * Math.cos(angle - Math.PI / 6), tipY - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tipX - size * Math.cos(angle + Math.PI / 6), tipY - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function getConnectorPoints(c) {
    // Free-form connector: uses fromX/fromY and toX/toY directly
    if (c.freeForm) {
      const from = worldToScreen(c.fromX, c.fromY);
      const to = worldToScreen(c.toX, c.toY);
      return [from, to];
    }
    const fromRegion = state.regions.find(r => r.id === c.fromRegionId);
    const toRegion = state.regions.find(r => r.id === c.toRegionId);
    if (!fromRegion || !toRegion) return null;
    const lineType = c.lineType || 'elbow';
    if (lineType === 'straight' || lineType === 'arrow') {
      // Straight line: just connect the two points directly
      const from = getConnectionPointWorld(fromRegion, c.fromSide);
      const to = getConnectionPointWorld(toRegion, c.toSide);
      return [worldToScreen(from.x, from.y), worldToScreen(to.x, to.y)];
    }
    // Elbow (default): route through waypoints
    const from = getConnectionPointWorld(fromRegion, c.fromSide);
    const to = getConnectionPointWorld(toRegion, c.toSide);
    const worldPoints = routeConnector(from, to, c.fromSide, c.toSide, c.waypoints || []);
    return worldPoints.map(p => worldToScreen(p.x, p.y));
  }

  function drawConnectors() {
    state.connectors.forEach(c => {
      if (!isOnVisibleLayer(c)) return;
      const points = getConnectorPoints(c);
      if (!points) return;
      const isMultiSel = (state.multiSelection.connectorIds || []).includes(c.id);
      const isSelected = (state.selectedType === 'connector' && state.selectedId === c.id) || isMultiSel;

      ctx.strokeStyle = isSelected ? '#e06c75' : '#5a9fd4';
      ctx.lineWidth = isSelected ? 2.5 : 1.8;
      ctx.fillStyle = ctx.strokeStyle;

      const lineType = c.lineType || 'elbow';
      if (lineType === 'straight' || lineType === 'arrow' || c.freeForm) {
        // Draw straight line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
      } else {
        drawRoundedPolyline(points, 8);
      }

      // Arrows
      const arrowSize = 8;
      const drawForward = lineType === 'arrow' || c.direction === 'forward' || c.direction === 'both';
      const drawBackward = c.direction === 'backward' || c.direction === 'both';
      if (drawForward) {
        const last = points[points.length - 1];
        const prev = points[points.length - 2];
        drawArrowHead(last.x, last.y, prev.x, prev.y, arrowSize);
      }
      if (drawBackward) {
        const first = points[0];
        const second = points[1];
        drawArrowHead(first.x, first.y, second.x, second.y, arrowSize);
      }

      // Label
      if (c.label) {
        let totalLen = 0;
        const segments = [];
        for (let i = 1; i < points.length; i++) {
          const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
          segments.push(len);
          totalLen += len;
        }
        let target = totalLen / 2;
        let mx = points[0].x, my = points[0].y;
        for (let i = 0; i < segments.length; i++) {
          if (target <= segments[i]) {
            const t = target / segments[i];
            mx = points[i].x + (points[i + 1].x - points[i].x) * t;
            my = points[i].y + (points[i + 1].y - points[i].y) * t;
            break;
          }
          target -= segments[i];
        }
        ctx.save();
        ctx.font = '9px "Segoe UI", "Meiryo", sans-serif';
        const tw = ctx.measureText(c.label).width;
        ctx.fillStyle = '#fff';
        ctx.fillRect(mx - tw / 2 - 4, my - 8, tw + 8, 16);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(mx - tw / 2 - 4, my - 8, tw + 8, 16);
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.label, mx, my);
        ctx.restore();
      }

      // Draw waypoint handles and midpoint add handles when selected
      if (isSelected) {
        // Existing waypoint handles (draggable)
        (c.waypoints || []).forEach(wp => {
          const s = worldToScreen(wp.x, wp.y);
          ctx.fillStyle = '#e06c75';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Midpoint "+" handles to add new waypoints (only in addingWaypoints mode)
        if (state.addingWaypoints && (c.waypoints || []).length < 12) {
          for (let i = 1; i < points.length; i++) {
            const mx = (points[i - 1].x + points[i].x) / 2;
            const my = (points[i - 1].y + points[i].y) / 2;
            const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
            if (segLen < 20) continue; // skip tiny segments
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#5a9fd4';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(mx, my, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Draw "+" sign
            ctx.strokeStyle = '#5a9fd4';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(mx - 3, my);
            ctx.lineTo(mx + 3, my);
            ctx.moveTo(mx, my - 3);
            ctx.lineTo(mx, my + 3);
            ctx.stroke();
          }
        }
        // FreeForm endpoint handles (draggable to re-edit)
        if (c.freeForm) {
          const fromS = worldToScreen(c.fromX, c.fromY);
          const toS = worldToScreen(c.toX, c.toY);
          [fromS, toS].forEach(pt => {
            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
      }
    });
  }

  function drawConnectionPoints() {
    if (state.tool !== 'connector' && !state.connectorDraw) return;
    const sides = ['top', 'bottom', 'left', 'right'];
    state.regions.forEach(r => {
      sides.forEach(side => {
        const pt = getConnectionPoint(r, side);
        ctx.fillStyle = '#5a9fd4';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    });
  }

  function drawConnectorPreview() {
    if (!state.connectorDraw) return;
    const cd = state.connectorDraw;
    ctx.strokeStyle = 'rgba(90,159,212,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    if (cd.freeForm) {
      const from = worldToScreen(cd.fromX, cd.fromY);
      ctx.moveTo(from.x, from.y);
    } else {
      const fromRegion = state.regions.find(r => r.id === cd.fromRegionId);
      if (!fromRegion) { ctx.setLineDash([]); return; }
      const from = getConnectionPoint(fromRegion, cd.fromSide);
      ctx.moveTo(from.x, from.y);
    }
    ctx.lineTo(cd.currentX, cd.currentY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function hitTestConnectionPoint(sx, sy) {
    if (state.tool !== 'connector' && !state.shiftHeld) return null;
    const sides = ['top', 'bottom', 'left', 'right'];
    const threshold = 10;
    for (const r of state.regions) {
      for (const side of sides) {
        const pt = getConnectionPoint(r, side);
        if (Math.abs(sx - pt.x) < threshold && Math.abs(sy - pt.y) < threshold) {
          return { region: r, side };
        }
      }
    }
    return null;
  }

  function hitTestFreeFormEndpoint(sx, sy, connector) {
    if (!connector || !connector.freeForm) return null;
    const threshold = 10;
    const fromS = worldToScreen(connector.fromX, connector.fromY);
    const toS = worldToScreen(connector.toX, connector.toY);
    if (Math.hypot(sx - fromS.x, sy - fromS.y) < threshold) return 'from';
    if (Math.hypot(sx - toS.x, sy - toS.y) < threshold) return 'to';
    return null;
  }

  function hitTestConnector(sx, sy) {
    const threshold = 8;
    for (const c of state.connectors) {
      const points = getConnectorPoints(c);
      if (!points) continue;
      for (let i = 1; i < points.length; i++) {
        const dist = distToSegment(sx, sy, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
        if (dist < threshold) return c;
      }
    }
    return null;
  }

  // Hit-test on existing waypoint handle (returns { connector, wpIndex })
  function hitTestWaypointHandle(sx, sy) {
    const threshold = 8;
    for (const c of state.connectors) {
      if (!c.waypoints) continue;
      for (let i = 0; i < c.waypoints.length; i++) {
        const s = worldToScreen(c.waypoints[i].x, c.waypoints[i].y);
        if (Math.hypot(sx - s.x, sy - s.y) < threshold) {
          return { connector: c, wpIndex: i };
        }
      }
    }
    return null;
  }

  // Hit-test on midpoint "+" handle (returns { connector, segIndex, worldPos })
  function hitTestMidpointHandle(sx, sy) {
    if (!state.addingWaypoints) return null;
    const threshold = 10;
    for (const c of state.connectors) {
      if (state.selectedType !== 'connector' || state.selectedId !== c.id) continue;
      if ((c.waypoints || []).length >= 12) continue;
      const points = getConnectorPoints(c);
      if (!points) continue;
      for (let i = 1; i < points.length; i++) {
        const mx = (points[i - 1].x + points[i].x) / 2;
        const my = (points[i - 1].y + points[i].y) / 2;
        const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        if (segLen < 20) continue;
        if (Math.hypot(sx - mx, sy - my) < threshold) {
          const worldPos = screenToWorld(mx, my);
          return { connector: c, segIndex: i - 1, worldPos };
        }
      }
    }
    return null;
  }

  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function drawGrid(w, h) {
    const g = state.gridSize;
    ctx.lineWidth = 0.5;

    if (state.viewMode === 'square') {
      ctx.strokeStyle = 'rgba(160,195,235,0.3)';
      // Calculate grid offset based on canvas offset so grid covers entire visible area
      const ox = state.canvasOffset.x;
      const oy = state.canvasOffset.y;
      const startX = ((w / 2 + ox) % (g * state.zoom) + (g * state.zoom)) % (g * state.zoom);
      const startY = ((h / 3 + oy) % (g * state.zoom) + (g * state.zoom)) % (g * state.zoom);
      for (let x = startX; x < w; x += g * state.zoom) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = startY; y < h; y += g * state.zoom) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(160,195,235,0.25)';
      // Compute range from ALL 4 screen corners to cover entire canvas in iso view
      const c1 = screenToWorld(0, 0);
      const c2 = screenToWorld(w, 0);
      const c3 = screenToWorld(w, h);
      const c4 = screenToWorld(0, h);
      const allX = [c1.x, c2.x, c3.x, c4.x];
      const allY = [c1.y, c2.y, c3.y, c4.y];
      const margin = g * 4;
      const minX = Math.floor((Math.min(...allX) - margin) / g) * g;
      const maxX = Math.ceil((Math.max(...allX) + margin) / g) * g;
      const minY = Math.floor((Math.min(...allY) - margin) / g) * g;
      const maxY = Math.ceil((Math.max(...allY) + margin) / g) * g;
      const step = g;
      for (let i = minX; i <= maxX; i += step) {
        const p1 = worldToScreen(i, minY);
        const p2 = worldToScreen(i, maxY);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      for (let i = minY; i <= maxY; i += step) {
        const p3 = worldToScreen(minX, i);
        const p4 = worldToScreen(maxX, i);
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.stroke();
      }
    }
  }

  function drawRegions() {
    state.regions.forEach(r => {
      if (!isOnVisibleLayer(r)) return;
      const isSelected = (state.selectedType === 'region' && state.selectedId === r.id) || state.multiSelection.regionIds.includes(r.id);
      const rc = r.color || '#4a8acf';

      if (state.viewMode === 'square') {
        const s = worldToScreen(r.x, r.y);
        const e = worldToScreen(r.x + r.w, r.y + r.h);
        // Parse region color for rgba
        const hexToRgba = (hex, a) => {
          const bigint = parseInt(hex.replace('#', ''), 16);
          return `rgba(${(bigint >> 16) & 255},${(bigint >> 8) & 255},${bigint & 255},${a})`;
        };
        ctx.fillStyle = isSelected ? hexToRgba(rc, 0.1) : hexToRgba(rc, 0.05);
        ctx.fillRect(s.x, s.y, e.x - s.x, e.y - s.y);
        ctx.strokeStyle = isSelected ? rc : hexToRgba(rc, 0.6);
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.setLineDash(isSelected ? [] : [6, 3]);
        ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
        ctx.setLineDash([]);

        if (r.name) {
          ctx.fillStyle = rc;
          const rFontSize = r.fontSize || 13;
          ctx.font = `${rFontSize}px "Segoe UI", "Meiryo", sans-serif`;
          const rAlign = r.textAlign || 'left';
          ctx.textAlign = rAlign;
          ctx.textBaseline = 'bottom';
          let labelX = s.x + 4;
          if (rAlign === 'center') labelX = (s.x + e.x) / 2;
          else if (rAlign === 'right') labelX = e.x - 4;
          ctx.fillText(r.name, labelX, s.y - 3);
        }
        // Region resource summary
        if (state.showRegionSummary !== false) {
          drawRegionSummary(r, s.x, s.y, e.x, e.y);
        }

        // Resize handles
        if (isSelected) {
          drawResizeHandles(s.x, s.y, e.x - s.x, e.y - s.y);
        }
      } else {
        const corners = [
          worldToScreen(r.x, r.y),
          worldToScreen(r.x + r.w, r.y),
          worldToScreen(r.x + r.w, r.y + r.h),
          worldToScreen(r.x, r.y + r.h),
        ];
        const hexToRgba = (hex, a) => {
          const bigint = parseInt(hex.replace('#', ''), 16);
          return `rgba(${(bigint >> 16) & 255},${(bigint >> 8) & 255},${bigint & 255},${a})`;
        };
        ctx.fillStyle = isSelected ? hexToRgba(rc, 0.1) : hexToRgba(rc, 0.05);
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = isSelected ? rc : hexToRgba(rc, 0.6);
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.setLineDash(isSelected ? [] : [6, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (r.name) {
          const top = corners[0];
          ctx.fillStyle = rc;
          ctx.font = '13px "Segoe UI", "Meiryo", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(r.name, top.x, top.y - 4);
        }

        // Resize handles in iso
        if (isSelected) {
          corners.forEach(c => {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#4a8acf';
            ctx.lineWidth = 1.5;
            ctx.fillRect(c.x - 4, c.y - 4, 8, 8);
            ctx.strokeRect(c.x - 4, c.y - 4, 8, 8);
          });
          // midpoints
          for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            const mx = (corners[i].x + corners[j].x) / 2;
            const my = (corners[i].y + corners[j].y) / 2;
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#4a8acf';
            ctx.fillRect(mx - 3, my - 3, 6, 6);
            ctx.strokeRect(mx - 3, my - 3, 6, 6);
          }
        }
      }
    });
  }

  const HANDLE_SIZE = 5;
  function drawResizeHandles(sx, sy, sw, sh) {
    const handles = getResizeHandlePositions(sx, sy, sw, sh);
    handles.forEach(h => {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#4a8acf';
      ctx.lineWidth = 1.5;
      ctx.fillRect(h.x - HANDLE_SIZE, h.y - HANDLE_SIZE, HANDLE_SIZE * 2, HANDLE_SIZE * 2);
      ctx.strokeRect(h.x - HANDLE_SIZE, h.y - HANDLE_SIZE, HANDLE_SIZE * 2, HANDLE_SIZE * 2);
    });
  }

  function getResizeHandlePositions(sx, sy, sw, sh) {
    return [
      { x: sx, y: sy, dir: 'nw' },
      { x: sx + sw / 2, y: sy, dir: 'n' },
      { x: sx + sw, y: sy, dir: 'ne' },
      { x: sx + sw, y: sy + sh / 2, dir: 'e' },
      { x: sx + sw, y: sy + sh, dir: 'se' },
      { x: sx + sw / 2, y: sy + sh, dir: 's' },
      { x: sx, y: sy + sh, dir: 'sw' },
      { x: sx, y: sy + sh / 2, dir: 'w' },
    ];
  }

  function drawRegionPreview() {
    if (!state.regionDraw) return;
    const rd = state.regionDraw;
    const x = Math.min(rd.startX, rd.currentX);
    const y = Math.min(rd.startY, rd.currentY);
    const w = Math.abs(rd.currentX - rd.startX);
    const h = Math.abs(rd.currentY - rd.startY);

    if (state.viewMode === 'square') {
      const s = worldToScreen(x, y);
      const e = worldToScreen(x + w, y + h);
      ctx.strokeStyle = '#4a8acf';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
      ctx.setLineDash([]);
    } else {
      const corners = [
        worldToScreen(x, y),
        worldToScreen(x + w, y),
        worldToScreen(x + w, y + h),
        worldToScreen(x, y + h),
      ];
      ctx.strokeStyle = '#4a8acf';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawRangeSelect() {
    if (!state.rangeSelect) return;
    const rs = state.rangeSelect;
    const x = Math.min(rs.startX, rs.currentX);
    const y = Math.min(rs.startY, rs.currentY);
    const w = Math.abs(rs.currentX - rs.startX);
    const h = Math.abs(rs.currentY - rs.startY);
    ctx.fillStyle = 'rgba(220,80,80,0.1)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#dc5050';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  // ===== Resource Allocation Canvas Drawing =====
  function drawMiniAllocationBar(cx, cy, person) {
    const allocs = person.allocations || [];
    if (allocs.length === 0) return;
    const total = getAllocationTotal(person);
    const barW = 36;
    const barH = 4;
    const barX = cx - barW / 2;
    const barY = cy + 32; // Below icon

    ctx.save();
    // Background
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(barX, barY, barW, barH);

    // Allocation segments
    const colors = ['#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#e74c3c', '#1abc9c'];
    let offset = 0;
    allocs.forEach((a, i) => {
      const segW = barW * Math.min(a.ratio || 0, 1);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(barX + offset, barY, segW, barH);
      offset += segW;
    });

    // Border
    ctx.strokeStyle = total > 1.0 ? '#e74c3c' : '#999';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);

    // Percentage label
    const pct = Math.round(total * 100);
    ctx.font = '8px sans-serif';
    ctx.fillStyle = total > 1.0 ? '#e74c3c' : '#888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(pct + '%', cx, barY + barH + 1);

    ctx.restore();
  }

  function drawRegionSummary(region, sx, sy, ex, ey) {
    const summary = getRegionResourceSummary(region.id);
    if (summary.resources.length === 0) return;

    ctx.save();
    const lines = [];
    if (summary.humanUnits > 0) lines.push(`👥 ${summary.humanUnits.toFixed(1)}${summary.humanUnit}`);
    if (summary.itemUnits > 0) lines.push(`📦 ${summary.itemUnits.toFixed(0)}${summary.itemUnit}`);
    if (summary.totalCost > 0) lines.push(`💰 ¥${summary.totalCost.toLocaleString()}`);
    if (lines.length === 0) { ctx.restore(); return; }

    const fontSize = 10;
    ctx.font = `${fontSize}px "Segoe UI", "Meiryo", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    const lineH = fontSize + 3;
    const totalH = lines.length * lineH;
    const padX = 6;
    const padY = 4;
    const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const bgW = maxW + padX * 2;
    const bgH = totalH + padY * 2;
    const bgX = ex - bgW - 4;
    const bgY = ey - bgH - 4;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, bgX, bgY, bgW, bgH, 3);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#555';
    lines.forEach((line, i) => {
      ctx.fillText(line, ex - padX - 4, bgY + padY + (i + 1) * lineH);
    });

    ctx.restore();
  }

  function drawPersons() {
    const sorted = [...state.persons].sort((a, b) => a.y - b.y);
    sorted.forEach(p => {
      if (!isOnVisibleLayer(p)) return;
      const s = worldToScreen(p.x, p.y);
      const isSelected = state.selectedType === 'person' && state.selectedId === p.id;
      const isMultiSelected = state.multiSelection.personIds.includes(p.id);
      const personRoles = (p.roleIds || []).map(rid => state.roles.find(r => r.id === rid)).filter(Boolean);
      const iconType = p.icon || 'person';
      if (iconType === 'person' || !p.itemType || p.itemType === 'person') {
        drawPersonIcon(s.x, s.y, p.color, isSelected || isMultiSelected, p.name, personRoles);
      } else {
        drawItemIcon(s.x, s.y, p.color, isSelected || isMultiSelected, p.name, iconType);
      }
      // Mini allocation bar
      if (state.showAllocationBars !== false && p.allocations && p.allocations.length > 0) {
        drawMiniAllocationBar(s.x, s.y, p);
      }
    });
  }

  function drawPersonIcon(cx, cy, color, selected, name, roles) {
    const isQuarter = state.viewMode === 'quarter';
    const bodyH = isQuarter ? 28 : 24;
    const headR = isQuarter ? 10 : 9;
    const bodyW = isQuarter ? 20 : 18;

    ctx.save();
    // Shadow
    if (isQuarter) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath();
      ctx.ellipse(cx + 2, cy + 4, bodyW * 0.6, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body (cone/triangle) — overlaps head by half
    const bodyTop = cy - bodyH * 0.35;
    const bodyBottom = cy + bodyH * 0.5;
    const gradient = ctx.createLinearGradient(cx - bodyW / 2, bodyTop, cx + bodyW / 2, bodyBottom);
    gradient.addColorStop(0, lightenColor(color, 25));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, darkenColor(color, 25));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(cx, bodyTop);
    ctx.lineTo(cx + bodyW / 2, bodyBottom);
    ctx.lineTo(cx - bodyW / 2, bodyBottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darkenColor(color, 35);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Head — deeply embedded into body cone
    const headCY = bodyTop + headR * 0.5;
    const headGrad = ctx.createRadialGradient(cx - 2, headCY - 2, 1, cx, headCY, headR);
    headGrad.addColorStop(0, lightenColor(color, 40));
    headGrad.addColorStop(0.7, color);
    headGrad.addColorStop(1, darkenColor(color, 20));

    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = darkenColor(color, 35);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Selection highlight
    if (selected) {
      ctx.strokeStyle = '#4a8acf';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      const selR = Math.max(bodyW / 2, headR) + 6;
      const selCY = (headCY + bodyBottom) / 2;
      ctx.ellipse(cx, selCY, selR, (bodyBottom - headCY + headR) / 2 + 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Name label
    let labelY = bodyBottom + 4;
    if (name) {
      ctx.fillStyle = '#2c3e50';
      ctx.font = '13px "Segoe UI", "Meiryo", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(name, cx, labelY);
      labelY += 16;
    }

    // Role badges
    if (roles && roles.length > 0) {
      ctx.font = '10px "Segoe UI", "Meiryo", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      roles.forEach(role => {
        const label = (role.icon ? role.icon + ' ' : '') + role.name;
        const tw = ctx.measureText(label).width;
        const bw = tw + 8;
        const bh = 14;
        const bx = cx - bw / 2;

        // Badge background
        ctx.fillStyle = role.color || '#888';
        ctx.globalAlpha = 0.18;
        roundRect(ctx, bx, labelY, bw, bh, 3);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Badge border
        ctx.strokeStyle = role.color || '#888';
        ctx.lineWidth = 0.8;
        roundRect(ctx, bx, labelY, bw, bh, 3);
        ctx.stroke();

        // Badge text
        ctx.fillStyle = darkenColor(role.color || '#888', 15);
        ctx.fillText(label, cx, labelY + 2);
        labelY += 16;
      });
    }

    ctx.restore();
  }

  // ===== Icon Registry (Data-driven) =====
  const ICON_CATEGORIES = [
    { id: 'system',     label: '🖥 システム構成図' },
    { id: 'network',    label: '🌐 ネットワーク構成図' },
    { id: 'office',     label: '🏢 オフィス機器' },
    { id: 'stationery', label: '✏️ 文房具' },
    { id: 'general',    label: '⚡ 汎用' },
    { id: 'flowchart',  label: '📐 フローチャート' },
  ];

  // Registry entries: { id, name, emoji, category, draw }
  // To add a new icon: add an entry here + define a drawIconXxx function
  const ICON_REGISTRY = [];
  function registerIcon(id, name, emoji, category, drawFn) {
    ICON_REGISTRY.push({ id, name, emoji, category, draw: drawFn });
  }

  // Helper: get icon entry by id
  function getIconEntry(iconId) {
    return ICON_REGISTRY.find(e => e.id === iconId);
  }

  function drawItemIcon(cx, cy, color, selected, name, iconType) {
    const size = 20;
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + size + 4, size * 0.6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw icon from registry
    const entry = getIconEntry(iconType);
    if (entry && entry.draw) {
      entry.draw(cx, cy, size, color);
    } else {
      drawIconServer(cx, cy, size, color);
    }

    // Selection highlight
    if (selected) {
      ctx.strokeStyle = '#4a8acf';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.rect(cx - size - 4, cy - size - 4, size * 2 + 8, size * 2 + 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Name label
    if (name) {
      ctx.fillStyle = '#2c3e50';
      ctx.font = '13px "Segoe UI", "Meiryo", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(name, cx, cy + size + 6);
    }
    ctx.restore();
  }

  function drawIconServer(cx, cy, s, color) {
    const w = s * 1.2, h = s * 1.6;
    const x = cx - w / 2, y = cy - h / 2;
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, lightenColor(color, 20));
    grad.addColorStop(1, darkenColor(color, 20));
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    // Horizontal lines (rack divisions)
    ctx.strokeStyle = darkenColor(color, 15); ctx.lineWidth = 0.7;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(x + 3, y + h * i / 3); ctx.lineTo(x + w - 3, y + h * i / 3); ctx.stroke();
    }
    // LED dots
    ctx.fillStyle = '#4caf50';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(x + w - 6, y + h * (i + 0.5) / 3, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawIconPC(cx, cy, s, color) {
    const mw = s * 1.4, mh = s * 1.0;
    const mx = cx - mw / 2, my = cy - s * 0.6;
    const grad = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
    grad.addColorStop(0, lightenColor(color, 15)); grad.addColorStop(1, darkenColor(color, 15));
    ctx.fillStyle = grad;
    roundRect(ctx, mx, my, mw, mh, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, mx, my, mw, mh, 3); ctx.stroke();
    // Screen
    ctx.fillStyle = lightenColor(color, 45);
    roundRect(ctx, mx + 3, my + 3, mw - 6, mh - 8, 2); ctx.fill();
    // Stand
    ctx.fillStyle = darkenColor(color, 10);
    ctx.fillRect(cx - 3, my + mh, 6, 5);
    ctx.fillRect(cx - 8, my + mh + 5, 16, 3);
  }

  function drawIconPrinter(cx, cy, s, color) {
    const w = s * 1.4, h = s * 0.9;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    // Paper tray (top)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(x + 4, y - 5, w - 8, 6);
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 4, y - 5, w - 8, 6);
    // Paper output (bottom)
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(x + 4, y + h - 2, w - 8, 6);
    ctx.strokeRect(x + 4, y + h - 2, w - 8, 6);
  }

  function drawIconPhone(cx, cy, s, color) {
    const w = s * 0.7, h = s * 1.3;
    const x = cx - w / 2, y = cy - h / 2;
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, lightenColor(color, 15)); grad.addColorStop(1, darkenColor(color, 15));
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w, h, 5); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 5); ctx.stroke();
    // Screen
    ctx.fillStyle = lightenColor(color, 45);
    roundRect(ctx, x + 2, y + 5, w - 4, h - 12, 2); ctx.fill();
    // Home button
    ctx.beginPath(); ctx.arc(cx, y + h - 4, 2, 0, Math.PI * 2);
    ctx.strokeStyle = darkenColor(color, 20); ctx.lineWidth = 0.8; ctx.stroke();
  }

  function drawIconCloud(cx, cy, s, color) {
    ctx.fillStyle = lightenColor(color, 15);
    ctx.beginPath();
    ctx.arc(cx - s * 0.3, cy, s * 0.45, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.3, cy, s * 0.45, 0, Math.PI * 2);
    ctx.arc(cx, cy - s * 0.3, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx - s * 0.3, cy, s * 0.45, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + s * 0.3, cy, s * 0.45, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.3, s * 0.5, 0, Math.PI * 2); ctx.stroke();
    // Fill center to hide inner strokes
    ctx.fillStyle = lightenColor(color, 15);
    ctx.fillRect(cx - s * 0.5, cy - s * 0.15, s, s * 0.35);
  }

  function drawIconDatabase(cx, cy, s, color) {
    const w = s * 0.9, h = s * 1.3;
    const ry = h * 0.15;
    const top = cy - h / 2, bot = cy + h / 2;
    // Body
    const grad = ctx.createLinearGradient(cx - w, top, cx + w, bot);
    grad.addColorStop(0, lightenColor(color, 15)); grad.addColorStop(1, darkenColor(color, 15));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, top, w, ry, 0, 0, Math.PI, true); // top half (upward)
    ctx.lineTo(cx - w, bot);
    ctx.ellipse(cx, bot, w, ry, 0, Math.PI, 0, true);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1; ctx.stroke();
    // Top ellipse
    ctx.fillStyle = lightenColor(color, 25);
    ctx.beginPath(); ctx.ellipse(cx, top, w, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1; ctx.stroke();
    // Middle lines
    ctx.strokeStyle = darkenColor(color, 10); ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      const yy = top + h * i / 3;
      ctx.beginPath(); ctx.ellipse(cx, yy, w, ry * 0.7, 0, 0, Math.PI); ctx.stroke();
    }
  }

  function drawIconFolder(cx, cy, s, color) {
    const w = s * 1.4, h = s * 1.0;
    const x = cx - w / 2, y = cy - h / 2 + 3;
    // Tab
    ctx.fillStyle = darkenColor(color, 10);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.35, y);
    ctx.lineTo(x + w * 0.42, y - 5); ctx.lineTo(x, y - 5); ctx.closePath(); ctx.fill();
    // Body
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, lightenColor(color, 15)); grad.addColorStop(1, darkenColor(color, 10));
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
  }

  function drawIconGear(cx, cy, s, color) {
    const teeth = 8, outer = s * 0.8, inner = s * 0.55, hole = s * 0.25;
    ctx.fillStyle = lightenColor(color, 10);
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a1 = (i / teeth) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + 0.35) / teeth) * Math.PI * 2 - Math.PI / 2;
      const a3 = ((i + 0.5) / teeth) * Math.PI * 2 - Math.PI / 2;
      const a4 = ((i + 0.85) / teeth) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner);
      ctx.lineTo(cx + Math.cos(a1) * outer, cy + Math.sin(a1) * outer);
      ctx.lineTo(cx + Math.cos(a2) * outer, cy + Math.sin(a2) * outer);
      ctx.lineTo(cx + Math.cos(a3) * inner, cy + Math.sin(a3) * inner);
      ctx.lineTo(cx + Math.cos(a4) * inner, cy + Math.sin(a4) * inner);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1; ctx.stroke();
    // Center hole
    ctx.fillStyle = '#f8f8f8';
    ctx.beginPath(); ctx.arc(cx, cy, hole, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 20); ctx.lineWidth = 0.8; ctx.stroke();
  }

  function drawIconStar(cx, cy, s, color) {
    const spikes = 5, outerR = s * 0.8, innerR = s * 0.35;
    ctx.fillStyle = lightenColor(color, 10);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1; ctx.stroke();
  }

  // --- New icon drawing functions ---
  function drawIconLaptop(cx, cy, s, color) {
    const w = s * 1.3, h = s * 0.85;
    const x = cx - w / 2, y = cy - h / 2 - 2;
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, lightenColor(color, 15)); grad.addColorStop(1, darkenColor(color, 15));
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
    ctx.fillStyle = lightenColor(color, 45);
    roundRect(ctx, x + 2, y + 2, w - 4, h - 5, 1); ctx.fill();
    // Base
    ctx.fillStyle = darkenColor(color, 10);
    ctx.beginPath();
    ctx.moveTo(x - 3, y + h + 1); ctx.lineTo(x + w + 3, y + h + 1);
    ctx.lineTo(x + w, y + h + 4); ctx.lineTo(x, y + h + 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 0.7; ctx.stroke();
  }

  function drawIconContainer(cx, cy, s, color) {
    const w = s * 1.2, h = s * 0.9;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
    // Container lines
    ctx.strokeStyle = darkenColor(color, 15); ctx.lineWidth = 0.8;
    for (let i = 1; i <= 3; i++) {
      const lx = x + w * i / 4;
      ctx.beginPath(); ctx.moveTo(lx, y + 2); ctx.lineTo(lx, y + h - 2); ctx.stroke();
    }
    // Whale tail hint
    ctx.fillStyle = darkenColor(color, 20);
    ctx.beginPath(); ctx.moveTo(cx - 3, y - 3); ctx.lineTo(cx, y - 6); ctx.lineTo(cx + 3, y - 3); ctx.closePath(); ctx.fill();
  }

  function drawIconApi(cx, cy, s, color) {
    const r = s * 0.65;
    ctx.fillStyle = lightenColor(color, 15);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1; ctx.stroke();
    // Lightning bolt
    ctx.fillStyle = darkenColor(color, 25);
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - r * 0.55); ctx.lineTo(cx - 3, cy + 1);
    ctx.lineTo(cx + 1, cy + 1); ctx.lineTo(cx - 2, cy + r * 0.55);
    ctx.lineTo(cx + 3, cy - 1); ctx.lineTo(cx - 1, cy - 1);
    ctx.closePath(); ctx.fill();
  }

  function drawIconTerminal(cx, cy, s, color) {
    const w = s * 1.3, h = s * 1.0;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = '#1e1e1e';
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 20); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    // Prompt
    ctx.fillStyle = lightenColor(color, 30);
    ctx.font = (s * 0.55) + 'px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('>_', x + 4, cy + 1);
  }

  function drawIconCode(cx, cy, s, color) {
    const w = s * 1.2, h = s * 1.0;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = lightenColor(color, 35);
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    ctx.fillStyle = darkenColor(color, 20);
    ctx.font = 'bold ' + (s * 0.6) + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('</>', cx, cy + 1);
  }

  function drawIconBug(cx, cy, s, color) {
    const r = s * 0.5;
    ctx.fillStyle = lightenColor(color, 10);
    ctx.beginPath(); ctx.ellipse(cx, cy + 2, r, r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1; ctx.stroke();
    // Head
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.8, r * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Legs
    ctx.lineWidth = 1.2;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const ly = cy - 2 + i * 6;
        ctx.beginPath(); ctx.moveTo(cx + side * r * 0.7, ly);
        ctx.lineTo(cx + side * (r + 5), ly + (i - 1) * 2); ctx.stroke();
      }
    }
  }

  function drawIconLock(cx, cy, s, color) {
    const w = s * 0.9, h = s * 0.8;
    const x = cx - w / 2, y = cy;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
    // Shackle
    ctx.strokeStyle = darkenColor(color, 20); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, y, w * 0.35, Math.PI, 0); ctx.stroke();
    // Keyhole
    ctx.fillStyle = darkenColor(color, 35);
    ctx.beginPath(); ctx.arc(cx, y + h * 0.35, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - 1, y + h * 0.35, 2, h * 0.25);
  }

  function drawIconShield(cx, cy, s, color) {
    const w = s * 0.9, h = s * 1.2;
    const top = cy - h * 0.4;
    ctx.fillStyle = lightenColor(color, 10);
    ctx.beginPath();
    ctx.moveTo(cx, top); ctx.lineTo(cx + w / 2, top + h * 0.2);
    ctx.quadraticCurveTo(cx + w / 2, top + h * 0.8, cx, top + h);
    ctx.quadraticCurveTo(cx - w / 2, top + h * 0.8, cx - w / 2, top + h * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1; ctx.stroke();
    // Checkmark
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 4, cy + 1); ctx.lineTo(cx - 1, cy + 4); ctx.lineTo(cx + 5, cy - 3); ctx.stroke();
  }

  function drawIconRouter(cx, cy, s, color) {
    const w = s * 1.3, h = s * 0.7;
    const x = cx - w / 2, y = cy;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    // Antennas
    ctx.strokeStyle = darkenColor(color, 20); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 6, y); ctx.lineTo(cx - 10, y - s * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 6, y); ctx.lineTo(cx + 10, y - s * 0.6); ctx.stroke();
    // LED
    ctx.fillStyle = '#4caf50';
    ctx.beginPath(); ctx.arc(cx, y + h / 2, 2, 0, Math.PI * 2); ctx.fill();
  }

  function drawIconSwitchNet(cx, cy, s, color) {
    const w = s * 1.4, h = s * 0.55;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
    // Ports
    ctx.fillStyle = darkenColor(color, 20);
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x + 3 + i * (w - 8) / 5, y + h - 5, 3, 3);
    }
    // Arrows
    ctx.strokeStyle = darkenColor(color, 15); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(cx - 6, cy - 1); ctx.lineTo(cx + 6, cy - 1); ctx.stroke();
  }

  function drawIconFirewall(cx, cy, s, color) {
    const w = s * 1.0, h = s * 1.2;
    const x = cx - w / 2, y = cy - h / 2;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#e74c3c'); grad.addColorStop(0.5, lightenColor(color, 10)); grad.addColorStop(1, darkenColor(color, 15));
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
    // Brick pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.6;
    for (let row = 0; row < 4; row++) {
      const ry = y + 3 + row * (h - 6) / 4;
      ctx.beginPath(); ctx.moveTo(x + 2, ry); ctx.lineTo(x + w - 2, ry); ctx.stroke();
    }
  }

  function drawIconWifi(cx, cy, s, color) {
    ctx.strokeStyle = lightenColor(color, 10); ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.3, s * 0.25 * i, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
    }
    ctx.fillStyle = lightenColor(color, 10);
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.3, 3, 0, Math.PI * 2); ctx.fill();
  }

  function drawIconGlobe(cx, cy, s, color) {
    const r = s * 0.7;
    ctx.fillStyle = lightenColor(color, 25);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1; ctx.stroke();
    // Meridians
    ctx.strokeStyle = darkenColor(color, 10); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.4, r, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
  }

  function drawIconVpn(cx, cy, s, color) {
    const r = s * 0.55;
    ctx.fillStyle = lightenColor(color, 15);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1.5; ctx.stroke();
    // Lock inside
    ctx.fillStyle = darkenColor(color, 25);
    ctx.fillRect(cx - 4, cy, 8, 6);
    ctx.strokeStyle = darkenColor(color, 20); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, Math.PI, 0); ctx.stroke();
  }

  function drawIconDns(cx, cy, s, color) {
    const w = s * 1.2, h = s * 0.9;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = lightenColor(color, 20);
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    ctx.fillStyle = darkenColor(color, 20);
    ctx.font = 'bold ' + (s * 0.4) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DNS', cx, cy);
  }

  function drawIconLoadbalancer(cx, cy, s, color) {
    // Input line
    ctx.strokeStyle = darkenColor(color, 15); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.7); ctx.lineTo(cx, cy - 2); ctx.stroke();
    // Central circle
    ctx.fillStyle = lightenColor(color, 10);
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1; ctx.stroke();
    // Output lines
    for (let dx = -1; dx <= 1; dx++) {
      ctx.strokeStyle = darkenColor(color, 15); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy + 2);
      ctx.lineTo(cx + dx * s * 0.6, cy + s * 0.7); ctx.stroke();
    }
  }

  function drawIconDeskPhone(cx, cy, s, color) {
    const w = s * 1.1, h = s * 0.7;
    const x = cx - w / 2, y = cy;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
    // Handset
    ctx.strokeStyle = darkenColor(color, 20); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 8, y - 2); ctx.quadraticCurveTo(cx, y - 10, cx + 8, y - 2); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function drawIconMonitor(cx, cy, s, color) {
    const w = s * 1.6, h = s * 1.0;
    const x = cx - w / 2, y = cy - h / 2 - 2;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1.2;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    ctx.fillStyle = lightenColor(color, 45);
    roundRect(ctx, x + 3, y + 3, w - 6, h - 8, 1); ctx.fill();
    ctx.fillStyle = darkenColor(color, 10);
    ctx.fillRect(cx - 3, y + h, 6, 4);
    ctx.fillRect(cx - 10, y + h + 4, 20, 2);
  }

  function drawIconProjector(cx, cy, s, color) {
    const w = s * 1.3, h = s * 0.7;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    // Lens
    ctx.fillStyle = lightenColor(color, 40);
    ctx.beginPath(); ctx.arc(x + w * 0.25, cy, h * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1; ctx.stroke();
    // Light beam
    ctx.fillStyle = 'rgba(255,255,200,0.15)';
    ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x - s * 0.5, cy - s * 0.4);
    ctx.lineTo(x - s * 0.5, cy + s * 0.4); ctx.closePath(); ctx.fill();
  }

  function drawIconWhiteboard(cx, cy, s, color) {
    const w = s * 1.5, h = s * 1.1;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
    // Writing lines
    ctx.strokeStyle = lightenColor(color, 10); ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(x + 5, y + 6 + i * 7); ctx.lineTo(x + w - 5 - i * 4, y + 6 + i * 7); ctx.stroke();
    }
  }

  function drawIconCamera(cx, cy, s, color) {
    const w = s * 0.9, h = s * 0.7;
    const x = cx - w / 2, y = cy - h / 2 + 2;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    // Lens
    ctx.fillStyle = lightenColor(color, 40);
    ctx.beginPath(); ctx.arc(cx, cy + 2, h * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1; ctx.stroke();
    // Flash
    ctx.fillStyle = darkenColor(color, 15);
    ctx.fillRect(cx + w * 0.2, y - 3, 5, 4);
  }

  function drawIconHeadset(cx, cy, s, color) {
    const r = s * 0.6;
    // Band
    ctx.strokeStyle = darkenColor(color, 20); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy - 2, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    // Ear cups
    ctx.fillStyle = lightenColor(color, 10);
    ctx.fillRect(cx - r - 3, cy - 2, 6, s * 0.6);
    ctx.fillRect(cx + r - 3, cy - 2, 6, s * 0.6);
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    ctx.strokeRect(cx - r - 3, cy - 2, 6, s * 0.6);
    ctx.strokeRect(cx + r - 3, cy - 2, 6, s * 0.6);
    // Mic
    ctx.strokeStyle = darkenColor(color, 15); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - r, cy + s * 0.25); ctx.lineTo(cx - r - 4, cy + s * 0.55); ctx.stroke();
  }

  function drawIconSpeaker(cx, cy, s, color) {
    const w = s * 0.8, h = s * 1.2;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 4); ctx.stroke();
    // Speaker cone
    ctx.fillStyle = darkenColor(color, 15);
    ctx.beginPath(); ctx.arc(cx, cy + 2, w * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 0.8; ctx.stroke();
    // Tweeter
    ctx.beginPath(); ctx.arc(cx, cy - h * 0.25, 3, 0, Math.PI * 2); ctx.fill();
  }

  function drawIconDocument(cx, cy, s, color) {
    const w = s * 0.9, h = s * 1.2;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    // Dog-ear
    ctx.fillStyle = '#eee';
    ctx.beginPath(); ctx.moveTo(x + w - 6, y); ctx.lineTo(x + w, y + 6); ctx.lineTo(x + w - 6, y + 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5; ctx.stroke();
    // Lines
    ctx.strokeStyle = lightenColor(color, 10); ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x + 3, y + 10 + i * 5); ctx.lineTo(x + w - 4, y + 10 + i * 5); ctx.stroke();
    }
  }

  function drawIconClipboard(cx, cy, s, color) {
    const w = s * 1.0, h = s * 1.3;
    const x = cx - w / 2, y = cy - h / 2 + 2;
    ctx.fillStyle = lightenColor(color, 25);
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
    // Clip
    ctx.fillStyle = darkenColor(color, 15);
    roundRect(ctx, cx - 5, y - 4, 10, 7, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 0.8;
    roundRect(ctx, cx - 5, y - 4, 10, 7, 2); ctx.stroke();
    // Inner paper
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 3, y + 5, w - 6, h - 8);
  }

  function drawIconPencil(cx, cy, s, color) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 6);
    const w = 5, h = s * 1.4;
    ctx.fillStyle = lightenColor(color, 10);
    ctx.fillRect(-w / 2, -h / 2, w, h * 0.75);
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 0.8;
    ctx.strokeRect(-w / 2, -h / 2, w, h * 0.75);
    // Tip
    ctx.fillStyle = '#f5deb3';
    ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.25); ctx.lineTo(w / 2, h * 0.25);
    ctx.lineTo(0, h / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#999'; ctx.lineWidth = 0.5; ctx.stroke();
    // Eraser
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-w / 2, -h / 2, w, 4);
    ctx.restore();
  }

  function drawIconStamp(cx, cy, s, color) {
    // Handle
    ctx.fillStyle = darkenColor(color, 10);
    ctx.fillRect(cx - 3, cy - s * 0.5, 6, s * 0.5);
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 0.8;
    ctx.strokeRect(cx - 3, cy - s * 0.5, 6, s * 0.5);
    // Stamp base
    ctx.fillStyle = lightenColor(color, 10);
    roundRect(ctx, cx - s * 0.5, cy, s, s * 0.35, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 30); ctx.lineWidth = 1;
    roundRect(ctx, cx - s * 0.5, cy, s, s * 0.35, 2); ctx.stroke();
    // Ink mark
    ctx.fillStyle = '#c0392b'; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.55, s * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawIconCalendar(cx, cy, s, color) {
    const w = s * 1.1, h = s * 1.1;
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, w, h, 2); ctx.fill();
    ctx.strokeStyle = darkenColor(color, 25); ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 2); ctx.stroke();
    // Header
    ctx.fillStyle = lightenColor(color, 5);
    ctx.fillRect(x + 1, y + 1, w - 2, h * 0.25);
    // Rings
    ctx.strokeStyle = darkenColor(color, 20); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + w * 0.3, y - 2); ctx.lineTo(x + w * 0.3, y + 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.7, y - 2); ctx.lineTo(x + w * 0.7, y + 3); ctx.stroke();
    // Date grid
    ctx.fillStyle = darkenColor(color, 15);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      ctx.fillRect(x + 4 + c * (w - 10) / 3, y + h * 0.35 + r * 5, 2, 2);
    }
  }

  // ===== Register All Icons =====
  // System
  registerIcon('server',    'サーバ',        '🖥', 'system', drawIconServer);
  registerIcon('pc',        'PC',            '💻', 'system', drawIconPC);
  registerIcon('laptop',    'ノートPC',      '💻', 'system', drawIconLaptop);
  registerIcon('database',  'データベース',  '🗄', 'system', drawIconDatabase);
  registerIcon('cloud',     'クラウド',      '☁', 'system', drawIconCloud);
  registerIcon('container', 'コンテナ',      '📦', 'system', drawIconContainer);
  registerIcon('api',       'API',           '⚡', 'system', drawIconApi);
  registerIcon('terminal',  'ターミナル',    '>_', 'system', drawIconTerminal);
  registerIcon('code',      'コード',        '</>', 'system', drawIconCode);
  registerIcon('bug',       'バグ',          '🐛', 'system', drawIconBug);
  registerIcon('lock',      'セキュリティ',  '🔒', 'system', drawIconLock);
  registerIcon('shield',    '防御',          '🛡', 'system', drawIconShield);
  // Network
  registerIcon('router',       'ルーター',        '📡', 'network', drawIconRouter);
  registerIcon('switch_net',   'スイッチ',        '🔀', 'network', drawIconSwitchNet);
  registerIcon('firewall',     'ファイアウォール', '🧱', 'network', drawIconFirewall);
  registerIcon('wifi',         'Wi-Fi',           '📶', 'network', drawIconWifi);
  registerIcon('globe',        'インターネット',   '🌐', 'network', drawIconGlobe);
  registerIcon('vpn',          'VPN',             '🔐', 'network', drawIconVpn);
  registerIcon('dns',          'DNS',             '🏷', 'network', drawIconDns);
  registerIcon('loadbalancer', '負荷分散',        '⚖', 'network', drawIconLoadbalancer);
  // Office
  registerIcon('printer',    'プリンタ',      '🖨', 'office', drawIconPrinter);
  registerIcon('phone',      '電話',          '📱', 'office', drawIconPhone);
  registerIcon('desk_phone', '固定電話',      '☎', 'office', drawIconDeskPhone);
  registerIcon('monitor',    'モニター',      '🖥', 'office', drawIconMonitor);
  registerIcon('projector',  'プロジェクタ',  '📽', 'office', drawIconProjector);
  registerIcon('whiteboard', 'ホワイトボード','📋', 'office', drawIconWhiteboard);
  registerIcon('camera',     'カメラ',        '📷', 'office', drawIconCamera);
  registerIcon('headset',    'ヘッドセット',  '🎧', 'office', drawIconHeadset);
  registerIcon('speaker',    'スピーカー',    '🔊', 'office', drawIconSpeaker);
  // Stationery
  registerIcon('folder',    'フォルダ',        '📁', 'stationery', drawIconFolder);
  registerIcon('document',  '書類',            '📄', 'stationery', drawIconDocument);
  registerIcon('clipboard', 'クリップボード',  '📋', 'stationery', drawIconClipboard);
  registerIcon('pencil',    '鉛筆',            '✏', 'stationery', drawIconPencil);
  registerIcon('stamp',     'スタンプ',        '🔖', 'stationery', drawIconStamp);
  registerIcon('calendar',  'カレンダー',      '📅', 'stationery', drawIconCalendar);
  // General
  registerIcon('gear', '設定',   '⚙', 'general', drawIconGear);
  registerIcon('star', 'スター', '⭐', 'general', drawIconStar);
  // Flowchart
  registerIcon('fc_process',    '処理',         '▭', 'flowchart', drawIconFcProcess);
  registerIcon('fc_decision',   '判断',         '◇', 'flowchart', drawIconFcDecision);
  registerIcon('fc_terminal',   '開始/終了',    '⬭', 'flowchart', drawIconFcTerminal);
  registerIcon('fc_data',       'データ',       '▱', 'flowchart', drawIconFcData);
  registerIcon('fc_document',   '書類',         '📄', 'flowchart', drawIconFcDocument);
  registerIcon('fc_predefined', '定義済処理',   '⊞', 'flowchart', drawIconFcPredefined);
  registerIcon('fc_manual',     '手作業',       '⏢', 'flowchart', drawIconFcManual);
  registerIcon('fc_connector',  '結合子',       '○', 'flowchart', drawIconFcConnector);
  registerIcon('fc_loop',       'ループ',       '⟲', 'flowchart', drawIconFcLoop);
  registerIcon('fc_display',    '表示',         '⏣', 'flowchart', drawIconFcDisplay);

  // --- Flowchart drawing functions ---
  function drawIconFcProcess(ctx, cx, cy, s) {
    // Rectangle (処理)
    const w = s * 0.8, h = s * 0.55;
    ctx.fillStyle = '#e3f2fd';
    ctx.strokeStyle = '#1565c0';
    ctx.lineWidth = 1.5;
    ctx.fillRect(cx - w/2, cy - h/2, w, h);
    ctx.strokeRect(cx - w/2, cy - h/2, w, h);
  }
  function drawIconFcDecision(ctx, cx, cy, s) {
    // Diamond (判断)
    const r = s * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = '#fff8e1';
    ctx.fill();
    ctx.strokeStyle = '#f57f17';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function drawIconFcTerminal(ctx, cx, cy, s) {
    // Rounded rectangle / Stadium (開始/終了)
    const w = s * 0.75, h = s * 0.45;
    const rad = h / 2;
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + rad, cy - h/2);
    ctx.lineTo(cx + w/2 - rad, cy - h/2);
    ctx.arc(cx + w/2 - rad, cy, rad, -Math.PI/2, Math.PI/2);
    ctx.lineTo(cx - w/2 + rad, cy + h/2);
    ctx.arc(cx - w/2 + rad, cy, rad, Math.PI/2, -Math.PI/2);
    ctx.closePath();
    ctx.fillStyle = '#e8f5e9';
    ctx.fill();
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function drawIconFcData(ctx, cx, cy, s) {
    // Parallelogram (データ)
    const w = s * 0.8, h = s * 0.5;
    const skew = s * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + skew, cy - h/2);
    ctx.lineTo(cx + w/2, cy - h/2);
    ctx.lineTo(cx + w/2 - skew, cy + h/2);
    ctx.lineTo(cx - w/2, cy + h/2);
    ctx.closePath();
    ctx.fillStyle = '#f3e5f5';
    ctx.fill();
    ctx.strokeStyle = '#7b1fa2';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function drawIconFcDocument(ctx, cx, cy, s) {
    // Document shape with wavy bottom
    const w = s * 0.75, h = s * 0.55;
    const x0 = cx - w/2, y0 = cy - h/2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + w, y0);
    ctx.lineTo(x0 + w, y0 + h * 0.8);
    ctx.bezierCurveTo(x0 + w * 0.7, y0 + h * 0.65, x0 + w * 0.3, y0 + h * 1.05, x0, y0 + h * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#fff3e0';
    ctx.fill();
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function drawIconFcPredefined(ctx, cx, cy, s) {
    // Rectangle with inner vertical lines (定義済処理)
    const w = s * 0.8, h = s * 0.55;
    const inset = s * 0.1;
    ctx.fillStyle = '#e0f7fa';
    ctx.strokeStyle = '#00695c';
    ctx.lineWidth = 1.5;
    ctx.fillRect(cx - w/2, cy - h/2, w, h);
    ctx.strokeRect(cx - w/2, cy - h/2, w, h);
    // Inner vertical lines
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + inset, cy - h/2);
    ctx.lineTo(cx - w/2 + inset, cy + h/2);
    ctx.moveTo(cx + w/2 - inset, cy - h/2);
    ctx.lineTo(cx + w/2 - inset, cy + h/2);
    ctx.stroke();
  }
  function drawIconFcManual(ctx, cx, cy, s) {
    // Trapezoid (手作業)
    const w = s * 0.8, h = s * 0.5;
    const top = s * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + top, cy - h/2);
    ctx.lineTo(cx + w/2 - top, cy - h/2);
    ctx.lineTo(cx + w/2, cy + h/2);
    ctx.lineTo(cx - w/2, cy + h/2);
    ctx.closePath();
    ctx.fillStyle = '#fce4ec';
    ctx.fill();
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function drawIconFcConnector(ctx, cx, cy, s) {
    // Circle (結合子)
    const r = s * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#f5f5f5';
    ctx.fill();
    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function drawIconFcLoop(ctx, cx, cy, s) {
    // Loop symbol: top pentagon, bottom bar
    const w = s * 0.7, h = s * 0.55;
    const notch = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + notch, cy - h/2);
    ctx.lineTo(cx + w/2 - notch, cy - h/2);
    ctx.lineTo(cx + w/2, cy - h/2 + notch);
    ctx.lineTo(cx + w/2, cy + h/2 - notch);
    ctx.lineTo(cx + w/2 - notch, cy + h/2);
    ctx.lineTo(cx - w/2 + notch, cy + h/2);
    ctx.lineTo(cx - w/2, cy + h/2 - notch);
    ctx.lineTo(cx - w/2, cy - h/2 + notch);
    ctx.closePath();
    ctx.fillStyle = '#ede7f6';
    ctx.fill();
    ctx.strokeStyle = '#4527a0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Loop arrow
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.15, -Math.PI * 0.8, Math.PI * 0.5);
    ctx.strokeStyle = '#4527a0';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Arrowhead
    const ax = cx + s * 0.15 * Math.cos(Math.PI * 0.5);
    const ay = cy + s * 0.15 * Math.sin(Math.PI * 0.5);
    ctx.beginPath();
    ctx.moveTo(ax - 3, ay - 3);
    ctx.lineTo(ax, ay);
    ctx.lineTo(ax + 3, ay - 3);
    ctx.stroke();
  }
  function drawIconFcDisplay(ctx, cx, cy, s) {
    // Display shape: left pointed, right curved
    const w = s * 0.8, h = s * 0.5;
    const pt = s * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + pt, cy - h/2);
    ctx.lineTo(cx + w/2 - pt, cy - h/2);
    ctx.bezierCurveTo(cx + w/2 + pt * 0.5, cy - h/2, cx + w/2 + pt * 0.5, cy + h/2, cx + w/2 - pt, cy + h/2);
    ctx.lineTo(cx - w/2 + pt, cy + h/2);
    ctx.lineTo(cx - w/2, cy);
    ctx.closePath();
    ctx.fillStyle = '#e8eaf6';
    ctx.fill();
    ctx.strokeStyle = '#283593';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }


  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ===== Color Helpers =====
  function hexToHSL(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
  }

  function lightenColor(hex, amount) {
    const hsl = hexToHSL(hex);
    return hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + amount));
  }

  function darkenColor(hex, amount) {
    const hsl = hexToHSL(hex);
    return hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - amount));
  }

  // ===== Undo / Redo =====
  function getSnapshot() {
    return JSON.parse(JSON.stringify({
      persons: state.persons,
      regions: state.regions,
      roles: state.roles,
      connectors: state.connectors,
      textAnnotations: state.textAnnotations,
      scheduleBars: state.scheduleBars,
      timelines: state.timelines,
      shapes: state.shapes,
      nextId: state.nextId,
    }));
  }

  // ===== Resource Allocation UI =====
  function renderAllocationsUI(person, containerId, summaryId) {
    const container = document.getElementById(containerId);
    const summaryEl = document.getElementById(summaryId);
    if (!container) return;
    container.innerHTML = '';
    const allocs = person.allocations || [];
    const regions = state.regions;

    allocs.forEach((alloc, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:3px;align-items:center;margin-bottom:4px;padding:4px;background:#f8f9fa;border-radius:4px;flex-wrap:wrap;';

      // Region selector
      const sel = document.createElement('select');
      sel.style.cssText = 'flex:1;min-width:60px;font-size:11px;padding:2px;border:1px solid #ccc;border-radius:3px;';
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '-- 選択 --';
      sel.appendChild(emptyOpt);
      regions.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name || '領域' + r.id;
        if (alloc.targetId === r.id) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        alloc.targetId = parseInt(sel.value) || null;
        alloc.targetName = regions.find(r => r.id === alloc.targetId)?.name || '';
        saveState(); render();
        renderAllocationsUI(person, containerId, summaryId);
      });

      // Percentage input
      const pctInput = document.createElement('input');
      pctInput.type = 'number';
      pctInput.min = 0;
      pctInput.max = 100;
      pctInput.step = 5;
      pctInput.value = Math.round((alloc.ratio || 0) * 100);
      pctInput.style.cssText = 'width:50px;font-size:11px;padding:2px;border:1px solid #ccc;border-radius:3px;text-align:right;';
      pctInput.addEventListener('change', () => {
        alloc.ratio = Math.min(1, Math.max(0, parseInt(pctInput.value) || 0) / 100);
        saveState(); render();
        renderAllocationsUI(person, containerId, summaryId);
      });
      const pctLabel = document.createElement('span');
      pctLabel.textContent = '%';
      pctLabel.style.cssText = 'font-size:11px;color:#666;';

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.style.cssText = 'background:none;border:none;color:#e74c3c;cursor:pointer;font-size:12px;padding:0 2px;';
      delBtn.addEventListener('click', () => {
        person.allocations.splice(idx, 1);
        saveState(); render();
        renderAllocationsUI(person, containerId, summaryId);
      });

      row.appendChild(sel);
      row.appendChild(pctInput);
      row.appendChild(pctLabel);
      row.appendChild(delBtn);

      // Progress bar + calculation row
      const infoRow = document.createElement('div');
      infoRow.style.cssText = 'width:100%;display:flex;align-items:center;gap:4px;margin-top:2px;';
      const bar = document.createElement('div');
      bar.style.cssText = 'flex:1;height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden;';
      const fill = document.createElement('div');
      const pct = (alloc.ratio || 0) * 100;
      fill.style.cssText = `height:100%;background:${pct > 100 ? '#e74c3c' : '#3498db'};width:${Math.min(pct, 100)}%;border-radius:3px;transition:width 0.2s;`;
      bar.appendChild(fill);
      const calcLabel = document.createElement('span');
      calcLabel.style.cssText = 'font-size:10px;color:#888;white-space:nowrap;';
      const amount = getAllocationAmount(person, alloc.ratio);
      const cost = getAllocationCost(person, alloc.ratio);
      calcLabel.textContent = `→ ${amount.toFixed(1)}${person.unit || ''} / ¥${cost.toLocaleString()}`;
      infoRow.appendChild(bar);
      infoRow.appendChild(calcLabel);

      // Note input
      const noteInput = document.createElement('input');
      noteInput.type = 'text';
      noteInput.placeholder = 'メモ';
      noteInput.value = alloc.note || '';
      noteInput.style.cssText = 'width:100%;font-size:10px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;margin-top:2px;color:#666;';
      noteInput.addEventListener('change', () => {
        alloc.note = noteInput.value;
        saveState();
      });

      row.appendChild(infoRow);
      row.appendChild(noteInput);
      container.appendChild(row);
    });

    // Summary
    if (summaryEl) {
      const total = getAllocationTotal(person);
      const unalloc = getUnallocated(person);
      const totalPct = Math.round(total * 100);
      const totalAmount = (person.capacity || 0) * total;
      const totalCost = (person.costPerUnit || 0) * total;
      const warn = total > 1.0 ? ' ⚠超過!' : '';
      summaryEl.innerHTML = `配分: <b>${totalPct}%</b> (${totalAmount.toFixed(1)}${person.unit || ''})${warn}<br>` +
        `未配分: ${Math.round(unalloc * 100)}% / コスト: ¥${totalCost.toLocaleString()}`;
      summaryEl.style.color = total > 1.0 ? '#e74c3c' : '#888';
    }
  }

  function setupAllocationHandlers() {
    // Person allocation add
    const btnAddAlloc = document.getElementById('btn-add-allocation');
    if (btnAddAlloc) {
      btnAddAlloc.addEventListener('click', () => {
        const p = state.persons.find(p => p.id === state.selectedId && p.itemType !== 'item');
        if (!p) return;
        if (!p.allocations) p.allocations = [];
        p.allocations.push({ targetId: null, ratio: 0, note: '' });
        saveState(); render();
        renderAllocationsUI(p, 'prop-allocations-container', 'prop-allocation-summary');
      });
    }
    // Item allocation add
    const btnAddItemAlloc = document.getElementById('btn-add-item-allocation');
    if (btnAddItemAlloc) {
      btnAddItemAlloc.addEventListener('click', () => {
        const p = state.persons.find(p => p.id === state.selectedId && p.itemType === 'item');
        if (!p) return;
        if (!p.allocations) p.allocations = [];
        p.allocations.push({ targetId: null, ratio: 0, note: '' });
        saveState(); render();
        renderAllocationsUI(p, 'prop-item-allocations-container', 'prop-item-allocation-summary');
      });
    }
    // Person capacity/unit/cost handlers
    ['prop-capacity', 'prop-unit', 'prop-cost'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        const p = state.persons.find(p => p.id === state.selectedId && p.itemType !== 'item');
        if (!p) return;
        if (id === 'prop-capacity') p.capacity = parseFloat(el.value) || 0;
        if (id === 'prop-unit') p.unit = el.value;
        if (id === 'prop-cost') p.costPerUnit = parseFloat(el.value) || 0;
        saveState(); render();
        renderAllocationsUI(p, 'prop-allocations-container', 'prop-allocation-summary');
      });
    });
    // Item capacity/unit/cost handlers
    ['prop-item-capacity', 'prop-item-unit', 'prop-item-cost'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        const p = state.persons.find(p => p.id === state.selectedId && p.itemType === 'item');
        if (!p) return;
        if (id === 'prop-item-capacity') p.capacity = parseFloat(el.value) || 0;
        if (id === 'prop-item-unit') p.unit = el.value;
        if (id === 'prop-item-cost') p.costPerUnit = parseFloat(el.value) || 0;
        saveState(); render();
        renderAllocationsUI(p, 'prop-item-allocations-container', 'prop-item-allocation-summary');
      });
    });
  }

  function migrateResource(p) {
    if (!p.roleIds) p.roleIds = [];
    if (p.capacity === undefined) p.capacity = (p.itemType === 'item') ? 1 : 1.0;
    if (!p.unit) p.unit = (p.itemType === 'item') ? '台' : '人月';
    if (p.costPerUnit === undefined) p.costPerUnit = 0;
    if (!p.allocations) p.allocations = [];
  }

  function getAllocationTotal(p) {
    return (p.allocations || []).reduce((sum, a) => sum + (a.ratio || 0), 0);
  }

  function getUnallocated(p) {
    return Math.max(0, 1.0 - getAllocationTotal(p));
  }

  function getAllocationAmount(p, ratio) {
    return (p.capacity || 0) * (ratio || 0);
  }

  function getAllocationCost(p, ratio) {
    return (p.costPerUnit || 0) * (ratio || 0);
  }

  function getRegionResourceSummary(regionId) {
    const summary = { humanUnits: 0, humanUnit: '人月', itemUnits: 0, itemUnit: '台', totalCost: 0, resources: [] };
    state.persons.forEach(p => {
      (p.allocations || []).forEach(a => {
        if (a.targetId === regionId) {
          const amount = getAllocationAmount(p, a.ratio);
          const cost = getAllocationCost(p, a.ratio);
          if (p.itemType === 'item') {
            summary.itemUnits += amount;
            summary.itemUnit = p.unit || '台';
          } else {
            summary.humanUnits += amount;
            summary.humanUnit = p.unit || '人月';
          }
          summary.totalCost += cost;
          summary.resources.push({ id: p.id, name: p.name, type: p.itemType, ratio: a.ratio, amount, cost });
        }
      });
    });
    return summary;
  }

  function restoreSnapshot(snap) {
    state.persons = snap.persons;
    state.regions = snap.regions;
    state.roles = snap.roles;
    state.connectors = snap.connectors || [];
    state.textAnnotations = snap.textAnnotations || [];
    state.scheduleBars = snap.scheduleBars || [];
    state.timelines = snap.timelines || [];
    state.shapes = snap.shapes || [];
    state.nextId = snap.nextId;
    state.persons.forEach(migrateResource);
    clearSelection();
    state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
    renderPersonList();
    saveState();
    render();
  }

  function pushUndo() {
    state.undoStack.push(getSnapshot());
    if (state.undoStack.length > state.undoMax) state.undoStack.shift();
    state.redoStack = [];
  }

  function undo() {
    if (state.undoStack.length === 0) return;
    state.redoStack.push(getSnapshot());
    restoreSnapshot(state.undoStack.pop());
  }

  function redo() {
    if (state.redoStack.length === 0) return;
    state.undoStack.push(getSnapshot());
    restoreSnapshot(state.redoStack.pop());
  }

  // ===== Person Management =====
  const defaultColors = ['#4a8acf', '#e06c75', '#98c379', '#e5c07b', '#c678dd', '#56b6c2', '#be5046'];

  function addPerson(name, opts) {
    const isItem = opts && opts.itemType === 'item';
    const p = {
      id: state.nextId++,
      name: name || (isItem ? '新しい機器' : '新しいリソース'),
      itemType: (opts && opts.itemType) || 'person',
      icon: (opts && opts.icon) || 'person',
      description: (opts && opts.description) || '',
      role: (opts && opts.role) || '',
      affiliation: (opts && opts.affiliation) || '',
      color: (opts && opts.color) || defaultColors[state.persons.length % defaultColors.length],
      x: (opts && opts.x !== undefined) ? opts.x : (Math.random() - 0.5) * 200,
      y: (opts && opts.y !== undefined) ? opts.y : (Math.random() - 0.5) * 200,
      roleIds: (opts && opts.roleIds) || [],
      email: (opts && opts.email) || '',
      phone: (opts && opts.phone) || '',
      joinDate: (opts && opts.joinDate) || '',
      effectiveDate: (opts && opts.effectiveDate) || '',
      photoUrl: (opts && opts.photoUrl) || '',
      layerId: (opts && opts.layerId) || state.activeLayerId,
      // Resource management fields
      capacity: (opts && opts.capacity !== undefined) ? opts.capacity : (isItem ? 1 : 1.0),
      unit: (opts && opts.unit) || (isItem ? '台' : '人月'),
      costPerUnit: (opts && opts.costPerUnit !== undefined) ? opts.costPerUnit : 0,
      allocations: (opts && opts.allocations) || [],
    };
    state.persons.push(p);
    return p;
  }

  function deletePerson(id) {
    state.persons = state.persons.filter(p => p.id !== id);
    if (state.selectedId === id && state.selectedType === 'person') {
      clearSelection();
    }
    renderPersonList();
    saveState();
    render();
  }

  function deleteRegion(id) {
    state.regions = state.regions.filter(r => r.id !== id);
    if (state.selectedId === id && state.selectedType === 'region') {
      clearSelection();
    }
    saveState();
    render();
  }

  // ===== Selection =====
  function selectItem(type, id) {
    state.selectedType = type;
    state.selectedId = id;
    state.addingWaypoints = false;
    updatePropsPanel();
    renderPersonList();
    render();
  }

  function clearSelection() {
    state.selectedType = null;
    state.selectedId = null;
    state.addingWaypoints = false;
    updatePropsPanel();
    renderPersonList();
    render();
  }

  function updatePropsPanel() {
    function getSelectedObject() {
      if (state.selectedType === 'person') return state.persons.find(p => p.id === state.selectedId);
      if (state.selectedType === 'region') return state.regions.find(r => r.id === state.selectedId);
      if (state.selectedType === 'connector') return state.connectors.find(c => c.id === state.selectedId);
      if (state.selectedType === 'text') return state.textAnnotations.find(t => t.id === state.selectedId);
      if (state.selectedType === 'scheduleBar') return state.scheduleBars.find(b => b.id === state.selectedId);
      if (state.selectedType === 'timeline') return state.timelines.find(t => t.id === state.selectedId);
      return null;
    }
    noSelectionMsg.style.display = 'none';
    personProps.style.display = 'none';
    regionProps.style.display = 'none';
    const itemPropsEl = document.getElementById('item-props');
    if (itemPropsEl) itemPropsEl.style.display = 'none';
    if (connectorProps) connectorProps.style.display = 'none';
    if (textProps) textProps.style.display = 'none';
    const schedBarPropsEl = document.getElementById('scheduleBar-props');
    if (schedBarPropsEl) schedBarPropsEl.style.display = 'none';
    const timelinePropsEl = document.getElementById('timeline-props');
    if (timelinePropsEl) timelinePropsEl.style.display = 'none';
    const shapePropsEl = document.getElementById('shape-props');
    if (shapePropsEl) shapePropsEl.style.display = 'none';

    if (state.selectedType === 'person') {
      const p = state.persons.find(p => p.id === state.selectedId);
      if (!p) return;
      if (p.itemType === 'item') {
        // Show item properties
        const itemPropsEl = document.getElementById('item-props');
        if (itemPropsEl) {
          itemPropsEl.style.display = 'block';
          const propItemName = document.getElementById('prop-item-name');
          const propItemIcon = document.getElementById('prop-item-icon');
          const propItemDesc = document.getElementById('prop-item-description');
          const propItemColor = document.getElementById('prop-item-color');
          if (propItemName) propItemName.value = p.name || '';
          if (propItemIcon) propItemIcon.value = p.icon || 'server';
          if (propItemDesc) propItemDesc.value = p.description || '';
          if (propItemColor) propItemColor.value = p.color || '#4a8acf';
          // Resource allocation fields for items
          const capEl = document.getElementById('prop-item-capacity');
          const unitEl = document.getElementById('prop-item-unit');
          const costEl = document.getElementById('prop-item-cost');
          if (capEl) capEl.value = p.capacity !== undefined ? p.capacity : 1;
          if (unitEl) unitEl.value = p.unit || '台';
          if (costEl) costEl.value = p.costPerUnit || 0;
          renderAllocationsUI(p, 'prop-item-allocations-container', 'prop-item-allocation-summary');
        }
      } else {
        personProps.style.display = 'block';
        // Auto-show floating property panel
        const sr = document.getElementById('sidebar-right');
        if (sr && sr.style.display === 'none') sr.style.display = 'flex';
        propName.value = p.name;
        propRole.value = p.role;
        propAffiliation.value = p.affiliation;
        propColor.value = p.color;
        if (propEmail) propEmail.value = p.email || '';
        if (propPhone) propPhone.value = p.phone || '';
        if (propJoindate) propJoindate.value = p.joinDate || '';
        if (propEffectiveDate) propEffectiveDate.value = p.effectiveDate || '';
        if (propPhotoUrl) propPhotoUrl.value = p.photoUrl || '';
        renderRoleCheckboxes(p);
        // Resource allocation fields
        const capEl = document.getElementById('prop-capacity');
        const unitEl = document.getElementById('prop-unit');
        const costEl = document.getElementById('prop-cost');
        if (capEl) capEl.value = p.capacity !== undefined ? p.capacity : 1.0;
        if (unitEl) unitEl.value = p.unit || '人月';
        if (costEl) costEl.value = p.costPerUnit || 0;
        renderAllocationsUI(p, 'prop-allocations-container', 'prop-allocation-summary');
      }
    } else if (state.selectedType === 'region') {
      const r = state.regions.find(r => r.id === state.selectedId);
      if (!r) return;
      regionProps.style.display = 'block';
      propRegionName.value = r.name || '';
      if (propRegionColor) propRegionColor.value = r.color || '#4a8acf';
      if (propRegionFontsize) propRegionFontsize.value = r.fontSize || 13;
      if (propRegionTextalign) propRegionTextalign.value = r.textAlign || 'left';
    } else if (state.selectedType === 'connector') {
      const c = state.connectors.find(c => c.id === state.selectedId);
      if (!c || !connectorProps) return;
      connectorProps.style.display = 'block';
      if (propConnectorLabel) propConnectorLabel.value = c.label || '';
      if (propConnectorDirection) propConnectorDirection.value = c.direction || 'none';
      if (propConnectorLinetype) propConnectorLinetype.value = c.lineType || 'elbow';
    } else if (state.selectedType === 'text') {
      const t = state.textAnnotations.find(t => t.id === state.selectedId);
      if (!t || !textProps) return;
      textProps.style.display = 'block';
      if (propTextContent) propTextContent.value = t.text || '';
      if (propTextFontsize) propTextFontsize.value = t.fontSize || 9;
      if (propTextColor) propTextColor.value = t.color || '#2c3e50';
    } else if (state.selectedType === 'scheduleBar') {
      const bar = state.scheduleBars.find(b => b.id === state.selectedId);
      if (!bar) return;
      const el = document.getElementById('scheduleBar-props');
      if (el) {
        el.style.display = 'block';
        // Auto-show floating property panel
        const sr = document.getElementById('sidebar-right');
        if (sr && sr.style.display === 'none') sr.style.display = 'flex';
        const propBarLabel = document.getElementById('prop-bar-label');
        const propBarColor = document.getElementById('prop-bar-color');
        const propBarTip = document.getElementById('prop-bar-tipshape');
        const propBarW = document.getElementById('prop-bar-width');
        const propBarH = document.getElementById('prop-bar-height');
        if (propBarLabel) propBarLabel.value = bar.label || '';
        if (propBarColor) propBarColor.value = bar.color || '#4a8acf';
        if (propBarTip) propBarTip.value = bar.tipShape || 'chevron';
        if (propBarW) propBarW.value = Math.round(bar.w);
        if (propBarH) propBarH.value = Math.round(bar.h);
      }
    } else if (state.selectedType === 'timeline') {
      const tl = state.timelines.find(t => t.id === state.selectedId);
      if (!tl) return;
      const el = document.getElementById('timeline-props');
      if (el) {
        el.style.display = 'block';
        const sr = document.getElementById('sidebar-right');
        if (sr && sr.style.display === 'none') sr.style.display = 'flex';
        const f = (id) => document.getElementById(id);
        if (f('prop-tl-startYear')) f('prop-tl-startYear').value = tl.startYear || 2026;
        if (f('prop-tl-startMonth')) f('prop-tl-startMonth').value = tl.startMonth || 4;
        if (f('prop-tl-monthCount')) f('prop-tl-monthCount').value = tl.monthCount || 12;
        if (f('prop-tl-monthWidth')) f('prop-tl-monthWidth').value = tl.monthWidth || 80;
        if (f('prop-tl-rowCount')) f('prop-tl-rowCount').value = tl.rowCount || 5;
        if (f('prop-tl-rowHeight')) f('prop-tl-rowHeight').value = tl.rowHeight || 30;
        if (f('prop-tl-fontSize')) f('prop-tl-fontSize').value = tl.fontSize || 11;
      }
    } else if (state.selectedType === 'shape') {
      const shape = state.shapes.find(s => s.id === state.selectedId);
      if (shape && shapePropsEl) {
        shapePropsEl.style.display = 'block';
        const f = id => document.getElementById(id);
        // Populate shape type dropdown
        const typeSelect = f('prop-shape-type');
        if (typeSelect && typeSelect.options.length === 0) {
          SHAPE_TYPES.forEach(st => {
            const opt = document.createElement('option');
            opt.value = st.type;
            opt.textContent = st.icon + ' ' + st.label;
            typeSelect.appendChild(opt);
          });
        }
        if (typeSelect) typeSelect.value = shape.type;
        if (f('prop-shape-color')) f('prop-shape-color').value = shape.color || '#4a90d9';
        if (f('prop-shape-borderColor')) f('prop-shape-borderColor').value = shape.borderColor || '#2c3e50';
        if (f('prop-shape-borderWidth')) f('prop-shape-borderWidth').value = shape.borderWidth ?? 1;
        if (f('prop-shape-label')) f('prop-shape-label').value = shape.label || '';
        if (f('prop-shape-fontSize')) f('prop-shape-fontSize').value = shape.fontSize || 12;
        if (f('prop-shape-fontColor')) f('prop-shape-fontColor').value = shape.fontColor || '#ffffff';
        if (f('prop-shape-rotation')) f('prop-shape-rotation').value = Math.round((shape.rotation || 0) * 180 / Math.PI);
        if (f('prop-shape-opacity')) f('prop-shape-opacity').value = shape.opacity != null ? shape.opacity : 1;
        if (f('prop-shape-w')) f('prop-shape-w').value = Math.round(shape.w);
        if (f('prop-shape-h')) f('prop-shape-h').value = Math.round(shape.h);
      }
    } else if (state.multiSelection.personIds.length > 0) {
      // Multi-selection: show color picker for batch color change
      personProps.style.display = 'block';
      const firstP = state.persons.find(p => p.id === state.multiSelection.personIds[0]);
      propName.value = '(複数選択)';
      propRole.value = '';
      propAffiliation.value = '';
      propColor.value = firstP ? firstP.color : '#4a90d9';
    } else {
      noSelectionMsg.style.display = 'block';
    }

    // Layer assign selector
    const layerAssignProps = document.getElementById('layer-assign-props');
    const propLayerAssign = document.getElementById('prop-layer-assign');
    if (layerAssignProps && propLayerAssign) {
      const selectedObj = getSelectedObject();
      if (selectedObj && state.layers.length > 0) {
        layerAssignProps.style.display = 'block';
        propLayerAssign.innerHTML = '';
        state.layers.forEach(l => {
          const opt = document.createElement('option');
          opt.value = l.id;
          opt.textContent = l.name;
          if (l.id === (selectedObj.layerId || state.layers[0].id)) opt.selected = true;
          propLayerAssign.appendChild(opt);
        });
      } else {
        layerAssignProps.style.display = 'none';
      }
    }
  }

  function renderRoleCheckboxes(person) {
    propRolesContainer.innerHTML = '';
    if (state.roles.length === 0) {
      propRolesContainer.innerHTML = '<div style="color:#999;font-size:11px;">役割なし（役割管理で追加）</div>';
      return;
    }
    state.roles.forEach(role => {
      const label = document.createElement('label');
      label.className = 'role-checkbox-item';
      const checked = (person.roleIds || []).includes(role.id);
      label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} data-role-id="${role.id}">
        <span class="role-badge-mini" style="background:${role.color}20;border-color:${role.color};color:${darkenColor(role.color, 10)}">${role.icon ? role.icon + ' ' : ''}${role.name}</span>`;
      label.querySelector('input').addEventListener('change', (e) => {
        if (!person.roleIds) person.roleIds = [];
        if (e.target.checked) {
          if (!person.roleIds.includes(role.id)) person.roleIds.push(role.id);
        } else {
          person.roleIds = person.roleIds.filter(rid => rid !== role.id);
        }
        renderPersonList();
        saveState();
        render();
      });
      propRolesContainer.appendChild(label);
    });
  }

  // ===== Person List Sidebar (Tree Structure) =====
  function renderPersonList() {
    personListEl.innerHTML = '';

    // 1. Build region hierarchy: find parent for each region
    //    Parent = smallest region that fully contains this region
    const regionParent = {};  // regionId -> parentRegionId or null
    state.regions.forEach(r => {
      let bestParent = null;
      let bestArea = Infinity;
      state.regions.forEach(candidate => {
        if (candidate.id === r.id) return;
        if (candidate.x <= r.x && candidate.y <= r.y &&
          candidate.x + candidate.w >= r.x + r.w &&
          candidate.y + candidate.h >= r.y + r.h) {
          const area = candidate.w * candidate.h;
          if (area < bestArea) {
            bestArea = area;
            bestParent = candidate.id;
          }
        }
      });
      regionParent[r.id] = bestParent;
    });

    // 2. Find each person's home region (smallest containing region)
    const personRegion = {};  // personId -> regionId or null
    state.persons.forEach(p => {
      let bestRegion = null;
      let bestArea = Infinity;
      state.regions.forEach(r => {
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          const area = r.w * r.h;
          if (area < bestArea) {
            bestArea = area;
            bestRegion = r.id;
          }
        }
      });
      personRegion[p.id] = bestRegion;
    });

    // 3. Get children of a given parent region (null = root)
    function getChildRegions(parentId) {
      return state.regions.filter(r => regionParent[r.id] === parentId);
    }
    function getPersonsInRegion(regionId) {
      return state.persons.filter(p => personRegion[p.id] === regionId);
    }

    // 4. Render tree recursively
    function renderBranch(parentRegionId, container) {
      const childRegions = getChildRegions(parentRegionId);
      const persons = getPersonsInRegion(parentRegionId);

      // Sort regions by name
      childRegions.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      childRegions.forEach(region => {
        // Region header
        const header = document.createElement('div');
        header.className = 'region-tree-header';
        header.innerHTML = `<span class="tree-icon">▼</span><span>📁 ${region.name || '(無名領域)'}</span>`;
        container.appendChild(header);

        // Children container
        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'tree-children';
        container.appendChild(childrenDiv);

        // Toggle collapse/expand
        header.addEventListener('click', () => {
          const isHidden = childrenDiv.style.display === 'none';
          childrenDiv.style.display = isHidden ? '' : 'none';
          header.querySelector('.tree-icon').textContent = isHidden ? '▼' : '▶';
        });

        // Recurse into this region
        renderBranch(region.id, childrenDiv);
      });

      // Persons in this region
      persons.forEach(p => {
        const div = document.createElement('div');
        const isMatch = state.searchQuery && p.name.toLowerCase().includes(state.searchQuery);
        div.className = 'person-item' + (state.selectedType === 'person' && state.selectedId === p.id ? ' selected' : '') + (isMatch ? ' search-highlight' : '');
        if (state.searchQuery && !isMatch) div.style.display = 'none';
        const roleNames = (p.roleIds || []).map(rid => { const r = state.roles.find(r => r.id === rid); return r ? r.name : ''; }).filter(Boolean);
        const roleStr = roleNames.length > 0 ? ' (' + roleNames.join(', ') + ')' : '';
        const isItem = p.itemType === 'item';
        const iconEntry = isItem ? getIconEntry(p.icon) : null;
        const iconEmoji = isItem ? (iconEntry ? iconEntry.emoji : '📦') : '';
        div.innerHTML = isItem
          ? `<span style="margin-right:4px">${iconEmoji}</span><span>${p.name}</span>`
          : `<span class="color-dot" style="background:${p.color}"></span><span>${p.name}${roleStr}</span>`;
        div.addEventListener('click', () => selectItem('person', p.id));
        container.appendChild(div);
      });
    }

    // Render root-level regions only (persons at root handled separately)
    const rootRegions = getChildRegions(null);
    rootRegions.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    rootRegions.forEach(region => {
      const header = document.createElement('div');
      header.className = 'region-tree-header';
      header.innerHTML = `<span class="tree-icon">▼</span><span>📁 ${region.name || '(無名領域)'}</span>`;
      personListEl.appendChild(header);
      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'tree-children';
      personListEl.appendChild(childrenDiv);
      header.addEventListener('click', () => {
        const isHidden = childrenDiv.style.display === 'none';
        childrenDiv.style.display = isHidden ? '' : 'none';
        header.querySelector('.tree-icon').textContent = isHidden ? '▼' : '▶';
      });
      renderBranch(region.id, childrenDiv);
    });

    // Unaffiliated persons (not in any region)
    const unaffiliated = state.persons.filter(p => personRegion[p.id] === null);
    if (unaffiliated.length > 0 && state.regions.length > 0) {
      const uaHeader = document.createElement('div');
      uaHeader.className = 'tree-unaffiliated-header';
      uaHeader.textContent = '（所属なし）';
      personListEl.appendChild(uaHeader);
    }
    unaffiliated.forEach(p => {
      const div = document.createElement('div');
      const isMatch = state.searchQuery && p.name.toLowerCase().includes(state.searchQuery);
      div.className = 'person-item' + (state.selectedType === 'person' && state.selectedId === p.id ? ' selected' : '') + (isMatch ? ' search-highlight' : '');
      if (state.searchQuery && !isMatch) div.style.display = 'none';
      const roleNames = (p.roleIds || []).map(rid => { const r = state.roles.find(r => r.id === rid); return r ? r.name : ''; }).filter(Boolean);
      const roleStr = roleNames.length > 0 ? ' (' + roleNames.join(', ') + ')' : '';
      const isItem = p.itemType === 'item';
      const iconEntry = isItem ? getIconEntry(p.icon) : null;
      const iconEmoji = isItem ? (iconEntry ? iconEntry.emoji : '📦') : '';
      div.innerHTML = isItem
        ? `<span style="margin-right:4px">${iconEmoji}</span><span>${p.name}</span>`
        : `<span class="color-dot" style="background:${p.color}"></span><span>${p.name}${roleStr}</span>`;
      div.addEventListener('click', () => selectItem('person', p.id));
      personListEl.appendChild(div);
    });
  }

  // ===== Hit Testing =====
  function hitTestPerson(sx, sy) {
    for (let i = state.persons.length - 1; i >= 0; i--) {
      const p = state.persons[i];
      const s = worldToScreen(p.x, p.y);
      const dx = sx - s.x;
      const dy = sy - s.y;
      if (Math.abs(dx) < 18 && dy > -30 && dy < 20) {
        return p;
      }
    }
    return null;
  }

  function hitTestRegion(sx, sy) {
    const w = screenToWorld(sx, sy);
    for (let i = state.regions.length - 1; i >= 0; i--) {
      const r = state.regions[i];
      if (w.x >= r.x && w.x <= r.x + r.w && w.y >= r.y && w.y <= r.y + r.h) {
        return r;
      }
    }
    return null;
  }

  function hitTestTextAnnotation(sx, sy) {
    for (let i = state.textAnnotations.length - 1; i >= 0; i--) {
      const t = state.textAnnotations[i];
      const s = worldToScreen(t.x, t.y);
      const fontSize = (t.fontSize || 9) * state.zoom;
      const lines = (t.text || '').split('\n');
      ctx.font = `${fontSize}px "Segoe UI", "Meiryo", sans-serif`;
      const maxW = Math.max(...lines.map(l => ctx.measureText(l).width), 20);
      const totalH = lines.length * fontSize * 1.3;
      if (sx >= s.x - 2 && sx <= s.x + maxW + 4 && sy >= s.y - 2 && sy <= s.y + totalH + 4) {
        return t;
      }
    }
    return null;
  }

  // ===== Resize Handle Hit Test =====
  function hitTestResizeHandle(sx, sy) {
    if (state.selectedType !== 'region') return null;
    const r = state.regions.find(r => r.id === state.selectedId);
    if (!r) return null;

    if (state.viewMode === 'square') {
      const s = worldToScreen(r.x, r.y);
      const e = worldToScreen(r.x + r.w, r.y + r.h);
      const handles = getResizeHandlePositions(s.x, s.y, e.x - s.x, e.y - s.y);
      for (const h of handles) {
        if (Math.abs(sx - h.x) <= HANDLE_SIZE + 2 && Math.abs(sy - h.y) <= HANDLE_SIZE + 2) {
          return { region: r, dir: h.dir };
        }
      }
    } else {
      // Quarter view: corners and midpoints
      const corners = [
        { p: worldToScreen(r.x, r.y), dir: 'nw' },
        { p: worldToScreen(r.x + r.w, r.y), dir: 'ne' },
        { p: worldToScreen(r.x + r.w, r.y + r.h), dir: 'se' },
        { p: worldToScreen(r.x, r.y + r.h), dir: 'sw' },
      ];
      const mids = [
        { p: midPoint(corners[0].p, corners[1].p), dir: 'n' },
        { p: midPoint(corners[1].p, corners[2].p), dir: 'e' },
        { p: midPoint(corners[2].p, corners[3].p), dir: 's' },
        { p: midPoint(corners[3].p, corners[0].p), dir: 'w' },
      ];
      const all = [...corners, ...mids];
      for (const h of all) {
        if (Math.abs(sx - h.p.x) <= 6 && Math.abs(sy - h.p.y) <= 6) {
          return { region: r, dir: h.dir };
        }
      }
    }
    return null;
  }

  function midPoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  const resizeCursors = {
    nw: 'nwse-resize', se: 'nwse-resize',
    ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize',
    e: 'ew-resize', w: 'ew-resize',
  };

  // ===== Canvas Mouse Events =====
  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasPos(e);

    // Right-click
    if (e.button === 2) {
      // Check if right-clicking on a waypoint handle -> show delete menu
      if (state.tool === 'select') {
        const wpHit = hitTestWaypointHandle(pos.x, pos.y);
        if (wpHit) {
          showWaypointContextMenu(e.clientX, e.clientY, wpHit.connector, wpHit.wpIndex);
          return;
        }
      }
      // Check if right-clicking on a connector in select mode -> show context menu
      if (state.tool === 'select') {
        const connector = hitTestConnector(pos.x, pos.y);
        if (connector) {
          selectItem('connector', connector.id);
          state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
          showConnectorContextMenu(e.clientX, e.clientY, connector);
          return;
        }
      }
      // Otherwise pan
      state.dragging = {
        type: 'pan',
        startX: pos.x,
        startY: pos.y,
        origOffsetX: state.canvasOffset.x,
        origOffsetY: state.canvasOffset.y,
      };
      container.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) return;

    if (state.tool === 'select') {
      // Check resize handles first
      const handle = hitTestResizeHandle(pos.x, pos.y);
      if (handle) {
        pushUndo();
        state.dragging = {
          type: 'resize',
          id: handle.region.id,
          dir: handle.dir,
          origX: handle.region.x,
          origY: handle.region.y,
          origW: handle.region.w,
          origH: handle.region.h,
          startPos: screenToWorld(pos.x, pos.y),
        };
        container.style.cursor = resizeCursors[handle.dir] || 'default';
        return;
      }

      // Check if clicking on any multi-selected item (person or region)
      const hasMultiSelection = state.multiSelection.personIds.length > 0 || state.multiSelection.regionIds.length > 0 || (state.multiSelection.textIds || []).length > 0 || (state.multiSelection.connectorIds || []).length > 0 || (state.multiSelection.scheduleBarIds || []).length > 0;

      const person = hitTestPerson(pos.x, pos.y);
      if (person) {
        // Ctrl+Click: toggle in multi-selection
        if (e.ctrlKey) {
          const idx = state.multiSelection.personIds.indexOf(person.id);
          if (idx >= 0) {
            state.multiSelection.personIds.splice(idx, 1);
          } else {
            state.multiSelection.personIds.push(person.id);
          }
          updatePropsPanel();
          renderPersonList();
          render();
          return;
        }
        // Multi-selection group drag (person is in multi-selection)
        if (state.multiSelection.personIds.includes(person.id)) {
          pushUndo();
          const startWorld = screenToWorld(pos.x, pos.y);
          state.dragging = { type: 'multi', lastWorld: startWorld };
          container.style.cursor = 'grabbing';
          return;
        }
        // Person is not in multi-selection, but is inside a multi-selected region
        if (hasMultiSelection) {
          const inSelectedRegion = state.multiSelection.regionIds.some(rid => {
            const r = state.regions.find(r => r.id === rid);
            return r && person.x >= r.x && person.x <= r.x + r.w && person.y >= r.y && person.y <= r.y + r.h;
          });
          if (inSelectedRegion) {
            pushUndo();
            const startWorld = screenToWorld(pos.x, pos.y);
            state.dragging = { type: 'multi', lastWorld: startWorld };
            container.style.cursor = 'grabbing';
            return;
          }
        }
        selectItem('person', person.id);
        state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
        pushUndo();
        state.dragging = {
          type: 'person',
          id: person.id,
          offsetX: pos.x - worldToScreen(person.x, person.y).x,
          offsetY: pos.y - worldToScreen(person.x, person.y).y,
        };
        container.style.cursor = 'grabbing';
        return;
      }

      const region = hitTestRegion(pos.x, pos.y);
      if (region) {
        // Ctrl+Click: toggle in multi-selection
        if (e.ctrlKey) {
          const idx = state.multiSelection.regionIds.indexOf(region.id);
          if (idx >= 0) {
            state.multiSelection.regionIds.splice(idx, 1);
          } else {
            state.multiSelection.regionIds.push(region.id);
          }
          updatePropsPanel();
          renderPersonList();
          render();
          return;
        }
        // Multi-selection group drag
        if (state.multiSelection.regionIds.includes(region.id)) {
          pushUndo();
          const startWorld = screenToWorld(pos.x, pos.y);
          state.dragging = { type: 'multi', lastWorld: startWorld };
          container.style.cursor = 'grabbing';
          return;
        }
        selectItem('region', region.id);
        state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
        const s = worldToScreen(region.x, region.y);
        const childPersonIds = state.persons.filter(p =>
          p.x >= region.x && p.x <= region.x + region.w &&
          p.y >= region.y && p.y <= region.y + region.h
        ).map(p => p.id);
        const childRegionIds = state.regions.filter(r =>
          r.id !== region.id &&
          r.x >= region.x && r.y >= region.y &&
          r.x + r.w <= region.x + region.w && r.y + r.h <= region.y + region.h
        ).map(r => r.id);
        pushUndo();
        state.dragging = {
          type: 'region',
          id: region.id,
          offsetX: pos.x - s.x,
          offsetY: pos.y - s.y,
          origX: region.x,
          origY: region.y,
          childPersonIds: childPersonIds,
          childRegionIds: childRegionIds,
          lastWorld: screenToWorld(s.x, s.y),
        };
        container.style.cursor = 'grabbing';
        return;
      }

      // Check for waypoint handle drag on selected connector
      const wpHit = hitTestWaypointHandle(pos.x, pos.y);
      if (wpHit) {
        pushUndo();
        state.dragging = {
          type: 'waypoint',
          connector: wpHit.connector,
          wpIndex: wpHit.wpIndex,
        };
        container.style.cursor = 'move';
        return;
      }

      // Check for midpoint "+" handle click to add waypoint
      const mpHit = hitTestMidpointHandle(pos.x, pos.y);
      if (mpHit) {
        pushUndo();
        if (!mpHit.connector.waypoints) mpHit.connector.waypoints = [];
        // Determine which user-waypoint index to insert at
        // segIndex is position in the rendered polyline; we need to map to waypoints array
        // For simplicity: count how many waypoints contribute to segments before segIndex
        // Each waypoint contributes 2 segments (horiz + vert), plus auto-route adds segments
        // Simplest: just insert at end if no waypoints, or calculate based on position
        const wps = mpHit.connector.waypoints;
        // Find insertion position by comparing world x/y order
        let insertIdx = wps.length; // default: append
        const fromRegion = state.regions.find(r => r.id === mpHit.connector.fromRegionId);
        if (fromRegion) {
          const fromPt = getConnectionPointWorld(fromRegion, mpHit.connector.fromSide);
          const clickDist = Math.hypot(mpHit.worldPos.x - fromPt.x, mpHit.worldPos.y - fromPt.y);
          for (let i = 0; i < wps.length; i++) {
            const wpDist = Math.hypot(wps[i].x - fromPt.x, wps[i].y - fromPt.y);
            if (clickDist < wpDist) {
              insertIdx = i;
              break;
            }
          }
        }
        wps.splice(insertIdx, 0, { x: mpHit.worldPos.x, y: mpHit.worldPos.y });
        state.dragging = {
          type: 'waypoint',
          connector: mpHit.connector,
          wpIndex: insertIdx,
        };
        container.style.cursor = 'move';
        saveState();
        render();
        return;
      }

      // Check for text annotation click in select mode
      const textAnn = hitTestTextAnnotation(pos.x, pos.y);
      if (textAnn) {
        // Ctrl+Click: toggle in multi-selection
        if (e.ctrlKey) {
          const idx = (state.multiSelection.textIds || []).indexOf(textAnn.id);
          if (idx >= 0) {
            state.multiSelection.textIds.splice(idx, 1);
          } else {
            state.multiSelection.textIds.push(textAnn.id);
          }
          updatePropsPanel();
          render();
          return;
        }
        // Multi-selection group drag
        if ((state.multiSelection.textIds || []).includes(textAnn.id)) {
          pushUndo();
          const startWorld = screenToWorld(pos.x, pos.y);
          state.dragging = { type: 'multi', lastWorld: startWorld };
          container.style.cursor = 'grabbing';
          return;
        }
        selectItem('text', textAnn.id);
        state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
        pushUndo();
        state.dragging = {
          type: 'text',
          id: textAnn.id,
          lastWorld: screenToWorld(pos.x, pos.y),
        };
        container.style.cursor = 'grabbing';
        return;
      }

      // Check for connector click in select mode
      const connector = hitTestConnector(pos.x, pos.y);
      if (connector) {
        // Ctrl+Click: toggle freeForm connector in multi-selection
        if (e.ctrlKey && connector.freeForm) {
          const idx = (state.multiSelection.connectorIds || []).indexOf(connector.id);
          if (idx >= 0) {
            state.multiSelection.connectorIds.splice(idx, 1);
          } else {
            state.multiSelection.connectorIds.push(connector.id);
          }
          updatePropsPanel();
          render();
          return;
        }
        // Multi-selection group drag (connector in multi-selection)
        if (connector.freeForm && (state.multiSelection.connectorIds || []).includes(connector.id)) {
          pushUndo();
          const startWorld = screenToWorld(pos.x, pos.y);
          state.dragging = { type: 'multi', lastWorld: startWorld };
          container.style.cursor = 'grabbing';
          return;
        }
        selectItem('connector', connector.id);
        state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
        if (connector.freeForm) {
          const endpoint = hitTestFreeFormEndpoint(pos.x, pos.y, connector);
          pushUndo();
          if (endpoint) {
            state.dragging = {
              type: 'freeform-endpoint',
              connector: connector,
              endpoint: endpoint,
            };
            container.style.cursor = 'crosshair';
          } else {
            state.dragging = {
              type: 'freeform-move',
              connector: connector,
              lastWorld: screenToWorld(pos.x, pos.y),
            };
            container.style.cursor = 'grabbing';
          }
        }
        render();
        return;
      }

      // Check for scheduleBar resize
      const sbResize = hitTestScheduleBarResize(pos.x, pos.y);
      if (sbResize) {
        const bar = state.scheduleBars.find(b => b.id === state.selectedId);
        if (bar) {
          pushUndo();
          state.dragging = {
            type: 'scheduleBar-resize',
            id: bar.id,
            dir: sbResize,
            origX: bar.x,
            origY: bar.y,
            origW: bar.w,
            origH: bar.h,
            startPos: screenToWorld(pos.x, pos.y),
          };
          container.style.cursor = 'ew-resize';
          return;
        }
      }

      // Check for scheduleBar click
      const schedBar = hitTestScheduleBar(pos.x, pos.y);
      if (schedBar) {
        if (e.ctrlKey) {
          const idx = (state.multiSelection.scheduleBarIds || []).indexOf(schedBar.id);
          if (idx >= 0) {
            state.multiSelection.scheduleBarIds.splice(idx, 1);
          } else {
            state.multiSelection.scheduleBarIds.push(schedBar.id);
          }
          updatePropsPanel();
          render();
          return;
        }
        if ((state.multiSelection.scheduleBarIds || []).includes(schedBar.id)) {
          pushUndo();
          const startWorld = screenToWorld(pos.x, pos.y);
          state.dragging = { type: 'multi', lastWorld: startWorld };
          container.style.cursor = 'grabbing';
          return;
        }
        selectItem('scheduleBar', schedBar.id);
        state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
        pushUndo();
        state.dragging = {
          type: 'scheduleBar',
          id: schedBar.id,
          lastWorld: screenToWorld(pos.x, pos.y),
        };
        container.style.cursor = 'grabbing';
        return;
      }

      // Check for shape rotation handle
      const shapeRot = hitTestShapeRotation(pos.x, pos.y);
      if (shapeRot) {
        pushUndo();
        const cx = shapeRot.x + shapeRot.w / 2;
        const cy = shapeRot.y + shapeRot.h / 2;
        state.dragging = {
          type: 'shape-rotate',
          id: shapeRot.id,
          centerWorld: { x: cx, y: cy },
          startAngle: shapeRot.rotation || 0,
        };
        container.style.cursor = 'grabbing';
        return;
      }

      // Check for shape resize handle
      const shapeRes = hitTestShapeResize(pos.x, pos.y);
      if (shapeRes) {
        pushUndo();
        state.dragging = {
          type: 'shape-resize',
          id: shapeRes.shape.id,
          dir: shapeRes.dir,
          startWorld: screenToWorld(pos.x, pos.y),
          origX: shapeRes.shape.x,
          origY: shapeRes.shape.y,
          origW: shapeRes.shape.w,
          origH: shapeRes.shape.h,
          origRot: shapeRes.shape.rotation || 0,
        };
        container.style.cursor = 'nwse-resize';
        return;
      }

      // Check for shape click (select / move)
      const shapeHit = hitTestShape(pos.x, pos.y);
      if (shapeHit) {
        if (e.ctrlKey) {
          const idx = (state.multiSelection.shapeIds || []).indexOf(shapeHit.id);
          if (idx >= 0) {
            state.multiSelection.shapeIds.splice(idx, 1);
          } else {
            state.multiSelection.shapeIds.push(shapeHit.id);
          }
          updatePropsPanel();
          render();
          return;
        }
        if ((state.multiSelection.shapeIds || []).includes(shapeHit.id)) {
          pushUndo();
          const startWorld = screenToWorld(pos.x, pos.y);
          state.dragging = { type: 'multi', lastWorld: startWorld };
          container.style.cursor = 'grabbing';
          return;
        }
        selectItem('shape', shapeHit.id);
        state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
        pushUndo();
        state.dragging = {
          type: 'shape',
          id: shapeHit.id,
          lastWorld: screenToWorld(pos.x, pos.y),
        };
        container.style.cursor = 'grabbing';
        return;
      }

      // Check for timeline resize (edges)
      const tlResize = hitTestTimelineResize(pos.x, pos.y);
      if (tlResize) {
        pushUndo();
        state.dragging = {
          type: 'timeline-resize',
          id: tlResize.tl.id,
          dir: tlResize.dir,
          startWorld: screenToWorld(pos.x, pos.y),
          origMonthCount: tlResize.tl.monthCount || 12,
          origMonthWidth: tlResize.tl.monthWidth || 80,
          origRowCount: tlResize.tl.rowCount || 5,
          origRowHeight: tlResize.tl.rowHeight || 30,
        };
        container.style.cursor = tlResize.dir === 'right' ? 'ew-resize' :
                                  tlResize.dir === 'bottom' ? 'ns-resize' : 'nwse-resize';
        return;
      }

      // Check for timeline click (move)
      const tlHit = hitTestTimeline(pos.x, pos.y);
      if (tlHit) {
        selectItem('timeline', tlHit.id);
        state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
        pushUndo();
        state.dragging = {
          type: 'timeline',
          id: tlHit.id,
          lastWorld: screenToWorld(pos.x, pos.y),
        };
        container.style.cursor = 'grabbing';
        return;
      }

      // Empty space left drag -> range selection
      clearSelection();
      state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
      state.rangeSelect = {
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
      };
      container.style.cursor = 'crosshair';
      render();
    } else if (state.tool === 'region') {
      pushUndo();
      const world = screenToWorld(pos.x, pos.y);
      state.regionDraw = {
        startX: world.x,
        startY: world.y,
        currentX: world.x,
        currentY: world.y,
      };
    } else if (state.tool === 'connector') {
      const cp = hitTestConnectionPoint(pos.x, pos.y);
      if (cp) {
        state.connectorDraw = {
          fromRegionId: cp.region.id,
          fromSide: cp.side,
          currentX: pos.x,
          currentY: pos.y,
          freeForm: false,
        };
        container.style.cursor = 'crosshair';
        render();
      } else {
        // Free-form drawing: start from any point on canvas
        const world = screenToWorld(pos.x, pos.y);
        state.connectorDraw = {
          fromX: world.x,
          fromY: world.y,
          currentX: pos.x,
          currentY: pos.y,
          freeForm: true,
        };
        container.style.cursor = 'crosshair';
        render();
      }
    } else if (state.tool === 'scheduleBar') {
      pushUndo();
      const world = screenToWorld(pos.x, pos.y);
      state.scheduleBarDraw = {
        x: world.x,
        y: world.y,
        w: 0,
        h: 0,
        startX: world.x,
        startY: world.y,
      };
    } else if (state.tool === 'shape') {
      const world = screenToWorld(pos.x, pos.y);
      state.shapeDraw = {
        startX: world.x,
        startY: world.y,
        currentX: world.x,
        currentY: world.y,
      };
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const pos = getCanvasPos(e);

    if (state.rangeSelect) {
      state.rangeSelect.currentX = pos.x;
      state.rangeSelect.currentY = pos.y;
      render();
      return;
    }

    if (state.connectorDraw) {
      state.connectorDraw.currentX = pos.x;
      state.connectorDraw.currentY = pos.y;
      render();
      return;
    }

    if (state.dragging) {
      if (state.dragging.type === 'person') {
        const p = state.persons.find(p => p.id === state.dragging.id);
        if (p) {
          const targetScreen = { x: pos.x - state.dragging.offsetX, y: pos.y - state.dragging.offsetY };
          const world = screenToWorld(targetScreen.x, targetScreen.y);
          p.x = world.x;
          p.y = world.y;
          render();
        }
      } else if (state.dragging.type === 'region') {
        const r = state.regions.find(r => r.id === state.dragging.id);
        if (r) {
          const targetScreen = { x: pos.x - state.dragging.offsetX, y: pos.y - state.dragging.offsetY };
          const world = screenToWorld(targetScreen.x, targetScreen.y);
          const dx = world.x - state.dragging.lastWorld.x;
          const dy = world.y - state.dragging.lastWorld.y;
          r.x = world.x;
          r.y = world.y;
          if (state.dragging.childPersonIds) {
            state.dragging.childPersonIds.forEach(pid => {
              const p = state.persons.find(p => p.id === pid);
              if (p) { p.x += dx; p.y += dy; }
            });
          }
          if (state.dragging.childRegionIds) {
            state.dragging.childRegionIds.forEach(crid => {
              const cr = state.regions.find(r => r.id === crid);
              if (cr) { cr.x += dx; cr.y += dy; }
            });
          }
          state.dragging.lastWorld = world;
          render();
        }
      } else if (state.dragging.type === 'multi') {
        const world = screenToWorld(pos.x, pos.y);
        const dx = world.x - state.dragging.lastWorld.x;
        const dy = world.y - state.dragging.lastWorld.y;
        // Track which persons have been moved to prevent double-moves
        const movedPersonIds = new Set();
        // Move explicitly selected persons
        state.multiSelection.personIds.forEach(pid => {
          const p = state.persons.find(p => p.id === pid);
          if (p) { p.x += dx; p.y += dy; movedPersonIds.add(pid); }
        });
        // Move selected regions + their internal persons (avoid double-move)
        state.multiSelection.regionIds.forEach(rid => {
          const r = state.regions.find(r => r.id === rid);
          if (r) {
            // Find persons inside region that haven't been moved yet
            state.persons.forEach(p => {
              if (!movedPersonIds.has(p.id) &&
                p.x >= r.x && p.x <= r.x + r.w &&
                p.y >= r.y && p.y <= r.y + r.h) {
                p.x += dx; p.y += dy;
                movedPersonIds.add(p.id);
              }
            });
            r.x += dx; r.y += dy;
          }
        });
        // Move selected text annotations
        (state.multiSelection.textIds || []).forEach(tid => {
          const t = state.textAnnotations.find(t => t.id === tid);
          if (t) { t.x += dx; t.y += dy; }
        });
        // Move selected freeForm connectors
        (state.multiSelection.connectorIds || []).forEach(cid => {
          const c = state.connectors.find(c => c.id === cid);
          if (c && c.freeForm) { c.fromX += dx; c.fromY += dy; c.toX += dx; c.toY += dy; }
        });
        // Move selected scheduleBars
        (state.multiSelection.scheduleBarIds || []).forEach(bid => {
          const b = state.scheduleBars.find(b => b.id === bid);
          if (b) { b.x += dx; b.y += dy; }
        });
        // Move selected shapes
        (state.multiSelection.shapeIds || []).forEach(sid => {
          const s = state.shapes.find(s => s.id === sid);
          if (s) { s.x += dx; s.y += dy; }
        });
        state.dragging.lastWorld = world;
        render();
      } else if (state.dragging.type === 'pan') {
        const dx = pos.x - state.dragging.startX;
        const dy = pos.y - state.dragging.startY;
        state.canvasOffset.x = state.dragging.origOffsetX + dx;
        state.canvasOffset.y = state.dragging.origOffsetY + dy;
        render();
      } else if (state.dragging.type === 'waypoint') {
        const world = screenToWorld(pos.x, pos.y);
        const wp = state.dragging.connector.waypoints[state.dragging.wpIndex];
        if (wp) {
          wp.x = world.x;
          wp.y = world.y;
          render();
        }
      } else if (state.dragging.type === 'text') {
        const t = state.textAnnotations.find(t => t.id === state.dragging.id);
        if (t) {
          const world = screenToWorld(pos.x, pos.y);
          const dx = world.x - state.dragging.lastWorld.x;
          const dy = world.y - state.dragging.lastWorld.y;
          t.x += dx;
          t.y += dy;
          state.dragging.lastWorld = world;
          render();
        }
      } else if (state.dragging.type === 'freeform-move') {
        const c = state.dragging.connector;
        const world = screenToWorld(pos.x, pos.y);
        const dx = world.x - state.dragging.lastWorld.x;
        const dy = world.y - state.dragging.lastWorld.y;
        c.fromX += dx;
        c.fromY += dy;
        c.toX += dx;
        c.toY += dy;
        state.dragging.lastWorld = world;
        render();
      } else if (state.dragging.type === 'freeform-endpoint') {
        const c = state.dragging.connector;
        const world = screenToWorld(pos.x, pos.y);
        if (state.dragging.endpoint === 'from') {
          c.fromX = world.x;
          c.fromY = world.y;
        } else {
          c.toX = world.x;
          c.toY = world.y;
        }
        render();
      } else if (state.dragging.type === 'resize') {
        const r = state.regions.find(r => r.id === state.dragging.id);
        if (r) {
          const world = screenToWorld(pos.x, pos.y);
          const dx = world.x - state.dragging.startPos.x;
          const dy = world.y - state.dragging.startPos.y;
          const dir = state.dragging.dir;
          const MIN_SIZE = 30;

          let nx = state.dragging.origX;
          let ny = state.dragging.origY;
          let nw = state.dragging.origW;
          let nh = state.dragging.origH;

          if (dir.includes('e')) { nw = Math.max(MIN_SIZE, nw + dx); }
          if (dir.includes('w')) { nx = nx + dx; nw = Math.max(MIN_SIZE, nw - dx); if (nw === MIN_SIZE) nx = state.dragging.origX + state.dragging.origW - MIN_SIZE; }
          if (dir.includes('s')) { nh = Math.max(MIN_SIZE, nh + dy); }
          if (dir.includes('n')) { ny = ny + dy; nh = Math.max(MIN_SIZE, nh - dy); if (nh === MIN_SIZE) ny = state.dragging.origY + state.dragging.origH - MIN_SIZE; }

          r.x = nx; r.y = ny; r.w = nw; r.h = nh;
          render();
        }
      } else if (state.dragging.type === 'scheduleBar') {
        const bar = state.scheduleBars.find(b => b.id === state.dragging.id);
        if (bar) {
          const world = screenToWorld(pos.x, pos.y);
          const dx = world.x - state.dragging.lastWorld.x;
          const dy = world.y - state.dragging.lastWorld.y;
          bar.x += dx;
          bar.y += dy;
          state.dragging.lastWorld = world;
          render();
        }
      } else if (state.dragging.type === 'scheduleBar-resize') {
        const bar = state.scheduleBars.find(b => b.id === state.dragging.id);
        if (bar) {
          const world = screenToWorld(pos.x, pos.y);
          const dx = world.x - state.dragging.startPos.x;
          const MIN_W = 20, MIN_H = 10;
          if (state.dragging.dir === 'right') {
            bar.w = Math.max(MIN_W, state.dragging.origW + dx);
          } else if (state.dragging.dir === 'left') {
            const newW = state.dragging.origW - dx;
            if (newW >= MIN_W) {
              bar.x = state.dragging.origX + dx;
              bar.w = newW;
            }
          } else if (state.dragging.dir === 'bottom-right') {
            const dy = world.y - state.dragging.startPos.y;
            bar.w = Math.max(MIN_W, state.dragging.origW + dx);
            bar.h = Math.max(MIN_H, state.dragging.origH + dy);
          }
          render();
        }
      } else if (state.dragging.type === 'shape') {
        const shape = state.shapes.find(s => s.id === state.dragging.id);
        if (shape) {
          const world = screenToWorld(pos.x, pos.y);
          const dx = world.x - state.dragging.lastWorld.x;
          const dy = world.y - state.dragging.lastWorld.y;
          shape.x += dx;
          shape.y += dy;
          state.dragging.lastWorld = world;
          render();
        }
      } else if (state.dragging.type === 'shape-resize') {
        const shape = state.shapes.find(s => s.id === state.dragging.id);
        if (shape) {
          const world = screenToWorld(pos.x, pos.y);
          const d = state.dragging;
          // Compute delta in rotated local space
          const rot = -(d.origRot);
          const gdx = world.x - d.startWorld.x;
          const gdy = world.y - d.startWorld.y;
          const ldx = gdx * Math.cos(rot) - gdy * Math.sin(rot);
          const ldy = gdx * Math.sin(rot) + gdy * Math.cos(rot);
          const minS = 20;
          let nx = d.origX, ny = d.origY, nw = d.origW, nh = d.origH;
          const dir = d.dir;
          if (dir.includes('e')) { nw = Math.max(minS, d.origW + ldx); }
          if (dir.includes('w')) { nw = Math.max(minS, d.origW - ldx); nx = d.origX + (d.origW - nw); }
          if (dir.includes('s')) { nh = Math.max(minS, d.origH + ldy); }
          if (dir.includes('n')) { nh = Math.max(minS, d.origH - ldy); ny = d.origY + (d.origH - nh); }
          shape.x = nx; shape.y = ny; shape.w = nw; shape.h = nh;
          render();
        }
      } else if (state.dragging.type === 'shape-rotate') {
        const shape = state.shapes.find(s => s.id === state.dragging.id);
        if (shape) {
          const world = screenToWorld(pos.x, pos.y);
          const c = state.dragging.centerWorld;
          let angle = Math.atan2(world.x - c.x, -(world.y - c.y));
          // Shift snap to 15 degrees
          if (state.shiftHeld) {
            const snap = Math.PI / 12; // 15 degrees
            angle = Math.round(angle / snap) * snap;
          }
          shape.rotation = angle;
          render();
        }
      } else if (state.dragging.type === 'timeline') {
        const tl = state.timelines.find(t => t.id === state.dragging.id);
        if (tl) {
          const world = screenToWorld(pos.x, pos.y);
          const dx = world.x - state.dragging.lastWorld.x;
          const dy = world.y - state.dragging.lastWorld.y;
          tl.x += dx;
          tl.y += dy;
          state.dragging.lastWorld = world;
          render();
        }
      } else if (state.dragging.type === 'timeline-resize') {
        const tl = state.timelines.find(t => t.id === state.dragging.id);
        if (tl) {
          const world = screenToWorld(pos.x, pos.y);
          const dx = world.x - state.dragging.startWorld.x;
          const dy = world.y - state.dragging.startWorld.y;
          const mc = state.dragging.origMonthCount;
          const rc = state.dragging.origRowCount;

          if (state.dragging.dir === 'right' || state.dragging.dir === 'bottom-right') {
            // Change monthWidth: total = origMonthWidth * mc + dx → newMonthWidth = total / mc
            const newTotalW = state.dragging.origMonthWidth * mc + dx;
            tl.monthWidth = Math.max(20, Math.round(newTotalW / mc));
          }
          if (state.dragging.dir === 'bottom' || state.dragging.dir === 'bottom-right') {
            const origRH = state.dragging.origRowHeight || 30;
            const newTotalH = origRH * rc + dy;
            tl.rowHeight = Math.max(15, Math.round(newTotalH / rc));
          }
          updatePropsPanel();
          render();
        }
      }
      return;
    }

    if (state.regionDraw) {
      const world = screenToWorld(pos.x, pos.y);
      state.regionDraw.currentX = world.x;
      state.regionDraw.currentY = world.y;
      render();
      return;
    }

    if (state.scheduleBarDraw) {
      const world = screenToWorld(pos.x, pos.y);
      const d = state.scheduleBarDraw;
      d.x = Math.min(d.startX, world.x);
      d.y = Math.min(d.startY, world.y);
      d.w = Math.abs(world.x - d.startX);
      d.h = Math.abs(world.y - d.startY);
      render();
      return;
    }

    if (state.shapeDraw) {
      const world = screenToWorld(pos.x, pos.y);
      state.shapeDraw.currentX = world.x;
      state.shapeDraw.currentY = world.y;
      render();
      return;
    }

    // Cursor hints
    if (state.tool === 'select') {
      const handle = hitTestResizeHandle(pos.x, pos.y);
      if (handle) {
        container.style.cursor = resizeCursors[handle.dir] || 'default';
        return;
      }
      const person = hitTestPerson(pos.x, pos.y);
      const region = hitTestRegion(pos.x, pos.y);
      const textAnn = hitTestTextAnnotation(pos.x, pos.y);
      const wpHandle = hitTestWaypointHandle(pos.x, pos.y);
      const mpHandle = hitTestMidpointHandle(pos.x, pos.y);
      const connectorLine = hitTestConnector(pos.x, pos.y);
      const schedBar = hitTestScheduleBar(pos.x, pos.y);
      const sbResizeCheck = hitTestScheduleBarResize(pos.x, pos.y);
      const tlResizeCheck = hitTestTimelineResize(pos.x, pos.y);
      const shapeRotCheck = hitTestShapeRotation(pos.x, pos.y);
      const shapeResCheck = hitTestShapeResize(pos.x, pos.y);
      const shapeCheck = hitTestShape(pos.x, pos.y);
      if (shapeRotCheck) {
        container.style.cursor = 'grab';
      } else if (shapeResCheck) {
        const rc = { nw: 'nwse-resize', ne: 'nesw-resize', se: 'nwse-resize', sw: 'nesw-resize',
                     n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
        container.style.cursor = rc[shapeResCheck.dir] || 'nwse-resize';
      } else if (tlResizeCheck) {
        container.style.cursor = tlResizeCheck.dir === 'right' ? 'ew-resize' :
                                  tlResizeCheck.dir === 'bottom' ? 'ns-resize' : 'nwse-resize';
      } else {
        container.style.cursor = shapeCheck ? 'grab' : (sbResizeCheck ? 'ew-resize' : (wpHandle ? 'move' : (mpHandle ? 'pointer' : (person ? 'grab' : (region ? 'move' : (textAnn ? 'grab' : (schedBar ? 'grab' : (connectorLine ? 'pointer' : 'default'))))))));
      }
    } else if (state.tool === 'region' || state.tool === 'scheduleBar' || state.tool === 'shape') {
      container.style.cursor = 'crosshair';
    } else if (state.tool === 'connector') {
      const cp = hitTestConnectionPoint(pos.x, pos.y);
      container.style.cursor = cp ? 'crosshair' : 'default';
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    // Range select complete
    if (state.rangeSelect) {
      const rs = state.rangeSelect;
      const sx1 = Math.min(rs.startX, rs.currentX);
      const sy1 = Math.min(rs.startY, rs.currentY);
      const sx2 = Math.max(rs.startX, rs.currentX);
      const sy2 = Math.max(rs.startY, rs.currentY);
      const w1 = screenToWorld(sx1, sy1);
      const w2 = screenToWorld(sx2, sy2);
      const wx1 = Math.min(w1.x, w2.x);
      const wy1 = Math.min(w1.y, w2.y);
      const wx2 = Math.max(w1.x, w2.x);
      const wy2 = Math.max(w1.y, w2.y);

      const selectedPersonIds = state.persons.filter(p =>
        p.x >= wx1 && p.x <= wx2 && p.y >= wy1 && p.y <= wy2
      ).map(p => p.id);

      const selectedRegionIds = state.regions.filter(r =>
        r.x >= wx1 && r.x + r.w <= wx2 && r.y >= wy1 && r.y + r.h <= wy2
      ).map(r => r.id);

      const selectedTextIds = state.textAnnotations.filter(t => {
        const fontSize = t.fontSize || 9;
        const lines = (t.text || '').split('\n');
        const maxW = 80; // approximate width
        const totalH = lines.length * fontSize * 1.3;
        return t.x >= wx1 && t.x + maxW <= wx2 && t.y >= wy1 && t.y + totalH <= wy2;
      }).map(t => t.id);

      const selectedConnectorIds = state.connectors.filter(c => {
        if (!c.freeForm) return false;
        const minX = Math.min(c.fromX, c.toX);
        const maxX = Math.max(c.fromX, c.toX);
        const minY = Math.min(c.fromY, c.toY);
        const maxY = Math.max(c.fromY, c.toY);
        return minX >= wx1 && maxX <= wx2 && minY >= wy1 && maxY <= wy2;
      }).map(c => c.id);

      const selectedBarIds = state.scheduleBars.filter(b => {
        return b.x >= wx1 && b.x + b.w <= wx2 && b.y >= wy1 && b.y + b.h <= wy2;
      }).map(b => b.id);

      const selectedShapeIds = state.shapes.filter(s => {
        return s.x >= wx1 && s.x + s.w <= wx2 && s.y >= wy1 && s.y + s.h <= wy2;
      }).map(s => s.id);

      state.multiSelection = { personIds: selectedPersonIds, regionIds: selectedRegionIds, textIds: selectedTextIds, connectorIds: selectedConnectorIds, scheduleBarIds: selectedBarIds, shapeIds: selectedShapeIds };
      state.rangeSelect = null;
      container.style.cursor = 'default';
      updatePropsPanel();
      render();
      return;
    }

    if (state.dragging) {
      const wasPan = state.dragging.type === 'pan';
      state.dragging = null;
      container.style.cursor = 'default';
      if (!wasPan) saveState();
      return;
    }

    // Connector draw complete
    if (state.connectorDraw) {
      const pos = getCanvasPos(e);
      if (state.connectorDraw.freeForm) {
        // Free-form line: complete at release position
        const world = screenToWorld(pos.x, pos.y);
        const dist = Math.hypot(world.x - state.connectorDraw.fromX, world.y - state.connectorDraw.fromY);
        if (dist > 10) {
          pushUndo();
          const connector = {
            id: state.nextId++,
            freeForm: true,
            fromX: state.connectorDraw.fromX,
            fromY: state.connectorDraw.fromY,
            toX: world.x,
            toY: world.y,
            lineType: 'straight',
            label: '',
            direction: 'none',
            waypoints: [],
            layerId: state.activeLayerId,
          };
          state.connectors.push(connector);
          selectItem('connector', connector.id);
          saveState();
        }
      } else {
        // Region-to-region connector
        const cp = hitTestConnectionPoint(pos.x, pos.y);
        if (cp && cp.region.id !== state.connectorDraw.fromRegionId) {
          pushUndo();
          const fromRegion = state.regions.find(r => r.id === state.connectorDraw.fromRegionId);
          const connector = {
            id: state.nextId++,
            fromRegionId: state.connectorDraw.fromRegionId,
            toRegionId: cp.region.id,
            fromSide: state.connectorDraw.fromSide,
            toSide: cp.side,
            lineType: 'elbow',
            label: '',
            direction: 'none',
            waypoints: [],
            layerId: state.activeLayerId,
          };
          if (fromRegion) {
            const from = getConnectionPointWorld(fromRegion, connector.fromSide);
            const to = getConnectionPointWorld(cp.region, connector.toSide);
            const autoPoints = routeConnector(from, to, connector.fromSide, connector.toSide, []);
            connector.waypoints = autoPoints.slice(1, -1).map(p => ({ x: p.x, y: p.y }));
          }
          state.connectors.push(connector);
          selectItem('connector', connector.id);
          saveState();
        }
      }
      state.connectorDraw = null;
      container.style.cursor = 'default';
      render();
      return;
    }

    if (state.regionDraw) {
      const rd = state.regionDraw;
      const x = Math.min(rd.startX, rd.currentX);
      const y = Math.min(rd.startY, rd.currentY);
      const w = Math.abs(rd.currentX - rd.startX);
      const h = Math.abs(rd.currentY - rd.startY);

      if (w > 10 && h > 10) {
        const region = {
          id: state.nextId++,
          name: '',
          x, y, w, h,
          layerId: state.activeLayerId,
        };
        state.regions.push(region);
        selectItem('region', region.id);
        saveState();
      }

      state.regionDraw = null;
      render();
    }

    if (state.scheduleBarDraw) {
      const d = state.scheduleBarDraw;
      if (d.w > 10 && d.h > 5) {
        const bar = {
          id: state.nextId++,
          label: '',
          x: d.x,
          y: d.y,
          w: d.w,
          h: d.h,
          color: '#4a8acf',
          tipShape: 'chevron',
          layerId: state.activeLayerId,
        };
        state.scheduleBars.push(bar);
        selectItem('scheduleBar', bar.id);
        saveState();
      }
      state.scheduleBarDraw = null;
      render();
    }

    if (state.shapeDraw) {
      const d = state.shapeDraw;
      const x = Math.min(d.startX, d.currentX);
      const y = Math.min(d.startY, d.currentY);
      const w = Math.abs(d.currentX - d.startX);
      const h = Math.abs(d.currentY - d.startY);
      if (w > 10 && h > 10) {
        createShape({
          type: state.activeShapeType,
          x, y, w, h,
        });
      }
      state.shapeDraw = null;
      render();
    }
  });

  // Prevent context menu on canvas (for right-drag pan)
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('dblclick', (e) => {
    const pos = getCanvasPos(e);
    // Shape label editing
    const shapeHit = hitTestShape(pos.x, pos.y);
    if (shapeHit) {
      const label = prompt('図形ラベルを入力してください:', shapeHit.label || '');
      if (label !== null) {
        pushUndo();
        shapeHit.label = label;
        updatePropsPanel();
        saveState();
        render();
      }
      return;
    }
    // Connector label editing
    const connector = hitTestConnector(pos.x, pos.y);
    if (connector) {
      const label = prompt('コネクタラベルを入力してください:', connector.label || '');
      if (label !== null) {
        pushUndo();
        connector.label = label;
        if (state.selectedType === 'connector' && state.selectedId === connector.id) {
          if (propConnectorLabel) propConnectorLabel.value = label;
        }
        saveState();
        render();
      }
      return;
    }
    const region = hitTestRegion(pos.x, pos.y);
    if (region) {
      const name = prompt('領域名を入力してください:', region.name || '');
      if (name !== null) {
        pushUndo();
        region.name = name;
        if (state.selectedType === 'region' && state.selectedId === region.id) {
          propRegionName.value = name;
        }
        saveState();
        render();
      }
    }

    // ScheduleBar label editing
    const schedBar = hitTestScheduleBar(pos.x, pos.y);
    if (schedBar) {
      const label = prompt('スケジュールバーのラベルを入力してください:', schedBar.label || '');
      if (label !== null) {
        pushUndo();
        schedBar.label = label;
        if (state.selectedType === 'scheduleBar' && state.selectedId === schedBar.id) {
          const propBarLabel = document.getElementById('prop-bar-label');
          if (propBarLabel) propBarLabel.value = label;
        }
        saveState();
        render();
      }
      return;
    }
  });

  // ===== Mouse Wheel Zoom =====
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const worldBefore = screenToWorld(pos.x, pos.y);

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    state.zoom = Math.max(state.zoomMin, Math.min(state.zoomMax, state.zoom * delta));

    // Adjust offset so the world point under cursor stays fixed
    const cx = canvas.width / 2 + state.canvasOffset.x;
    const cy = canvas.height / 3 + state.canvasOffset.y;
    let screenAfter;
    if (state.viewMode === 'quarter') {
      const iso = toIso(worldBefore.x, worldBefore.y);
      screenAfter = { x: iso.x * state.zoom + cx, y: iso.y * state.zoom + cy };
    } else {
      screenAfter = { x: worldBefore.x * state.zoom + cx, y: worldBefore.y * state.zoom + cy };
    }
    state.canvasOffset.x += pos.x - screenAfter.x;
    state.canvasOffset.y += pos.y - screenAfter.y;

    updateZoomLabel();
    render();
  }, { passive: false });

  // ===== Touch Events (Pinch Zoom & Pan) =====
  // Prevent default browser touch gestures on canvas
  canvas.style.touchAction = 'none';

  let touchState = {
    active: false,
    mode: null,          // 'pan' or 'pinch'
    startX: 0,
    startY: 0,
    origOffsetX: 0,
    origOffsetY: 0,
    lastPinchDist: 0,
    lastPinchMidX: 0,
    lastPinchMidY: 0,
  };

  function getTouchDistance(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  function getTouchMidpoint(t1, t2) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (t1.clientX + t2.clientX) / 2 - rect.left,
      y: (t1.clientY + t2.clientY) / 2 - rect.top,
    };
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      // Single finger → pan
      const rect = canvas.getBoundingClientRect();
      const tx = e.touches[0].clientX - rect.left;
      const ty = e.touches[0].clientY - rect.top;
      touchState = {
        active: true,
        mode: 'pan',
        startX: tx,
        startY: ty,
        origOffsetX: state.canvasOffset.x,
        origOffsetY: state.canvasOffset.y,
        lastPinchDist: 0,
        lastPinchMidX: 0,
        lastPinchMidY: 0,
      };
    } else if (e.touches.length === 2) {
      // Two fingers → pinch zoom
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const mid = getTouchMidpoint(e.touches[0], e.touches[1]);
      touchState = {
        active: true,
        mode: 'pinch',
        startX: 0,
        startY: 0,
        origOffsetX: state.canvasOffset.x,
        origOffsetY: state.canvasOffset.y,
        lastPinchDist: dist,
        lastPinchMidX: mid.x,
        lastPinchMidY: mid.y,
      };
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!touchState.active) return;

    if (touchState.mode === 'pan' && e.touches.length === 1) {
      const rect = canvas.getBoundingClientRect();
      const tx = e.touches[0].clientX - rect.left;
      const ty = e.touches[0].clientY - rect.top;
      const dx = tx - touchState.startX;
      const dy = ty - touchState.startY;
      state.canvasOffset.x = touchState.origOffsetX + dx;
      state.canvasOffset.y = touchState.origOffsetY + dy;
      render();
    } else if (e.touches.length === 2) {
      // Switch to pinch mode if was pan
      if (touchState.mode === 'pan') {
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const mid = getTouchMidpoint(e.touches[0], e.touches[1]);
        touchState.mode = 'pinch';
        touchState.lastPinchDist = dist;
        touchState.lastPinchMidX = mid.x;
        touchState.lastPinchMidY = mid.y;
        touchState.origOffsetX = state.canvasOffset.x;
        touchState.origOffsetY = state.canvasOffset.y;
        return;
      }

      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const mid = getTouchMidpoint(e.touches[0], e.touches[1]);

      if (touchState.lastPinchDist > 0) {
        // Calculate zoom delta
        const ratio = dist / touchState.lastPinchDist;
        const worldBefore = screenToWorld(mid.x, mid.y);

        state.zoom = Math.max(state.zoomMin, Math.min(state.zoomMax, state.zoom * ratio));

        // Adjust offset so the world point under pinch center stays fixed
        const cx = canvas.width / 2 + state.canvasOffset.x;
        const cy = canvas.height / 3 + state.canvasOffset.y;
        let screenAfter;
        if (state.viewMode === 'quarter') {
          const iso = toIso(worldBefore.x, worldBefore.y);
          screenAfter = { x: iso.x * state.zoom + cx, y: iso.y * state.zoom + cy };
        } else {
          screenAfter = { x: worldBefore.x * state.zoom + cx, y: worldBefore.y * state.zoom + cy };
        }
        state.canvasOffset.x += mid.x - screenAfter.x;
        state.canvasOffset.y += mid.y - screenAfter.y;

        // Also handle pan component of pinch
        const panDx = mid.x - touchState.lastPinchMidX;
        const panDy = mid.y - touchState.lastPinchMidY;
        state.canvasOffset.x += panDx;
        state.canvasOffset.y += panDy;

        updateZoomLabel();
        render();
      }

      touchState.lastPinchDist = dist;
      touchState.lastPinchMidX = mid.x;
      touchState.lastPinchMidY = mid.y;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (e.touches.length === 0) {
      touchState.active = false;
      touchState.mode = null;
    } else if (e.touches.length === 1) {
      // Went from 2 fingers to 1 → restart pan from current position
      const rect = canvas.getBoundingClientRect();
      const tx = e.touches[0].clientX - rect.left;
      const ty = e.touches[0].clientY - rect.top;
      touchState.mode = 'pan';
      touchState.startX = tx;
      touchState.startY = ty;
      touchState.origOffsetX = state.canvasOffset.x;
      touchState.origOffsetY = state.canvasOffset.y;
    }
  }, { passive: false });

  canvas.addEventListener('touchcancel', (e) => {
    touchState.active = false;
    touchState.mode = null;
  });

  // ===== Toolbar Events =====
  function updateZoomLabel() {
    if (zoomLabel) zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
  }

  btnAddPerson.addEventListener('click', () => {
    pushUndo();
    addPerson();
    renderPersonList();
    selectItem('person', state.persons[state.persons.length - 1].id);
    saveState();
    render();
  });

  if (btnAddItem) {
    btnAddItem.addEventListener('click', () => {
      pushUndo();
      addPerson(null, { itemType: 'item', icon: 'server' });
      renderPersonList();
      selectItem('person', state.persons[state.persons.length - 1].id);
      saveState();
      render();
    });
  }

  if (btnZoomReset) {
    btnZoomReset.addEventListener('click', () => {
      state.zoom = 1.0;
      state.canvasOffset.x = 0;
      state.canvasOffset.y = 0;
      updateZoomLabel();
      render();
    });
  }

  // ===== File Save / Load =====
  const btnSaveFile = document.getElementById('btn-save-file');
  const btnLoadFile = document.getElementById('btn-load-file');
  const fileImportInput = document.getElementById('file-import-input');

  if (btnSaveFile) {
    btnSaveFile.addEventListener('click', () => {
      const data = {
        persons: state.persons,
        regions: state.regions,
        roles: state.roles,
        connectors: state.connectors,
        textAnnotations: state.textAnnotations,
        layers: state.layers,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        nextId: state.nextId,
        exportedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `orgchart_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (btnLoadFile && fileImportInput) {
    btnLoadFile.addEventListener('click', () => {
      fileImportInput.click();
    });
    fileImportInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('現在のデータを上書きします。よろしいですか？')) {
        fileImportInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.persons) state.persons = data.persons;
          if (data.regions) state.regions = data.regions;
          if (data.roles) state.roles = data.roles;
          if (data.connectors) state.connectors = data.connectors;
          if (data.textAnnotations) state.textAnnotations = data.textAnnotations;
          if (data.layers && data.layers.length > 0) {
            state.layers = data.layers;
            state.activeLayerId = data.layers[0].id;
          }
          if (data.tabs && data.tabs.length > 0) {
            state.tabs = data.tabs;
            state.activeTabId = data.activeTabId || data.tabs[0].id;
          } else {
            state.tabs = [];
            state.activeTabId = null;
          }
          if (data.nextId) state.nextId = data.nextId;
          state.persons.forEach(migrateResource);
          clearSelection();
          initTabs();
          saveState();
          renderPersonList();
          renderLayerList();
          renderTabList();
          updatePropsPanel();
          render();
        } catch (err) {
          alert('ファイルの読み込みに失敗しました: ' + err.message);
        }
      };
      reader.readAsText(file);
      fileImportInput.value = '';
    });
  }

  btnSquareView.addEventListener('click', () => {
    state.viewMode = 'square';
    btnSquareView.classList.add('active');
    btnQuarterView.classList.remove('active');
    render();
  });

  btnQuarterView.addEventListener('click', () => {
    state.viewMode = 'quarter';
    btnQuarterView.classList.add('active');
    btnSquareView.classList.remove('active');
    render();
  });

  function setToolActive(tool) {
    state.tool = tool;
    btnToolSelect.classList.toggle('active', tool === 'select');
    btnToolRegion.classList.toggle('active', tool === 'region');
    if (btnToolConnector) btnToolConnector.classList.toggle('active', tool === 'connector');
    if (btnToolText) btnToolText.classList.toggle('active', tool === 'text');
    const btnSB = document.getElementById('btn-tool-scheduleBar');
    if (btnSB) btnSB.classList.toggle('active', tool === 'scheduleBar');
    const btnShape = document.getElementById('btn-tool-shape');
    if (btnShape) btnShape.classList.toggle('active', tool === 'shape');
    container.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    // Hide shape palette when switching away
    if (tool !== 'shape') {
      const pal = document.getElementById('shape-palette');
      if (pal) pal.style.display = 'none';
    }
    render();
  }

  btnToolSelect.addEventListener('click', () => setToolActive('select'));

  btnToolRegion.addEventListener('click', () => setToolActive('region'));

  if (btnToolConnector) {
    btnToolConnector.addEventListener('click', () => setToolActive('connector'));
  }

  // Shape tool setup
  state.activeShapeType = localStorage.getItem('stractal_lastShapeType') || 'rect';
  const shapePalette = document.getElementById('shape-palette');
  const btnToolShape = document.getElementById('btn-tool-shape');

  function updateShapeButton() {
    if (!btnToolShape) return;
    const currentShape = SHAPE_TYPES.find(st => st.type === state.activeShapeType) || SHAPE_TYPES[0];
    btnToolShape.innerHTML = `<span class="shape-icon">${currentShape.icon}</span> ${currentShape.label} <span style="font-size:0.8em; margin-left:4px; opacity:0.6;">▼</span>`;
  }

  if (shapePalette && btnToolShape) {
    updateShapeButton(); // initial update

    // Build palette items
    SHAPE_TYPES.forEach(st => {
      const item = document.createElement('div');
      item.className = 'shape-palette-item' + (st.type === state.activeShapeType ? ' active' : '');
      item.innerHTML = `<span class="shape-icon">${st.icon}</span><span>${st.label}</span>`;
      item.dataset.type = st.type;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        state.activeShapeType = st.type;
        localStorage.setItem('stractal_lastShapeType', st.type);
        updateShapeButton();
        shapePalette.querySelectorAll('.shape-palette-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        setToolActive('shape');
        shapePalette.style.display = 'none';
      });
      shapePalette.appendChild(item);
    });

    btnToolShape.addEventListener('click', () => {
      if (state.tool === 'shape') {
        // Toggle palette if already active
        shapePalette.style.display = shapePalette.style.display === 'none' ? 'grid' : 'none';
      } else {
        setToolActive('shape');
        shapePalette.style.display = 'none'; // Do not force open on initial switch
      }
    });

    // Close palette on outside click
    document.addEventListener('click', (e) => {
      if (!btnToolShape.contains(e.target) && !shapePalette.contains(e.target)) {
        shapePalette.style.display = 'none';
      }
    });
  }

  function deleteSelected() {
    // Multi-selection delete
    if (state.multiSelection.personIds.length > 0 || state.multiSelection.regionIds.length > 0 || (state.multiSelection.textIds || []).length > 0 || (state.multiSelection.connectorIds || []).length > 0 || (state.multiSelection.shapeIds || []).length > 0) {
      pushUndo();
      // Delete multi-selected persons
      state.multiSelection.personIds.forEach(pid => {
        state.persons = state.persons.filter(p => p.id !== pid);
      });
      // Delete multi-selected regions and their connectors
      state.multiSelection.regionIds.forEach(rid => {
        state.connectors = state.connectors.filter(c =>
          c.fromRegionId !== rid && c.toRegionId !== rid
        );
        state.regions = state.regions.filter(r => r.id !== rid);
      });
      // Delete multi-selected text annotations
      (state.multiSelection.textIds || []).forEach(tid => {
        state.textAnnotations = state.textAnnotations.filter(t => t.id !== tid);
      });
      // Delete multi-selected connectors
      (state.multiSelection.connectorIds || []).forEach(cid => {
        state.connectors = state.connectors.filter(c => c.id !== cid);
      });
      // Delete multi-selected scheduleBars
      (state.multiSelection.scheduleBarIds || []).forEach(bid => {
        state.scheduleBars = state.scheduleBars.filter(b => b.id !== bid);
      });
      // Delete multi-selected shapes
      (state.multiSelection.shapeIds || []).forEach(sid => {
        state.shapes = state.shapes.filter(s => s.id !== sid);
      });
      state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
      clearSelection();
      renderPersonList();
      saveState();
      render();
      return;
    }
    // Single selection delete
    if (state.selectedType === 'person') {
      pushUndo();
      deletePerson(state.selectedId);
    } else if (state.selectedType === 'region') {
      pushUndo();
      state.connectors = state.connectors.filter(c =>
        c.fromRegionId !== state.selectedId && c.toRegionId !== state.selectedId
      );
      deleteRegion(state.selectedId);
    } else if (state.selectedType === 'connector') {
      pushUndo();
      state.connectors = state.connectors.filter(c => c.id !== state.selectedId);
      clearSelection();
      saveState();
      render();
    } else if (state.selectedType === 'text') {
      pushUndo();
      state.textAnnotations = state.textAnnotations.filter(t => t.id !== state.selectedId);
      clearSelection();
      saveState();
      render();
    } else if (state.selectedType === 'scheduleBar') {
      pushUndo();
      state.scheduleBars = state.scheduleBars.filter(b => b.id !== state.selectedId);
      clearSelection();
      saveState();
      render();
    } else if (state.selectedType === 'timeline') {
      pushUndo();
      state.timelines = state.timelines.filter(t => t.id !== state.selectedId);
      clearSelection();
      saveState();
      render();
    } else if (state.selectedType === 'shape') {
      pushUndo();
      state.shapes = state.shapes.filter(s => s.id !== state.selectedId);
      clearSelection();
      saveState();
      render();
    }
  }

  btnDelete.addEventListener('click', deleteSelected);

  // ===== Undo/Redo Buttons =====
  if (btnUndo) btnUndo.addEventListener('click', undo);
  if (btnRedo) btnRedo.addEventListener('click', redo);

  // ===== Clipboard for Copy/Paste =====
  let clipboard = { persons: [], regions: [], texts: [] };

  function copySelected() {
    clipboard = { persons: [], regions: [], texts: [], connectors: [] };
    // Copy from multi-selection
    if (state.multiSelection.personIds.length > 0) {
      clipboard.persons = state.multiSelection.personIds.map(id =>
        JSON.parse(JSON.stringify(state.persons.find(p => p.id === id)))
      ).filter(Boolean);
    }
    if (state.multiSelection.regionIds.length > 0) {
      clipboard.regions = state.multiSelection.regionIds.map(id =>
        JSON.parse(JSON.stringify(state.regions.find(r => r.id === id)))
      ).filter(Boolean);
    }
    if ((state.multiSelection.textIds || []).length > 0) {
      clipboard.texts = state.multiSelection.textIds.map(id =>
        JSON.parse(JSON.stringify(state.textAnnotations.find(t => t.id === id)))
      ).filter(Boolean);
    }
    if ((state.multiSelection.connectorIds || []).length > 0) {
      clipboard.connectors = state.multiSelection.connectorIds.map(id =>
        JSON.parse(JSON.stringify(state.connectors.find(c => c.id === id)))
      ).filter(Boolean);
    }
    // Copy single selection
    if (clipboard.persons.length === 0 && clipboard.regions.length === 0 && clipboard.texts.length === 0 && clipboard.connectors.length === 0) {
      if (state.selectedType === 'person') {
        const p = state.persons.find(p => p.id === state.selectedId);
        if (p) clipboard.persons.push(JSON.parse(JSON.stringify(p)));
      } else if (state.selectedType === 'region') {
        const r = state.regions.find(r => r.id === state.selectedId);
        if (r) clipboard.regions.push(JSON.parse(JSON.stringify(r)));
      } else if (state.selectedType === 'text') {
        const t = state.textAnnotations.find(t => t.id === state.selectedId);
        if (t) clipboard.texts.push(JSON.parse(JSON.stringify(t)));
      } else if (state.selectedType === 'connector') {
        const c = state.connectors.find(c => c.id === state.selectedId);
        if (c && c.freeForm) clipboard.connectors.push(JSON.parse(JSON.stringify(c)));
      }
    }
  }

  function pasteClipboard() {
    if (clipboard.persons.length === 0 && clipboard.regions.length === 0 && clipboard.texts.length === 0 && (clipboard.connectors || []).length === 0) return;
    pushUndo();
    const offset = 30;
    const newPersonIds = [];
    clipboard.persons.forEach(p => {
      const np = addPerson(p.name, {
        role: p.role, affiliation: p.affiliation, color: p.color,
        x: p.x + offset, y: p.y + offset,
        roleIds: p.roleIds || [],
        email: p.email, phone: p.phone, joinDate: p.joinDate,
        effectiveDate: p.effectiveDate, photoUrl: p.photoUrl,
      });
      newPersonIds.push(np.id);
    });
    const newRegionIds = [];
    clipboard.regions.forEach(r => {
      const nr = { id: state.nextId++, name: r.name, x: r.x + offset, y: r.y + offset, w: r.w, h: r.h, color: r.color || '#4a8acf' };
      state.regions.push(nr);
      newRegionIds.push(nr.id);
    });
    const newTextIds = [];
    clipboard.texts.forEach(t => {
      const nt = { id: state.nextId++, text: t.text, x: t.x + offset, y: t.y + offset, fontSize: t.fontSize || 9, color: t.color || '#2c3e50' };
      state.textAnnotations.push(nt);
      newTextIds.push(nt.id);
    });
    const newConnectorIds = [];
    (clipboard.connectors || []).forEach(c => {
      const nc = { ...JSON.parse(JSON.stringify(c)), id: state.nextId++, fromX: c.fromX + offset, fromY: c.fromY + offset, toX: c.toX + offset, toY: c.toY + offset };
      state.connectors.push(nc);
      newConnectorIds.push(nc.id);
    });
    state.multiSelection = { personIds: newPersonIds, regionIds: newRegionIds, textIds: newTextIds, connectorIds: newConnectorIds };
    clearSelection();
    renderPersonList();
    saveState();
    render();
  }

  function selectAll() {
    state.multiSelection.personIds = state.persons.map(p => p.id);
    state.multiSelection.regionIds = state.regions.map(r => r.id);
    state.multiSelection.textIds = state.textAnnotations.map(t => t.id);
    state.multiSelection.connectorIds = state.connectors.filter(c => c.freeForm).map(c => c.id);
    clearSelection();
    renderPersonList();
    render();
  }

  function nudgeSelected(dx, dy) {
    const items = [];
    if (state.multiSelection.personIds.length > 0 || state.multiSelection.regionIds.length > 0 || (state.multiSelection.textIds || []).length > 0 || (state.multiSelection.connectorIds || []).length > 0) {
      pushUndo();
      state.multiSelection.personIds.forEach(pid => {
        const p = state.persons.find(p => p.id === pid);
        if (p) { p.x += dx; p.y += dy; }
      });
      state.multiSelection.regionIds.forEach(rid => {
        const r = state.regions.find(r => r.id === rid);
        if (r) { r.x += dx; r.y += dy; }
      });
      (state.multiSelection.textIds || []).forEach(tid => {
        const t = state.textAnnotations.find(t => t.id === tid);
        if (t) { t.x += dx; t.y += dy; }
      });
      (state.multiSelection.connectorIds || []).forEach(cid => {
        const c = state.connectors.find(c => c.id === cid);
        if (c && c.freeForm) { c.fromX += dx; c.fromY += dy; c.toX += dx; c.toY += dy; }
      });
    } else if (state.selectedType === 'person') {
      pushUndo();
      const p = state.persons.find(p => p.id === state.selectedId);
      if (p) { p.x += dx; p.y += dy; }
    } else if (state.selectedType === 'region') {
      pushUndo();
      const r = state.regions.find(r => r.id === state.selectedId);
      if (r) { r.x += dx; r.y += dy; }
    } else if (state.selectedType === 'text') {
      pushUndo();
      const t = state.textAnnotations.find(t => t.id === state.selectedId);
      if (t) { t.x += dx; t.y += dy; }
    } else {
      return;
    }
    saveState();
    render();
  }

  // ===== Keyboard Shortcuts =====
  document.addEventListener('keydown', (e) => {
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';

    // Ctrl+F: focus search (always works)
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      if (personSearch) personSearch.focus();
      return;
    }

    // Skip other shortcuts when in input fields
    if (inInput) return;

    // Ctrl shortcuts
    if (e.ctrlKey) {
      switch (e.key) {
        case 'z': e.preventDefault(); undo(); return;
        case 'y': e.preventDefault(); redo(); return;
        case 'a': e.preventDefault(); selectAll(); return;
        case 's': e.preventDefault(); if (btnSaveFile) btnSaveFile.click(); return;
        case 'c': e.preventDefault(); copySelected(); return;
        case 'v': e.preventDefault(); pasteClipboard(); return;
        case 'd': e.preventDefault(); copySelected(); pasteClipboard(); return;
        case '=': case '+': e.preventDefault(); state.zoom = Math.min(state.zoomMax, state.zoom * 1.15); updateZoomLabel(); render(); return;
        case '-': e.preventDefault(); state.zoom = Math.max(state.zoomMin, state.zoom / 1.15); updateZoomLabel(); render(); return;
        case '0': e.preventDefault(); state.zoom = 1.0; updateZoomLabel(); render(); return;
      }
    }

    // Non-Ctrl shortcuts
    if (e.key === 'Delete') {
      e.preventDefault();
      deleteSelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearSelection();
      state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [] };
      if (state.tool !== 'select') setToolActive('select');
      renderPersonList();
      render();
    } else if (e.key === 'Home') {
      e.preventDefault();
      state.canvasOffset.x = 0;
      state.canvasOffset.y = 0;
      state.zoom = 1.0;
      updateZoomLabel();
      render();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.shiftKey ? state.gridSize * 5 : state.gridSize;
      const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
      const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
      nudgeSelected(dx, dy);
    }

    // Shift key temp connector mode
    if (e.key === 'Shift' && !state.shiftHeld && state.tool !== 'connector') {
      state.shiftHeld = true;
      state.prevTool = state.tool;
      setToolActive('connector');
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' && state.shiftHeld) {
      state.shiftHeld = false;
      if (state.connectorDraw) {
        state.connectorDraw = null;
      }
      setToolActive(state.prevTool || 'select');
      state.prevTool = null;
    }
  });

  // ===== Connector Property Events =====
  if (propConnectorLabel) {
    propConnectorLabel.addEventListener('input', () => {
      const c = state.connectors.find(c => c.id === state.selectedId);
      if (c) { c.label = propConnectorLabel.value; saveState(); render(); }
    });
  }
  if (propConnectorDirection) {
    propConnectorDirection.addEventListener('change', () => {
      const c = state.connectors.find(c => c.id === state.selectedId);
      if (c) { c.direction = propConnectorDirection.value; saveState(); render(); }
    });
  }
  if (propConnectorLinetype) {
    propConnectorLinetype.addEventListener('change', () => {
      const c = state.connectors.find(c => c.id === state.selectedId);
      if (c) { c.lineType = propConnectorLinetype.value; saveState(); render(); }
    });
  }

  // ===== Z-Order Events =====
  function moveRegionZOrder(mode) {
    if (state.selectedType !== 'region') return;
    const idx = state.regions.findIndex(r => r.id === state.selectedId);
    if (idx < 0) return;
    pushUndo();
    const [region] = state.regions.splice(idx, 1);
    switch (mode) {
      case 'front': state.regions.push(region); break;
      case 'back': state.regions.unshift(region); break;
      case 'forward': state.regions.splice(Math.min(idx + 1, state.regions.length), 0, region); break;
      case 'backward': state.regions.splice(Math.max(idx - 1, 0), 0, region); break;
    }
    saveState();
    render();
  }
  if (btnZFront) btnZFront.addEventListener('click', () => moveRegionZOrder('front'));
  if (btnZForward) btnZForward.addEventListener('click', () => moveRegionZOrder('forward'));
  if (btnZBackward) btnZBackward.addEventListener('click', () => moveRegionZOrder('backward'));
  if (btnZBack) btnZBack.addEventListener('click', () => moveRegionZOrder('back'));

  // ===== Alignment =====
  function getMultiSelectedItems() {
    const items = [];
    // Collect selected regions first
    const selectedRegions = [];
    state.multiSelection.regionIds.forEach(rid => {
      const r = state.regions.find(r => r.id === rid);
      if (r) {
        items.push({ type: 'region', obj: r, x: r.x, y: r.y, w: r.w, h: r.h });
        selectedRegions.push(r);
      }
    });
    // Only include persons NOT inside any selected region
    state.multiSelection.personIds.forEach(pid => {
      const p = state.persons.find(p => p.id === pid);
      if (!p) return;
      const insideSelectedRegion = selectedRegions.some(r =>
        p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
      );
      if (!insideSelectedRegion) {
        items.push({ type: 'person', obj: p, x: p.x, y: p.y, w: 0, h: 0 });
      }
    });
    // Include text annotations
    (state.multiSelection.textIds || []).forEach(tid => {
      const t = state.textAnnotations.find(t => t.id === tid);
      if (t) {
        items.push({ type: 'text', obj: t, x: t.x, y: t.y, w: 0, h: 0 });
      }
    });
    return items;
  }

  // Helper: move a region (+ its internal persons) or person to new coordinates
  function applyMove(item, newX, newY) {
    if (item.type === 'region') {
      const dx = newX - item.obj.x;
      const dy = newY - item.obj.y;
      // Move persons inside the region
      state.persons.forEach(p => {
        if (p.x >= item.obj.x && p.x <= item.obj.x + item.obj.w &&
          p.y >= item.obj.y && p.y <= item.obj.y + item.obj.h) {
          p.x += dx;
          p.y += dy;
        }
      });
      item.obj.x = newX;
      item.obj.y = newY;
    } else {
      item.obj.x = newX;
      item.obj.y = newY;
    }
  }

  function alignItems(direction) {
    const items = getMultiSelectedItems();
    if (items.length < 2) return;
    pushUndo();

    if (direction === 'top') {
      const minY = Math.min(...items.map(i => i.y));
      items.forEach(i => applyMove(i, i.obj.x, minY));
    } else if (direction === 'bottom') {
      const maxY = Math.max(...items.map(i => i.y + i.h));
      items.forEach(i => applyMove(i, i.obj.x, maxY - i.h));
    } else if (direction === 'left') {
      const minX = Math.min(...items.map(i => i.x));
      items.forEach(i => applyMove(i, minX, i.obj.y));
    } else if (direction === 'right') {
      const maxX = Math.max(...items.map(i => i.x + i.w));
      items.forEach(i => applyMove(i, maxX - i.w, i.obj.y));
    } else if (direction === 'center-h') {
      const minX = Math.min(...items.map(i => i.x));
      const maxX = Math.max(...items.map(i => i.x + i.w));
      const centerX = (minX + maxX) / 2;
      items.forEach(i => applyMove(i, centerX - i.w / 2, i.obj.y));
    } else if (direction === 'center-v') {
      const minY = Math.min(...items.map(i => i.y));
      const maxY = Math.max(...items.map(i => i.y + i.h));
      const centerY = (minY + maxY) / 2;
      items.forEach(i => applyMove(i, i.obj.x, centerY - i.h / 2));
    }

    saveState();
    render();
  }

  if (btnAlignTop) btnAlignTop.addEventListener('click', () => alignItems('top'));
  if (btnAlignBottom) btnAlignBottom.addEventListener('click', () => alignItems('bottom'));
  if (btnAlignLeft) btnAlignLeft.addEventListener('click', () => alignItems('left'));
  if (btnAlignRight) btnAlignRight.addEventListener('click', () => alignItems('right'));
  if (btnAlignCenterH) btnAlignCenterH.addEventListener('click', () => alignItems('center-h'));
  if (btnAlignCenterV) btnAlignCenterV.addEventListener('click', () => alignItems('center-v'));

  // ===== Distribution (Equal Spacing) =====
  const btnDistributeH = document.getElementById('btn-distribute-h');
  const btnDistributeV = document.getElementById('btn-distribute-v');

  function distributeItems(axis) {
    const items = getMultiSelectedItems();
    if (items.length < 3) return; // Need at least 3 items to distribute
    pushUndo();

    if (axis === 'horizontal') {
      // Sort by x position
      items.sort((a, b) => a.x - b.x);
      const first = items[0];
      const last = items[items.length - 1];
      const totalSpan = (last.x + last.w) - first.x;
      const totalItemWidth = items.reduce((sum, i) => sum + i.w, 0);
      const gap = (totalSpan - totalItemWidth) / (items.length - 1);
      let currentX = first.x;
      items.forEach((item, idx) => {
        if (idx === 0) { currentX += item.w + gap; return; }
        applyMove(item, currentX, item.obj.y);
        currentX += item.w + gap;
      });
    } else if (axis === 'vertical') {
      // Sort by y position
      items.sort((a, b) => a.y - b.y);
      const first = items[0];
      const last = items[items.length - 1];
      const totalSpan = (last.y + last.h) - first.y;
      const totalItemHeight = items.reduce((sum, i) => sum + i.h, 0);
      const gap = (totalSpan - totalItemHeight) / (items.length - 1);
      let currentY = first.y;
      items.forEach((item, idx) => {
        if (idx === 0) { currentY += item.h + gap; return; }
        applyMove(item, item.obj.x, currentY);
        currentY += item.h + gap;
      });
    }

    saveState();
    render();
  }

  if (btnDistributeH) btnDistributeH.addEventListener('click', () => distributeItems('horizontal'));
  if (btnDistributeV) btnDistributeV.addEventListener('click', () => distributeItems('vertical'));

  // ===== Property Panel Events =====
  propName.addEventListener('input', () => {
    const p = state.persons.find(p => p.id === state.selectedId);
    if (p) { p.name = propName.value; renderPersonList(); saveState(); render(); }
  });
  propRole.addEventListener('input', () => {
    const p = state.persons.find(p => p.id === state.selectedId);
    if (p) { p.role = propRole.value; renderPersonList(); saveState(); }
  });
  propAffiliation.addEventListener('input', () => {
    const p = state.persons.find(p => p.id === state.selectedId);
    if (p) { p.affiliation = propAffiliation.value; saveState(); }
  });
  propColor.addEventListener('input', () => {
    const p = state.persons.find(p => p.id === state.selectedId);
    if (p) { p.color = propColor.value; }
    // Also apply to all multi-selected persons
    state.multiSelection.personIds.forEach(pid => {
      const mp = state.persons.find(p => p.id === pid);
      if (mp) mp.color = propColor.value;
    });
    renderPersonList(); saveState(); render();
  });
  propRegionName.addEventListener('input', () => {
    const r = state.regions.find(r => r.id === state.selectedId);
    if (r) { r.name = propRegionName.value; saveState(); render(); }
  });

  if (propRegionFontsize) {
    propRegionFontsize.addEventListener('change', () => {
      const r = state.regions.find(r => r.id === state.selectedId);
      if (r) { r.fontSize = parseInt(propRegionFontsize.value) || 13; saveState(); render(); }
    });
  }
  if (propRegionTextalign) {
    propRegionTextalign.addEventListener('change', () => {
      const r = state.regions.find(r => r.id === state.selectedId);
      if (r) { r.textAlign = propRegionTextalign.value; saveState(); render(); }
    });
  }

  // ===== Bulk Create =====
  btnBulkCreate.addEventListener('click', () => {
    bulkTextarea.value = '';
    bulkModal.classList.add('show');
  });

  bulkBtnCancel.addEventListener('click', () => {
    bulkModal.classList.remove('show');
  });

  bulkModal.addEventListener('click', (e) => {
    if (e.target === bulkModal) bulkModal.classList.remove('show');
  });

  bulkBtnCreate.addEventListener('click', () => {
    const text = bulkTextarea.value.trim();
    if (!text) return;
    bulkCreateFromText(text);
    bulkModal.classList.remove('show');
  });

  function parseBulkData(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    return lines.map(line => {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        return { affiliation: parts[0].trim(), name: parts[1].trim() };
      }
      return { affiliation: '', name: parts[0].trim() };
    });
  }

  function bulkCreateFromText(text) {
    const entries = parseBulkData(text);
    if (entries.length === 0) return;

    // Group by affiliation
    const groups = {};
    const groupOrder = [];
    entries.forEach(e => {
      const key = e.affiliation || '（所属なし）';
      if (!groups[key]) {
        groups[key] = [];
        groupOrder.push(key);
      }
      groups[key].push(e.name);
    });

    // Layout constants
    const personSpacingX = 50;
    const personSpacingY = 60;
    const regionPadding = 30;
    const regionGap = 40;
    const maxPersonsPerRow = 5;

    let offsetX = -((groupOrder.length - 1) * 200) / 2; // Center the layout

    groupOrder.forEach((groupName, gi) => {
      const names = groups[groupName];
      const cols = Math.min(names.length, maxPersonsPerRow);
      const rows = Math.ceil(names.length / maxPersonsPerRow);

      const rw = cols * personSpacingX + regionPadding * 2;
      const rh = rows * personSpacingY + regionPadding * 2 + 15;

      // Create region
      const region = {
        id: state.nextId++,
        name: groupName,
        x: offsetX,
        y: -rh / 2,
        w: rw,
        h: rh,
      };
      state.regions.push(region);

      // Place persons in region
      names.forEach((name, i) => {
        const col = i % maxPersonsPerRow;
        const row = Math.floor(i / maxPersonsPerRow);
        const px = offsetX + regionPadding + col * personSpacingX + personSpacingX / 2;
        const py = -rh / 2 + regionPadding + 15 + row * personSpacingY + personSpacingY / 2;
        addPerson(name, {
          affiliation: groupName,
          x: px,
          y: py,
          color: defaultColors[gi % defaultColors.length],
        });
      });

      offsetX += rw + regionGap;
    });

    renderPersonList();
    saveState();
    render();
  }

  // ===== Test Data Generator =====
  const lastNames = ['田中', '佐藤', '鈴木', '高橋', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '松本', '井上', '木村', '林', '清水', '山口', '阿部', '池田', '橋本', '森', '石川', '前田', '藤田', '後藤', '岡田', '長谷川', '村上', '近藤'];
  const firstNames = ['太郎', '花子', '一郎', '美咲', '健太', 'さくら', '大輔', '陽菜', '翔太', '結衣', '拓海', '葵', '蓮', '凛', '悠斗', '紬', '陸', '芽依', '颯真', '莉子', '大翔', '美月', '樹', '七海', '湊', '楓', '朝陽', '琴音'];
  const deptNames = ['営業部', '開発部', '人事部', '総務部', '経理部', '企画部', 'マーケティング部', '製造部', '品質管理部', '法務部', '広報部', '情報システム部', '海外事業部', '研究部', 'カスタマーサポート部'];

  testBtnGenerate.addEventListener('click', () => {
    const pc = parseInt(testPersonCount.value) || 10;
    const oc = parseInt(testOrgCount.value) || 3;
    const usedDepts = [];
    for (let i = 0; i < oc; i++) {
      const idx = i % deptNames.length;
      usedDepts.push(deptNames[idx]);
    }
    const lines = [];
    for (let i = 0; i < pc; i++) {
      const dept = usedDepts[i % oc];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      lines.push(dept + '\t' + ln + fn);
    }
    bulkTextarea.value = lines.join('\n');
  });

  // ===== Role Management =====
  btnRoleManage.addEventListener('click', () => {
    renderRoleList();
    roleModal.classList.add('show');
  });

  roleBtnClose.addEventListener('click', () => {
    roleModal.classList.remove('show');
  });

  roleModal.addEventListener('click', (e) => {
    if (e.target === roleModal) roleModal.classList.remove('show');
  });

  roleBtnAdd.addEventListener('click', () => {
    const name = roleAddName.value.trim();
    if (!name) return;
    const role = {
      id: state.nextId++,
      name: name,
      color: roleAddColor.value,
      icon: roleAddIcon.value,
    };
    state.roles.push(role);
    roleAddName.value = '';
    renderRoleList();
    saveState();
    // Update property panel if person selected
    if (state.selectedType === 'person') updatePropsPanel();
  });

  function renderRoleList() {
    roleList.innerHTML = '';
    if (state.roles.length === 0) {
      roleList.innerHTML = '<div style="color:#999;text-align:center;padding:16px;">役割がありません</div>';
      return;
    }
    state.roles.forEach(role => {
      const div = document.createElement('div');
      div.className = 'role-list-item';
      div.innerHTML = `
        <span class="role-badge-preview" style="background:${role.color}20;border:1px solid ${role.color};color:${darkenColor(role.color, 10)}">${role.icon ? role.icon + ' ' : ''}${role.name}</span>
        <div class="role-item-controls">
          <input type="color" value="${role.color}" class="role-color-edit" title="色を変更">
          <select class="role-icon-edit" title="アイコンを変更">
            <option value="" ${!role.icon ? 'selected' : ''}>なし</option>
            <option value="👑" ${role.icon === '👑' ? 'selected' : ''}>👑</option>
            <option value="⭐" ${role.icon === '⭐' ? 'selected' : ''}>⭐</option>
            <option value="🔧" ${role.icon === '🔧' ? 'selected' : ''}>🔧</option>
            <option value="📊" ${role.icon === '📊' ? 'selected' : ''}>📊</option>
            <option value="🎯" ${role.icon === '🎯' ? 'selected' : ''}>🎯</option>
            <option value="💼" ${role.icon === '💼' ? 'selected' : ''}>💼</option>
            <option value="🛡️" ${role.icon === '🛡️' ? 'selected' : ''}>🛡️</option>
            <option value="📝" ${role.icon === '📝' ? 'selected' : ''}>📝</option>
            <option value="🔬" ${role.icon === '🔬' ? 'selected' : ''}>🔬</option>
            <option value="💡" ${role.icon === '💡' ? 'selected' : ''}>💡</option>
          </select>
          <button class="btn btn-danger btn-icon role-delete-btn" title="削除">✕</button>
        </div>`;
      div.querySelector('.role-color-edit').addEventListener('input', (e) => {
        role.color = e.target.value;
        renderRoleList();
        renderPersonList();
        saveState();
        render();
        if (state.selectedType === 'person') updatePropsPanel();
      });
      div.querySelector('.role-icon-edit').addEventListener('change', (e) => {
        role.icon = e.target.value;
        renderRoleList();
        renderPersonList();
        saveState();
        render();
        if (state.selectedType === 'person') updatePropsPanel();
      });
      div.querySelector('.role-delete-btn').addEventListener('click', () => {
        state.roles = state.roles.filter(r => r.id !== role.id);
        // Remove from all persons
        state.persons.forEach(p => {
          if (p.roleIds) p.roleIds = p.roleIds.filter(rid => rid !== role.id);
        });
        renderRoleList();
        renderPersonList();
        saveState();
        render();
        if (state.selectedType === 'person') updatePropsPanel();
      });
      roleList.appendChild(div);
    });
  }

  // ===== LocalStorage =====
  function saveState() {
    // Save current tab data first
    if (state.activeTabId !== null) {
      const tab = state.tabs.find(t => t.id === state.activeTabId);
      if (tab) {
        tab.data = {
          persons: JSON.parse(JSON.stringify(state.persons)),
          regions: JSON.parse(JSON.stringify(state.regions)),
          connectors: JSON.parse(JSON.stringify(state.connectors)),
          textAnnotations: JSON.parse(JSON.stringify(state.textAnnotations)),
          scheduleBars: JSON.parse(JSON.stringify(state.scheduleBars)),
          timelines: JSON.parse(JSON.stringify(state.timelines)),
          shapes: JSON.parse(JSON.stringify(state.shapes)),
          layers: JSON.parse(JSON.stringify(state.layers)),
          activeLayerId: state.activeLayerId,
          canvasOffset: { ...state.canvasOffset },
          zoom: state.zoom,
        };
      }
    }
    const data = {
      persons: state.persons,
      regions: state.regions,
      roles: state.roles,
      connectors: state.connectors,
      textAnnotations: state.textAnnotations,
      scheduleBars: state.scheduleBars,
      timelines: state.timelines,
      shapes: state.shapes,
      layers: state.layers,
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      nextId: state.nextId,
      planConfig: state.planConfig,
    };
    try {
      localStorage.setItem('orgchart-state', JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem('orgchart-state');
      if (raw) {
        const data = JSON.parse(raw);
        state.persons = data.persons || [];
        state.regions = data.regions || [];
        state.roles = data.roles || [];
        state.connectors = data.connectors || [];
        state.textAnnotations = data.textAnnotations || [];
        state.scheduleBars = data.scheduleBars || [];
        state.timelines = data.timelines || [];
        state.shapes = data.shapes || [];
        state.nextId = data.nextId || 1;
        if (data.layers && data.layers.length > 0) {
          state.layers = data.layers;
          state.activeLayerId = data.activeLayerId || data.layers[0].id;
        } else {
          state.layers = [{ id: 1, name: 'メイン', visible: true, locked: false }];
          state.activeLayerId = 1;
        }
        if (data.tabs && data.tabs.length > 0) {
          state.tabs = data.tabs;
          state.activeTabId = data.activeTabId || data.tabs[0].id;
        }
        state.persons.forEach(migrateResource);
        state.planConfig = migratePlanConfig(data);
      }
    } catch (e) { /* ignore */ }
  }

  // ===== Context Menu for Connectors =====
  let ctxMenu = null;
  let ctxMenuJustShown = false;
  function hideContextMenu() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
  }
  function showConnectorContextMenu(clientX, clientY, connector) {
    hideContextMenu();
    ctxMenu = document.createElement('div');
    ctxMenu.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid #c8d8ec;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:4px 0;min-width:120px;font-size:13px;font-family:var(--font-family);';
    ctxMenu.style.left = clientX + 'px';
    ctxMenu.style.top = clientY + 'px';

    const addWpItem = document.createElement('div');
    addWpItem.textContent = '頂点追加';
    addWpItem.style.cssText = 'padding:6px 16px;cursor:pointer;';
    addWpItem.addEventListener('mouseenter', () => addWpItem.style.background = 'rgba(74,138,207,0.1)');
    addWpItem.addEventListener('mouseleave', () => addWpItem.style.background = '');
    addWpItem.addEventListener('click', () => {
      state.addingWaypoints = true;
      hideContextMenu();
      render();
    });
    ctxMenu.appendChild(addWpItem);

    // Delete waypoints option (if waypoints exist)
    if (connector.waypoints && connector.waypoints.length > 0) {
      const clearWpItem = document.createElement('div');
      clearWpItem.textContent = '頂点をすべて削除';
      clearWpItem.style.cssText = 'padding:6px 16px;cursor:pointer;color:#e74c3c;';
      clearWpItem.addEventListener('mouseenter', () => clearWpItem.style.background = 'rgba(231,76,60,0.08)');
      clearWpItem.addEventListener('mouseleave', () => clearWpItem.style.background = '');
      clearWpItem.addEventListener('click', () => {
        pushUndo();
        connector.waypoints = [];
        hideContextMenu();
        saveState();
        render();
      });
      ctxMenu.appendChild(clearWpItem);
    }

    document.body.appendChild(ctxMenu);
    // Prevent the document mousedown listener from immediately closing the menu
    ctxMenuJustShown = true;
    requestAnimationFrame(() => { ctxMenuJustShown = false; });
  }
  document.addEventListener('mousedown', (e) => {
    if (ctxMenu && !ctxMenuJustShown && !ctxMenu.contains(e.target)) hideContextMenu();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function showWaypointContextMenu(clientX, clientY, connector, wpIndex) {
    hideContextMenu();
    ctxMenu = document.createElement('div');
    ctxMenu.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid #c8d8ec;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:4px 0;min-width:120px;font-size:13px;font-family:var(--font-family);';
    ctxMenu.style.left = clientX + 'px';
    ctxMenu.style.top = clientY + 'px';

    const deleteItem = document.createElement('div');
    deleteItem.textContent = '頂点削除';
    deleteItem.style.cssText = 'padding:6px 16px;cursor:pointer;color:#e74c3c;';
    deleteItem.addEventListener('mouseenter', () => deleteItem.style.background = 'rgba(231,76,60,0.08)');
    deleteItem.addEventListener('mouseleave', () => deleteItem.style.background = '');
    deleteItem.addEventListener('click', () => {
      pushUndo();
      connector.waypoints.splice(wpIndex, 1);
      hideContextMenu();
      saveState();
      render();
    });
    ctxMenu.appendChild(deleteItem);

    document.body.appendChild(ctxMenu);
    ctxMenuJustShown = true;
    requestAnimationFrame(() => { ctxMenuJustShown = false; });
  }

  // ===== Search =====
  if (personSearch) {
    personSearch.addEventListener('input', () => {
      state.searchQuery = personSearch.value.trim().toLowerCase();
      renderPersonList();
      render(); // Re-render to highlight matched persons on canvas
    });
  }

  if (btnToolText) {
    btnToolText.addEventListener('click', () => setToolActive('text'));
  }

  // ===== Schedule Bar Tool =====
  const btnToolScheduleBar = document.getElementById('btn-tool-scheduleBar');
  if (btnToolScheduleBar) {
    btnToolScheduleBar.addEventListener('click', () => setToolActive('scheduleBar'));
  }

  // Schedule Bar property change listeners
  function setupScheduleBarPropListeners() {
    const propBarLabel = document.getElementById('prop-bar-label');
    const propBarColor = document.getElementById('prop-bar-color');
    const propBarTip = document.getElementById('prop-bar-tipshape');
    const propBarW = document.getElementById('prop-bar-width');
    const propBarH = document.getElementById('prop-bar-height');

    function getSelectedBar() {
      if (state.selectedType !== 'scheduleBar') return null;
      return state.scheduleBars.find(b => b.id === state.selectedId);
    }

    if (propBarLabel) propBarLabel.addEventListener('input', () => {
      const bar = getSelectedBar();
      if (bar) { bar.label = propBarLabel.value; render(); saveState(); }
    });
    if (propBarColor) propBarColor.addEventListener('input', () => {
      const bar = getSelectedBar();
      if (bar) { bar.color = propBarColor.value; render(); saveState(); }
    });
    if (propBarTip) propBarTip.addEventListener('change', () => {
      const bar = getSelectedBar();
      if (bar) { pushUndo(); bar.tipShape = propBarTip.value; render(); saveState(); }
    });
    if (propBarW) propBarW.addEventListener('change', () => {
      const bar = getSelectedBar();
      if (bar) { pushUndo(); bar.w = Math.max(20, parseInt(propBarW.value) || 100); render(); saveState(); }
    });
    if (propBarH) propBarH.addEventListener('change', () => {
      const bar = getSelectedBar();
      if (bar) { pushUndo(); bar.h = Math.max(10, parseInt(propBarH.value) || 30); render(); saveState(); }
    });
  }
  setupScheduleBarPropListeners();

  // ===== Timeline Creation =====
  const menuCreateTimeline = document.getElementById('menu-create-timeline');
  const timelineModal = document.getElementById('timeline-modal');
  const tlModalCancel = document.getElementById('tl-modal-cancel');
  const tlModalCreate = document.getElementById('tl-modal-create');

  if (menuCreateTimeline) {
    menuCreateTimeline.addEventListener('click', () => {
      if (timelineModal) timelineModal.classList.add('show');
    });
  }
  if (tlModalCancel) {
    tlModalCancel.addEventListener('click', () => {
      if (timelineModal) timelineModal.classList.remove('show');
    });
  }
  if (tlModalCreate) {
    tlModalCreate.addEventListener('click', () => {
      const startYear = parseInt(document.getElementById('tl-modal-startYear').value) || 2026;
      const startMonth = parseInt(document.getElementById('tl-modal-startMonth').value) || 4;
      const monthCount = parseInt(document.getElementById('tl-modal-monthCount').value) || 12;
      const rowCount = parseInt(document.getElementById('tl-modal-rowCount').value) || 5;

      // Position at center of visible canvas area
      const canvasCenterX = (canvas.width / (window.devicePixelRatio || 1)) / 2;
      const canvasCenterY = (canvas.height / (window.devicePixelRatio || 1)) / 2;
      const worldCenter = screenToWorld(canvasCenterX, canvasCenterY);

      createTimeline({
        x: worldCenter.x - (80 * monthCount) / 2,
        y: worldCenter.y - 100,
        startYear,
        startMonth,
        monthCount,
        rowCount,
      });

      if (timelineModal) timelineModal.classList.remove('show');
      setToolActive('select');
    });
  }

  // Timeline property change listeners
  function setupTimelinePropListeners() {
    const fields = ['startYear', 'startMonth', 'monthCount', 'monthWidth', 'rowCount', 'rowHeight', 'fontSize'];
    fields.forEach(field => {
      const el = document.getElementById('prop-tl-' + field);
      if (el) {
        el.addEventListener('change', () => {
          if (state.selectedType !== 'timeline') return;
          const tl = state.timelines.find(t => t.id === state.selectedId);
          if (!tl) return;
          pushUndo();
          tl[field] = parseInt(el.value) || tl[field];
          render();
          saveState();
        });
      }
    });
  }
  setupTimelinePropListeners();

  // Shape property change listeners
  function setupShapePropListeners() {
    const numFields = ['borderWidth', 'fontSize', 'w', 'h'];
    const colorFields = ['color', 'borderColor', 'fontColor'];
    const allFields = [...numFields, ...colorFields, 'type', 'label', 'rotation', 'opacity'];
    allFields.forEach(field => {
      const el = document.getElementById('prop-shape-' + field);
      if (!el) return;
      const evtType = (el.type === 'color' || el.type === 'range' || el.tagName === 'SELECT') ? 'input' : 'change';
      el.addEventListener(evtType, () => {
        if (state.selectedType !== 'shape') return;
        const shape = state.shapes.find(s => s.id === state.selectedId);
        if (!shape) return;
        pushUndo();
        if (field === 'rotation') {
          shape.rotation = (parseFloat(el.value) || 0) * Math.PI / 180;
        } else if (field === 'opacity') {
          shape.opacity = parseFloat(el.value);
        } else if (field === 'type' || field === 'label') {
          shape[field] = el.value;
        } else if (colorFields.includes(field)) {
          shape[field] = el.value;
        } else {
          shape[field] = parseFloat(el.value) || shape[field];
        }
        render();
        saveState();
      });
    });
  }
  setupShapePropListeners();

  // Text annotation click on canvas
  canvas.addEventListener('click', (e) => {
    if (state.tool !== 'text') return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = screenToWorld(sx, sy);
    // Check if clicking an existing text annotation
    const existingText = state.textAnnotations.find(t => {
      const s = worldToScreen(t.x, t.y);
      const fontSize = (t.fontSize || 9) * state.zoom;
      const lines = (t.text || '').split('\n');
      const w = 150 * state.zoom;
      const h = lines.length * fontSize * 1.3;
      return sx >= s.x && sx <= s.x + w && sy >= s.y && sy <= s.y + h;
    });
    if (existingText) {
      selectItem('text', existingText.id);
    } else {
      pushUndo();
      const t = {
        id: state.nextId++,
        text: '注釈テキスト',
        x: world.x,
        y: world.y,
        fontSize: 9,
        color: '#2c3e50',
        layerId: state.activeLayerId,
      };
      state.textAnnotations.push(t);
      selectItem('text', t.id);
      saveState();
    }
  });

  // Text annotation property handlers
  if (propTextContent) {
    propTextContent.addEventListener('input', () => {
      const t = state.textAnnotations.find(t => t.id === state.selectedId);
      if (t) { t.text = propTextContent.value; saveState(); render(); }
    });
  }
  if (propTextFontsize) {
    propTextFontsize.addEventListener('change', () => {
      const t = state.textAnnotations.find(t => t.id === state.selectedId);
      if (t) { t.fontSize = parseInt(propTextFontsize.value) || 9; saveState(); render(); }
    });
  }
  if (propTextColor) {
    propTextColor.addEventListener('input', () => {
      const t = state.textAnnotations.find(t => t.id === state.selectedId);
      if (t) { t.color = propTextColor.value; saveState(); render(); }
    });
  }

  // ===== Dynamic Icon Dropdown =====
  function renderItemIconSelect() {
    const sel = document.getElementById('prop-item-icon');
    if (!sel) return;
    sel.innerHTML = '';
    ICON_CATEGORIES.forEach(cat => {
      const icons = ICON_REGISTRY.filter(e => e.category === cat.id);
      if (icons.length === 0) return;
      const og = document.createElement('optgroup');
      og.label = cat.label;
      icons.forEach(entry => {
        const opt = document.createElement('option');
        opt.value = entry.id;
        opt.textContent = entry.emoji + ' ' + entry.name;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    });
  }
  renderItemIconSelect();

  // ===== Item Property Handlers =====
  const propItemName = document.getElementById('prop-item-name');
  const propItemIcon = document.getElementById('prop-item-icon');
  const propItemDesc = document.getElementById('prop-item-description');
  const propItemColor = document.getElementById('prop-item-color');

  if (propItemName) {
    propItemName.addEventListener('input', () => {
      const p = state.persons.find(p => p.id === state.selectedId && p.itemType === 'item');
      if (p) { p.name = propItemName.value; renderPersonList(); saveState(); render(); }
    });
  }
  if (propItemIcon) {
    propItemIcon.addEventListener('change', () => {
      const p = state.persons.find(p => p.id === state.selectedId && p.itemType === 'item');
      if (p) { p.icon = propItemIcon.value; renderPersonList(); saveState(); render(); }
    });
  }
  if (propItemDesc) {
    propItemDesc.addEventListener('input', () => {
      const p = state.persons.find(p => p.id === state.selectedId && p.itemType === 'item');
      if (p) { p.description = propItemDesc.value; saveState(); }
    });
  }
  if (propItemColor) {
    propItemColor.addEventListener('input', () => {
      const p = state.persons.find(p => p.id === state.selectedId && p.itemType === 'item');
      if (p) { p.color = propItemColor.value; saveState(); render(); }
    });
  }

  // ===== Person Detail Field Handlers =====
  if (propEmail) {
    propEmail.addEventListener('input', () => {
      const p = state.persons.find(p => p.id === state.selectedId);
      if (p) { p.email = propEmail.value; saveState(); }
    });
  }
  if (propPhone) {
    propPhone.addEventListener('input', () => {
      const p = state.persons.find(p => p.id === state.selectedId);
      if (p) { p.phone = propPhone.value; saveState(); }
    });
  }
  if (propJoindate) {
    propJoindate.addEventListener('input', () => {
      const p = state.persons.find(p => p.id === state.selectedId);
      if (p) { p.joinDate = propJoindate.value; saveState(); }
    });
  }
  if (propEffectiveDate) {
    propEffectiveDate.addEventListener('input', () => {
      const p = state.persons.find(p => p.id === state.selectedId);
      if (p) { p.effectiveDate = propEffectiveDate.value; saveState(); }
    });
  }
  if (propPhotoUrl) {
    propPhotoUrl.addEventListener('input', () => {
      const p = state.persons.find(p => p.id === state.selectedId);
      if (p) { p.photoUrl = propPhotoUrl.value; saveState(); }
    });
  }

  // ===== Region Color Handler =====
  if (propRegionColor) {
    propRegionColor.addEventListener('input', () => {
      const r = state.regions.find(r => r.id === state.selectedId);
      if (r) { r.color = propRegionColor.value; saveState(); render(); renderPersonList(); }
    });
  }

  // ===== PNG Export =====
  if (btnExportPng) {
    btnExportPng.addEventListener('click', () => {
      // Create an offscreen canvas with white background
      const offCanvas = document.createElement('canvas');
      const scale = 2; // High-res
      offCanvas.width = canvas.width * scale / (window.devicePixelRatio || 1);
      offCanvas.height = canvas.height * scale / (window.devicePixelRatio || 1);
      const offCtx = offCanvas.getContext('2d');
      offCtx.scale(scale, scale);
      // White background
      offCtx.fillStyle = document.body.classList.contains('dark-mode') ? '#1a1a2e' : '#ffffff';
      offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
      // Draw the current canvas content
      offCtx.drawImage(canvas, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      // Download
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `orgchart_${timestamp}.png`;
      link.href = offCanvas.toDataURL('image/png');
      link.click();
    });
  }

  // ===== SVG Export =====
  function exportToSVG() {
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    const isDark = document.body.classList.contains('dark-mode');
    const bgColor = isDark ? '#1a1a2e' : '#ffffff';
    const gridColor = isDark ? 'rgba(100,120,180,0.15)' : 'rgba(173,198,230,0.3)';

    const els = []; // SVG element strings

    // Helper: escape XML
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // Helper: hex to rgba string
    const hexToRgba = (hex, a) => {
      const c = hex.replace('#','');
      const n = parseInt(c.length === 3 ? c[0]+c[0]+c[1]+c[1]+c[2]+c[2] : c, 16);
      return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
    };

    // Helper: build SVG path string from shape type (screen coords, centred at 0,0)
    function shapePathD(type, sw, sh) {
      const hw = sw / 2, hh = sh / 2;
      switch (type) {
        case 'rect': return `M${-hw},${-hh} h${sw} v${sh} h${-sw} Z`;
        case 'roundedRect': {
          const r = Math.min(sw, sh) * 0.15;
          return `M${-hw+r},${-hh} L${hw-r},${-hh} Q${hw},${-hh} ${hw},${-hh+r} L${hw},${hh-r} Q${hw},${hh} ${hw-r},${hh} L${-hw+r},${hh} Q${-hw},${hh} ${-hw},${hh-r} L${-hw},${-hh+r} Q${-hw},${-hh} ${-hw+r},${-hh} Z`;
        }
        case 'ellipse': return `M${-hw},0 A${hw},${hh} 0 1 0 ${hw},0 A${hw},${hh} 0 1 0 ${-hw},0 Z`;
        case 'triangle': return `M0,${-hh} L${hw},${hh} L${-hw},${hh} Z`;
        case 'diamond': return `M0,${-hh} L${hw},0 L0,${hh} L${-hw},0 Z`;
        case 'hexagon': {
          const pts = [];
          for (let i=0;i<6;i++){const a=Math.PI/180*(60*i-30);pts.push(`${hw*Math.cos(a)},${hh*Math.sin(a)}`);}
          return `M${pts.join('L')}Z`;
        }
        case 'pentagon': {
          const pts = [];
          for (let i=0;i<5;i++){const a=Math.PI/180*(72*i-90);pts.push(`${hw*Math.cos(a)},${hh*Math.sin(a)}`);}
          return `M${pts.join('L')}Z`;
        }
        case 'star': {
          const pts = [];
          for (let i=0;i<10;i++){const r2=i%2===0?1:0.4;const a=Math.PI/5*i-Math.PI/2;pts.push(`${hw*r2*Math.cos(a)},${hh*r2*Math.sin(a)}`);}
          return `M${pts.join('L')}Z`;
        }
        case 'arrow': {
          const tw = hw*0.35;
          return `M${-hw},${-hh*0.5} L${hw-tw},${-hh*0.5} L${hw-tw},${-hh} L${hw},0 L${hw-tw},${hh} L${hw-tw},${hh*0.5} L${-hw},${hh*0.5} Z`;
        }
        case 'chevronRight': return `M${-hw},${-hh} L${hw*0.5},${-hh} L${hw},0 L${hw*0.5},${hh} L${-hw},${hh} L${-hw*0.5},0 Z`;
        case 'chevronLeft':  return `M${hw},${-hh} L${-hw*0.5},${-hh} L${-hw},0 L${-hw*0.5},${hh} L${hw},${hh} L${hw*0.5},0 Z`;
        case 'callout': return `M${-hw},${-hh} L${hw},${-hh} L${hw},${hh*0.4} L${-hw*0.1},${hh*0.4} L${-hw*0.3},${hh} L${-hw*0.5},${hh*0.4} L${-hw},${hh*0.4} Z`;
        case 'cross': {
          const t = Math.min(sw,sh)*0.3;
          return `M${-t/2},${-hh} L${t/2},${-hh} L${t/2},${-t/2} L${hw},${-t/2} L${hw},${t/2} L${t/2},${t/2} L${t/2},${hh} L${-t/2},${hh} L${-t/2},${t/2} L${-hw},${t/2} L${-hw},${-t/2} L${-t/2},${-t/2} Z`;
        }
        case 'pill': {
          const r3 = hh;
          return `M${-hw+r3},${-hh} L${hw-r3},${-hh} Q${hw},${-hh} ${hw},0 Q${hw},${hh} ${hw-r3},${hh} L${-hw+r3},${hh} Q${-hw},${hh} ${-hw},0 Q${-hw},${-hh} ${-hw+r3},${-hh} Z`;
        }
        case 'parallelogram': {
          const sk = sw*0.2;
          return `M${-hw+sk},${-hh} L${hw},${-hh} L${hw-sk},${hh} L${-hw},${hh} Z`;
        }
        default: return `M${-hw},${-hh} h${sw} v${sh} h${-sw} Z`;
      }
    }

    // 1. Background
    els.push(`<rect width="${W}" height="${H}" fill="${bgColor}"/>`);

    // 2. Grid
    const gs = state.gridSize * state.zoom;
    const cx0 = W / 2 + state.canvasOffset.x;
    const cy0 = H / 3 + state.canvasOffset.y;
    const startGX = cx0 % gs;
    const startGY = cy0 % gs;
    if (gs > 4) {
      let gridLines = '';
      for (let x = startGX; x < W; x += gs) gridLines += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" stroke="${gridColor}" stroke-width="1"/>`;
      for (let y = startGY; y < H; y += gs) gridLines += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="${gridColor}" stroke-width="1"/>`;
      els.push(`<g id="grid">${gridLines}</g>`);
    }

    // 3. Regions
    const regionEls = [];
    state.regions.forEach(r => {
      if (!isOnVisibleLayer(r)) return;
      const s = worldToScreen(r.x, r.y);
      const e = worldToScreen(r.x + r.w, r.y + r.h);
      const rw = e.x - s.x, rh = e.y - s.y;
      const rc = r.color || '#4a8acf';
      regionEls.push(`<rect x="${s.x.toFixed(1)}" y="${s.y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${hexToRgba(rc,0.05)}" stroke="${hexToRgba(rc,0.6)}" stroke-width="1.5" stroke-dasharray="6,3"/>`);
      if (r.name) {
        const rAlign = r.textAlign || 'left';
        const svgAnchor = rAlign === 'center' ? 'middle' : rAlign === 'right' ? 'end' : 'start';
        let lx = s.x + 4;
        if (rAlign === 'center') lx = (s.x + e.x) / 2;
        else if (rAlign === 'right') lx = e.x - 4;
        const rFontSize = (r.fontSize || 13);
        regionEls.push(`<text x="${lx.toFixed(1)}" y="${(s.y - 3).toFixed(1)}" fill="${rc}" font-size="${rFontSize}" font-family="Segoe UI,Meiryo,sans-serif" text-anchor="${svgAnchor}">${esc(r.name)}</text>`);
      }
    });
    if (regionEls.length) els.push(`<g id="regions">${regionEls.join('')}</g>`);

    // 4. Timelines
    const tlEls = [];
    state.timelines.forEach(tl => {
      if (!isOnVisibleLayer(tl)) return;
      const monthW = (tl.monthWidth || 80) * state.zoom;
      const rowH = (tl.rowHeight || 30) * state.zoom;
      const rowCount = tl.rowCount || 5;
      const headerH = (tl.headerHeight || 50) * state.zoom;
      const monthCount = tl.monthCount || 12;
      const startYear = tl.startYear || 2026;
      const startMonth = tl.startMonth || 4;
      const origin = worldToScreen(tl.x, tl.y);
      const totalW = monthW * monthCount;
      const totalH = headerH + rowH * rowCount;
      const fontSize = tl.fontSize || 11;

      // Background row tints
      for (let m = 0; m < monthCount; m++) {
        const absMonth = startMonth + m;
        const q = Math.floor(((absMonth - 1) % 12) / 3);
        tlEls.push(`<rect x="${(origin.x+m*monthW).toFixed(1)}" y="${(origin.y+headerH).toFixed(1)}" width="${monthW.toFixed(1)}" height="${(rowH*rowCount).toFixed(1)}" fill="${QUARTER_COLORS[q]}" opacity="0.18"/>`);
      }

      // Year headers
      let curYear = startYear, yearStart = 0;
      for (let m = 0; m <= monthCount; m++) {
        const absMonth = startMonth + m;
        const yr = startYear + Math.floor((absMonth - 1) / 12);
        if (yr !== curYear || m === monthCount) {
          const x1 = origin.x + yearStart * monthW;
          const x2 = origin.x + m * monthW;
          tlEls.push(`<rect x="${x1.toFixed(1)}" y="${origin.y.toFixed(1)}" width="${(x2-x1).toFixed(1)}" height="${(headerH*0.45).toFixed(1)}" fill="#34495e"/>`);
          tlEls.push(`<text x="${((x1+x2)/2).toFixed(1)}" y="${(origin.y+headerH*0.22).toFixed(1)}" fill="#fff" font-size="${Math.max(10,(fontSize+2)*state.zoom)}" font-family="Segoe UI,Meiryo,sans-serif" text-anchor="middle" dominant-baseline="middle">${curYear}年</text>`);
          curYear = yr; yearStart = m;
        }
      }

      // Month headers
      for (let m = 0; m < monthCount; m++) {
        const absMonth = startMonth + m;
        const displayMonth = ((absMonth - 1) % 12) + 1;
        const q = Math.floor((displayMonth - 1) / 3);
        const mx = origin.x + m * monthW;
        tlEls.push(`<rect x="${mx.toFixed(1)}" y="${(origin.y+headerH*0.45).toFixed(1)}" width="${monthW.toFixed(1)}" height="${(headerH*0.55).toFixed(1)}" fill="${QUARTER_COLORS[q]}" opacity="0.63"/>`);
        tlEls.push(`<text x="${(mx+monthW/2).toFixed(1)}" y="${(origin.y+headerH*0.72).toFixed(1)}" fill="#2c3e50" font-size="${Math.max(9,fontSize*state.zoom)}" font-family="Segoe UI,Meiryo,sans-serif" text-anchor="middle" dominant-baseline="middle">${MONTH_NAMES_JA[displayMonth-1]}</text>`);
      }

      // Grid lines
      for (let m = 0; m <= monthCount; m++) {
        const absMonth = startMonth + m;
        const displayMonth = ((absMonth - 1) % 12) + 1;
        const lx = (origin.x + m * monthW).toFixed(1);
        const strokeColor = (displayMonth === 1 || m === 0) ? '#2c3e50' : (displayMonth === 4 || displayMonth === 7 || displayMonth === 10) ? '#7f8c8d' : '#bdc3c7';
        const sw2 = (displayMonth === 1 || m === 0) ? 2.5 : (displayMonth === 4 || displayMonth === 7 || displayMonth === 10) ? 1.5 : 0.5;
        const dash = (displayMonth !== 1 && m !== 0 && displayMonth !== 4 && displayMonth !== 7 && displayMonth !== 10) ? ' stroke-dasharray="4,4"' : '';
        tlEls.push(`<line x1="${lx}" y1="${(origin.y+headerH).toFixed(1)}" x2="${lx}" y2="${(origin.y+totalH).toFixed(1)}" stroke="${strokeColor}" stroke-width="${sw2}"${dash}/>`);
      }
      for (let r2 = 0; r2 <= rowCount; r2++) {
        const ry = (origin.y + headerH + r2 * rowH).toFixed(1);
        tlEls.push(`<line x1="${origin.x.toFixed(1)}" y1="${ry}" x2="${(origin.x+totalW).toFixed(1)}" y2="${ry}" stroke="#ddd" stroke-width="0.5"/>`);
      }

      // Outer border
      tlEls.push(`<rect x="${origin.x.toFixed(1)}" y="${origin.y.toFixed(1)}" width="${totalW.toFixed(1)}" height="${totalH.toFixed(1)}" fill="none" stroke="#34495e" stroke-width="1.5"/>`);
    });
    if (tlEls.length) els.push(`<g id="timelines">${tlEls.join('')}</g>`);

    // 5. Connectors
    const connEls = [];
    state.connectors.forEach(c => {
      if (!isOnVisibleLayer(c)) return;
      let points = [];
      if (c.freeForm) {
        const from = worldToScreen(c.fromX, c.fromY);
        const to = worldToScreen(c.toX, c.toY);
        const wps = (c.waypoints || []).map(w => worldToScreen(w.x, w.y));
        points = [from, ...wps, to];
      } else {
        const fromR = state.regions.find(r => r.id === c.fromRegionId);
        const toR = state.regions.find(r => r.id === c.toRegionId);
        if (!fromR || !toR) return;
        const from = getConnectionPoint(fromR, c.fromSide || 'right');
        const to = getConnectionPoint(toR, c.toSide || 'left');
        const wps = (c.waypoints || []).map(w => worldToScreen(w.x, w.y));
        points = routeConnector(from, to, c.fromSide || 'right', c.toSide || 'left', wps.length ? wps : null);
      }
      if (points.length < 2) return;
      const pStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      let markerEnd = '';
      if (c.direction === 'forward' || c.direction === 'both') markerEnd = ' marker-end="url(#arrowhead)"';
      let markerStart = '';
      if (c.direction === 'backward' || c.direction === 'both') markerStart = ' marker-start="url(#arrowhead-rev)"';
      connEls.push(`<polyline points="${pStr}" fill="none" stroke="#666" stroke-width="1.5"${markerEnd}${markerStart}/>`);
      if (c.label) {
        const mid = points[Math.floor(points.length / 2)];
        connEls.push(`<text x="${mid.x.toFixed(1)}" y="${(mid.y-6).toFixed(1)}" fill="#555" font-size="11" font-family="Segoe UI,Meiryo,sans-serif" text-anchor="middle">${esc(c.label)}</text>`);
      }
    });
    if (connEls.length) els.push(`<g id="connectors">${connEls.join('')}</g>`);

    // 6. Schedule Bars
    const barEls = [];
    state.scheduleBars.forEach(bar => {
      if (!isOnVisibleLayer(bar)) return;
      const s = worldToScreen(bar.x, bar.y);
      const e = worldToScreen(bar.x + bar.w, bar.y + bar.h);
      const sw3 = e.x - s.x, sh3 = e.y - s.y;
      if (sw3 < 1 || sh3 < 1) return;
      const tipW = Math.min(sh3 * 0.5, sw3 * 0.3);
      const bc = bar.color || '#4a8acf';
      let d = '';
      switch (bar.tipShape || 'chevron') {
        case 'chevron':       d = `M${s.x},${s.y} L${e.x-tipW},${s.y} L${e.x},${s.y+sh3/2} L${e.x-tipW},${e.y} L${s.x},${e.y} Z`; break;
        case 'doubleChevron': d = `M${s.x+tipW},${s.y} L${e.x-tipW},${s.y} L${e.x},${s.y+sh3/2} L${e.x-tipW},${e.y} L${s.x+tipW},${e.y} L${s.x},${s.y+sh3/2} Z`; break;
        case 'flat':          d = `M${s.x},${s.y} h${sw3} v${sh3} h${-sw3} Z`; break;
        case 'diamond': {const mcx=s.x+sw3/2,mcy=s.y+sh3/2; d=`M${mcx},${s.y} L${e.x},${mcy} L${mcx},${e.y} L${s.x},${mcy} Z`; break;}
        case 'arrow':         d = `M${s.x},${s.y} L${e.x-tipW},${s.y} L${e.x-tipW},${s.y-sh3*0.15} L${e.x},${s.y+sh3/2} L${e.x-tipW},${e.y+sh3*0.15} L${e.x-tipW},${e.y} L${s.x},${e.y} Z`; break;
        default:              d = `M${s.x},${s.y} h${sw3} v${sh3} h${-sw3} Z`;
      }
      barEls.push(`<path d="${d}" fill="${bc}" stroke="${darkenColor(bc,0.2)}" stroke-width="1"/>`);
      if (bar.label) {
        const contrastColor = getContrastColor(bc);
        barEls.push(`<text x="${(s.x+sw3/2).toFixed(1)}" y="${(s.y+sh3/2).toFixed(1)}" fill="${contrastColor}" font-size="${Math.min(sh3*0.6,14*state.zoom).toFixed(1)}" font-family="Segoe UI,Meiryo,sans-serif" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${esc(bar.label)}</text>`);
      }
    });
    if (barEls.length) els.push(`<g id="schedulebars">${barEls.join('')}</g>`);

    // 7. Shapes (15 types)
    const shapeEls = [];
    state.shapes.forEach(shape => {
      if (!isOnVisibleLayer(shape)) return;
      const scx = shape.x + shape.w / 2;
      const scy = shape.y + shape.h / 2;
      const origin = worldToScreen(scx, scy);
      const sw4 = shape.w * state.zoom;
      const sh4 = shape.h * state.zoom;
      const rot = shape.rotation || 0;
      const rotDeg = (rot * 180 / Math.PI).toFixed(2);
      const d = shapePathD(shape.type, sw4, sh4);
      const opacity = shape.opacity != null ? shape.opacity : 1;
      shapeEls.push(`<g transform="translate(${origin.x.toFixed(1)},${origin.y.toFixed(1)}) rotate(${rotDeg})" opacity="${opacity}"><path d="${d}" fill="${shape.color||'#4a90d9'}" stroke="${shape.borderColor||'#2c3e50'}" stroke-width="${shape.borderWidth||1}"/>${shape.label ? `<text fill="${shape.fontColor||'#ffffff'}" font-size="${Math.max(8,(shape.fontSize||12)*state.zoom)}" font-family="Segoe UI,Meiryo,sans-serif" text-anchor="middle" dominant-baseline="middle">${esc(shape.label)}</text>` : ''}</g>`);
    });
    if (shapeEls.length) els.push(`<g id="shapes">${shapeEls.join('')}</g>`);

    // 8. Text Annotations
    const textEls = [];
    state.textAnnotations.forEach(t => {
      if (!isOnVisibleLayer(t)) return;
      const s = worldToScreen(t.x, t.y);
      const fs = (t.fontSize || 9) * state.zoom;
      textEls.push(`<text x="${s.x.toFixed(1)}" y="${s.y.toFixed(1)}" fill="${t.color||'#2c3e50'}" font-size="${fs.toFixed(1)}" font-family="Segoe UI,Meiryo,sans-serif">${esc(t.text||'')}</text>`);
    });
    if (textEls.length) els.push(`<g id="text-annotations">${textEls.join('')}</g>`);

    // 9. Persons (simplified: circle head + triangle body + name)
    const personEls = [];
    const sortedPersons = [...state.persons].sort((a,b) => a.y - b.y);
    sortedPersons.forEach(p => {
      if (!isOnVisibleLayer(p)) return;
      const s = worldToScreen(p.x, p.y);
      const color = p.color || '#4a8acf';
      const headR = 9;
      const bodyH = 24, bodyW = 18;
      const bodyTop = s.y - bodyH * 0.35;
      const bodyBottom = s.y + bodyH * 0.5;
      const headCY = bodyTop + headR * 0.5;
      // Body triangle
      personEls.push(`<polygon points="${s.x},${bodyTop.toFixed(1)} ${(s.x+bodyW/2).toFixed(1)},${bodyBottom.toFixed(1)} ${(s.x-bodyW/2).toFixed(1)},${bodyBottom.toFixed(1)}" fill="${color}" stroke="${darkenColor(color,0.35)}" stroke-width="1"/>`);
      // Head circle
      personEls.push(`<circle cx="${s.x.toFixed(1)}" cy="${headCY.toFixed(1)}" r="${headR}" fill="${color}" stroke="${darkenColor(color,0.35)}" stroke-width="1"/>`);
      // Name
      if (p.name) {
        personEls.push(`<text x="${s.x.toFixed(1)}" y="${(bodyBottom+16).toFixed(1)}" fill="#2c3e50" font-size="13" font-family="Segoe UI,Meiryo,sans-serif" text-anchor="middle">${esc(p.name)}</text>`);
      }
    });
    if (personEls.length) els.push(`<g id="persons">${personEls.join('')}</g>`);

    // Build final SVG
    const defs = `<defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#666"/>
      </marker>
      <marker id="arrowhead-rev" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto-start-reverse">
        <polygon points="0 0, 8 3, 0 6" fill="#666"/>
      </marker>
    </defs>`;
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs}
${els.join('\n')}
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `orgchart_${timestamp}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const btnExportSvg = document.getElementById('btn-export-svg');
  if (btnExportSvg) {
    btnExportSvg.addEventListener('click', exportToSVG);
  }

  // ===== CSV Import =====
  if (btnImportCsv && csvImportInput) {
    btnImportCsv.addEventListener('click', () => csvImportInput.click());
    csvImportInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const sep = text.includes('\t') ? '\t' : ',';
        pushUndo();
        const affMap = {};
        lines.forEach((line, idx) => {
          const parts = line.split(sep).map(s => s.trim().replace(/^["']|["']$/g, ''));
          if (parts.length < 2) return;
          const aff = parts[0];
          const name = parts[1];
          const email = parts[2] || '';
          const phone = parts[3] || '';
          if (!affMap[aff]) {
            const regionW = 250;
            const regionH = 150;
            const col = Object.keys(affMap).length;
            const rx = col * (regionW + 40) - 200;
            const ry = -50;
            const region = { id: state.nextId++, name: aff, x: rx, y: ry, w: regionW, h: regionH, color: '#4a8acf' };
            state.regions.push(region);
            affMap[aff] = { region, count: 0 };
          }
          const info = affMap[aff];
          const px = info.region.x + 30 + (info.count % 5) * 45;
          const py = info.region.y + 40 + Math.floor(info.count / 5) * 55;
          addPerson(name, { affiliation: aff, x: px, y: py, email, phone });
          info.count++;
        });
        renderPersonList();
        saveState();
        render();
      };
      reader.readAsText(file);
      csvImportInput.value = '';
    });
  }

  // ===== Print =====
  if (btnPrint) {
    btnPrint.addEventListener('click', () => window.print());
  }

  // ===== Dark Mode =====
  if (btnDarkMode) {
    // Restore dark mode from localStorage
    if (localStorage.getItem('orgchart-darkmode') === 'true') {
      document.body.classList.add('dark-mode');
      btnDarkMode.textContent = '☀️';
    }
    btnDarkMode.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      btnDarkMode.textContent = isDark ? '☀️' : '🌙';
      localStorage.setItem('orgchart-darkmode', isDark);
      render();
    });
  }

  // ===== Share URL =====
  if (btnShareUrl) {
    btnShareUrl.addEventListener('click', () => {
      try {
        const data = {
          persons: state.persons,
          regions: state.regions,
          roles: state.roles,
          connectors: state.connectors,
          textAnnotations: state.textAnnotations,
          nextId: state.nextId,
        };
        const json = JSON.stringify(data);
        const encoded = btoa(unescape(encodeURIComponent(json)));
        const url = window.location.href.split('#')[0] + '#data=' + encoded;
        navigator.clipboard.writeText(url).then(() => {
          alert('共有URLをクリップボードにコピーしました！\n（データサイズが大きいとURLが長くなります）');
        }).catch(() => {
          prompt('共有URLをコピーしてください:', url);
        });
      } catch (e) {
        alert('共有URLの生成に失敗しました: ' + e.message);
      }
    });
  }

  // Load from shared URL on init
  function loadFromUrl() {
    const hash = window.location.hash;
    if (hash.startsWith('#data=')) {
      try {
        const encoded = hash.slice(6);
        const json = decodeURIComponent(escape(atob(encoded)));
        const data = JSON.parse(json);
        if (data.persons) state.persons = data.persons;
        if (data.regions) state.regions = data.regions;
        if (data.roles) state.roles = data.roles;
        if (data.connectors) state.connectors = data.connectors;
        if (data.textAnnotations) state.textAnnotations = data.textAnnotations;
        if (data.nextId) state.nextId = data.nextId;
        state.persons.forEach(migrateResource);
        saveState();
        renderPersonList();
        render();
        // Clear hash after loading
        history.replaceState(null, '', window.location.pathname);
      } catch (e) { /* ignore invalid URL data */ }
    }
  }

  // ===== Delete text annotations in deleteSelected =====
  const origDeleteSelected = deleteSelected;
  // Patch deleteSelected to handle text annotations
  // (already handles person/region/connector; need to add text)

  // ===== Layer Management =====
  const layerListEl = document.getElementById('layer-list');
  const btnAddLayer = document.getElementById('btn-add-layer');

  function isOnVisibleLayer(obj) {
    if (!obj.layerId) return true; // objects without layerId are always visible (backward compat)
    const layer = state.layers.find(l => l.id === obj.layerId);
    return layer ? layer.visible : true;
  }

  function isOnLockedLayer(obj) {
    if (!obj.layerId) return false;
    const layer = state.layers.find(l => l.id === obj.layerId);
    return layer ? layer.locked : false;
  }

  function renderLayerList() {
    if (!layerListEl) return;
    layerListEl.innerHTML = '';
    state.layers.forEach(layer => {
      const item = document.createElement('div');
      item.className = 'layer-item' + (layer.id === state.activeLayerId ? ' active' : '');
      
      const visBtn = document.createElement('button');
      visBtn.className = 'layer-toggle' + (layer.visible ? '' : ' off');
      visBtn.textContent = layer.visible ? '👁' : '👁‍🗨';
      visBtn.title = layer.visible ? '非表示にする' : '表示する';
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        saveState();
        renderLayerList();
        render();
      });

      const lockBtn = document.createElement('button');
      lockBtn.className = 'layer-toggle' + (layer.locked ? '' : ' off');
      lockBtn.textContent = layer.locked ? '🔒' : '🔓';
      lockBtn.title = layer.locked ? 'ロック解除' : 'ロック';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.locked = !layer.locked;
        saveState();
        renderLayerList();
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'layer-name';
      nameSpan.textContent = layer.name;
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.className = 'layer-name-input';
        input.value = layer.name;
        input.addEventListener('blur', () => {
          layer.name = input.value || layer.name;
          saveState();
          renderLayerList();
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') input.blur();
        });
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
      });

      // Delete button (only if more than 1 layer)
      const delBtn = document.createElement('button');
      delBtn.className = 'layer-toggle';
      delBtn.textContent = '✕';
      delBtn.title = 'レイヤーを削除';
      delBtn.style.fontSize = '10px';
      if (state.layers.length <= 1) delBtn.style.display = 'none';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.layers.length <= 1) return;
        if (!confirm(`レイヤー「${layer.name}」を削除しますか？含まれるオブジェクトも削除されます。`)) return;
        pushUndo();
        // Remove objects on this layer
        state.persons = state.persons.filter(p => p.layerId !== layer.id);
        state.regions = state.regions.filter(r => r.layerId !== layer.id);
        state.connectors = state.connectors.filter(c => c.layerId !== layer.id);
        state.textAnnotations = state.textAnnotations.filter(t => t.layerId !== layer.id);
        state.layers = state.layers.filter(l => l.id !== layer.id);
        if (state.activeLayerId === layer.id) {
          state.activeLayerId = state.layers[0].id;
        }
        clearSelection();
        saveState();
        renderLayerList();
        renderPersonList();
        render();
      });

      item.addEventListener('click', () => {
        state.activeLayerId = layer.id;
        renderLayerList();
      });

      item.appendChild(visBtn);
      item.appendChild(lockBtn);
      item.appendChild(nameSpan);
      item.appendChild(delBtn);
      layerListEl.appendChild(item);
    });
  }

  if (btnAddLayer) {
    btnAddLayer.addEventListener('click', () => {
      const newId = state.nextId++;
      state.layers.push({ id: newId, name: `レイヤー ${state.layers.length + 1}`, visible: true, locked: false });
      state.activeLayerId = newId;
      saveState();
      renderLayerList();
    });
  }

  // ===== Layer Assign Event =====
  const propLayerAssignEl = document.getElementById('prop-layer-assign');
  if (propLayerAssignEl) {
    propLayerAssignEl.addEventListener('change', () => {
      const newLayerId = parseInt(propLayerAssignEl.value);
      if (isNaN(newLayerId)) return;
      // Apply to single selected object
      let obj = null;
      if (state.selectedType === 'person') obj = state.persons.find(p => p.id === state.selectedId);
      else if (state.selectedType === 'region') obj = state.regions.find(r => r.id === state.selectedId);
      else if (state.selectedType === 'connector') obj = state.connectors.find(c => c.id === state.selectedId);
      else if (state.selectedType === 'text') obj = state.textAnnotations.find(t => t.id === state.selectedId);
      if (obj) {
        pushUndo();
        obj.layerId = newLayerId;
        saveState();
        render();
      }
    });
  }

  // ===== Tab Management =====
  const tabListEl = document.getElementById('tab-list');
  const btnAddTab = document.getElementById('btn-add-tab');

  function getTabData() {
    return {
      persons: JSON.parse(JSON.stringify(state.persons)),
      regions: JSON.parse(JSON.stringify(state.regions)),
      connectors: JSON.parse(JSON.stringify(state.connectors)),
      textAnnotations: JSON.parse(JSON.stringify(state.textAnnotations)),
      scheduleBars: JSON.parse(JSON.stringify(state.scheduleBars)),
      timelines: JSON.parse(JSON.stringify(state.timelines)),
      shapes: JSON.parse(JSON.stringify(state.shapes)),
      layers: JSON.parse(JSON.stringify(state.layers)),
      activeLayerId: state.activeLayerId,
      canvasOffset: { ...state.canvasOffset },
      zoom: state.zoom,
    };
  }

  function loadTabData(tabData) {
    state.persons = tabData.persons || [];
    state.regions = tabData.regions || [];
    state.connectors = tabData.connectors || [];
    state.textAnnotations = tabData.textAnnotations || [];
    state.scheduleBars = tabData.scheduleBars || [];
    state.timelines = tabData.timelines || [];
    state.shapes = tabData.shapes || [];
    state.layers = tabData.layers || [{ id: 1, name: 'メイン', visible: true, locked: false }];
    state.activeLayerId = tabData.activeLayerId || (state.layers[0] ? state.layers[0].id : 1);
    state.canvasOffset = tabData.canvasOffset || { x: 0, y: 0 };
    state.zoom = tabData.zoom || 1.0;
    state.persons.forEach(p => { if (!p.roleIds) p.roleIds = []; });
    clearSelection();
    state.multiSelection = { personIds: [], regionIds: [], textIds: [], connectorIds: [], scheduleBarIds: [], shapeIds: [] };
    updateZoomLabel();
    renderPersonList();
    renderLayerList();
    render();
  }

  function saveCurrentTabData() {
    if (state.activeTabId === null) return;
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (tab) {
      tab.data = getTabData();
    }
  }

  function switchTab(tabId) {
    if (tabId === state.activeTabId) return;
    saveCurrentTabData();
    state.activeTabId = tabId;
    const tab = state.tabs.find(t => t.id === tabId);
    if (tab && tab.data) {
      loadTabData(tab.data);
    }
    saveState();
    renderTabList();
  }

  function initTabs() {
    if (state.tabs.length === 0) {
      const tabId = state.nextId++;
      const tab = { id: tabId, name: 'メイン', data: getTabData() };
      state.tabs.push(tab);
      state.activeTabId = tabId;
    }
  }

  function renderTabList() {
    if (!tabListEl) return;
    tabListEl.innerHTML = '';
    state.tabs.forEach(tab => {
      const item = document.createElement('div');
      item.className = 'tab-item' + (tab.id === state.activeTabId ? ' active' : '');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tab-name';
      nameSpan.textContent = tab.name;
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.style.cssText = 'font-size:12px;padding:1px 4px;border:1px solid var(--primary-color);border-radius:3px;outline:none;width:80px;';
        input.value = tab.name;
        input.addEventListener('blur', () => {
          tab.name = input.value || tab.name;
          saveState();
          renderTabList();
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') input.blur();
        });
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
      });

      item.addEventListener('click', () => switchTab(tab.id));

      item.appendChild(nameSpan);

      if (state.tabs.length > 1) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '✕';
        closeBtn.title = 'タブを閉じる';
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.tabs.length <= 1) return;
          if (!confirm(`タブ「${tab.name}」を削除しますか？`)) return;
          pushUndo();
          state.tabs = state.tabs.filter(t => t.id !== tab.id);
          if (state.activeTabId === tab.id) {
            state.activeTabId = state.tabs[0].id;
            loadTabData(state.tabs[0].data);
          }
          saveState();
          renderTabList();
        });
        item.appendChild(closeBtn);
      }

      tabListEl.appendChild(item);
    });
  }

  if (btnAddTab) {
    btnAddTab.addEventListener('click', () => {
      saveCurrentTabData();
      const newId = state.nextId++;
      const newTab = {
        id: newId,
        name: `タブ ${state.tabs.length + 1}`,
        data: {
          persons: [],
          regions: [],
          connectors: [],
          textAnnotations: [],
          layers: [{ id: state.nextId++, name: 'メイン', visible: true, locked: false }],
          activeLayerId: state.nextId - 1,
          canvasOffset: { x: 0, y: 0 },
          zoom: 1.0,
        },
      };
      state.tabs.push(newTab);
      state.activeTabId = newId;
      loadTabData(newTab.data);
      saveState();
      renderTabList();
    });
  }

  // ===== Menu Bar =====
  function setupMenuBar() {
    // Helper: proxy menu click to existing button
    function proxyClick(menuId, btnId) {
      const menu = document.getElementById(menuId);
      const btn = document.getElementById(btnId);
      if (menu && btn) menu.addEventListener('click', () => btn.click());
    }

    // File menu
    proxyClick('menu-save', 'btn-save-file');
    proxyClick('menu-load', 'btn-load-file');
    proxyClick('menu-import-csv', 'btn-import-csv');
    proxyClick('menu-export-png', 'btn-export-png');
    proxyClick('menu-export-svg', 'btn-export-svg');
    proxyClick('menu-print', 'btn-print');
    proxyClick('menu-share-url', 'btn-share-url');

    // CSV export from dashboard
    const menuExportCsv = document.getElementById('menu-export-csv');
    if (menuExportCsv) {
      menuExportCsv.addEventListener('click', () => {
        const dashExport = document.getElementById('dashboard-btn-export-csv');
        if (dashExport) dashExport.click();
      });
    }

    // Edit menu
    proxyClick('menu-undo', 'btn-undo');
    proxyClick('menu-redo', 'btn-redo');
    proxyClick('menu-delete', 'btn-delete');
    const menuSelectAll = document.getElementById('menu-select-all');
    if (menuSelectAll) {
      menuSelectAll.addEventListener('click', () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));
      });
    }

    // View menu
    proxyClick('menu-square-view', 'btn-square-view');
    proxyClick('menu-quarter-view', 'btn-quarter-view');
    proxyClick('menu-zoom-reset', 'btn-zoom-reset');
    proxyClick('menu-dark-mode', 'btn-dark-mode');

    // Panel toggles
    const sidebarLeft = document.getElementById('sidebar-left');
    const sidebarRight = document.getElementById('sidebar-right');

    function togglePanel(panel) {
      if (!panel) return;
      if (panel.style.display === 'none') {
        panel.style.display = 'flex';
      } else {
        panel.style.display = 'none';
      }
    }

    const menuToggleSidebar = document.getElementById('menu-toggle-sidebar');
    if (menuToggleSidebar) {
      menuToggleSidebar.addEventListener('click', () => togglePanel(sidebarLeft));
    }
    const menuToggleProperty = document.getElementById('menu-toggle-property');
    if (menuToggleProperty) {
      menuToggleProperty.addEventListener('click', () => togglePanel(sidebarRight));
    }

    // Toolbar panel toggles
    const btnToggleSidebarTb = document.getElementById('btn-toggle-sidebar-tb');
    if (btnToggleSidebarTb) {
      btnToggleSidebarTb.addEventListener('click', () => togglePanel(sidebarLeft));
    }
    const btnTogglePropertyTb = document.getElementById('btn-toggle-property-tb');
    if (btnTogglePropertyTb) {
      btnTogglePropertyTb.addEventListener('click', () => togglePanel(sidebarRight));
    }

    // Close buttons
    const sidebarLeftClose = document.getElementById('sidebar-left-close');
    if (sidebarLeftClose) {
      sidebarLeftClose.addEventListener('click', () => { sidebarLeft.style.display = 'none'; });
    }
    const sidebarRightClose = document.getElementById('sidebar-right-close');
    if (sidebarRightClose) {
      sidebarRightClose.addEventListener('click', () => { sidebarRight.style.display = 'none'; });
    }

    // Drag floating panels
    function makeDraggable(panel) {
      const titlebar = panel.querySelector('.floating-panel-titlebar');
      if (!titlebar) return;
      let isDragging = false, startX, startY, origLeft, origTop;
      titlebar.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        origLeft = rect.left;
        origTop = rect.top;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = (origLeft + e.clientX - startX) + 'px';
        panel.style.top = (origTop + e.clientY - startY) + 'px';
      });
      document.addEventListener('mouseup', () => { isDragging = false; });
    }
    if (sidebarLeft) makeDraggable(sidebarLeft);
    if (sidebarRight) makeDraggable(sidebarRight);

    // Resource menu
    const menuAddPerson = document.getElementById('menu-add-person');
    if (menuAddPerson) {
      menuAddPerson.addEventListener('click', () => {
        document.getElementById('btn-add-person')?.click();
      });
    }
    const menuAddItem = document.getElementById('menu-add-item');
    if (menuAddItem) {
      menuAddItem.addEventListener('click', () => {
        document.getElementById('btn-add-item')?.click();
      });
    }
    proxyClick('menu-bulk-create', 'btn-bulk-create');
    proxyClick('menu-role-manage', 'btn-role-manage');
    proxyClick('menu-plan-table', 'btn-plan-table');
    proxyClick('menu-dashboard', 'btn-dashboard');

    // Timeline creation
    const menuTL = document.getElementById('menu-create-timeline');
    if (menuTL) {
      menuTL.addEventListener('click', () => {
        const tlModal = document.getElementById('timeline-modal');
        if (tlModal) tlModal.classList.add('show');
      });
    }
  }

  // ===== Dashboard (#22-#26) =====
  function setupDashboard() {
    const btnDash = document.getElementById('btn-dashboard');
    const dashModal = document.getElementById('dashboard-modal');
    const dashContent = document.getElementById('dashboard-content');
    const dashBtnClose = document.getElementById('dashboard-btn-close');
    const dashBtnExport = document.getElementById('dashboard-btn-export-csv');
    if (!btnDash || !dashModal) return;

    btnDash.addEventListener('click', () => {
      renderDashboard();
      dashModal.classList.add('show');
    });
    dashBtnClose.addEventListener('click', () => dashModal.classList.remove('show'));
    dashModal.addEventListener('click', (e) => { if (e.target === dashModal) dashModal.classList.remove('show'); });

    // #24: CSV Export
    dashBtnExport.addEventListener('click', () => {
      const persons = state.persons;
      const lines = ['名前,種別,容量,単位,単価,配分率(%),配分先,コスト'];
      persons.forEach(p => {
        const totalAlloc = getAllocationTotal(p);
        const targets = (p.allocations || []).map(a => {
          const r = state.regions.find(r => r.id === a.targetId);
          return (r ? r.name : '未指定') + '(' + Math.round((a.ratio || 0) * 100) + '%)';
        }).join('; ');
        const cost = (p.costPerUnit || 0) * totalAlloc;
        lines.push(`"${p.name}","${p.itemType === 'item' ? '物的' : '人的'}",${p.capacity || 0},"${p.unit || ''}",${p.costPerUnit || 0},${Math.round(totalAlloc * 100)},"${targets}",${Math.round(cost)}`);
      });
      const csv = '\uFEFF' + lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stractal_report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

    function renderDashboard() {
      const persons = state.persons;
      const regions = state.regions;
      const humanRes = persons.filter(p => p.itemType !== 'item');
      const itemRes = persons.filter(p => p.itemType === 'item');

      // Calculate totals
      let totalCost = 0, overAllocCount = 0, unallocCount = 0;
      const alerts = [];
      persons.forEach(p => {
        const total = getAllocationTotal(p);
        totalCost += (p.costPerUnit || 0) * total;
        if (total > 1.0) { overAllocCount++; alerts.push({ type: 'danger', msg: `⚠ ${p.name}: 配分率 ${Math.round(total * 100)}% (超過)` }); }
        if (total === 0 && p.capacity > 0) { unallocCount++; alerts.push({ type: 'warning', msg: `💤 ${p.name}: 未配分 (容量: ${p.capacity}${p.unit || ''})` }); }
      });

      let html = '';

      // #22: KPI Cards
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">';
      html += kpiCard('👥 人的リソース', humanRes.length + '名', '#3498db');
      html += kpiCard('📦 物的リソース', itemRes.length + '件', '#2ecc71');
      html += kpiCard('🏢 リージョン', regions.length + '件', '#9b59b6');
      html += kpiCard('💰 月間コスト', '¥' + Math.round(totalCost).toLocaleString(), '#e67e22');
      html += kpiCard('⚠ 超過', overAllocCount + '件', overAllocCount > 0 ? '#e74c3c' : '#27ae60');
      html += kpiCard('💤 未配分', unallocCount + '件', unallocCount > 0 ? '#f39c12' : '#27ae60');
      html += '</div>';

      // #26: Alerts
      if (alerts.length > 0) {
        html += '<div style="margin-bottom:16px;max-height:120px;overflow-y:auto;border:1px solid #eee;border-radius:6px;padding:8px;">';
        html += '<div style="font-weight:bold;font-size:12px;margin-bottom:4px;">🔔 アラート</div>';
        alerts.forEach(a => {
          const bg = a.type === 'danger' ? '#fde8e8' : '#fef3cd';
          const border = a.type === 'danger' ? '#e74c3c' : '#f39c12';
          html += `<div style="padding:4px 8px;margin:2px 0;background:${bg};border-left:3px solid ${border};border-radius:3px;font-size:11px;">${a.msg}</div>`;
        });
        html += '</div>';
      }

      // #23: Utilization Chart
      html += '<div style="margin-bottom:16px;">';
      html += '<div style="font-weight:bold;font-size:13px;margin-bottom:8px;">📊 リソース稼働率</div>';
      html += '<div style="display:flex;flex-direction:column;gap:4px;">';
      persons.forEach(p => {
        const total = getAllocationTotal(p);
        const pct = Math.round(total * 100);
        const barColor = pct > 100 ? '#e74c3c' : pct > 80 ? '#f39c12' : pct > 0 ? '#3498db' : '#bdc3c7';
        html += `<div style="display:flex;align-items:center;gap:6px;font-size:11px;">`;
        html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0;"></span>`;
        html += `<span style="width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;">${p.name}</span>`;
        html += `<div style="flex:1;background:#e0e0e0;height:14px;border-radius:3px;overflow:hidden;position:relative;">`;
        html += `<div style="height:100%;width:${Math.min(pct, 100)}%;background:${barColor};border-radius:3px;transition:width 0.3s;"></div>`;
        if (pct > 100) html += `<div style="position:absolute;top:0;left:0;width:100%;height:100%;border:2px solid #e74c3c;border-radius:3px;"></div>`;
        html += `</div>`;
        html += `<span style="width:40px;text-align:right;font-weight:bold;color:${barColor};">${pct}%</span>`;
        html += `</div>`;
      });
      html += '</div></div>';

      // #25: Region Cost Analysis
      html += '<div style="margin-bottom:16px;">';
      html += '<div style="font-weight:bold;font-size:13px;margin-bottom:8px;">🏢 リージョン別コスト分析</div>';
      html += '<table style="border-collapse:collapse;width:100%;font-size:11px;">';
      html += '<thead><tr style="background:#f0f4f8;"><th style="border:1px solid #ddd;padding:4px 8px;text-align:left;">リージョン</th>';
      html += '<th style="border:1px solid #ddd;padding:4px;text-align:center;">人的</th>';
      html += '<th style="border:1px solid #ddd;padding:4px;text-align:center;">物的</th>';
      html += '<th style="border:1px solid #ddd;padding:4px;text-align:right;">月間コスト</th>';
      html += '</tr></thead><tbody>';
      let regionTotal = 0;
      regions.forEach(r => {
        const summary = getRegionResourceSummary(r.id);
        regionTotal += summary.totalCost;
        html += `<tr>`;
        html += `<td style="border:1px solid #ddd;padding:4px 8px;font-weight:bold;">${r.name || '無名'}</td>`;
        html += `<td style="border:1px solid #ddd;padding:4px;text-align:center;">${summary.humanUnits.toFixed(1)}${summary.humanUnit}</td>`;
        html += `<td style="border:1px solid #ddd;padding:4px;text-align:center;">${summary.itemUnits.toFixed(0)}${summary.itemUnit}</td>`;
        html += `<td style="border:1px solid #ddd;padding:4px;text-align:right;">¥${Math.round(summary.totalCost).toLocaleString()}</td>`;
        html += `</tr>`;
      });
      html += `<tr style="background:#f0f4f8;font-weight:bold;"><td style="border:1px solid #ddd;padding:4px 8px;">合計</td>`;
      html += `<td style="border:1px solid #ddd;padding:4px;" colspan="2"></td>`;
      html += `<td style="border:1px solid #ddd;padding:4px;text-align:right;">¥${Math.round(regionTotal).toLocaleString()}</td></tr>`;
      html += '</tbody></table></div>';

      dashContent.innerHTML = html;
    }

    function kpiCard(label, value, color) {
      return `<div style="background:linear-gradient(135deg,${color}11,${color}22);border:1px solid ${color}33;border-radius:8px;padding:12px;text-align:center;">` +
        `<div style="font-size:11px;color:#666;margin-bottom:4px;">${label}</div>` +
        `<div style="font-size:20px;font-weight:bold;color:${color};">${value}</div></div>`;
    }
  }

  // ===== Resource Plan Table (#19/#20/#21) =====
  function setupPlanTable() {
    const btnPlan = document.getElementById('btn-plan-table');
    const planModal = document.getElementById('plan-modal');
    const planStart = document.getElementById('plan-start');
    const planCount = document.getElementById('plan-count');
    const planUnit = document.getElementById('plan-unit');
    const planBtnApply = document.getElementById('plan-btn-apply');
    const planBtnClose = document.getElementById('plan-btn-close');
    const planContainer = document.getElementById('plan-table-container');
    if (!btnPlan || !planModal) return;

    btnPlan.addEventListener('click', () => {
      planStart.value = state.planConfig.startDate;
      planCount.value = state.planConfig.periodCount;
      planUnit.value = state.planConfig.periodUnit;
      renderPlanTable();
      planModal.classList.add('show');
    });

    planBtnClose.addEventListener('click', () => planModal.classList.remove('show'));
    planModal.addEventListener('click', (e) => { if (e.target === planModal) planModal.classList.remove('show'); });

    planBtnApply.addEventListener('click', () => {
      state.planConfig.startDate = planStart.value;
      state.planConfig.periodCount = parseInt(planCount.value) || 12;
      state.planConfig.periodUnit = planUnit.value;
      saveState();
      renderPlanTable();
    });

    function renderPlanTable() {
      const labels = generatePeriodLabels();
      const resources = state.persons.filter(p => p.allocations && p.allocations.length > 0 || p.capacity > 0);
      const regions = state.regions;

      let html = '<table style="border-collapse:collapse;width:100%;font-size:11px;">';
      // Header
      html += '<thead><tr style="background:#f0f4f8;position:sticky;top:0;z-index:1;">';
      html += '<th style="border:1px solid #ddd;padding:4px 8px;text-align:left;min-width:120px;position:sticky;left:0;background:#f0f4f8;z-index:2;">リソース</th>';
      html += '<th style="border:1px solid #ddd;padding:4px;text-align:center;width:50px;">容量</th>';
      html += '<th style="border:1px solid #ddd;padding:4px;text-align:center;width:50px;">単位</th>';
      html += '<th style="border:1px solid #ddd;padding:4px;text-align:center;width:70px;">単価</th>';
      labels.forEach(l => {
        html += `<th style="border:1px solid #ddd;padding:4px;text-align:center;min-width:60px;white-space:nowrap;">${l}</th>`;
      });
      html += '<th style="border:1px solid #ddd;padding:4px;text-align:center;width:60px;">平均%</th>';
      html += '<th style="border:1px solid #ddd;padding:4px;text-align:center;width:80px;">合計コスト</th>';
      html += '</tr></thead><tbody>';

      // Resource rows
      const periodTotals = labels.map(() => ({ units: 0, cost: 0 }));
      let grandTotalCost = 0;

      resources.forEach(p => {
        const totalAlloc = getAllocationTotal(p);
        const overrides = p.periodOverrides || {};
        html += '<tr>';
        html += `<td style="border:1px solid #ddd;padding:4px 8px;position:sticky;left:0;background:#fff;font-weight:bold;white-space:nowrap;">`;
        html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px;"></span>`;
        html += `${p.name}</td>`;
        html += `<td style="border:1px solid #ddd;padding:4px;text-align:center;">${p.capacity || 0}</td>`;
        html += `<td style="border:1px solid #ddd;padding:4px;text-align:center;">${p.unit || ''}</td>`;
        html += `<td style="border:1px solid #ddd;padding:4px;text-align:right;">¥${(p.costPerUnit || 0).toLocaleString()}</td>`;

        let rowTotal = 0;
        let rowCost = 0;
        labels.forEach((label, pi) => {
          const override = overrides[label];
          const ratio = override !== undefined ? override / 100 : totalAlloc;
          const pct = Math.round(ratio * 100);
          const cellCost = (p.costPerUnit || 0) * ratio;
          rowTotal += pct;
          rowCost += cellCost;
          periodTotals[pi].units += (p.capacity || 0) * ratio;
          periodTotals[pi].cost += cellCost;

          const bgColor = pct > 100 ? '#fde8e8' : pct > 80 ? '#fef3cd' : pct > 0 ? '#e8f5e9' : '#fff';
          html += `<td style="border:1px solid #ddd;padding:2px;text-align:center;background:${bgColor};">`;
          html += `<input type="number" min="0" max="200" step="5" value="${pct}" `;
          html += `data-person-id="${p.id}" data-period="${label}" `;
          html += `style="width:40px;font-size:10px;text-align:center;border:1px solid #ddd;border-radius:2px;padding:1px;" `;
          html += `class="plan-cell-input">`;
          html += '</td>';
        });

        const avgPct = labels.length > 0 ? Math.round(rowTotal / labels.length) : 0;
        grandTotalCost += rowCost;
        html += `<td style="border:1px solid #ddd;padding:4px;text-align:center;font-weight:bold;">${avgPct}%</td>`;
        html += `<td style="border:1px solid #ddd;padding:4px;text-align:right;">¥${Math.round(rowCost).toLocaleString()}</td>`;
        html += '</tr>';
      });

      // Totals row
      html += '<tr style="background:#f0f4f8;font-weight:bold;">';
      html += '<td style="border:1px solid #ddd;padding:4px 8px;position:sticky;left:0;background:#f0f4f8;" colspan="4">合計</td>';
      periodTotals.forEach(pt => {
        html += `<td style="border:1px solid #ddd;padding:4px;text-align:center;">¥${Math.round(pt.cost).toLocaleString()}</td>`;
      });
      html += `<td style="border:1px solid #ddd;padding:4px;text-align:center;">-</td>`;
      html += `<td style="border:1px solid #ddd;padding:4px;text-align:right;">¥${Math.round(grandTotalCost).toLocaleString()}</td>`;
      html += '</tr>';

      html += '</tbody></table>';
      planContainer.innerHTML = html;

      // Attach event handlers to plan cell inputs
      planContainer.querySelectorAll('.plan-cell-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const personId = parseInt(e.target.dataset.personId);
          const period = e.target.dataset.period;
          const value = parseInt(e.target.value) || 0;
          const person = state.persons.find(p => p.id === personId);
          if (!person) return;
          if (!person.periodOverrides) person.periodOverrides = {};
          person.periodOverrides[period] = value;
          saveState();
          renderPlanTable();
          render();
        });
      });
    }
  }

  // ===== Toolbar Group Toggle =====
  const TB_GROUP_IDS = ['tg-view', 'tg-tools', 'tg-features', 'tg-file', 'tg-export', 'tg-delete', 'tg-undoredo', 'tg-align', 'tg-zoom', 'tg-misc'];
  const TB_DEFAULTS = {
    'tg-view': true,
    'tg-tools': true,
    'tg-features': false,
    'tg-file': false,
    'tg-export': false,
    'tg-delete': true,
    'tg-undoredo': true,
    'tg-align': false,
    'tg-zoom': true,
    'tg-misc': false,
  };

  function loadToolbarGroupPrefs() {
    try {
      const saved = localStorage.getItem('stractal_toolbar_groups');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return { ...TB_DEFAULTS };
  }

  function saveToolbarGroupPrefs(prefs) {
    try {
      localStorage.setItem('stractal_toolbar_groups', JSON.stringify(prefs));
    } catch (e) { /* ignore */ }
  }

  function applyToolbarGroupPrefs(prefs) {
    TB_GROUP_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (prefs[id]) {
        el.classList.remove('tb-hidden');
      } else {
        el.classList.add('tb-hidden');
      }
    });
    // Update menu checkmarks
    document.querySelectorAll('.menu-toggle-tb').forEach(btn => {
      const groupId = btn.getAttribute('data-tb-group');
      // Store original label on first call
      if (!btn.dataset.label) {
        btn.dataset.label = btn.textContent.replace(/^✓\s*/, '').trim();
      }
      const label = btn.dataset.label;
      if (prefs[groupId]) {
        btn.textContent = '✓ ' + label;
        btn.classList.remove('tb-off');
      } else {
        btn.textContent = '    ' + label;
        btn.classList.add('tb-off');
      }
    });
  }

  function setupToolbarGroupToggle() {
    const prefs = loadToolbarGroupPrefs();
    applyToolbarGroupPrefs(prefs);

    document.querySelectorAll('.menu-toggle-tb').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = btn.getAttribute('data-tb-group');
        const prefs = loadToolbarGroupPrefs();
        prefs[groupId] = !prefs[groupId];
        saveToolbarGroupPrefs(prefs);
        applyToolbarGroupPrefs(prefs);
      });
    });
  }

  // ===== Init =====
  function init() {
    loadState();
    loadFromUrl();
    initTabs();
    setupAllocationHandlers();
    setupPlanTable();
    setupDashboard();
    setupMenuBar();
    setupToolbarGroupToggle();
    resizeCanvas();
    renderPersonList();
    renderLayerList();
    renderTabList();
    window.addEventListener('resize', resizeCanvas);
  }

  init();
})();
