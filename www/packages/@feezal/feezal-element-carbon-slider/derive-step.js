/** B17 (same rule as material-slider): explicit step wins; otherwise derive
 *  from the range: (max − min) / 100. Own module so unit tests can import it
 *  without pulling in @carbon/web-components (whose extensionless lodash-es
 *  imports only resolve under Vite). */
export function deriveStep(step, min, max) {
    const explicit = Number(step);
    if (step !== undefined && step !== null && step !== '' && !isNaN(explicit) && explicit > 0) {
        return explicit;
    }

    const range = Number(max) - Number(min);
    if (!isFinite(range) || range <= 0) return 1;
    return Number((range / 100).toPrecision(12));
}
