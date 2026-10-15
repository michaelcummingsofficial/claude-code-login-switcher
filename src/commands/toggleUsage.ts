import { getSettings } from "../settings/getSettings";
import { updateSetting } from "../settings/updateSetting";

export async function toggleUsage(): Promise<void> {
	await updateSetting("showUsage", !getSettings().showUsage);
}
