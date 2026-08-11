import './globals.css';
import { AdminProvider } from '../src/lib/AdminContext';

export const metadata = {
  title: '体育站群后台 | SPORTS CMS',
  description: '体育站群后台管理系统',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AdminProvider apiBaseUrl={process.env.API_URL ?? 'http://127.0.0.1:4000'}>
          {children}
        </AdminProvider>
      </body>
    </html>
  );
}
