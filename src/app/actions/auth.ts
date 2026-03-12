"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { InternalKey, UserDevice } from "@/types/database";

const ADMIN_MASTER_KEY = "HAT-JONAS";

interface LicenseKeyResult {
  success: boolean;
  error?: string;
  isNewUser?: boolean;
  /** Session tokens for client to store in localStorage */
  session?: { access_token: string; refresh_token: string };
}

interface OnboardingResult {
  success: boolean;
  error?: string;
}

interface DeviceInfo {
  fingerprint: string;
  deviceName: string;
  userAgent: string;
}

function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getClientIP(): Promise<string> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const realIP = headersList.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIP || "unknown";
}

async function getGeoLocation(ip: string): Promise<{ city: string; country: string }> {
  if (ip === "unknown" || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.")) {
    return { city: "Lokal", country: "Entwicklung" };
  }
  
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,country`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === "success") {
        return { city: data.city || "Unbekannt", country: data.country || "Unbekannt" };
      }
    }
  } catch (e) {
    console.error("Geo lookup failed:", e);
  }
  
  return { city: "Unbekannt", country: "Unbekannt" };
}

async function registerDevice(
  userId: string, 
  licenseKey: string, 
  deviceInfo: DeviceInfo
): Promise<{ blocked: boolean; error?: string }> {
  const adminClient = createAdminClient();
  
  const ip = await getClientIP();
  const geo = await getGeoLocation(ip);

  const { data: existingDevice } = await adminClient
    .from("user_devices")
    .select("*")
    .eq("user_id", userId)
    .eq("device_fingerprint", deviceInfo.fingerprint)
    .single<UserDevice>();

  if (existingDevice) {
    if (existingDevice.is_blocked) {
      return { blocked: true, error: "Dieses Gerät wurde gesperrt. Kontaktiere den Support." };
    }

    await adminClient
      .from("user_devices")
      .update({
        last_active: new Date().toISOString(),
        ip_address: ip,
        city: geo.city,
        country: geo.country,
        user_agent: deviceInfo.userAgent,
      })
      .eq("id", existingDevice.id);

    return { blocked: false };
  }

  const { error: insertError } = await adminClient
    .from("user_devices")
    .insert({
      user_id: userId,
      license_key: licenseKey,
      device_fingerprint: deviceInfo.fingerprint,
      device_name: deviceInfo.deviceName,
      ip_address: ip,
      city: geo.city,
      country: geo.country,
      user_agent: deviceInfo.userAgent,
    });

  if (insertError) {
    console.error("Error registering device:", insertError);
  }

  return { blocked: false };
}

export async function loginWithLicenseKey(
  prevState: LicenseKeyResult | null,
  formData: FormData
): Promise<LicenseKeyResult> {
  const licenseKey = formData.get("licenseKey")?.toString().trim();
  const deviceFingerprint = formData.get("deviceFingerprint")?.toString() || "unknown";
  const deviceName = formData.get("deviceName")?.toString() || "Unknown Device";
  const userAgent = formData.get("userAgent")?.toString() || "Unknown";

  if (!licenseKey) {
    return { success: false, error: "Bitte gib einen Lizenz-Key ein" };
  }

  const deviceInfo: DeviceInfo = {
    fingerprint: deviceFingerprint,
    deviceName: deviceName,
    userAgent: userAgent,
  };

  try {
    const adminClient = createAdminClient();

    // Check for Admin Master Key
    const isAdminKey = licenseKey === ADMIN_MASTER_KEY;

    if (isAdminKey) {
      const dummyEmail = `admin_master@brospify.local`;
      const password = ADMIN_MASTER_KEY + "_secure_password_123";
      const supabase = await createClient();

      // First, try to sign in (in case admin already exists in auth)
      const { error: existingSignInError } = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password: password,
      });

      if (!existingSignInError) {
        // Successfully signed in - get user and FORCE update to admin
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Delete existing profile and recreate with admin role
          await adminClient.from("users").delete().eq("id", user.id);
          await adminClient.from("users").insert({ 
            id: user.id,
            license_key: ADMIN_MASTER_KEY, 
            role: "admin",
            credits: 0,
            display_name: "Admin"
          });

          // Register admin device
          await registerDevice(user.id, ADMIN_MASTER_KEY, deviceInfo);
        }
        const { data: { session } } = await supabase.auth.getSession();
        return { success: true, isNewUser: false, session: session ? { access_token: session.access_token, refresh_token: session.refresh_token } : undefined };
      }

      // Admin doesn't exist in auth - delete any orphaned auth user first
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingAdmin = existingUsers?.users?.find(u => u.email === dummyEmail);
      if (existingAdmin) {
        // Also delete from users table
        await adminClient.from("users").delete().eq("id", existingAdmin.id);
        await adminClient.auth.admin.deleteUser(existingAdmin.id);
      }

      // Create new admin auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: dummyEmail,
        password: password,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        console.error("Error creating admin user:", authError);
        return { success: false, error: "Fehler beim Erstellen des Admin-Accounts: " + authError?.message };
      }

      // Wait for trigger, then delete and recreate with correct role
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Delete whatever the trigger created
      await adminClient.from("users").delete().eq("id", authData.user.id);
      
      // Insert with correct admin data
      const { error: insertError } = await adminClient
        .from("users")
        .insert({ 
          id: authData.user.id,
          license_key: ADMIN_MASTER_KEY, 
          role: "admin",
          credits: 0,
          display_name: "Admin"
        });

      if (insertError) {
        console.error("Error inserting admin profile:", insertError);
        return { success: false, error: "Fehler beim Erstellen des Admin-Profils: " + insertError.message };
      }

      // Sign in the newly created admin
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password: password,
      });

      if (signInError) {
        console.error("Error signing in admin:", signInError);
        return { success: false, error: "Fehler beim Einloggen: " + signInError.message };
      }

      // Register admin device
      await registerDevice(authData.user.id, ADMIN_MASTER_KEY, deviceInfo);

      const { data: { session } } = await supabase.auth.getSession();
      return { success: true, isNewUser: false, session: session ? { access_token: session.access_token, refresh_token: session.refresh_token } : undefined };
    }

    // Regular user login - check internal_keys table
    const { data: keyData, error: keyError } = await adminClient
      .from("internal_keys")
      .select("*")
      .eq("key_value", licenseKey)
      .single<InternalKey>();

    if (keyError || !keyData) {
      return { success: false, error: "Ungültiger Key" };
    }

    // Check if key is deactivated
    if (!keyData.is_active) {
      return { success: false, error: "Dieser Key wurde deaktiviert" };
    }

    // Check if key is already assigned (existing user - allow multi-device login)
    if (keyData.is_assigned && keyData.assigned_to) {
      // Find the existing user
      const { data: existingUser } = await adminClient
        .from("users")
        .select("id, display_name")
        .eq("id", keyData.assigned_to)
        .single();

      if (existingUser) {
        // Check if device is blocked
        const deviceCheck = await registerDevice(existingUser.id, licenseKey, deviceInfo);
        if (deviceCheck.blocked) {
          return { success: false, error: deviceCheck.error || "Gerät gesperrt" };
        }

        // Try to sign in existing user
        const dummyEmail = `user_${licenseKey.toLowerCase().replace(/[^a-z0-9]/g, "")}@brospify.local`;
        
        // We need to get the auth user to find their email
        const { data: authUsers } = await adminClient.auth.admin.listUsers();
        const authUser = authUsers?.users?.find(u => u.id === existingUser.id);
        
        if (authUser?.email) {
          // Generate a new magic link token by creating a temporary password
          const tempPassword = generateRandomString(32);
          
          // Update auth user's password
          await adminClient.auth.admin.updateUserById(existingUser.id, {
            password: tempPassword,
          });

          const supabase = await createClient();
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: authUser.email,
            password: tempPassword,
          });

          if (signInError) {
            console.error("Error signing in existing user:", signInError);
            return { success: false, error: "Fehler beim Einloggen" };
          }

          const { data: { session } } = await supabase.auth.getSession();
          const needsOnboarding = !existingUser.display_name;
          return { success: true, isNewUser: needsOnboarding, session: session ? { access_token: session.access_token, refresh_token: session.refresh_token } : undefined };
        }
      }
      
      return { success: false, error: "Fehler beim Zugriff auf diesen Account" };
    }

    // Create new user
    const dummyEmail = `user_${licenseKey.toLowerCase().replace(/[^a-z0-9]/g, "")}@brospify.local`;
    const randomPassword = generateRandomString(32);

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: dummyEmail,
      password: randomPassword,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error("Error creating auth user:", authError);
      return { success: false, error: "Fehler beim Erstellen des Accounts" };
    }

    // Update users table with license key
    const { error: updateError } = await adminClient
      .from("users")
      .update({ license_key: licenseKey })
      .eq("id", authData.user.id);

    if (updateError) {
      console.error("Error updating user:", updateError);
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: "Fehler beim Speichern des Lizenz-Keys" };
    }

    // Mark key as assigned
    const { error: assignError } = await adminClient
      .from("internal_keys")
      .update({ 
        is_assigned: true, 
        assigned_to: authData.user.id, 
        assigned_at: new Date().toISOString() 
      })
      .eq("id", keyData.id);

    if (assignError) {
      console.error("Error assigning key:", assignError);
    }

    // Sign in the user
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: dummyEmail,
      password: randomPassword,
    });

    if (signInError) {
      console.error("Error signing in:", signInError);
      return { success: false, error: "Fehler beim Einloggen" };
    }

    const { data: { session } } = await supabase.auth.getSession();
    await registerDevice(authData.user.id, licenseKey, deviceInfo);

    return { success: true, isNewUser: true, session: session ? { access_token: session.access_token, refresh_token: session.refresh_token } : undefined };
  } catch (error) {
    console.error("Login error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten" 
    };
  }
}

export async function saveDisplayName(
  prevState: OnboardingResult | null,
  formData: FormData
): Promise<OnboardingResult> {
  const displayName = formData.get("displayName")?.toString().trim();

  if (!displayName) {
    return { success: false, error: "Bitte gib einen Anzeigenamen ein" };
  }

  if (displayName.length < 2) {
    return { success: false, error: "Der Name muss mindestens 2 Zeichen lang sein" };
  }

  if (displayName.length > 32) {
    return { success: false, error: "Der Name darf maximal 32 Zeichen lang sein" };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: "Nicht eingeloggt" };
    }

    // Use admin client to bypass RLS policies
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from("users")
      .update({ display_name: displayName })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error saving display name:", updateError);
      return { success: false, error: "Fehler beim Speichern des Namens: " + updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Onboarding error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten" 
    };
  }
}

export async function redirectToDashboard() {
  redirect("/dashboard");
}

export async function redirectToWelcome() {
  redirect("/welcome");
}