// DSSA → Compositore: legge le tavole selezionate e le traduce in una scena per il
// compositore di animazioni. Simboli, marchio, etichetta e freccia si riconoscono dal nome
// del componente; i testi restano testi (con stile, corpo, interlinea); il resto si esporta
// come immagine. Formato della scena: src/engine/figma.ts nel repository del compositore.
//
// Scritto in JavaScript semplice (senza compilazione) per installarlo così com'è.

figma.showUI(__html__, { width: 380, height: 520, themeColors: true });

var PALETTE = {
  viola: '#705EF2',
  fucsia: '#FF4A75',
  verde: '#4ED1A6',
  giallo: '#FBDB4B',
  nero: '#111114',
  bianco: '#FFFFFF',
};

// Ordine importante: «Food Space & Interior Design for Food» contiene anche «design for food».
var SYMBOL_RULES = [
  ['systemic', /systemic|social|sistemic/],
  ['communication', /communication|comunicazione/],
  ['space', /space|interior|spazi/],
  ['service', /service|eating|servizio/],
  ['about', /\babout\b/],
  ['with', /\bwith\b/],
  ['for', /\bfor\b|design for food|ciotol/],
];

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function hex(c) {
  var t = function (v) {
    var h = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16);
    return h.length === 1 ? '0' + h : h;
  };
  return ('#' + t(c.r) + t(c.g) + t(c.b)).toUpperCase();
}

function solidOf(fills) {
  if (!fills || fills === figma.mixed || !fills.length) return null;
  for (var i = fills.length - 1; i >= 0; i--) {
    var f = fills[i];
    if (f.visible !== false && f.type === 'SOLID' && (f.opacity === undefined || f.opacity > 0.01)) return hex(f.color);
  }
  return null;
}

function hasImageFill(node) {
  var fills = node.fills;
  if (fills && fills !== figma.mixed) for (var i = 0; i < fills.length; i++) if (fills[i].type === 'IMAGE' && fills[i].visible !== false) return true;
  return false;
}

/** Primo colore pieno nel nodo o nei discendenti. */
function colorInside(node) {
  var own = 'fills' in node ? solidOf(node.fills) : null;
  if (own) return own;
  if ('findOne' in node) {
    var hit = node.findOne(function (n) {
      return n.visible !== false && 'fills' in n && !!solidOf(n.fills);
    });
    if (hit) return solidOf(hit.fills);
  }
  return null;
}

function strokeInside(node) {
  if ('strokes' in node && node.strokes && node.strokes.length) {
    var s = solidOf(node.strokes);
    if (s) return s;
  }
  if ('findOne' in node) {
    var hit = node.findOne(function (n) {
      return n.visible !== false && 'strokes' in n && n.strokes && n.strokes.length && !!solidOf(n.strokes);
    });
    if (hit) return solidOf(hit.strokes);
  }
  return null;
}

function anyImageInside(node) {
  if (hasImageFill(node)) return true;
  if ('findOne' in node)
    return !!node.findOne(function (n) {
      return n.visible !== false && hasImageFill(n);
    });
  return false;
}

function paletteWord(name) {
  var m = /\b(viola|fucsia|verde|giallo|nero|bianco)\b/.exec(name);
  return m ? PALETTE[m[1]] : null;
}

function bounds(node, frame) {
  var a = node.absoluteBoundingBox;
  var f = frame.absoluteBoundingBox;
  return { x: a.x - f.x, y: a.y - f.y, w: a.width, h: a.height };
}

async function exportImage(node, photo) {
  var w = node.width || 1;
  var h = node.height || 1;
  var scale = Math.min(2, 2160 / Math.max(w, h));
  var bytes = await node.exportAsync({
    format: photo ? 'JPG' : 'PNG',
    constraint: { type: 'SCALE', value: Math.max(0.1, scale) },
    useAbsoluteBounds: true,
  });
  return 'data:image/' + (photo ? 'jpeg' : 'png') + ';base64,' + figma.base64Encode(bytes);
}

/** Nome completo di un'istanza: set di componenti, componente, varianti. */
async function componentName(node) {
  if (node.type !== 'INSTANCE') return '';
  var main = await node.getMainComponentAsync();
  if (!main) return '';
  var parts = [main.name];
  if (main.parent && main.parent.type === 'COMPONENT_SET') parts.unshift(main.parent.name);
  return parts.join(' / ');
}

function symbolOf(name) {
  for (var i = 0; i < SYMBOL_RULES.length; i++) if (SYMBOL_RULES[i][1].test(name)) return SYMBOL_RULES[i][0];
  return null;
}

async function textData(node, warnings) {
  var segs = node.getStyledTextSegments(['fontName', 'fontWeight', 'fontSize', 'fills', 'letterSpacing', 'lineHeight']);
  var base = segs[0];
  for (var i = 1; i < segs.length; i++) if (segs[i].characters.length > base.characters.length) base = segs[i];
  // Neretto: i tratti più pesanti del testo principale diventano «**…**».
  var markup = '';
  for (var j = 0; j < segs.length; j++) {
    var s = segs[j];
    markup += s.fontWeight > base.fontWeight + 50 ? '**' + s.characters + '**' : s.characters;
  }
  markup = markup.replace(/\*\*(\s*)\*\*/g, '$1');
  var lh = base.lineHeight;
  var lineHeight = lh.unit === 'PIXELS' ? lh.value : lh.unit === 'PERCENT' ? (lh.value / 100) * base.fontSize : null;
  var ls = base.letterSpacing;
  var letterSpacing = ls.unit === 'PIXELS' ? ls.value : (ls.value / 100) * base.fontSize;
  var styleName;
  if (node.textStyleId && node.textStyleId !== figma.mixed) {
    var st = await figma.getStyleByIdAsync(node.textStyleId);
    if (st) styleName = st.name;
  }
  var family = base.fontName.family;
  if (!/basier|wotfard/i.test(family)) warnings.push('«' + node.name + '» usa ' + family + ': nel compositore verrà reso con Basier Circle.');
  if (Math.abs(node.rotation || 0) > 0.5) warnings.push('«' + node.name + '» è ruotato: il compositore lo disegna dritto.');
  return {
    characters: node.characters,
    markup: markup !== node.characters ? markup : undefined,
    family: family,
    weight: base.fontWeight,
    size: base.fontSize,
    lineHeight: lineHeight,
    letterSpacing: letterSpacing,
    align: node.textAlignHorizontal,
    autoWidth: node.textAutoResize === 'WIDTH_AND_HEIGHT',
    color: solidOf(base.fills) || '#111114',
    styleName: styleName,
  };
}

async function nodeData(node, frame, warnings) {
  var b = bounds(node, frame);
  var base = { id: node.id, name: node.name, x: b.x, y: b.y, w: b.w, h: b.h };
  if (node.opacity !== undefined && node.opacity < 1) base.opacity = node.opacity;

  if (node.type === 'TEXT') {
    base.kind = 'text';
    base.text = await textData(node, warnings);
    return base;
  }

  var comp = await componentName(node);
  if (comp) base.component = comp;
  var name = norm(comp + ' / ' + node.name);
  var isInstance = node.type === 'INSTANCE';
  var looksSymbol = /simbol|ambit|symbol/.test(name);
  var sym = symbolOf(name);

  if ((isInstance || looksSymbol) && sym && (looksSymbol || /design|food/.test(name))) {
    base.kind = 'symbol';
    base.symbol = sym;
    base.fill = /irid/.test(name) || anyImageInside(node) ? 'iridescente' : /opac/.test(name) ? 'opaco' : 'piatto';
    base.color = paletteWord(name) || colorInside(node) || undefined;
    base.image = await exportImage(node, false);
    return base;
  }
  if (/etichetta|label|\btag\b/.test(name)) {
    var t = 'findOne' in node ? node.findOne(function (n) { return n.type === 'TEXT'; }) : null;
    base.kind = 'label';
    base.text = t ? t.characters : node.name;
    base.color = strokeInside(node) || (t && solidOf(t.fills)) || undefined;
    base.image = await exportImage(node, false);
    return base;
  }
  if (/freccia|arrow/.test(name)) {
    base.kind = 'arrow';
    base.color = strokeInside(node) || colorInside(node) || undefined;
    base.image = await exportImage(node, false);
    return base;
  }
  // Marchio: per nome, oppure un componente chiamato soltanto «DSSA».
  if (/marchio|logotip|monogramm|lockup/.test(name) || (isInstance && /(^|\/)\s*dssa\s*$/.test(norm(comp)))) {
    base.kind = 'mark';
    base.config = /monogramm/.test(name) ? 'monogramma' : /lockup|denominazione|orizzontale/.test(name) ? 'lockup' : 'logotipo';
    base.color = paletteWord(name) || colorInside(node) || undefined;
    base.image = await exportImage(node, false);
    return base;
  }
  // Tutto il resto: immagine esportata, animabile in blocco.
  var photo = hasImageFill(node) && !('children' in node && node.children.length);
  base.kind = 'image';
  base.photo = photo;
  base.image = await exportImage(node, photo);
  if (isInstance && /simbol|marchio|etichetta/.test(name)) warnings.push('«' + node.name + '» (' + comp + ') non riconosciuto: arriva come immagine.');
  return base;
}

/** Fondo della tavola: colore pieno, oppure immagine (sfumature, foto, materia iridescente). */
async function frameBackground(frame) {
  var fills = frame.fills;
  if (!fills || fills === figma.mixed || !fills.length) return { color: null, image: null };
  var visible = fills.filter(function (f) { return f.visible !== false; });
  if (!visible.length) return { color: null, image: null };
  var onlySolid = visible.every(function (f) { return f.type === 'SOLID'; });
  if (onlySolid) return { color: solidOf(visible), image: null };
  // Copia della tavola senza figli, esportata e subito eliminata.
  var copy = frame.clone();
  for (var i = copy.children.length - 1; i >= 0; i--) copy.children[i].remove();
  var bytes = await copy.exportAsync({ format: 'JPG', constraint: { type: 'SCALE', value: Math.min(2, 2160 / Math.max(frame.width, frame.height)) } });
  copy.remove();
  return { color: null, image: 'data:image/jpeg;base64,' + figma.base64Encode(bytes) };
}

async function collect() {
  var sel = figma.currentPage.selection.filter(function (n) {
    return n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE';
  });
  if (!sel.length) throw new Error('Seleziona una o più tavole (frame) da inviare.');
  var warnings = [];
  var frames = [];
  for (var i = 0; i < sel.length; i++) {
    var fr = sel[i];
    figma.ui.postMessage({ type: 'progress', text: 'Tavola ' + (i + 1) + ' di ' + sel.length + ': ' + fr.name });
    var bg = await frameBackground(fr);
    var nodes = [];
    if (bg.image) nodes.push({ id: fr.id + ':fondo', name: 'Fondo [fermo]', kind: 'image', photo: true, x: 0, y: 0, w: fr.width, h: fr.height, image: bg.image });
    var kids = fr.children.filter(function (n) { return n.visible !== false; });
    for (var k = 0; k < kids.length; k++) {
      try {
        nodes.push(await nodeData(kids[k], fr, warnings));
      } catch (e) {
        warnings.push('«' + kids[k].name + '» non esportato: ' + (e && e.message ? e.message : e));
      }
    }
    frames.push({ id: fr.id, name: fr.name, width: fr.width, height: fr.height, background: bg.color, nodes: nodes });
  }
  return {
    kind: 'dssa-figma',
    version: 1,
    fileName: figma.root.name,
    fileKey: figma.fileKey,
    page: figma.currentPage.name,
    exportedAt: new Date().toISOString(),
    frames: frames,
    warnings: warnings,
  };
}

function selectionInfo() {
  var sel = figma.currentPage.selection.filter(function (n) {
    return n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE';
  });
  figma.ui.postMessage({
    type: 'selection',
    frames: sel.map(function (n) {
      return { name: n.name, w: Math.round(n.width), h: Math.round(n.height), children: 'children' in n ? n.children.length : 0 };
    }),
  });
}

figma.on('selectionchange', selectionInfo);

figma.ui.onmessage = async function (msg) {
  if (msg.type === 'ready') {
    selectionInfo();
    var url = await figma.clientStorage.getAsync('url');
    figma.ui.postMessage({ type: 'url', url: url || 'http://localhost:5173' });
  }
  if (msg.type === 'save-url') await figma.clientStorage.setAsync('url', msg.url);
  if (msg.type === 'collect') {
    try {
      var scene = await collect();
      figma.ui.postMessage({ type: 'scene', scene: scene, then: msg.then });
    } catch (e) {
      figma.ui.postMessage({ type: 'error', text: e && e.message ? e.message : String(e) });
    }
  }
  if (msg.type === 'notify') figma.notify(msg.text);
};
