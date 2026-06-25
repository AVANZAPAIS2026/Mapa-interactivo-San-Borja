const ROOT_FOLDER_ID = '1XC-UikBo_iCwnY5wK91vHK5jqY9ogPNG';
const CACHE_SECONDS = 30;

function doGet(event) {
  const callback = sanitizeCallback(event && event.parameter && event.parameter.callback);
  const payload = getActivitiesPayload();
  const body = callback
    ? `${callback}(${JSON.stringify(payload)});`
    : JSON.stringify(payload);

  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function sanitizeCallback(callback) {
  const value = String(callback || '');
  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(value) ? value : '';
}

function getActivitiesPayload() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('activitiesPayload');
  if (cached) return JSON.parse(cached);

  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const activities = [];
  const typeFolders = root.getFolders();

  while (typeFolders.hasNext()) {
    const typeFolder = typeFolders.next();
    const typeName = typeFolder.getName();
    const dateFolders = typeFolder.getFolders();

    while (dateFolders.hasNext()) {
      const dateFolder = dateFolders.next();
      activities.push(buildActivity(typeName, dateFolder));
    }
  }

  activities.sort((a, b) => {
    const dateA = a.dateValue ? new Date(a.dateValue).getTime() : 0;
    const dateB = b.dateValue ? new Date(b.dateValue).getTime() : 0;
    return dateB - dateA || b.updatedAt.localeCompare(a.updatedAt);
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    rootFolderId: ROOT_FOLDER_ID,
    activities
  };

  cache.put('activitiesPayload', JSON.stringify(payload), CACHE_SECONDS);
  return payload;
}

function buildActivity(typeName, dateFolder) {
  const files = dateFolder.getFiles();
  const photos = [];
  const docs = [];
  let updatedAt = dateFolder.getLastUpdated();

  while (files.hasNext()) {
    const file = files.next();
    const mime = file.getMimeType();
    updatedAt = maxDate(updatedAt, file.getLastUpdated());

    if (mime && mime.indexOf('image/') === 0) {
      photos.push({
        id: file.getId(),
        name: file.getName(),
        imageUrl: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1600`,
        viewUrl: file.getUrl()
      });
    }

    if (isMarkdownFile(file)) {
      docs.push(readMarkdownFile(file));
    }
  }

  photos.sort((a, b) => a.name.localeCompare(b.name));
  docs.sort((a, b) => a.name.localeCompare(b.name));

  const markdown = docs.length ? docs[0].content : '';
  const parsed = parseMarkdown(markdown);
  const dateInfo = parseDateFolderName(dateFolder.getName());
  const category = categorySlug(typeName);
  const categoryLabel = parsed.meta.tipo || parsed.meta.categoria || labelFromFolder(typeName);
  const title = parsed.meta.titulo || parsed.meta.title || parsed.title || `${categoryLabel} - ${dateInfo.label}`;
  const summary = parsed.meta.resumen || parsed.meta.summary || parsed.summary || 'Actividad registrada en campo.';

  return {
    id: dateFolder.getId(),
    folderName: dateFolder.getName(),
    folderUrl: dateFolder.getUrl(),
    title,
    category,
    categoryLabel,
    type: categoryLabel,
    dateLabel: parsed.meta.fecha || dateInfo.label,
    dateValue: dateInfo.value,
    sector: parsed.meta.sector || '',
    location: parsed.meta.direccion || parsed.meta.ubicacion || parsed.meta.location || 'San Borja',
    summary,
    ideas: parsed.ideas,
    badge: photos.length > 1 ? 'Galería' : 'Fotos',
    image: photos.length ? photos[0].imageUrl : 'icono.png',
    photos: photos.map(photo => photo.imageUrl),
    files: docs.map(doc => ({ id: doc.id, name: doc.name, url: doc.url })),
    mapUrl: parsed.meta.mapa || parsed.meta.mapUrl || '',
    updatedAt: updatedAt.toISOString()
  };
}

function isMarkdownFile(file) {
  const name = file.getName().toLowerCase();
  return name.endsWith('.md') || name.endsWith('.markdown') || file.getMimeType() === 'text/markdown';
}

function readMarkdownFile(file) {
  return {
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl(),
    content: file.getBlob().getDataAsString('UTF-8')
  };
}

function parseMarkdown(markdown) {
  const meta = {};
  let text = String(markdown || '').replace(/\r\n/g, '\n').trim();

  if (text.indexOf('---') === 0) {
    const end = text.indexOf('\n---', 3);
    if (end > -1) {
      const frontMatter = text.slice(3, end).trim();
      frontMatter.split('\n').forEach(line => {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) meta[normalizeKey(match[1])] = match[2].trim().replace(/^["']|["']$/g, '');
      });
      text = text.slice(end + 4).trim();
    }
  }

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const titleLine = lines.find(line => line.indexOf('# ') === 0);
  const title = titleLine ? titleLine.replace(/^#+\s*/, '') : '';
  lines.forEach(line => {
    const field = line.match(/^\*\*([^:*]+):\*\*\s*(.+)$/) || line.match(/^([^:*]+):\s*(.+)$/);
    if (field && !/^https?:\/\//i.test(field[1])) {
      meta[normalizeKey(field[1])] = field[2].trim();
    }
  });
  const bullets = lines
    .filter(line => /^[-*]\s+/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  const paragraph = lines.find(line => {
    if (/^#/.test(line) || /^[-*]\s+/.test(line)) return false;
    if (/^\*\*[^:*]+:\*\*/.test(line) || /^[^:*]+:\s+/.test(line)) return false;
    return true;
  });

  return {
    meta,
    title,
    summary: paragraph || '',
    ideas: bullets
  };
}

function parseDateFolderName(name) {
  const value = String(name || '').trim();
  const iso = value.match(/(\d{4})[-_/\.](\d{1,2})[-_/\.](\d{1,2})/);
  const local = value.match(/(\d{1,2})[-_/\.](\d{1,2})[-_/\.](\d{2,4})/);

  if (iso) {
    return {
      label: formatDateLabel(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))),
      value: `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`
    };
  }

  if (local) {
    const year = normalizeYear(local[3]);
    return {
      label: formatDateLabel(new Date(year, Number(local[2]) - 1, Number(local[1]))),
      value: `${year}-${pad(local[2])}-${pad(local[1])}`
    };
  }

  return { label: value || 'Sin fecha', value: '' };
}

function formatDateLabel(date) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

function categorySlug(name) {
  const slug = normalizeText(name);
  if (slug.indexOf('recorrido') > -1) return 'recorrido';
  if (slug.indexOf('reunion') > -1 || slug.indexOf('reuniones') > -1) return 'reunion';
  if (slug.indexOf('escucha') > -1) return 'escucha';
  return slug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'actividad';
}

function labelFromFolder(name) {
  return String(name || 'Actividad')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(key) {
  return normalizeText(key).replace(/[^a-z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function maxDate(a, b) {
  return a.getTime() >= b.getTime() ? a : b;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeYear(value) {
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
}
