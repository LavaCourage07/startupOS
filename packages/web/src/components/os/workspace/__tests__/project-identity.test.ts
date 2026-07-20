import { describe, expect, it } from 'vitest';
import { normalizeOntologyId, normalizeProjectEntryId } from '../project-identity';

describe('project workspace identity normalization', () => {
  it('keeps canonical project ids unchanged', () => {
    expect(normalizeProjectEntryId('proj-1778321075425-gmv0zt4h8')).toBe('proj-1778321075425-gmv0zt4h8');
  });

  it('unwraps legacy project-* prefixes without stripping canonical proj-* ids', () => {
    expect(normalizeProjectEntryId('project-proj-1778321075425-gmv0zt4h8')).toBe('proj-1778321075425-gmv0zt4h8');
    expect(normalizeProjectEntryId('project-1778321075425-gmv0zt4h8')).toBe('1778321075425-gmv0zt4h8');
  });

  it('derives canonical ontology ids from project ids', () => {
    expect(normalizeOntologyId(null, 'proj-1778321075425-gmv0zt4h8')).toBe('ontology-proj-1778321075425-gmv0zt4h8');
    expect(normalizeOntologyId(undefined, 'project-proj-1778321075425-gmv0zt4h8')).toBe('ontology-proj-1778321075425-gmv0zt4h8');
  });

  it('normalizes legacy ontology id formats', () => {
    expect(normalizeOntologyId('ontology_proj-1778321075425-gmv0zt4h8', 'ignored')).toBe('ontology-proj-1778321075425-gmv0zt4h8');
    expect(normalizeOntologyId('ontology-project-proj-1778321075425-gmv0zt4h8', 'ignored')).toBe('ontology-proj-1778321075425-gmv0zt4h8');
    expect(normalizeOntologyId('ontology-project-1778321075425-gmv0zt4h8', 'ignored')).toBe('ontology-1778321075425-gmv0zt4h8');
  });
});
