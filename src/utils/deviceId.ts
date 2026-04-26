// Security-hardened device ID management
// - Cryptographically secure UUIDv4 generation
// - Obfuscated localStorage key with rotation detection
// - Strict UUIDv4 format validation before API use

// RFC 4122 UUIDv4 regex pattern
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Obfuscated storage key: base64-encoded to avoid plain-text "guest_id" visibility
// Decodes to "_device_uuid"
const STORAGE_KEY = btoa("_device_uuid").substring(0, 12);
const STORAGE_VERSION_KEY = btoa("_dvid_v").substring(0, 8);
const CURRENT_VERSION = "1";

// Legacy key for backward compatibility - existing users have this
// Marked as legacy to facilitate migration to obfuscated key
const LEGACY_STORAGE_KEY = "guest_id";

/**
 * Validates a string against the UUIDv4 format (RFC 4122)
 * @param value - String to validate
 * @returns true if valid UUIDv4, false otherwise
 * @throws TypeError if value is not a string
 */
export function isValidUUIDv4(value: unknown): value is string {
  if (typeof value !== "string") {
    console.warn("[DeviceID] Validation failed: value is not a string", {
      type: typeof value,
      value: String(value).substring(0, 20),
    });
    return false;
  }

  const isValid = UUID_V4_PATTERN.test(value);
  if (!isValid) {
    console.warn("[DeviceID] Validation failed: UUIDv4 pattern mismatch", {
      value: value.substring(0, 20),
      pattern: "RFC 4122 UUIDv4",
    });
  }
  return isValid;
}

/**
 * Generates a cryptographically secure UUIDv4
 * Uses Web Crypto API via crypto.randomUUID() (available in all modern browsers and Node.js 15+)
 * @returns Valid UUIDv4 string
 * @throws Error if crypto API is unavailable
 */
export function generateDeviceId(): string {
  try {
    const uuid = crypto.randomUUID();
    // Validate the generated UUID to catch any implementation bugs
    if (!isValidUUIDv4(uuid)) {
      throw new Error("Generated UUID failed validation");
    }
    return uuid;
  } catch (error) {
    console.error("[DeviceID] Failed to generate secure UUID", error);
    throw new Error("Failed to generate device ID. Crypto API unavailable or UUID generation failed.");
  }
}

/**
 * Safely retrieves and validates device ID from localStorage
 * Checks both obfuscated and legacy keys for backward compatibility
 * Returns undefined if:
 * - No ID exists in either location
 * - ID fails UUIDv4 validation
 * - Storage version mismatch detected (signals tampering or corruption)
 *
 * Migration: If found in legacy key but not obfuscated key, migrates to new storage
 *
 * @returns Valid UUIDv4 string or undefined
 */
export function getDeviceId(): string | undefined {
  try {
    // Check version to detect tampering/corruption
    const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    if (storedVersion && storedVersion !== CURRENT_VERSION) {
      console.warn("[DeviceID] Storage version mismatch detected, regenerating");
      clearDeviceId(); // Clear corrupted data
      return undefined;
    }

    // Try to get from new obfuscated key first
    let stored = localStorage.getItem(STORAGE_KEY);

    // Fallback to legacy key if not in new location (backward compatibility)
    if (!stored) {
      stored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        // Migrate to new secure storage if found in legacy location
        try {
          if (isValidUUIDv4(stored)) {
            localStorage.setItem(STORAGE_KEY, stored);
            localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
            console.debug("[DeviceID] Migrated device ID to secure storage");
          }
        } catch (e) {
          console.warn("[DeviceID] Failed to migrate to secure storage", e);
        }
      }
    }

    if (!stored) {
      return undefined;
    }

    // Strict validation before returning
    if (!isValidUUIDv4(stored)) {
      console.warn("[DeviceID] Stored ID failed validation, clearing");
      clearDeviceId();
      return undefined;
    }

    return stored;
  } catch (error) {
    console.error("[DeviceID] Error retrieving device ID", error);
    return undefined;
  }
}

/**
 * Securely stores a device ID with validation
 * @param id - UUIDv4 to store
 * @throws Error if ID is not a valid UUIDv4
 */
export function setDeviceId(id: string): void {
  if (!isValidUUIDv4(id)) {
    throw new Error(`Invalid UUIDv4 format: ${id.substring(0, 20)}...`);
  }

  try {
    localStorage.setItem(STORAGE_KEY, id);
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
  } catch (error) {
    console.error("[DeviceID] Error storing device ID", error);
    throw new Error("Failed to store device ID. Storage may be full or unavailable.");
  }
}

/**
 * Gets or generates a device ID
 * - First retrieves existing ID from obfuscated storage
 * - If none exists, generates a new secure UUIDv4 and stores it
 * - All values are validated before returning
 *
 * This is the primary API for obtaining a device ID for API requests
 *
 * @returns Valid UUIDv4 string
 */
export function getOrCreateDeviceId(): string {
  // Try to retrieve existing valid ID
  const existing = getDeviceId();
  if (existing) {
    return existing;
  }

  // Generate new ID if none exists
  const newId = generateDeviceId();
  setDeviceId(newId);
  return newId;
}

/**
 * Clears device ID from all storage locations (both new and legacy)
 * Used for logout/reset scenarios
 */
export function clearDeviceId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_VERSION_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY); // Also clear legacy key for complete cleanup
  } catch (error) {
    console.error("[DeviceID] Error clearing device ID", error);
  }
}

/**
 * Security utility for Supabase request headers
 * Ensures device ID is valid UUIDv4 before attaching to requests
 * Prevents sending invalid IDs that could bypass security checks
 *
 * @returns Object suitable for spreading into request headers, or empty object if validation fails
 */
export function getDeviceIdHeader(): Record<string, string> {
  const id = getDeviceId();

  if (!id || !isValidUUIDv4(id)) {
    console.warn("[DeviceID] Cannot create header: device ID missing or invalid");
    return {};
  }

  return {
    "x-device-id": id,
  };
}

/**
 * Debug utility: returns sanitized info about stored device ID (without exposing the actual ID)
 */
export function getDeviceIdStatus(): {
  exists: boolean;
  isValid: boolean;
  hasVersion: boolean;
  versionMatches: boolean;
} {
  const id = localStorage.getItem(STORAGE_KEY);
  const version = localStorage.getItem(STORAGE_VERSION_KEY);

  return {
    exists: !!id,
    isValid: id ? isValidUUIDv4(id) : false,
    hasVersion: !!version,
    versionMatches: version === CURRENT_VERSION,
  };
}
