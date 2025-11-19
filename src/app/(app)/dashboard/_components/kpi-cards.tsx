"use client";

import { motion } from 'framer-motion';
import { FileText, Users, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type IconName = 'jobs' | 'reports' | 'clients';

const ICONS: Record<IconName, LucideIcon> = {
  jobs: Wrench,
  reports: FileText,
  clients: Users,
};

interface KpiCardProps {
  stats: {
    label: string;
    value: number;
    helper: string;
    icon: IconName;
  }[];
}

export function KpiCards({ stats }: KpiCardProps) {
  return (
    <>
      {stats.map(({ label, value, helper, icon }) => {
        const Icon = ICONS[icon];
        return (
          <motion.div
            key={label}
            whileHover={{ y: -4 }}
            className="rounded-xl border border-white/10 bg-[var(--surface)]/90 p-5 shadow-md transition-shadow duration-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--brand)]">{value}</p>
              </div>
              <div className="rounded-full bg-[var(--muted)] p-3 text-[var(--accent)]">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">{helper}</p>
          </motion.div>
        );
      })}
    </>
  );
}
