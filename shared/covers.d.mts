export type CoverArtwork = 'forest' | 'ocean' | 'space' | 'bears' | 'butterfly' | 'music' | 'stories' | 'earth';
export function coverArtworkFor(details?: { title?: string; description?: string; tags?: readonly string[] }): CoverArtwork;
