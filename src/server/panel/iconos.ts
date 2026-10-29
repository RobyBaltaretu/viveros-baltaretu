import {
  ArrowLeft,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  Camera,
  ChartColumn,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  CloudUpload,
  Download,
  Ellipsis,
  FileText,
  History,
  House,
  ImagePlus,
  Images,
  Package,
  Inbox,
  LogOut,
  MessageSquarePlus,
  Plus,
  ReceiptEuro,
  ScanLine,
  Send,
  Sparkles,
  Sprout,
  Trash2,
  TriangleAlert,
  User,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-static";

/**
 * Iconos del panel (Lucide, licencia ISC). Se guarda solo el contenido del SVG;
 * `Icono.astro` pone el marco, el tamaño y el color.
 */
const interior = (svg: string) =>
  svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .trim();

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
  usuario: interior(User),
  conversacion: interior(MessageSquarePlus),
  anadirFoto: interior(ImagePlus),
  cerrar: interior(X),
  borrar: interior(Trash2),
  inventario: interior(Package),
  catalogo: interior(BookOpen),
  calcular: interior(Calculator),
  descargar: interior(Download),
} as const;

export type NombreIcono = keyof typeof ICONOS;
