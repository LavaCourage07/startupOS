export function isSkillExportAllowed(systemManaged: boolean | null | undefined): boolean {
  return systemManaged === false;
}
