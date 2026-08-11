import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: '星火体育播放源',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LiveProductPage() {
  notFound();
}
