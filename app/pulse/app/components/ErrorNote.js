import styles from './ErrorNote.module.css';

/**
 * The one failure voice (Session K, Note 15 sub-step 1). Every surface that
 * needs to say a write or a load failed renders this, so the app has one
 * failure presentation instead of the five separately-authored .error
 * classes it grew: same face, same size, same weight, same danger ink,
 * always role="alert", never colour alone.
 *
 * Usage: render it conditionally with the message as children. The message
 * itself stays the surface's own words (it knows what failed); the voice
 * saying it is shared.
 */
export default function ErrorNote({ children }) {
  return (
    <p className={styles.error} role="alert">
      {children}
    </p>
  );
}
