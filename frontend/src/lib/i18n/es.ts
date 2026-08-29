export type RelativeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

const RELATIVE_UNIT_ES: Record<RelativeUnit, string> = {
  second: 'segundo',
  minute: 'minuto',
  hour: 'hora',
  day: 'día',
  week: 'semana',
  month: 'mes',
  year: 'año',
}

export const es = {
  common: {
    untitled: 'Sin título',
    thisItem: 'este elemento',
  },
  app: {
    emptyState: 'Selecciona una nota o crea una nueva desde la barra lateral.',
    openMenu: 'Abrir menú',
    loading: 'Cargando Notarama…',
  },
  sidebar: {
    search: 'Buscar',
    newNote: 'Nueva nota',
    newFolder: 'Nueva carpeta',
    trash: 'Papelera',
    closeMenu: 'Cerrar menú',
    logout: 'Cerrar sesión',
    empty: 'Sin notas todavía. Crea una carpeta o nota con los botones de arriba.',
    confirmDelete: (title: string) => `¿Eliminar "${title}"? Esto también elimina su contenido.`,
    delete: 'Eliminar',
  },
  editor: {
    showToc: 'Mostrar tabla de contenidos',
    confirmCreateLinkedNote: (title: string) => `La nota "${title}" todavía no existe. ¿Crearla?`,
    uploadImageError: 'No se pudo subir la imagen. ¿Sigues conectado?',
  },
  toolbar: {
    bold: 'Negrita (Ctrl+B)',
    italic: 'Cursiva (Ctrl+I)',
    underline: 'Subrayado (Ctrl+U)',
    strike: 'Tachado',
    inlineCode: 'Código en línea',
    heading1: 'Título 1',
    heading2: 'Título 2',
    heading3: 'Título 3',
    bulletList: 'Lista con viñetas',
    orderedList: 'Lista numerada',
    taskList: 'Lista de tareas',
    blockquote: 'Cita',
    codeBlock: 'Bloque de código',
    textColor: 'Color de texto',
    highlight: 'Resaltado',
    insertTable: 'Insertar tabla',
    insertLink: 'Insertar enlace',
    linkPrompt: 'URL del enlace:',
    insertImage: 'Insertar imagen',
    togglePlainPaste: 'Pegar sin formato (alternar)',
  },
  toc: {
    title: 'Contenido',
    emptyHeadings: 'Los encabezados de la nota aparecerán aquí.',
    mentions: 'Menciones',
    offlineLocal: 'Sin conexión: resultado local.',
    mentionsEmptyPrefix: 'Ninguna nota enlaza aquí todavía con',
  },
  wikiMenu: {
    searchPrompt: 'Escribe para buscar una nota…',
    createNote: (query: string) => `Crear nota "${query}"`,
  },
  search: {
    placeholder: 'Buscar en tus notas…',
    offlineLocal: 'Sin conexión: mostrando resultados de la base de datos local.',
    noResults: 'Sin resultados.',
    typeToSearch: 'Escribe para buscar por título o contenido.',
  },
  trash: {
    title: 'Papelera',
    emptyTrashButton: 'Vaciar papelera',
    loadError: 'No se pudo cargar la papelera. ¿Sigues conectado?',
    loading: 'Cargando…',
    empty: 'La papelera está vacía.',
    restore: 'Restaurar',
    permanentDelete: 'Eliminar definitivamente',
    restoreError: 'No se pudo restaurar. ¿Sigues conectado?',
    deleteError: 'No se pudo eliminar. ¿Sigues conectado?',
    emptyTrashError: 'No se pudo vaciar la papelera. ¿Sigues conectado?',
    confirmPermanentDelete: (title: string) => `Eliminar "${title}" definitivamente. Esta acción no se puede deshacer.`,
    confirmEmptyTrash: (count: number) => `Vaciar la papelera (${count} elemento${count === 1 ? '' : 's'}) definitivamente.`,
    relativeTime: (n: number, unit: RelativeUnit) => {
      const label = RELATIVE_UNIT_ES[unit]
      return n <= 1 ? `hace un ${label}` : `hace ${n} ${label}s`
    },
  },
  theme: {
    light: 'Claro',
    system: 'Sistema',
    dark: 'Oscuro',
  },
  language: {
    spanish: 'Español',
    english: 'English',
  },
  statusBadge: {
    syncing: (n: number) => `Sincronizando ${n} cambio${n === 1 ? '' : 's'}…`,
    offline: 'Sin conexión — los cambios se guardan localmente',
  },
}
