"use strict";
/**
 * Skill System Types for pi-agent-core
 *
 * Defines the types for the composite skill system that allows
 * skills to orchestrate other skills and communicate with each other.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillType = void 0;
/**
 * Skill type enum
 */
var SkillType;
(function (SkillType) {
    SkillType["SIMPLE"] = "simple";
    SkillType["COMPOSITE"] = "composite";
})(SkillType || (exports.SkillType = SkillType = {}));
