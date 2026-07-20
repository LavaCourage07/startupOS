import { describe, expect, it } from 'vitest';
import path from 'path';
import { getDataRoot } from '../../../paths';
import { projectIdFromOntologyId, schemaPath } from '../config';

describe('ontology-data-store path config', () => {
  it('loads ontology.json from the project directory for canonical ids', () => {
    expect(projectIdFromOntologyId('ontology-proj-1778321075425-gmv0zt4h8')).toBe('proj-1778321075425-gmv0zt4h8');
    expect(schemaPath('ontology-proj-1778321075425-gmv0zt4h8')).toBe(
      path.join(getDataRoot(), 'projects', 'proj-1778321075425-gmv0zt4h8', 'ontology', 'ontology.json'),
    );
  });

  it('normalizes legacy and accidentally wrapped ontology ids to the same project ontology file', () => {
    const expected = path.join(
      getDataRoot(),
      'projects',
      'proj-1778321075425-gmv0zt4h8',
      'ontology',
      'ontology.json',
    );

    expect(schemaPath('ontology_proj-1778321075425-gmv0zt4h8')).toBe(expected);
    expect(schemaPath('ontology-project-proj-1778321075425-gmv0zt4h8')).toBe(expected);
  });
});
