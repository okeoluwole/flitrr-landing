import { appFontClass } from '../../appFonts';

/**
 * The Instrument type scope for the authenticated PULSE app. The marketing
 * /pulse landing sits above this layout and never loads Geist. See
 * app/appFonts.js for why the classes and the tokens travel together.
 */
export default function PulseAppLayout({ children }) {
  return <div className={appFontClass}>{children}</div>;
}
