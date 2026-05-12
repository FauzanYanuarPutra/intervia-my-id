import { redirect } from 'next/navigation';
import { buildUsahaPath } from '@/lib/umkmSurface';

export default function CompanyCreateRedirect() {
  redirect(buildUsahaPath('onboarding'));
}
