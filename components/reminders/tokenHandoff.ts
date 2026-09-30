// Holds a freshly issued token in memory only (never storage), so the setup guide can prefill it
// after client-side navigation from the dialog. A full reload forgets it, by design.
let pending: string | null = null;
export const setPendingToken = (token: string | null) => { pending = token; };
export const getPendingToken = () => pending;
