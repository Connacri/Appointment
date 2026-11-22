import React from 'react';
import {
  Crown,
  Shield,
  ShieldCheck,
  Briefcase,
  BellRing,
  Moon,
  Sparkles,
  Bed,
  Shirt,
  Wrench,
  Hammer,
  PlugZap,
  Wind,
  Cog,
  UtensilsCrossed,
  Flower2,
  ShieldAlert,
  User,
  UserCog,
} from 'lucide-react';
import type { RoleIconName } from '../types/roles';

const ICON_MAP: Record<RoleIconName, React.ComponentType<{ size?: number; className?: string }>> = {
  Crown,
  Shield,
  ShieldCheck,
  Briefcase,
  BellRing,
  Moon,
  Sparkles,
  Bed,
  Shirt,
  Wrench,
  Hammer,
  PlugZap,
  Wind,
  Cog,
  UtensilsCrossed,
  Flower2,
  ShieldAlert,
  User,
  UserCog,
};

export const getRoleIconComponent = (iconName?: RoleIconName) => {
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }
  return UserCog;
};

export const RoleIcon: React.FC<{
  iconName?: RoleIconName;
  size?: number;
  className?: string;
}> = ({ iconName, size = 15, className }) => {
  const Icon = getRoleIconComponent(iconName);
  return <Icon size={size} className={className} />;
};
