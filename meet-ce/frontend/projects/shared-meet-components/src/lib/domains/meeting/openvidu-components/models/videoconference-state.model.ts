/**
 * The phase of the videoconference connection lifecycle.
 *
 * Transitions:
 *   loading → prejoin  (when showPrejoin = true)
 *   loading → ready    (when showPrejoin = false, token applied directly)
 *   prejoin → ready    (user clicks join, token applied directly)
 *   ready   → disconnected (user leaves)
 *   any     → error    (unrecoverable error)
 */
export type VideoconferencePhase = 'loading' | 'prejoin' | 'ready' | 'disconnected' | 'error';
