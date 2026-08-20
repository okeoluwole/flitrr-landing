import { appFontClass } from '../appFonts';

/**
 * The Instrument type scope for /dashboard and /dashboard/team. The wrapper
 * carries the Geist variable classes and the --app-font-* tokens that read
 * them; .app-scope is display: contents, so it adds no box and the shell's
 * geometry is exactly what it was when the fonts hung on <html>.
 */
export default function DashboardLayout({ children }) {
  return <div className={appFontClass}>{children}</div>;
}
