"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOntologyEntities = listOntologyEntities;
exports.getOntologyEntity = getOntologyEntity;
exports.createOntologyEntity = createOntologyEntity;
exports.createOntologyRelation = createOntologyRelation;
exports.updateOntologyEntity = updateOntologyEntity;
exports.deleteOntologyEntity = deleteOntologyEntity;
exports.getRelatedEntities = getRelatedEntities;
exports.generateOntology = generateOntology;
exports.validateOntology = validateOntology;
exports.getOntology = getOntology;
exports.updateOntology = updateOntology;
exports.confirmOntology = confirmOntology;
exports.chatWithOntology = chatWithOntology;
const env_1 = require("../env");
const ipc_protocol_1 = require("../ipc-protocol");
async function readJsonResponse(response) {
    const payload = (await response.json());
    if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'error' in payload
            ? JSON.stringify(payload.error)
            : response.statusText;
        throw new Error(message);
    }
    return payload;
}
async function listOntologyEntities(type) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_ENTITY_LIST, type);
    }
    const url = type
        ? `/api/ontology/entities?type=${encodeURIComponent(type)}`
        : '/api/ontology/entities';
    const response = await fetch(url);
    return readJsonResponse(response);
}
async function getOntologyEntity(entityId) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_ENTITY_GET, entityId);
    }
    const response = await fetch(`/api/ontology/entities/${encodeURIComponent(entityId)}`);
    return readJsonResponse(response);
}
async function createOntologyEntity(entity) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_ENTITY_CREATE, { entity });
    }
    const response = await fetch('/api/ontology/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'create', entity }),
    });
    return readJsonResponse(response);
}
async function createOntologyRelation(relation) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_ENTITY_CREATE, { relation });
    }
    const response = await fetch('/api/ontology/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'relate', ...relation }),
    });
    return readJsonResponse(response);
}
async function updateOntologyEntity(entityId, properties) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_ENTITY_UPDATE, entityId, properties);
    }
    const response = await fetch(`/api/ontology/entities/${encodeURIComponent(entityId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'update', properties }),
    });
    return readJsonResponse(response);
}
async function deleteOntologyEntity(entityId) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_ENTITY_DELETE, entityId);
    }
    const response = await fetch(`/api/ontology/entities/${encodeURIComponent(entityId)}`, {
        method: 'DELETE',
    });
    return readJsonResponse(response);
}
async function getRelatedEntities(entityId, relType, direction) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_ENTITY_RELATED, entityId, relType, direction);
    }
    const params = new URLSearchParams();
    if (relType)
        params.set('rel', relType);
    if (direction)
        params.set('dir', direction);
    const query = params.toString();
    const response = await fetch(`/api/ontology/entities/${encodeURIComponent(entityId)}/related${query ? `?${query}` : ''}`);
    return readJsonResponse(response);
}
async function generateOntology(request) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_GENERATE, request);
    }
    const response = await fetch('/api/ontology/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
    return readJsonResponse(response);
}
async function validateOntology() {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_VALIDATE);
    }
    const response = await fetch('/api/ontology/validate');
    return readJsonResponse(response);
}
async function getOntology(ontologyId) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_GET, { ontologyId });
    }
    const response = await fetch(`/api/ontology/${encodeURIComponent(ontologyId)}`);
    return readJsonResponse(response);
}
async function updateOntology(ontologyId, request) {
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_UPDATE, { ontologyId, ...request });
    }
    const response = await fetch(`/api/ontology/${encodeURIComponent(ontologyId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
    return readJsonResponse(response);
}
async function confirmOntology(ontologyId, confirmed) {
    const request = { ontologyId, confirmed };
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_CONFIRM, request);
    }
    const response = await fetch(`/api/ontology/${encodeURIComponent(ontologyId)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
    return readJsonResponse(response);
}
async function chatWithOntology(ontologyId, message) {
    const request = { ontologyId, message };
    if ((0, env_1.isElectron)()) {
        return (0, env_1.getIpcRenderer)().invoke(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_CHAT, request);
    }
    const response = await fetch(`/api/ontology/${encodeURIComponent(ontologyId)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });
    return readJsonResponse(response);
}
