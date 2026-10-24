/** Primary navigation. Shared by the desktop nav and the mobile drawer. */
export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/daily', label: 'Daily' },
  { href: '/battle', label: 'Free Battle' },
  { href: '/boss-rush', label: 'Boss Rush' },
  { href: '/trainers', label: 'Trainers' },
  { href: '/pokedex', label: 'Pokédex' },
  { href: '/stats', label: 'Stats' },
  { href: '/settings', label: 'Settings' },
];

/** True when `pathname` is the link itself or a sub-route of it (Home only matches exactly). */
export function isActiveLink(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}
