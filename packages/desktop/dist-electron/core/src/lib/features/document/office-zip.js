"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfficeZip = void 0;
const fs_1 = require("fs");
const zlib_1 = __importDefault(require("zlib"));
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
function findEndOfCentralDirectory(buffer) {
    const minOffset = Math.max(0, buffer.length - 0xffff - 22);
    for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
        if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
            return offset;
        }
    }
    throw new Error('Invalid Office file: ZIP central directory not found');
}
function parseEntries(buffer) {
    const eocdOffset = findEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
    const entries = [];
    let offset = centralDirectoryOffset;
    for (let i = 0; i < entryCount; i += 1) {
        if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
            throw new Error('Invalid Office file: corrupt ZIP central directory');
        }
        const compressionMethod = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);
        const name = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
        entries.push({
            name,
            compressionMethod,
            compressedSize,
            uncompressedSize,
            localHeaderOffset,
        });
        offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return entries;
}
function inflateEntry(buffer, entry) {
    const localOffset = entry.localHeaderOffset;
    if (buffer.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE) {
        throw new Error(`Invalid Office file: local header not found for ${entry.name}`);
    }
    const fileNameLength = buffer.readUInt16LE(localOffset + 26);
    const extraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + fileNameLength + extraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
    if (entry.compressionMethod === 0) {
        return compressed;
    }
    if (entry.compressionMethod === 8) {
        return zlib_1.default.inflateRawSync(compressed, { finishFlush: zlib_1.default.constants.Z_SYNC_FLUSH });
    }
    throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.name}`);
}
class OfficeZip {
    constructor(buffer) {
        this.buffer = buffer;
        this.entries = parseEntries(buffer);
    }
    static async fromFile(filePath) {
        return new OfficeZip(await fs_1.promises.readFile(filePath));
    }
    listFiles() {
        return this.entries.map((entry) => entry.name);
    }
    readText(entryName) {
        const entry = this.entries.find((candidate) => candidate.name === entryName);
        if (!entry)
            return null;
        const inflated = inflateEntry(this.buffer, entry);
        if (entry.uncompressedSize > 0 && inflated.length !== entry.uncompressedSize) {
            // Some Office producers write inconsistent size fields; prefer content over failing hard.
        }
        return inflated.toString('utf8');
    }
}
exports.OfficeZip = OfficeZip;
