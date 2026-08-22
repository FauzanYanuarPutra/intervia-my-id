import { redirect } from 'next/navigation';
import { getUsahaWorkspaceUrl } from '@/lib/usahaWorkspace';
export default function LegacyUsahaOnboardingPage() { redirect(getUsahaWorkspaceUrl('/businesses/new')); }
