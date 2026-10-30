import { OBSIDIAN_REST_PORT } from './constants.ts';

/**
 * Attempts to trigger "Reload app without saving" in Obsidian
 * via the Local REST API plugin (community plugin by coddingtonbear).
 * Silently does nothing if Obsidian is not running or the plugin is unreachable.
 *
 * @see https://github.com/coddingtonbear/obsidian-local-rest-api
 */
export async function reloadObsidian(): Promise<void> {
  try {
    const apiKey = process.env.OBSIDIAN_REST_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
      console.warn('⚠ Obsidian REST API: API key not configured in .env file');
      return;
    }

    const res = await fetch(
      `http://localhost:${OBSIDIAN_REST_PORT}/commands/app:reload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` }
      }
    );

    if (res.ok) {
      console.log('Obsidian reloaded via Local REST API.');
    } else {
      console.warn(
        `⚠ Obsidian REST API responded with status ${res.status} for command app:reload`
      );
    }
  } catch (e) {
    const isConnRefused =
      e instanceof Error &&
      (e.message.includes('ECONNREFUSED') || e.message.includes('fetch failed'));
    if (isConnRefused) {
      console.warn(
        '⚠ Obsidian REST API unreachable: Obsidian is not running or the Local REST API plugin is disabled'
      );
    } else {
      console.warn('⚠ Obsidian REST API error:', e);
    }
  }
}
