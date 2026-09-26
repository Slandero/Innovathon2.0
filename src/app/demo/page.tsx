import type { Metadata } from 'next';
import { DemoPanel } from '@/components/demo/DemoPanel';

export const metadata: Metadata = { title: 'ViveCUU · Panel /demo' };

export default function Demo() {
  return <DemoPanel />;
}
