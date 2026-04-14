// app/dashboard/layout.js
'use client'; // Pastikan ini karena kita akan gunakan hook Client
import { Icon, IconEnum } from '@/components/ui-kit';
import { useRouter } from 'next/navigation';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleBack = () => {
    router.back(); // navigasi ke halaman sebelumnya
  };

  return (
    <div>
      {/* <div
        className="fixed top-5 left-5 cursor-pointer text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]"
        onClick={handleBack}
      >
        <Icon name={IconEnum.CircleArrowLeft} className="w-8 h-8" />
      </div> */}
      {children}
    </div>
  );
}
