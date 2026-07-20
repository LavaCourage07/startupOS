/**
 * Ontology Adapter
 *
 * Converts Ontology structure to OntologyModel for display
 */

import type { Ontology, Domain, Concept } from '../../../types/ontology';
import type { OntologyModel, OntologyNode } from '../../../types/interview';

/**
 * Convert Ontology to OntologyModel for display
 */
export function adaptOntologyForDisplay(ontology: Ontology): OntologyModel {
  // Build tree structure from domains and concepts
  const nodes: OntologyNode[] = ontology.domains.map((domain: Domain) => {
    // Find concepts for this domain
    const domainConcepts = ontology.concepts.filter((c: Concept) => c.domainId === domain.id);

    // Convert concepts to nodes
    const children: OntologyNode[] = domainConcepts.map((concept: Concept) => ({
      id: concept.id,
      name: concept.name,
      type: concept.type as OntologyNode['type'],
      description: concept.description,
      children: [], // Concepts don't have children in this simple model
    }));

    return {
      id: domain.id,
      name: domain.name,
      type: 'entity' as const,
      description: domain.description,
      children,
    };
  });

  return {
    id: ontology.id,
    name: ontology.name,
    description: `Generated from interview with ${ontology.concepts.length} concepts`,
    nodes,
    createdAt: Date.now(),
  };
}
