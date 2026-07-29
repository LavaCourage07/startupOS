import type { ExtensionAPI } from "@originos/pi-agent-adapter/coding-agent";
import goalExtension from "@originos/pi-agent-adapter/goal";

/**
 * Registers the approved Goal extension at the Pi integration boundary.
 * Product entry points remain disabled until their owning Story enables them.
 */
export function registerGoalExtension(api: ExtensionAPI): void {
	goalExtension(api);
}
