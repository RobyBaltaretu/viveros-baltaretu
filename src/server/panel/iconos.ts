import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  ChartColumn,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  CloudUpload,
  Ellipsis,
  FileText,
  History,
  House,
  Images,
  Inbox,
  LogOut,
  Plus,
  ReceiptEuro,
  ScanLine,
  Send,
  Sparkles,
  Sprout,
  TriangleAlert,
  UserCog,
  Users,
  Wallet,
} from 'lucide-static';

/**
 * Iconos del panel (Lucide, licencia ISC). Se guarda solo el contenido del SVG;
 * `Icono.astro` pone el marco, el tamaño y el color.
 */
const interior = (svg: string) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();

export const ICONOS = {
  inicio: interior(House),
  plantas: interior(Sprout),
  presupuestos: interior(Inbox),
  facturas: interior(ReceiptEuro),
  clientes: interior(Users),
  gastos: interior(Wallet),
  ticket: interior(ScanLine),
  informes: interior(ChartColumn),
  textos: interior(FileText),
  fotos: interior(Images),
  camara: interior(Camera),
  publicar: interior(CloudUpload),
  cambios: interior(History),
  personas: interior(UserCog),
  ayuda: interior(CircleHelp),
  asistente: interior(Sparkles),
  salir: interior(LogOut),
  mas: interior(Ellipsis),
  volver: interior(ArrowLeft),
  siguiente: interior(ChevronRight),
  nuevo: interior(Plus),
  aviso: interior(TriangleAlert),
  hecho: interior(CircleCheck),
  enviar: interior(Send),
  calendario: interior(CalendarDays),
  campana: interior(Bell),
} as const;

export type NombreIcono = keyof typeof ICONOS;
