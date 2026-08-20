import { appFontClass } from '../../appFonts';

/**
 * The Instrument type scope for the authenticated STACK app. The marketing
 * /stack landing sits above this layout and never loads Geist. See
 * app/appFonts.js for why the classes and the tokens travel together.
 */
export default function StackAppLayout({ children }) {
  return <div className={appFontClass}>{children}</div>;
}
