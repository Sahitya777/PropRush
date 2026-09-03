// Admin registry management
const PRIMARY_ADMIN_EMAIL = 'sahityanijhawan@gmail.com';
const ADMINS_STORAGE_KEY = 'proprush_admin_emails_v1';

export function getAdminEmails(): string[] {
  try {
    const raw = localStorage.getItem(ADMINS_STORAGE_KEY);
    let list: string[] = [PRIMARY_ADMIN_EMAIL];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = Array.from(new Set([PRIMARY_ADMIN_EMAIL, ...parsed.map((e: string) => e.toLowerCase().trim())]));
      }
    }
    return list;
  } catch {
    return [PRIMARY_ADMIN_EMAIL];
  }
}

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  const admins = getAdminEmails();
  return admins.includes(clean);
}

export function addAdminEmail(email: string): { success: boolean; message: string; admins: string[] } {
  const clean = email.toLowerCase().trim();
  if (!clean || !clean.includes('@') || !clean.includes('.')) {
    return { success: false, message: 'Invalid email address format', admins: getAdminEmails() };
  }
  const current = getAdminEmails();
  if (current.includes(clean)) {
    return { success: false, message: 'User is already an administrator', admins: current };
  }
  const updated = [...current, clean];
  try {
    localStorage.setItem(ADMINS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return { success: true, message: `Successfully granted administrator rights to ${clean}`, admins: updated };
}

export function removeAdminEmail(email: string): { success: boolean; message: string; admins: string[] } {
  const clean = email.toLowerCase().trim();
  if (clean === PRIMARY_ADMIN_EMAIL) {
    return { success: false, message: 'Cannot remove primary super admin', admins: getAdminEmails() };
  }
  const current = getAdminEmails();
  const updated = current.filter(e => e !== clean);
  try {
    localStorage.setItem(ADMINS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return { success: true, message: `Revoked admin rights from ${clean}`, admins: updated };
}
