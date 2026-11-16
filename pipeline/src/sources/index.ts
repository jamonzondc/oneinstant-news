import { MEDIA } from './media.ts';
import { OFFICIAL } from './official.ts';
import { REGIONAL } from './regional.ts';
import { SOCIAL } from './social.ts';
import type { SourceDefinition } from './types.ts';

export const SOURCES: SourceDefinition[] = [...MEDIA, ...OFFICIAL, ...SOCIAL, ...REGIONAL];
