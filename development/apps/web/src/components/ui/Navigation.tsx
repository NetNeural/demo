import React from 'react';
import Link from 'next/link';

interface NavigationProps {
  currentPage?: string;
}

const navItems = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/dashboard', label: 'Dashboard', key: 'dashboard' },
  { href: '/mvp', label: 'MVP Demo', key: 'mvp' },
];

export default function Navigation({ currentPage }: NavigationProps) {
  return (
    <nav className="nav">
      <div className="nav-container">
        <div className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`nav-link ${currentPage === item.key ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="text-small">NetNeural Platform</div>
      </div>
    </nav>
  );
}
